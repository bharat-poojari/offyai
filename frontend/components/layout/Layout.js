import React, { useState, useEffect, useRef, useCallback, memo } from "react";
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
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState("general");
  const [modelUploadOpen, setModelUploadOpen] = useState(false);

  const { resolvedTheme } = useTheme();

  const sidebarRef = useRef(null);
  const sidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const resizeFrameRef = useRef(null);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  // Load saved sidebar & window layout
  useEffect(() => {
    let isMounted = true;
    
    try {
      const savedExpanded = localStorage.getItem("offyai_sidebar_expanded");
      const savedWidth = localStorage.getItem("offyai_sidebar_width");

      if (savedExpanded !== null && isMounted) {
        setSidebarExpanded(savedExpanded === "true");
      }

      if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        if (Number.isFinite(width) && width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
          if (isMounted) {
            setSidebarWidth(width);
            sidebarWidthRef.current = width;
          }
        }
      }
    } catch (error) {
      console.warn("Unable to restore sidebar settings:", error);
    }

    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarExpanded(false);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("offyai_sidebar_expanded", String(next));
      } catch (error) {
        console.warn("Unable to save sidebar state:", error);
      }
      return next;
    });
  }, []);

  // Keyboard Shortcuts (UX Enhancement)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + \\ to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        handleToggleSidebar();
      }
      // Cmd/Ctrl + , to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsInitialTab("general");
        setSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleSidebar]);

  const saveSidebarWidth = useCallback((width) => {
    const safeWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
    setSidebarWidth(safeWidth);
    sidebarWidthRef.current = safeWidth;

    try {
      localStorage.setItem("offyai_sidebar_width", String(safeWidth));
    } catch (error) {
      console.warn("Unable to save sidebar width:", error);
    }
  }, []);

  const handleResizeStart = useCallback((event) => {
    if (window.innerWidth < 768) return;
    event.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (event) => {
      const nextWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, event.clientX));
      sidebarWidthRef.current = nextWidth;

      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        setSidebarWidth(nextWidth);
      });
    };

    const handleResizeEnd = () => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      saveSidebarWidth(sidebarWidthRef.current);
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      if (resizeFrameRef.current) cancelAnimationFrame(resizeFrameRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, saveSidebarWidth]);

  const currentWidth = sidebarExpanded ? sidebarWidth : COLLAPSED_SIDEBAR_WIDTH;

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col ${resolvedTheme === "dark" ? "dark" : "light"} bg-[var(--background)] text-[var(--text-primary)]`}>
      <TitleBar />

      <div className="relative flex flex-1 min-h-0 overflow-hidden pt-7 bg-[var(--background)]">
        {/* Mobile Backdrop Overlay */}
        {sidebarExpanded && (
          <div 
            className="md:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={handleToggleSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={`sidebar-resizable relative z-30 flex min-h-0 flex-shrink-0 overflow-hidden ${isResizing ? "select-none" : ""}`}
          style={{
            width: `${currentWidth}px`,
            transition: isResizing ? "none" : "width 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="h-full w-full overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-[1px_0_8px_rgba(31,30,28,0.04)] backdrop-blur-xl">
            <Sidebar
              currentView={currentView}
              onViewChange={onViewChange}
              isConnected={isConnected}
              currentModel={currentModel}
              isExpanded={sidebarExpanded}
              onToggle={handleToggleSidebar}
              chatSessions={chatSessions}
              currentSessionId={currentSessionId}
              onCreateNewChat={onCreateNewChat}
              onSwitchChat={onSwitchChat}
              onDeleteChat={onDeleteChat}
              onRenameChat={onRenameChat}
              onTogglePinChat={onTogglePinChat}
              onSettingsOpen={() => setSettingsOpen(true)}
              onChangeModel={() => {
                setSettingsInitialTab("models");
                setSettingsOpen(true);
              }}
              onModelUploadOpen={() => setModelUploadOpen(true)}
            />
          </div>

          {/* Accessible Resize Handle */}
          {sidebarExpanded && (
            <div
              className={`sidebar-resize-handle group absolute right-[-3px] top-0 z-30 h-full w-[6px] cursor-ew-resize ${isResizing ? "bg-[var(--primary)]/20" : "bg-transparent"}`}
              onMouseDown={handleResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuenow={sidebarWidth}
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={MAX_SIDEBAR_WIDTH}
            >
              <div className={`absolute left-1/2 top-1/2 h-10 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150 ${isResizing ? "bg-[var(--primary)]" : "bg-transparent group-hover:bg-[var(--border)]"}`} />
            </div>
          )}
        </div>

        {/* Main Application Area */}
        <div className={`relative z-10 flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[var(--background)] ${isResizing ? "pointer-events-none" : ""}`}>
          <Header
            isConnected={isConnected}
            currentModel={currentModel}
            onToggleSidebar={handleToggleSidebar}
            onSettingsOpen={() => setSettingsOpen(true)}
            onChangeModel={() => {
              setSettingsInitialTab("models");
              setSettingsOpen(true);
            }}
            onModelUploadOpen={() => setModelUploadOpen(true)}
          />

          <main className="relative flex-1 min-h-0 min-w-0 overflow-hidden bg-[var(--surface-raised)]">
            <div className="relative h-full w-full">{children}</div>
          </main>
        </div>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onImportModel={() => {
          setSettingsOpen(false);
          setModelUploadOpen(true);
        }}
        initialTab={settingsInitialTab}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsInitialTab("general");
        }}
      />

      <ModelUploadModal
        isOpen={modelUploadOpen}
        onClose={() => setModelUploadOpen(false)}
        onOpenSettings={(tab = "models") => {
          setSettingsInitialTab(tab);
          setModelUploadOpen(false);
          setSettingsOpen(true);
        }}
        onUploadSuccess={() => setModelUploadOpen(false)}
      />
    </div>
  );
};

export default memo(Layout);