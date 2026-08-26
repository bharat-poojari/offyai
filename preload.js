"use strict";

/*
 * ============================================================================
 * Preload script
 * ============================================================================
 *
 * NOTE: This file did not need a functional fix. `setActiveModel()` here
 * sends `{id, type, modelConfig}` without a top-level `path`, which used
 * to cause the renderer's model selection to be silently ignored (see
 * main.js's "set-active-model" handler). That's fixed on the main.js side
 * by resolving the path from the id when it's missing, so this API is
 * left as-is and keeps working for any existing renderer code that calls
 * `electronAPI.setActiveModel(id, type, config)`.
 * ============================================================================
 */

const { contextBridge, ipcRenderer } = require("electron");

const electronAPI = {
  // ============================================================
  // WINDOW CONTROLS
  // ============================================================

  minimizeWindow: () => ipcRenderer.invoke("minimize-window"),

  maximizeWindow: () => ipcRenderer.invoke("maximize-window"),

  closeWindow: () => ipcRenderer.invoke("close-window"),

  // ============================================================
  // SETTINGS
  // ============================================================

  getSettings: () => ipcRenderer.invoke("get-settings"),

  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),

  // ============================================================
  // MODELS
  // ============================================================

  getLocalModels: () => ipcRenderer.invoke("get-local-models"),

  setActiveModel: (modelId, modelType = "local", modelConfig = null) =>
    ipcRenderer.invoke("set-active-model", {
      id: modelId,
      type: modelType,
      ...(modelConfig ? { modelConfig } : {})
    }),

  deleteModel: (modelId, modelType) =>
    ipcRenderer.invoke("delete-model", modelId, modelType),

  listModels: () => ipcRenderer.invoke("models:list"),

  uploadModel: (filePath) => ipcRenderer.invoke("models:upload", filePath),

  addRemoteModel: (modelConfig) =>
    ipcRenderer.invoke("models:addRemote", modelConfig),

  getModel: (modelId) => ipcRenderer.invoke("models:get", modelId),

  // ============================================================
  // APP INFORMATION
  // ============================================================

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  getAppIcon: () => ipcRenderer.invoke("get-app-icon"),

  // ============================================================
  // FILE SYSTEM
  // ============================================================

  openFile: (filePath) => ipcRenderer.invoke("open-file", filePath),

  getModelsPath: () => ipcRenderer.invoke("get-models-path"),

  openModelsFolder: () => ipcRenderer.invoke("open-models-folder"),

  // ============================================================
  // PERFORMANCE
  // ============================================================

  getPerformanceMetrics: () => ipcRenderer.invoke("get-performance-metrics"),

  optimizeMemory: () => ipcRenderer.invoke("optimize-memory"),

  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // ============================================================
  // LLAMA SERVER
  // ============================================================

  getServerStatus: () => ipcRenderer.invoke("get-server-status"),

  restartLlamaServer: () => ipcRenderer.invoke("restart-llama-server"),

  // ============================================================
  // CHAT
  // ============================================================

  clearChatHistory: () => ipcRenderer.invoke("clear-chat-history"),

  sendChatMessageStreaming: (message, options = {}) => {
  const {
    onChunk,
    onStart,
    onDone,
    onError,
    onStopped,
    ...invokeOptions
  } = options;

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      ipcRenderer.removeListener(
        "chat:stream-update",
        streamListener
      );
    };

    const finishResolve = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const finishReject = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      const normalizedError =
        error instanceof Error
          ? error
          : new Error(
              error?.message ||
                String(error || "Chat request failed.")
            );

      reject(normalizedError);
    };

    const streamListener = (_event, data) => {
      if (!data || typeof data !== "object") {
        return;
      }

      console.log(
        "[Preload] chat stream event:",
        data.type,
        data.requestId || ""
      );

      switch (data.type) {
        case "start": {
          if (typeof onStart === "function") {
            try {
              onStart(data);
            } catch (error) {
              console.error(
                "[Preload] onStart callback failed:",
                error
              );
            }
          }

          return;
        }

        case "content": {
          const content =
            typeof data.content === "string"
              ? data.content
              : "";

          if (!content) {
            return;
          }

          if (typeof onChunk === "function") {
            try {
              /*
               * THIS IS THE LIVE TOKEN PATH.
               *
               * Every chunk coming from the Electron main process
               * immediately reaches useChat().
               */
              onChunk(content, data);
            } catch (error) {
              console.error(
                "[Preload] onChunk callback failed:",
                error
              );
            }
          }

          return;
        }

        case "done": {
          const result = {
            success: true,
            type: "done",
            requestId:
              data.requestId || null,
            messageId:
              data.messageId || null,
            sessionId:
              data.sessionId || null,
            content:
              typeof data.content === "string"
                ? data.content
                : "",
            metrics:
              data.metrics || null,
          };

          if (typeof onDone === "function") {
            try {
              onDone(
                result.content,
                result.messageId,
                result.metrics,
                data
              );
            } catch (error) {
              console.error(
                "[Preload] onDone callback failed:",
                error
              );
            }
          }

          finishResolve(result);
          return;
        }

        case "stopped": {
          const result = {
            success: true,
            type: "stopped",
            stopped: true,
            requestId:
              data.requestId || null,
            messageId:
              data.messageId || null,
            sessionId:
              data.sessionId || null,
            content:
              typeof data.content === "string"
                ? data.content
                : "",
            metrics:
              data.metrics || null,
          };

          if (typeof onStopped === "function") {
            try {
              onStopped(
                result.content,
                result.messageId,
                result.metrics,
                data
              );
            } catch (error) {
              console.error(
                "[Preload] onStopped callback failed:",
                error
              );
            }
          }

          finishResolve(result);
          return;
        }

        case "error": {
          const error = new Error(
            data.error ||
              data.message ||
              "AI generation failed."
          );

          if (typeof onError === "function") {
            try {
              onError(error, data);
            } catch (callbackError) {
              console.error(
                "[Preload] onError callback failed:",
                callbackError
              );
            }
          }

          finishReject(error);
          return;
        }

        default:
          return;
      }
    };

    /*
     * IMPORTANT:
     *
     * Register the listener BEFORE invoking chat:stream.
     */
    ipcRenderer.on(
      "chat:stream-update",
      streamListener
    );

    /*
     * IMPORTANT:
     *
     * Only serializable data reaches ipcRenderer.invoke().
     * All callbacks were destructured above and therefore are NOT
     * transferred through IPC.
     */
    ipcRenderer
      .invoke("chat:stream", {
        ...invokeOptions,
        message,
      })
      .then((result) => {
        /*
         * The main process returns after generation finishes.
         *
         * Successful requests are finalized by the "done" event.
         */
        if (
          result &&
          result.success === false
        ) {
          finishReject(
            new Error(
              result.error ||
                "Chat request failed."
            )
          );
        }

        /*
         * Do NOT resolve a successful request here.
         *
         * Wait for chat:stream-update -> done.
         */
      })
      .catch((error) => {
        finishReject(error);
      });
  });
},

  stopGeneration: (
  requestId = null,
  messageId = null,
  sessionId = null
) =>
  ipcRenderer.invoke("chat:stop", {
    requestId,
    messageId,
    sessionId,
  }),

  getChatHistory: () => ipcRenderer.invoke("chat:history"),

  deleteChatSession: (sessionId) =>
    ipcRenderer.invoke("chat:delete", sessionId),

  getChatSession: (sessionId) => ipcRenderer.invoke("chat:session", sessionId),

  clearAllChatHistory: () => ipcRenderer.invoke("chat:clear"),

  // ============================================================
  // METRICS / AI STATUS
  // ============================================================

  getMetrics: (sessionId) => ipcRenderer.invoke("metrics:realtime", sessionId),

  getAIStatus: () => ipcRenderer.invoke("ai:status"),

  // ============================================================
  // WINDOW STATE EVENTS
  // ============================================================

  onWindowStateChange: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, state) => {
      callback(state);
    };

    ipcRenderer.on("window-state-changed", listener);

    return () => {
      ipcRenderer.removeListener("window-state-changed", listener);
    };
  },

  // ============================================================
  // CHAT STREAM EVENTS
  // ============================================================

  onChatStreamUpdate: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, data) => {
      callback(data);
    };

    ipcRenderer.on("chat:stream-update", listener);

    return () => {
      ipcRenderer.removeListener("chat:stream-update", listener);
    };
  }
};

// ================================================================
// EXPOSE ELECTRON API
// ================================================================

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// ================================================================
// APPLICATION UTILITIES
// ================================================================

contextBridge.exposeInMainWorld("appUtils", {
  applyTheme: (theme) => {
    const root = document.documentElement;

    root.setAttribute("data-theme", theme);

    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);

    const style = document.documentElement.style;

    if (isDark) {
      style.setProperty("--bg-primary", "#111827");
      style.setProperty("--bg-secondary", "#1f2937");
      style.setProperty("--text-primary", "#f9fafb");
      style.setProperty("--text-secondary", "#d1d5db");
      style.setProperty("--border-color", "#374151");
    } else {
      style.setProperty("--bg-primary", "#ffffff");
      style.setProperty("--bg-secondary", "#f9fafb");
      style.setProperty("--text-primary", "#111827");
      style.setProperty("--text-secondary", "#6b7280");
      style.setProperty("--border-color", "#e5e7eb");
    }
  },

  debounce: (func, wait) => {
    let timeout;

    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  formatFileSize: (bytes) => {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
      return "0 B";
    }

    if (bytes === 0) {
      return "0 B";
    }

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const index = Math.min(i, sizes.length - 1);

    return (
      parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + " " + sizes[index]
    );
  },

  parseMarkdown: (text) => {
    if (!text) {
      return "";
    }

    const escapeHtml = (unsafe) => {
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    let html = escapeHtml(text);

    // Fenced code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, language, code) => {
      const lang = language || "text";

      return (
        `<pre class="code-block">` +
        `<code class="language-${lang}">` +
        `${code.trim()}` +
        `</code>` +
        `</pre>`
      );
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }
});

// ================================================================
// SYSTEM INFORMATION
// ================================================================

contextBridge.exposeInMainWorld("systemInfo", {
  platform: process.platform,
  isWindows: process.platform === "win32",
  isMac: process.platform === "darwin",
  isLinux: process.platform === "linux",
  arch: process.arch
});

// ================================================================
// ERROR HANDLING
// ================================================================

contextBridge.exposeInMainWorld("errorHandler", {
  wrap: async (fn, message = "An error occurred") => {
    try {
      return await fn();
    } catch (error) {
      console.error(`${message}:`, error);

      throw new Error(`${message}: ${error?.message || String(error)}`);
    }
  },

  showError: (message) => {
    const errorDiv = document.createElement("div");

    errorDiv.className =
      "fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50";

    errorDiv.textContent = String(message);

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (document.body.contains(errorDiv)) {
        document.body.removeChild(errorDiv);
      }
    }, 5000);
  }
});

// ================================================================
// SECURITY
//
// NOTE: with contextIsolation: true (as set in main.js), the preload
// script runs in an isolated JS context. Assigning to `window.require`
// etc. here does not remove those globals from the renderer's main
// world — that isolation is already provided by contextIsolation +
// nodeIntegration: false. These assignments are kept as a harmless,
// defense-in-depth no-op in case isolation settings are ever changed,
// but they are not load-bearing for security on their own.
// ================================================================

if (typeof window !== "undefined") {
  window.require = undefined;
  window.module = undefined;
  window.exports = undefined;
  window.process = undefined;
}