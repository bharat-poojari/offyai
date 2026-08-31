"use strict";

const { app, ipcMain } = require("electron");
const axios = require("axios");
const si = require("systeminformation");
const fs = require("fs");
const path = require("path");

const LLAMA_SERVER_URL = "http://localhost:8080";
const SETTINGS_FILE =
  app && typeof app.getPath === "function"
    ? path.join(app.getPath("userData"), "settings.json")
    : path.join(__dirname, "../../settings.json");

/* ============================================================================
 * SETTINGS / MODEL
 * ========================================================================== */

function getActiveModelFromSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return null;
    }

    const settings = JSON.parse(
      fs.readFileSync(SETTINGS_FILE, "utf8")
    );

    if (
      settings &&
      settings.activeModel &&
      typeof settings.activeModel === "object"
    ) {
      const model = settings.activeModel;

      return {
        model:
          model.id ||
          model.name ||
          model.fileName ||
          null,

        modelName:
          model.name ||
          model.id ||
          model.fileName ||
          null,
      };
    }

    if (
      settings &&
      typeof settings.model === "string" &&
      settings.model.trim()
    ) {
      return {
        model: settings.model,
        modelName: settings.model,
      };
    }
  } catch (error) {
    console.error(
      "[Metrics] Failed to read active model from settings:",
      error
    );
  }

  return null;
}

function normalizeModelName(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  return value
    .split(/[\\/]/)
    .pop()
    .replace(/\.(gguf|bin|ggml)$/i, "")
    .trim();
}

async function fetchServerModel() {
  try {
    const response = await axios.get(
      `${LLAMA_SERVER_URL}/v1/models`,
      {
        timeout: 1500,
      }
    );

    const models = response?.data?.data;

    if (
      Array.isArray(models) &&
      models.length > 0
    ) {
      const model = models[0];

      const modelId =
        model?.id ||
        model?.name ||
        null;

      if (modelId) {
        return {
          model: modelId,
          modelName: normalizeModelName(modelId),
        };
      }
    }
  } catch (error) {
    // Server model information is optional.
    // Settings remain the authoritative fallback.
  }

  return null;
}

async function getModelInfo() {
  /*
   * The active model in application settings is authoritative because
   * it represents the model selected by the application.
   */
  const settingsModel =
    getActiveModelFromSettings();

  if (settingsModel) {
    return {
      model:
        settingsModel.model,
      modelName:
        normalizeModelName(
          settingsModel.modelName ||
          settingsModel.model
        ),
    };
  }

  /*
   * If settings are unavailable, use the actual model exposed
   * by the running OpenAI-compatible server.
   */
  const serverModel =
    await fetchServerModel();

  if (serverModel) {
    return serverModel;
  }

  return {
    model: null,
    modelName: null,
  };
}

/* ============================================================================
 * NUMBER HELPERS
 * ========================================================================== */

function finiteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function rounded(value, decimals = 1) {
  const number = finiteNumber(value);

  if (number === null) {
    return null;
  }

  return Number(
    number.toFixed(decimals)
  );
}

/* ============================================================================
 * CPU
 * ========================================================================== */

async function getCpuUsage() {
  try {
    const load =
      await si.currentLoad();

    return rounded(
      load?.currentLoad
    );
  } catch (error) {
    console.error(
      "[Metrics] CPU usage error:",
      error?.message || error
    );

    return null;
  }
}

/* ============================================================================
 * MEMORY
 * ========================================================================== */

async function getMemoryUsage() {
  try {
    const memory =
      await si.mem();

    if (
      !memory ||
      !Number.isFinite(memory.total) ||
      memory.total <= 0 ||
      !Number.isFinite(memory.available)
    ) {
      return null;
    }

    const used =
      memory.total -
      memory.available;

    const usage =
      (used / memory.total) * 100;

    return rounded(usage);
  } catch (error) {
    console.error(
      "[Metrics] Memory usage error:",
      error?.message || error
    );

    return null;
  }
}

/* ============================================================================
 * GPU
 * ========================================================================== */

async function getGpuMetrics() {
  try {
    const graphics =
      await si.graphics();

    const controllers =
      Array.isArray(graphics?.controllers)
        ? graphics.controllers
        : [];

    if (controllers.length === 0) {
      return {
        available: false,
        usage: null,
        temperature: null,
        model: null,
      };
    }

    /*
     * Use the first controller exposed by systeminformation.
     * This matches the application's existing GPU implementation.
     */
    const gpu =
      controllers[0];

    const usage =
      finiteNumber(
        gpu?.utilizationGpu
      );

    const temperature =
      finiteNumber(
        gpu?.temperatureGpu
      );

    return {
      available: true,
      usage:
        usage === null
          ? null
          : rounded(usage),

      temperature:
        temperature === null
          ? null
          : rounded(temperature),

      model:
        typeof gpu?.model === "string" &&
        gpu.model.trim()
          ? gpu.model.trim()
          : null,
    };
  } catch (error) {
    console.error(
      "[Metrics] GPU metrics error:",
      error?.message || error
    );

    return {
      available: false,
      usage: null,
      temperature: null,
      model: null,
    };
  }
}

/* ============================================================================
 * CPU TEMPERATURE
 * ========================================================================== */

async function getCpuTemperature() {
  try {
    const temperature =
      await si.cpuTemperature();

    const main =
      finiteNumber(
        temperature?.main
      );

    return main === null
      ? null
      : rounded(main);
  } catch (error) {
    /*
     * CPU temperature is not available on every platform.
     * Returning null is intentional and means "not provided".
     */
    return null;
  }
}

async function getHardwareProfile() {
  try {
    const [cpu, memory, os] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
    ]);

    return {
      cpu:
        typeof cpu?.brand === "string" && cpu.brand.trim()
          ? cpu.brand.trim()
          : null,
      memoryTotalBytes:
        Number.isFinite(Number(memory?.total)) && Number(memory.total) > 0
          ? Number(memory.total)
          : null,
      os:
        [os?.distro, os?.release].filter(Boolean).join(" ") || null,
    };
  } catch (error) {
    return {
      cpu: null,
      memoryTotalBytes: null,
      os: null,
    };
  }
}

/* ============================================================================
 * REAL-TIME METRICS
 * ========================================================================== */

async function collectRealtimeMetrics() {
  const [
    cpu,
    memory,
    gpu,
    temperature,
    modelInfo,
    hardware,
  ] = await Promise.all([
    getCpuUsage(),
    getMemoryUsage(),
    getGpuMetrics(),
    getCpuTemperature(),
    getModelInfo(),
    getHardwareProfile(),
  ]);

  return {
    cpu,
    memory,

    gpu:
      gpu.available
        ? gpu.usage
        : null,

    gpuAvailable:
      gpu.available,

    temperature,

    gpuTemperature:
      gpu.available
        ? gpu.temperature
        : null,

    gpuModel:
      gpu.available
        ? gpu.model
        : null,

    model:
      modelInfo.model,

    modelName:
      modelInfo.modelName,

    timestamp:
      new Date().toISOString(),

    system: {
      platform:
        process.platform,

      arch:
        process.arch,

      nodeVersion:
        process.version,

      uptime:
        process.uptime(),
      hardware,
    },
  };
}

/* ============================================================================
 * IPC HANDLERS
 * ========================================================================== */

function setupMetricsHandlers() {
  /*
   * Prevent duplicate handler registration when Electron reloads or
   * reinitializes the IPC layer.
   */
  try {
    ipcMain.removeHandler(
      "metrics:realtime"
    );
  } catch (error) {
    // No previous handler.
  }

  try {
    ipcMain.removeHandler(
      "ai:status"
    );
  } catch (error) {
    // No previous handler.
  }

  /* ------------------------------------------------------------------------
   * REAL-TIME SYSTEM METRICS
   * ---------------------------------------------------------------------- */

  ipcMain.handle(
    "metrics:realtime",
    async (_event, _sessionId) => {
      try {
        return await collectRealtimeMetrics();
      } catch (error) {
        console.error(
          "[Metrics] Realtime metrics error:",
          error?.message || error
        );

        /*
         * Do not manufacture zeros for failed measurements.
         * Null explicitly means the application could not obtain
         * that metric.
         */
        const modelInfo =
          getActiveModelFromSettings();

        return {
          cpu: null,
          memory: null,
          gpu: null,
          gpuAvailable: false,
          temperature: null,
          gpuTemperature: null,
          gpuModel: null,

          model:
            modelInfo?.model ||
            null,

          modelName:
            normalizeModelName(
              modelInfo?.modelName ||
              modelInfo?.model
            ),

          timestamp:
            new Date().toISOString(),

          system: {
            platform:
              process.platform,

            arch:
              process.arch,

            nodeVersion:
              process.version,

            uptime:
              process.uptime(),
          },
        };
      }
    }
  );

  /* ------------------------------------------------------------------------
   * AI SERVER STATUS
   * ---------------------------------------------------------------------- */

  ipcMain.handle(
    "ai:status",
    async () => {
      try {
        const response =
          await axios.get(
            `${LLAMA_SERVER_URL}/health`,
            {
              timeout: 5000,
            }
          );

        return {
          connected:
            response.status === 200,

          url:
            LLAMA_SERVER_URL,

          timestamp:
            new Date().toISOString(),
        };
      } catch (error) {
        return {
          connected: false,

          url:
            LLAMA_SERVER_URL,

          error:
            error?.message ||
            "Unable to connect to AI server.",

          timestamp:
            new Date().toISOString(),
        };
      }
    }
  );
}

module.exports = {
  setupMetricsHandlers,
};