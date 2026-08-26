"use strict";

/*
 * ============================================================================
 * OffyAI Electron Main Process
 * ============================================================================
 *
 * Architecture:
 *
 *   Electron
 *      |
 *      +---- Static Next.js frontend
 *      |       Development: frontend/out/index.html
 *      |       Production : frontend/out/index.html
 *      |
 *      +---- llama-server
 *              http://127.0.0.1:8080
 *
 * There is NO separate OffyAI backend server.
 *
 * ----------------------------------------------------------------------------
 * FIXES APPLIED IN THIS VERSION (see inline comments for detail):
 *
 *   1. updateSettingsAndRestart() now mutates the `appSettings` object
 *      in place instead of reassigning the variable. Previously,
 *      `setupModelsHandlers(mainWindow, appSettings, saveSettings)` was
 *      handed a reference to the settings object once at startup; every
 *      later `appSettings = mergedSettings` reassignment silently
 *      orphaned that reference, so modelsHandlers.js would keep reading
 *      stale settings forever after the first save.
 *
 *   2. LlamaServerManager.stop() now returns a Promise that resolves
 *      only once the child process has actually exited (with a
 *      force-kill failsafe), and restart() waits for the port to
 *      actually free up instead of sleeping a fixed 500ms. Previously,
 *      a slow process exit (e.g. `taskkill` on Windows) could race with
 *      the fixed delay, causing restart() to think a stale instance was
 *      "already running" and skip starting a fresh one with the new
 *      settings/model.
 *
 *   3. The "set-active-model" IPC handler now resolves a missing
 *      `path` for local models by looking the model up by id via
 *      getAllLocalModels(). Previously, if the caller only supplied
 *      `{id, type}` without a `path`, getActiveModelPath() would fail
 *      its `configured.path` check and silently fall back to
 *      whichever model file happened to be first in the models folder.
 *
 *   4. initializeIPC() calls are now wrapped in try/catch in the
 *      "activate" handler, and `ipcInitialized` is reset before a
 *      genuinely new main window is created after the old one was
 *      destroyed, so handlers bound to a window reference (like
 *      setupModelsHandlers) don't keep pointing at a dead window.
 * ============================================================================
 */

const {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  shell,
  dialog
} = require("electron");

const { spawn, execFileSync } = require("child_process");

const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");

const si = require("systeminformation");

const {
  registerChatHandlers,
  sessionManager
} = require("./src/ipc/chatHandlers");

const { setupMetricsHandlers } = require("./src/ipc/metricsHandlers");
const { setupModelsHandlers } = require("./src/ipc/modelsHandlers");

/*
 * ============================================================================
 * GLOBAL STATE
 * ============================================================================
 */

let mainWindow = null;
let splashWindow = null;

let isQuitting = false;
let mainWindowShown = false;
let ipcInitialized = false;
let frontendErrorShowing = false;

let frontendLoadStarted = false;
let frontendLoadCompleted = false;

let startupTimeout = null;

const serverProcesses = new Set();

const isDev = !app.isPackaged;

/*
 * ============================================================================
 * PATH HELPERS
 * ============================================================================
 */

function resolveAppPath(...parts) {
  const appPath = isDev ? __dirname : app.getAppPath();
  const applicationPath = path.join(appPath, ...parts);

  if (fs.existsSync(applicationPath)) {
    return applicationPath;
  }

  if (!isDev) {
    const unpackedPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      ...parts
    );

    if (fs.existsSync(unpackedPath)) {
      return unpackedPath;
    }
  }

  return applicationPath;
}

/*
 * ============================================================================
 * SETTINGS
 * ============================================================================
 */

const settingsFile = isDev
  ? path.join(__dirname, "settings.json")
  : path.join(app.getPath("userData"), "settings.json");

function getDefaultSettings() {
  return {
    apiKey: "",

    /*
     * This is llama-server.
     * There is NO separate backend.
     */
    serverUrl: "http://127.0.0.1:8080",

    model: "gpt2-124m-fresh-Q8_0",

    activeModel: null,

    remoteModels: [],

    availableModels: [],

    theme: "system",

    performance: {
      lowMemoryMode: false,
      maxMemoryUsage: 2048,
      cpuThreads: Math.max(1, (os.cpus()?.length || 2) - 1),
      enableHardwareAcceleration: true,
      gpuLayers: 0,
      batchSize: 512,
      contextSize: 4096,
      flashAttention: false,
      quantize: "q4_0",
      cacheSize: 2048,
      prefetch: true,

      /*
       * This is only a preference.
       * The actual llama-server executable is queried before a
       * mmap/load-mode argument is supplied.
       */
      mmap: true,
      mlock: false
    },

    chat: {
      maxTokens: 4000,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      frequencyPenalty: 0,
      presencePenalty: 0,
      contextWindow: 4096,
      streamResponses: true,
      showTypingIndicator: true,
      autoContinue: false,
      retryAttempts: 3,
      timeout: 30000,
      systemPrompt: "You are a helpful AI assistant.",
      enableMarkdown: true,
      enableCodeHighlighting: true,
      showTokenCount: true,
      autoScroll: true,
      soundEnabled: true,
      notificationEnabled: false,
      typingSpeed: 50,
      responseDelay: 0
    },

    ui: {
      fontSize: 14,
      compactMode: false,
      showTimestamps: true,
      smoothScrolling: true,
      reduceAnimations: false,
      sidebarPosition: "left",
      messageBubbles: true,
      avatarStyle: "default",
      colorScheme: "blue",
      density: "comfortable",
      fontFamily: "Inter",
      lineHeight: 1.5,
      borderRadius: 8,
      shadowIntensity: "medium",
      highlightColor: "#3b82f6",
      backgroundType: "solid",
      customBackground: "",
      sidebarWidth: 280,
      panelOpacity: 95,
      hoverEffects: true,
      focusRing: true,
      tooltipDelay: 500
    },

    security: {
      autoClearHistory: false,
      autoClearInterval: 24,
      secureMode: false,
      encryptLocalData: true,
      clearOnExit: false,
      sessionTimeout: 60,
      requireAuth: false,
      twoFactorAuth: false,
      auditLogging: true,
      dataRetention: 365,
      privacyMode: false,
      blockTracking: true,
      vpnMode: false,
      contentFilter: "standard",
      allowedDomains: [],
      blockedDomains: [],
      maxFileSize: 100,
      allowedFileTypes: ["image/*", "text/*", "application/pdf"],
      autoUpdate: true,
      backupEnabled: true,
      backupInterval: 24
    },

    system: {
      language: "en",
      region: "US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
      weekStart: "sunday",
      measurementSystem: "metric",
      keyboardLayout: "us",
      mouseSpeed: 50,
      scrollSpeed: 50,
      powerMode: "balanced",
      sleepDelay: 30,
      hibernateDelay: 120,
      notifications: true,
      soundEffects: true,
      autoStart: false,
      updateChannel: "stable",
      logLevel: "info",
      debugMode: false,
      performanceMode: false,
      hardwareAcceleration: true
    }
  };
}

function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return override === undefined ? base : override;
  }

  const result = { ...(base || {}) };

  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Replace the contents of `target` with the contents of `source`,
 * keeping the same object identity. This matters because some modules
 * (e.g. modelsHandlers.js) are handed a direct reference to
 * `appSettings` at startup and read from it later; reassigning
 * `appSettings = someNewObject` elsewhere would orphan that reference.
 */
function applySettingsInPlace(target, source) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      delete target[key];
    }
  }

  Object.assign(target, source);
}

function saveSettings(settings) {
  const directory = path.dirname(settingsFile);

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      settingsFile,
      JSON.stringify(settings, null, 2),
      "utf8"
    );

    return settings;
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  }
}

function loadSettings() {
  const defaults = getDefaultSettings();

  try {
    if (!fs.existsSync(settingsFile)) {
      return saveSettings(defaults);
    }

    const parsed = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    const merged = deepMerge(defaults, parsed);

    if (!merged.serverUrl || typeof merged.serverUrl !== "string") {
      merged.serverUrl = "http://127.0.0.1:8080";
    }

    if (merged.performance && typeof merged.performance !== "object") {
      merged.performance = defaults.performance;
    }

    return merged;
  } catch (error) {
    console.error("Failed to load settings:", error);

    try {
      return saveSettings(defaults);
    } catch {
      return defaults;
    }
  }
}

let appSettings = loadSettings();

/*
 * ============================================================================
 * RESOURCE MANAGER
 * ============================================================================
 */

class ResourceManager {
  constructor() {
    this.performanceMetrics = [];

    this.systemMetrics = {
      cpu: 0,
      memory: 0,
      gpu: 0,
      gpuAvailable: false,
      temperature: 0,
      gpuTemperature: 0
    };

    this.monitorTimer = null;
    this.metricsRequestRunning = false;
  }

  async getRealSystemMetrics() {
    if (this.metricsRequestRunning) {
      return;
    }

    this.metricsRequestRunning = true;

    try {
      const [cpuLoad, memory, graphics] = await Promise.all([
        si.currentLoad().catch(() => null),
        si.mem().catch(() => null),
        si.graphics().catch(() => ({ controllers: [] }))
      ]);

      if (cpuLoad && Number.isFinite(Number(cpuLoad.currentLoad))) {
        this.systemMetrics.cpu = Number(
          Number(cpuLoad.currentLoad).toFixed(1)
        );
      }

      if (memory && Number.isFinite(memory.total) && memory.total > 0) {
        const used = memory.total - memory.available;

        this.systemMetrics.memory = Number(
          ((used / memory.total) * 100).toFixed(1)
        );
      }

      const gpu = graphics?.controllers?.[0];

      if (gpu) {
        this.systemMetrics.gpuAvailable = true;

        const usage = Number(gpu.utilizationGpu);
        const temperature = Number(gpu.temperatureGpu);

        this.systemMetrics.gpu = Number.isFinite(usage)
          ? Number(usage.toFixed(1))
          : 0;

        this.systemMetrics.gpuTemperature = Number.isFinite(temperature)
          ? Number(temperature.toFixed(1))
          : 0;
      } else {
        this.systemMetrics.gpuAvailable = false;
        this.systemMetrics.gpu = 0;
        this.systemMetrics.gpuTemperature = 0;
      }

      try {
        const temperature = await si.cpuTemperature();
        const mainTemperature = Number(temperature?.main);

        this.systemMetrics.temperature = Number.isFinite(mainTemperature)
          ? Number(mainTemperature.toFixed(1))
          : 0;
      } catch {
        this.systemMetrics.temperature = 0;
      }

      this.performanceMetrics.push({
        timestamp: Date.now(),
        ...this.systemMetrics
      });

      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics.shift();
      }
    } catch (error) {
      console.error("System metrics error:", error);
    } finally {
      this.metricsRequestRunning = false;
    }
  }

  startMonitoring() {
    if (this.monitorTimer) {
      return;
    }

    void this.getRealSystemMetrics();

    this.monitorTimer = setInterval(() => {
      void this.getRealSystemMetrics();
    }, 5000);
  }

  stopMonitoring() {
    if (!this.monitorTimer) {
      return;
    }

    clearInterval(this.monitorTimer);
    this.monitorTimer = null;
  }

  getMetrics() {
    return {
      system: { ...this.systemMetrics },
      history: [...this.performanceMetrics],
      timestamp: Date.now()
    };
  }
}

const resourceManager = new ResourceManager();

/*
 * ============================================================================
 * MODEL MANAGER
 * ============================================================================
 */

class ModelManager {
  constructor() {
    this.supportedFormats = [".gguf", ".bin", ".ggml"];
  }

  async scanForModels(modelsPath) {
    try {
      fs.mkdirSync(modelsPath, { recursive: true });

      const items = fs.readdirSync(modelsPath, { withFileTypes: true });
      const models = [];

      for (const item of items) {
        if (!item.isFile()) {
          continue;
        }

        const extension = path.extname(item.name).toLowerCase();

        if (!this.supportedFormats.includes(extension)) {
          continue;
        }

        const fullPath = path.join(modelsPath, item.name);

        let stats;

        try {
          stats = fs.statSync(fullPath);
        } catch {
          continue;
        }

        models.push({
          id: path.basename(item.name, extension),
          fileName: item.name,
          path: fullPath,
          type: "local",
          name: path.basename(item.name, extension),
          size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          sizeBytes: stats.size,
          format: extension.slice(1),
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          isDirectory: false
        });
      }

      models.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`Found ${models.length} local model(s)`);

      return models;
    } catch (error) {
      console.error("Model scan error:", error);
      return [];
    }
  }
}

const modelManager = new ModelManager();

function getModelsPath() {
  const candidates = isDev
    ? [path.join(__dirname, "models"), path.join(process.cwd(), "models")]
    : [
        path.join(process.resourcesPath, "models"),
        path.join(process.resourcesPath, "app.asar.unpacked", "models"),
        path.join(app.getPath("userData"), "models")
      ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Continue.
    }
  }

  const fallback = candidates[0];
  fs.mkdirSync(fallback, { recursive: true });

  return fallback;
}

// Tracks the last path we logged, so frequent callers (status polling,
// settings reads, etc.) don't flood the console with an identical line
// on every single call. Only log when the resolved path actually changes.
let lastLoggedModelPath = null;

function getActiveModelPath() {
  try {
    const configured = appSettings.activeModel;
    const configuredPath = configured?.path
      ? path.isAbsolute(configured.path)
        ? configured.path
        : path.resolve(__dirname, configured.path)
      : null;

    if (
      configured?.type === "local" &&
      configuredPath &&
      fs.existsSync(configuredPath)
    ) {
      if (lastLoggedModelPath !== configuredPath) {
        console.log("Using active model:", configuredPath);
        lastLoggedModelPath = configuredPath;
      }

      return configuredPath;
    }

    const modelsPath = getModelsPath();
    const files = fs.readdirSync(modelsPath);

    const modelFile = files.find((file) => /\.(gguf|bin|ggml)$/i.test(file));

    if (!modelFile) {
      return null;
    }

    const modelPath = path.join(modelsPath, modelFile);

    if (lastLoggedModelPath !== modelPath) {
      console.log("Using available model:", modelPath);
      lastLoggedModelPath = modelPath;
    }

    return modelPath;
  } catch (error) {
    console.error("Unable to determine model:", error);
    return null;
  }
}

async function getAllLocalModels() {
  return modelManager.scanForModels(getModelsPath());
}

/*
 * ============================================================================
 * SPLASH WINDOW
 * ============================================================================
 */

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow;
  }

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  splashWindow.setMenuBarVisibility(false);

  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  const splashPath = resolveAppPath("splash.html");

  if (fs.existsSync(splashPath)) {
    void splashWindow.loadFile(splashPath).catch((error) => {
      console.error("Failed to load splash:", error);
    });

    return splashWindow;
  }

  const fallbackHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>OffyAI</title>
<style>
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; padding: 0; }
body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0ea5e9 0%, #7e22ce 100%);
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  overflow: hidden;
  user-select: none;
}
.container { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; }
.logo { font-size: 48px; font-weight: 700; line-height: 1; letter-spacing: -1.5px; margin-bottom: 28px; text-shadow: 0 2px 4px rgba(0,0,0,0.25); }
.spinner { width: 42px; height: 42px; border: 4px solid rgba(255,255,255,0.25); border-top-color: #ffffff; border-radius: 50%; animation: spin 0.85s linear infinite; }
.status { margin-top: 22px; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.95); text-align: center; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
</head>
<body>
<main class="container">
  <div class="logo">OffyAI</div>
  <div class="spinner" aria-hidden="true"></div>
  <div class="status">Starting OffyAI...</div>
</main>
</body>
</html>
`;

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(
    fallbackHTML
  )}`;

  void splashWindow.loadURL(dataUrl).catch((error) => {
    console.error("Failed to load fallback splash:", error);
  });

  return splashWindow;
}

/*
 * ============================================================================
 * FRONTEND DISCOVERY
 * ============================================================================
 */

function getFrontendCandidates() {
  return [resolveAppPath("frontend", "out", "index.html")];
}

function findFrontend() {
  const candidates = getFrontendCandidates();

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Continue.
    }
  }

  return null;
}

/*
 * ============================================================================
 * HTML ERROR HELPERS
 * ============================================================================
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeErrorDetails(details) {
  let value = String(details ?? "");

  value = value.replace(
    /data:text\/html[^\s\n]*/gi,
    "[embedded HTML error page omitted]"
  );

  value = value.replace(
    /(?:%25){2,}[A-Za-z0-9%._~:/?#\[\]@!$&'()*+,;=-]*/gi,
    "[repeatedly encoded data omitted]"
  );

  if (value.length > 12000) {
    value = `${value.slice(0, 12000)}\n[details truncated]`;
  }

  return value;
}

function createFrontendErrorHTML(title, details) {
  const safeTitle = escapeHtml(title || "Application error");
  const safeDetails = escapeHtml(sanitizeErrorDetails(details));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OffyAI - Startup Error</title>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; width: 100%; height: 100%; }
body {
  background: #111827;
  color: #f9fafb;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
.container { width: min(760px, 100%); }
h1 { margin: 0 0 16px; font-size: 28px; }
p { color: #d1d5db; line-height: 1.6; }
pre { margin-top: 20px; padding: 16px; background: #030712; border-radius: 8px; overflow: auto; color: #fca5a5; white-space: pre-wrap; word-break: break-word; }
button { margin-top: 20px; border: 0; border-radius: 8px; padding: 10px 18px; background: #3b82f6; color: white; cursor: pointer; font-size: 14px; }
button:hover { background: #2563eb; }
</style>
</head>
<body>
<main class="container">
<h1>${safeTitle}</h1>
<p>OffyAI could not load its main interface.</p>
<pre>${safeDetails}</pre>
<button id="retry">Retry</button>
</main>
<script>
document.getElementById("retry").addEventListener("click", () => location.reload());
</script>
</body>
</html>
`;
}

function loadRawHtml(window, html) {
  if (!window || window.isDestroyed()) {
    return Promise.reject(new Error("Window is unavailable."));
  }

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  return window.loadURL(dataUrl);
}

/*
 * ============================================================================
 * WINDOW DISPLAY
 * ============================================================================
 */

function closeSplashWindow() {
  if (!splashWindow || splashWindow.isDestroyed()) {
    splashWindow = null;
    return;
  }

  try {
    splashWindow.close();
  } catch (error) {
    console.warn("Unable to close splash:", error);
  }

  splashWindow = null;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindowShown) {
    return;
  }

  mainWindowShown = true;

  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }

  closeSplashWindow();

  mainWindow.show();

  try {
    mainWindow.focus();
  } catch {
    // Ignore.
  }
}

function showFrontendError(title, details) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (frontendErrorShowing) {
    return;
  }

  frontendErrorShowing = true;

  const cleanDetails = sanitizeErrorDetails(details);

  console.error(title, cleanDetails);

  const html = createFrontendErrorHTML(title, cleanDetails);

  void loadRawHtml(mainWindow, html)
    .catch((error) => {
      console.error("Failed to load error page:", error);
    })
    .finally(() => {
      showMainWindow();
    });
}

/*
 * ============================================================================
 * MAIN WINDOW
 * ============================================================================
 */

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const iconPath = resolveAppPath("offyai.png");

  let appIcon = null;

  try {
    if (fs.existsSync(iconPath)) {
      appIcon = nativeImage.createFromPath(iconPath);
    }
  } catch (error) {
    console.warn("Unable to load application icon:", error);
  }

  mainWindowShown = false;
  frontendErrorShowing = false;
  frontendLoadStarted = false;
  frontendLoadCompleted = false;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: "#111827",
    icon: appIcon || undefined,
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolveAppPath("preload.js"),
      contextIsolation: true,
      nodeIntegration: false,

      /*
       * The frontend is always loaded from the local static export.
       * No Next.js HTTP server is used.
       */
      webSecurity: true,
      spellcheck: true,
      sandbox: false,
      devTools: isDev
    }
  });

  mainWindow.setMenuBarVisibility(false);

  /*
   * RENDERER CONSOLE
   */
  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      if (isDev || appSettings.system?.debugMode) {
        console.log(`[Renderer:${level}] ${message} (${sourceId}:${line})`);
      }
    }
  );

  /*
   * LOAD FAILURE
   */
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      // ERR_ABORTED is normally caused by navigation/reload.
      if (errorCode === -3 || errorDescription === "ERR_ABORTED") {
        return;
      }

      if (
        frontendErrorShowing ||
        /^data:text\/html/i.test(validatedURL || "")
      ) {
        return;
      }

      console.error("Renderer failed to load:", {
        errorCode,
        errorDescription,
        validatedURL
      });

      showFrontendError(
        "Unable to load OffyAI",
        [
          `Error code: ${errorCode}`,
          `Description: ${errorDescription}`,
          `URL: ${sanitizeErrorDetails(validatedURL)}`
        ].join("\n")
      );
    }
  );

  /*
   * SUCCESSFUL LOAD
   */
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Main frontend finished loading.");

    frontendLoadCompleted = true;

    if (!frontendErrorShowing) {
      showMainWindow();
    }
  });

  /*
   * READY TO SHOW
   */
  mainWindow.once("ready-to-show", () => {
    if (!frontendErrorShowing) {
      // ready-to-show is sufficient for Electron to display the renderer.
      // did-finish-load also calls this. showMainWindow() is idempotent.
      showMainWindow();
    }
  });

  /*
   * RENDERER CRASH
   */
  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error("Renderer process terminated:", details);

    if (!mainWindowShown && !frontendErrorShowing) {
      showFrontendError(
        "OffyAI renderer stopped",
        JSON.stringify(details, null, 2)
      );
    }
  });

  /*
   * CLOSED
   */
  mainWindow.on("closed", () => {
    mainWindow = null;
    mainWindowShown = false;
    frontendLoadStarted = false;
    frontendLoadCompleted = false;
  });

  /*
   * CLOSE BUTTON
   */
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  /*
   * FRONTEND
   */
  frontendLoadStarted = true;
  void loadFrontend(mainWindow);

  /*
   * STARTUP FAILSAFE
   *
   * This is NOT a polling loop. It fires once after 45 seconds.
   * If the renderer is still loading, an error is displayed rather
   * than leaving the splash forever.
   */
  startupTimeout = setTimeout(() => {
    startupTimeout = null;

    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindowShown ||
      frontendErrorShowing ||
      frontendLoadCompleted
    ) {
      return;
    }

    console.error("Frontend startup timeout.");

    showFrontendError(
      "OffyAI startup timeout",
      [
        "The frontend did not finish loading.",
        "",
        "Static frontend:",
        String(
          findFrontend() ||
            resolveAppPath("frontend", "out", "index.html")
        ),
        "",
        "The static frontend failed to finish loading."
      ].join("\n")
    );
  }, 45000);

  return mainWindow;
}

/*
 * ============================================================================
 * STATIC FRONTEND LOADER
 * ============================================================================
 *
 * There is deliberately NO development branch here. Both development
 * and production use frontend/out/index.html, loaded directly from
 * the local filesystem.
 * ============================================================================
 */

async function loadFrontend(window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  const frontendPath = findFrontend();

  if (!frontendPath) {
    showFrontendError(
      "Frontend build not found",
      [
        "OffyAI could not find the static frontend.",
        "",
        "The frontend must be built before starting Electron.",
        "",
        "Build it with:",
        "cd frontend",
        "npm install",
        "npm run build",
        "",
        "Expected file:",
        resolveAppPath("frontend", "out", "index.html"),
        "",
        "Checked:",
        ...getFrontendCandidates()
      ].join("\n")
    );

    return;
  }

  try {
    console.log("Static frontend found:", frontendPath);

    frontendErrorShowing = false;

    console.log("Loading static frontend...");

    await window.loadFile(frontendPath);

    console.log("Static frontend loaded successfully.");
  } catch (error) {
    showFrontendError(
      "Frontend failed to load",
      [
        `File: ${frontendPath}`,
        "",
        error.stack || error.message || String(error)
      ].join("\n")
    );
  }
}

/*
 * ============================================================================
 * LLAMA SERVER MANAGER
 * ============================================================================
 */

class LlamaServerManager {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.starting = false;
    this.port = 8080;
    this.host = "127.0.0.1";
    this.capabilities = null;
    this.lastError = null;
  }

  /*
   * FIND EXECUTABLE
   */
  findExecutable() {
    const candidates =
      process.platform === "win32"
        ? ["llama-server.exe", path.join("bin", "llama-server.exe")]
        : ["llama-server", path.join("bin", "llama-server")];

    for (const relative of candidates) {
      const candidate = resolveAppPath(...relative.split(path.sep));

      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // Continue.
      }
    }

    try {
      const command = process.platform === "win32" ? "where.exe" : "which";
      const executableName =
        process.platform === "win32" ? "llama-server.exe" : "llama-server";

      const output = execFileSync(command, [executableName], {
        encoding: "utf8",
        windowsHide: true
      }).trim();

      if (output) {
        return (
          output
            .split(/\r?\n/)
            .map((item) => item.trim())
            .find(Boolean) || null
        );
      }
    } catch {
      // Not in PATH.
    }

    return null;
  }

  /*
   * READ LLAMA HELP
   */
  getExecutableHelp(executable) {
    if (!executable) {
      return "";
    }

    try {
      const output = execFileSync(executable, ["--help"], {
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024
      });

      return String(output || "");
    } catch (error) {
      // Some native binaries return a non-zero status from --help.
      return String(error?.stdout || error?.stderr || "");
    }
  }

  /*
   * DETECT SUPPORTED FLAGS
   */
  detectCapabilities(executable) {
    if (this.capabilities && this.capabilities.executable === executable) {
      return this.capabilities;
    }

    const help = this.getExecutableHelp(executable);
    const normalized = help.toLowerCase();

    const capabilities = {
      executable,
      help,
      host: normalized.includes("--host"),
      port: normalized.includes("--port"),
      threads: normalized.includes("--threads"),
      contextSize: normalized.includes("--ctx-size"),
      batchSize: normalized.includes("--batch-size"),
      gpuLayers:
        normalized.includes("--n-gpu-layers") ||
        normalized.includes("--gpu-layers"),
      loadMode: normalized.includes("--load-mode"),
      mmap: normalized.includes("--mmap"),
      noMmap: normalized.includes("--no-mmap"),
      mlock: normalized.includes("--mlock"),
      lowVram: normalized.includes("--low-vram"),
      verbose: normalized.includes("--verbose")
    };

    this.capabilities = capabilities;

    return capabilities;
  }

  /*
   * PORT CHECK
   */
  isPortInUse(port) {
    return new Promise((resolve) => {
      const server = net.createServer();

      let finished = false;

      const finish = (value) => {
        if (finished) {
          return;
        }

        finished = true;
        resolve(value);
      };

      server.once("error", (error) => {
        finish(error.code === "EADDRINUSE");
      });

      server.once("listening", () => {
        server.close(() => {
          finish(false);
        });
      });

      server.listen(port, this.host);
    });
  }

  /*
   * WAIT FOR LLAMA PORT
   */
  waitForPort(port, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();

      let stopped = false;

      const attempt = () => {
        if (stopped) {
          return;
        }

        if (Date.now() - started >= timeout) {
          stopped = true;
          reject(
            new Error(
              `Timeout waiting for llama-server on ${this.host}:${port}`
            )
          );
          return;
        }

        const socket = net.createConnection({ host: this.host, port });

        let done = false;

        const finish = (success) => {
          if (done) {
            return;
          }

          done = true;

          try {
            socket.destroy();
          } catch {
            // Ignore.
          }

          if (success) {
            stopped = true;
            resolve();
            return;
          }

          if (Date.now() - started >= timeout) {
            stopped = true;
            reject(
              new Error(
                `Timeout waiting for llama-server on ${this.host}:${port}`
              )
            );
            return;
          }

          setTimeout(attempt, 500);
        };

        socket.setTimeout(1000, () => {
          finish(false);
        });

        socket.once("connect", () => {
          finish(true);
        });

        socket.once("error", () => {
          finish(false);
        });
      };

      attempt();
    });
  }

  /*
   * BUILD LLAMA ARGUMENTS
   */
  buildArguments(executable, modelPath) {
    const performance = appSettings.performance || {};
    const capabilities = this.detectCapabilities(executable);
    const cpuCount = os.cpus()?.length || 2;

    const threads = Math.max(
      1,
      Number(performance.cpuThreads) || Math.max(1, cpuCount - 1)
    );

    const contextSize = Math.max(512, Number(performance.contextSize) || 4096);
    const batchSize = Math.max(1, Number(performance.batchSize) || 512);
    const gpuLayers = Math.max(0, Number(performance.gpuLayers) || 0);

    const args = [];

    // Model
    args.push("--model", modelPath);

    // Host
    if (capabilities.host) {
      args.push("--host", this.host);
    }

    // Port
    if (capabilities.port) {
      args.push("--port", String(this.port));
    }

    // CPU threads
    if (capabilities.threads) {
      args.push("--threads", String(threads));
    }

    // Context
    if (capabilities.contextSize) {
      args.push("--ctx-size", String(contextSize));
    }

    // Batch
    if (capabilities.batchSize) {
      args.push("--batch-size", String(batchSize));
    }

    // GPU layers (default = 0)
    if (capabilities.gpuLayers) {
      args.push("--n-gpu-layers", String(gpuLayers));
    }

    /*
     * MEMORY LOADING
     *
     * NEVER blindly pass --mmap. The actual executable is inspected
     * first via detectCapabilities().
     */
    const requestedMmap = performance.mmap !== false;

    if (capabilities.loadMode) {
      args.push("--load-mode", requestedMmap ? "mmap" : "none");
    } else if (requestedMmap && capabilities.mmap) {
      args.push("--mmap");
    } else if (!requestedMmap && capabilities.noMmap) {
      args.push("--no-mmap");
    } else {
      console.log(
        "llama-server: no compatible mmap/load-mode flag detected; using executable default."
      );
    }

    // mlock
    if (performance.mlock === true && capabilities.mlock) {
      args.push("--mlock");
    }

    // Low memory mode
    if (performance.lowMemoryMode && capabilities.lowVram) {
      args.push("--low-vram");
    }

    // Verbose
    if (appSettings.system?.debugMode && capabilities.verbose) {
      args.push("--verbose");
    }

    return { args, capabilities, threads, contextSize, batchSize, gpuLayers };
  }

  /*
   * START
   */
  async start() {
    if (this.process && !this.process.killed) {
      return this.process;
    }

    if (this.starting) {
      return null;
    }

    this.starting = true;
    this.lastError = null;

    try {
      const modelPath = getActiveModelPath();

      if (!modelPath) {
        console.warn("No local model found. llama-server will not start.");
        return null;
      }

      if (!fs.existsSync(modelPath)) {
        console.warn("Configured model does not exist:", modelPath);
        return null;
      }

      // Do not start a duplicate server.
      if (await this.isPortInUse(this.port)) {
        console.log(
          `llama-server already appears to be running on ${this.host}:${this.port}.`
        );

        this.isRunning = true;
        return null;
      }

      const executable = this.findExecutable();

      if (!executable) {
        const error = new Error(
          [
            "llama-server executable was not found.",
            "",
            "Expected:",
            resolveAppPath("llama-server.exe")
          ].join("\n")
        );

        this.lastError = error.message;
        console.error(error.message);

        return null;
      }

      const launch = this.buildArguments(executable, modelPath);
      const { args, capabilities, threads } = launch;

      console.log("Starting llama-server:", executable);
      console.log("llama-server capabilities:", {
        loadMode: capabilities.loadMode,
        mmap: capabilities.mmap,
        noMmap: capabilities.noMmap,
        gpuLayers: capabilities.gpuLayers
      });
      console.log("Llama arguments:", args);

      const executableDirectory = path.dirname(executable);

      const environment = {
        ...process.env,
        GGML_NUM_THREADS: String(threads),
        NODE_ENV: isDev ? "development" : "production"
      };

      this.process = spawn(executable, args, {
        cwd: executableDirectory,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: false,
        env: environment
      });

      serverProcesses.add(this.process);

      const child = this.process;

      // STDOUT
      child.stdout.on("data", (data) => {
        const message = data.toString().trim();

        if (!message) {
          return;
        }

        console.log(`[Llama] ${message}`);

        if (
          /server listening|http server listening|listening on|starting server/i.test(
            message
          )
        ) {
          this.isRunning = true;
        }
      });

      // STDERR
      child.stderr.on("data", (data) => {
        const message = data.toString().trim();

        if (!message) {
          return;
        }

        if (/error:|fatal:|failed|invalid argument|cannot|unable/i.test(message)) {
          console.error(`[Llama:stderr] ${message}`);
        } else if (appSettings.system?.debugMode) {
          console.log(`[Llama:stderr] ${message}`);
        }
      });

      // ERROR
      child.once("error", (error) => {
        console.error("llama-server process error:", error);

        this.lastError = error.message;
        this.isRunning = false;

        serverProcesses.delete(child);

        if (this.process === child) {
          this.process = null;
        }
      });

      // EXIT
      child.once("exit", (code, signal) => {
        console.log(`llama-server exited. code=${code}, signal=${signal}`);

        if (code !== 0 && !isQuitting) {
          this.lastError = `llama-server exited with code ${code}${
            signal ? `, signal ${signal}` : ""
          }`;
        }

        this.isRunning = false;

        serverProcesses.delete(child);

        if (this.process === child) {
          this.process = null;
        }
      });

      /*
       * Wait for the actual TCP listener. This does NOT block the
       * frontend since start() itself runs off the main thread's
       * event loop via setImmediate() at startup.
       */
      try {
        await this.waitForPort(this.port, 60000);

        this.isRunning = true;

        console.log(`llama-server is ready on ${this.host}:${this.port}.`);
      } catch (error) {
        console.warn("llama-server did not become ready:", error.message);

        await new Promise((resolve) => setTimeout(resolve, 250));

        if (child.exitCode !== null) {
          console.error(
            "llama-server failed during startup:",
            this.lastError || `exit code ${child.exitCode}`
          );
        }
      }

      return child;
    } catch (error) {
      console.error("Failed to start llama-server:", error);

      this.lastError = error.message || String(error);
      this.process = null;
      this.isRunning = false;

      return null;
    } finally {
      this.starting = false;
    }
  }

  /*
   * STATUS
   */
  async getStatus() {
    let running = this.isRunning;

    if (!running) {
      try {
        running = await this.isPortInUse(this.port);
      } catch {
        running = false;
      }
    }

    return {
      // There is no backend.
      backend: false,
      backendUrl: null,

      running,
      llama: running,

      host: this.host,
      url: `http://${this.host}:${this.port}`,
      llamaUrl: `http://${this.host}:${this.port}`,
      port: this.port,

      model: getActiveModelPath(),
      executable: this.findExecutable(),
      pid: this.process?.pid || null,
      error: this.lastError,

      capabilities: this.capabilities
        ? {
            loadMode: this.capabilities.loadMode,
            mmap: this.capabilities.mmap,
            noMmap: this.capabilities.noMmap,
            gpuLayers: this.capabilities.gpuLayers
          }
        : null,

      timestamp: Date.now()
    };
  }

  /*
   * RESTART
   *
   * FIX: previously this did `stop(); await sleep(500); start();`.
   * stop() didn't wait for the process to actually die, so on a slow
   * shutdown (particularly `taskkill /f` on Windows, which is itself
   * async) the fixed 500ms delay could elapse before the port was
   * actually free. start() would then see the port still bound,
   * assume a server was "already running", and return without
   * applying the new settings/model. Now stop() resolves only once
   * the process has genuinely exited, and restart() additionally
   * polls the port (bounded by a timeout) before calling start().
   */
  async restart() {
    await this.stop();

    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
      let inUse = false;

      try {
        inUse = await this.isPortInUse(this.port);
      } catch {
        inUse = false;
      }

      if (!inUse) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return this.start();
  }

  /*
   * STOP
   *
   * FIX: now returns a Promise that resolves once the child process
   * has actually exited (or a 5s failsafe elapses and it is
   * force-killed), instead of returning immediately after only
   * sending the kill signal.
   */
  stop() {
    const child = this.process;

    this.process = null;
    this.isRunning = false;

    if (!child) {
      return Promise.resolve();
    }

    serverProcesses.delete(child);

    return new Promise((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve();
      };

      child.once("exit", finish);

      try {
        if (process.platform === "win32") {
          const killer = spawn(
            "taskkill",
            ["/pid", String(child.pid), "/t", "/f"],
            { windowsHide: true, stdio: "ignore" }
          );

          killer.on("error", () => {
            try {
              child.kill();
            } catch {
              // Ignore.
            }
          });
        } else {
          try {
            child.kill("SIGTERM");
          } catch {
            // Ignore.
          }
        }
      } catch (error) {
        console.warn("Failed to stop llama-server:", error);
      }

      // Failsafe: don't wait forever for a process that refuses to exit.
      setTimeout(() => {
        if (!settled) {
          try {
            child.kill("SIGKILL");
          } catch {
            // Ignore.
          }

          finish();
        }
      }, 5000);
    });
  }
}

const llamaServer = new LlamaServerManager();

/*
 * ============================================================================
 * SETTINGS UPDATE
 * ============================================================================
 */

async function updateSettingsAndRestart(newSettings) {
  // Deep-clone snapshot for comparison and rollback purposes. Settings
  // are plain JSON-serializable data (no functions/Dates), so this is
  // a safe way to get an independent copy.
  const oldSettingsSnapshot = JSON.parse(JSON.stringify(appSettings));

  const mergedSettings = deepMerge(appSettings, newSettings || {});

  try {
    // FIX: mutate `appSettings` in place (same object identity) instead
    // of doing `appSettings = mergedSettings`. Other modules (e.g.
    // modelsHandlers.js, via setupModelsHandlers) were handed a direct
    // reference to this object at startup; reassigning the variable
    // here would silently orphan that reference from ever seeing
    // future updates.
    applySettingsInPlace(appSettings, mergedSettings);

    saveSettings(appSettings);

    const oldPerformance = oldSettingsSnapshot.performance || {};
    const newPerformance = appSettings.performance || {};

    const modelChanged = Boolean(
      newSettings?.activeModel &&
        newSettings.activeModel.id !== oldSettingsSnapshot.activeModel?.id
    );

    const performanceChanged =
      oldSettingsSnapshot.serverUrl !== appSettings.serverUrl ||
      oldPerformance.lowMemoryMode !== newPerformance.lowMemoryMode ||
      oldPerformance.cpuThreads !== newPerformance.cpuThreads ||
      oldPerformance.gpuLayers !== newPerformance.gpuLayers ||
      oldPerformance.contextSize !== newPerformance.contextSize ||
      oldPerformance.batchSize !== newPerformance.batchSize ||
      oldPerformance.mmap !== newPerformance.mmap ||
      oldPerformance.mlock !== newPerformance.mlock;

    if (modelChanged || performanceChanged) {
      await llamaServer.restart();
    }

    return appSettings;
  } catch (error) {
    applySettingsInPlace(appSettings, oldSettingsSnapshot);
    throw error;
  }
}

/*
 * ============================================================================
 * IPC
 * ============================================================================
 */

function setupApplicationIPC() {
  /*
   * WINDOW
   */
  ipcMain.handle("minimize-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }

    return true;
  });

  ipcMain.handle("maximize-window", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return false;
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }

    return true;
  });

  ipcMain.handle("close-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }

    return true;
  });

  /*
   * ICON
   */
  ipcMain.handle("get-app-icon", () => {
    try {
      const iconPath = resolveAppPath("offyai.png");
      return fs.existsSync(iconPath) ? iconPath : null;
    } catch (error) {
      console.error("get-app-icon failed:", error);
      return null;
    }
  });

  /*
   * APP VERSION
   */
  ipcMain.handle("get-app-version", () => {
    try {
      return app.getVersion();
    } catch (error) {
      console.error("get-app-version failed:", error);
      return null;
    }
  });

  /*
   * SETTINGS
   */
  ipcMain.handle("get-settings", () => {
    return appSettings;
  });

  ipcMain.handle("save-settings", async (event, newSettings) => {
    try {
      return await updateSettingsAndRestart(newSettings);
    } catch (error) {
      console.error("save-settings failed:", error);
      throw error;
    }
  });

  /*
   * MODELS
   */
  ipcMain.handle("get-local-models", async () => {
    return getAllLocalModels();
  });

  ipcMain.handle("get-models-path", async () => {
    return getModelsPath();
  });

  ipcMain.handle("set-active-model", async (event, model) => {
    try {
      if (!model || typeof model !== "object") {
        throw new Error("Invalid model.");
      }

      let resolvedModel = { ...model };

      /*
       * FIX: previously, if the caller sent a local model without a
       * `path` (e.g. just `{id, type: "local"}`), getActiveModelPath()
       * would fail its `configured.path` existence check and silently
       * fall back to whichever model file happened to be first in the
       * models folder — meaning the user's actual selection was
       * ignored. Now we resolve the real path by id when it's missing.
       */
      if (resolvedModel.type === "local" && !resolvedModel.path) {
        const localModels = await getAllLocalModels();
        const found = localModels.find(
          (item) => item.id === resolvedModel.id
        );

        if (found) {
          resolvedModel = { ...found, ...resolvedModel, path: found.path };
        }
      }

      if (
        resolvedModel.type === "local" &&
        resolvedModel.path &&
        !fs.existsSync(resolvedModel.path)
      ) {
        throw new Error("Selected model file does not exist.");
      }

      appSettings.activeModel = resolvedModel;

      saveSettings(appSettings);

      if (resolvedModel.type === "local") {
        await llamaServer.restart();
      }

      return { success: true, model: resolvedModel };
    } catch (error) {
      console.error("set-active-model failed:", error);

      return {
        success: false,
        error: error.message || "Failed to activate model."
      };
    }
  });

  ipcMain.handle("delete-model", async (event, modelId, modelType) => {
    try {
      if (!modelId) {
        throw new Error("Model ID is required.");
      }

      if (modelType === "local") {
        const modelsPath = getModelsPath();

        let deleted = false;

        for (const extension of [".gguf", ".bin", ".ggml"]) {
          const modelFile = path.join(modelsPath, modelId + extension);

          if (fs.existsSync(modelFile)) {
            const activePath = getActiveModelPath();

            if (
              activePath &&
              path.resolve(activePath) === path.resolve(modelFile)
            ) {
              await llamaServer.stop();
            }

            fs.unlinkSync(modelFile);

            deleted = true;

            console.log("Deleted local model:", modelFile);

            break;
          }
        }

        if (!deleted) {
          throw new Error("Local model file was not found.");
        }

        if (appSettings.activeModel?.id === modelId) {
          appSettings.activeModel = null;
          saveSettings(appSettings);
        }
      } else {
        appSettings.remoteModels = (appSettings.remoteModels || []).filter(
          (model) => model.id !== modelId
        );

        saveSettings(appSettings);
      }

      return { success: true };
    } catch (error) {
      console.error("delete-model failed:", error);

      return {
        success: false,
        error: error.message || String(error)
      };
    }
  });

  ipcMain.handle("upload-model", async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== "string") {
        throw new Error("Model file path is required.");
      }

      if (!fs.existsSync(filePath)) {
        throw new Error("Source model file does not exist.");
      }

      const sourceStats = fs.statSync(filePath);

      if (!sourceStats.isFile()) {
        throw new Error("Selected model path is not a file.");
      }

      const extension = path.extname(filePath).toLowerCase();

      if (![".gguf", ".bin", ".ggml"].includes(extension)) {
        throw new Error(
          "Unsupported model format. Supported formats: .gguf, .bin, .ggml"
        );
      }

      const modelsPath = getModelsPath();

      fs.mkdirSync(modelsPath, { recursive: true });

      const fileName = path.basename(filePath);
      const destination = path.join(modelsPath, fileName);

      if (path.resolve(filePath) === path.resolve(destination)) {
        return { success: true, fileName, path: destination };
      }

      fs.copyFileSync(filePath, destination);

      return { success: true, fileName, path: destination };
    } catch (error) {
      console.error("upload-model failed:", error);

      return {
        success: false,
        error: error.message || String(error)
      };
    }
  });

  /*
   * FILE OPEN (generic helper, used by some renderer flows)
   */
  ipcMain.handle("open-file", async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== "string") {
        throw new Error("A file path is required.");
      }

      if (!fs.existsSync(filePath)) {
        throw new Error("File does not exist.");
      }

      const result = await shell.openPath(filePath);

      if (result) {
        return { success: false, error: result };
      }

      return { success: true };
    } catch (error) {
      console.error("open-file failed:", error);

      return {
        success: false,
        error: error.message || String(error)
      };
    }
  });

  /*
   * LLAMA SERVER STATUS
   */
  ipcMain.handle("get-server-status", async () => {
    return llamaServer.getStatus();
  });

  ipcMain.handle("restart-llama-server", async () => {
    try {
      await llamaServer.restart();

      const status = await llamaServer.getStatus();

      return {
        success: status.running,
        status,
        error: status.running ? null : llamaServer.lastError
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  });

  /*
   * PERFORMANCE
   */
  ipcMain.handle("get-performance-metrics", () => {
    return resourceManager.getMetrics();
  });

  ipcMain.handle("optimize-memory", async () => {
    try {
      if (global.gc) {
        global.gc();
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  });

  /*
   * SYSTEM INFO
   */
  ipcMain.handle("get-system-info", async () => {
    try {
      const [system, osInfo, cpu, memory, graphics] = await Promise.all([
        si.system(),
        si.osInfo(),
        si.cpu(),
        si.mem(),
        si.graphics()
      ]);

      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        system,
        os: osInfo,
        cpu,
        memory,
        graphics,
        homeDir: os.homedir(),
        tempDir: os.tmpdir(),
        modelsDir: getModelsPath(),
        llamaExecutable: llamaServer.findExecutable(),
        llamaCapabilities: llamaServer.capabilities
      };
    } catch (error) {
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        modelsDir: getModelsPath(),
        llamaExecutable: llamaServer.findExecutable(),
        error: error.message
      };
    }
  });

  /*
   * MODELS FOLDER
   */
  ipcMain.handle("open-models-folder", async () => {
    try {
      const modelsPath = getModelsPath();

      fs.mkdirSync(modelsPath, { recursive: true });

      const result = await shell.openPath(modelsPath);

      if (result) {
        return { success: false, path: modelsPath, error: result };
      }

      return { success: true, path: modelsPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /*
   * CHAT HISTORY
   */
  ipcMain.handle("clear-chat-history", async () => {
    try {
      if (sessionManager && typeof sessionManager.clear === "function") {
        sessionManager.clear();
      }

      if (
        sessionManager &&
        typeof sessionManager.clearHistory === "function"
      ) {
        await sessionManager.clearHistory();
      }

      return { success: true };
    } catch (error) {
      console.error("clear-chat-history failed:", error);

      return { success: false, error: error.message };
    }
  });

  /*
   * QUIT
   */
  ipcMain.handle("quit-app", () => {
    isQuitting = true;
    app.quit();
    return true;
  });
}

/*
 * ============================================================================
 * IPC INITIALIZATION
 * ============================================================================
 */

function initializeIPC() {
  if (ipcInitialized) {
    console.log("IPC already initialized.");
    return true;
  }

  console.log("Initializing OffyAI IPC handlers...");

  /*
   * Remove handlers from a previous initialization if one exists.
   * This prevents Electron's "Attempted to register a second
   * handler..." error during application reinitialization.
   */
  const channels = [
    // Chat
    "chat:stream",
    "chat:stop",
    "chat:history",
    "chat:delete",
    "chat:session",
    "chat:clear",

    // Metrics
    "metrics:realtime",
    "ai:status",

    // Models
    "models:list",
    "models:upload",
    "models:addRemote",
    "models:get",

    // Application
    "minimize-window",
    "maximize-window",
    "close-window",
    "get-app-icon",
    "get-app-version",
    "get-settings",
    "save-settings",
    "get-local-models",
    "set-active-model",
    "delete-model",
    "upload-model",
    "get-models-path",
    "open-file",
    "open-models-folder",
    "get-performance-metrics",
    "optimize-memory",
    "get-system-info",
    "get-server-status",
    "restart-llama-server",
    "clear-chat-history",
    "quit-app"
  ];

  for (const channel of channels) {
    try {
      ipcMain.removeHandler(channel);
    } catch {
      // The handler may not have existed.
    }
  }

  /*
   * CHAT IPC — critical section. If this fails, initialization MUST
   * fail instead of silently continuing.
   */
  try {
    if (typeof registerChatHandlers !== "function") {
      throw new Error(
        "registerChatHandlers is not available from ./src/ipc/chatHandlers."
      );
    }

    registerChatHandlers({
      ipcMain,
      BrowserWindow,
      sessionManager,
      getAvailableModel: async () => {
        const models = await getAllLocalModels();
        return models[0] || null;
      },
      getActiveModel: async () => appSettings.activeModel,
      getModelPath: async (model) => {
        if (model && typeof model === "object" && model.path) {
          return model.path;
        }

        if (typeof model === "string") {
          const models = await getAllLocalModels();
          return models.find((item) => item.id === model)?.path || null;
        }

        return getActiveModelPath();
      }
    });

    console.log("Chat IPC handlers registered.");
  } catch (error) {
    ipcInitialized = false;

    console.error("CRITICAL: Chat IPC initialization failed:", error);

    throw error;
  }

  /*
   * METRICS IPC
   */
  try {
    if (typeof setupMetricsHandlers !== "function") {
      throw new Error(
        "setupMetricsHandlers is not available from ./src/ipc/metricsHandlers."
      );
    }

    setupMetricsHandlers();

    console.log("Metrics IPC handlers registered.");
  } catch (error) {
    console.error("Metrics IPC initialization failed:", error);
  }

  /*
   * MODEL IPC
   */
  try {
    if (typeof setupModelsHandlers !== "function") {
      throw new Error(
        "setupModelsHandlers is not available from ./src/ipc/modelsHandlers."
      );
    }

    setupModelsHandlers(mainWindow, appSettings, saveSettings);

    console.log("Model IPC handlers registered.");
  } catch (error) {
    console.error("Models IPC initialization failed:", error);
  }

  /*
   * APPLICATION IPC
   */
  try {
    setupApplicationIPC();

    console.log("Application IPC handlers registered.");
  } catch (error) {
    console.error("Application IPC initialization failed:", error);
  }

  /*
   * FINALIZE
   */
  ipcInitialized = true;

  console.log("Application IPC initialized successfully.");
  console.log("IPC channel verified during registration: chat:stream");

  return true;
}

/*
 * ============================================================================
 * APPLICATION STARTUP
 * ============================================================================
 */

async function startApplication() {
  console.log("======================================");
  console.log("Starting OffyAI");
  console.log(`Electron: ${process.versions.electron}`);
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`Development: ${isDev}`);
  console.log("======================================");

  // Start metrics independently.
  resourceManager.startMonitoring();

  // Splash first.
  createSplashWindow();

  // Main window immediately. The static frontend is used in both
  // development and production. No Next.js server is started.
  createMainWindow();

  // IPC once.
  initializeIPC();

  /*
   * LLAMA STARTUP
   *
   * This is deliberately asynchronous. Electron does NOT wait for
   * llama-server before displaying the frontend.
   */
  setImmediate(() => {
    void llamaServer
      .start()
      .then(() => {
        console.log("Llama startup routine completed.");
      })
      .catch((error) => {
        console.error("Llama startup failed:", error);
      });
  });

  console.log("OffyAI startup sequence initialized.");
}

/*
 * ============================================================================
 * ELECTRON EVENTS
 * ============================================================================
 */

app
  .whenReady()
  .then(startApplication)
  .catch((error) => {
    console.error("Fatal application startup error:", error);

    dialog.showErrorBox(
      "OffyAI Startup Error",
      error.stack || error.message || String(error)
    );

    app.quit();
  });

/*
 * ALL WINDOWS CLOSED
 */
app.on("window-all-closed", (event) => {
  // Keep the application alive.
  if (process.platform !== "darwin") {
    event.preventDefault();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  }
});

/*
 * MACOS ACTIVATION
 *
 * FIX: initializeIPC() can throw (e.g. if chat handler registration
 * fails); previously that exception was uncaught here. It's now
 * wrapped in try/catch. Also, `ipcInitialized` is reset before
 * reinitializing so that modules bound to a window reference at
 * registration time (setupModelsHandlers) get the freshly created
 * window instead of continuing to reference a destroyed one.
 */
app.on("activate", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  try {
    createSplashWindow();
    createMainWindow();

    ipcInitialized = false;
    initializeIPC();
  } catch (error) {
    console.error("Failed to reactivate application window:", error);
  }
});

/*
 * SHUTDOWN
 */
app.on("before-quit", () => {
  isQuitting = true;

  console.log("Preparing application shutdown...");

  try {
    llamaServer.stop();
  } catch (error) {
    console.warn("Llama shutdown warning:", error);
  }

  resourceManager.stopMonitoring();

  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }

  closeSplashWindow();
});

app.on("will-quit", () => {
  try {
    llamaServer.stop();
  } catch {
    // Ignore.
  }

  for (const child of serverProcesses) {
    try {
      if (child && !child.killed) {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
            windowsHide: true,
            stdio: "ignore"
          });
        } else {
          child.kill("SIGTERM");
        }
      }
    } catch {
      // Ignore.
    }
  }

  serverProcesses.clear();

  resourceManager.stopMonitoring();
});

/*
 * PROCESS ERRORS
 */
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

/*
 * SIGNALS
 */
function handleSignal(signal) {
  console.log(`Received ${signal}. Shutting down...`);

  if (isQuitting) {
    return;
  }

  isQuitting = true;

  try {
    llamaServer.stop();
  } catch {
    // Ignore.
  }

  resourceManager.stopMonitoring();

  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }

  app.quit();
}

process.on("SIGINT", () => {
  handleSignal("SIGINT");
});

process.on("SIGTERM", () => {
  handleSignal("SIGTERM");
});