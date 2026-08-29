"use strict";

const { app, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
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

        settings.activeModel =
          modelData;

        settings.model =
          modelId;

        persistModelSettings(
          settings,
          appSettings
        );

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