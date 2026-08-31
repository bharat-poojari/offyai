import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import TitleBar from "./TitleBar";
import Sidebar from "./Sidebar";
import Header from "./Header";

import SettingsModal from "../modals/SettingsModal";
import ModelUploadModal from "../modals/ModelUploadModal";

import { useTheme } from "../../contexts/ThemeContext";

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 260;
const COLLAPSED_SIDEBAR_WIDTH = 56;

const Layout = ({
  children,
  currentView,
  onViewChange,
  isConnected,
  currentModel,
  chatSessions,
  currentSessionId,
  onCreateNewChat,
  onSwitchChat,
  onDeleteChat,
  onRenameChat,
  onTogglePinChat,
  onClearAllChats,
}) => {
  /* ---------------------------------------------------------------------- */
  /* State                                                                   */
  /* ---------------------------------------------------------------------- */

  const [sidebarExpanded, setSidebarExpanded] =
    useState(true);

  const [sidebarWidth, setSidebarWidth] =
    useState(DEFAULT_SIDEBAR_WIDTH);

  const [isResizing, setIsResizing] =
    useState(false);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [settingsInitialTab, setSettingsInitialTab] =
    useState("general");

  const [modelUploadOpen, setModelUploadOpen] =
    useState(false);

  const { resolvedTheme } = useTheme();

  /* ---------------------------------------------------------------------- */
  /* Refs                                                                    */
  /* ---------------------------------------------------------------------- */

  const sidebarRef = useRef(null);

  const sidebarWidthRef = useRef(
    DEFAULT_SIDEBAR_WIDTH
  );

  const resizeFrameRef = useRef(null);

  /* ---------------------------------------------------------------------- */
  /* Keep width ref synchronized                                             */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  /* ---------------------------------------------------------------------- */
  /* Load saved sidebar configuration                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    try {
      const savedExpanded = localStorage.getItem(
        "offyai_sidebar_expanded"
      );

      const savedWidth = localStorage.getItem(
        "offyai_sidebar_width"
      );

      if (savedExpanded !== null) {
        setSidebarExpanded(
          savedExpanded === "true"
        );
      }

      if (savedWidth) {
        const width = parseInt(
          savedWidth,
          10
        );

        if (
          Number.isFinite(width) &&
          width >= MIN_SIDEBAR_WIDTH &&
          width <= MAX_SIDEBAR_WIDTH
        ) {
          setSidebarWidth(width);
          sidebarWidthRef.current = width;
        }
      }
    } catch (error) {
      console.warn(
        "Unable to restore sidebar settings:",
        error
      );
    }

    /* ------------------------------------------------------------------ */
    /* Responsive behavior                                                 */
    /* ------------------------------------------------------------------ */

    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarExpanded(false);
      }
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    handleResize();

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Apply saved interface settings                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const applyUiSettings = (savedSettings) => {
      const nextUi = savedSettings?.ui;

      if (!nextUi || typeof nextUi !== "object") {
        return;
      }

      const fontSize = Number(nextUi.fontSize);
      const configuredWidth = Number(nextUi.sidebarWidth);
      const nextWidth = Number.isFinite(configuredWidth)
        ? Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, configuredWidth))
        : DEFAULT_SIDEBAR_WIDTH;

      if (Number.isFinite(fontSize) && fontSize >= 10 && fontSize <= 24) {
        document.documentElement.style.fontSize = `${fontSize}px`;
        document.documentElement.style.setProperty(
          "--app-font-size",
          `${fontSize}px`
        );
      }

      setSidebarWidth(nextWidth);
      sidebarWidthRef.current = nextWidth;
    };

    const loadUiSettings = async () => {
      try {
        if (typeof window.electronAPI?.getSettings === "function") {
          applyUiSettings(await window.electronAPI.getSettings());
        }
      } catch (error) {
        console.warn("Unable to load interface settings:", error);
      }
    };

    const handleSettingsSaved = (event) => {
      applyUiSettings(event.detail);
    };

    loadUiSettings();
    window.addEventListener("offyai-settings-saved", handleSettingsSaved);

    return () => {
      window.removeEventListener("offyai-settings-saved", handleSettingsSaved);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Sidebar toggle                                                         */
  /* ---------------------------------------------------------------------- */

  const handleToggleSidebar = useCallback(() => {
    setSidebarExpanded((previous) => {
      const next = !previous;

      try {
        localStorage.setItem(
          "offyai_sidebar_expanded",
          String(next)
        );
      } catch (error) {
        console.warn(
          "Unable to save sidebar state:",
          error
        );
      }

      return next;
    });
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Save sidebar width                                                      */
  /* ---------------------------------------------------------------------- */

  const saveSidebarWidth = useCallback((width) => {
    const safeWidth = Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, width)
    );

    setSidebarWidth(safeWidth);
    sidebarWidthRef.current = safeWidth;

    try {
      localStorage.setItem(
        "offyai_sidebar_width",
        String(safeWidth)
      );
    } catch (error) {
      console.warn(
        "Unable to save sidebar width:",
        error
      );
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Resize start                                                            */
  /* ---------------------------------------------------------------------- */

  const handleResizeStart = useCallback(
    (event) => {
      if (window.innerWidth < 768) {
        return;
      }

      event.preventDefault();

      setIsResizing(true);
    },
    []
  );

  /* ---------------------------------------------------------------------- */
  /* Sidebar resizing                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const handleResizeMove = (event) => {
      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(
          MIN_SIDEBAR_WIDTH,
          event.clientX
        )
      );

      sidebarWidthRef.current = nextWidth;

      /*
       * Limit React renders during mouse movement.
       * This keeps the sidebar smooth without creating
       * excessive state updates while dragging.
       */
      if (resizeFrameRef.current) {
        cancelAnimationFrame(
          resizeFrameRef.current
        );
      }

      resizeFrameRef.current =
        requestAnimationFrame(() => {
          setSidebarWidth(nextWidth);
        });
    };

    const handleResizeEnd = () => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(
          resizeFrameRef.current
        );

        resizeFrameRef.current = null;
      }

      const finalWidth =
        sidebarWidthRef.current;

      saveSidebarWidth(finalWidth);

      setIsResizing(false);
    };

    document.addEventListener(
      "mousemove",
      handleResizeMove
    );

    document.addEventListener(
      "mouseup",
      handleResizeEnd
    );

    document.body.style.cursor =
      "ew-resize";

    document.body.style.userSelect =
      "none";

    return () => {
      document.removeEventListener(
        "mousemove",
        handleResizeMove
      );

      document.removeEventListener(
        "mouseup",
        handleResizeEnd
      );

      if (resizeFrameRef.current) {
        cancelAnimationFrame(
          resizeFrameRef.current
        );

        resizeFrameRef.current = null;
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [
    isResizing,
    saveSidebarWidth,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Layout dimensions                                                       */
  /* ---------------------------------------------------------------------- */

  const currentWidth = sidebarExpanded
    ? sidebarWidth
    : COLLAPSED_SIDEBAR_WIDTH;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className={`
        h-screen
        w-screen
        overflow-hidden
        flex
        flex-col
        ${
          resolvedTheme === "dark"
            ? "dark"
            : "light"
        }
        bg-gray-50
        dark:bg-gray-950
        text-gray-900
        dark:text-gray-100
      `}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Native-style title bar                                             */}
      {/* ------------------------------------------------------------------ */}

      <TitleBar />

      {/* ------------------------------------------------------------------ */}
      {/* Application workspace                                              */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          relative
          flex
          flex-1
          min-h-0
          overflow-hidden
          pt-7
          bg-gray-50
          dark:bg-gray-950
        "
      >
        {/* Very subtle workspace background */}
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.035),transparent_32%)]
            dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_32%)]
          "
        />

        {/* ---------------------------------------------------------------- */}
        {/* Sidebar                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div
          ref={sidebarRef}
          className={`
            sidebar-resizable
            relative
            z-10
            flex
            min-h-0
            flex-shrink-0
            overflow-hidden
            ${
              isResizing
                ? "will-change-[width]"
                : ""
            }
          `}
          style={{
            width: `${currentWidth}px`,
            transition: isResizing
              ? "none"
              : "width 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div
            className="
              h-full
              w-full
              overflow-hidden
              border-r
              border-gray-200/80
              bg-white/95
              shadow-[1px_0_8px_rgba(0,0,0,0.025)]
              backdrop-blur-xl
              dark:border-gray-800
              dark:bg-gray-900/95
              dark:shadow-[1px_0_10px_rgba(0,0,0,0.15)]
            "
          >
            <Sidebar
              currentView={
                currentView
              }
              onViewChange={
                onViewChange
              }
              isConnected={
                isConnected
              }
              currentModel={
                currentModel
              }
              isExpanded={
                sidebarExpanded
              }
              onToggle={
                handleToggleSidebar
              }
              chatSessions={
                chatSessions
              }
              currentSessionId={
                currentSessionId
              }
              onCreateNewChat={
                onCreateNewChat
              }
              onSwitchChat={
                onSwitchChat
              }
              onDeleteChat={
                onDeleteChat
              }
              onRenameChat={
                onRenameChat
              }
              onTogglePinChat={
                onTogglePinChat
              }
              onSettingsOpen={() =>
                setSettingsOpen(true)
              }
              onChangeModel={() => {
                setSettingsInitialTab("models");
                setSettingsOpen(true);
              }}
              onModelUploadOpen={() =>
                setModelUploadOpen(true)
              }
            />
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Sidebar resize handle                                           */}
          {/* -------------------------------------------------------------- */}

          {sidebarExpanded && (
            <div
              className={`
                sidebar-resize-handle
                group
                absolute
                right-[-3px]
                top-0
                z-30
                h-full
                w-[6px]
                cursor-ew-resize
                ${
                  isResizing
                    ? "bg-blue-500/20"
                    : "bg-transparent"
                }
              `}
              onMouseDown={
                handleResizeStart
              }
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
            >
              <div
                className={`
                  absolute
                  left-1/2
                  top-1/2
                  h-10
                  w-[2px]
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  transition-all
                  duration-150
                  ${
                    isResizing
                      ? "bg-blue-500"
                      : "bg-gray-300/0 group-hover:bg-gray-300 dark:group-hover:bg-gray-600"
                  }
                `}
              />
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Main application area                                             */}
        {/* ---------------------------------------------------------------- */}

        <div
          className="
            relative
            z-10
            flex
            min-w-0
            min-h-0
            flex-1
            flex-col
            overflow-hidden
            bg-white
            dark:bg-gray-900
          "
        >
          {/* Header */}
          <div className="relative z-20 shrink-0">
            <Header
              isConnected={
                isConnected
              }
              currentModel={
                currentModel
              }
              onToggleSidebar={
                handleToggleSidebar
              }
              onSettingsOpen={() =>
                setSettingsOpen(true)
              }
              onChangeModel={() => {
                setSettingsInitialTab("models");
                setSettingsOpen(true);
              }}
              onModelUploadOpen={() =>
                setModelUploadOpen(true)
              }
            />
          </div>

          {/* Main content */}
          <main
            className="
              relative
              flex-1
              min-h-0
              min-w-0
              overflow-hidden
              bg-gray-50/70
              dark:bg-gray-950/40
            "
          >
            {/* Subtle content-edge highlight */}
            <div
              className="
                pointer-events-none
                absolute
                inset-x-0
                top-0
                z-10
                h-px
                bg-gray-200/50
                dark:bg-gray-800/60
              "
            />

            <div className="relative h-full w-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Settings modal                                                      */}
      {/* ------------------------------------------------------------------ */}

      <SettingsModal
        isOpen={settingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsInitialTab("general");
        }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Model upload modal                                                  */}
      {/* ------------------------------------------------------------------ */}

      <ModelUploadModal
        isOpen={
          modelUploadOpen
        }
        onClose={() =>
          setModelUploadOpen(false)
        }
        onOpenSettings={(tab = "models") => {
          setSettingsInitialTab(tab);
          setModelUploadOpen(false);
          setSettingsOpen(true);
        }}
        onUploadSuccess={() => {
          setModelUploadOpen(false);
        }}
      />
    </div>
  );
};

export default Layout;
