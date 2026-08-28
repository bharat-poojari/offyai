"use strict";

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
let shutdownPromise = null;

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

function getAppRootPath() {
  return path.resolve(
    isDev ? __dirname : app.getAppPath()
  );
}

function toAppRelativePath(filePath) {
  if (
    typeof filePath !== "string" ||
    !filePath.trim()
  ) {
    return filePath;
  }

  const absolutePath = path.resolve(filePath);
  const appRoot = getAppRootPath();
  const relativePath = path.relative(appRoot, absolutePath);

  if (
    relativePath === "" ||
    (
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath)
    )
  ) {
    return relativePath || ".";
  }

  return filePath;
}

function resolveStoredAppPath(filePath) {
  if (
    typeof filePath !== "string" ||
    !filePath.trim()
  ) {
    return filePath;
  }

  const trimmed = filePath.trim();

  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }

  return path.resolve(
    getAppRootPath(),
    trimmed
  );
}

function normalizeStoredSettings(settings) {
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    return settings;
  }

  const normalized = { ...settings };

  if (
    normalized.activeModel &&
    typeof normalized.activeModel === "object" &&
    normalized.activeModel.type === "local" &&
    typeof normalized.activeModel.path === "string"
  ) {
    normalized.activeModel = {
      ...normalized.activeModel,
      path: toAppRelativePath(
        normalized.activeModel.path
      ),
    };
  }

  return normalized;
}

const settingsFile = isDev
  ? path.join(__dirname, "settings.json")
  : path.join(app.getPath("userData"), "settings.json");

function validateSettings(settings) {
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    throw new Error(
      "settings.json must contain a JSON object."
    );
  }

  if (
    typeof settings.serverUrl !==
      "string" ||
    !settings.serverUrl.trim()
  ) {
    throw new Error(
      "settings.json.serverUrl is required."
    );
  }

  /*
   * activeModel is allowed to be null.
   *
   * This is required when the user deletes the
   * final installed model.
   */
  if (
    settings.activeModel !== null &&
    typeof settings.activeModel !==
      "object"
  ) {
    throw new Error(
      "settings.json.activeModel must be an object or null."
    );
  }

  if (
    settings.activeModel !== null
  ) {
    if (
      typeof settings.activeModel.id !==
        "string" ||
      !settings.activeModel.id.trim()
    ) {
      throw new Error(
        "settings.json.activeModel.id is required."
      );
    }

    if (
      typeof settings.activeModel.type !==
        "string" ||
      !settings.activeModel.type.trim()
    ) {
      throw new Error(
        "settings.json.activeModel.type is required."
      );
    }

    /*
     * Local models require a path.
     *
     * Remote models do not.
     */
    if (
      settings.activeModel.type ===
      "local"
    ) {
      if (
        typeof settings.activeModel.path !==
          "string" ||
        !settings.activeModel.path.trim()
      ) {
        throw new Error(
          "settings.json.activeModel.path is required for local models."
        );
      }
    }
  }

  if (
    !settings.performance ||
    typeof settings.performance !==
      "object"
  ) {
    throw new Error(
      "settings.json.performance is required."
    );
  }

  if (
    !settings.chat ||
    typeof settings.chat !==
      "object"
  ) {
    throw new Error(
      "settings.json.chat is required."
    );
  }

  if (
    !settings.ui ||
    typeof settings.ui !==
      "object"
  ) {
    throw new Error(
      "settings.json.ui is required."
    );
  }

  if (
    !settings.security ||
    typeof settings.security !==
      "object"
  ) {
    throw new Error(
      "settings.json.security is required."
    );
  }

  if (
    !Array.isArray(
      settings.availableModels
    )
  ) {
    settings.availableModels =
      [];
  }

  if (
    !Array.isArray(
      settings.remoteModels
    )
  ) {
    settings.remoteModels =
      [];
  }

  /*
   * If there is no active model, there must not be
   * a stale model ID.
   */
  if (
    settings.activeModel === null
  ) {
    settings.model =
      "";
  }

  return settings;
}

function loadSettings() {
  if (!fs.existsSync(settingsFile)) {
    const templatePath = resolveAppPath("settings.json");

    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `settings.json template not found: ${templatePath}`
      );
    }

    const template = JSON.parse(
      fs.readFileSync(templatePath, "utf8")
    );

    return saveSettings(template);
  }

  const parsed = JSON.parse(
    fs.readFileSync(settingsFile, "utf8")
  );

  return validateSettings(
    normalizeStoredSettings(parsed)
  );
}

function saveSettings(settings) {
  const normalizedSettings = normalizeStoredSettings(settings);

  validateSettings(normalizedSettings);

  const directory = path.dirname(settingsFile);

  fs.mkdirSync(directory, {
    recursive: true
  });

  fs.writeFileSync(
    settingsFile,
    JSON.stringify(normalizedSettings, null, 2),
    "utf8"
  );

  return normalizedSettings;
}

let appSettings = loadSettings();

function getServerAddress() {
  const configuredUrl = new URL(
    appSettings.serverUrl
  );

  return {
    protocol: configuredUrl.protocol,
    host:
      configuredUrl.hostname === "localhost"
        ? "127.0.0.1"
        : configuredUrl.hostname,
    port:
      Number(configuredUrl.port) ||
      (configuredUrl.protocol === "https:" ? 443 : 80)
  };
}

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
      const [
        cpuLoad,
        memory,
        graphics
      ] = await Promise.all([
        si.currentLoad().catch(() => null),
        si.mem().catch(() => null),
        si.graphics().catch(() => ({
          controllers: []
        }))
      ]);

      if (
        cpuLoad &&
        Number.isFinite(
          Number(cpuLoad.currentLoad)
        )
      ) {
        this.systemMetrics.cpu =
          Number(
            Number(
              cpuLoad.currentLoad
            ).toFixed(1)
          );
      }

      if (
        memory &&
        Number.isFinite(memory.total) &&
        memory.total > 0
      ) {
        const used =
          memory.total -
          memory.available;

        this.systemMetrics.memory =
          Number(
            (
              (used / memory.total) *
              100
            ).toFixed(1)
          );
      }

      const gpu =
        graphics?.controllers?.[0];

      if (gpu) {
        this.systemMetrics.gpuAvailable =
          true;

        const usage =
          Number(gpu.utilizationGpu);

        const temperature =
          Number(gpu.temperatureGpu);

        this.systemMetrics.gpu =
          Number.isFinite(usage)
            ? Number(usage.toFixed(1))
            : 0;

        this.systemMetrics.gpuTemperature =
          Number.isFinite(temperature)
            ? Number(temperature.toFixed(1))
            : 0;
      } else {
        this.systemMetrics.gpuAvailable =
          false;
        this.systemMetrics.gpu = 0;
        this.systemMetrics.gpuTemperature = 0;
      }

      try {
        const temperature =
          await si.cpuTemperature();

        const mainTemperature =
          Number(temperature?.main);

        this.systemMetrics.temperature =
          Number.isFinite(
            mainTemperature
          )
            ? Number(
                mainTemperature.toFixed(1)
              )
            : 0;
      } catch {
        this.systemMetrics.temperature = 0;
      }

      this.performanceMetrics.push({
        timestamp: Date.now(),
        ...this.systemMetrics
      });

      if (
        this.performanceMetrics.length >
        100
      ) {
        this.performanceMetrics.shift();
      }
    } catch (error) {
      console.error(
        "System metrics error:",
        error
      );
    } finally {
      this.metricsRequestRunning =
        false;
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
      system: {
        ...this.systemMetrics
      },
      history: [
        ...this.performanceMetrics
      ],
      timestamp: Date.now()
    };
  }
}

const resourceManager =
  new ResourceManager();

class ModelManager {
  constructor() {
    this.supportedFormats = [
      ".gguf",
      ".bin",
      ".ggml"
    ];
  }

  scanForModels(modelsPath) {
    try {
      fs.mkdirSync(modelsPath, {
        recursive: true
      });

      const items =
        fs.readdirSync(
          modelsPath,
          {
            withFileTypes: true
          }
        );

      const models = [];

      for (const item of items) {
        if (!item.isFile()) {
          continue;
        }

        const extension =
          path.extname(
            item.name
          ).toLowerCase();

        if (
          !this.supportedFormats.includes(
            extension
          )
        ) {
          continue;
        }

        const fullPath =
          path.join(
            modelsPath,
            item.name
          );

        let stats;

        try {
          stats =
            fs.statSync(fullPath);
        } catch {
          continue;
        }

        models.push({
          id: path.basename(
            item.name,
            extension
          ),
          fileName: item.name,
          path: fullPath,
          type: "local",
          name: path.basename(
            item.name,
            extension
          ),
          size: `${(
            stats.size /
            1024 /
            1024
          ).toFixed(2)} MB`,
          sizeBytes: stats.size,
          format:
            extension.slice(1),
          created:
            stats.birthtime.toISOString(),
          modified:
            stats.mtime.toISOString(),
          isDirectory: false
        });
      }

      models.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      return models;
    } catch (error) {
      console.error(
        "Model scan error:",
        error
      );

      return [];
    }
  }
}

const modelManager =
  new ModelManager();

function getModelsPath() {
  const candidates = isDev
    ? [
        path.join(
          __dirname,
          "models"
        ),
        path.join(
          process.cwd(),
          "models"
        )
      ]
    : [
        path.join(
          process.resourcesPath,
          "models"
        ),
        path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "models"
        ),
        path.join(
          app.getPath("userData"),
          "models"
        )
      ];

  for (const candidate of candidates) {
    try {
      if (
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isDirectory()
      ) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  const fallback =
    candidates[0];

  fs.mkdirSync(fallback, {
    recursive: true
  });

  return fallback;
}

let lastLoggedModelPath = null;

function getActiveModelPath() {
  try {
    const configured =
      appSettings.activeModel;

    const fallbackModelId =
      typeof appSettings.model === "string"
        ? appSettings.model.trim()
        : "";

    if (
      configured?.type === "local" &&
      configured?.path
    ) {
      const configuredPath = resolveStoredAppPath(
        configured.path
      );

      if (
        fs.existsSync(
          configuredPath
        )
      ) {
        if (
          lastLoggedModelPath !==
          configuredPath
        ) {
          console.log(
            "Using active model:",
            configuredPath
          );

          lastLoggedModelPath =
            configuredPath;
        }

        return configuredPath;
      }

      console.error(
        "Configured active model does not exist:",
        configuredPath
      );

      if (fallbackModelId) {
        const fallbackMatch =
          getAllLocalModels().find(
            (item) =>
              item.id === fallbackModelId ||
              item.fileName === fallbackModelId
          );

        if (fallbackMatch) {
          const fallbackPath = resolveStoredAppPath(
            fallbackMatch.path
          );

          if (fs.existsSync(fallbackPath)) {
            return fallbackPath;
          }
        }
      }

      return null;
    }

    if (fallbackModelId) {
      const fallbackMatch =
        getAllLocalModels().find(
          (item) =>
            item.id === fallbackModelId ||
            item.fileName === fallbackModelId
        );

      if (fallbackMatch) {
        const fallbackPath = resolveStoredAppPath(
          fallbackMatch.path
        );

        if (fs.existsSync(fallbackPath)) {
          return fallbackPath;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(
      "Unable to determine model:",
      error
    );

    return null;
  }
}

function getAllLocalModels() {
  return modelManager.scanForModels(
    getModelsPath()
  );
}

async function resolveActiveModel(activeModel) {
  if (
    !activeModel ||
    typeof activeModel !== "object"
  ) {
    return activeModel;
  }

  if (
    activeModel.type !== "local"
  ) {
    return activeModel;
  }

  const localModels =
    await getAllLocalModels();

  const found =
    localModels.find(
      (item) =>
        item.id === activeModel.id ||
        item.fileName === activeModel.fileName
    );

  if (!found) {
    throw new Error(
      `Local model "${activeModel.id || activeModel.fileName}" was not found.`
    );
  }

  return {
    ...found,
    ...activeModel,
    path: toAppRelativePath(found.path)
  };
}

function createSplashWindow() {
  if (
    splashWindow &&
    !splashWindow.isDestroyed()
  ) {
    return splashWindow;
  }

  splashWindow =
    new BrowserWindow({
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

  splashWindow.setMenuBarVisibility(
    false
  );

  splashWindow.on(
    "closed",
    () => {
      splashWindow = null;
    }
  );

  const splashPath =
    resolveAppPath(
      "splash.html"
    );

  if (fs.existsSync(splashPath)) {
    void splashWindow
      .loadFile(splashPath)
      .catch((error) => {
        console.error(
          "Failed to load splash:",
          error
        );
      });

    return splashWindow;
  }

  const fallbackHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OffyAI</title>
<style>
*{box-sizing:border-box}
html,body{width:100%;height:100%;margin:0}
body{
display:flex;
align-items:center;
justify-content:center;
background:linear-gradient(135deg,#0ea5e9,#7e22ce);
color:#fff;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
}
.container{
display:flex;
flex-direction:column;
align-items:center
}
.logo{
font-size:48px;
font-weight:700;
margin-bottom:28px
}
.spinner{
width:42px;
height:42px;
border:4px solid rgba(255,255,255,.25);
border-top-color:#fff;
border-radius:50%;
animation:spin .85s linear infinite
}
.status{
margin-top:22px;
font-size:15px
}
@keyframes spin{
from{transform:rotate(0)}
to{transform:rotate(360deg)}
}
</style>
</head>
<body>
<main class="container">
<div class="logo">OffyAI</div>
<div class="spinner"></div>
<div class="status">Starting OffyAI...</div>
</main>
</body>
</html>
`;

  const dataUrl =
    `data:text/html;charset=utf-8,${encodeURIComponent(
      fallbackHTML
    )}`;

  void splashWindow
    .loadURL(dataUrl)
    .catch((error) => {
      console.error(
        "Failed to load fallback splash:",
        error
      );
    });

  return splashWindow;
}

function getFrontendCandidates() {
  return [
    resolveAppPath(
      "frontend",
      "out",
      "index.html"
    )
  ];
}

function findFrontend() {
  for (const candidate of getFrontendCandidates()) {
    try {
      if (
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );
}

function sanitizeErrorDetails(details) {
  let value =
    String(details ?? "");

  value = value.replace(
    /data:text\/html[^\s\n]*/gi,
    "[embedded HTML error page omitted]"
  );

  value = value.replace(
    /(?:%25){2,}[A-Za-z0-9%._~:/?#\[\]@!$&'()*+,;=-]*/gi,
    "[repeatedly encoded data omitted]"
  );

  if (value.length > 12000) {
    value =
      `${value.slice(0, 12000)}\n[details truncated]`;
  }

  return value;
}

function createFrontendErrorHTML(
  title,
  details
) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OffyAI - Startup Error</title>
<style>
*{box-sizing:border-box}
html,body{
margin:0;
width:100%;
height:100%
}
body{
background:#111827;
color:#f9fafb;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
display:flex;
align-items:center;
justify-content:center;
padding:32px
}
.container{
width:min(760px,100%)
}
h1{
margin:0 0 16px;
font-size:28px
}
p{
color:#d1d5db;
line-height:1.6
}
pre{
margin-top:20px;
padding:16px;
background:#030712;
border-radius:8px;
overflow:auto;
color:#fca5a5;
white-space:pre-wrap;
word-break:break-word
}
button{
margin-top:20px;
border:0;
border-radius:8px;
padding:10px 18px;
background:#3b82f6;
color:#fff;
cursor:pointer
}
</style>
</head>
<body>
<main class="container">
<h1>${escapeHtml(title)}</h1>
<p>OffyAI could not load its main interface.</p>
<pre>${escapeHtml(
  sanitizeErrorDetails(details)
)}</pre>
<button id="retry">Retry</button>
</main>
<script>
document.getElementById("retry")
.addEventListener("click",()=>location.reload());
</script>
</body>
</html>
`;
}

function loadRawHtml(
  window,
  html
) {
  if (
    !window ||
    window.isDestroyed()
  ) {
    return Promise.reject(
      new Error(
        "Window is unavailable."
      )
    );
  }

  const dataUrl =
    `data:text/html;charset=utf-8,${encodeURIComponent(
      html
    )}`;

  return window.loadURL(
    dataUrl
  );
}

function closeSplashWindow() {
  if (
    !splashWindow ||
    splashWindow.isDestroyed()
  ) {
    splashWindow = null;
    return;
  }

  try {
    splashWindow.close();
  } catch (error) {
    console.warn(
      "Unable to close splash:",
      error
    );
  }

  splashWindow = null;
}

function showMainWindow() {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindowShown
  ) {
    return;
  }

  mainWindowShown = true;

  if (startupTimeout) {
    clearTimeout(
      startupTimeout
    );
    startupTimeout = null;
  }

  closeSplashWindow();

  mainWindow.show();

  try {
    mainWindow.focus();
  } catch {}
}

function showFrontendError(
  title,
  details
) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    frontendErrorShowing
  ) {
    return;
  }

  frontendErrorShowing = true;

  const html =
    createFrontendErrorHTML(
      title,
      details
    );

  void loadRawHtml(
    mainWindow,
    html
  )
    .catch((error) => {
      console.error(
        "Failed to load error page:",
        error
      );
    })
    .finally(() => {
      showMainWindow();
    });
}

function createMainWindow() {
  if (
    mainWindow &&
    !mainWindow.isDestroyed()
  ) {
    return mainWindow;
  }

  const iconPath =
    resolveAppPath(
      "offyai.png"
    );

  let appIcon = null;

  try {
    if (fs.existsSync(iconPath)) {
      appIcon =
        nativeImage.createFromPath(
          iconPath
        );
    }
  } catch (error) {
    console.warn(
      "Unable to load application icon:",
      error
    );
  }

  mainWindowShown = false;
  frontendErrorShowing = false;
  frontendLoadStarted = false;
  frontendLoadCompleted = false;

  mainWindow =
    new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      frame: false,
      show: false,
      backgroundColor: "#111827",
      icon:
        appIcon || undefined,
      titleBarStyle: "hidden",
      autoHideMenuBar: true,
      webPreferences: {
        preload:
          resolveAppPath(
            "preload.js"
          ),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: true,
        sandbox: false,
        devTools: isDev
      }
    });

  mainWindow.setMenuBarVisibility(
    false
  );

  mainWindow.webContents.on(
    "console-message",
    (
      event,
      level,
      message,
      line,
      sourceId
    ) => {
      if (isDev) {
        console.log(
          `[Renderer:${level}] ${message} (${sourceId}:${line})`
        );
      }
    }
  );

  mainWindow.webContents.on(
    "did-fail-load",
    (
      event,
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    ) => {
      if (!isMainFrame) {
        return;
      }

      if (
        errorCode === -3 ||
        errorDescription ===
          "ERR_ABORTED"
      ) {
        return;
      }

      if (
        frontendErrorShowing ||
        /^data:text\/html/i.test(
          validatedURL || ""
        )
      ) {
        return;
      }

      showFrontendError(
        "Unable to load OffyAI",
        [
          `Error code: ${errorCode}`,
          `Description: ${errorDescription}`,
          `URL: ${sanitizeErrorDetails(
            validatedURL
          )}`
        ].join("\n")
      );
    }
  );

  mainWindow.webContents.on(
    "did-finish-load",
    () => {
      frontendLoadCompleted = true;

      if (!frontendErrorShowing) {
        showMainWindow();
      }
    }
  );

  mainWindow.once(
    "ready-to-show",
    () => {
      if (!frontendErrorShowing) {
        showMainWindow();
      }
    }
  );

  mainWindow.webContents.on(
    "render-process-gone",
    (
      event,
      details
    ) => {
      console.error(
        "Renderer process terminated:",
        details
      );

      if (
        !mainWindowShown &&
        !frontendErrorShowing
      ) {
        showFrontendError(
          "OffyAI renderer stopped",
          JSON.stringify(
            details,
            null,
            2
          )
        );
      }
    }
  );

  mainWindow.on(
    "closed",
    () => {
      mainWindow = null;
      mainWindowShown = false;
      frontendLoadStarted = false;
      frontendLoadCompleted = false;
    }
  );

  mainWindow.on(
    "close",
    (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    }
  );

  frontendLoadStarted = true;

  void loadFrontend(
    mainWindow
  );

  startupTimeout =
    setTimeout(() => {
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

      showFrontendError(
        "OffyAI startup timeout",
        [
          "The frontend did not finish loading.",
          "",
          "Static frontend:",
          String(
            findFrontend() ||
              resolveAppPath(
                "frontend",
                "out",
                "index.html"
              )
          )
        ].join("\n")
      );
    }, 45000);

  return mainWindow;
}

async function loadFrontend(
  window
) {
  if (
    !window ||
    window.isDestroyed()
  ) {
    return;
  }

  const frontendPath =
    findFrontend();

  if (!frontendPath) {
    showFrontendError(
      "Frontend build not found",
      [
        "The static frontend could not be found.",
        "",
        "Build it with:",
        "cd frontend",
        "npm install",
        "npm run build",
        "",
        `Expected: ${resolveAppPath(
          "frontend",
          "out",
          "index.html"
        )}`
      ].join("\n")
    );

    return;
  }

  try {
    frontendErrorShowing = false;
    await window.loadFile(
      frontendPath
    );
  } catch (error) {
    showFrontendError(
      "Frontend failed to load",
      [
        `File: ${frontendPath}`,
        "",
        error.stack ||
          error.message ||
          String(error)
      ].join("\n")
    );
  }
}

class LlamaServerManager {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.starting = false;
    this.port = null;
    this.host = null;
    this.capabilities = null;
    this.lastError = null;

    this.refreshAddress();
  }

  refreshAddress() {
    const address =
      getServerAddress();

    this.host =
      address.host;

    this.port =
      address.port;
  }

  findExecutable() {
    const executableName =
      process.platform === "win32"
        ? "llama-server.exe"
        : "llama-server";

    const candidates = [
      resolveAppPath(
        "llama",
        executableName
      ),
      path.join(
        process.resourcesPath,
        "llama",
        executableName
      )
    ];

    for (const candidate of candidates) {
      try {
        if (
          fs.existsSync(candidate) &&
          fs.statSync(candidate).isFile()
        ) {
          return candidate;
        }
      } catch {}
    }

    return null;
  }

  getExecutableHelp(
    executable
  ) {
    if (!executable) {
      return "";
    }

    try {
      const output =
        execFileSync(
          executable,
          ["--help"],
          {
            encoding: "utf8",
            timeout: 10000,
            windowsHide: true,
            maxBuffer:
              4 * 1024 * 1024
          }
        );

      return String(
        output || ""
      );
    } catch (error) {
      return String(
        error?.stdout ||
          error?.stderr ||
          ""
      );
    }
  }

  detectCapabilities(
    executable
  ) {
    if (
      this.capabilities &&
      this.capabilities.executable ===
        executable
    ) {
      return this.capabilities;
    }

    const help =
      this.getExecutableHelp(
        executable
      );

    const normalized =
      help.toLowerCase();

    this.capabilities = {
      executable,
      help,
      host:
        normalized.includes(
          "--host"
        ),
      port:
        normalized.includes(
          "--port"
        ),
      threads:
        normalized.includes(
          "--threads"
        ),
      contextSize:
        normalized.includes(
          "--ctx-size"
        ),
      batchSize:
        normalized.includes(
          "--batch-size"
        ),
      gpuLayers:
        normalized.includes(
          "--n-gpu-layers"
        ) ||
        normalized.includes(
          "--gpu-layers"
        ),
      loadMode:
        normalized.includes(
          "--load-mode"
        ),
      mmap:
        normalized.includes(
          "--mmap"
        ),
      noMmap:
        normalized.includes(
          "--no-mmap"
        ),
      mlock:
        normalized.includes(
          "--mlock"
        ),
      lowVram:
        normalized.includes(
          "--low-vram"
        ),
      temperature:
        normalized.includes(
          "--temp"
        ) ||
        normalized.includes(
          "--temperature"
        ),
      topP:
        normalized.includes(
          "--top-p"
        ),
      topK:
        normalized.includes(
          "--top-k"
        ),
      maxTokens:
        normalized.includes(
          "--n-predict"
        ),
      verbose:
        normalized.includes(
          "--verbose"
        )
    };

    return this.capabilities;
  }

  isPortInUse(
    port
  ) {
    return new Promise(
      (resolve) => {
        const server =
          net.createServer();

        let finished = false;

        const finish =
          (value) => {
            if (finished) {
              return;
            }

            finished = true;
            resolve(value);
          };

        server.once(
          "error",
          (error) => {
            finish(
              error.code ===
                "EADDRINUSE"
            );
          }
        );

        server.once(
          "listening",
          () => {
            server.close(() => {
              finish(false);
            });
          }
        );

        server.listen(
          port,
          this.host
        );
      }
    );
  }

  waitForPort(
    port,
    timeout = 60000
  ) {
    return new Promise(
      (resolve, reject) => {
        const started =
          Date.now();

        let stopped = false;

        const attempt = () => {
          if (stopped) {
            return;
          }

          if (
            Date.now() -
              started >=
            timeout
          ) {
            stopped = true;

            reject(
              new Error(
                `Timeout waiting for llama-server on ${this.host}:${port}`
              )
            );

            return;
          }

          const socket =
            net.createConnection({
              host: this.host,
              port
            });

          let done = false;

          const finish =
            (success) => {
              if (done) {
                return;
              }

              done = true;

              try {
                socket.destroy();
              } catch {}

              if (success) {
                stopped = true;
                resolve();
                return;
              }

              setTimeout(
                attempt,
                500
              );
            };

          socket.setTimeout(
            1000,
            () => finish(false)
          );

          socket.once(
            "connect",
            () => finish(true)
          );

          socket.once(
            "error",
            () => finish(false)
          );
        };

        attempt();
      }
    );
  }

  buildArguments(
    executable,
    modelPath
  ) {
    this.refreshAddress();

    const performance =
      appSettings.performance ||
      {};

    const chat =
      appSettings.chat ||
      {};

    const capabilities =
      this.detectCapabilities(
        executable
      );

    const cpuCount =
      os.cpus()?.length ||
      2;

    const threads =
      Math.max(
        1,
        Number(
          performance.cpuThreads
        )
      );

    const contextSize =
      Math.max(
        512,
        Number(
          performance.contextSize
        )
      );

    const batchSize =
      Math.max(
        1,
        Number(
          performance.batchSize
        )
      );

    const gpuLayers =
      Math.max(
        0,
        Number(
          performance.gpuLayers
        )
      );

    const maxTokens =
      Math.max(
        1,
        Number(
          chat.maxTokens
        )
      );

    const temperature =
      Number(
        chat.temperature
      );

    const topP =
      Number(chat.topP);

    const topK =
      Number(chat.topK);

    const args = [
      "--model",
      modelPath
    ];

    if (capabilities.host) {
      args.push(
        "--host",
        this.host
      );
    }

    if (capabilities.port) {
      args.push(
        "--port",
        String(this.port)
      );
    }

    if (capabilities.threads) {
      args.push(
        "--threads",
        String(threads)
      );
    }

    if (capabilities.contextSize) {
      args.push(
        "--ctx-size",
        String(contextSize)
      );
    }

    if (capabilities.batchSize) {
      args.push(
        "--batch-size",
        String(batchSize)
      );
    }

    if (capabilities.gpuLayers) {
      args.push(
        "--n-gpu-layers",
        String(gpuLayers)
      );
    }

    if (
      capabilities.temperature &&
      Number.isFinite(
        temperature
      )
    ) {
      args.push(
        "--temp",
        String(temperature)
      );
    }

    if (
      capabilities.topP &&
      Number.isFinite(topP)
    ) {
      args.push(
        "--top-p",
        String(topP)
      );
    }

    if (
      capabilities.topK &&
      Number.isFinite(topK)
    ) {
      args.push(
        "--top-k",
        String(topK)
      );
    }

    if (
      capabilities.maxTokens
    ) {
      args.push(
        "--n-predict",
        String(maxTokens)
      );
    }

    const requestedMmap =
      performance.mmap !== false;

    if (capabilities.loadMode) {
      args.push(
        "--load-mode",
        requestedMmap
          ? "mmap"
          : "none"
      );
    } else if (
      requestedMmap &&
      capabilities.mmap
    ) {
      args.push("--mmap");
    } else if (
      !requestedMmap &&
      capabilities.noMmap
    ) {
      args.push(
        "--no-mmap"
      );
    }

    if (
      performance.mlock === true &&
      capabilities.mlock
    ) {
      args.push("--mlock");
    }

    return {
      args,
      capabilities,
      threads,
      contextSize,
      batchSize,
      gpuLayers,
      maxTokens,
      temperature,
      topP,
      topK
    };
  }

  async start() {
    if (
      this.process &&
      !this.process.killed
    ) {
      return this.process;
    }

    if (this.starting) {
      return null;
    }

    this.starting = true;
    this.lastError = null;

    try {
      this.refreshAddress();

      const modelPath =
        getActiveModelPath();

      if (!modelPath) {
        throw new Error(
          "No valid active model configured in settings.json."
        );
      }

      if (
        !fs.existsSync(
          modelPath
        )
      ) {
        throw new Error(
          `Configured model does not exist: ${modelPath}`
        );
      }

      if (
        await this.isPortInUse(
          this.port
        )
      ) {
        console.log(
          `llama-server already running on ${this.host}:${this.port}.`
        );

        this.isRunning = true;
        return null;
      }

      const executable =
        this.findExecutable();

      if (!executable) {
        throw new Error(
          `llama-server executable was not found: ${resolveAppPath(
            "llama",
            process.platform ===
              "win32"
              ? "llama-server.exe"
              : "llama-server"
          )}`
        );
      }

      const launch =
        this.buildArguments(
          executable,
          modelPath
        );

      const {
        args,
        threads
      } = launch;

      console.log(
        "Starting llama-server:",
        executable
      );

      console.log(
        "Llama arguments:",
        args
      );

      const environment = {
        ...process.env,
        GGML_NUM_THREADS:
          String(threads),
        NODE_ENV:
          isDev
            ? "development"
            : "production"
      };

      this.process =
        spawn(
          executable,
          args,
          {
            cwd:
              path.dirname(
                executable
              ),
            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ],
            windowsHide: true,
            detached: false,
            env: environment
          }
        );

      serverProcesses.add(
        this.process
      );

      const child =
        this.process;

      child.stdout.on(
        "data",
        (data) => {
          const message =
            data
              .toString()
              .trim();

          if (!message) {
            return;
          }

          console.log(
            `[Llama] ${message}`
          );

          if (
            /server listening|http server listening|listening on|starting server/i.test(
              message
            )
          ) {
            this.isRunning = true;
          }
        }
      );

      child.stderr.on(
        "data",
        (data) => {
          const message =
            data
              .toString()
              .trim();

          if (!message) {
            return;
          }

          if (
            /error:|fatal:|failed|invalid argument|cannot|unable/i.test(
              message
            )
          ) {
            console.error(
              `[Llama:stderr] ${message}`
            );
          } else if (isDev) {
            console.log(
              `[Llama:stderr] ${message}`
            );
          }
        }
      );

      child.once(
        "error",
        (error) => {
          console.error(
            "llama-server process error:",
            error
          );

          this.lastError =
            error.message;

          this.isRunning = false;

          serverProcesses.delete(
            child
          );

          if (
            this.process ===
            child
          ) {
            this.process = null;
          }
        }
      );

      child.once(
        "exit",
        (
          code,
          signal
        ) => {
          console.log(
            `llama-server exited. code=${code}, signal=${signal}`
          );

          if (
            code !== 0 &&
            !isQuitting
          ) {
            this.lastError =
              `llama-server exited with code ${code}${
                signal
                  ? `, signal ${signal}`
                  : ""
              }`;
          }

          this.isRunning =
            false;

          serverProcesses.delete(
            child
          );

          if (
            this.process ===
            child
          ) {
            this.process = null;
          }
        }
      );

      try {
        await this.waitForPort(
          this.port,
          60000
        );

        this.isRunning = true;

        console.log(
          `llama-server is ready on ${this.host}:${this.port}.`
        );
      } catch (error) {
        console.warn(
          "llama-server did not become ready:",
          error.message
        );
      }

      return child;
    } catch (error) {
      console.error(
        "Failed to start llama-server:",
        error
      );

      this.lastError =
        error.message ||
        String(error);

      this.process = null;
      this.isRunning = false;

      return null;
    } finally {
      this.starting = false;
    }
  }

  async getStatus() {
    this.refreshAddress();

    let running =
      this.isRunning;

    if (!running) {
      try {
        running =
          await this.isPortInUse(
            this.port
          );
      } catch {
        running = false;
      }
    }

    return {
      backend: false,
      backendUrl: null,
      running,
      llama: running,
      host: this.host,
      url: appSettings.serverUrl,
      llamaUrl:
        appSettings.serverUrl,
      port: this.port,
      model:
        getActiveModelPath(),
      executable:
        this.findExecutable(),
      pid:
        this.process?.pid ||
        null,
      error:
        this.lastError,
      capabilities:
        this.capabilities
          ? {
              loadMode:
                this.capabilities
                  .loadMode,
              mmap:
                this.capabilities
                  .mmap,
              noMmap:
                this.capabilities
                  .noMmap,
              gpuLayers:
                this.capabilities
                  .gpuLayers
            }
          : null,
      timestamp: Date.now()
    };
  }

  async restart() {
    await this.stop();

    this.refreshAddress();

    const deadline =
      Date.now() + 10000;

    while (
      Date.now() <
      deadline
    ) {
      let inUse = false;

      try {
        inUse =
          await this.isPortInUse(
            this.port
          );
      } catch {
        inUse = false;
      }

      if (!inUse) {
        break;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            250
          )
      );
    }

    return this.start();
  }

  stop() {
    const child =
      this.process;

    this.process = null;
    this.isRunning = false;

    if (!child) {
      return Promise.resolve();
    }

    serverProcesses.delete(
      child
    );

    return new Promise(
      (resolve) => {
        let settled = false;

        const finish = () => {
          if (settled) {
            return;
          }

          settled = true;
          resolve();
        };

        child.once(
          "exit",
          finish
        );

        try {
          if (
            process.platform ===
            "win32"
          ) {
            const killer =
              spawn(
                "taskkill",
                [
                  "/pid",
                  String(
                    child.pid
                  ),
                  "/t",
                  "/f"
                ],
                {
                  windowsHide:
                    true,
                  stdio:
                    "ignore"
                }
              );

            killer.on(
              "error",
              () => {
                try {
                  child.kill();
                } catch {}
              }
            );
          } else {
            child.kill(
              "SIGTERM"
            );
          }
        } catch {}

        setTimeout(
          () => {
            if (!settled) {
              try {
                child.kill(
                  "SIGKILL"
                );
              } catch {}

              finish();
            }
          },
          5000
        );
      }
    );
  }
}

const llamaServer =
  new LlamaServerManager();

async function updateSettingsAndRestart(
  newSettings
) {
  if (
    !newSettings ||
    typeof newSettings !==
      "object"
  ) {
    throw new Error(
      "Invalid settings."
    );
  }

  const oldSettings =
    JSON.parse(
      JSON.stringify(
        appSettings
      )
    );

  try {
    const resolvedSettings = {
      ...newSettings,
      activeModel:
        await resolveActiveModel(
          newSettings.activeModel
        )
    };

    saveSettings(
      resolvedSettings
    );

    appSettings =
      loadSettings();

    llamaServer.refreshAddress();

    const oldPerformance =
      oldSettings.performance ||
      {};

    const newPerformance =
      appSettings.performance ||
      {};

    const oldChat =
      oldSettings.chat || {};

    const newChat =
      appSettings.chat || {};

    const modelChanged =
      oldSettings.activeModel?.id !==
      appSettings.activeModel?.id ||
      oldSettings.activeModel?.path !==
      appSettings.activeModel?.path;

    const serverChanged =
      oldSettings.serverUrl !==
      appSettings.serverUrl;

    const performanceChanged =
      oldPerformance.cpuThreads !==
        newPerformance.cpuThreads ||
      oldPerformance.gpuLayers !==
        newPerformance.gpuLayers ||
      oldPerformance.contextSize !==
        newPerformance.contextSize ||
      oldPerformance.batchSize !==
        newPerformance.batchSize ||
      oldPerformance.mmap !==
        newPerformance.mmap ||
      oldPerformance.mlock !==
        newPerformance.mlock;

    const chatChanged =
      oldChat.maxTokens !==
        newChat.maxTokens ||
      oldChat.temperature !==
        newChat.temperature ||
      oldChat.topP !==
        newChat.topP ||
      oldChat.topK !==
        newChat.topK ||
      oldChat.contextWindow !==
        newChat.contextWindow;

    if (
      modelChanged ||
      serverChanged ||
      performanceChanged ||
      chatChanged
    ) {
      await llamaServer.restart();
    }

    return appSettings;
  } catch (error) {
    try {
      saveSettings(
        oldSettings
      );

      appSettings =
        oldSettings;

      llamaServer.refreshAddress();
    } catch {}

    throw error;
  }
}

function shutdownApplication() {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  isQuitting = true;

  shutdownPromise = (async () => {
    try {
      await llamaServer.stop();
    } catch (error) {
      console.warn(
        "Llama shutdown warning:",
        error
      );
    }

    resourceManager.stopMonitoring();

    if (startupTimeout) {
      clearTimeout(
        startupTimeout
      );

      startupTimeout = null;
    }

    closeSplashWindow();
    app.quit();
  })();

  return shutdownPromise;
}

function setupApplicationIPC() {
  ipcMain.handle(
    "minimize-window",
    () => {
      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.minimize();
      }

      return true;
    }
  );

  ipcMain.handle(
    "maximize-window",
    () => {
      if (
        !mainWindow ||
        mainWindow.isDestroyed()
      ) {
        return false;
      }

      if (
        mainWindow.isMaximized()
      ) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }

      return true;
    }
  );

  ipcMain.handle(
    "close-window",
    async () => {
      await shutdownApplication();
      return true;
    }
  );

  ipcMain.handle(
    "get-app-icon",
    () => {
      try {
        const iconPaths = [
          resolveAppPath(
            "frontend",
            "public",
            "images",
            "offyai.png"
          ),
          resolveAppPath(
            "frontend",
            "out",
            "images",
            "offyai.png"
          )
        ];

        const iconPath =
          iconPaths.find((candidate) =>
            fs.existsSync(candidate)
          );

        return iconPath
          ? nativeImage
              .createFromPath(iconPath)
              .toDataURL()
          : null;
      } catch {
        return null;
      }
    }
  );

  ipcMain.handle(
    "get-app-version",
    () => {
      return app.getVersion();
    }
  );

  ipcMain.handle(
    "get-settings",
    () => {
      appSettings =
        loadSettings();

      llamaServer.refreshAddress();

      return appSettings;
    }
  );

  ipcMain.handle(
    "save-settings",
    async (
      event,
      newSettings
    ) => {
      return updateSettingsAndRestart(
        newSettings
      );
    }
  );

  ipcMain.handle(
    "get-local-models",
    async () => {
      return getAllLocalModels();
    }
  );

  ipcMain.handle(
    "get-models-path",
    async () => {
      return getModelsPath();
    }
  );

  ipcMain.handle(
    "set-active-model",
    async (
      event,
      model
    ) => {
      try {
        if (
          !model ||
          typeof model !==
            "object"
        ) {
          throw new Error(
            "Invalid model."
          );
        }

        const resolvedModel =
          await resolveActiveModel(
            model
          );

        if (
          resolvedModel.type ===
            "local" &&
          resolvedModel.path &&
          !fs.existsSync(
            resolvedModel.path
          )
        ) {
          throw new Error(
            "Selected model file does not exist."
          );
        }

        const nextSettings =
          {
            ...appSettings,
            model:
              resolvedModel.id,
            activeModel:
              resolvedModel
          };

        await updateSettingsAndRestart(
          nextSettings
        );

        return {
          success: true,
          model:
            resolvedModel
        };
      } catch (error) {
        console.error(
          "set-active-model failed:",
          error
        );

        return {
          success: false,
          error:
            error.message ||
            "Failed to activate model."
        };
      }
    }
  );

  ipcMain.handle(
    "delete-model",
    async (
      event,
      modelId,
      modelType
    ) => {
      try {
        if (!modelId) {
          throw new Error(
            "Model ID is required."
          );
        }

        if (
          modelType ===
          "local"
        ) {
          const modelsPath =
            getModelsPath();

          let deleted = false;

          for (const extension of [
            ".gguf",
            ".bin",
            ".ggml"
          ]) {
            const modelFile =
              path.join(
                modelsPath,
                modelId +
                  extension
              );

            if (
              fs.existsSync(
                modelFile
              )
            ) {
              const activePath =
                getActiveModelPath();

              if (
                activePath &&
                path.resolve(
                  activePath
                ) ===
                  path.resolve(
                    modelFile
                  )
              ) {
                await llamaServer.stop();
              }

              fs.unlinkSync(
                modelFile
              );

              deleted = true;
              break;
            }
          }

          if (!deleted) {
            throw new Error(
              "Local model file was not found."
            );
          }

          if (
            appSettings
              .activeModel
              ?.id === modelId
          ) {
            const nextSettings =
              {
                ...appSettings,
                model: "",
                activeModel:
                  null
              };

            saveSettings(
              nextSettings
            );

            appSettings =
              loadSettings();
          }
        } else {
          const nextSettings =
            {
              ...appSettings,
              remoteModels: (
                appSettings.remoteModels ||
                []
              ).filter(
                (model) =>
                  model.id !==
                  modelId
              )
            };

          saveSettings(
            nextSettings
          );

          appSettings =
            loadSettings();
        }

        return {
          success: true
        };
      } catch (error) {
        console.error(
          "delete-model failed:",
          error
        );

        return {
          success: false,
          error:
            error.message ||
            String(error)
        };
      }
    }
  );

  ipcMain.handle(
    "upload-model",
    async (
      event,
      filePath
    ) => {
      try {
        if (
          !filePath ||
          typeof filePath !==
            "string"
        ) {
          throw new Error(
            "Model file path is required."
          );
        }

        if (
          !fs.existsSync(
            filePath
          )
        ) {
          throw new Error(
            "Source model file does not exist."
          );
        }

        const sourceStats =
          fs.statSync(
            filePath
          );

        if (
          !sourceStats.isFile()
        ) {
          throw new Error(
            "Selected model path is not a file."
          );
        }

        const extension =
          path.extname(
            filePath
          ).toLowerCase();

        if (
          ![
            ".gguf",
            ".bin",
            ".ggml"
          ].includes(extension)
        ) {
          throw new Error(
            "Unsupported model format."
          );
        }

        const modelsPath =
          getModelsPath();

        fs.mkdirSync(
          modelsPath,
          {
            recursive: true
          }
        );

        const fileName =
          path.basename(
            filePath
          );

        const destination =
          path.join(
            modelsPath,
            fileName
          );

        if (
          path.resolve(
            filePath
          ) ===
          path.resolve(
            destination
          )
        ) {
          return {
            success: true,
            fileName,
            path: destination
          };
        }

        fs.copyFileSync(
          filePath,
          destination
        );

        return {
          success: true,
          fileName,
          path: destination
        };
      } catch (error) {
        console.error(
          "upload-model failed:",
          error
        );

        return {
          success: false,
          error:
            error.message ||
            String(error)
        };
      }
    }
  );

  ipcMain.handle(
    "open-file",
    async (
      event,
      filePath
    ) => {
      try {
        if (
          !filePath ||
          typeof filePath !==
            "string"
        ) {
          throw new Error(
            "A file path is required."
          );
        }

        if (
          !fs.existsSync(
            filePath
          )
        ) {
          throw new Error(
            "File does not exist."
          );
        }

        const result =
          await shell.openPath(
            filePath
          );

        if (result) {
          return {
            success: false,
            error: result
          };
        }

        return {
          success: true
        };
      } catch (error) {
        return {
          success: false,
          error:
            error.message ||
            String(error)
        };
      }
    }
  );

  ipcMain.handle(
    "get-server-status",
    async () => {
      return llamaServer.getStatus();
    }
  );

  ipcMain.handle(
    "restart-llama-server",
    async () => {
      try {
        appSettings =
          loadSettings();

        await llamaServer.restart();

        const status =
          await llamaServer.getStatus();

        return {
          success:
            status.running,
          status,
          error:
            status.running
              ? null
              : llamaServer.lastError
        };
      } catch (error) {
        return {
          success: false,
          error:
            error.message ||
            String(error)
        };
      }
    }
  );

  ipcMain.handle(
    "get-performance-metrics",
    () => {
      return resourceManager.getMetrics();
    }
  );

  ipcMain.handle(
    "optimize-memory",
    async () => {
      try {
        if (global.gc) {
          global.gc();
        }

        return {
          success: true
        };
      } catch (error) {
        return {
          success: false,
          error:
            error.message ||
            String(error)
        };
      }
    }
  );

  ipcMain.handle(
    "get-system-info",
    async () => {
      try {
        const [
          system,
          osInfo,
          cpu,
          memory,
          graphics
        ] = await Promise.all([
          si.system(),
          si.osInfo(),
          si.cpu(),
          si.mem(),
          si.graphics()
        ]);

        return {
          platform:
            process.platform,
          arch:
            process.arch,
          nodeVersion:
            process.version,
          electronVersion:
            process.versions
              .electron,
          system,
          os: osInfo,
          cpu,
          memory,
          graphics,
          homeDir:
            os.homedir(),
          tempDir:
            os.tmpdir(),
          modelsDir:
            getModelsPath(),
          llamaExecutable:
            llamaServer.findExecutable(),
          llamaCapabilities:
            llamaServer.capabilities
        };
      } catch (error) {
        return {
          platform:
            process.platform,
          arch:
            process.arch,
          nodeVersion:
            process.version,
          electronVersion:
            process.versions
              .electron,
          modelsDir:
            getModelsPath(),
          llamaExecutable:
            llamaServer.findExecutable(),
          error:
            error.message
        };
      }
    }
  );

  ipcMain.handle(
    "open-models-folder",
    async () => {
      try {
        const modelsPath =
          getModelsPath();

        fs.mkdirSync(
          modelsPath,
          {
            recursive: true
          }
        );

        const result =
          await shell.openPath(
            modelsPath
          );

        if (result) {
          return {
            success: false,
            path: modelsPath,
            error: result
          };
        }

        return {
          success: true,
          path: modelsPath
        };
      } catch (error) {
        return {
          success: false,
          error:
            error.message
        };
      }
    }
  );

  ipcMain.handle(
    "clear-chat-history",
    async () => {
      try {
        if (
          sessionManager &&
          typeof sessionManager.clear ===
            "function"
        ) {
          sessionManager.clear();
        }

        if (
          sessionManager &&
          typeof sessionManager.clearHistory ===
            "function"
        ) {
          await sessionManager.clearHistory();
        }

        return {
          success: true
        };
      } catch (error) {
        return {
          success: false,
          error:
            error.message
        };
      }
    }
  );

  ipcMain.handle(
    "quit-app",
    () => {
      isQuitting = true;
      app.quit();
      return true;
    }
  );
}

function initializeIPC() {
  if (ipcInitialized) {
    return true;
  }

  const channels = [
    "chat:stream",
    "chat:stop",
    "chat:history",
    "chat:delete",
    "chat:session",
    "chat:clear",
    "metrics:realtime",
    "ai:status",
    "models:list",
    "models:upload",
    "models:addRemote",
    "models:get",
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
      ipcMain.removeHandler(
        channel
      );
    } catch {}
  }

  registerChatHandlers({
    ipcMain,
    BrowserWindow,
    sessionManager,

    getAvailableModel:
      async () => {
        const models =
          await getAllLocalModels();

        return models[0] ||
          null;
      },

    getActiveModel:
      async () =>
        appSettings.activeModel,

    getModelPath:
      async (model) => {
        if (
          model &&
          typeof model ===
            "object" &&
          model.path
        ) {
          return model.path;
        }

        if (
          typeof model ===
          "string"
        ) {
          const models =
            await getAllLocalModels();

          return (
            models.find(
              (item) =>
                item.id ===
                model
            )?.path ||
            null
          );
        }

        return getActiveModelPath();
      }
  });

  try {
    setupMetricsHandlers();
  } catch (error) {
    console.error(
      "Metrics IPC initialization failed:",
      error
    );
  }

  try {
    setupModelsHandlers(
      mainWindow,
      appSettings,
      saveSettings,
      {
        stop: () => llamaServer.stop(),
        restart: () => llamaServer.restart()
      }
    );
  } catch (error) {
    console.error(
      "Models IPC initialization failed:",
      error
    );
  }

  setupApplicationIPC();

  ipcInitialized = true;

  return true;
}

async function startApplication() {
  console.log(
    "Starting OffyAI"
  );

  appSettings =
    loadSettings();

  llamaServer.refreshAddress();

  resourceManager.startMonitoring();

  createSplashWindow();

  createMainWindow();

  initializeIPC();

  setImmediate(() => {
    void llamaServer
      .start()
      .then(() => {
        console.log(
          "Llama startup routine completed."
        );
      })
      .catch((error) => {
        console.error(
          "Llama startup failed:",
          error
        );
      });
  });

  console.log(
    "OffyAI startup sequence initialized."
  );
}

app.whenReady()
  .then(
    startApplication
  )
  .catch((error) => {
    console.error(
      "Fatal application startup error:",
      error
    );

    dialog.showErrorBox(
      "OffyAI Startup Error",
      error.stack ||
        error.message ||
        String(error)
    );

    app.quit();
  });

app.on(
  "window-all-closed",
  (event) => {
    if (isQuitting) {
      return;
    }

    if (
      process.platform !==
      "darwin"
    ) {
      event.preventDefault();

      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.hide();
      }
    }
  }
);

app.on(
  "activate",
  () => {
    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.show();
      mainWindow.focus();
      return;
    }

    try {
      createSplashWindow();
      createMainWindow();

      ipcInitialized = false;
      initializeIPC();

      void llamaServer.start();
    } catch (error) {
      console.error(
        "Failed to reactivate application window:",
        error
      );
    }
  }
);

app.on(
  "before-quit",
  () => {
    isQuitting = true;

    try {
      llamaServer.stop();
    } catch (error) {
      console.warn(
        "Llama shutdown warning:",
        error
      );
    }

    resourceManager.stopMonitoring();

    if (startupTimeout) {
      clearTimeout(
        startupTimeout
      );

      startupTimeout = null;
    }

    closeSplashWindow();
  }
);

app.on(
  "will-quit",
  () => {
    try {
      llamaServer.stop();
    } catch {}

    for (
      const child of serverProcesses
    ) {
      try {
        if (
          child &&
          !child.killed
        ) {
          if (
            process.platform ===
            "win32"
          ) {
            spawn(
              "taskkill",
              [
                "/pid",
                String(child.pid),
                "/t",
                "/f"
              ],
              {
                windowsHide:
                  true,
                stdio:
                  "ignore"
              }
            );
          } else {
            child.kill(
              "SIGTERM"
            );
          }
        }
      } catch {}
    }

    serverProcesses.clear();

    resourceManager.stopMonitoring();
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled Promise Rejection:",
      reason
    );
  }
);

function handleSignal(
  signal
) {
  console.log(
    `Received ${signal}. Shutting down...`
  );

  if (isQuitting) {
    return;
  }

  isQuitting = true;

  try {
    llamaServer.stop();
  } catch {}

  resourceManager.stopMonitoring();

  if (startupTimeout) {
    clearTimeout(
      startupTimeout
    );

    startupTimeout = null;
  }

  app.quit();
}

process.on(
  "SIGINT",
  () => {
    handleSignal(
      "SIGINT"
    );
  }
);

process.on(
  "SIGTERM",
  () => {
    handleSignal(
      "SIGTERM"
    );
  }
);