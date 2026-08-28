import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Bot,
  Copy,
  Check,
  Code,
  FileText,
  Image,
  Video,
  Mic,
  Download,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useProfile } from "../../contexts/ProfileContext";
import { resolveImagePath, getDefaultAvatar } from "../../utils/imageResolver";

const Message = ({ message }) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const { profile } = useProfile();

  const getBackgroundColor = () => {
    if (isUser) {
      return resolvedTheme === "dark"
        ? "bg-blue-900/20"
        : "bg-blue-50/70";
    }

    return resolvedTheme === "dark"
      ? "bg-gray-800/30"
      : "bg-white/80";
  };

  const getTextColor = () => {
    return resolvedTheme === "dark"
      ? "text-gray-100"
      : "text-gray-900";
  };

  const getMutedTextColor = () => {
    return resolvedTheme === "dark"
      ? "text-gray-500"
      : "text-gray-500";
  };

  const getBorderColor = () => {
    return resolvedTheme === "dark"
      ? "border-white/[0.06]"
      : "border-gray-200";
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    try {
      const date = new Date(timestamp);

      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatCodeBlocks = (content) => {
    if (!content) return null;

    const parts = content.split(
      /(```[\s\S]*?```|`[^`]*`)/g
    );

    return parts.map((part, index) => {
      if (
        part.startsWith("```") &&
        part.endsWith("```")
      ) {
        const languageMatch =
          part.match(/^```(\w+)?/);

        const language =
          languageMatch
            ? languageMatch[1]
            : "";

        const code = part
          .slice(
            language
              ? language.length + 3
              : 3,
            -3
          )
          .trim();

        return (
          <div
            key={index}
            className={`
              my-3
              overflow-hidden
              rounded-xl
              border
              ${getBorderColor()}
              ${
                resolvedTheme === "dark"
                  ? "bg-[#0b0e14]"
                  : "bg-gray-50"
              }
              shadow-sm
            `}
          >
            {language && (
              <div
                className={`
                  flex items-center justify-between
                  border-b
                  px-3 py-2
                  ${getBorderColor()}
                  ${
                    resolvedTheme === "dark"
                      ? "bg-white/[0.025]"
                      : "bg-gray-100"
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="
                      flex h-6 w-6
                      items-center justify-center
                      rounded-md
                      bg-blue-500/10
                    "
                  >
                    <Code className="h-3.5 w-3.5 text-blue-400" />
                  </div>

                  <span
                    className={`
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-wider
                      ${getTextColor()}
                    `}
                  >
                    {language}
                  </span>
                </div>

                <button
                  onClick={() =>
                    navigator.clipboard.writeText(code)
                  }
                  className={`
                    flex items-center gap-1.5
                    rounded-lg
                    border
                    px-2 py-1
                    text-[10px]
                    font-medium
                    transition-colors
                    ${getBorderColor()}
                    ${getMutedTextColor()}
                    ${
                      resolvedTheme === "dark"
                        ? "hover:bg-white/[0.06] hover:text-gray-200"
                        : "hover:bg-gray-200 hover:text-gray-800"
                    }
                  `}
                  aria-label="Copy code"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
            )}

            <pre className="custom-scrollbar overflow-x-auto p-3 text-xs leading-5">
              <code
                className={`
                  font-mono
                  ${
                    resolvedTheme === "dark"
                      ? "text-gray-200"
                      : "text-gray-800"
                  }
                `}
              >
                {code}
              </code>
            </pre>
          </div>
        );
      } else if (
        part.startsWith("`") &&
        part.endsWith("`")
      ) {
        const code = part.slice(1, -1);

        return (
          <code
            key={index}
            className={`
              rounded-md
              border
              px-1.5 py-0.5
              font-mono
              text-xs
              ${
                resolvedTheme === "dark"
                  ? "border-white/[0.06] bg-white/[0.06] text-gray-200"
                  : "border-gray-200 bg-gray-100 text-gray-800"
              }
            `}
          >
            {code}
          </code>
        );
      } else {
        return part
          .split("\n")
          .map((line, lineIndex) => (
            <div
              key={`${index}-${lineIndex}`}
              className={`
                text-sm
                leading-6
                ${getTextColor()}
              `}
            >
              {line}

              {lineIndex <
                part.split("\n").length - 1 && (
                <br />
              )}
            </div>
          ));
      }
    });
  };

  const renderContent = () => {
    if (!message.content) return null;

    return (
      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-p:leading-relaxed">
        {formatCodeBlocks(message.content)}
      </div>
    );
  };

  const getFileIcon = (fileType) => {
    if (
      fileType?.startsWith("image/")
    ) {
      return (
        <Image className="h-3.5 w-3.5 text-emerald-400" />
      );
    }

    if (
      fileType?.startsWith("video/")
    ) {
      return (
        <Video className="h-3.5 w-3.5 text-violet-400" />
      );
    }

    if (fileType?.includes("pdf")) {
      return (
        <FileText className="h-3.5 w-3.5 text-red-400" />
      );
    }

    if (fileType?.includes("audio")) {
      return (
        <Mic className="h-3.5 w-3.5 text-blue-400" />
      );
    }

    return (
      <FileText className="h-3.5 w-3.5 text-gray-500" />
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";

    if (bytes < 1024 * 1024) {
      return (
        (bytes / 1024).toFixed(1) +
        " KB"
      );
    }

    return (
      (bytes / (1024 * 1024)).toFixed(1) +
      " MB"
    );
  };

  const renderAttachments = () => {
    if (
      !message.attachments ||
      message.attachments.length === 0
    ) {
      return null;
    }

    return (
      <div className="mt-3 space-y-2">
        <div
          className={`
            text-[10px]
            font-semibold
            uppercase
            tracking-wider
            ${getMutedTextColor()}
          `}
        >
          Attachments ({message.attachments.length})
        </div>

        {message.attachments.map(
          (file, index) => (
            <div
              key={index}
              className={`
                flex items-center gap-2
                rounded-xl
                border
                p-2
                ${
                  resolvedTheme === "dark"
                    ? "border-blue-400/10 bg-blue-500/[0.05]"
                    : "border-blue-100 bg-blue-50/70"
                }
              `}
            >
              {file.type === "image" ? (
                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-white/10">
                  <img
                    src={
                      file.previewUrl ||
                      "images/offyai.png"
                    }
                    alt={
                      file.originalName ||
                      file.name
                    }
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.style.display =
                        "none";
                    }}
                  />
                </div>
              ) : (
                <div
                  className={`
                    flex h-9 w-9
                    flex-shrink-0
                    items-center justify-center
                    rounded-lg
                    ${
                      resolvedTheme === "dark"
                        ? "bg-blue-500/10"
                        : "bg-blue-100"
                    }
                  `}
                >
                  {getFileIcon(
                    file.type || "file"
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div
                  className={`
                    truncate
                    text-xs
                    font-medium
                    ${
                      resolvedTheme === "dark"
                        ? "text-blue-200"
                        : "text-blue-700"
                    }
                  `}
                >
                  {file.originalName ||
                    file.name}
                </div>

                <div
                  className={`
                    mt-0.5
                    text-[10px]
                    ${
                      resolvedTheme === "dark"
                        ? "text-blue-400/70"
                        : "text-blue-600"
                    }
                  `}
                >
                  {formatFileSize(
                    file.size || 0
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  if (
                    file.path &&
                    window.electronAPI
                  ) {
                    window.electronAPI.openFile(
                      file.path
                    );
                  }
                }}
                className={`
                  rounded-lg
                  p-1.5
                  transition-colors
                  ${
                    resolvedTheme === "dark"
                      ? "text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                  }
                `}
                aria-label={`Open ${file.originalName || file.name}`}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 4,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.15,
      }}
      className={`
        flex gap-2.5
        px-3 py-2.5
        sm:px-4
        ${
          isUser
            ? "justify-end"
            : "justify-start"
        }
      `}
    >
      {/* Avatar - Assistant */}

      {!isUser && (
        <div className="flex-shrink-0 pt-5">
          <div
                      className="
                        h-8 w-8
                        flex-shrink-0
                        overflow-hidden
                        rounded-xl
                        border border-blue-400/10
                        bg-gradient-to-br
                        from-blue-500
                        to-violet-600
                        shadow-sm
                        shadow-blue-950/20
                      "
                    >
                      {profile?.aiPhoto ? (
                        <img
                          src={profile.aiPhoto}
                          alt={profile?.aiName || "AI"}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
          </div>
        </div>
      )}

      {/* Message Content */}

      <div
        className={`
          flex max-w-[80%]
          flex-col
          ${
            isUser
              ? "items-end"
              : "items-start"
          }
        `}
      >
        {/* Header */}

        <div
          className={`
            mb-1.5
            flex items-center gap-1.5
            px-1
          `}
        >
          <span
            className={`
              text-[11px]
              font-semibold
              ${getTextColor()}
            `}
          >
            {isUser
              ? profile?.userName || "You"
              : profile?.aiName || "OffyAI"}
          </span>

          <span
            className={`
              text-[10px]
              ${getMutedTextColor()}
            `}
          >
            {formatTime(
              message.timestamp
            )}
          </span>

          {message.model && (
            <span
              className={`
                rounded-md
                border
                px-1.5 py-0.5
                text-[9px]
                font-medium
                ${getBorderColor()}
                ${
                  resolvedTheme === "dark"
                    ? "bg-white/[0.035] text-gray-500"
                    : "bg-gray-100 text-gray-500"
                }
              `}
            >
              {message.model}
            </span>
          )}
        </div>

        {/* Message Body */}

        <div
          className={`
            w-full
            rounded-2xl
            border
            p-3
            ${
              isUser
                ? resolvedTheme === "dark"
                  ? "rounded-tr-md border-blue-400/10 bg-blue-600/10"
                  : "rounded-tr-md border-blue-100 bg-blue-50"
                : resolvedTheme === "dark"
                ? "rounded-tl-md border-white/[0.06] bg-white/[0.025]"
                : "rounded-tl-md border-gray-200 bg-white"
            }
            shadow-sm
          `}
        >
          <div
            className={`
              text-sm
              ${
                isUser
                  ? resolvedTheme === "dark"
                    ? "text-gray-100"
                    : "text-gray-800"
                  : getTextColor()
              }
            `}
          >
            {renderContent()}
            {renderAttachments()}
          </div>

          {/* Actions */}

          {message.content &&
            !isUser && (
              <div className="mt-2 flex items-center">
                <button
                  onClick={handleCopy}
                  className={`
                    flex items-center gap-1.5
                    rounded-lg
                    border
                    px-2 py-1
                    text-[10px]
                    font-medium
                    transition-all duration-150
                    ${getBorderColor()}
                    ${getMutedTextColor()}
                    ${
                      resolvedTheme === "dark"
                        ? "hover:bg-white/[0.05] hover:text-gray-300"
                        : "hover:bg-gray-100 hover:text-gray-800"
                    }
                  `}
                  aria-label={
                    copied
                      ? "Message copied"
                      : "Copy message"
                  }
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Avatar - User */}

      {isUser && (
        <div className="flex-shrink-0 pt-5">
          <div
                      className="
                        h-8 w-8
                        flex-shrink-0
                        overflow-hidden
                        rounded-xl
                        border border-blue-400/10
                        bg-blue-600
                        shadow-sm
                        shadow-blue-950/20
                      "
                    >
                      {profile?.userPhoto ? (
                        <img
                          src={profile.userPhoto}
                          alt={profile?.userName || "User"}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Message;
