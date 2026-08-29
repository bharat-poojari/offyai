import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import {
  Send,
  StopCircle,
  Bot,
  Paperclip,
  Image,
  FileText,
  Mic,
  Video,
  Zap,
  Code,
  X,
  AlertCircle,
} from "lucide-react";

import {
  motion,
} from "framer-motion";

import Message from "./Message";
import FileUploadModal from "../modals/FileUploadModal";
import { useTheme } from "../../contexts/ThemeContext";

const ChatInterface = ({
  currentChat,
  messages = [],
  isLoading = false,
  error = null,
  sendMessage = async () => false,
  stopGeneration = () => {},
}) => {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [showFileUpload, setShowFileUpload] =
    useState(false);
  const [isComposing, setIsComposing] =
    useState(false);

  const messagesEndRef =
    useRef(null);

  const inputRef =
    useRef(null);

  const {
    resolvedTheme,
  } = useTheme();

  /*
   * --------------------------------------------------------------------------
   * RESET WHEN CHAT CHANGES
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    setInput("");
    setAttachments([]);
  }, [currentChat?.id]);

  /*
   * --------------------------------------------------------------------------
   * AUTO SCROLL
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (!messagesEndRef.current) {
      return;
    }

    messagesEndRef.current.scrollIntoView({
      behavior: isLoading
        ? "auto"
        : "smooth",
      block: "end",
    });
  }, [messages, isLoading]);

  /*
   * --------------------------------------------------------------------------
   * FOCUS
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (
      inputRef.current &&
      !isLoading &&
      currentChat
    ) {
      inputRef.current.focus();
    }
  }, [
    currentChat?.id,
    isLoading,
  ]);

  /*
   * --------------------------------------------------------------------------
   * SUBMIT
   * --------------------------------------------------------------------------
   */

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();

      if (
        isLoading ||
        !currentChat
      ) {
        return;
      }

      /*
       * Snapshot the input BEFORE clearing it.
       */
      const currentInput =
        typeof input === "string"
          ? input.trim()
          : "";

      const currentAttachments =
        Array.isArray(attachments)
          ? [...attachments]
          : [];

      /*
       * Allow attachment-only submissions when a valid file is included.
       * For supported document/text files, the backend will extract the
       * content and inject it into the final prompt.
       */
      if (
        !currentInput &&
        currentAttachments.length === 0
      ) {
        return;
      }

      /*
       * Clear UI immediately.
       */
      setInput("");
      setAttachments([]);

      try {
        const result =
          await sendMessage(
            currentInput,
            "default",
            currentAttachments
          );

        /*
         * useChat returns false for a failed request.
         *
         * Restore the draft in that case.
         */
        if (result === false) {
          setInput(currentInput);
          setAttachments(
            currentAttachments
          );
        }
      } catch (error) {
        console.error(
          "Send failed:",
          error
        );

        setInput(currentInput);
        setAttachments(
          currentAttachments
        );
      }
    },
    [
      input,
      attachments,
      isLoading,
      currentChat,
      sendMessage,
    ]
  );

  /*
   * --------------------------------------------------------------------------
   * KEYBOARD
   * --------------------------------------------------------------------------
   */

  const handleKeyDown = useCallback(
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !isComposing &&
        !isLoading &&
        currentChat
      ) {
        event.preventDefault();

        void handleSubmit();
      }
    },
    [
      isComposing,
      isLoading,
      currentChat,
      handleSubmit,
    ]
  );

  /*
   * --------------------------------------------------------------------------
   * FILE UPLOAD
   * --------------------------------------------------------------------------
   */

  const handleFileUpload = useCallback(
    (files) => {
      if (!Array.isArray(files)) {
        return;
      }

      const validFiles =
        files.filter((file) => {
          if (!file) {
            return false;
          }

          const maxSize =
            100 * 1024 * 1024;

          if (
            Number(file.size) >
            maxSize
          ) {
            alert(
              `File ${file.name} is too large. Maximum size is 100MB.`
            );

            return false;
          }

          return true;
        });

      setAttachments(
        (previous) => [
          ...previous,
          ...validFiles,
        ]
      );

      setShowFileUpload(false);
    },
    []
  );

  /*
   * --------------------------------------------------------------------------
   * REMOVE ATTACHMENT
   * --------------------------------------------------------------------------
   */

  const removeAttachment =
    useCallback(
      (index) => {
        setAttachments(
          (previous) =>
            previous.filter(
              (_, i) =>
                i !== index
            )
        );
      },
      []
    );

  /*
   * --------------------------------------------------------------------------
   * FILE ICON
   * --------------------------------------------------------------------------
   */

  const getFileIcon =
    useCallback(
      (fileType) => {
        if (
          fileType?.startsWith(
            "image/"
          )
        ) {
          return (
            <Image className="w-3.5 h-3.5 text-emerald-400" />
          );
        }

        if (
          fileType?.startsWith(
            "video/"
          )
        ) {
          return (
            <Video className="w-3.5 h-3.5 text-violet-400" />
          );
        }

        if (
          fileType?.includes("pdf")
        ) {
          return (
            <FileText className="w-3.5 h-3.5 text-red-400" />
          );
        }

        if (
          fileType?.includes("audio")
        ) {
          return (
            <Mic className="w-3.5 h-3.5 text-blue-400" />
          );
        }

        return (
          <FileText className="w-3.5 h-3.5 text-gray-500" />
        );
      },
      []
    );

  /*
   * --------------------------------------------------------------------------
   * FILE SIZE
   * --------------------------------------------------------------------------
   */

  const formatFileSize =
    useCallback(
      (bytes) => {
        const size =
          Number(bytes) || 0;

        if (size < 1024) {
          return `${size} B`;
        }

        if (
          size <
          1024 * 1024
        ) {
          return `${(
            size / 1024
          ).toFixed(1)} KB`;
        }

        return `${(
          size /
          (1024 * 1024)
        ).toFixed(1)} MB`;
      },
      []
    );

  const placeholderText =
    currentChat
      ? "Message OffyAI..."
      : "Create a new chat to start messaging...";

  /*
   * --------------------------------------------------------------------------
   * RENDER
   * --------------------------------------------------------------------------
   */

  return (
    <div
      className={`relative flex h-full flex-col ${
        resolvedTheme === "dark"
          ? "bg-[#0a0d13]"
          : "bg-gray-50"
      }`}
    >
      <FileUploadModal
        isOpen={
          showFileUpload
        }
        onClose={() =>
          setShowFileUpload(false)
        }
        onUpload={
          handleFileUpload
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* MESSAGES                                                           */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          flex-1
          overflow-y-auto
          custom-scrollbar
          scroll-smooth
        "
      >
        {!messages ||
        messages.length === 0 ? (
          <div
            className={`flex h-full items-center justify-center px-4 ${
              resolvedTheme === "dark"
                ? "text-gray-400"
                : "text-gray-500"
            }`}
          >
            <div className="mx-auto w-full max-w-md px-4">
              <motion.div
                initial={{
                  scale: 0.9,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                transition={{
                  duration: 0.35,
                }}
                className="
                  mx-auto mb-5
                  flex h-14 w-14
                  items-center justify-center
                  rounded-2xl
                  border border-blue-400/10
                  bg-gradient-to-br
                  from-blue-500/15
                  to-violet-500/15
                  shadow-lg shadow-blue-950/10
                "
              >
                <Bot className="h-7 w-7 text-blue-400" />
              </motion.div>

              <motion.h3
                initial={{
                  y: 12,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.05,
                }}
                className={`mb-1 text-center text-lg font-semibold tracking-tight ${
                  resolvedTheme === "dark"
                    ? "text-gray-100"
                    : "text-gray-900"
                }`}
              >
                Welcome to OffyAI
              </motion.h3>

              <motion.p
                initial={{
                  y: 12,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.1,
                }}
                className={`mx-auto mb-5 max-w-sm text-center text-xs leading-5 ${
                  resolvedTheme === "dark"
                    ? "text-gray-500"
                    : "text-gray-500"
                }`}
              >
                Start a conversation by sending a message below
              </motion.p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    icon: Zap,
                    text: "Fast responses",
                    color:
                      "text-emerald-400",
                  },
                  {
                    icon: FileText,
                    text: "File uploads",
                    color:
                      "text-blue-400",
                  },
                  {
                    icon: Image,
                    text: "Image support",
                    color:
                      "text-violet-400",
                  },
                  {
                    icon: Code,
                    text: "Code generation",
                    color:
                      "text-orange-400",
                  },
                ].map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={index}
                      className={`
                        flex items-center gap-2
                        rounded-xl
                        border
                        px-3 py-2
                        text-xs
                        ${
                          resolvedTheme === "dark"
                            ? "border-white/[0.05] bg-white/[0.025] text-gray-400"
                            : "border-gray-200 bg-white text-gray-500"
                        }
                      `}
                    >
                      <item.icon
                        className={`h-3.5 w-3.5 shrink-0 ${item.color}`}
                      />

                      <span>
                        {item.text}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1 px-3 py-3 sm:px-4">
            {messages.map(
              (
                message,
                index
              ) => (
                <Message
                  key={
                    message.id ||
                    index
                  }
                  message={
                    message
                  }
                />
              )
            )}
          </div>
        )}

        {/* STREAM STATUS */}

        {isLoading &&
          messages.some(
            (message) =>
              message.role ===
                "assistant" &&
              message.isStreaming
          ) && (
            <div
              className="
                flex items-center gap-2
                px-4 py-2
                text-xs text-gray-500
              "
            >
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-500" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-500 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-500 [animation-delay:300ms]" />
              </div>

              <span>
                Generating...
              </span>
            </div>
          )}

        <div
          ref={
            messagesEndRef
          }
          className="h-2"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ERROR                                                              */}
      {/* ------------------------------------------------------------------ */}

      {error && (
        <motion.div
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="
            mx-3 mb-2
            rounded-xl
            border border-red-500/15
            bg-red-500/[0.06]
            px-3 py-2
            text-red-400
          "
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">
                {error}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ATTACHMENTS                                                        */}
      {/* ------------------------------------------------------------------ */}

      {attachments.length > 0 && (
        <motion.div
          initial={{
            opacity: 0,
            height: 0,
          }}
          animate={{
            opacity: 1,
            height: "auto",
          }}
          className={`
            mx-3 mb-2
            rounded-xl
            border
            px-3 py-2
            ${
              resolvedTheme === "dark"
                ? "border-white/[0.06] bg-white/[0.025]"
                : "border-blue-100 bg-blue-50"
            }
          `}
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`
                text-xs font-medium
                ${
                  resolvedTheme === "dark"
                    ? "text-gray-300"
                    : "text-blue-700"
                }
              `}
            >
              Attached Files ({attachments.length})
            </span>

            <button
              type="button"
              onClick={() =>
                setAttachments([])
              }
              className={`
                rounded-md px-2 py-1
                text-[10px] font-medium
                transition-colors
                ${
                  resolvedTheme === "dark"
                    ? "text-gray-500 hover:bg-white/[0.05] hover:text-gray-300"
                    : "text-blue-600 hover:bg-blue-100 hover:text-blue-800"
                }
              `}
            >
              Clear all
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {attachments.map(
              (
                file,
                index
              ) => (
                <motion.div
                  key={index}
                  initial={{
                    scale: 0.9,
                    opacity: 0,
                  }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                  }}
                  className={`
                    flex items-center gap-2
                    rounded-lg
                    border
                    px-2 py-1.5
                    text-xs
                    ${
                      resolvedTheme === "dark"
                        ? "border-white/[0.06] bg-[#11151d]"
                        : "border-gray-200 bg-white"
                    }
                  `}
                >
                  {getFileIcon(
                    file.type
                  )}

                  <div className="min-w-0">
                    <div
                      className={`
                        max-w-[120px]
                        truncate
                        text-[11px]
                        font-medium
                        ${
                          resolvedTheme === "dark"
                            ? "text-gray-300"
                            : "text-gray-800"
                        }
                      `}
                    >
                      {file.name}
                    </div>

                    <div
                      className={`
                        mt-0.5 text-[9px]
                        ${
                          resolvedTheme === "dark"
                            ? "text-gray-600"
                            : "text-gray-500"
                        }
                      `}
                    >
                      {formatFileSize(
                        file.size
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeAttachment(
                        index
                      )
                    }
                    aria-label={`Remove ${file.name}`}
                    className="
                      rounded-md
                      p-1
                      text-gray-500
                      transition-colors
                      hover:bg-red-500/10
                      hover:text-red-400
                    "
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )
            )}
          </div>
        </motion.div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* INPUT                                                              */}
      {/* ------------------------------------------------------------------ */}

      <div
        className={`
          border-t
          p-3
          sm:px-4
          ${
            resolvedTheme === "dark"
              ? "border-white/[0.06] bg-[#0d1017]/90"
              : "border-gray-200 bg-white/90"
          }
          backdrop-blur-xl
        `}
      >
        <form
          onSubmit={
            handleSubmit
          }
          className="mx-auto flex max-w-4xl items-end gap-2"
        >
          {/* ATTACHMENT BUTTON */}

          <motion.button
            type="button"
            whileHover={{
              scale: 1.02,
            }}
            whileTap={{
              scale: 0.98,
            }}
            onClick={() =>
              setShowFileUpload(
                true
              )
            }
            disabled={
              !currentChat ||
              isLoading
            }
            className={`
              flex h-10 w-10
              shrink-0
              items-center justify-center
              rounded-xl
              border
              transition-all duration-200
              disabled:cursor-not-allowed
              disabled:opacity-30
              ${
                resolvedTheme === "dark"
                  ? "border-white/[0.07] bg-white/[0.025] text-gray-500 hover:bg-white/[0.06] hover:text-gray-200"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }
            `}
            title="Attach files"
            aria-label="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </motion.button>

          {/* INPUT */}

          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              onCompositionStart={() =>
                setIsComposing(
                  true
                )
              }
              onCompositionEnd={() =>
                setIsComposing(
                  false
                )
              }
              placeholder={
                placeholderText
              }
              disabled={
                isLoading
              }
              autoComplete="off"
              className={`
                h-10 w-full
                rounded-xl
                border
                px-3.5
                text-sm
                outline-none
                transition-all duration-200
                disabled:cursor-not-allowed
                disabled:opacity-50
                ${
                  resolvedTheme === "dark"
                    ? "border-white/[0.07] bg-white/[0.025] text-gray-100 placeholder-gray-600 focus:border-blue-500/40 focus:bg-white/[0.035] focus:ring-2 focus:ring-blue-500/10"
                    : "border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                }
              `}
            />
          </div>

          {/* SEND / STOP */}

          <motion.button
            type={
              isLoading
                ? "button"
                : "submit"
            }
            whileHover={{
              scale:
                isLoading
                  ? 1
                  : 1.02,
            }}
            whileTap={{
              scale: 0.98,
            }}
            onClick={
              isLoading
                ? (event) => {
                    event.preventDefault();
                    stopGeneration();
                  }
                : undefined
            }
            disabled={
              !isLoading &&
              (
                !currentChat ||
                (!input.trim() &&
                  attachments.length ===
                    0)
              )
            }
            className={`
              flex h-10
              shrink-0
              items-center justify-center
              gap-1.5
              rounded-xl
              px-3.5
              text-sm
              font-medium
              text-white
              shadow-sm
              transition-all duration-200
              active:scale-95
              disabled:cursor-not-allowed
              disabled:bg-gray-500
              disabled:opacity-40
              disabled:shadow-none
              ${
                isLoading
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }
            `}
          >
            {isLoading ? (
              <>
                <StopCircle className="h-3.5 w-3.5" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </>
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;

