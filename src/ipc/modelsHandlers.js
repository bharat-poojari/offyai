"use strict";

const { app, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const https = require("https");
const {
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_FILE,
  isProtectedDefaultModel,
  ensureDefaultModelEntry,
} = require("../modelDefaults");
const { resolveModelsDirectory } = require("./modelPaths");

/*
 * ============================================================================
 * PATHS
 * ============================================================================
 *
 * The packaged app must write uploaded models to the user-writable data folder;
 * the app bundle itself is read-only. In development we keep using the project
 * local models directory so the app behaves consistently in both modes.
 * ============================================================================
 */

const MODELS_DIR = resolveModelsDirectory({
  rootDir: __dirname,
  userDataDir: app?.getPath?.("userData"),
  isPackaged: !!(app && app.isPackaged),
  resourcesPath: process.resourcesPath,
});

const APP_ROOT = path.resolve(
  __dirname,
  "../.."
);

function toProjectRelativePath(filePath) {
  if (
    typeof filePath !== "string" ||
    !filePath.trim()
  ) {
    return filePath;
  }

  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(APP_ROOT, absolutePath);

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

function resolveProjectRelativePath(filePath) {
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

  return path.resolve(APP_ROOT, trimmed);
}

const SETTINGS_FILE =
  typeof app !== "undefined" &&
  app &&
  app.isPackaged &&
  typeof app.getPath === "function"
    ? path.join(
        app.getPath("userData"),
        "settings.json"
      )
    : path.resolve(
        __dirname,
        "../../settings.json"
      );

let settingsCache = null;
let settingsCacheMtime = null;
let activeDownload = null;

const MODEL_EXTENSIONS = [
  ".gguf",
  ".bin",
  ".ggml",
];

const MODEL_FILTERS = [
  {
    name: "AI Model Files",
    extensions: [
      "gguf",
      "bin",
      "ggml",
    ],
  },
  {
    name: "GGUF Models",
    extensions: [
      "gguf",
    ],
  },
  {
    name: "All Files",
    extensions: [
      "*",
    ],
  },
];

/*
 * ============================================================================
 * DIRECTORY
 * ============================================================================
 */

function ensureModelsDirectory() {
  try {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(
        MODELS_DIR,
        {
          recursive: true,
        }
      );
    }

    return true;
  } catch (error) {
    console.error(
      "[Models] Failed to create models directory:",
      error
    );

    return false;
  }
}

ensureModelsDirectory();

/*
 * ============================================================================
 * SETTINGS
 * ============================================================================
 */

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return {};
    }

    const currentMtime = fs.statSync(SETTINGS_FILE).mtimeMs;

    if (settingsCache && currentMtime === settingsCacheMtime) {
      return settingsCache;
    }

    const raw = fs.readFileSync(
      SETTINGS_FILE,
      "utf8"
    );

    if (!raw.trim()) {
      return {};
    }

    const settings = JSON.parse(raw);

    if (
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {
      return {};
    }

    settingsCache = settings;
    settingsCacheMtime = currentMtime;
    return settings;
  } catch (error) {
    console.error(
      "[Models] Failed to read settings:",
      error
    );

    return {};
  }
}

function writeSettings(settings) {
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    throw new Error(
      "Invalid settings object."
    );
  }

  const directory =
    path.dirname(SETTINGS_FILE);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(
      directory,
      {
        recursive: true,
      }
    );
  }

  const temporaryFile =
    `${SETTINGS_FILE}.tmp`;

  try {
    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(
        settings,
        null,
        2
      ),
      "utf8"
    );

    fs.renameSync(
      temporaryFile,
      SETTINGS_FILE
    );

    settingsCache = settings;
    try {
      settingsCacheMtime = fs.statSync(SETTINGS_FILE).mtimeMs;
    } catch {
      settingsCacheMtime = null;
    }

    return true;
  } catch (error) {
    try {
      if (
        fs.existsSync(
          temporaryFile
        )
      ) {
        fs.unlinkSync(
          temporaryFile
        );
      }
    } catch (_) {
      // Ignore cleanup errors.
    }

    console.error(
      "[Models] Failed to write settings:",
      error
    );

    throw error;
  }
}

/*
 * ============================================================================
 * SETTINGS SYNCHRONIZATION
 * ============================================================================
 */

function synchronizeAppSettings(
  appSettings,
  settings
) {
  if (
    !appSettings ||
    typeof appSettings !== "object"
  ) {
    return;
  }

  for (
    const key of Object.keys(appSettings)
  ) {
    delete appSettings[key];
  }

  Object.assign(
    appSettings,
    settings
  );
}

function synchronizeAvailableModelsWithDisk(settings, localModels, appSettings) {
  const localEntries = (Array.isArray(localModels) ? localModels : []).map((model) => ({
    id: model.id,
    fileName: model.fileName,
    name: model.name || model.id,
    type: "local",
    path: toProjectRelativePath(model.path),
    size: model.size,
    sizeBytes: model.sizeBytes,
    format: model.format,
    uploadedAt: model.created || new Date().toISOString(),
  }));

  if (JSON.stringify(settings.availableModels || []) === JSON.stringify(localEntries)) {
    return settings;
  }

  settings.availableModels = localEntries;
  return persistModelSettings(settings, appSettings);
}

/*
 * Do NOT call the application's strict saveSettings()
 * from this file.
 *
 * The model-management settings file is already persisted
 * using writeSettings().
 *
 * This is important because deleting the last model is a
 * legitimate operation and produces:
 *
 *   activeModel: null
 *
 * The old saveSettings validator rejected that state.
 */

function persistModelSettings(
  settings,
  appSettings
) {
  const nextSettings = ensureDefaultModelEntry({
    ...settings,
    availableModels: Array.isArray(settings.availableModels)
      ? settings.availableModels
      : [],
  });

  writeSettings(
    nextSettings
  );

  synchronizeAppSettings(
    appSettings,
    nextSettings
  );

  return nextSettings;
}

/*
 * ============================================================================
 * FILE HELPERS
 * ============================================================================
 */

function isSupportedModelFile(
  fileName
) {
  if (
    typeof fileName !== "string" ||
    !fileName.trim()
  ) {
    return false;
  }

  const extension =
    path.extname(
      fileName
    ).toLowerCase();

  return MODEL_EXTENSIONS.includes(
    extension
  );
}

function sanitizeFileName(
  fileName
) {
  if (
    typeof fileName !== "string" ||
    !fileName.trim()
  ) {
    return null;
  }

  const baseName =
    path.basename(
      fileName
    );

  if (
    !baseName ||
    baseName === "." ||
    baseName === ".."
  ) {
    return null;
  }

  /*
   * Reject filenames that would create an unsafe destination.
   */
  if (
    baseName.includes("\0")
  ) {
    return null;
  }

  return baseName;
}

function getModelIdFromFileName(
  fileName
) {
  return path.basename(
    fileName,
    path.extname(
      fileName
    )
  );
}

function getModelPath(
  fileName
) {
  const safeName =
    sanitizeFileName(
      fileName
    );

  if (!safeName) {
    throw new Error(
      "Invalid model filename."
    );
  }

  return path.resolve(
    MODELS_DIR,
    safeName
  );
}

function isPathInsideDirectory(
  targetPath,
  directory
) {
  const resolvedTarget =
    path.resolve(
      targetPath
    );

  const resolvedDirectory =
    path.resolve(
      directory
    );

  const relative =
    path.relative(
      resolvedDirectory,
      resolvedTarget
    );

  return (
    relative === "" ||
    (
      !relative.startsWith("..") &&
      !path.isAbsolute(relative)
    )
  );
}

function formatFileSize(
  bytes
) {
  if (
    typeof bytes !== "number" ||
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return "0 B";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024)
      ),
      units.length - 1
    );

  return `${parseFloat(
    (
      bytes /
      Math.pow(
        1024,
        index
      )
    ).toFixed(2)
  )} ${units[index]}`;
}

/*
 * ============================================================================
 * LOCAL MODEL SCANNING
 * ============================================================================
 */

function getLocalModels() {
  try {
    if (
      !ensureModelsDirectory()
    ) {
      return [];
    }

    const files =
      fs.readdirSync(
        MODELS_DIR,
        {
          withFileTypes: true,
        }
      );

    const models = [];

    for (
      const entry of files
    ) {
      try {
        if (
          !entry.isFile()
        ) {
          continue;
        }

        const fileName =
          entry.name;

        if (
          !isSupportedModelFile(
            fileName
          )
        ) {
          continue;
        }

        const filePath =
          getModelPath(
            fileName
          );

        if (
          !isPathInsideDirectory(
            filePath,
            MODELS_DIR
          )
        ) {
          continue;
        }

        const stats =
          fs.statSync(
            filePath
          );

        if (
          !stats.isFile()
        ) {
          continue;
        }

        const extension =
          path.extname(
            fileName
          ).toLowerCase();

        const modelId =
          getModelIdFromFileName(
            fileName
          );

        models.push({
          id: modelId,
          fileName,
          object: "model",
          owned_by: "local",
          ready: true,
          type: "local",
          name: modelId,
          path: filePath,
          size:
            formatFileSize(
              stats.size
            ),
          sizeBytes:
            stats.size,
          format:
            extension.substring(1),
          created:
            stats.birthtime.toISOString(),
          modified:
            stats.mtime.toISOString(),
          isDirectory: false,
        });
      } catch (error) {
        console.error(
          `[Models] Failed to inspect "${entry.name}":`,
          error
        );
      }
    }

    models.sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );

    return models;
  } catch (error) {
    console.error(
      "[Models] Failed to read local models:",
      error
    );

    return [];
  }
}

/*
 * ============================================================================
 * REMOTE MODELS
 * ============================================================================
 */

async function getRemoteModels() {
  try {
    const settings =
      readSettings();

    return Array.isArray(
      settings.remoteModels
    )
      ? settings.remoteModels
      : [];
  } catch (error) {
    console.error(
      "[Models] Failed to read remote models:",
      error
    );

    return [];
  }
}

function getHuggingFaceApiUrl(query, limit = 12) {
  const term = String(query || "").trim();
  const searchTerm = term || "qwen gguf";
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 24);

  return `https://huggingface.co/api/models?search=${encodeURIComponent(searchTerm)}&sort=downloads&direction=-1&limit=${safeLimit}&filter=gguf&expand[]=siblings`;
}

function getHuggingFaceModelDetailsUrl(repoId) {
  const safeRepoId = String(repoId || "").trim();

  if (!safeRepoId) {
    return null;
  }

  const repoPath = safeRepoId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://huggingface.co/api/models/${repoPath}`;
}

function extractHuggingFaceModelFiles(item) {
  const siblingFiles = Array.isArray(item?.siblings)
    ? item.siblings
    : [];

  const fileNames = [];

  for (const entry of siblingFiles) {
    const fileName = String(
      entry?.rfilename ||
      entry?.filename ||
      entry?.name ||
      ""
    ).trim();

    if (fileName && /\.(gguf|bin|ggml)$/i.test(fileName)) {
      fileNames.push(fileName);
    }
  }

  if (fileNames.length) {
    return fileNames;
  }

  const fallbackFiles = Array.isArray(item?.ggufFiles)
    ? item.ggufFiles
    : [];

  return fallbackFiles
    .map((fileName) => String(fileName || "").trim())
    .filter((fileName) => fileName && /\.(gguf|bin|ggml)$/i.test(fileName));
}

function extractHuggingFaceFileMetadata(item) {
  const siblingFiles = Array.isArray(item?.siblings)
    ? item.siblings
    : [];

  return siblingFiles
    .map((entry) => ({
      name: String(
        entry?.rfilename ||
        entry?.filename ||
        entry?.name ||
        ""
      ).trim(),
      sizeBytes: Number.isFinite(Number(entry?.size))
        ? Number(entry.size)
        : Number.isFinite(Number(entry?.lfs?.size))
          ? Number(entry.lfs.size)
          : null,
    }))
    .filter(
      (file) =>
        file.name &&
        /\.(gguf|bin|ggml)$/i.test(file.name)
    );
}

function chooseRecommendedGgufFile(fileNames) {
  const files = Array.isArray(fileNames) ? fileNames : [];
  const qualityRanks = [
    [/F32|F16|BF16/i, 100],
    [/Q8(?:_0)?/i, 90],
    [/Q6(?:_K)?/i, 80],
    [/Q5(?:_K)?/i, 70],
    [/Q4(?:_K)?/i, 60],
    [/IQ[2-4]/i, 40],
  ];

  return [...files].sort((left, right) => {
    const rank = (fileName) =>
      qualityRanks.find(([pattern]) => pattern.test(fileName))?.[1] || 10;
    return rank(right) - rank(left) || left.localeCompare(right);
  })[0] || null;
}

function getHuggingFaceFileUrl(repoId, fileName) {
  const safeRepoId = String(repoId || "").trim();
  const safeFileName = String(fileName || "").trim();

  if (!safeRepoId || !safeFileName) {
    return null;
  }

  const repoPath = safeRepoId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const filePath = safeFileName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://huggingface.co/${repoPath}/resolve/main/${filePath}`;
}

function fetchFileSize(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const request = https.request(
      url,
      {
        method: "HEAD",
        headers: {
          "User-Agent": "OffyAI/1.0",
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          resolve(fetchFileSize(response.headers.location, timeoutMs));
          return;
        }

        const size = Number(response.headers["content-length"]);
        resolve(Number.isFinite(size) && size > 0 ? size : null);
        response.resume();
      }
    );

    request.on("error", () => resolve(null));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(null);
    });
    request.end();
  });
}

function fetchJson(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "OffyAI/1.0",
          Accept: "application/json",
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          resolve(fetchJson(response.headers.location, timeoutMs));
          return;
        }

        if (response.statusCode >= 400) {
          reject(
            new Error(
              `Hugging Face request failed (${response.statusCode})`
            )
          );
          return;
        }

        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : null;
            resolve(parsed);
          } catch (error) {
            reject(
              new Error(
                `Failed to parse Hugging Face response: ${error.message}`
              )
            );
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Request timed out while contacting Hugging Face."));
    });
  });
}

async function getModelCatalogResults({ query, goal, limit = 12 } = {}) {
  const queryText = String(query || "").trim() || goal || "qwen gguf";
  const limitValue = Math.max(6, Number(limit) || 12);

  const [huggingFaceResult, modelScopeResult] = await Promise.allSettled([
    getRecommendedHuggingFaceModels({
      query: queryText,
      goal,
      limit: limitValue,
    }),
    searchModelScopeModels({
      query: queryText,
      limit: limitValue,
    }),
  ]);

  const payload = [];

  if (huggingFaceResult.status === "fulfilled") {
    payload.push(
      ...huggingFaceResult.value.map((item) => ({
        ...item,
        source: "huggingface",
      }))
    );
  }

  if (modelScopeResult.status === "fulfilled") {
    payload.push(
      ...modelScopeResult.value.map((item) => ({
        ...item,
        source: "modelscope",
      }))
    );
  }

  const deduped = new Map();

  for (const item of payload) {
    const uniqueKey = `${item.source}:${String(item.id || item.modelId || item.name || "")}`;
    if (!deduped.has(uniqueKey)) {
      deduped.set(uniqueKey, item);
    }
  }

  return [...deduped.values()].sort((a, b) => (Number(b.score || b.downloads || 0) || 0) - (Number(a.score || a.downloads || 0) || 0)).slice(0, limitValue * 2);
}

async function searchModelScopeModels({ query, limit = 12 } = {}) {
  const queryText = String(query || "").trim() || "qwen gguf";
  const url = `https://modelscope.cn/api/v1/models?search=${encodeURIComponent(queryText)}&limit=${Math.max(6, Number(limit) || 12)}`;

  try {
    const data = await fetchJson(url, 20000);
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

    return items
      .filter((item) => item && (String(item?.name || item?.id || item?.model_id || "").trim() || String(item?.display_name || "").trim()))
      .map((item) => {
        const id = String(item?.id || item?.model_id || item?.name || item?.display_name || "").trim();
        const name = String(item?.name || item?.display_name || item?.model_name || id.split("/").pop() || "Unknown model").trim();
        const files = Array.isArray(item?.files) ? item.files : [];
        const fileNames = files
          .map((file) => String(file?.name || file?.filename || "").trim())
          .filter((fileName) => /\.(gguf|bin|ggml)$/i.test(fileName));
        const fileName = String(
          item?.recommendedFile && fileNames.includes(item.recommendedFile)
            ? item.recommendedFile
            : chooseRecommendedGgufFile(fileNames) ||
                item?.model_name ||
                files[0]?.name ||
                files[0]?.filename ||
                `${name}.gguf`
        ).trim();
        const fileMetadata = files.length
          ? files.map((file) => ({
              name: String(file?.name || file?.filename || fileName || "").trim(),
              sizeBytes: Number(file?.size || file?.sizeBytes || file?.bytes || 0),
              downloadUrl: file?.download_url || file?.downloadUrl || file?.url || file?.download || "",
            }))
          : [{ name: fileName || `${name}.gguf`, sizeBytes: 0 }];

        return {
          id,
          name,
          modelId: id,
          author: item?.author || item?.owner || "modelscope",
          repoUrl: item?.repoUrl || item?.url || item?.web_url || item?.html_url || `https://modelscope.cn/models/${id}`,
          downloadUrl: item?.downloadUrl || item?.download_url || item?.model_url || item?.files?.[0]?.download_url || "",
          downloads: Number(item?.downloads || item?.download_count || item?.stats?.downloads || item?.downloads_count || 0),
          likes: Number(item?.likes || item?.star_count || item?.stars || item?.stats?.likes || 0),
          summary: item?.summary || item?.description || item?.cardData?.description || "",
          tags: Array.isArray(item?.tags) ? item.tags : Array.isArray(item?.tag) ? item.tag : [],
          pipelineTag: item?.pipelineTag || item?.type || "",
          ggufFiles: fileMetadata.map((file) => file.name).filter(Boolean),
          fileMetadata,
          recommendedFile: fileName || fileMetadata[0]?.name || `${name}.gguf`,
          score: 65,
        };
      });
  } catch (error) {
    console.warn("[Models] ModelScope search failed:", error);
    return [];
  }
}

async function getRecommendedHuggingFaceModels({ query, goal, limit = 12 } = {}) {
  const queryText = String(query || "").trim() || goal || "qwen gguf";
  const searchResults = await fetchJson(
    getHuggingFaceApiUrl(queryText, limit),
    30000
  );

  if (!Array.isArray(searchResults)) {
    return [];
  }

  const modelResults = [];

  for (const item of searchResults) {
    const id = String(item?.id || "").trim();

    if (!id) {
      continue;
    }

    let ggufFiles = extractHuggingFaceModelFiles(item);
    let fileMetadata = extractHuggingFaceFileMetadata(item);
    let hasFileDetails = ggufFiles.length > 0;

    /*
     * If search results don't have file list, try to fetch from repo details.
     * Some repos from the GGUF-filtered search may not include siblings in the search payload.
     */
    if (!hasFileDetails) {
      try {
        const detailsUrl = getHuggingFaceModelDetailsUrl(id);

        if (detailsUrl) {
          const details = await fetchJson(detailsUrl, 15000);

          if (details && typeof details === "object") {
            const detailFiles = extractHuggingFaceModelFiles(details);
            const detailFileMetadata = extractHuggingFaceFileMetadata(details);

            if (detailFiles.length) {
              ggufFiles = detailFiles;
              fileMetadata = detailFileMetadata;
              hasFileDetails = true;
            }
          }
        }
      } catch (error) {
        /*
         * Repo detail fetch failed. For repos with GGUF-like names from the
         * public filtered search, we'll allow them through anyway with a
         * generic download path.
         */
        console.warn(
          "[Models] Could not fetch repo details for",
          id,
          "- proceeding with repo name heuristics"
        );
      }
    }

    /*
     * Accept model if:
     * - We have explicit GGUF file list, OR
     * - Repo name/tags strongly suggest it's a GGUF model
     */
    const looksLikeGgufModel =
      /(gguf|bin|ggml)/i.test(id) ||
      /(gguf|bin|ggml)/i.test(item?.name || "") ||
      (Array.isArray(item?.tags) &&
        item.tags.some((tag) => /(gguf|bin|ggml)/i.test(String(tag))));

    if (!hasFileDetails && !looksLikeGgufModel) {
      continue;
    }

    /*
     * For repos without explicit files, generate a reasonable default
     * filename based on the repo name.
     */
    let fileName = chooseRecommendedGgufFile(ggufFiles);

    if (!fileName && looksLikeGgufModel) {
      const modelName = id.split("/").pop() || "model";
      fileName = modelName.endsWith(".gguf")
        ? modelName
        : modelName.replace(/[^a-zA-Z0-9_-]/g, "-") + ".gguf";
    }

    if (fileName && !fileMetadata.some((file) => file.name === fileName && file.sizeBytes)) {
      const sizeBytes = await fetchFileSize(
        getHuggingFaceFileUrl(id, fileName),
        15000
      );

      if (sizeBytes) {
        fileMetadata = [
          ...fileMetadata.filter((file) => file.name !== fileName),
          { name: fileName, sizeBytes },
        ];
      }
    }

    const tags = Array.isArray(item?.tags) ? item.tags : [];

    modelResults.push({
      id,
      name: id.split("/").pop() || "Unknown model",
      modelId: id,
      author: id.includes("/") ? id.split("/")[0] : "unknown",
      repoUrl: `https://huggingface.co/${id}`,
      downloads: Number(item?.downloads || 0),
      likes: Number(item?.likes || 0),
      lastModified: item?.lastModified || item?.updatedAt || null,
      summary: item?.cardData?.description || item?.summary || "",
      tags,
      pipelineTag: item?.pipeline_tag || "",
      ggufFiles,
      fileMetadata,
      recommendedFile: fileName,
    });
  }

  return modelResults.slice(0, limit);
}

function getDownloadUrl(repoId, fileName) {
  const safeRepo = String(repoId || "").trim();
  const safeFile = String(fileName || "").trim();

  if (!safeRepo || !safeFile) {
    throw new Error("Both model repository and file name are required.");
  }

  const repoPath = safeRepo.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const normalizedFilePath = safeFile
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://huggingface.co/${repoPath}/resolve/main/${normalizedFilePath}`;
}

async function downloadFileFromUrl(downloadUrl, destinationPath, onProgress, resumeBytes = 0) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let interrupted = false;
    let responseStream = null;
    let request = null;
    const fileStream = fs.createWriteStream(destinationPath, {
      flags: resumeBytes > 0 ? "a" : "w",
    });

    const settle = (result, error) => {
      if (settled) {
        return;
      }

      settled = true;
      activeDownload = null;

      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };

    activeDownload = {
      pause: () => {
        if (settled) return false;
        interrupted = true;
        responseStream?.destroy();
        request?.destroy();
        fileStream.close(() => settle({ paused: true }));
        return true;
      },
      cancel: () => {
        if (settled) return false;
        interrupted = true;
        responseStream?.destroy();
        request?.destroy();
        return new Promise((resolve) => {
          fileStream.close(() => {
            try {
              if (fs.existsSync(destinationPath)) {
                fs.rmSync(destinationPath, { force: true });
              }
            } catch (_) {
              // The download handler performs a final cleanup pass.
            }
            settle({ cancelled: true });
            resolve(true);
          });
        });
      },
    };

    fileStream.on("error", (error) => {
      settle(null, error);
    });

    request = https.get(
      downloadUrl,
      {
        headers: {
          "User-Agent": "OffyAI/1.0",
          ...(resumeBytes > 0 ? { Range: `bytes=${resumeBytes}-` } : {}),
        },
      },
      (response) => {
        responseStream = response;

        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          downloadFileFromUrl(response.headers.location, destinationPath, onProgress, resumeBytes)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (resumeBytes > 0 && response.statusCode !== 206) {
          fileStream.close();
          try {
            if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
          } catch (_) {
            // Restarting is best-effort when a stale partial file is locked.
          }
          downloadFileFromUrl(downloadUrl, destinationPath, onProgress, 0)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode >= 400) {
          fileStream.close();
          settle(
            null,
            new Error(
              `Download failed from Hugging Face (${response.statusCode})`
            )
          );
          return;
        }

        const responseBytes = Number(response.headers["content-length"]);
        const totalBytes = resumeBytes > 0 && Number.isFinite(responseBytes)
          ? resumeBytes + responseBytes
          : responseBytes;
        let receivedBytes = resumeBytes;
        const startedAt = Date.now();

        response.on("data", (chunk) => {
          receivedBytes += chunk.length;
          onProgress?.({
            receivedBytes,
            totalBytes: Number.isFinite(totalBytes) ? totalBytes : null,
            percent: Number.isFinite(totalBytes) && totalBytes > 0
              ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
              : null,
            bytesPerSecond: (receivedBytes / Math.max(Date.now() - startedAt, 1)) * 1000,
          });
        });

        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close(() => settle({ success: true }));
        });
      }
    );

    request.on("error", (error) => {
      fileStream.close();
      if (!settled && !interrupted) {
        settle(null, error);
      }
    });
  });
}

/*
 * ============================================================================
 * FIND MODEL
 * ============================================================================
 */

function findModelFile(
  modelId
) {
  if (
    typeof modelId !== "string" ||
    !modelId.trim()
  ) {
    return null;
  }

  try {
    const localModels =
      getLocalModels();

    const model =
      localModels.find(
        (item) =>
          item.id ===
          modelId
      );

    return (
      model?.fileName ||
      null
    );
  } catch (error) {
    console.error(
      "[Models] Failed to find model:",
      error
    );

    return null;
  }
}

function findLocalModel(
  modelId
) {
  if (
    typeof modelId !== "string" ||
    !modelId.trim()
  ) {
    return null;
  }

  const models =
    getLocalModels();

  return (
    models.find(
      (model) =>
        model.id ===
        modelId
    ) ||
    null
  );
}

/*
 * ============================================================================
 * AVAILABLE MODELS
 * ============================================================================
 */

function createAvailableModelInfo(
  fileName,
  uploadedAt = null
) {
  const safeName =
    sanitizeFileName(
      fileName
    );

  if (!safeName) {
    throw new Error(
      "Invalid model filename."
    );
  }

  const filePath =
    getModelPath(
      safeName
    );

  const stats =
    fs.statSync(
      filePath
    );

  const modelId =
    getModelIdFromFileName(
      safeName
    );

  return {
    id: modelId,
    fileName: safeName,
    size:
      formatFileSize(
        stats.size
      ),
    sizeBytes:
      stats.size,
    uploadedAt:
      uploadedAt ||
      new Date().toISOString(),
    type: "local",
  };
}

function updateAvailableModel(
  settings,
  modelInfo
) {
  if (
    !Array.isArray(
      settings.availableModels
    )
  ) {
    settings.availableModels =
      [];
  }

  if (
    isProtectedDefaultModel(
      modelInfo.id,
      modelInfo.fileName || modelInfo.name
    )
  ) {
    const defaultEntry = {
      ...modelInfo,
      id: DEFAULT_MODEL_ID,
      fileName: DEFAULT_MODEL_FILE,
      name: DEFAULT_MODEL_ID,
      type: "local",
      path: `models/${DEFAULT_MODEL_FILE}`,
    };

    const index =
      settings.availableModels.findIndex(
        (model) =>
          model &&
          isProtectedDefaultModel(
            model.id,
            model.fileName || model.name
          )
      );

    if (index >= 0) {
      settings.availableModels[index] = {
        ...settings.availableModels[index],
        ...defaultEntry,
      };
    } else {
      settings.availableModels.unshift(defaultEntry);
    }

    settings.availableModels = ensureDefaultModelEntry(settings).availableModels;
    return;
  }

  const index =
    settings.availableModels.findIndex(
      (model) =>
        model &&
        model.id ===
          modelInfo.id
    );

  if (
    index >= 0
  ) {
    settings.availableModels[
      index
    ] = {
      ...settings.availableModels[
        index
      ],
      ...modelInfo,
    };
  } else {
    settings.availableModels.push(
      modelInfo
    );
  }

  settings.availableModels = ensureDefaultModelEntry(settings).availableModels;
}

function removeAvailableModel(
  settings,
  modelId
) {
  if (
    !Array.isArray(
      settings.availableModels
    )
  ) {
    settings.availableModels =
      [];

    return;
  }

  settings.availableModels =
    settings.availableModels.filter(
      (model) => {
        if (!model || typeof model !== "object") {
          return false;
        }

        if (isProtectedDefaultModel(model.id, model.fileName || model.name)) {
          return true;
        }

        return model.id !== modelId;
      }
    );

  settings.availableModels = ensureDefaultModelEntry(settings).availableModels;
}

/*
 * ============================================================================
 * ACTIVE MODEL
 * ============================================================================
 */

function buildLocalActiveModel(
  modelId,
  fileName
) {
  const safeName =
    sanitizeFileName(
      fileName
    );

  if (!safeName) {
    throw new Error(
      "Invalid model filename."
    );
  }

  const modelPath =
    getModelPath(
      safeName
    );

  if (
    !isPathInsideDirectory(
      modelPath,
      MODELS_DIR
    )
  ) {
    throw new Error(
      "Invalid model path."
    );
  }

  return {
    id: modelId,
    fileName: safeName,
    type: "local",
    name: modelId,
    path: toProjectRelativePath(modelPath),
  };
}

function buildRemoteActiveModel(
  modelId,
  modelConfig
) {
  return {
    id: modelId,
    type: "remote",
    name:
      modelConfig.name ||
      modelId,
    url:
      modelConfig.url,
    apiKey:
      modelConfig.apiKey ||
      "",
    provider:
      modelConfig.provider ||
      "custom",
    config:
      modelConfig.config &&
      typeof modelConfig.config ===
        "object"
        ? modelConfig.config
        : {},
  };
}

/*
 * ============================================================================
 * RESET / FALLBACK ACTIVE MODEL
 * ============================================================================
 *
 * When deleting the currently active model:
 *
 * 1. If another local model exists, activate it.
 * 2. Otherwise if another remote model exists, activate it.
 * 3. Otherwise clear the active model.
 *
 * Clearing the active model is valid. main.js must therefore allow
 * activeModel: null.
 * ============================================================================
 */

function selectReplacementActiveModel(
  settings,
  deletedModelId
) {
  const localModels =
    getLocalModels().filter(
      (model) =>
        model.id !==
        deletedModelId
    );

  if (
    localModels.length > 0
  ) {
    const next =
      localModels[0];

    return {
      model:
        next.id,
      activeModel:
        buildLocalActiveModel(
          next.id,
          next.fileName
        ),
    };
  }

  const remoteModels =
    Array.isArray(
      settings.remoteModels
    )
      ? settings.remoteModels.filter(
          (model) =>
            model &&
            model.id !==
              deletedModelId
        )
      : [];

  if (
    remoteModels.length > 0
  ) {
    const next =
      remoteModels[0];

    return {
      model:
        next.id,
      activeModel: {
        ...next,
        type: "remote",
      },
    };
  }

  return {
    model: "",
    activeModel: null,
  };
}

/*
 * ============================================================================
 * IPC SETUP
 * ============================================================================
 */

function setupModelsHandlers(
  mainWindow,
  appSettings,
  saveSettings,
  serverLifecycle = {}
) {
  const channels = [
    "models:list",
    "models:setActive",
    "models:selectFile",
    "models:upload",
    "models:addRemote",
    "models:get",
    "models:delete",
    "models:searchHuggingFace",
    "models:searchModelCatalog",
    "models:getHuggingFaceFileMetadata",
    "models:downloadHuggingFace",
    "models:pauseDownload",
    "models:cancelDownload",
  ];

  for (
    const channel of channels
  ) {
    try {
      ipcMain.removeHandler(
        channel
      );
    } catch (_) {
      // Handler may not exist.
    }
  }

  /*
   * ==========================================================================
   * LIST MODELS
   * ==========================================================================
   */

  ipcMain.handle(
    "models:list",
    async () => {
      try {
        const localModels =
          getLocalModels();

        const settings = readSettings();
        synchronizeAvailableModelsWithDisk(settings, localModels, appSettings);

        const remoteModels =
          await getRemoteModels();

        return {
          success: true,
          object: "list",
          data: [
            ...localModels,
            ...remoteModels,
          ],
        };
      } catch (error) {
        console.error(
          "[Models] List failed:",
          error
        );

        return {
          success: false,
          object: "list",
          data: [],
          error:
            error?.message ||
            "Failed to list models.",
        };
      }
    }
  );

  /*
   * ==========================================================================
   * SET ACTIVE MODEL
   * ==========================================================================
   */

  ipcMain.handle(
    "models:setActive",
    async (
      _event,
      payload = {}
    ) => {
      try {
        const {
          modelId,
          modelType = "local",
          modelConfig = null,
        } = payload || {};

        if (
          typeof modelId !==
            "string" ||
          !modelId.trim()
        ) {
          return {
            success: false,
            error:
              "Model ID is required.",
          };
        }

        let modelData;

        if (
          modelType ===
          "local"
        ) {
          const localModel =
            findLocalModel(
              modelId
            );

          if (!localModel) {
            return {
              success: false,
              error:
                "Local model file was not found.",
            };
          }

          modelData =
            buildLocalActiveModel(
              localModel.id,
              localModel.fileName
            );

          if (
            !fs.existsSync(
              modelData.path
            )
          ) {
            return {
              success: false,
              error:
                "Model file does not exist.",
            };
          }
        } else if (
          modelType ===
          "remote"
        ) {
          if (
            !modelConfig ||
            typeof modelConfig.url !==
              "string" ||
            !modelConfig.url.trim()
          ) {
            return {
              success: false,
              error:
                "URL is required for remote models.",
            };
          }

          modelData =
            buildRemoteActiveModel(
              modelId,
              modelConfig
            );
        } else {
          return {
            success: false,
            error:
              `Unsupported model type: ${modelType}`,
          };
        }

        const settings =
          readSettings();

        const previousSettings = JSON.parse(JSON.stringify(settings));

        if (modelType === "local") {
          updateAvailableModel(
            settings,
            createAvailableModelInfo(modelData.fileName)
          );
        }

        settings.activeModel =
          modelData;

        settings.model =
          modelId;

        persistModelSettings(
          settings,
          appSettings
        );

        if (typeof serverLifecycle.restart === "function") {
          try {
            await serverLifecycle.restart();
          } catch (restartError) {
            persistModelSettings(previousSettings, appSettings);

            try {
              await serverLifecycle.restart();
            } catch (rollbackError) {
              console.error("[Models] Failed to restore previous model:", rollbackError);
            }

            return {
              success: false,
              error:
                `Unable to start model "${modelData.name || modelData.id}". The previous model was restored.`,
            };
          }
        }

        /*
         * saveSettings is deliberately not called here.
         *
         * persistModelSettings() has already written the settings file
         * and synchronized appSettings.
         *
         * This prevents model IPC from being coupled to the strict
         * settings validator.
         */

        console.log(
          `[Models] Active model set to "${modelId}" (${modelType})`
        );

        return {
          success: true,
          message:
            `Model ${modelId} activated.`,
          model:
            modelData,
          settings,
        };
      } catch (error) {
        console.error(
          "[Models] Set active model failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Failed to set active model.",
        };
      }
    }
  );

  /*
   * ==========================================================================
   * SELECT MODEL FILE
   * ==========================================================================
   */

  ipcMain.handle(
    "models:selectFile",
    async () => {
      try {
        if (
          !mainWindow ||
          mainWindow.isDestroyed()
        ) {
          return {
            success: false,
            canceled: false,
            file: null,
            error:
              "Application window is unavailable.",
          };
        }

        const result =
          await dialog.showOpenDialog(
            mainWindow,
            {
              title:
                "Select AI Model",
              buttonLabel:
                "Select Model",
              properties: [
                "openFile",
              ],
              filters:
                MODEL_FILTERS,
            }
          );

        if (
          result.canceled ||
          !Array.isArray(
            result.filePaths
          ) ||
          result.filePaths.length ===
            0
        ) {
          return {
            success: false,
            canceled: true,
            file: null,
            filePath: null,
            fileName: null,
            sizeBytes: 0,
            sizeFormatted:
              "0 B",
            extension: null,
            modelId: null,
          };
        }

        const selectedPath =
          path.resolve(
            result.filePaths[0]
          );

        if (
          !fs.existsSync(
            selectedPath
          )
        ) {
          return {
            success: false,
            canceled: false,
            file: null,
            error:
              "Selected file does not exist.",
          };
        }

        const stats =
          fs.statSync(
            selectedPath
          );

        if (
          !stats.isFile()
        ) {
          return {
            success: false,
            canceled: false,
            file: null,
            error:
              "Selected path is not a file.",
          };
        }

        const fileName =
          sanitizeFileName(
            selectedPath
          );

        if (!fileName) {
          return {
            success: false,
            canceled: false,
            file: null,
            error:
              "Invalid model filename.",
          };
        }

        const extension =
          path.extname(
            fileName
          ).toLowerCase();

        if (
          !MODEL_EXTENSIONS.includes(
            extension
          )
        ) {
          return {
            success: false,
            canceled: false,
            file: null,
            error:
              "Invalid model file. Supported formats: .gguf, .bin, .ggml.",
          };
        }

        const modelId =
          getModelIdFromFileName(
            fileName
          );

        const file = {
          name:
            fileName,
          path:
            selectedPath,
          size:
            stats.size,
          sizeBytes:
            stats.size,
          sizeFormatted:
            formatFileSize(
              stats.size
            ),
          extension,
          modelId,
          type: "local",
        };

        return {
          success: true,
          canceled: false,

          file,

          filePath:
            selectedPath,

          fileName:
            fileName,

          sizeBytes:
            stats.size,

          sizeFormatted:
            formatFileSize(
              stats.size
            ),

          extension,

          modelId,
        };
      } catch (error) {
        console.error(
          "[Models] Model file selection failed:",
          error
        );

        return {
          success: false,
          canceled: false,
          file: null,
          error:
            error?.message ||
            "Failed to select model file.",
        };
      }
    }
  );

  /*
   * ==========================================================================
   * UPLOAD MODEL
   * ==========================================================================
   *
   * Source:
   *   Any location selected by the user.
   *
   * Destination:
   *   <project-root>/models/<filename>
   *
   * Existing files with the same filename are replaced safely.
   * ==========================================================================
   */

  ipcMain.handle(
    "models:upload",
    async (
      _event,
      filePath
    ) => {
      try {
        if (
          typeof filePath !==
            "string" ||
          !filePath.trim()
        ) {
          return {
            success: false,
            error:
              "Model file path is required.",
          };
        }

        const sourcePath =
          path.resolve(
            filePath
          );

        if (
          !fs.existsSync(
            sourcePath
          )
        ) {
          return {
            success: false,
            error:
              "Selected model file was not found.",
          };
        }

        const sourceStats =
          fs.statSync(
            sourcePath
          );

        if (
          !sourceStats.isFile()
        ) {
          return {
            success: false,
            error:
              "Selected model path is not a file.",
          };
        }

        const fileName =
          sanitizeFileName(
            sourcePath
          );

        if (!fileName) {
          return {
            success: false,
            error:
              "Invalid model filename.",
          };
        }

        if (
          !isSupportedModelFile(
            fileName
          )
        ) {
          return {
            success: false,
            error:
              "Invalid model file. Only .gguf, .bin and .ggml files are supported.",
          };
        }

        if (
          !ensureModelsDirectory()
        ) {
          return {
            success: false,
            error:
              "Unable to access the models directory.",
          };
        }

        const destinationPath =
          getModelPath(
            fileName
          );

        if (
          !isPathInsideDirectory(
            destinationPath,
            MODELS_DIR
          )
        ) {
          return {
            success: false,
            error:
              "Invalid destination path.",
          };
        }

        const sameFile =
          path.resolve(
            sourcePath
          ).toLowerCase() ===
          path.resolve(
            destinationPath
          ).toLowerCase();

        if (!sameFile) {
          const temporaryPath =
            `${destinationPath}.uploading`;

          try {
            if (
              fs.existsSync(
                temporaryPath
              )
            ) {
              fs.unlinkSync(
                temporaryPath
              );
            }

            fs.copyFileSync(
              sourcePath,
              temporaryPath
            );

            const copiedStats =
              fs.statSync(
                temporaryPath
              );

            if (
              copiedStats.size !==
              sourceStats.size
            ) {
              throw new Error(
                "Model upload verification failed: copied file size does not match source file size."
              );
            }

            if (
              fs.existsSync(
                destinationPath
              )
            ) {
              fs.unlinkSync(
                destinationPath
              );
            }

            fs.renameSync(
              temporaryPath,
              destinationPath
            );
          } catch (error) {
            try {
              if (
                fs.existsSync(
                  temporaryPath
                )
              ) {
                fs.unlinkSync(
                  temporaryPath
                );
              }
            } catch (_) {
              // Ignore cleanup failure.
            }

            throw error;
          }
        }

        if (
          !fs.existsSync(
            destinationPath
          )
        ) {
          return {
            success: false,
            error:
              "Model upload failed: destination file was not created.",
          };
        }

        const finalStats =
          fs.statSync(
            destinationPath
          );

        const modelId =
          getModelIdFromFileName(
            fileName
          );

        const settings =
          readSettings();

        const existingModel =
          Array.isArray(
            settings.availableModels
          )
            ? settings.availableModels.find(
                (model) =>
                  model &&
                  model.id ===
                    modelId
              )
            : null;

        const modelInfo =
          createAvailableModelInfo(
            fileName,
            existingModel?.uploadedAt ||
              new Date().toISOString()
          );

        updateAvailableModel(
          settings,
          modelInfo
        );

        /*
         * Uploading a model does NOT automatically activate it.
         */
        persistModelSettings(
          settings,
          appSettings
        );

        const model = {
          ...modelInfo,

          path:
            destinationPath,

          sizeBytes:
            finalStats.size,

          size:
            formatFileSize(
              finalStats.size
            ),

          ready: true,

          object:
            "model",

          owned_by:
            "local",

          name:
            modelId,

          type:
            "local",
        };

        console.log(
          `[Models] Model uploaded successfully: ${fileName}`
        );

        return {
          success: true,
          message:
            "Model uploaded successfully.",
          model,
          modelsPath:
            MODELS_DIR,
        };
      } catch (error) {
        console.error(
          "[Models] Model upload failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Failed to upload model.",
        };
      }
    }
  );

  /*
   * ==========================================================================
   * ADD REMOTE MODEL
   * ==========================================================================
   */

  ipcMain.handle(
    "models:addRemote",
    async (
      _event,
      modelConfig = {}
    ) => {
      try {
        const {
          name,
          url,
          apiKey = "",
          modelId,
          provider = "custom",
          config = {},
        } = modelConfig || {};

        if (
          typeof name !==
            "string" ||
          !name.trim()
        ) {
          return {
            success: false,
            error:
              "Model name is required.",
          };
        }

        if (
          typeof url !==
            "string" ||
          !url.trim()
        ) {
          return {
            success: false,
            error:
              "Model URL is required.",
          };
        }

        if (
          typeof modelId !==
            "string" ||
          !modelId.trim()
        ) {
          return {
            success: false,
            error:
              "Model ID is required.",
          };
        }

        const remoteModel = {
          id:
            modelId.trim(),
          name:
            name.trim(),
          url:
            url.trim(),
          apiKey:
            typeof apiKey ===
            "string"
              ? apiKey
              : "",
          provider:
            typeof provider ===
            "string" &&
            provider.trim()
              ? provider.trim()
              : "custom",
          type:
            "remote",
          config:
            config &&
            typeof config ===
              "object"
              ? config
              : {},
        };

        const settings =
          readSettings();

        if (
          !Array.isArray(
            settings.remoteModels
          )
        ) {
          settings.remoteModels =
            [];
        }

        const existingIndex =
          settings.remoteModels.findIndex(
            (model) =>
              model &&
              model.id ===
                remoteModel.id
          );

        if (
          existingIndex >= 0
        ) {
          settings.remoteModels[
            existingIndex
          ] = remoteModel;
        } else {
          settings.remoteModels.push(
            remoteModel
          );
        }

        persistModelSettings(
          settings,
          appSettings
        );

        return {
          success: true,
          message:
            "Remote model configured successfully.",
          model:
            remoteModel,
        };
      } catch (error) {
        console.error(
          "[Models] Add remote model failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Failed to configure remote model.",
        };
      }
    }
  );

  /*
   * ==========================================================================
   * GET MODEL
   * ==========================================================================
   */

  ipcMain.handle(
    "models:get",
    async (
      _event,
      modelId
    ) => {
      try {
        if (
          typeof modelId !==
            "string" ||
          !modelId.trim()
        ) {
          return {
            success: false,
            error:
              "Model ID is required.",
          };
        }

        const localModels =
          getLocalModels();

        const remoteModels =
          await getRemoteModels();

        const model =
          [
            ...localModels,
            ...remoteModels,
          ].find(
            (item) =>
              item &&
              item.id ===
                modelId
          );

        if (!model) {
          return {
            success: false,
            error:
              "Model not found.",
          };
        }

        return {
          success: true,
          model,
        };
      } catch (error) {
        console.error(
          "[Models] Get model failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Failed to fetch model.",
        };
      }
    }
  );

  ipcMain.handle(
    "models:searchHuggingFace",
    async (
      _event,
      payload = {}
    ) => {
      try {
        const query =
          typeof payload === "string"
            ? payload
            : payload?.query || payload?.goal || "qwen gguf";
        const goal =
          typeof payload === "string"
            ? "general"
            : payload?.goal || "general";
        const limit = Number(payload?.limit || 12);

        const results = await getRecommendedHuggingFaceModels({
          query,
          goal,
          limit,
        });

        return {
          success: true,
          data: results,
          count: results.length,
        };
      } catch (error) {
        console.error(
          "[Models] Hugging Face model search failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Unable to search Hugging Face models.",
          data: [],
        };
      }
    }
  );

  ipcMain.handle(
    "models:searchModelCatalog",
    async (
      _event,
      payload = {}
    ) => {
      try {
        const query =
          typeof payload === "string"
            ? payload
            : payload?.query || payload?.goal || "qwen gguf";
        const goal =
          typeof payload === "string"
            ? "general"
            : payload?.goal || "general";
        const limit = Math.max(6, Number(payload?.limit || 12) || 12);

        const results = await getModelCatalogResults({
          query,
          goal,
          limit,
        });

        return {
          success: true,
          data: results,
          count: results.length,
        };
      } catch (error) {
        console.error(
          "[Models] Multi-source model search failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Unable to search model library sources.",
          data: [],
        };
      }
    }
  );

  ipcMain.handle(
    "models:pauseDownload",
    async () => ({
      success: Boolean(activeDownload?.pause?.()),
      error: activeDownload ? undefined : "No model download is active.",
    })
  );

  ipcMain.handle(
    "models:cancelDownload",
    async () => {
      if (!activeDownload) {
        return {
          success: false,
          error: "No model download is active.",
        };
      }

      const cancelled = await activeDownload.cancel();

      return {
        success: Boolean(cancelled),
      };
    }
  );

  ipcMain.handle(
    "models:getHuggingFaceFileMetadata",
    async (_event, payload = {}) => {
      try {
        const repoId = String(payload?.repoId || "").trim();
        const fileName = String(payload?.fileName || "").trim();

        if (!repoId || !fileName) {
          return { success: false, error: "Repository and file name are required." };
        }

        const sizeBytes = await fetchFileSize(
          getHuggingFaceFileUrl(repoId, fileName),
          15000
        );

        return {
          success: Boolean(sizeBytes),
          sizeBytes,
          error: sizeBytes ? undefined : "File size is unavailable from the model host.",
        };
      } catch (error) {
        return {
          success: false,
          sizeBytes: null,
          error: error?.message || "Unable to resolve model file size.",
        };
      }
    }
  );

  ipcMain.handle(
    "models:downloadHuggingFace",
    async (
      _event,
      payload = {}
    ) => {
      try {
        const repoId = String(payload?.repoId || "").trim();
        const fileName = String(payload?.fileName || "").trim();
        const rawDownloadUrl = String(payload?.downloadUrl || payload?.url || payload?.fileUrl || "").trim();

        if (!repoId && !rawDownloadUrl) {
          return {
            success: false,
            error: "Repository and file name are required.",
          };
        }

        const downloadUrl = rawDownloadUrl || getDownloadUrl(repoId, fileName);
        const safeFileName = path.basename(fileName || rawDownloadUrl.split("/").pop() || "model.gguf");

        if (!safeFileName) {
          return {
            success: false,
            error: "Invalid destination model file name.",
          };
        }

        if (!ensureModelsDirectory()) {
          return {
            success: false,
            error: "Unable to access the models directory.",
          };
        }

        const destinationPath = getModelPath(safeFileName);
        const partialPath = `${destinationPath}.part`;

        if (activeDownload) {
          return {
            success: false,
            error: "Another model download is already active.",
          };
        }

        if (
          fs.existsSync(destinationPath) &&
          fs.statSync(destinationPath).size > 0
        ) {
          const existingSettings = readSettings();
          const existingModel = Array.isArray(existingSettings.availableModels)
            ? existingSettings.availableModels.find(
                (model) =>
                  model &&
                  (model.fileName === safeFileName || model.id === getModelIdFromFileName(safeFileName))
              )
            : null;

          if (existingModel) {
            return {
              success: true,
              message: "Model already exists in your local library.",
              model: existingModel,
              path: destinationPath,
              fileName: safeFileName,
              modelId: getModelIdFromFileName(safeFileName),
            };
          }
        }

        const resumeBytes = fs.existsSync(partialPath)
          ? fs.statSync(partialPath).size
          : 0;

        const downloadResult = await downloadFileFromUrl(downloadUrl, partialPath, (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("models:download-progress", {
              ...progress,
              repoId,
              fileName: safeFileName,
            });
          }
        }, resumeBytes);

        if (downloadResult?.paused) {
          return {
            success: true,
            paused: true,
            message: "Download paused. Resume when you are ready.",
            fileName: safeFileName,
          };
        }

        if (downloadResult?.cancelled) {
          try {
            if (fs.existsSync(partialPath)) {
              fs.rmSync(partialPath, { force: true });
            }
            if (fs.existsSync(destinationPath)) {
              fs.rmSync(destinationPath, { force: true });
            }
          } catch (cleanupError) {
            console.warn(
              "[Models] Cancelled download cleanup failed:",
              cleanupError
            );
          }

          return {
            success: true,
            cancelled: true,
            message: "Download cancelled and partial data removed.",
            fileName: safeFileName,
          };
        }

        fs.renameSync(partialPath, destinationPath);

        const finalStats = fs.statSync(destinationPath);
        const settings = readSettings();
        const modelId = getModelIdFromFileName(safeFileName);
        const modelInfo = createAvailableModelInfo(
          safeFileName,
          new Date().toISOString()
        );

        updateAvailableModel(settings, modelInfo);
        persistModelSettings(settings, appSettings);

        return {
          success: true,
          message: "Model downloaded successfully.",
          fileName: safeFileName,
          path: destinationPath,
          modelId,
          sizeBytes: finalStats.size,
          size: formatFileSize(finalStats.size),
          model: {
            ...modelInfo,
            path: destinationPath,
            sizeBytes: finalStats.size,
            size: formatFileSize(finalStats.size),
            ready: true,
            object: "model",
            owned_by: "local",
            name: modelId,
            type: "local",
          },
        };
      } catch (error) {
        console.error(
          "[Models] Hugging Face model download failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Failed to download model from Hugging Face.",
        };
      }
    }
  );

  /*
   * ==========================================================================
   * DELETE MODEL
   * ==========================================================================
   *
   * This is the important deletion fix.
   *
   * It:
   *
   * - Deletes the physical model file.
   * - Removes the model from availableModels.
   * - Removes remote models from remoteModels.
   * - If the deleted model was active:
   *     - selects another model if available;
   *     - otherwise sets activeModel to null.
   * - Synchronizes appSettings.
   * - DOES NOT call the old strict saveSettings() validator.
   * ==========================================================================
   */

  ipcMain.handle(
    "models:delete",
    async (
      _event,
      modelId,
      modelType = "local"
    ) => {
      try {
        if (
          typeof modelId !==
            "string" ||
          !modelId.trim()
        ) {
          return {
            success: false,
            error:
              "Model ID is required.",
          };
        }

        const normalizedModelId =
          modelId.trim();

        const settings =
          readSettings();

        if (
          modelType ===
          "local"
        ) {
          if (
            isProtectedDefaultModel(
              normalizedModelId,
              normalizedModelId
            )
          ) {
            return {
              success: false,
              error:
                "The built-in OffyAI model cannot be deleted.",
            };
          }

          const localModel =
            findLocalModel(
              normalizedModelId
            );

          if (!localModel) {
            return {
              success: false,
              error:
                "Local model file was not found.",
            };
          }

          const modelFile =
            sanitizeFileName(
              localModel.fileName
            );

          if (!modelFile) {
            return {
              success: false,
              error:
                "Invalid local model filename.",
            };
          }

          const filePath =
            getModelPath(
              modelFile
            );

          if (
            !isPathInsideDirectory(
              filePath,
              MODELS_DIR
            )
          ) {
            return {
              success: false,
              error:
                "Invalid model path.",
            };
          }

          const wasActive =
            settings.activeModel &&
            settings.activeModel.id ===
              normalizedModelId;

          if (
            wasActive
          ) {
            if (
              typeof serverLifecycle.stop ===
              "function"
            ) {
              await serverLifecycle.stop();
            }
          }

          if (
            fs.existsSync(
              filePath
            )
          ) {
            fs.unlinkSync(
              filePath
            );
          }

          removeAvailableModel(
            settings,
            normalizedModelId
          );

          if (
            wasActive
          ) {
            const replacement =
              selectReplacementActiveModel(
                settings,
                normalizedModelId
              );

            settings.model =
              replacement.model;

            settings.activeModel =
              replacement.activeModel;
          }

          /*
           * Remove stale available-model entries even if the file
           * was not represented in settings.availableModels.
           */
          if (
            Array.isArray(
              settings.availableModels
            )
          ) {
            settings.availableModels =
              settings.availableModels.filter(
                (model) =>
                  !model ||
                  model.id !==
                    normalizedModelId
              );
          }

          persistModelSettings(
            settings,
            appSettings
          );

          if (
            wasActive &&
            typeof serverLifecycle.restart ===
            "function"
          ) {
            await serverLifecycle.restart();
          }

          return {
            success: true,
            message:
              "Model deleted successfully.",
            deletedModelId:
              normalizedModelId,
            activeModel:
              settings.activeModel ||
              null,
            model:
              settings.model ||
              "",
          };
        }

        if (
          modelType ===
          "remote"
        ) {
          const remoteModels =
            Array.isArray(
              settings.remoteModels
            )
              ? settings.remoteModels
              : [];

          const existed =
            remoteModels.some(
              (model) =>
                model &&
                model.id ===
                  normalizedModelId
            );

          if (!existed) {
            return {
              success: false,
              error:
                "Remote model was not found.",
            };
          }

          settings.remoteModels =
            remoteModels.filter(
              (model) =>
                !model ||
                model.id !==
                  normalizedModelId
            );

          const wasActive =
            settings.activeModel &&
            settings.activeModel.id ===
              normalizedModelId;

          if (
            wasActive
          ) {
            const replacement =
              selectReplacementActiveModel(
                settings,
                normalizedModelId
              );

            settings.model =
              replacement.model;

            settings.activeModel =
              replacement.activeModel;
          }

          persistModelSettings(
            settings,
            appSettings
          );

          if (
            wasActive &&
            typeof serverLifecycle.restart ===
            "function"
          ) {
            await serverLifecycle.restart();
          }

          return {
            success: true,
            message:
              "Remote model removed successfully.",
            deletedModelId:
              normalizedModelId,
            activeModel:
              settings.activeModel ||
              null,
            model:
              settings.model ||
              "",
          };
        }

        return {
          success: false,
          error:
            `Unsupported model type: ${modelType}`,
        };
      } catch (error) {
        console.error(
          "[Models] Delete model failed:",
          error
        );

        return {
          success: false,
          error:
            error?.message ||
            "Failed to delete model.",
        };
      }
    }
  );
}

/*
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

module.exports = {
  setupModelsHandlers,
  getLocalModels,
  getRemoteModels,
  findModelFile,
};