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
            <Image className="w-3 h-3 text-green-500" />
          );
        }

        if (
          fileType?.startsWith(
            "video/"
          )
        ) {
          return (
            <Video className="w-3 h-3 text-purple-500" />
          );
        }

        if (
          fileType?.includes("pdf")
        ) {
          return (
            <FileText className="w-3 h-3 text-red-500" />
          );
        }

        if (
          fileType?.includes("audio")
        ) {
          return (
            <Mic className="w-3 h-3 text-blue-500" />
          );
        }

        return (
          <FileText className="w-3 h-3 text-gray-500" />
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
      className={`flex flex-col h-full ${
        resolvedTheme === "dark"
          ? "bg-gray-900"
          : "bg-white"
      } relative`}
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

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!messages ||
        messages.length === 0 ? (
          <div
            className={`flex items-center justify-center h-full ${
              resolvedTheme ===
              "dark"
                ? "text-gray-400"
                : "text-gray-500"
            } px-4`}
          >
            <div className="text-center max-w-md mx-auto p-4">
              <motion.div
                initial={{
                  scale: 0.8,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                transition={{
                  duration: 0.5,
                }}
                className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
              >
                <Bot className="w-6 h-6 text-white" />
              </motion.div>

              <motion.h3
                initial={{
                  y: 20,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.1,
                }}
                className={`text-base font-semibold ${
                  resolvedTheme ===
                  "dark"
                    ? "text-white"
                    : "text-gray-900"
                } mb-1`}
              >
                Welcome to OffyAI
              </motion.h3>

              <motion.p
                initial={{
                  y: 20,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.2,
                }}
                className={`${
                  resolvedTheme ===
                  "dark"
                    ? "text-gray-400"
                    : "text-gray-500"
                } mb-3 text-xs`}
              >
                Start a conversation by sending a message below
              </motion.p>

              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  {
                    icon: Zap,
                    text: "Fast responses",
                    color:
                      "text-green-500",
                  },
                  {
                    icon: FileText,
                    text: "File uploads",
                    color:
                      "text-blue-500",
                  },
                  {
                    icon: Image,
                    text: "Image support",
                    color:
                      "text-purple-500",
                  },
                  {
                    icon: Code,
                    text: "Code generation",
                    color:
                      "text-orange-500",
                  },
                ].map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={index}
                      className={`flex items-center gap-1 p-1 rounded ${
                        resolvedTheme ===
                        "dark"
                          ? "bg-gray-800"
                          : "bg-gray-100"
                      }`}
                    >
                      <item.icon
                        className={`w-2.5 h-2.5 ${item.color}`}
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
          <div className="space-y-1 px-3 py-2">
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
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:300ms]" />
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

      {/* ERROR */}

      {error && (
        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mx-3 mb-1 p-1.5 bg-red-100 border border-red-200 text-red-800 rounded text-xs"
        >
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                !
              </span>
            </div>

            <div className="flex-1">
              <p className="font-medium text-xs">
                {error}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ATTACHMENTS */}

      {attachments.length >
        0 && (
        <motion.div
          initial={{
            opacity: 0,
            height: 0,
          }}
          animate={{
            opacity: 1,
            height: "auto",
          }}
          className="mx-3 mt-1 p-1.5 bg-blue-50 border border-blue-200 rounded text-xs"
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-medium text-blue-700">
              Attached Files (
              {
                attachments.length
              }
              )
            </span>

            <button
              type="button"
              onClick={() =>
                setAttachments([])
              }
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all
            </button>
          </div>

          <div className="flex flex-wrap gap-0.5">
            {attachments.map(
              (
                file,
                index
              ) => (
                <motion.div
                  key={index}
                  initial={{
                    scale: 0.8,
                    opacity: 0,
                  }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                  }}
                  className={`flex items-center gap-0.5 px-1 py-0.5 rounded border shadow-sm ${
                    resolvedTheme ===
                    "dark"
                      ? "bg-gray-800"
                      : "bg-white"
                  } text-xs`}
                >
                  {getFileIcon(
                    file.type
                  )}

                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-medium ${
                        resolvedTheme ===
                        "dark"
                          ? "text-white"
                          : "text-gray-900"
                      } truncate max-w-[80px]`}
                    >
                      {file.name}
                    </div>

                    <div
                      className={`${
                        resolvedTheme ===
                        "dark"
                          ? "text-gray-400"
                          : "text-gray-500"
                      }`}
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
                    className="p-0.5 text-gray-400 hover:text-red-500 transition-colors rounded text-xs"
                  >
                    ×
                  </button>
                </motion.div>
              )
            )}
          </div>
        </motion.div>
      )}

      {/* INPUT */}

      <div
        className={`border-t ${
          resolvedTheme ===
          "dark"
            ? "border-gray-700 bg-gray-800"
            : "border-gray-200 bg-gray-50"
        } p-3`}
      >
        <form
          onSubmit={
            handleSubmit
          }
          className="flex gap-2 items-end"
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
            className={`flex-shrink-0 p-2 ${
              resolvedTheme ===
              "dark"
                ? "text-gray-400 hover:text-white hover:bg-gray-700"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
            } rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border ${
              resolvedTheme ===
              "dark"
                ? "border-gray-600"
                : "border-gray-300"
            }`}
            title="Attach files"
          >
            <Paperclip className="w-4 h-4" />
          </motion.button>

          {/* INPUT */}

          <div className="flex-1 relative">
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
                !currentChat ||
                isLoading
              }
              autoComplete="off"
              className={`w-full ${
                resolvedTheme ===
                "dark"
                  ? "bg-gray-700 text-white placeholder-gray-500"
                  : "bg-white text-gray-900 placeholder-gray-400"
              } border ${
                resolvedTheme ===
                "dark"
                  ? "border-gray-600"
                  : "border-gray-300"
              } rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm`}
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
                (!input.trim() && attachments.length === 0)
              )
            }
            className={`flex-shrink-0 h-9 px-4 ${
              isLoading
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            } disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 shadow hover:shadow-md disabled:shadow-none flex items-center justify-center gap-1.5 font-medium text-sm`}
          >
            {isLoading ? (
              <>
                <StopCircle className="w-3.5 h-3.5" />
                Stop
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Send
              </>
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;