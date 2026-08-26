import React, { useState } from "react";
import { MessageSquare, Plus, Trash2, Clock } from "lucide-react";

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
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)
      return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
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
    return "New Chat"; // fallback if no messages
  };

  // Button label: next chat should start blank
  const newChatLabel = "New Chat";

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <button
        onClick={() => onCreateNewChat(newChatLabel)}
        className="flex items-center gap-3 p-3 m-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span>{newChatLabel}</span>
      </button>

      <div className="flex-1 overflow-y-auto">
        {chatSessions.length === 0 ? (
          <div className="text-center text-gray-400 p-4">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No chats yet</p>
            <p className="text-xs">Start a conversation to see it here</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSwitchChat(session.id)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  currentSessionId === session.id
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-700 text-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">
                      {getSessionTitle(session)}
                    </div>
                    <div
                      className={`text-xs flex items-center gap-1 mt-1 ${
                        currentSessionId === session.id
                          ? "text-blue-100"
                          : "text-gray-400"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {formatTime(session.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500 rounded transition-all"
                  >
                    {showDeleteConfirm === session.id ? (
                      <span className="text-xs text-white">Confirm?</span>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
