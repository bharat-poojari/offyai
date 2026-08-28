import React, { useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  Check,
} from "lucide-react";

const ChatHistory = ({
  chatSessions = [],
  currentSessionId = null,
  onCreateNewChat = (title) => {},
  onSwitchChat = () => {},
  onDeleteChat = () => {},
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0)
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)
      return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (showDeleteConfirm === id) {
      onDeleteChat(id);
      setShowDeleteConfirm(null);
    } else {
      setShowDeleteConfirm(id);
      setTimeout(() => setShowDeleteConfirm(null), 3000);
    }
  };

  // Always derive session title from first user message
  const getSessionTitle = (session) => {
    if (session.messages && session.messages.length > 0) {
      const firstUserMsg = session.messages.find((m) => m.role === "user");
      if (firstUserMsg && firstUserMsg.content) {
        return firstUserMsg.content.length > 40
          ? firstUserMsg.content.slice(0, 40) + "..."
          : firstUserMsg.content;
      }
    }
    return "New Chat";
  };

  // Button label: next chat should start blank
  const newChatLabel = "New Chat";

  return (
    <div className="h-full flex flex-col bg-transparent">
      <button
        onClick={() => onCreateNewChat(newChatLabel)}
        className="
          group relative
          flex items-center gap-3
          mx-2 mt-1 mb-3
          px-3.5 py-2.5
          rounded-xl
          border border-white/[0.06]
          bg-white/[0.025]
          text-gray-300
          transition-all duration-200
          hover:bg-white/[0.055]
          hover:border-white/[0.09]
          hover:text-white
          active:scale-[0.99]
        "
      >
        <span
          className="
            flex h-8 w-8 shrink-0
            items-center justify-center
            rounded-lg
            bg-blue-500/10
            text-blue-400
            transition-colors duration-200
            group-hover:bg-blue-500/15
          "
        >
          <Plus className="h-4 w-4" />
        </span>

        <span className="text-sm font-medium">
          {newChatLabel}
        </span>
      </button>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700/40 hover:scrollbar-thumb-gray-600/60">
        {chatSessions.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-16 text-center">
            <div
              className="
                flex h-12 w-12
                items-center justify-center
                rounded-2xl
                border border-white/[0.06]
                bg-white/[0.025]
                mb-4
              "
            >
              <MessageSquare className="h-5 w-5 text-gray-500" />
            </div>

            <p className="text-sm font-medium text-gray-400">
              No chats yet
            </p>

            <p className="mt-1 max-w-[190px] text-xs leading-5 text-gray-600">
              Start a conversation to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-2 pb-3">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSwitchChat(session.id)}
                className={`
                  group relative cursor-pointer
                  rounded-xl
                  border
                  px-3 py-2.5
                  transition-all duration-150
                  ${
                    currentSessionId === session.id
                      ? "border-blue-500/15 bg-blue-500/[0.10] text-white shadow-sm"
                      : "border-transparent text-gray-400 hover:border-white/[0.045] hover:bg-white/[0.035] hover:text-gray-200"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Chat icon */}
                  <div
                    className={`
                      flex h-8 w-8 shrink-0
                      items-center justify-center
                      rounded-lg
                      transition-colors duration-150
                      ${
                        currentSessionId === session.id
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-white/[0.035] text-gray-600 group-hover:text-gray-400"
                      }
                    `}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>

                  {/* Chat information */}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`
                        truncate text-[13px] font-medium
                        ${
                          currentSessionId === session.id
                            ? "text-gray-100"
                            : "text-gray-300"
                        }
                      `}
                    >
                      {getSessionTitle(session)}
                    </div>

                    <div
                      className={`
                        mt-1 flex items-center gap-1.5
                        text-[10px]
                        ${
                          currentSessionId === session.id
                            ? "text-blue-300/70"
                            : "text-gray-600 group-hover:text-gray-500"
                        }
                      `}
                    >
                      <Clock className="h-3 w-3 shrink-0" />

                      <span className="truncate">
                        {formatTime(session.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    aria-label={
                      showDeleteConfirm === session.id
                        ? "Confirm delete"
                        : "Delete chat"
                    }
                    className={`
                      shrink-0
                      rounded-lg
                      p-1.5
                      transition-all duration-150
                      ${
                        showDeleteConfirm === session.id
                          ? "bg-red-500/15 text-red-400 opacity-100 hover:bg-red-500/20"
                          : "text-gray-600 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                      }
                    `}
                  >
                    {showDeleteConfirm === session.id ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Active indicator */}
                {currentSessionId === session.id && (
                  <div className="absolute bottom-2.5 left-0 h-4 w-0.5 rounded-r-full bg-blue-400" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;

