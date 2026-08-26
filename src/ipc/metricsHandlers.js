const { ipcMain } = require("electron");
const axios = require("axios");
const si = require("systeminformation");
const fs = require("fs");
const path = require("path");

const LLAMA_SERVER_URL = "http://localhost:8080";
const SETTINGS_FILE = path.join(__dirname, "../../settings.json");

function getActiveModelFromSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      if (settings.activeModel) {
        return {
          model: settings.activeModel.id || settings.activeModel.name,
          modelName: settings.activeModel.name || settings.activeModel.id
        };
      } else if (settings.model) {
        return {
          model: settings.model,
          modelName: settings.model
        };
      }
    }
  } catch (error) {
    console.error("Error reading settings for active model:", error);
  }
  return null;
}

async function fetchModelInfo() {
  try {
    // Try llama.cpp /api/tags endpoint
    const response = await axios.get(`${LLAMA_SERVER_URL}/api/tags`, {
      timeout: 1500
    });
    if (response?.data?.models && response.data.models.length > 0) {
      const model = response.data.models[0];
      return {
        model: model.name || null,
        modelName: model.name ? model.name.split(/[\\/]/).pop().replace(".bin", "").replace(".gguf", "") : null
      };
    }
  } catch (e) {
    console.log("Llama /api/tags endpoint failed, trying alternatives...");
  }

  // Try OpenAI-compatible /v1/models endpoint
  try {
    const response = await axios.get(`${LLAMA_SERVER_URL}/v1/models`, {
      timeout: 1500
    });
    if (response?.data?.data && response.data.data.length > 0) {
      const model = response.data.data[0];
      const modelId = model.id || model.name || null;
      return {
        model: modelId,
        modelName: modelId ? modelId.split(/[\\/]/).pop().replace(".bin", "").replace(".gguf", "") : null
      };
    }
  } catch (e) {
    console.log("OpenAI /v1/models endpoint failed...");
  }

  // Try simple /model endpoint
  try {
    const response = await axios.get(`${LLAMA_SERVER_URL}/model`, {
      timeout: 1500
    });
    if (response?.data?.model) {
      const model = response.data.model;
      return {
        model: model,
        modelName: model ? model.split(/[\\/]/).pop().replace(".bin", "").replace(".gguf", "") : null
      };
    }
  } catch (e) {
    console.log("Simple /model endpoint failed");
  }

  // Fallback to settings
  const settingsModel = getActiveModelFromSettings();
  if (settingsModel) {
    console.log("Using model from settings:", settingsModel);
    return settingsModel;
  }

  return { model: null, modelName: null };
}

async function sampleCpuPercent(samples = 120) {
  try {
    const loads = [];
    for (let i = 0; i < Math.min(samples, 10); i++) {
      const load = await si.currentLoad();
      loads.push(load.currentLoad);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return loads.reduce((a, b) => a + b, 0) / loads.length;
  } catch (error) {
    console.error("Error sampling CPU:", error);
    return 0;
  }
}

async function getGpuUtilization() {
  try {
    const graphics = await si.graphics();
    if (graphics.controllers && graphics.controllers.length > 0) {
      const gpu = graphics.controllers[0];
      return {
        gpu: gpu.utilizationGpu || 0,
        available: true,
        model: gpu.model
      };
    }
    return { gpu: 0, available: false };
  } catch (error) {
    return { gpu: 0, available: false };
  }
}

function setupMetricsHandlers() {
  // Get real-time metrics
  ipcMain.handle("metrics:realtime", async (event, sessionId) => {
    try {
      const cpuLoad = await sampleCpuPercent(120);
      const memory = await si.mem();
      const graphics = await si.graphics().catch(() => ({ controllers: [] }));
      const temperature = await si.cpuTemperature().catch(() => ({ main: 0 }));
      const modelInfo = await fetchModelInfo();

      const memoryUsage = memory.total > 0 ? ((memory.total - memory.available) / memory.total * 100) : 0;

      let gpuUsage = 0;
      let gpuAvailable = false;
      let gpuTemperature = 0;

      if (graphics.controllers && graphics.controllers.length > 0) {
        gpuAvailable = true;
        const gpu = graphics.controllers[0];
        gpuUsage = gpu.utilizationGpu || 0;
        gpuTemperature = gpu.temperatureGpu || 0;
      }

      // Get model info with fallbacks
      let modelName = "Unknown Model";
      let modelId = "unknown";

      if (modelInfo.modelName && modelInfo.modelName !== "unknown") {
        modelName = modelInfo.modelName;
        modelId = modelInfo.model || "unknown";
      } else if (modelInfo.model && modelInfo.model !== "unknown") {
        modelName = modelInfo.model.split(/[\\/]/).pop().replace(".bin", "").replace(".gguf", "").replace(/-/g, " ");
        modelId = modelInfo.model;
      } else {
        const settingsModel = getActiveModelFromSettings();
        if (settingsModel) {
          modelName = settingsModel.modelName;
          modelId = settingsModel.model;
        }
      }

      // Format model name for display
      modelName = modelName
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .replace(/\.(gguf|bin|ggml)$/i, "");

      const metrics = {
        cpu: Math.round(10 * cpuLoad) / 10,
        memory: Math.round(10 * memoryUsage) / 10,
        gpu: Math.round(10 * gpuUsage) / 10,
        gpuAvailable: gpuAvailable,
        temperature: parseFloat(temperature.main?.toFixed(1) || "0"),
        gpuTemperature: parseFloat(gpuTemperature.toFixed(1)),
        tokensPerSecond: 0,
        responseTimeMs: 0,
        tokensGenerated: 0,
        contextLength: 0,
        model: modelId,
        modelName: modelName,
        sessionId: sessionId || null,
        timestamp: new Date().toISOString(),
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          uptime: process.uptime()
        }
      };

      return metrics;
    } catch (error) {
      console.error("❌ Metrics endpoint error:", error?.message || error);

      const settingsModel = getActiveModelFromSettings();
      const fallbackModel = settingsModel ? {
        model: settingsModel.model,
        modelName: settingsModel.modelName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      } : { model: "unknown", modelName: "Unknown Model" };

      return {
        cpu: 0,
        memory: 0,
        gpu: 0,
        gpuAvailable: false,
        temperature: 0,
        gpuTemperature: 0,
        tokensPerSecond: 0,
        responseTimeMs: 0,
        tokensGenerated: 0,
        contextLength: 0,
        ...fallbackModel,
        sessionId: null,
        timestamp: new Date().toISOString(),
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          uptime: process.uptime()
        }
      };
    }
  });

  // Get AI status
  ipcMain.handle("ai:status", async () => {
    try {
      const response = await axios.get(`${LLAMA_SERVER_URL}/health`, {
        timeout: 10000
      });

      return {
        connected: response.status === 200,
        url: LLAMA_SERVER_URL,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        url: LLAMA_SERVER_URL,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  });

  // Get system info
  ipcMain.handle("system:info", async () => {
    try {
      const [cpu, memory, currentLoad, graphics] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.currentLoad(),
        si.graphics().catch(() => ({ controllers: [] }))
      ]);

      let gpuInfo = { utilization: 0, available: false };

      if (graphics.controllers && graphics.controllers.length > 0) {
        gpuInfo = {
          utilization: graphics.controllers[0].utilizationGpu || 0,
          available: true,
          model: graphics.controllers[0].model
        };
      }

      return {
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          cores: cpu.cores,
          speed: cpu.speed,
          usage: currentLoad.currentLoad
        },
        memory: {
          total: memory.total,
          available: memory.available,
          used: memory.used,
          usage: (memory.used / memory.total * 100)
        },
        gpu: gpuInfo,
        platform: process.platform,
        arch: process.arch
      };
    } catch (error) {
      console.error("Error getting system info:", error);
      return { error: "Failed to get system information" };
    }
  });
}

module.exports = { setupMetricsHandlers };