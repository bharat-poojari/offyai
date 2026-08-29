"use strict";

const {
  contextBridge,
  ipcRenderer,
} = require("electron");

/*
 * ============================================================================
 * SAFE IPC HELPER
 * ============================================================================
 */

const invoke = (
  channel,
  ...args
) => {
  return ipcRenderer.invoke(
    channel,
    ...args
  );
};

/*
 * ============================================================================
 * ELECTRON API
 * ============================================================================
 */

const electronAPI = {
  /*
   * --------------------------------------------------------------------------
   * WINDOW
   * --------------------------------------------------------------------------
   */

  minimizeWindow: () =>
    invoke(
      "minimize-window"
    ),

  maximizeWindow: () =>
    invoke(
      "maximize-window"
    ),

  closeWindow: () =>
    invoke(
      "close-window"
    ),

  /*
   * --------------------------------------------------------------------------
   * SETTINGS
   * --------------------------------------------------------------------------
   */

  getSettings: () =>
    invoke(
      "get-settings"
    ),

  saveSettings: (
    settings
  ) =>
    invoke(
      "save-settings",
      settings
    ),

  getWelcomeState: () =>
    invoke(
      "get-welcome-state"
    ),

  markWelcomeSeen: () =>
    invoke(
      "mark-welcome-seen"
    ),

  resetSettings: () =>
    invoke(
      "reset-settings"
    ),

  getWelcomeState: () =>
    invoke(
      "get-welcome-state"
    ),

  markWelcomeSeen: () =>
    invoke(
      "mark-welcome-seen"
    ),

  getChatHistory: () =>
    invoke(
      "get-chat-history"
    ),

  saveChatHistory: (sessions) =>
    invoke(
      "save-chat-history",
      sessions
    ),

  /*
   * --------------------------------------------------------------------------
   * LEGACY MODEL API
   * --------------------------------------------------------------------------
   *
   * Kept for compatibility with existing renderer code.
   */

  getLocalModels: () =>
    invoke(
      "get-local-models"
    ),

  setActiveModel: (
    modelId,
    modelType = "local",
    modelConfig = null
  ) =>
    invoke(
      "set-active-model",
      {
        id:
          modelId,
        type:
          modelType,
        ...(modelConfig
          ? {
              modelConfig,
            }
          : {}),
      }
    ),

  /*
   * --------------------------------------------------------------------------
   * MODEL MANAGEMENT
   * --------------------------------------------------------------------------
   */

  listModels: () =>
    invoke(
      "models:list"
    ),

  /*
   * Native model picker.
   *
   * Returns:
   *
   * {
   *   success,
   *   canceled,
   *   file: {
   *     name,
   *     path,
   *     size,
   *     sizeBytes,
   *     sizeFormatted,
   *     extension,
   *     modelId,
   *     type
   *   },
   *   filePath,
   *   fileName,
   *   sizeBytes,
   *   sizeFormatted,
   *   extension,
   *   modelId
   * }
   */

  selectModelFile: () =>
    invoke(
      "models:selectFile"
    ),

  /*
   * Upload model into:
   *
   * <project-root>/models/
   */

  uploadModel: (
    filePath
  ) =>
    invoke(
      "models:upload",
      filePath
    ),

  /*
   * Activate model.
   */

  activateModel: (
    modelId,
    modelType = "local",
    modelConfig = null
  ) =>
    invoke(
      "models:setActive",
      {
        modelId,
        modelType,
        ...(modelConfig
          ? {
              modelConfig,
            }
          : {}),
      }
    ),

  /*
   * Keep setActiveModel as an alias for renderer compatibility.
   */

  setModelActive: (
    modelId,
    modelType = "local",
    modelConfig = null
  ) =>
    invoke(
      "models:setActive",
      {
        modelId,
        modelType,
        ...(modelConfig
          ? {
              modelConfig,
            }
          : {}),
      }
    ),

  /*
   * Remote model.
   */

  addRemoteModel: (
    modelConfig
  ) =>
    invoke(
      "models:addRemote",
      modelConfig
    ),

  /*
   * Get one model.
   */

  getModel: (
    modelId
  ) =>
    invoke(
      "models:get",
      modelId
    ),

  /*
   * Delete model.
   *
   * This is intentionally exposed directly so the frontend can render
   * a Delete button/action.
   */

  deleteModel: (
    model,
    modelType = "local"
  ) => {
    const modelId =
      typeof model === "string"
        ? model
        : model?.id;

    const resolvedModelType =
      typeof model === "object" &&
      model?.type
        ? model.type
        : modelType;

    return invoke(
      "models:delete",
      modelId,
      resolvedModelType
    );
  },

  /*
   * Convenience alias.
   */

  removeModel: (
    modelId,
    modelType = "local"
  ) =>
    invoke(
      "models:delete",
      modelId,
      modelType
    ),

  /*
   * --------------------------------------------------------------------------
   * APP INFORMATION
   * --------------------------------------------------------------------------
   */

  getAppVersion: () =>
    invoke(
      "get-app-version"
    ),

  getAppIcon: () =>
    invoke(
      "get-app-icon"
    ),

  /*
   * --------------------------------------------------------------------------
   * FILE SYSTEM
   * --------------------------------------------------------------------------
   */

  openFile: (
    filePath
  ) =>
    invoke(
      "open-file",
      filePath
    ),

  getModelsPath: () =>
    invoke(
      "get-models-path"
    ),

  openModelsFolder: () =>
    invoke(
      "open-models-folder"
    ),

  /*
   * --------------------------------------------------------------------------
   * PERFORMANCE
   * --------------------------------------------------------------------------
   */

  getPerformanceMetrics: () =>
    invoke(
      "get-performance-metrics"
    ),

  optimizeMemory: () =>
    invoke(
      "optimize-memory"
    ),

  getSystemInfo: () =>
    invoke(
      "get-system-info"
    ),

  /*
   * --------------------------------------------------------------------------
   * LLAMA SERVER
   * --------------------------------------------------------------------------
   */

  getServerStatus: () =>
    invoke(
      "get-server-status"
    ),

  restartLlamaServer: () =>
    invoke(
      "restart-llama-server"
    ),

  /*
   * --------------------------------------------------------------------------
   * CHAT
   * --------------------------------------------------------------------------
   */

  clearChatHistory: () =>
    invoke(
      "clear-chat-history"
    ),

  getChatHistory: () =>
    invoke(
      "chat:history"
    ),

  deleteChatSession: (
    sessionId
  ) =>
    invoke(
      "chat:delete",
      sessionId
    ),

  getChatSession: (
    sessionId
  ) =>
    invoke(
      "chat:session",
      sessionId
    ),

  clearAllChatHistory: () =>
    invoke(
      "chat:clear"
    ),

  /*
   * --------------------------------------------------------------------------
   * STREAMING CHAT
   * --------------------------------------------------------------------------
   */

  sendChatMessageStreaming: (
    message,
    options = {}
  ) => {
    const {
      onChunk,
      onStart,
      onDone,
      onError,
      onStopped,
      ...invokeOptions
    } = options || {};

    return new Promise(
      (
        resolve,
        reject
      ) => {
        let settled =
          false;

        const cleanup =
          () => {
            ipcRenderer.removeListener(
              "chat:stream-update",
              streamListener
            );
          };

        const finishResolve =
          (
            result
          ) => {
            if (
              settled
            ) {
              return;
            }

            settled =
              true;

            cleanup();

            resolve(
              result
            );
          };

        const finishReject =
          (
            error
          ) => {
            if (
              settled
            ) {
              return;
            }

            settled =
              true;

            cleanup();

            const normalizedError =
              error instanceof Error
                ? error
                : new Error(
                    error?.message ||
                      String(
                        error ||
                          "Chat request failed."
                      )
                  );

            reject(
              normalizedError
            );
          };

        const streamListener =
          (
            _event,
            data
          ) => {
            if (
              !data ||
              typeof data !==
                "object"
            ) {
              return;
            }

            switch (
              data.type
            ) {
              case "start": {
                if (
                  typeof onStart ===
                  "function"
                ) {
                  try {
                    onStart(
                      data
                    );
                  } catch (
                    error
                  ) {
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
                  typeof data.content ===
                  "string"
                    ? data.content
                    : "";

                if (
                  !content
                ) {
                  return;
                }

                if (
                  typeof onChunk ===
                  "function"
                ) {
                  try {
                    onChunk(
                      content,
                      data
                    );
                  } catch (
                    error
                  ) {
                    console.error(
                      "[Preload] onChunk callback failed:",
                      error
                    );
                  }
                }

                return;
              }

              case "done": {
                const result =
                  {
                    success:
                      true,
                    type:
                      "done",
                    requestId:
                      data.requestId ||
                      null,
                    messageId:
                      data.messageId ||
                      null,
                    sessionId:
                      data.sessionId ||
                      null,
                    content:
                      typeof data.content ===
                      "string"
                        ? data.content
                        : "",
                    metrics:
                      data.metrics ||
                      null,
                  };

                if (
                  typeof onDone ===
                  "function"
                ) {
                  try {
                    onDone(
                      result.content,
                      result.messageId,
                      result.metrics,
                      data
                    );
                  } catch (
                    error
                  ) {
                    console.error(
                      "[Preload] onDone callback failed:",
                      error
                    );
                  }
                }

                finishResolve(
                  result
                );

                return;
              }

              case "stopped": {
                const result =
                  {
                    success:
                      true,
                    type:
                      "stopped",
                    stopped:
                      true,
                    requestId:
                      data.requestId ||
                      null,
                    messageId:
                      data.messageId ||
                      null,
                    sessionId:
                      data.sessionId ||
                      null,
                    content:
                      typeof data.content ===
                      "string"
                        ? data.content
                        : "",
                    metrics:
                      data.metrics ||
                      null,
                  };

                if (
                  typeof onStopped ===
                  "function"
                ) {
                  try {
                    onStopped(
                      result.content,
                      result.messageId,
                      result.metrics,
                      data
                    );
                  } catch (
                    error
                  ) {
                    console.error(
                      "[Preload] onStopped callback failed:",
                      error
                    );
                  }
                }

                finishResolve(
                  result
                );

                return;
              }

              case "error": {
                const error =
                  new Error(
                    data.error ||
                      data.message ||
                      "AI generation failed."
                  );

                if (
                  typeof onError ===
                  "function"
                ) {
                  try {
                    onError(
                      error,
                      data
                    );
                  } catch (
                    callbackError
                  ) {
                    console.error(
                      "[Preload] onError callback failed:",
                      callbackError
                    );
                  }
                }

                finishReject(
                  error
                );

                return;
              }

              default:
                return;
            }
          };

        /*
         * Register listener BEFORE invoking the main-process handler.
         */
        ipcRenderer.on(
          "chat:stream-update",
          streamListener
        );

        invoke(
          "chat:stream",
          {
            ...invokeOptions,
            message,
          }
        )
          .then(
            (
              result
            ) => {
              if (
                result &&
                result.success ===
                  false
              ) {
                finishReject(
                  new Error(
                    result.error ||
                      "Chat request failed."
                  )
                );
              }
            }
          )
          .catch(
            (
              error
            ) => {
              finishReject(
                error
              );
            }
          );
      }
    );
  },

  /*
   * --------------------------------------------------------------------------
   * STOP GENERATION
   * --------------------------------------------------------------------------
   */

  stopGeneration: (
    requestId = null,
    messageId = null,
    sessionId = null
  ) =>
    invoke(
      "chat:stop",
      {
        requestId,
        messageId,
        sessionId,
      }
    ),

  /*
   * --------------------------------------------------------------------------
   * METRICS
   * --------------------------------------------------------------------------
   */

  getMetrics: (
    sessionId
  ) =>
    invoke(
      "metrics:realtime",
      sessionId
    ),

  getAIStatus: () =>
    invoke(
      "ai:status"
    ),

  /*
   * --------------------------------------------------------------------------
   * WINDOW EVENTS
   * --------------------------------------------------------------------------
   */

  onWindowStateChange: (
    callback
  ) => {
    if (
      typeof callback !==
      "function"
    ) {
      return () => {};
    }

    const listener =
      (
        _event,
        state
      ) => {
        try {
          callback(
            state
          );
        } catch (
          error
        ) {
          console.error(
            "[Preload] Window-state callback failed:",
            error
          );
        }
      };

    ipcRenderer.on(
      "window-state-changed",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "window-state-changed",
        listener
      );
    };
  },

  /*
   * --------------------------------------------------------------------------
   * CHAT EVENTS
   * --------------------------------------------------------------------------
   */

  onChatStreamUpdate: (
    callback
  ) => {
    if (
      typeof callback !==
      "function"
    ) {
      return () => {};
    }

    const listener =
      (
        _event,
        data
      ) => {
        try {
          callback(
            data
          );
        } catch (
          error
        ) {
          console.error(
            "[Preload] Chat stream callback failed:",
            error
          );
        }
      };

    ipcRenderer.on(
      "chat:stream-update",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "chat:stream-update",
        listener
      );
    };
  },
};

/*
 * ============================================================================
 * EXPOSE ELECTRON API
 * ============================================================================
 */

contextBridge.exposeInMainWorld(
  "electronAPI",
  electronAPI
);

/*
 * ============================================================================
 * APPLICATION UTILITIES
 * ============================================================================
 */

contextBridge.exposeInMainWorld(
  "appUtils",
  {
    /*
     * ------------------------------------------------------------------------
     * THEME
     * ------------------------------------------------------------------------
     */

    applyTheme: (
      theme
    ) => {
      if (
        typeof document ===
        "undefined"
      ) {
        return;
      }

      const root =
        document.documentElement;

      root.setAttribute(
        "data-theme",
        theme
      );

      const isDark =
        theme === "dark" ||
        (
          theme ===
            "system" &&
          typeof window !==
            "undefined" &&
          window.matchMedia(
            "(prefers-color-scheme: dark)"
          ).matches
        );

      root.classList.toggle(
        "dark",
        isDark
      );

      root.classList.toggle(
        "light",
        !isDark
      );

      const style =
        root.style;

      if (
        isDark
      ) {
        style.setProperty(
          "--bg-primary",
          "#111827"
        );

        style.setProperty(
          "--bg-secondary",
          "#1f2937"
        );

        style.setProperty(
          "--text-primary",
          "#f9fafb"
        );

        style.setProperty(
          "--text-secondary",
          "#d1d5db"
        );

        style.setProperty(
          "--border-color",
          "#374151"
        );
      } else {
        style.setProperty(
          "--bg-primary",
          "#ffffff"
        );

        style.setProperty(
          "--bg-secondary",
          "#f9fafb"
        );

        style.setProperty(
          "--text-primary",
          "#111827"
        );

        style.setProperty(
          "--text-secondary",
          "#6b7280"
        );

        style.setProperty(
          "--border-color",
          "#e5e7eb"
        );
      }
    },

    /*
     * ------------------------------------------------------------------------
     * DEBOUNCE
     * ------------------------------------------------------------------------
     */

    debounce: (
      func,
      wait
    ) => {
      let timeout =
        null;

      return function (
        ...args
      ) {
        const later =
          () => {
            timeout =
              null;

            if (
              typeof func ===
              "function"
            ) {
              func(
                ...args
              );
            }
          };

        if (
          timeout !==
          null
        ) {
          clearTimeout(
            timeout
          );
        }

        timeout =
          setTimeout(
            later,
            Number.isFinite(
              Number(wait)
            )
              ? Number(
                  wait
                )
              : 0
          );
      };
    },

    /*
     * ------------------------------------------------------------------------
     * FILE SIZE
     * ------------------------------------------------------------------------
     */

    formatFileSize: (
      bytes
    ) => {
      if (
        typeof bytes !==
          "number" ||
        !Number.isFinite(
          bytes
        ) ||
        bytes < 0
      ) {
        return "0 B";
      }

      if (
        bytes === 0
      ) {
        return "0 B";
      }

      const sizes = [
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
              Math.log(
                1024
              )
          ),
          sizes.length -
            1
        );

      return `${parseFloat(
        (
          bytes /
          Math.pow(
            1024,
            index
          )
        ).toFixed(2)
      )} ${sizes[index]}`;
    },

    /*
     * ------------------------------------------------------------------------
     * MARKDOWN
     * ------------------------------------------------------------------------
     */

    parseMarkdown: (
      text
    ) => {
      if (
        !text
      ) {
        return "";
      }

      const escapeHtml =
        (
          value
        ) =>
          String(
            value
          )
            .replace(
              /&/g,
              "&amp;"
            )
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
              "&#039;"
            );

      let html =
        escapeHtml(
          text
        );

      html =
        html.replace(
          /```(\w+)?\n([\s\S]*?)```/g,
          (
            _match,
            language,
            code
          ) => {
            const lang =
              language ||
              "text";

            return (
              `<pre class="code-block">` +
              `<code class="language-${lang}">` +
              `${code.trim()}` +
              `</code>` +
              `</pre>`
            );
          }
        );

      html =
        html.replace(
          /`([^`]+)`/g,
          '<code class="inline-code">$1</code>'
        );

      html =
        html.replace(
          /\*\*(.*?)\*\*/g,
          "<strong>$1</strong>"
        );

      html =
        html.replace(
          /\*(.*?)\*/g,
          "<em>$1</em>"
        );

      html =
        html.replace(
          /\n/g,
          "<br>"
        );

      return html;
    },
  }
);

/*
 * ============================================================================
 * SYSTEM INFORMATION
 * ============================================================================
 */

contextBridge.exposeInMainWorld(
  "systemInfo",
  {
    platform:
      process.platform,

    isWindows:
      process.platform ===
      "win32",

    isMac:
      process.platform ===
      "darwin",

    isLinux:
      process.platform ===
      "linux",

    arch:
      process.arch,
  }
);

/*
 * ============================================================================
 * ERROR HANDLER
 * ============================================================================
 */

contextBridge.exposeInMainWorld(
  "errorHandler",
  {
    wrap: async (
      fn,
      message =
        "An error occurred"
    ) => {
      try {
        if (
          typeof fn !==
          "function"
        ) {
          throw new Error(
            "errorHandler.wrap requires a function"
          );
        }

        return await fn();
      } catch (
        error
      ) {
        console.error(
          `${message}:`,
          error
        );

        throw new Error(
          `${message}: ${
            error?.message ||
            String(
              error
            )
          }`
        );
      }
    },

    showError: (
      message
    ) => {
      if (
        typeof document ===
        "undefined"
      ) {
        return;
      }

      const errorDiv =
        document.createElement(
          "div"
        );

      errorDiv.className =
        "fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50";

      errorDiv.textContent =
        String(
          message
        );

      document.body.appendChild(
        errorDiv
      );

      setTimeout(
        () => {
          if (
            errorDiv.parentNode
          ) {
            errorDiv.parentNode.removeChild(
              errorDiv
            );
          }
        },
        5000
      );
    },
  }
);