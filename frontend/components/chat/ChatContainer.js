import React, { useState, useEffect, useRef } from "react";
import ChatHistory from "./ChatHistory";
import ChatInterface from "./ChatInterface";
import { useChat } from "../../hooks/useChat";
import { Menu, X, Plus, MessageSquare } from "lucide-react";

const ChatContainer = () => {
  const {
    chatSessions,
    currentSessionId,
    createNewChat,
    switchToChat,
    deleteChat,
    deleteAllChats,
    messages,
    sendMessage,
    stopGeneration,
    isLoading,
    error,
  } = useChat();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef(null);

  const currentChat =
    chatSessions.find((c) => c.id === currentSessionId) || null;

  // ---------------------------------------------------------------------------
  // RESPONSIVE DESIGN
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;

      setIsMobile(mobile);

      if (!mobile) {
        setIsSidebarOpen(true);
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // CLOSE SIDEBAR ON OUTSIDE CLICK - MOBILE
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMobile &&
        isSidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target)
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobile, isSidebarOpen]);

  // ---------------------------------------------------------------------------
  // KEYBOARD SHORTCUT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        createNewChat();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [createNewChat]);

  // ---------------------------------------------------------------------------
  // NEW CHAT
  // ---------------------------------------------------------------------------

  const handleNewChat = () => {
    createNewChat();

    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* MOBILE OVERLAY                                                     */}
      {/* ------------------------------------------------------------------ */}

      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SIDEBAR                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div
        ref={sidebarRef}
        className={`
          ${
            isMobile
              ? "fixed inset-y-0 left-0 z-50 w-72"
              : "relative w-72"
          }
          bg-gray-800/80 backdrop-blur-xl border-r border-gray-700/50
          transform transition-all duration-300 ease-in-out
          ${
            isMobile && !isSidebarOpen
              ? "-translate-x-full"
              : "translate-x-0"
          }
          flex flex-col shadow-2xl
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />

            <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Chat App
            </h1>
          </div>

          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-700/50 transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="
              w-full flex items-center justify-center gap-2
              px-4 py-2.5
              bg-gradient-to-r from-blue-500 to-purple-500
              hover:from-blue-600 hover:to-purple-600
              rounded-xl text-white font-medium
              transition-all duration-200
              transform hover:scale-[1.02]
              shadow-lg hover:shadow-blue-500/25
            "
          >
            <Plus className="w-4 h-4" />

            New Chat

            <span className="ml-auto text-xs opacity-60 bg-white/20 px-2 py-0.5 rounded">
              ⌘K
            </span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <ChatHistory
            chatSessions={chatSessions}
            currentSessionId={currentSessionId}
            onCreateNewChat={handleNewChat}
            onSwitchChat={(id) => {
              switchToChat(id);

              if (isMobile) {
                setIsSidebarOpen(false);
              }
            }}
            onDeleteChat={deleteChat}
            onDeleteAllChats={deleteAllChats}
          />
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-700/50">
          <div className="text-xs text-gray-400 text-center">
            {chatSessions.length} chats • Press ⌘K for new chat
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CHAT AREA                                                      */}
      {/* ------------------------------------------------------------------ */}

      <div className="flex-1 flex flex-col min-w-0 bg-gray-900/50 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/30 border-b border-gray-700/30">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {currentChat && (
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {currentChat.title || "New Chat"}
                </span>

                <span className="text-xs text-gray-400">
                  {messages.length} messages
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentChat && (
              <span className="text-xs px-2 py-1 bg-gray-700/50 rounded-full text-gray-300">
                {currentChat.model || "Default"}
              </span>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* CHAT INTERFACE                                                    */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex-1 overflow-hidden">
          <ChatInterface
            currentChat={currentChat}

            /*
             * IMPORTANT:
             *
             * This was missing.
             *
             * useChat() contains the live streaming messages, but
             * ChatInterface defaults messages to [] when this prop
             * is not supplied.
             *
             * Passing messages here allows every streaming update
             * to reach the Message component.
             */
            messages={messages}

            isLoading={isLoading}
            error={error}
            sendMessage={sendMessage}
            stopGeneration={stopGeneration}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default ChatContainer;