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
  onClearAllChats,
}) => {
  /* ---------------------------------------------------------------------- */
  /* State                                                                   */
  /* ---------------------------------------------------------------------- */

  const [
    sidebarExpanded,
    setSidebarExpanded,
  ] = useState(true);

  const [
    sidebarWidth,
    setSidebarWidth,
  ] = useState(260);

  const [
    isResizing,
    setIsResizing,
  ] = useState(false);

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);

  const [
    modelUploadOpen,
    setModelUploadOpen,
  ] = useState(false);

  const {
    resolvedTheme,
  } = useTheme();

  const sidebarRef =
    useRef(null);

  /* ---------------------------------------------------------------------- */
  /* Load saved sidebar configuration                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    /*
     * localStorage is only accessed after mount,
     * so this remains safe for Next.js SSR.
     */
    try {
      const savedExpanded =
        localStorage.getItem(
          "offyai_sidebar_expanded"
        );

      const savedWidth =
        localStorage.getItem(
          "offyai_sidebar_width"
        );

      if (
        savedExpanded !== null
      ) {
        setSidebarExpanded(
          savedExpanded === "true"
        );
      }

      if (savedWidth) {
        const width =
          parseInt(
            savedWidth,
            10
          );

        if (
          Number.isFinite(width) &&
          width >= 180 &&
          width <= 400
        ) {
          setSidebarWidth(
            width
          );
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
      if (
        window.innerWidth < 768
      ) {
        setSidebarExpanded(
          false
        );
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
  /* Sidebar toggle                                                         */
  /* ---------------------------------------------------------------------- */

  const handleToggleSidebar =
    useCallback(() => {
      setSidebarExpanded(
        (previous) => {
          const next =
            !previous;

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
        }
      );
    }, []);

  /* ---------------------------------------------------------------------- */
  /* Sidebar width                                                           */
  /* ---------------------------------------------------------------------- */

  const saveSidebarWidth =
    useCallback((width) => {
      if (
        width < 180 ||
        width > 400
      ) {
        return;
      }

      setSidebarWidth(width);

      try {
        localStorage.setItem(
          "offyai_sidebar_width",
          String(width)
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

  const handleResizeStart =
    useCallback((event) => {
      event.preventDefault();
      setIsResizing(true);
    }, []);

  /* ---------------------------------------------------------------------- */
  /* Sidebar resizing                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const handleResizeMove =
      (event) => {
        const newWidth =
          event.clientX;

        if (
          newWidth >= 180 &&
          newWidth <= 400
        ) {
          setSidebarWidth(
            newWidth
          );
        }
      };

    const handleResizeEnd =
      () => {
        setIsResizing(false);

        /*
         * Save the final width.
         *
         * Read the current state through the ref-compatible callback
         * behavior rather than introducing another status/update loop.
         */
        setSidebarWidth(
          (currentWidth) => {
            saveSidebarWidth(
              currentWidth
            );

            return currentWidth;
          }
        );
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

      document.body.style.cursor =
        "";

      document.body.style.userSelect =
        "";
    };
  }, [
    isResizing,
    saveSidebarWidth,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Layout dimensions                                                       */
  /* ---------------------------------------------------------------------- */

  const currentWidth =
    sidebarExpanded
      ? sidebarWidth
      : 56;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className={`h-screen w-screen flex flex-col ${
        resolvedTheme === "dark"
          ? "dark"
          : "light"
      }`}
    >
      <TitleBar />

      <div className="flex flex-1 overflow-hidden pt-7">
        {/* ---------------------------------------------------------------- */}
        {/* Sidebar                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div
          ref={sidebarRef}
          className="sidebar-resizable relative flex-shrink-0"
          style={{
            width: `${currentWidth}px`,
          }}
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
            onSettingsOpen={() =>
              setSettingsOpen(
                true
              )
            }
            onModelUploadOpen={() =>
              setModelUploadOpen(
                true
              )
            }
          />

          {/* Resize handle */}
          {sidebarExpanded && (
            <div
              className="sidebar-resize-handle"
              onMouseDown={
                handleResizeStart
              }
            />
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Main application area                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
              setSettingsOpen(
                true
              )
            }
            onModelUploadOpen={() =>
              setModelUploadOpen(
                true
              )
            }
          />

          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Settings                                                            */}
      {/* ------------------------------------------------------------------ */}

      <SettingsModal
        isOpen={
          settingsOpen
        }
        onClose={() =>
          setSettingsOpen(
            false
          )
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Model upload                                                        */}
      {/* ------------------------------------------------------------------ */}

      <ModelUploadModal
        isOpen={
          modelUploadOpen
        }
        onClose={() =>
          setModelUploadOpen(
            false
          )
        }
        onUploadSuccess={() => {
          setModelUploadOpen(
            false
          );
        }}
      />
    </div>
  );
};

export default Layout;