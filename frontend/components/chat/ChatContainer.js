import React, { useState, useEffect, useRef } from "react";
import ChatHistory from "./ChatHistory";
import ChatInterface from "./ChatInterface";
import { useChat } from "../../hooks/useChat";
import {
  Menu,
  X,
  Plus,
  MessageSquare,
  Keyboard,
} from "lucide-react";

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
    <div className="flex h-screen overflow-hidden bg-[#090b10] text-gray-100">
      {/* ------------------------------------------------------------------ */}
      {/* MOBILE OVERLAY                                                     */}
      {/* ------------------------------------------------------------------ */}

      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300"
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
          flex flex-col
          border-r border-white/[0.06]
          bg-[#0d1017]
          shadow-[4px_0_24px_rgba(0,0,0,0.16)]
          transform transition-transform duration-300 ease-out
          ${
            isMobile && !isSidebarOpen
              ? "-translate-x-full"
              : "translate-x-0"
          }
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-400/10">
              <MessageSquare className="h-[18px] w-[18px] text-blue-400" />
            </div>

            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-gray-100">
                Chat App
              </h1>

              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
                Conversations
              </p>
            </div>
          </div>

          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="
                rounded-lg p-2
                text-gray-500
                transition-colors duration-200
                hover:bg-white/[0.05]
                hover:text-gray-200
              "
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="
              group w-full
              flex items-center gap-2.5
              rounded-xl
              bg-blue-600
              px-4 py-2.5
              text-sm font-medium text-white
              shadow-sm shadow-blue-950/30
              transition-all duration-200
              hover:bg-blue-500
              hover:shadow-md hover:shadow-blue-950/30
              active:scale-[0.99]
            "
          >
            <Plus className="h-4 w-4 shrink-0" />

            <span>New Chat</span>

            <span
              className="
                ml-auto flex items-center gap-1
                rounded-md
                border border-white/10
                bg-white/10
                px-1.5 py-1
                text-[10px] text-blue-100
              "
              aria-label="Command K"
            >
              <Keyboard className="h-3 w-3" />
              <span>K</span>
            </span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700/50 hover:scrollbar-thumb-gray-600/70">
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
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center justify-between rounded-lg bg-white/[0.025] px-3 py-2">
            <span className="text-[11px] text-gray-500">
              Chats
            </span>

            <span className="text-[11px] font-medium text-gray-400">
              {chatSessions.length}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CHAT AREA                                                      */}
      {/* ------------------------------------------------------------------ */}

      <div className="flex min-w-0 flex-1 flex-col bg-[#0a0d13]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0d1017]/80 px-4 py-3 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="
                  rounded-lg p-2
                  text-gray-500
                  transition-colors duration-200
                  hover:bg-white/[0.05]
                  hover:text-gray-200
                "
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {currentChat && (
              <div className="flex min-w-0 flex-col">
                <span className="max-w-[200px] truncate text-sm font-medium text-gray-200">
                  {currentChat.title || "New Chat"}
                </span>

                <span className="mt-0.5 text-xs text-gray-500">
                  {messages.length} messages
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentChat && (
              <span className="rounded-lg border border-white/[0.06] bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium text-gray-400">
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