import axios from "axios";

/**
 * OffyAI API Layer
 *
 * Architecture:
 *
 * Electron:
 *   Renderer -> preload -> IPC -> main.js
 *
 * Web fallback:
 *   Renderer -> HTTP API
 *
 * IMPORTANT:
 * Electron does NOT depend on localhost:3001.
 * IPC is always preferred when available.
 */

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const DEFAULT_WEB_API_URL = "http://localhost:3001";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  DEFAULT_WEB_API_URL;

const HAS_WEB_API = Boolean(
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL
);

/* -------------------------------------------------------------------------- */
/* Environment helpers                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Safely determine whether the application is running inside Electron.
 */
const isElectron = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    window.electronAPI &&
    typeof window.electronAPI === "object"
  );
};

/**
 * Safely get the Electron API.
 */
const getElectronAPI = () => {
  if (!isElectron()) {
    return null;
  }

  return window.electronAPI;
};

/**
 * Check whether a specific Electron IPC method exists.
 */
const hasElectronMethod = (methodName) => {
  const electronAPI = getElectronAPI();

  return Boolean(
    electronAPI &&
    typeof electronAPI[methodName] === "function"
  );
};

/**
 * Execute an Electron IPC method.
 *
 * This wrapper prevents a missing preload method from crashing the
 * renderer with "undefined is not a function".
 */
const callElectron = async (methodName, ...args) => {
  if (!hasElectronMethod(methodName)) {
    throw new Error(
      `Electron IPC method "${methodName}" is not available.`
    );
  }

  return await window.electronAPI[methodName](...args);
};

/* -------------------------------------------------------------------------- */
/* HTTP client                                                               */
/* -------------------------------------------------------------------------- */

/**
 * HTTP is only a fallback for the web version.
 *
 * Electron should normally never reach this client.
 */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* -------------------------------------------------------------------------- */
/* Axios interceptors                                                        */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `HTTP request: ${config.method?.toUpperCase() || "GET"} ${config.url}`
      );
    }

    return config;
  },
  (error) => {
    console.error("HTTP request error:", error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `HTTP response: ${response.status} ${response.config?.url || ""}`
      );
    }

    return response;
  },
  (error) => {
    const status = error?.response?.status;

    if (error?.code === "ECONNREFUSED") {
      error.message =
        "The optional web API is not running.";
    } else if (status === 404) {
      error.message =
        "The requested API endpoint was not found.";
    } else if (status >= 500) {
      error.message =
        "The API returned a server error.";
    } else if (
      error?.code === "ECONNABORTED" ||
      error?.message?.toLowerCase().includes("timeout")
    ) {
      error.message =
        "The request timed out.";
    }

    console.error(
      "HTTP response error:",
      status || "unknown",
      error.message
    );

    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/* Utility functions                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Normalize an IPC result.
 *
 * Some Electron handlers may return:
 *
 *   { success: true, data: ... }
 *
 * while others may directly return:
 *
 *   [...]
 *
 * This function intentionally preserves direct results.
 */
const unwrapResult = (result) => {
  if (
    result &&
    typeof result === "object" &&
    result.success === true &&
    Object.prototype.hasOwnProperty.call(result, "data")
  ) {
    return result.data;
  }

  return result;
};

/**
 * Create a useful fallback metrics object.
 *
 * This is deliberately deterministic rather than generating fake random
 * hardware statistics.
 */
const createFallbackMetrics = () => ({
  cpu: 0,
  memory: 0,
  gpu: 0,
  gpuAvailable: false,
  tokensPerSecond: 0,
  responseTimeMs: 0,
  tokensGenerated: 0,
  contextLength: 0,
  model: "unknown",
  modelName: "Unknown Model",
  sessionId: null,
  timestamp: new Date().toISOString(),
});

/* -------------------------------------------------------------------------- */
/* Chat API                                                                  */
/* -------------------------------------------------------------------------- */

export const chatAPI = {
  /**
   * Send a chat message.
   *
   * Electron:
   *   Uses main.js through IPC.
   *
   * Web:
   *   Uses the legacy HTTP streaming endpoint.
   */
  async sendMessage(
    message,
    model = "default",
    attachments = [],
    sessionId = null,
    options = {}
  ) {
    /* ---------------------------- Electron -------------------------------- */

    if (hasElectronMethod("sendChatMessage")) {
      return await callElectron(
        "sendChatMessage",
        message,
        {
          model,
          attachments,
          sessionId,
          ...options,
        }
      );
    }

    /* ----------------------------- Web ------------------------------------ */

    try {
      const formData = new FormData();

      formData.append(
        "message",
        message == null ? "" : String(message)
      );

      formData.append(
        "model",
        model == null ? "default" : String(model)
      );

      formData.append(
        "sessionId",
        sessionId || "default-session"
      );

      formData.append(
        "temperature",
        String(
          options.temperature !== undefined
            ? options.temperature
            : 0.7
        )
      );

      formData.append(
        "top_p",
        String(
          options.top_p !== undefined
            ? options.top_p
            : 0.9
        )
      );

      formData.append(
        "top_k",
        String(
          options.top_k !== undefined
            ? options.top_k
            : 40
        )
      );

      formData.append(
        "max_tokens",
        String(
          options.max_tokens !== undefined
            ? options.max_tokens
            : 4000
        )
      );

      if (Array.isArray(options.messages)) {
        formData.append(
          "messages",
          JSON.stringify(options.messages)
        );
      }

      if (options.systemPrompt) {
        formData.append(
          "systemPrompt",
          String(options.systemPrompt)
        );
      }

      if (Array.isArray(attachments)) {
        attachments.forEach((file) => {
          if (file) {
            formData.append("attachments", file);
          }
        });
      }

      const response = await fetch(
        `${BASE_URL}/api/chat/stream`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `HTTP ${response.status}: ${
            errorText || response.statusText
          }`
        );
      }

      if (!response.body) {
        throw new Error(
          "The server returned an empty response stream."
        );
      }

      return response.body;
    } catch (error) {
      console.error("Send message error:", error);
      throw error;
    }
  },

  /**
   * Get chat history.
   */
  async getHistory() {
    if (hasElectronMethod("getChatHistory")) {
      return unwrapResult(
        await callElectron("getChatHistory")
      );
    }

    try {
      const response = await api.get(
        "/api/chat/history"
      );

      return response.data;
    } catch (error) {
      console.error("Get history error:", error);
      throw error;
    }
  },

  /**
   * Clear chat history.
   */
  async clearHistory(sessionId = null) {
    if (hasElectronMethod("clearAllChatHistory")) {
      return unwrapResult(
        await callElectron("clearAllChatHistory")
      );
    }

    try {
      const url = sessionId
        ? `/api/chat/history/${encodeURIComponent(sessionId)}`
        : "/api/chat/history";

      const response = await api.delete(url);

      return response.data;
    } catch (error) {
      console.error("Clear history error:", error);
      throw error;
    }
  },

  /**
   * Stop an active generation.
   */
  async stopGeneration(
    sessionId,
    messageId
  ) {
    if (hasElectronMethod("stopGeneration")) {
      return unwrapResult(
        await callElectron(
          "stopGeneration",
          sessionId,
          messageId
        )
      );
    }

    try {
      const response = await api.post(
        "/api/chat/stop",
        {
          sessionId,
          messageId,
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Stop generation error:",
        error
      );

      throw error;
    }
  },

  /**
   * Get one chat session.
   */
  async getSession(sessionId) {
    if (hasElectronMethod("getChatSession")) {
      return unwrapResult(
        await callElectron(
          "getChatSession",
          sessionId
        )
      );
    }

    try {
      const response = await api.get(
        `/api/chat/session/${encodeURIComponent(sessionId)}`
      );

      return response.data;
    } catch (error) {
      console.error(
        "Get session error:",
        error
      );

      throw error;
    }
  },

  /**
   * Delete one chat session.
   */
  async deleteSession(sessionId) {
    if (hasElectronMethod("deleteChatSession")) {
      return unwrapResult(
        await callElectron(
          "deleteChatSession",
          sessionId
        )
      );
    }

    try {
      const response = await api.delete(
        `/api/chat/session/${encodeURIComponent(sessionId)}`
      );

      return response.data;
    } catch (error) {
      console.error(
        "Delete session error:",
        error
      );

      throw error;
    }
  },
};

/* -------------------------------------------------------------------------- */
/* Metrics API                                                               */
/* -------------------------------------------------------------------------- */

export const metricsAPI = {
  /**
   * Get real-time performance metrics.
   *
   * Electron/static mode:
   *   Renderer -> preload -> IPC -> main.js -> ResourceManager
   *
   * No Next.js API server is required.
   */
  async getMetrics(sessionId = null) {
    if (hasElectronMethod("getPerformanceMetrics")) {
      try {
        const result =
          await callElectron(
            "getPerformanceMetrics"
          );

        const data =
          unwrapResult(result);

        /*
         * ResourceManager returns:
         *
         * {
         *   system: {...},
         *   history: [...],
         *   timestamp: ...
         * }
         *
         * Preserve the complete object.
         */

        if (
          data &&
          typeof data === "object"
        ) {
          return {
            ...data,
            sessionId:
              data.sessionId ??
              sessionId ??
              null,
          };
        }

        return createFallbackMetrics();
      } catch (error) {
        console.error(
          "Electron performance metrics error:",
          error
        );

        return createFallbackMetrics();
      }
    }

    /*
     * Web fallback.
     *
     * This is retained only if the UI is intentionally
     * opened outside Electron.
     *
     * The Electron application never needs this path.
     */
    try {
      const params = sessionId
        ? { sessionId }
        : {};

      const response =
        await api.get(
          "/api/metrics/realtime",
          { params }
        );

      return response.data;
    } catch (error) {
      console.error(
        "Get metrics error:",
        error
      );

      return createFallbackMetrics();
    }
  },

  /**
   * Get AI/model connection status.
   */
  async getAIConnectionStatus() {
    if (hasElectronMethod("getAIStatus")) {
      try {
        return unwrapResult(
          await callElectron(
            "getAIStatus"
          )
        );
      } catch (error) {
        console.error(
          "Electron AI status error:",
          error
        );

        return {
          connected: false,
          models: [],
          error:
            error?.message ||
            String(error),
        };
      }
    }

    try {
      const response =
        await api.get(
          "/api/ai/status"
        );

      return response.data;
    } catch (error) {
      console.error(
        "Get AI status error:",
        error
      );

      return {
        connected: false,
        models: [],
        error:
          error?.message ||
          String(error),
      };
    }
  },
};


/* -------------------------------------------------------------------------- */
/* Models API                                                                */
/* -------------------------------------------------------------------------- */

export const modelsAPI = {
  /**
   * List available models.
   */
  async list() {
    if (hasElectronMethod("listModels")) {
      try {
        return unwrapResult(
          await callElectron("listModels")
        );
      } catch (error) {
        console.error(
          "Electron list models error:",
          error
        );

        return {
          data: [],
          models: [],
          error: error.message,
        };
      }
    }

    if (!isElectron() && !HAS_WEB_API) {
      return {
        data: [],
        models: [],
        error: "No web model service is configured.",
      };
    }

    try {
      const response = await api.get(
        "/api/models"
      );

      return response.data;
    } catch (error) {
      console.error(
        "List models error:",
        error
      );

      return {
        data: [],
        models: [],
        error: error.message,
      };
    }
  },

  /**
   * Set active model.
   */
  async setActive(
    modelId,
    modelType = "local",
    modelConfig = null
  ) {
    if (hasElectronMethod("activateModel")) {
      return unwrapResult(
        await callElectron(
          "activateModel",
          modelId,
          modelType,
          modelConfig
        )
      );
    }

    if (hasElectronMethod("setActiveModel")) {
      return unwrapResult(
        await callElectron(
          "setActiveModel",
          modelId,
          modelType,
          modelConfig
        )
      );
    }

    try {
      const response = await api.post(
        "/api/models/active",
        {
          modelId,
          modelType,
          modelConfig,
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Set active model error:",
        error
      );

      throw error;
    }
  },

  /**
   * Upload a model.
   *
   * Electron receives the local file path.
   */
  async uploadModel(file) {
    if (hasElectronMethod("uploadModel")) {
      const filePath =
        typeof file === "string"
          ? file
          : file?.path;

      if (!filePath) {
        throw new Error(
          "A valid model file path is required."
        );
      }

      return unwrapResult(
        await callElectron(
          "uploadModel",
          filePath
        )
      );
    }

    try {
      if (!file) {
        throw new Error(
          "A model file is required."
        );
      }

      const formData = new FormData();

      formData.append(
        "model",
        file
      );

      const response = await api.post(
        "/api/models/upload",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },

          timeout: 300000,

          onUploadProgress:
            (progressEvent) => {
              if (!progressEvent.total) {
                return;
              }

              const percentCompleted =
                Math.round(
                  (progressEvent.loaded * 100) /
                    progressEvent.total
                );

              console.log(
                `Model upload: ${percentCompleted}%`
              );
            },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Upload model error:",
        error
      );

      throw error;
    }
  },

  /**
   * Add a remote model.
   */
  async addRemoteModel(modelConfig) {
    if (hasElectronMethod("addRemoteModel")) {
      return unwrapResult(
        await callElectron(
          "addRemoteModel",
          modelConfig
        )
      );
    }

    try {
      const response = await api.post(
        "/api/models/remote",
        modelConfig
      );

      return response.data;
    } catch (error) {
      console.error(
        "Add remote model error:",
        error
      );

      throw error;
    }
  },

  async searchHuggingFaceModels(payload) {
    if (hasElectronMethod("searchHuggingFaceModels")) {
      return await callElectron(
        "searchHuggingFaceModels",
        payload
      );
    }

    try {
      const query = payload?.query || payload?.goal || "qwen gguf";
      const limit = Math.min(Number(payload?.limit || 12) || 12, 24);
      const response = await fetch(
        `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=${limit}&filter=gguf&expand[]=siblings`
      );

      if (!response.ok) {
        throw new Error("Unable to fetch Hugging Face recommendations.");
      }

      const data = await response.json();
      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error(
        "Search Hugging Face model error:",
        error
      );

      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  },

  async searchModelCatalog(payload) {
    if (hasElectronMethod("searchModelCatalog")) {
      return await callElectron(
        "searchModelCatalog",
        payload
      );
    }

    try {
      const query = payload?.query || payload?.goal || "qwen gguf";
      const limit = Math.min(Number(payload?.limit || 12) || 12, 24);
      const requests = [
        fetch(
          `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=${limit}&filter=gguf&expand[]=siblings`
        ).then(async (response) => {
          if (!response.ok) {
            throw new Error("Hugging Face fetch failed");
          }
          const data = await response.json();
          return {
            source: "huggingface",
            data: Array.isArray(data) ? data : [],
          };
        }),
        fetch(
          `https://modelscope.cn/api/v1/models?search=${encodeURIComponent(query)}&limit=${limit}&type=llm`
        ).then(async (response) => {
          if (!response.ok) {
            throw new Error("ModelScope fetch failed");
          }
          const data = await response.json();
          const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
          return {
            source: "modelscope",
            data: items,
          };
        }),
      ];

      const results = await Promise.allSettled(requests);
      const merged = [];

      for (const result of results) {
        if (result.status !== "fulfilled") {
          continue;
        }

        const source = result.value.source;
        const items = Array.isArray(result.value.data) ? result.value.data : [];

        for (const item of items) {
          const id = String(item?.id || item?.model_id || item?.name || "").trim();
          if (!id) {
            continue;
          }

          merged.push({
            ...item,
            source,
            id,
            name: item?.name || item?.display_name || item?.model_name || id.split("/").pop() || "Unknown model",
            repoUrl: item?.repoUrl || item?.url || item?.html_url || item?.web_url || item?.model_url || item?.cardData?.repoUrl || "",
            downloadUrl: item?.downloadUrl || item?.download_url || item?.files?.[0]?.download_url || item?.file_url || item?.url || "",
            tags: Array.isArray(item?.tags) ? item.tags : Array.isArray(item?.tag) ? item.tag : [],
            downloads: Number(item?.downloads || item?.download_count || item?.stats?.downloads || 0),
            likes: Number(item?.likes || item?.star_count || item?.stars || item?.stats?.likes || 0),
            summary: item?.summary || item?.description || item?.cardData?.description || "",
            modelId: item?.modelId || item?.model_id || id,
            recommendedFile: item?.recommendedFile || item?.fileName || item?.model_name || "",
          });
        }
      }

      return {
        success: true,
        data: merged.slice(0, limit * 2),
      };
    } catch (error) {
      console.error("Search model catalog error:", error);
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  },

  async downloadHuggingFaceModel(payload) {
    if (hasElectronMethod("downloadHuggingFaceModel")) {
      return unwrapResult(
        await callElectron(
          "downloadHuggingFaceModel",
          payload
        )
      );
    }

    throw new Error(
      "Direct Hugging Face downloads are not supported in the web fallback."
    );
  },

  /**
   * Delete a model.
   */
  async deleteModel(
    modelId,
    modelType
  ) {
    if (hasElectronMethod("deleteModel")) {
      return unwrapResult(
        await callElectron(
          "deleteModel",
          modelId,
          modelType
        )
      );
    }

    try {
      const response = await api.delete(
        `/api/models/${encodeURIComponent(modelId)}`,
        {
          data: {
            modelType,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Delete model error:",
        error
      );

      throw error;
    }
  },
};

/* -------------------------------------------------------------------------- */
/* System API                                                                */
/* -------------------------------------------------------------------------- */

export const systemAPI = {
  /**
   * Get system information.
   */
  async getInfo() {
    /*
     * IMPORTANT:
     *
     * The previous implementation ALWAYS called:
     *
     *   localhost:3001/api/system/info
     *
     * even inside Electron.
     *
     * That is now fixed.
     */

    if (hasElectronMethod("getSystemInfo")) {
      return unwrapResult(
        await callElectron(
          "getSystemInfo"
        )
      );
    }

    /*
     * Some existing preload implementations may expose
     * getInfo instead of getSystemInfo.
     */
    if (hasElectronMethod("getInfo")) {
      return unwrapResult(
        await callElectron("getInfo")
      );
    }

    try {
      const response = await api.get(
        "/api/system/info"
      );

      return response.data;
    } catch (error) {
      console.error(
        "Get system info error:",
        error
      );

      throw error;
    }
  },

  /**
   * Health check.
   *
   * This is NOT used for Electron startup.
   */
  async healthCheck() {
    if (hasElectronMethod("healthCheck")) {
      try {
        return unwrapResult(
          await callElectron("healthCheck")
        );
      } catch (error) {
        console.warn(
          "Electron health check unavailable:",
          error.message
        );
      }
    }

    /*
     * For Electron, reaching this point means there is no
     * dedicated health-check IPC method.
     *
     * Do NOT automatically assume that localhost:3001 exists.
     */
    if (isElectron()) {
      return {
        ok: true,
        electron: true,
        backend: false,
        message:
          "Electron main process is active. No HTTP backend is required.",
      };
    }

    if (!HAS_WEB_API) {
      return {
      ok: false,
      electron: false,
      backend: false,
      message: "No web API is configured.",
      };
    }

    try {
      const response = await api.get(
        "/health"
      );

      return response.data;
    } catch (error) {
      console.error(
        "Health check error:",
        error
      );

      throw error;
    }
  },

  /**
   * Get application/server status.
   *
   * In Electron this is supplied by main.js.
   */
  async getServerStatus() {
    if (hasElectronMethod("getServerStatus")) {
      try {
        return unwrapResult(
          await callElectron(
            "getServerStatus"
          )
        );
      } catch (error) {
        console.error(
          "Electron server status error:",
          error
        );

        return {
          backend: false,
          llama: false,
          electron: true,
          error: error.message,
        };
      }
    }

    /*
     * No HTTP backend is required by Electron.
     */
    if (isElectron()) {
      return {
        backend: false,
        llama: false,
        electron: true,
        backendUrl: null,
        llamaUrl: null,
        message:
          "Application services are managed by main.js.",
      };
    }

    if (!HAS_WEB_API) {
      return {
        backend: false,
        llama: false,
        electron: false,
        backendUrl: null,
        llamaUrl: null,
        message: "No web API is configured.",
      };
    }

    try {
      const response = await api.get(
        "/health"
      );

      return {
        backend: response.status === 200,
        llama: false,
        electron: false,
        backendUrl: BASE_URL,
        llamaUrl: null,
      };
    } catch (error) {
      console.error(
        "Get server status error:",
        error
      );

      return {
        backend: false,
        llama: false,
        electron: false,
        backendUrl: BASE_URL,
        llamaUrl: null,
        error: error.message,
      };
    }
  },
};

/* -------------------------------------------------------------------------- */
/* Connection testing                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Test application connectivity.
 *
 * Electron:
 *   No localhost:3001 request.
 *   IPC availability itself is sufficient.
 *
 * Web:
 *   Tests the optional HTTP API.
 */
export const testBackendConnection =
  async () => {
    /* Electron does not require a backend. */

    if (isElectron()) {
      return true;
    }

    if (!HAS_WEB_API) {
      return false;
    }

    try {
      const response = await fetch(
        `${BASE_URL}/health`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      return response.ok;
    } catch (error) {
      console.warn(
        "Optional web API connection test failed:",
        error.message
      );

      return false;
    }
  };

/* -------------------------------------------------------------------------- */
/* AI stream processor                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Process a Server-Sent Events style response stream.
 *
 * This remains available for the web fallback.
 *
 * Electron IPC chat implementations may return a different
 * structure and should be handled by the corresponding
 * renderer chat logic.
 */
export const processAIStream = async (
  body,
  onContent,
  onDone,
  onError
) => {
  if (!body) {
    const error = new Error(
      "AI stream response is empty."
    );

    if (onError) {
      onError(error);
    }

    return;
  }

  if (
    typeof body.getReader !== "function"
  ) {
    const error = new Error(
      "AI response does not provide a readable stream."
    );

    if (onError) {
      onError(error);
    }

    return;
  }

  const reader = body.getReader();

  const decoder = new TextDecoder(
    "utf-8"
  );

  let buffer = "";

  let completed = false;

  const safelyCallDone = (
    content,
    messageId,
    metrics
  ) => {
    if (completed) {
      return;
    }

    completed = true;

    if (typeof onDone === "function") {
      onDone(
        content,
        messageId,
        metrics
      );
    }
  };

  try {
    while (true) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        /*
         * Flush any remaining decoder data.
         */
        buffer += decoder.decode(
          new Uint8Array(),
          {
            stream: false,
          }
        );

        /*
         * Process a final line if present.
         */
        if (buffer.trim()) {
          processStreamLine(
            buffer,
            onContent,
            safelyCallDone
          );
        }

        break;
      }

      buffer += decoder.decode(
        value,
        {
          stream: true,
        }
      );

      const lines =
        buffer.split(/\r?\n/);

      buffer =
        lines.pop() || "";

      for (const line of lines) {
        processStreamLine(
          line,
          onContent,
          safelyCallDone
        );

        if (completed) {
          return;
        }
      }
    }
  } catch (error) {
    console.error(
      "Stream processing error:",
      error
    );

    if (
      typeof onError === "function"
    ) {
      onError(error);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader may already have been released.
    }
  }
};

/**
 * Process one SSE line.
 */
function processStreamLine(
  line,
  onContent,
  onDone
) {
  const trimmed =
    line.trim();

  if (!trimmed) {
    return;
  }

  /*
   * Ignore SSE comments.
   */
  if (trimmed.startsWith(":")) {
    return;
  }

  if (
    !trimmed.startsWith("data:")
  ) {
    return;
  }

  const payload =
    trimmed
      .slice(5)
      .trim();

  if (!payload) {
    return;
  }

  if (
    payload === "[DONE]"
  ) {
    onDone();
    return;
  }

  let data;

  try {
    data =
      JSON.parse(payload);
  } catch (error) {
    console.warn(
      "Unable to parse AI stream event:",
      payload,
      error
    );

    return;
  }

  switch (data.type) {
    case "connected":
      if (
        process.env.NODE_ENV !==
        "production"
      ) {
        console.log(
          "AI stream connected."
        );
      }
      break;

    case "start":
      if (
        process.env.NODE_ENV !==
        "production"
      ) {
        console.log(
          "AI generation started."
        );
      }
      break;

    case "content":
      if (
        data.content &&
        typeof onContent ===
          "function"
      ) {
        onContent(
          data.content,
          data.messageId
        );
      }
      break;

    case "done":
      onDone(
        data.content,
        data.messageId,
        data.metrics
      );
      break;

    case "error": {
      const error =
        new Error(
          data.error ||
            "AI generation failed."
        );

      throw error;
    }

    default:
      console.warn(
        "Unknown AI stream event:",
        data.type
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Diagnostics                                                                */
/* -------------------------------------------------------------------------- */

export const appAPI = {
  /**
   * Determine whether IPC is available.
   */
  isElectron,

  /**
   * Determine whether a particular IPC method exists.
   */
  hasElectronMethod,

  /**
   * Return the active transport.
   */
  getTransport() {
    return isElectron()
      ? "ipc"
      : "http";
  },

  /**
   * Return the HTTP fallback URL.
   */
  getBaseURL() {
    return BASE_URL;
  },

  /**
   * Return basic runtime diagnostics.
   */
  getDiagnostics() {
    const electronAPI =
      getElectronAPI();

    return {
      electron: isElectron(),
      transport:
        isElectron()
          ? "ipc"
          : "http",
      httpBaseURL: BASE_URL,
      electronMethods:
        electronAPI
          ? Object.keys(
              electronAPI
            )
          : [],
    };
  },
};

/* -------------------------------------------------------------------------- */
/* Default export                                                            */
/* -------------------------------------------------------------------------- */

export default api;