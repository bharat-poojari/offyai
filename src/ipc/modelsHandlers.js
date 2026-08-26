const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const MODELS_DIR = path.join(__dirname, "../../models");
const SETTINGS_FILE = path.join(__dirname, "../../settings.json");
const LLAMA_SERVER_URL = "http://localhost:8080";

// Ensure models directory exists
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

function getLocalModels() {
  try {
    if (!fs.existsSync(MODELS_DIR)) return [];
    
    const files = fs.readdirSync(MODELS_DIR);
    const models = files
      .filter(file => [".gguf", ".bin", ".ggml"].includes(path.extname(file).toLowerCase()))
      .map(fileName => {
        const filePath = path.join(MODELS_DIR, fileName);
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        return {
          id: path.basename(fileName, path.extname(fileName)),
          fileName: fileName,
          object: "model",
          owned_by: "local",
          ready: true,
          type: "local",
          size: sizeMB + " MB",
          format: path.extname(fileName).toLowerCase().replace(".", ""),
          created: stats.birthtime.toISOString(),
          name: path.basename(fileName, path.extname(fileName)),
          path: filePath
        };
      });
    
    console.log(`📦 Found ${models.length} local models`);
    return models;
  } catch (error) {
    console.error("Error reading local models:", error);
    return [];
  }
}

async function getRemoteModels() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      return settings.remoteModels || [];
    }
    return [];
  } catch (error) {
    console.error("Error reading remote models:", error);
    return [];
  }
}

function findModelFile(modelId) {
  try {
    if (!fs.existsSync(MODELS_DIR)) return null;
    
    const files = fs.readdirSync(MODELS_DIR);
    const foundFile = files.find(file => 
      path.basename(file, path.extname(file)) === modelId
    );
    
    console.log(`🔍 Looking for model ${modelId}:`, foundFile || "Not found");
    return foundFile;
  } catch (error) {
    console.error("Error finding model file:", error);
    return null;
  }
}

function setupModelsHandlers(mainWindow, appSettings, saveSettings) {
  // List all models
  ipcMain.handle("models:list", async () => {
    try {
      console.log("📋 Fetching all models...");
      const localModels = getLocalModels();
      const remoteModels = await getRemoteModels();
      const allModels = [...localModels, ...remoteModels];
      
      console.log(`✅ Found ${allModels.length} total models`);
      return {
        object: "list",
        data: allModels
      };
    } catch (error) {
      console.error("❌ Error fetching models:", error);
      return { object: "list", data: [] };
    }
  });

  // Set active model
  ipcMain.handle("models:setActive", async (event, { modelId, modelType = "local", modelConfig }) => {
    try {
      console.log(`🎯 Setting active model:`, { modelId, modelType, modelConfig });
      
      if (!modelId) {
        return { success: false, error: "Model ID is required" };
      }
      
      let modelData = {};
      
      if (modelType === "local") {
        const modelFile = findModelFile(modelId);
        if (!modelFile) {
          return { success: false, error: "Model file not found" };
        }
        
        modelData = {
          id: modelId,
          fileName: modelFile,
          type: "local",
          name: modelId,
          path: path.join(MODELS_DIR, modelFile)
        };
        
        console.log(`✅ Local model configured: ${modelId}`);
        
      } else {
        // Remote model
        if (!modelConfig?.url) {
          return { success: false, error: "URL is required for remote models" };
        }
        
        modelData = {
          id: modelId,
          type: "remote",
          name: modelConfig?.name || modelId,
          url: modelConfig.url,
          apiKey: modelConfig.apiKey || "",
          config: modelConfig.config || {}
        };
        
        console.log(`✅ Remote model configured: ${modelId} at ${modelConfig.url}`);
      }
      
      // Update settings
      let settings = {};
      if (fs.existsSync(SETTINGS_FILE)) {
        settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      }
      
      settings.activeModel = modelData;
      settings.model = modelId;
      
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      
      console.log(`✅ Active model set to: ${modelId} (${modelType})`);
      
      // Update app settings if saveSettings is provided
      if (saveSettings) {
        saveSettings(settings);
      }
      
      return {
        success: true,
        message: `Model ${modelId} activated`,
        model: modelData
      };
      
    } catch (error) {
      console.error("❌ Error setting active model:", error);
      return { success: false, error: error.message };
    }
  });

  // Upload model
  ipcMain.handle("models:upload", async (event, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: "File not found" };
      }
      
      const fileName = path.basename(filePath);
      const ext = path.extname(fileName).toLowerCase();
      
      if (![".gguf", ".bin", ".ggml"].includes(ext)) {
        return { 
          success: false, 
          error: `Invalid file type. Only ${[".gguf", ".bin", ".ggml"].join(", ")} files are allowed.` 
        };
      }
      
      // Copy file to models directory
      const destPath = path.join(MODELS_DIR, fileName);
      fs.copyFileSync(filePath, destPath);
      
      const fileSizeGB = (fs.statSync(destPath).size / (1024 * 1024 * 1024)).toFixed(2);
      const modelId = path.basename(fileName, ext);
      
      // Update settings
      let settings = {};
      if (fs.existsSync(SETTINGS_FILE)) {
        settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      }
      
      settings.availableModels = settings.availableModels || [];
      
      const modelInfo = {
        id: modelId,
        fileName: fileName,
        size: fileSizeGB + " GB",
        uploadedAt: new Date().toISOString(),
        type: "local"
      };
      
      const existingIndex = settings.availableModels.findIndex(m => m.id === modelId);
      if (existingIndex >= 0) {
        settings.availableModels[existingIndex] = modelInfo;
      } else {
        settings.availableModels.push(modelInfo);
      }
      
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      
      console.log(`✅ Model uploaded: ${fileName} (${fileSizeGB} GB)`);
      
      return {
        success: true,
        message: "Model uploaded successfully",
        model: modelInfo
      };
      
    } catch (error) {
      console.error("❌ Model upload error:", error);
      return { success: false, error: error.message };
    }
  });

  // Add remote model
  ipcMain.handle("models:addRemote", async (event, modelConfig) => {
    try {
      const { name, url, apiKey, modelId, provider = "custom", config = {} } = modelConfig;
      
      console.log(`🌐 Adding remote model:`, { name, url, modelId, provider });
      
      if (!name || !url || !modelId) {
        return { success: false, error: "Name, URL, and modelId are required" };
      }
      
      const remoteModel = {
        id: modelId,
        name: name,
        url: url,
        apiKey: apiKey || "",
        provider: provider,
        type: "remote",
        config: config
      };
      
      // Update settings
      let settings = {};
      if (fs.existsSync(SETTINGS_FILE)) {
        settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      }
      
      settings.remoteModels = settings.remoteModels || [];
      
      const existingIndex = settings.remoteModels.findIndex(m => m.id === modelId);
      if (existingIndex >= 0) {
        settings.remoteModels[existingIndex] = remoteModel;
      } else {
        settings.remoteModels.push(remoteModel);
      }
      
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      
      console.log(`✅ Remote model added: ${name} (${modelId})`);
      
      // Update app settings if saveSettings is provided
      if (saveSettings) {
        saveSettings(settings);
      }
      
      return {
        success: true,
        message: "Remote model configured successfully",
        model: remoteModel
      };
      
    } catch (error) {
      console.error("❌ Error configuring remote model:", error);
      return { success: false, error: error.message };
    }
  });

  // Get specific model
  ipcMain.handle("models:get", async (event, modelId) => {
    try {
      console.log(`🔍 Fetching model: ${modelId}`);
      
      const localModels = getLocalModels();
      const remoteModels = await getRemoteModels();
      const allModels = [...localModels, ...remoteModels];
      
      const model = allModels.find(m => m.id === modelId);
      
      if (!model) {
        return { error: "Model not found" };
      }
      
      return model;
      
    } catch (error) {
      console.error("❌ Error fetching model:", error);
      return { error: "Failed to fetch model" };
    }
  });

  // Delete model
  ipcMain.handle("models:delete", async (event, modelId, modelType) => {
    try {
      if (modelType === "local") {
        const modelFile = findModelFile(modelId);
        if (!modelFile) {
          return { success: false, error: "Model file not found" };
        }
        
        const filePath = path.join(MODELS_DIR, modelFile);
        fs.unlinkSync(filePath);
        
        console.log(`✅ Local model deleted: ${modelId}`);
        
        return { success: true, message: "Model deleted successfully" };
      } else {
        // Remove from remote models in settings
        let settings = {};
        if (fs.existsSync(SETTINGS_FILE)) {
          settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
        }
        
        if (settings.remoteModels) {
          settings.remoteModels = settings.remoteModels.filter(m => m.id !== modelId);
          fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        }
        
        console.log(`✅ Remote model removed: ${modelId}`);
        
        return { success: true, message: "Remote model removed successfully" };
      }
      
    } catch (error) {
      console.error("❌ Error deleting model:", error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { setupModelsHandlers, getLocalModels, getRemoteModels };