import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { chatAPI, processAIStream } from "../utils/api";
import {
  CHAT_HISTORY_KEY,
  SETTINGS_KEY,
} from "../utils/constants";

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const isElectronEnvironment = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    !!window.electronAPI &&
    typeof window.electronAPI.sendChatMessageStreaming === "function"
  );
};

const normalizeText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").trim();
};

const normalizeAttachments = (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments.filter(Boolean);
};

const fileToBase64 = async (file) => {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Unable to read the selected attachment.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }

  return btoa(binary);
};

const serializeAttachment = async (file) => ({
  name: file?.name || "attachment",
  type: file?.type || "application/octet-stream",
  size: Number(file?.size) || 0,
  data: await fileToBase64(file),
});

const normalizeMemoryMode = (value) =>
  value === "off" || value === "application"
    ? value
    : "chat";

const getSavedMemoryMode = async () => {
  if (
    typeof window !== "undefined" &&
    typeof window.electronAPI?.getSettings === "function"
  ) {
    try {
      const settings = await window.electronAPI.getSettings();

      return normalizeMemoryMode(settings?.chat?.memoryMode);
    } catch (error) {
      console.warn("Unable to read chat memory setting:", error);
    }
  }

  try {
    const rawSettings =
      typeof window !== "undefined"
        ? window.localStorage.getItem(SETTINGS_KEY)
        : null;
    const settings = rawSettings ? JSON.parse(rawSettings) : null;

    return normalizeMemoryMode(settings?.chat?.memoryMode);
  } catch (error) {
    console.warn("Unable to read local chat memory setting:", error);
    return "chat";
  }
};

const toRequestMessage = (message) => ({
  role: message.role,
  content:
    typeof message.content === "string"
      ? message.content
      : String(message.content ?? ""),
});

const buildRequestHistory = (sessions, sessionId, memoryMode, currentText) => {
  if (memoryMode === "off") {
    return [{ role: "user", content: currentText }];
  }

  const selectedSessions =
    memoryMode === "application"
      ? sessions
      : sessions.filter((session) => session.id === sessionId);

  const history = selectedSessions.flatMap((session) =>
    (Array.isArray(session.messages) ? session.messages : [])
      .filter(
        (message) =>
          message &&
          (message.role === "user" ||
            message.role === "assistant" ||
            message.role === "system")
      )
      .map(toRequestMessage)
      .filter((message) => message.content.trim().length > 0)
  );

  const boundedHistory = history.slice(-40);
  const lastMessage = boundedHistory[boundedHistory.length - 1];

  if (
    !lastMessage ||
    lastMessage.role !== "user" ||
    lastMessage.content !== currentText
  ) {
    boundedHistory.push({ role: "user", content: currentText });
  }

  return boundedHistory;
};

export const useChat = () => {
  const [chatSessions, setChatSessions] = useLocalStorage(
    CHAT_HISTORY_KEY,
    []
  );

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const currentSessionIdRef = useRef(null);

  const activeRequestRef = useRef({
    requestId: null,
    messageId: null,
    sessionId: null,
  });

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  /*
   * --------------------------------------------------------------------------
   * INITIAL SESSION
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (Array.isArray(chatSessions) && chatSessions.length > 0) {
      if (!currentSessionId) {
        const firstId = chatSessions[0].id;

        currentSessionIdRef.current = firstId;
        setCurrentSessionId(firstId);
      }

      return;
    }

    const now = new Date().toISOString();

    const newChat = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    currentSessionIdRef.current = newChat.id;

    setChatSessions([newChat]);
    setCurrentSessionId(newChat.id);
  }, [chatSessions, currentSessionId, setChatSessions]);

  /*
   * --------------------------------------------------------------------------
   * SESSION HELPERS
   * --------------------------------------------------------------------------
   */

  const updateSession = useCallback(
    (sessionId, updater) => {
      setChatSessions((sessions) => {
        if (!Array.isArray(sessions)) {
          return [];
        }

        return sessions.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          return updater(session);
        });
      });
    },
    [setChatSessions]
  );

  const updateMessages = useCallback(
    (sessionId, updater) => {
      updateSession(sessionId, (session) => {
        const existingMessages = Array.isArray(session.messages)
          ? session.messages
          : [];

        let nextMessages;

        try {
          nextMessages = updater(existingMessages);
        } catch (error) {
          console.error("Failed to update chat messages:", error);
          nextMessages = existingMessages;
        }

        if (!Array.isArray(nextMessages)) {
          nextMessages = existingMessages;
        }

        return {
          ...session,
          messages: nextMessages.slice(-100),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateSession]
  );

  /*
   * --------------------------------------------------------------------------
   * CREATE CHAT
   * --------------------------------------------------------------------------
   */

  const createNewChat = useCallback(() => {
    const now = new Date().toISOString();

    const newChat = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    setChatSessions((previous) => {
      const sessions = Array.isArray(previous) ? previous : [];

      return [newChat, ...sessions].slice(0, 1000);
    });

    currentSessionIdRef.current = newChat.id;
    setCurrentSessionId(newChat.id);

    setError(null);
  }, [setChatSessions]);

  /*
   * --------------------------------------------------------------------------
   * SWITCH CHAT
   * --------------------------------------------------------------------------
   */

  const switchToChat = useCallback((sessionId) => {
    if (!sessionId) {
      return;
    }

    currentSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
    setError(null);
  }, []);

  /*
   * --------------------------------------------------------------------------
   * DELETE CHAT
   * --------------------------------------------------------------------------
   */

  const deleteChat = useCallback(
    (sessionId) => {
      if (!sessionId) {
        return;
      }

      setChatSessions((previous) => {
        const sessions = Array.isArray(previous) ? previous : [];

        const remaining = sessions.filter(
          (session) => session.id !== sessionId
        );

        if (remaining.length === 0) {
          const now = new Date().toISOString();

          const newChat = {
            id: generateId(),
            title: "New Chat",
            messages: [],
            createdAt: now,
            updatedAt: now,
          };

          currentSessionIdRef.current = newChat.id;
          setCurrentSessionId(newChat.id);

          return [newChat];
        }

        if (currentSessionIdRef.current === sessionId) {
          const nextSessionId = remaining[0].id;

          currentSessionIdRef.current = nextSessionId;
          setCurrentSessionId(nextSessionId);
        }

        return remaining;
      });

      setError(null);
    },
    [setChatSessions]
  );

  /*
   * --------------------------------------------------------------------------
   * DELETE ALL
   * --------------------------------------------------------------------------
   */

  const deleteAllChats = useCallback(() => {
    const now = new Date().toISOString();

    const newChat = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    currentSessionIdRef.current = newChat.id;

    setChatSessions([newChat]);
    setCurrentSessionId(newChat.id);
    setError(null);
  }, [setChatSessions]);

  /*
   * --------------------------------------------------------------------------
   * STOP GENERATION
   * --------------------------------------------------------------------------
   */

  const stopGeneration = useCallback(() => {
    const active = activeRequestRef.current;

    const sessionId =
      active.sessionId || currentSessionIdRef.current;

    /*
     * Electron cancellation.
     *
     * Send requestId whenever available. The main process can also fall back
     * to sessionId/messageId.
     */
    if (
  typeof window !== "undefined" &&
  window.electronAPI &&
  typeof window.electronAPI.stopGeneration ===
    "function"
) {
  try {
    void window.electronAPI.stopGeneration(
      active.requestId || null,
      active.messageId || null,
      sessionId || null
    );
  } catch (error) {
    console.error(
      "Failed to stop Electron generation:",
      error
    );
  }
}

    /*
     * Browser cancellation.
     */
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (error) {
        console.error(
          "Failed to abort browser request:",
          error
        );
      }

      abortControllerRef.current = null;
    }

    /*
     * Preserve whatever has already been generated.
     */
    if (sessionId) {
      updateMessages(sessionId, (messages) =>
        messages.map((message) =>
          message.isStreaming
            ? {
                ...message,
                isStreaming: false,
                stopped: true,
              }
            : message
        )
      );
    }

    setIsLoading(false);

    activeRequestRef.current = {
      requestId: null,
      messageId: null,
      sessionId: null,
    };
  }, [updateMessages]);

  /*
   * --------------------------------------------------------------------------
   * SEND MESSAGE
   * --------------------------------------------------------------------------
   */

  const sendMessage = useCallback(
    async (
      text,
      model = "default",
      attachments = []
    ) => {
      const normalizedText = normalizeText(text);
      const normalizedAttachments =
        normalizeAttachments(attachments);

      if (!normalizedText && normalizedAttachments.length === 0) {
        setError("Message cannot be empty");
        return false;
      }

      const effectiveText =
        normalizedText ||
        (normalizedAttachments.length > 0
          ? "Please analyze the attached file(s)."
          : "");

      const sessionId = currentSessionIdRef.current;

      if (!sessionId) {
        setError("No active chat session");
        return false;
      }

      /*
       * Prevent accidental concurrent requests.
       */
      if (isLoading) {
        return false;
      }

      setIsLoading(true);
      setError(null);

      abortControllerRef.current =
        new AbortController();

      activeRequestRef.current = {
        requestId: null,
        messageId: null,
        sessionId,
      };

      /*
       * ----------------------------------------------------------------------
       * USER MESSAGE
       * ----------------------------------------------------------------------
       */

      const userMessageId = generateId();

      const userMessage = {
        id: userMessageId,
        role: "user",
        content: effectiveText,
        timestamp: new Date().toISOString(),
        model,

        attachments:
          normalizedAttachments.length > 0
            ? normalizedAttachments.map((file) => ({
                name:
                  file?.name ||
                  "attachment",
                type:
                  file?.type ||
                  "application/octet-stream",
                size:
                  Number(file?.size) || 0,
              }))
            : undefined,
      };

      updateMessages(
        sessionId,
        (messages) => [
          ...messages,
          userMessage,
        ]
      );

      /*
       * ----------------------------------------------------------------------
       * ASSISTANT PLACEHOLDER
       * ----------------------------------------------------------------------
       */

      const assistantMessageId = generateId();

      activeRequestRef.current.messageId =
        assistantMessageId;

      const assistantMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        model,
        isStreaming: true,
        stopped: false,
        error: false,
        tokens: 0,
        metrics: null,
      };

      updateMessages(
        sessionId,
        (messages) => [
          ...messages,
          assistantMessage,
        ]
      );

      /*
       * ----------------------------------------------------------------------
       * STREAM STATE
       * ----------------------------------------------------------------------
       */

      let fullContent = "";
      let completed = false;
      let stopped = false;

      /*
       * ----------------------------------------------------------------------
       * CONTENT
       * ----------------------------------------------------------------------
       *
       * This function is called for EVERY Electron token/chunk.
       */

      const handleContent = (content) => {
        if (completed || stopped) {
          return;
        }

        if (
          content === null ||
          content === undefined
        ) {
          return;
        }

        const chunk =
          typeof content === "string"
            ? content
            : String(content);

        if (!chunk) {
          return;
        }

        fullContent += chunk;

        /*
         * React state is updated immediately for every received chunk.
         */
        updateMessages(
          sessionId,
          (messages) =>
            messages.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: fullContent,
                    isStreaming: true,
                    stopped: false,
                    error: false,
                  }
                : message
            )
        );
      };

      /*
       * ----------------------------------------------------------------------
       * DONE
       * ----------------------------------------------------------------------
       */

      const handleDone = (
        content = "",
        messageId = null,
        metrics = null,
        wasStopped = false
      ) => {
        if (completed) {
          return;
        }

        completed = true;
        stopped = Boolean(wasStopped);

        const suppliedContent =
          typeof content === "string"
            ? content
            : "";

        /*
         * The streamed content is authoritative unless the final event
         * contains a longer/complete response.
         */
        const finalContent =
          suppliedContent.length >= fullContent.length
            ? suppliedContent
            : fullContent;

        fullContent = finalContent;

        if (messageId) {
          activeRequestRef.current.messageId =
            messageId;
        }

        const tokenCount =
          Number(metrics?.tokens) ||
          Number(metrics?.generatedTokens) ||
          0;

        updateMessages(
          sessionId,
          (messages) =>
            messages.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: finalContent,
                    isStreaming: false,
                    stopped,
                    error: false,
                    tokens: tokenCount,
                    metrics: metrics || null,
                  }
                : message
            )
        );

        /*
         * Generate chat title from the first user message.
         */
        updateSession(
          sessionId,
          (session) => {
            const messages =
              Array.isArray(session.messages)
                ? session.messages
                : [];

            if (messages.length <= 2) {
              const firstUser =
                messages.find(
                  (message) =>
                    message.role === "user"
                );

              if (
                firstUser &&
                typeof firstUser.content === "string"
              ) {
                const titleSource =
                  firstUser.content.trim();

                if (titleSource) {
                  return {
                    ...session,
                    title:
                      titleSource.length > 50
                        ? `${titleSource.slice(
                            0,
                            50
                          )}...`
                        : titleSource,
                    updatedAt:
                      new Date().toISOString(),
                  };
                }
              }
            }

            return {
              ...session,
              updatedAt:
                new Date().toISOString(),
            };
          }
        );

        setIsLoading(false);

        if (abortControllerRef.current) {
          abortControllerRef.current = null;
        }

        activeRequestRef.current = {
          requestId: null,
          messageId: null,
          sessionId: null,
        };
      };

      /*
       * ----------------------------------------------------------------------
       * ERROR
       * ----------------------------------------------------------------------
       */

      const handleError = (streamError) => {
        if (completed || stopped) {
          return;
        }

        console.error(
          "Stream processing error:",
          streamError
        );

        const errorMessage =
          streamError?.message ||
          "Failed to get AI response";

        setError(errorMessage);

        updateMessages(
          sessionId,
          (messages) =>
            messages.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content:
                      fullContent ||
                      "Sorry, I encountered an error while generating a response. Please try again.",
                    isStreaming: false,
                    stopped: false,
                    error: true,
                  }
                : message
            )
        );

        completed = true;

        setIsLoading(false);

        abortControllerRef.current = null;

        activeRequestRef.current = {
          requestId: null,
          messageId: null,
          sessionId: null,
        };
      };

      /*
       * ----------------------------------------------------------------------
       * REQUEST
       * ----------------------------------------------------------------------
       */

      try {
        const memoryMode = await getSavedMemoryMode();
        const requestHistory = buildRequestHistory(
          Array.isArray(chatSessions) ? chatSessions : [],
          sessionId,
          memoryMode,
          effectiveText
        );

        /*
         * ====================================================================
         * ELECTRON
         * ====================================================================
         *
         * IMPORTANT:
         *
         * Do NOT call processAIStream() here.
         *
         * Electron cannot transfer a browser ReadableStream through IPC.
         *
         * sendChatMessageStreaming() receives the individual IPC events and
         * calls handleContent() as each chunk arrives.
         */

        if (isElectronEnvironment()) {
          const electronAPI = window.electronAPI;

          if (
            !electronAPI ||
            typeof electronAPI.sendChatMessageStreaming !== "function"
          ) {
            throw new Error(
              "Electron streaming API is unavailable."
            );
          }

          const ipcAttachments = await Promise.all(
            normalizedAttachments.map(serializeAttachment)
          );

          const result = await electronAPI.sendChatMessageStreaming(
            effectiveText,
            {
              model:
                typeof model === "string" && model.trim()
                  ? model.trim()
                  : "default",

              sessionId,
              messages: requestHistory,
              attachments: ipcAttachments,
              temperature: 0.7,
              max_tokens: 4000,

              onStart: (streamInfo) => {
                console.log("[Renderer] Stream started:", streamInfo);

                if (streamInfo?.requestId) {
                  activeRequestRef.current.requestId = streamInfo.requestId;
                }

                if (streamInfo?.messageId) {
                  activeRequestRef.current.messageId = streamInfo.messageId;
                }
              },

              onChunk: (chunk, streamInfo) => {
                if (streamInfo?.requestId) {
                  activeRequestRef.current.requestId = streamInfo.requestId;
                }

                if (streamInfo?.messageId) {
                  activeRequestRef.current.messageId = streamInfo.messageId;
                }

                console.log("[Renderer] Stream chunk:", JSON.stringify(chunk));
                handleContent(chunk);
              },

              onDone: (content, messageId, metrics) => {
                console.log("[Renderer] Stream completed.");
                handleDone(content, messageId, metrics, false);
              },

              onStopped: (content, messageId, metrics) => {
                console.log("[Renderer] Stream stopped.");
                stopped = true;
                handleDone(content, messageId, metrics, true);
              },

              onError: (streamError) => {
                console.error("[Renderer] Stream error:", streamError);
                handleError(streamError);
              },
            }
          );

          if (result && !completed) {
            if (result.type === "done") {
              handleDone(
                result.content || fullContent,
                result.messageId || activeRequestRef.current.messageId,
                result.metrics || null,
                false
              );
            } else if (result.type === "stopped") {
              stopped = true;
              handleDone(
                result.content || fullContent,
                result.messageId || activeRequestRef.current.messageId,
                result.metrics || null,
                true
              );
            }
          }

          return true;
        }

        const streamBody = await chatAPI.sendMessage(
          effectiveText,
          model,
          normalizedAttachments,
          sessionId,
          {
            temperature: 0.7,
            max_tokens: 4000,
            messages: requestHistory,
            signal: abortControllerRef.current?.signal,
          }
        );

        await processAIStream(
          streamBody,
          handleContent,
          handleDone,
          handleError
        );

        return true;
      } catch (err) {
        /*
         * Intentional cancellation.
         */
        if (
          err?.name === "AbortError" ||
          abortControllerRef.current
            ?.signal?.aborted ||
          stopped
        ) {
          if (!completed) {
            handleDone(
              fullContent,
              activeRequestRef.current.messageId,
              null,
              true
            );
          }

          return false;
        }

        console.error(
          "Send message error:",
          err
        );

        handleError(err);

        return false;
      }
    },
    [
      chatSessions,
      isLoading,
      updateMessages,
      updateSession,
    ]
  );

  /*
   * --------------------------------------------------------------------------
   * CURRENT CHAT
   * --------------------------------------------------------------------------
   */

  const currentChat =
    chatSessions?.find(
      (chat) =>
        chat.id === currentSessionId
    ) || null;

  /*
   * --------------------------------------------------------------------------
   * PUBLIC API
   * --------------------------------------------------------------------------
   */

  return {
    chatSessions:
      Array.isArray(chatSessions)
        ? chatSessions
        : [],

    currentSessionId,

    setCurrentSessionId: (sessionId) => {
      currentSessionIdRef.current =
        sessionId;

      setCurrentSessionId(
        sessionId
      );
    },

    currentChat,

    messages:
      currentChat?.messages || [],

    isLoading,

    error,

    sendMessage,

    stopGeneration,

    createNewChat,

    switchToChat,

    deleteChat,

    deleteAllChats,
  };
};