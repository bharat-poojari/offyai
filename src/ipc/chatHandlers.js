"use strict";

/*
 * ============================================================================
 * Chat IPC handlers
 * ============================================================================
 *
 * FIXES APPLIED IN THIS VERSION:
 *
 * 1. `sessionManager` is now actually implemented and exported.
 *    Previously main.js did:
 *
 *        const { registerChatHandlers, sessionManager } = require(...)
 *
 *    but this module never exported `sessionManager`, so it was
 *    `undefined` everywhere it was used (chat:history, chat:session,
 *    chat:delete, chat:clear, clear-chat-history). Those features were
 *    silently no-ops. There is now a small persisted SessionManager and
 *    chat:stream records messages into it.
 *
 * 2. The chat:stream handler leaked entries in `activeRequests` on every
 *    non-happy-path exit (thrown errors before/after the SSE promise).
 *    The whole body is now wrapped in try/finally so the request is
 *    always removed from the map, no matter how it ends.
 * ============================================================================
 */

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const LLAMA_HOST = "127.0.0.1";
const LLAMA_PORT = 8080;

const LLAMA_CHAT_ENDPOINT =
  `http://${LLAMA_HOST}:${LLAMA_PORT}/v1/chat/completions`;

const activeRequests = new Map();

/**
 * Generate a unique ID.
 */
function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

/**
 * Safely send an IPC stream update.
 */
function sendStreamUpdate(mainWindow, payload) {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return false;
    }

    mainWindow.webContents.send("chat:stream-update", payload);
    return true;
  } catch (error) {
    console.error("Failed to send chat stream update:", error);
    return false;
  }
}

/**
 * Extract text from llama.cpp/OpenAI-compatible streaming responses.
 */
function extractStreamContent(data) {
  if (!data) {
    return "";
  }

  if (data.choices && Array.isArray(data.choices) && data.choices.length) {
    const choice = data.choices[0];

    if (choice.delta && typeof choice.delta.content === "string") {
      return choice.delta.content;
    }

    if (choice.message && typeof choice.message.content === "string") {
      return choice.message.content;
    }

    if (typeof choice.text === "string") {
      return choice.text;
    }
  }

  if (typeof data.content === "string") {
    return data.content;
  }

  if (typeof data.response === "string") {
    return data.response;
  }

  return "";
}

/**
 * Normalize messages before sending them to llama-server.
 */
function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(Boolean)
    .map((message) => ({
      role:
        message.role === "assistant"
          ? "assistant"
          : message.role === "system"
          ? "system"
          : "user",
      content:
        typeof message.content === "string"
          ? message.content
          : String(message.content ?? "")
    }))
    .filter((message) => message.content.length > 0);
}

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
]);

const MAX_EXTRACTED_ATTACHMENT_CHARS = 100000;

const getAttachmentExtension = (name = "") => {
  const extension = path.extname(String(name)).toLowerCase();
  return extension;
};

async function extractAttachmentText(attachment) {
  if (!attachment || typeof attachment.data !== "string") {
    throw new Error(
      `Attachment "${attachment?.name || "unknown"}" could not be read.`
    );
  }

  const name = String(attachment.name || "attachment");
  const type = String(attachment.type || "").toLowerCase();
  const extension = getAttachmentExtension(name);
  const buffer = Buffer.from(attachment.data, "base64");

  if (type.startsWith("text/") || TEXT_ATTACHMENT_EXTENSIONS.has(extension)) {
    return buffer.toString("utf8");
  }

  if (type === "application/pdf" || extension === ".pdf") {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  }

  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (
    type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    extension === ".xlsx"
  ) {
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });

    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return `[Sheet: ${sheetName}]\n${XLSX.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
  }

  throw new Error(
    `The bundled text model cannot process ${name}. ` +
      "Use a text/PDF/DOCX file, or configure a vision, audio, or video model."
  );
}

async function buildMessageWithAttachments(message, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return message;
  }

  const sections = [];

  for (const attachment of attachments) {
    const text = (await extractAttachmentText(attachment)).trim();

    if (!text) {
      throw new Error(`No readable text was found in ${attachment.name}.`);
    }

    sections.push(
      `[Attached file: ${attachment.name}]\n${text.slice(
        0,
        MAX_EXTRACTED_ATTACHMENT_CHARS
      )}`
    );
  }

  return `${message}\n\n${sections.join("\n\n")}`;
}

/*
 * ============================================================================
 * SESSION MANAGER
 * ============================================================================
 *
 * A minimal, disk-persisted store of chat sessions and their messages.
 * This exists purely so the chat:history / chat:session / chat:delete /
 * chat:clear IPC channels (and the renderer APIs built on top of them)
 * actually do something, instead of silently operating on `undefined`.
 */

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.sessionsFile = null;
    this._loaded = false;
  }

  _getSessionsFile() {
    if (this.sessionsFile) {
      return this.sessionsFile;
    }

    try {
      this.sessionsFile = path.join(
        app.getPath("userData"),
        "chat-sessions.json"
      );
    } catch {
      // app may not be ready yet in some contexts; fall back to cwd.
      this.sessionsFile = path.join(process.cwd(), "chat-sessions.json");
    }

    return this.sessionsFile;
  }

  _ensureLoaded() {
    if (this._loaded) {
      return;
    }

    this._loaded = true;

    const file = this._getSessionsFile();

    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));

        if (raw && typeof raw === "object") {
          for (const [id, session] of Object.entries(raw)) {
            this.sessions.set(id, session);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    }
  }

  _persist() {
    const file = this._getSessionsFile();

    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });

      const serialized = {};

      for (const [id, session] of this.sessions) {
        serialized[id] = session;
      }

      fs.writeFileSync(file, JSON.stringify(serialized, null, 2), "utf8");
    } catch (error) {
      console.error("Failed to persist chat sessions:", error);
    }
  }

  ensureSession(sessionId) {
    this._ensureLoaded();

    if (!sessionId) {
      return null;
    }

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    return this.sessions.get(sessionId);
  }

  appendMessage(sessionId, message) {
    const session = this.ensureSession(sessionId);

    if (!session) {
      return null;
    }

    session.messages.push({
      ...message,
      timestamp: message.timestamp || Date.now()
    });

    session.updatedAt = Date.now();

    this._persist();

    return session;
  }

  async getHistory() {
    this._ensureLoaded();

    return Array.from(this.sessions.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  }

  async getSession(sessionId) {
    this._ensureLoaded();
    return this.sessions.get(sessionId) || null;
  }

  async deleteSession(sessionId) {
    this._ensureLoaded();
    this.sessions.delete(sessionId);
    this._persist();
  }

  async clearHistory() {
    this._ensureLoaded();
    this.sessions.clear();
    this._persist();
  }

  clear() {
    this._ensureLoaded();
    this.sessions.clear();
    this._persist();
  }
}

const sessionManager = new SessionManager();

/**
 * Register all chat IPC handlers.
 */
function registerChatHandlers({
  ipcMain,
  BrowserWindow,
  sessionManager: injectedSessionManager,
  getAvailableModel,
  getActiveModel,
  getModelPath
}) {
  if (!ipcMain) {
    throw new Error("ipcMain is required.");
  }

  // Allow a caller to inject a different session manager (e.g. for tests),
  // but default to the module-level singleton so main.js's destructured
  // `sessionManager` is always a real, working object.
  const sessions = injectedSessionManager || sessionManager;

  /**
   * ------------------------------------------------------------
   * START STREAM
   * ------------------------------------------------------------
   */
  ipcMain.handle(
  "chat:stream",
  async (event, payload = {}) => {
    const senderWindow =
      BrowserWindow.fromWebContents(
        event.sender
      );

    /*
     * ------------------------------------------------------------
     * NORMALIZE PAYLOAD
     * ------------------------------------------------------------
     */

    const {
      message,
      messages,
      sessionId,
      model,
      temperature = 0.7,
      top_p = 0.9,
      top_k,
      max_tokens = 4096,
      repeat_penalty,
      systemPrompt,
      attachments = [],
    } = payload || {};

    /*
     * Normalize the message ONCE.
     */
    const userMessage =
      typeof message === "string"
        ? message.trim()
        : "";

    const fallbackInstruction =
      Array.isArray(attachments) && attachments.length > 0
        ? "Please analyze the attached file(s)."
        : "";

    /*
     * Never send an empty request to llama.cpp.
     */
    if (!userMessage && !fallbackInstruction) {
      console.error(
        "Rejected empty chat request.",
        {
          receivedType:
            typeof message,
          receivedMessage:
            message,
        }
      );

      return {
        success: false,
        error:
          "Message cannot be empty.",
      };
    }

    let messageWithAttachments;

    try {
      messageWithAttachments = await buildMessageWithAttachments(
        userMessage || fallbackInstruction,
        attachments
      );
    } catch (error) {
      console.error("Failed to process chat attachments:", error);
      return {
        success: false,
        error: error.message || "Failed to process attachments.",
      };
    }

    /*
     * ------------------------------------------------------------
     * REQUEST IDs
     * ------------------------------------------------------------
     */

    const sessionKey =
      sessionId ||
      createId("session");

    const assistantMessageId =
      createId("assistant");

    const requestId =
      createId("request");

    const abortController =
      new AbortController();

    activeRequests.set(
      requestId,
      {
        abortController,
        sessionId:
          sessionKey,
        messageId:
          assistantMessageId,
      }
    );

    /*
     * ------------------------------------------------------------
     * REQUEST
     * ------------------------------------------------------------
     */

    try {
      /*
       * Resolve model path.
       */
      let modelPath = null;

      try {
        if (
          typeof getModelPath ===
          "function"
        ) {
          modelPath =
            await getModelPath(
              model
            );
        }
      } catch (error) {
        console.warn(
          "Could not resolve model path:",
          error.message
        );
      }

      if (!modelPath) {
        try {
          if (
            typeof getActiveModel ===
            "function"
          ) {
            const active =
              await getActiveModel();

            if (
              active &&
              typeof active.path ===
                "string"
            ) {
              modelPath =
                active.path;
            }
          }
        } catch {
          // Continue.
        }
      }

      if (!modelPath) {
        try {
          if (
            typeof getAvailableModel ===
            "function"
          ) {
            const available =
              await getAvailableModel();

            if (
              available &&
              typeof available.path ===
                "string"
            ) {
              modelPath =
                available.path;
            }
          }
        } catch {
          // Continue.
        }
      }

      /*
       * ----------------------------------------------------------
       * MESSAGE HISTORY
       * ----------------------------------------------------------
       */

      let chatMessages = [];

      if (
        Array.isArray(messages)
      ) {
        chatMessages =
          normalizeMessages(
            messages
          );
      }

      /*
       * Make absolutely certain the current user message is present.
       */
      const lastMessage =
        chatMessages[
          chatMessages.length - 1
        ];

      if (
        !lastMessage ||
        lastMessage.role !==
          "user" ||
        lastMessage.content !==
          messageWithAttachments
      ) {
        chatMessages.push({
          role: "user",
          content:
            messageWithAttachments,
        });
      }

      /*
       * System prompt.
       */
      if (
        typeof systemPrompt ===
          "string" &&
        systemPrompt.trim()
      ) {
        const hasSystem =
          chatMessages.some(
            (item) =>
              item.role ===
              "system"
          );

        if (!hasSystem) {
          chatMessages.unshift({
            role: "system",
            content:
              systemPrompt.trim(),
          });
        }
      }

      /*
       * Persist user message.
       */
      sessions.appendMessage(
        sessionKey,
        {
          role: "user",
          content:
            messageWithAttachments,
        }
      );

      /*
       * ----------------------------------------------------------
       * LLAMA REQUEST
       * ----------------------------------------------------------
       */

      const requestBody = {
        model:
          (
            modelPath
              ? modelPath.split(
                  /[\\/]/
                ).pop()
              : null
          ) ||
          model ||
          "local-model",

        messages:
          chatMessages,

        temperature:
          Number.isFinite(
            Number(temperature)
          )
            ? Number(
                temperature
              )
            : 0.7,

        top_p:
          Number.isFinite(
            Number(top_p)
          )
            ? Number(top_p)
            : 0.9,

        max_tokens:
          Number.isFinite(
            Number(max_tokens)
          )
            ? Number(max_tokens)
            : 4096,

        stream: true,
      };

      if (
        Number.isFinite(
          Number(top_k)
        )
      ) {
        requestBody.top_k =
          Number(top_k);
      }

      if (
        Number.isFinite(
          Number(repeat_penalty)
        )
      ) {
        requestBody.repeat_penalty =
          Number(
            repeat_penalty
          );
      }

      console.log(
        "Starting llama inference..."
      );

      console.log(
        "llama endpoint:",
        LLAMA_CHAT_ENDPOINT
      );

      console.log(
        "Model:",
        requestBody.model
      );

      console.log(
        "Request ID:",
        requestId
      );

      /*
       * ----------------------------------------------------------
       * START EVENT
       * ----------------------------------------------------------
       */

      sendStreamUpdate(
        senderWindow,
        {
          type: "start",
          requestId,
          messageId:
            assistantMessageId,
          sessionId:
            sessionKey,
        }
      );

      let fullResponse = "";

      const startedAt =
        Date.now();

      /*
       * ----------------------------------------------------------
       * CONNECT TO LLAMA
       * ----------------------------------------------------------
       */

      let response;

      try {
        response =
          await axios.post(
            LLAMA_CHAT_ENDPOINT,
            requestBody,
            {
              responseType:
                "stream",

              timeout:
                120000,

              signal:
                abortController.signal,

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "text/event-stream",

                "Cache-Control":
                  "no-cache",
              },

              validateStatus:
                (status) =>
                  status >= 200 &&
                  status < 300,
            }
          );
      } catch (error) {
        if (
          abortController.signal
            .aborted
        ) {
          sendStreamUpdate(
            senderWindow,
            {
              type: "stopped",
              requestId,
              messageId:
                assistantMessageId,
              sessionId:
                sessionKey,
              content:
                fullResponse,
            }
          );

          sessions.appendMessage(
            sessionKey,
            {
              role: "assistant",
              content:
                fullResponse,
              stopped: true,
            }
          );

          return {
            success: true,
            stopped: true,
            content:
              fullResponse,
            requestId,
            messageId:
              assistantMessageId,
            sessionId:
              sessionKey,
          };
        }

        const status =
          error.response?.status;

        const serverData =
          error.response?.data;

        let detail =
          error.message ||
          "llama-server request failed.";

        if (
          typeof serverData ===
          "string"
        ) {
          detail =
            serverData ||
            detail;
        }

        console.error(
          "llama-server request failed:",
          {
            status,
            detail,
          }
        );

        throw new Error(
          `llama-server request failed${
            status
              ? ` (HTTP ${status})`
              : ""
          }: ${detail}`
        );
      }

      if (
        !response ||
        !response.data
      ) {
        throw new Error(
          "llama-server returned an empty response."
        );
      }

      console.log(
        "llama-server connection established."
      );

      console.log(
        "HTTP status:",
        response.status
      );

      /*
       * ----------------------------------------------------------
       * SSE STREAM PARSER
       * ----------------------------------------------------------
       *
       * Do NOT depend exclusively on \n\n.
       *
       * llama.cpp normally emits:
       *
       * data: {...}\n\n
       *
       * but chunk boundaries from Node's HTTP stream do not
       * necessarily correspond to SSE boundaries.
       *
       * We therefore buffer by LINE and process each `data:`
       * line as soon as it is complete.
       */

      let buffer = "";

      const processDataLine =
        (line) => {
          const trimmed =
            line.trim();

          if (
            !trimmed ||
            trimmed.startsWith(":")
          ) {
            return;
          }

          if (
            !trimmed.startsWith(
              "data:"
            )
          ) {
            return;
          }

          const data =
            trimmed
              .slice(5)
              .trim();

          if (
            !data ||
            data === "[DONE]"
          ) {
            return;
          }

          let parsed;

          try {
            parsed =
              JSON.parse(data);
          } catch {
            /*
             * The caller only gives us a complete line.
             *
             * If JSON is still invalid, ignore it rather than
             * killing the entire stream.
             */
            return;
          }

          if (
            parsed &&
            parsed.error
          ) {
            const errorMessage =
              typeof parsed.error ===
              "string"
                ? parsed.error
                : parsed.error?.message ||
                  "llama-server returned an error.";

            throw new Error(
              errorMessage
            );
          }

          const content =
            extractStreamContent(
              parsed
            );

          if (!content) {
            return;
          }

          /*
           * ACCUMULATE
           */
          fullResponse +=
            content;

          /*
           * IMMEDIATELY PUSH TOKEN
           */
          const sent =
            sendStreamUpdate(
              senderWindow,
              {
                type: "content",
                requestId,
                messageId:
                  assistantMessageId,
                sessionId:
                  sessionKey,
                content,
              }
            );

          if (!sent) {
            console.warn(
              "Could not send stream chunk to renderer."
            );
          }
        };

      /*
       * Process incoming Node stream chunks.
       */
      const processChunk =
        (chunk) => {
          buffer +=
            chunk.toString(
              "utf8"
            );

          /*
           * Normalize CRLF.
           */
          buffer =
            buffer.replace(
              /\r\n/g,
              "\n"
            );

          /*
           * Process every complete line.
           */
          let newlineIndex;

          while (
            (newlineIndex =
              buffer.indexOf(
                "\n"
              )) !== -1
          ) {
            const line =
              buffer.slice(
                0,
                newlineIndex
              );

            buffer =
              buffer.slice(
                newlineIndex + 1
              );

            processDataLine(
              line
            );
          }
        };

      /*
       * ----------------------------------------------------------
       * STREAM PROMISE
       * ----------------------------------------------------------
       */

      const finalResult =
        await new Promise(
          (resolve, reject) => {
            let settled =
              false;

            const finish =
              () => {
                if (settled) {
                  return;
                }

                settled = true;

                /*
                 * Process any final unterminated line.
                 */
                if (
                  buffer.trim()
                ) {
                  try {
                    processDataLine(
                      buffer
                    );
                  } catch (error) {
                    reject(error);
                    return;
                  }

                  buffer = "";
                }

                const elapsed =
                  Date.now() -
                  startedAt;

                /*
                 * This is an approximate token count.
                 */
                const generatedTokens =
                  fullResponse
                    .trim()
                    .split(
                      /\s+/
                    )
                    .filter(
                      Boolean
                    ).length;

                const metrics = {
                  responseTime:
                    elapsed,

                  generatedTokens,

                  contentLength:
                    fullResponse.length,
                };

                console.log(
                  "Inference completed successfully."
                );

                console.log(
                  "Generated tokens:",
                  generatedTokens
                );

                console.log(
                  "Response time:",
                  elapsed,
                  "ms"
                );

                /*
                 * ------------------------------------------------
                 * FINAL EVENT
                 * ------------------------------------------------
                 */

                sendStreamUpdate(
                  senderWindow,
                  {
                    type: "done",
                    requestId,
                    messageId:
                      assistantMessageId,
                    sessionId:
                      sessionKey,
                    content:
                      fullResponse,
                    metrics,
                  }
                );

                /*
                 * Persist assistant response.
                 */
                sessions.appendMessage(
                  sessionKey,
                  {
                    role: "assistant",
                    content:
                      fullResponse,
                    metrics,
                  }
                );

                resolve({
                  success: true,
                  type: "done",
                  content:
                    fullResponse,
                  requestId,
                  messageId:
                    assistantMessageId,
                  sessionId:
                    sessionKey,
                  metrics,
                });
              };

            /*
             * ------------------------------------------------------
             * DATA
             * ------------------------------------------------------
             */

            response.data.on(
              "data",
              (chunk) => {
                try {
                  processChunk(
                    chunk
                  );
                } catch (error) {
                  console.error(
                    "SSE processing error:",
                    error
                  );

                  try {
                    response.data.destroy(
                      error
                    );
                  } catch {
                    // Ignore.
                  }
                }
              }
            );

            /*
             * ------------------------------------------------------
             * END
             * ------------------------------------------------------
             */

            response.data.on(
              "end",
              () => {
                try {
                  finish();
                } catch (error) {
                  reject(error);
                }
              }
            );

            /*
             * ------------------------------------------------------
             * CLOSE
             * ------------------------------------------------------
             */

            response.data.on(
              "close",
              () => {
                if (
                  !settled &&
                  response.data
                    .readableEnded
                ) {
                  try {
                    finish();
                  } catch (error) {
                    reject(error);
                  }
                }
              }
            );

            /*
             * ------------------------------------------------------
             * ERROR
             * ------------------------------------------------------
             */

            response.data.on(
              "error",
              (error) => {
                if (settled) {
                  return;
                }

                settled =
                  true;

                if (
                  abortController
                    .signal
                    .aborted
                ) {
                  sendStreamUpdate(
                    senderWindow,
                    {
                      type: "stopped",
                      requestId,
                      messageId:
                        assistantMessageId,
                      sessionId:
                        sessionKey,
                      content:
                        fullResponse,
                    }
                  );

                  sessions.appendMessage(
                    sessionKey,
                    {
                      role:
                        "assistant",
                      content:
                        fullResponse,
                      stopped: true,
                    }
                  );

                  resolve({
                    success: true,
                    stopped:
                      true,
                    content:
                      fullResponse,
                    requestId,
                    messageId:
                      assistantMessageId,
                    sessionId:
                      sessionKey,
                  });

                  return;
                }

                /*
                 * Notify renderer.
                 */
                sendStreamUpdate(
                  senderWindow,
                  {
                    type: "error",
                    requestId,
                    messageId:
                      assistantMessageId,
                    sessionId:
                      sessionKey,
                    error:
                      error.message ||
                      "AI stream failed.",
                  }
                );

                reject(error);
              }
            );
          }
        );

      return finalResult;
    } catch (error) {
      /*
       * ------------------------------------------------------------
       * TOP LEVEL ERROR
       * ------------------------------------------------------------
       */

      console.error(
        "Chat stream handler error:",
        error
      );

      /*
       * Do not send an error after cancellation.
       */
      if (
        abortController.signal
          .aborted
      ) {
        sendStreamUpdate(
          senderWindow,
          {
            type: "stopped",
            requestId,
            messageId:
              assistantMessageId,
            sessionId:
              sessionKey,
          }
        );

        return {
          success: true,
          stopped: true,
          content: "",
          requestId,
          messageId:
            assistantMessageId,
          sessionId:
            sessionKey,
        };
      }

      sendStreamUpdate(
        senderWindow,
        {
          type: "error",
          requestId,
          messageId:
            assistantMessageId,
          sessionId:
            sessionKey,
          error:
            error?.message ||
            "AI generation failed.",
        }
      );

      return {
        success: false,
        error:
          error?.message ||
          "AI generation failed.",
        requestId,
        messageId:
          assistantMessageId,
        sessionId:
          sessionKey,
      };
    } finally {
      /*
       * ALWAYS clean up.
       */
      activeRequests.delete(
        requestId
      );
    }
  });

  /**
   * ------------------------------------------------------------
   * STOP GENERATION
   * ------------------------------------------------------------
   */
  ipcMain.handle(
  "chat:stop",
  async (
    event,
    payload = {}
  ) => {
    const {
      requestId,
      messageId,
      sessionId,
    } = payload || {};

    let stopped = false;

    /*
     * First preference: exact request ID.
     */
    if (requestId) {
      const request =
        activeRequests.get(
          requestId
        );

      if (request) {
        try {
          request.abortController.abort();
        } catch {
          // Ignore.
        }

        activeRequests.delete(
          requestId
        );

        stopped = true;
      }
    }

    /*
     * Fallback: message/session.
     */
    if (!stopped) {
      for (
        const [
          id,
          request,
        ] of activeRequests
      ) {
        if (
          (
            messageId &&
            request.messageId ===
              messageId
          ) ||
          (
            sessionId &&
            request.sessionId ===
              sessionId
          )
        ) {
          try {
            request.abortController.abort();
          } catch {
            // Ignore.
          }

          activeRequests.delete(
            id
          );

          stopped = true;

          break;
        }
      }
    }

    return {
      success: true,
      stopped,
    };
  }
);

  /**
   * ------------------------------------------------------------
   * CHAT HISTORY
   * ------------------------------------------------------------
   */
  ipcMain.handle("chat:history", async () => {
    return sessions.getHistory();
  });

  /**
   * ------------------------------------------------------------
   * GET SESSION
   * ------------------------------------------------------------
   */
  ipcMain.handle("chat:session", async (event, sessionId) => {
    return sessions.getSession(sessionId);
  });

  /**
   * ------------------------------------------------------------
   * DELETE SESSION
   * ------------------------------------------------------------
   */
  ipcMain.handle("chat:delete", async (event, sessionId) => {
    await sessions.deleteSession(sessionId);
    return { success: true };
  });

  /**
   * ------------------------------------------------------------
   * CLEAR HISTORY
   * ------------------------------------------------------------
   */
  ipcMain.handle("chat:clear", async () => {
    await sessions.clearHistory();
    return { success: true };
  });

  /**
   * ------------------------------------------------------------
   * ACTIVE REQUEST CLEANUP
   * ------------------------------------------------------------
   */
  process.on("exit", () => {
    for (const request of activeRequests.values()) {
      try {
        request.abortController.abort();
      } catch {
        // Ignore.
      }
    }

    activeRequests.clear();
  });

  console.log("Chat IPC handlers initialized.");
}

module.exports = {
  registerChatHandlers,
  extractStreamContent,
  sendStreamUpdate,
  sessionManager
};