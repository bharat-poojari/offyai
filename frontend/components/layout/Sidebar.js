import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  MessageSquare,
  BarChart3,
  Plus,
  Settings,
  HelpCircle,
  Upload,
  Cpu,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  PencilLine,
  Pin,
  PinOff,
  Share2,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";

import { useTheme } from "../../contexts/ThemeContext";
import { useModel } from "../../contexts/ModelContext";

const Sidebar = ({
  currentView,
  onViewChange,
  isConnected,
  isExpanded,
  onToggle,
  chatSessions,
  currentSessionId,
  onCreateNewChat,
  onSwitchChat,
  onDeleteChat,
  onRenameChat,
  onTogglePinChat,
  onSettingsOpen,
  onModelUploadOpen,
  onChangeModel,
}) => {
  /* ====================================================================== */
  /* STATE                                                                  */
  /* ====================================================================== */

  const [appIcon, setAppIcon] = useState(null);

  const [openMenuId, setOpenMenuId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [renameTargetId, setRenameTargetId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const [shareStatuses, setShareStatuses] = useState({});

  const menuRefs = useRef({});
  const renameInputRef = useRef(null);
  const sidebarRef = useRef(null);

  const { currentModel, isLoading } = useModel();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  /* ====================================================================== */
  /* REAL APP ICON                                                          */
  /* ====================================================================== */

  useEffect(() => {
    let mounted = true;

    const loadAppIcon = async () => {
      if (!window.electronAPI?.getAppIcon) {
        return;
      }

      try {
        const iconData = await window.electronAPI.getAppIcon();

        if (mounted && iconData) {
          setAppIcon(iconData);
        }
      } catch (error) {
        console.error("Failed to load app icon:", error);
      }
    };

    loadAppIcon();

    return () => {
      mounted = false;
    };
  }, []);

  /* ====================================================================== */
  /* CLOSE MENUS / DIALOGS                                                  */
  /* ====================================================================== */

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;

      const clickedInsideMenu = Object.values(menuRefs.current).some(
        (element) => element && element.contains(target)
      );

      if (!clickedInsideMenu) {
        setOpenMenuId(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setDeleteTarget(null);

        if (renameTargetId !== null) {
          setRenameTargetId(null);
          setRenameValue("");
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [renameTargetId]);

  useEffect(() => {
    if (!isExpanded) {
      setOpenMenuId(null);
      setDeleteTarget(null);
      setRenameTargetId(null);
      setRenameValue("");
    }
  }, [isExpanded]);

  /* ====================================================================== */
  /* MODEL                                                                  */
  /* ====================================================================== */

  const formatModelName = (model) => {
    if (!model) {
      return "No model";
    }

    const name = model.name || model.id || "Unknown Model";

    return String(name)
      .replace(/\.(gguf|bin|ggml)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const modelName = useMemo(() => {
    return currentModel
      ? formatModelName(currentModel)
      : "No model";
  }, [currentModel]);

  const hasModel =
    Boolean(currentModel) && modelName !== "No model";

  /* ====================================================================== */
  /* CHAT SORTING                                                           */
  /* ====================================================================== */

  const displayedSessions = useMemo(() => {
    return [...(chatSessions || [])].sort((left, right) => {
      const leftPinned = Boolean(left?.pinned);
      const rightPinned = Boolean(right?.pinned);

      if (leftPinned !== rightPinned) {
        return Number(rightPinned) - Number(leftPinned);
      }

      const leftTime = new Date(left?.updatedAt || 0).getTime();
      const rightTime = new Date(right?.updatedAt || 0).getTime();

      return rightTime - leftTime;
    });
  }, [chatSessions]);

  /* ====================================================================== */
  /* NAVIGATION                                                             */
  /* ====================================================================== */

  const menuItems = [
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
    },
    {
      id: "metrics",
      label: "Analytics",
      icon: BarChart3,
    },
  ];

  /* ====================================================================== */
  /* TIME                                                                   */
  /* ====================================================================== */

  const formatTime = (timestamp) => {
    if (!timestamp) {
      return "";
    }

    try {
      const date = new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const now = new Date();

      const difference = Math.max(
        0,
        now.getTime() - date.getTime()
      );

      const diffDays = Math.floor(
        difference / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      if (diffDays === 1) {
        return "Yesterday";
      }

      if (diffDays < 7) {
        return date.toLocaleDateString([], {
          weekday: "short",
        });
      }

      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  /* ====================================================================== */
  /* SESSION TITLE                                                          */
  /* ====================================================================== */

  const getSessionTitle = (session) => {
    const customTitle =
      typeof session?.title === "string"
        ? session.title.trim()
        : "";

    if (customTitle) {
      return customTitle;
    }

    if (
      Array.isArray(session?.messages) &&
      session.messages.length > 0
    ) {
      const firstUserMessage = session.messages.find(
        (message) => message?.role === "user"
      );

      if (firstUserMessage?.content) {
        const content = String(firstUserMessage.content)
          .replace(/\s+/g, " ")
          .trim();

        if (content) {
          return content;
        }
      }
    }

    return "New Chat";
  };

  /* ====================================================================== */
  /* THREE-DOT MENU                                                         */
  /* ====================================================================== */

  const toggleChatMenu = (event, session) => {
    event.stopPropagation();

    setDeleteTarget(null);

    if (renameTargetId !== null) {
      setRenameTargetId(null);
      setRenameValue("");
    }

    setOpenMenuId((current) =>
      current === session.id ? null : session.id
    );
  };

  /* ====================================================================== */
  /* SHARE                                                                  */
  /* ====================================================================== */

  const handleShareChat = async (event, session) => {
    event.stopPropagation();

    setOpenMenuId(null);

    const title = getSessionTitle(session);

    const messages = Array.isArray(session?.messages)
      ? session.messages
      : [];

    const shareText = [
      title,
      ...messages
        .filter(
          (message) =>
            message &&
            typeof message.content === "string" &&
            message.content.trim()
        )
        .map((message) => {
          const role =
            message.role === "assistant"
              ? "OffyAI"
              : message.role === "user"
              ? "You"
              : message.role;

          return `${role}: ${message.content.trim()}`;
        }),
    ]
      .join("\n\n")
      .trim();

    const sharePayload = {
      title,
      text:
        shareText ||
        `Chat shared from OffyAI: ${title}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          sharePayload.text
        );
      } else {
        const textArea =
          document.createElement("textarea");

        textArea.value = sharePayload.text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";

        document.body.appendChild(textArea);

        textArea.select();
        document.execCommand("copy");

        document.body.removeChild(textArea);
      }

      setShareStatuses((previous) => ({
        ...previous,
        [session.id]: true,
      }));

      window.setTimeout(() => {
        setShareStatuses((previous) => {
          const next = { ...previous };

          delete next[session.id];

          return next;
        });
      }, 1400);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Failed to share chat:", error);
      }
    }
  };

  /* ====================================================================== */
  /* RENAME                                                                 */
  /* ====================================================================== */

  const beginRename = (event, session) => {
    event.stopPropagation();

    setOpenMenuId(null);
    setDeleteTarget(null);

    setRenameTargetId(session.id);
    setRenameValue(getSessionTitle(session));
  };

  const cancelRename = (event) => {
    event?.stopPropagation();

    setRenameTargetId(null);
    setRenameValue("");
  };

  const confirmRename = (event, session) => {
    event.stopPropagation();

    const nextTitle = renameValue.trim();

    if (!nextTitle) {
      return;
    }

    if (typeof onRenameChat === "function") {
      onRenameChat(session.id, nextTitle);
    }

    setRenameTargetId(null);
    setRenameValue("");
  };

  useEffect(() => {
    if (renameTargetId !== null) {
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [renameTargetId]);

  /* ====================================================================== */
  /* PIN                                                                    */
  /* ====================================================================== */

  const togglePin = (event, session) => {
    event.stopPropagation();

    setOpenMenuId(null);

    if (typeof onTogglePinChat === "function") {
      onTogglePinChat(session.id);
    }
  };

  /* ====================================================================== */
  /* DELETE                                                                 */
  /* ====================================================================== */

  const requestDelete = (event, session) => {
    event.stopPropagation();

    setOpenMenuId(null);
    setRenameTargetId(null);
    setRenameValue("");

    setDeleteTarget(session);
  };

  const cancelDelete = (event) => {
    event?.stopPropagation();

    setDeleteTarget(null);
  };

  const confirmDelete = (event, session) => {
    event.stopPropagation();

    if (typeof onDeleteChat === "function") {
      onDeleteChat(session.id);
    }

    setDeleteTarget(null);
  };

  /* ====================================================================== */
  /* LOGO                                                                   */
  /* ====================================================================== */

  const logoSrc =
    appIcon || "images/offyai.png";

  /* ====================================================================== */
  /* RENDER                                                                 */
  /* ====================================================================== */

  return (
    <aside
      ref={sidebarRef}
      className={`
        relative
        flex
        h-full
        w-full
        min-w-0
        flex-col
        overflow-hidden
        border-r
        backdrop-blur-xl
        ${
          isDark
            ? "border-gray-800/90 bg-gray-950"
            : "border-gray-200/80 bg-white"
        }
      `}
    >
      {/* ================================================================== */}
      {/* HEADER                                                             */}
      {/* ================================================================== */}

      <header
        className={`
          relative
          shrink-0
          border-b
          px-2.5
          py-2.5
          sm:px-3
          sm:py-3
          ${
            isDark
              ? "border-gray-800/90"
              : "border-gray-200/80"
          }
        `}
      >
        {isExpanded ? (
          <div className="flex min-w-0 items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {/* Real application logo */}
              <div
                className={`
                  flex
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  overflow-hidden
                  rounded-[9px]
                  shadow-sm
                  ring-1
                  ${
                    isDark
                      ? "bg-gray-800 ring-white/[0.08]"
                      : "bg-gray-50 ring-black/[0.06]"
                  }
                `}
              >
                <img
                  src={logoSrc}
                  alt="OffyAI"
                  draggable="false"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* App identity */}
              <div className="min-w-0 flex-1">
                <div
                  className="
                    truncate
                    text-sm
                    font-semibold
                    tracking-tight
                    text-gray-900
                    dark:text-white
                  "
                >
                  OffyAI
                </div>

                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {isConnected && (
                      <span
                        className="
                          absolute
                          inset-0
                          animate-ping
                          rounded-full
                          bg-green-400/50
                        "
                      />
                    )}

                    <span
                      className={`
                        relative
                        h-1.5
                        w-1.5
                        rounded-full
                        ${
                          isConnected
                            ? "bg-green-500"
                            : "bg-red-500"
                        }
                      `}
                    />
                  </span>

                  <span
                    className={`
                      min-w-0
                      truncate
                      text-[10px]
                      font-medium
                      ${
                        isConnected
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    `}
                  >
                    {isConnected
                      ? "Connected"
                      : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>

            {/* Collapse */}
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="
                group
                ml-1
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center
                rounded-lg
                text-gray-500
                transition-all
                duration-200
                hover:bg-gray-100
                hover:text-gray-900
                active:scale-95
                dark:text-gray-400
                dark:hover:bg-gray-800
                dark:hover:text-white
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-blue-500
              "
            >
              <ChevronLeft
                className="
                  h-4
                  w-4
                  transition-transform
                  duration-200
                  group-hover:-translate-x-0.5
                "
              />
            </button>
          </div>
        ) : (
          /* Collapsed logo acts as expand button */
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="
              group
              mx-auto
              flex
              h-9
              w-9
              items-center
              justify-center
              overflow-hidden
              rounded-[10px]
              bg-gray-50
              shadow-sm
              ring-1
              ring-black/[0.06]
              transition-all
              duration-200
              hover:scale-[1.04]
              hover:shadow-md
              active:scale-95
              dark:bg-gray-800
              dark:ring-white/[0.08]
              dark:hover:bg-gray-750
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-blue-500
            "
          >
            <img
              src={logoSrc}
              alt="OffyAI"
              draggable="false"
              className="
                h-full
                w-full
                object-cover
                transition-transform
                duration-200
                group-hover:scale-105
              "
            />
          </button>
        )}
      </header>

      {/* ================================================================== */}
      {/* MODEL                                                               */}
      {/* ================================================================== */}

      {hasModel && (
        <div className="min-w-0 shrink-0 px-2 pt-2">
          <div
            title={modelName}
            className={`
              group
              flex
              min-w-0
              items-center
              gap-2
              rounded-lg
              border
              px-2
              py-2
              transition-all
              duration-200
              ${
                isDark
                  ? "border-gray-800 bg-gray-900/70 hover:border-blue-900/60 hover:bg-blue-950/20"
                  : "border-gray-200/80 bg-gray-50/80 hover:border-blue-200 hover:bg-blue-50/50"
              }
            `}
          >
            <div
              className="
                flex
                h-6
                w-6
                shrink-0
                items-center
                justify-center
                rounded-md
                bg-blue-500/10
                text-blue-500
                dark:bg-blue-500/15
              "
            >
              <Cpu
                className="
                  h-3.5
                  w-3.5
                  transition-transform
                  duration-200
                  group-hover:scale-110
                "
              />
            </div>

            {isExpanded && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className="
                    mb-0.5
                    truncate
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-wider
                    text-blue-500/70
                  "
                >
                  Model
                </div>

                <div
                  className="
                    min-w-0
                    truncate
                    text-[11px]
                    font-medium
                    text-gray-700
                    dark:text-gray-200
                  "
                >
                  {isLoading
                    ? "Loading..."
                    : modelName}
                </div>
              </div>
            )}

            {isLoading && (
              <span
                className="
                  h-1.5
                  w-1.5
                  shrink-0
                  animate-pulse
                  rounded-full
                  bg-blue-500
                "
              />
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* NEW CHAT                                                            */}
      {/* ================================================================== */}

      <div className="min-w-0 shrink-0 p-2">
        <button
          type="button"
          onClick={onCreateNewChat}
          aria-label="New Chat"
          title={!isExpanded ? "New Chat" : undefined}
          className="
            group
            flex
            w-full
            min-w-0
            items-center
            justify-center
            gap-2
            overflow-hidden
            rounded-lg
            bg-blue-600
            px-2.5
            py-2
            text-sm
            font-medium
            text-white
            shadow-sm
            shadow-blue-600/10
            transition-all
            duration-200
            hover:-translate-y-px
            hover:bg-blue-700
            hover:shadow-md
            active:translate-y-0
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-blue-500
            focus-visible:ring-offset-2
            dark:focus-visible:ring-offset-gray-950
          "
        >
          <Plus
            className="
              h-3.5
              w-3.5
              shrink-0
              transition-transform
              duration-200
              group-hover:rotate-90
            "
          />

          {isExpanded && (
            <span className="min-w-0 truncate">
              New Chat
            </span>
          )}
        </button>
      </div>

      {/* ================================================================== */}
      {/* NAVIGATION                                                          */}
      {/* ================================================================== */}

      <nav className="min-w-0 shrink-0 px-2 pb-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentView === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              aria-current={
                isActive ? "page" : undefined
              }
              title={
                !isExpanded
                  ? item.label
                  : undefined
              }
              className={`
                group
                relative
                mb-0.5
                flex
                min-w-0
                w-full
                items-center
                gap-2.5
                overflow-hidden
                rounded-lg
                px-3
                py-2
                text-sm
                transition-all
                duration-200
                ${
                  !isExpanded
                    ? "justify-center px-2"
                    : ""
                }
                ${
                  isActive
                    ? `
                      bg-blue-50
                      font-medium
                      text-blue-700
                      shadow-sm
                      dark:bg-blue-900/30
                      dark:text-blue-300
                    `
                    : `
                      text-gray-600
                      hover:bg-gray-100
                      hover:text-gray-900
                      dark:text-gray-400
                      dark:hover:bg-gray-800
                      dark:hover:text-gray-100
                    `
                }
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-blue-500
              `}
            >
              {isActive && (
                <span
                  className="
                    absolute
                    left-0
                    top-1/2
                    h-5
                    w-0.5
                    -translate-y-1/2
                    rounded-r-full
                    bg-blue-500
                  "
                />
              )}

              <Icon
                className={`
                  h-4
                  w-4
                  shrink-0
                  transition-transform
                  duration-200
                  ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "group-hover:scale-105"
                  }
                `}
              />

              {isExpanded && (
                <span className="min-w-0 flex-1 truncate text-left">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ================================================================== */}
      {/* CHAT HISTORY                                                        */}
      {/* ================================================================== */}

      {isExpanded && (
        <section
          className="
            flex
            min-h-0
            min-w-0
            flex-1
            flex-col
            overflow-hidden
          "
        >
          {/* History heading */}
          <div
            className="
              flex
              min-w-0
              shrink-0
              items-center
              gap-2
              px-3
              py-2
            "
          >
            <h3
              className="
                min-w-0
                flex-1
                truncate
                text-[10px]
                font-semibold
                uppercase
                tracking-wider
                text-gray-400
                dark:text-gray-500
              "
            >
              Recent Chats
            </h3>

            <span
              className="
                min-w-[20px]
                shrink-0
                rounded-md
                bg-gray-100
                px-1.5
                py-0.5
                text-center
                text-[9px]
                font-medium
                text-gray-500
                dark:bg-gray-800
                dark:text-gray-400
              "
            >
              {chatSessions?.length || 0}
            </span>
          </div>

          {/* Chat list */}
          <div
            className="
              custom-scrollbar
              min-h-0
              min-w-0
              flex-1
              overflow-x-hidden
              overflow-y-auto
              px-2
              pb-2
            "
          >
            {!chatSessions ||
            chatSessions.length === 0 ? (
              <div
                className="
                  flex
                  flex-col
                  items-center
                  px-4
                  py-10
                  text-center
                "
              >
                <div
                  className="
                    mb-3
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-gray-100
                    text-gray-400
                    dark:bg-gray-800
                    dark:text-gray-500
                  "
                >
                  <MessageSquare className="h-5 w-5" />
                </div>

                <p
                  className="
                    text-xs
                    font-medium
                    text-gray-600
                    dark:text-gray-300
                  "
                >
                  No chats yet
                </p>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-gray-400
                    dark:text-gray-500
                  "
                >
                  Start a conversation
                </p>
              </div>
            ) : (
              <div className="min-w-0 space-y-1">
                {displayedSessions.map((session) => {
                  const isActive =
                    currentSessionId === session.id;

                  const isDeleting =
                    deleteTarget?.id === session.id;

                  const isRenaming =
                    renameTargetId === session.id;

                  const isMenuOpen =
                    openMenuId === session.id;

                  const isPinned =
                    Boolean(session?.pinned);

                  const sessionTitle =
                    getSessionTitle(session);

                  return (
                    <div
                      key={session.id}
                      className="
                        relative
                        min-w-0
                      "
                      ref={(element) => {
                        if (element) {
                          menuRefs.current[session.id] =
                            element;
                        }
                      }}
                    >
                      {/* ================================================== */}
                      {/* CHAT ROW                                           */}
                      {/* ================================================== */}

                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (
                            !isDeleting &&
                            !isRenaming &&
                            !isMenuOpen
                          ) {
                            onSwitchChat(session.id);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();

                            if (
                              !isDeleting &&
                              !isRenaming &&
                              !isMenuOpen
                            ) {
                              onSwitchChat(
                                session.id
                              );
                            }
                          }
                        }}
                        className={`
                          group
                          relative
                          flex
                          min-w-0
                          cursor-pointer
                          overflow-visible
                          rounded-lg
                          border
                          px-2
                          py-2
                          transition-all
                          duration-150
                          ${
                            isDeleting
                              ? "opacity-40"
                              : ""
                          }
                          ${
                            isActive
                              ? `
                                border-blue-200/60
                                bg-blue-50
                                shadow-sm
                                dark:border-blue-900/50
                                dark:bg-blue-900/25
                              `
                              : `
                                border-transparent
                                hover:border-gray-200/70
                                hover:bg-gray-50
                                dark:hover:border-gray-800
                                dark:hover:bg-gray-800/70
                              `
                          }
                          focus:outline-none
                          focus-visible:ring-2
                          focus-visible:ring-blue-500
                        `}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <span
                            className="
                              absolute
                              left-0
                              top-2.5
                              h-5
                              w-0.5
                              rounded-r-full
                              bg-blue-500
                            "
                          />
                        )}

                        <div className="flex min-w-0 w-full items-center gap-2">
                          {/* Chat icon */}
                          <div
                            className={`
                              flex
                              h-7
                              w-7
                              shrink-0
                              items-center
                              justify-center
                              rounded-md
                              ${
                                isActive
                                  ? `
                                    bg-blue-100
                                    text-blue-600
                                    dark:bg-blue-900/50
                                    dark:text-blue-400
                                  `
                                  : `
                                    bg-gray-100
                                    text-gray-400
                                    dark:bg-gray-800
                                    dark:text-gray-500
                                  `
                              }
                            `}
                          >
                            {isPinned ? (
                              <Pin className="h-3.5 w-3.5" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5" />
                            )}
                          </div>

                          {/* ================================================== */}
                          {/* TITLE / TIME                                        */}
                          {/* ================================================== */}

                          <div
                            className="
                              min-w-0
                              flex-1
                              overflow-hidden
                            "
                          >
                            <div
                              className={`
                                min-w-0
                                overflow-hidden
                                text-ellipsis
                                whitespace-nowrap
                                text-[11px]
                                leading-4
                                font-medium
                                ${
                                  isActive
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-gray-700 dark:text-gray-200"
                                }
                              `}
                              title={sessionTitle}
                            >
                              {sessionTitle}
                            </div>

                            <div
                              className={`
                                mt-0.5
                                flex
                                min-w-0
                                items-center
                                gap-1
                                text-[9px]
                                ${
                                  isActive
                                    ? "text-blue-500 dark:text-blue-400"
                                    : "text-gray-400 dark:text-gray-500"
                                }
                              `}
                            >
                              <Clock className="h-2.5 w-2.5 shrink-0" />

                              <span className="min-w-0 truncate">
                                {formatTime(
                                  session.updatedAt
                                )}
                              </span>

                              {isPinned && (
                                <>
                                  <span className="opacity-40">
                                    •
                                  </span>

                                  <span className="shrink-0">
                                    Pinned
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* ================================================== */}
                          {/* THREE DOT ACTION BUTTON                            */}
                          {/* ================================================== */}

                          <button
                            type="button"
                            aria-label={`Options for ${sessionTitle}`}
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            title="Chat options"
                            onClick={(event) =>
                              toggleChatMenu(
                                event,
                                session
                              )
                            }
                            className={`
                              flex
                              h-7
                              w-7
                              shrink-0
                              items-center
                              justify-center
                              rounded-md
                              transition-all
                              duration-150
                              ${
                                isMenuOpen
                                  ? `
                                    bg-gray-200
                                    text-gray-800
                                    dark:bg-gray-700
                                    dark:text-white
                                  `
                                  : `
                                    text-gray-400
                                    opacity-0
                                    group-hover:opacity-100
                                    hover:bg-gray-200
                                    hover:text-gray-700
                                    dark:hover:bg-gray-700
                                    dark:hover:text-gray-100
                                  `
                              }
                              focus:opacity-100
                              focus:outline-none
                              focus-visible:ring-2
                              focus-visible:ring-blue-500
                            `}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* ================================================== */}
                      {/* CONTEXT MENU                                        */}
                      {/* ================================================== */}

                      {isMenuOpen && !isDeleting && (
                        <div
                          role="menu"
                          className={`
                            absolute
                            right-1
                            top-[calc(100%-2px)]
                            z-50
                            w-44
                            overflow-hidden
                            rounded-xl
                            border
                            p-1
                            shadow-2xl
                            ring-1
                            backdrop-blur-xl
                            ${
                              isDark
                                ? `
                                  border-gray-700/80
                                  bg-gray-900/95
                                  shadow-black/40
                                  ring-white/[0.04]
                                `
                                : `
                                  border-gray-200
                                  bg-white/95
                                  shadow-black/10
                                  ring-black/[0.03]
                                `
                            }
                          `}
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          {/* Menu heading */}
                          <div
                            className="
                              px-2.5
                              pb-1.5
                              pt-1.5
                              text-[9px]
                              font-semibold
                              uppercase
                              tracking-wider
                              text-gray-400
                              dark:text-gray-500
                            "
                          >
                            Chat options
                          </div>

                          {/* Share */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) =>
                              handleShareChat(
                                event,
                                session
                              )
                            }
                            className="
                              group/menu
                              flex
                              w-full
                              items-center
                              gap-2.5
                              rounded-lg
                              px-2.5
                              py-2
                              text-left
                              text-[11px]
                              font-medium
                              text-gray-700
                              transition-colors
                              hover:bg-gray-100
                              dark:text-gray-200
                              dark:hover:bg-gray-800
                            "
                          >
                            <span
                              className="
                                flex
                                h-7
                                w-7
                                shrink-0
                                items-center
                                justify-center
                                rounded-md
                                bg-blue-500/10
                                text-blue-500
                              "
                            >
                              {shareStatuses[
                                session.id
                              ] ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Share2 className="h-3.5 w-3.5" />
                              )}
                            </span>

                            <span className="min-w-0 flex-1 truncate">
                              {shareStatuses[
                                session.id
                              ]
                                ? "Copied"
                                : "Share chat"}
                            </span>
                          </button>

                          {/* Rename */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) =>
                              beginRename(
                                event,
                                session
                              )
                            }
                            className="
                              group/menu
                              flex
                              w-full
                              items-center
                              gap-2.5
                              rounded-lg
                              px-2.5
                              py-2
                              text-left
                              text-[11px]
                              font-medium
                              text-gray-700
                              transition-colors
                              hover:bg-gray-100
                              dark:text-gray-200
                              dark:hover:bg-gray-800
                            "
                          >
                            <span
                              className="
                                flex
                                h-7
                                w-7
                                shrink-0
                                items-center
                                justify-center
                                rounded-md
                                bg-gray-500/10
                                text-gray-500
                                dark:text-gray-400
                              "
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </span>

                            <span className="min-w-0 flex-1 truncate">
                              Rename chat
                            </span>
                          </button>

                          {/* Pin */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) =>
                              togglePin(
                                event,
                                session
                              )
                            }
                            className="
                              group/menu
                              flex
                              w-full
                              items-center
                              gap-2.5
                              rounded-lg
                              px-2.5
                              py-2
                              text-left
                              text-[11px]
                              font-medium
                              text-gray-700
                              transition-colors
                              hover:bg-gray-100
                              dark:text-gray-200
                              dark:hover:bg-gray-800
                            "
                          >
                            <span
                              className="
                                flex
                                h-7
                                w-7
                                shrink-0
                                items-center
                                justify-center
                                rounded-md
                                bg-yellow-500/10
                                text-yellow-500
                              "
                            >
                              {isPinned ? (
                                <PinOff className="h-3.5 w-3.5" />
                              ) : (
                                <Pin className="h-3.5 w-3.5" />
                              )}
                            </span>

                            <span className="min-w-0 flex-1 truncate">
                              {isPinned
                                ? "Unpin chat"
                                : "Pin chat"}
                            </span>
                          </button>

                          {/* Separator */}
                          <div
                            className="
                              my-1
                              h-px
                              bg-gray-100
                              dark:bg-gray-800
                            "
                          />

                          {/* Delete */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) =>
                              requestDelete(
                                event,
                                session
                              )
                            }
                            className="
                              group/menu
                              flex
                              w-full
                              items-center
                              gap-2.5
                              rounded-lg
                              px-2.5
                              py-2
                              text-left
                              text-[11px]
                              font-medium
                              text-red-600
                              transition-colors
                              hover:bg-red-50
                              dark:text-red-400
                              dark:hover:bg-red-950/30
                            "
                          >
                            <span
                              className="
                                flex
                                h-7
                                w-7
                                shrink-0
                                items-center
                                justify-center
                                rounded-md
                                bg-red-500/10
                                text-red-500
                              "
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>

                            <span className="min-w-0 flex-1 truncate">
                              Delete chat
                            </span>
                          </button>
                        </div>
                      )}

                      {/* ================================================== */}
                      {/* RENAME EDITOR                                       */}
                      {/* ================================================== */}

                      {isRenaming && (
                        <div
                          className="
                            mt-1
                            overflow-hidden
                            rounded-xl
                            border
                            border-blue-200/70
                            bg-blue-50/70
                            p-2
                            shadow-sm
                            dark:border-blue-900/60
                            dark:bg-blue-950/20
                          "
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <div
                            className="
                              mb-1.5
                              text-[9px]
                              font-semibold
                              uppercase
                              tracking-wider
                              text-blue-500
                            "
                          >
                            Rename chat
                          </div>

                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameValue}
                            maxLength={120}
                            onChange={(event) =>
                              setRenameValue(
                                event.target.value
                              )
                            }
                            onKeyDown={(event) => {
                              if (
                                event.key === "Enter"
                              ) {
                                confirmRename(
                                  event,
                                  session
                                );
                              }

                              if (
                                event.key === "Escape"
                              ) {
                                cancelRename(event);
                              }
                            }}
                            placeholder="Enter chat title"
                            className="
                              block
                              w-full
                              min-w-0
                              rounded-lg
                              border
                              border-gray-200
                              bg-white
                              px-2.5
                              py-2
                              text-[11px]
                              text-gray-800
                              outline-none
                              transition
                              placeholder:text-gray-400
                              focus:border-blue-400
                              focus:ring-2
                              focus:ring-blue-500/10
                              dark:border-gray-700
                              dark:bg-gray-900
                              dark:text-gray-100
                              dark:placeholder:text-gray-500
                            "
                          />

                          <div className="mt-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={(event) =>
                                confirmRename(
                                  event,
                                  session
                                )
                              }
                              disabled={
                                !renameValue.trim()
                              }
                              className="
                                flex
                                min-w-0
                                flex-1
                                items-center
                                justify-center
                                gap-1
                                rounded-lg
                                bg-blue-600
                                px-2
                                py-1.5
                                text-[10px]
                                font-medium
                                text-white
                                transition-all
                                hover:bg-blue-700
                                disabled:cursor-not-allowed
                                disabled:opacity-40
                              "
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={cancelRename}
                              className="
                                flex
                                min-w-0
                                flex-1
                                items-center
                                justify-center
                                gap-1
                                rounded-lg
                                border
                                border-gray-200
                                bg-white
                                px-2
                                py-1.5
                                text-[10px]
                                font-medium
                                text-gray-600
                                transition-colors
                                hover:bg-gray-50
                                dark:border-gray-700
                                dark:bg-gray-900
                                dark:text-gray-300
                                dark:hover:bg-gray-800
                              "
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ================================================== */}
                      {/* DELETE CONFIRMATION                                 */}
                      {/* ================================================== */}

                      {isDeleting && (
                        <div
                          className={`
                            relative
                            z-50
                            mt-1
                            overflow-hidden
                            rounded-xl
                            border
                            shadow-xl
                            ${
                              isDark
                                ? "border-gray-700 bg-gray-900 shadow-black/30"
                                : "border-gray-200 bg-white shadow-black/10"
                            }
                          `}
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <div className="p-3">
                            <div className="flex min-w-0 gap-2.5">
                              <div
                                className="
                                  flex
                                  h-8
                                  w-8
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-lg
                                  bg-red-500/10
                                  text-red-500
                                "
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div
                                  className="
                                    truncate
                                    text-[11px]
                                    font-semibold
                                    text-gray-900
                                    dark:text-gray-100
                                  "
                                >
                                  Delete this chat?
                                </div>

                                <p
                                  className="
                                    mt-0.5
                                    text-[10px]
                                    leading-relaxed
                                    text-gray-500
                                    dark:text-gray-400
                                  "
                                >
                                  This conversation will
                                  be permanently removed.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={cancelDelete}
                                aria-label="Close"
                                className="
                                  flex
                                  h-6
                                  w-6
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-md
                                  text-gray-400
                                  transition-colors
                                  hover:bg-gray-100
                                  hover:text-gray-700
                                  dark:hover:bg-gray-800
                                  dark:hover:text-gray-200
                                "
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="mt-3 flex gap-1.5">
                              <button
                                type="button"
                                onClick={cancelDelete}
                                className="
                                  flex
                                  min-w-0
                                  flex-1
                                  items-center
                                  justify-center
                                  rounded-lg
                                  border
                                  border-gray-200
                                  px-2
                                  py-1.5
                                  text-[10px]
                                  font-medium
                                  text-gray-600
                                  transition-colors
                                  hover:bg-gray-50
                                  dark:border-gray-700
                                  dark:text-gray-300
                                  dark:hover:bg-gray-800
                                "
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={(event) =>
                                  confirmDelete(
                                    event,
                                    session
                                  )
                                }
                                className="
                                  flex
                                  min-w-0
                                  flex-1
                                  items-center
                                  justify-center
                                  gap-1
                                  rounded-lg
                                  bg-red-500
                                  px-2
                                  py-1.5
                                  text-[10px]
                                  font-medium
                                  text-white
                                  shadow-sm
                                  transition-all
                                  hover:bg-red-600
                                  hover:shadow-md
                                  active:scale-[0.98]
                                  focus:outline-none
                                  focus-visible:ring-2
                                  focus-visible:ring-red-500
                                "
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* FOOTER                                                             */}
      {/* ================================================================== */}

      <footer
        className={`
          min-w-0
          shrink-0
          border-t
          p-2
          ${
            isDark
              ? "border-gray-800/90"
              : "border-gray-200/80"
          }
        `}
      >
        <div className="min-w-0 space-y-0.5">
          {/* Upload Model */}
          <button
            type="button"
            onClick={onModelUploadOpen}
            title={
              !isExpanded
                ? "Upload Model"
                : undefined
            }
            className={`
              group
              flex
              min-w-0
              w-full
              items-center
              gap-2.5
              overflow-hidden
              rounded-lg
              px-3
              py-2
              text-sm
              text-gray-600
              transition-all
              duration-200
              hover:bg-gray-100
              hover:text-gray-900
              dark:text-gray-400
              dark:hover:bg-gray-800
              dark:hover:text-gray-100
              ${
                !isExpanded
                  ? "justify-center px-2"
                  : ""
              }
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-blue-500
            `}
          >
            <Upload
              className="
                h-3.5
                w-3.5
                shrink-0
                transition-transform
                duration-200
                group-hover:-translate-y-0.5
              "
            />

            {isExpanded && (
              <span className="min-w-0 flex-1 truncate text-left">
                Upload Model
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={onChangeModel || onSettingsOpen}
            title={!isExpanded ? "Change model" : undefined}
            className={`group flex min-w-0 w-full items-center gap-2.5 overflow-hidden rounded-lg px-3 py-2 text-sm text-blue-600 transition-all duration-200 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 ${!isExpanded ? "justify-center px-2" : ""} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
          >
            <Cpu className="h-3.5 w-3.5 shrink-0" />
            {isExpanded && (
              <span className="min-w-0 flex-1 truncate text-left">Change Model</span>
            )}
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={onSettingsOpen}
            title={
              !isExpanded
                ? "Settings"
                : undefined
            }
            className={`
              group
              flex
              min-w-0
              w-full
              items-center
              gap-2.5
              overflow-hidden
              rounded-lg
              px-3
              py-2
              text-sm
              text-gray-600
              transition-all
              duration-200
              hover:bg-gray-100
              hover:text-gray-900
              dark:text-gray-400
              dark:hover:bg-gray-800
              dark:hover:text-gray-100
              ${
                !isExpanded
                  ? "justify-center px-2"
                  : ""
              }
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-blue-500
            `}
          >
            <Settings
              className="
                h-3.5
                w-3.5
                shrink-0
                transition-transform
                duration-300
                group-hover:rotate-45
              "
            />

            {isExpanded && (
              <span className="min-w-0 flex-1 truncate text-left">
                Settings
              </span>
            )}
          </button>

          {/* Help */}
          <button
            type="button"
            onClick={() => onViewChange("help")}
            aria-current={currentView === "help" ? "page" : undefined}
            title={!isExpanded ? "Help" : undefined}
            className={`
              group flex min-w-0 w-full items-center gap-2.5 overflow-hidden rounded-lg px-3 py-2 text-sm transition-all duration-200
              ${!isExpanded ? "justify-center px-2" : ""}
              ${currentView === "help"
                ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"}
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            `}
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            {isExpanded && (
              <span className="min-w-0 flex-1 truncate text-left">Help</span>
            )}
          </button>
        </div>
      </footer>
    </aside>
  );
};

export default Sidebar;