import React, {
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  Minus,
  Square,
  X,
  Maximize2,
} from "lucide-react";

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState("");
  const [appIcon, setAppIcon] = useState(null);

  /* ---------------------------------------------------------------------- */
  /* Platform + App Icon                                                    */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("win")) {
      setPlatform("windows");
    } else if (userAgent.includes("mac")) {
      setPlatform("mac");
    } else {
      setPlatform("linux");
    }

    let mounted = true;

    const loadAppIcon = async () => {
      if (!window.electronAPI?.getAppIcon) {
        return;
      }

      try {
        const iconData =
          await window.electronAPI.getAppIcon();

        if (mounted && iconData) {
          setAppIcon(iconData);
        }
      } catch (error) {
        console.error(
          "Failed to load app icon:",
          error
        );
      }
    };

    loadAppIcon();

    /* ------------------------------------------------------------------ */
    /* Window State                                                        */
    /* ------------------------------------------------------------------ */

    if (
      window.electronAPI?.onWindowStateChange
    ) {
      const unsubscribe =
        window.electronAPI.onWindowStateChange(
          (state) => {
            if (mounted) {
              setIsMaximized(
                state === "maximized"
              );
            }
          }
        );

      return () => {
        mounted = false;

        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Window Actions                                                         */
  /* ---------------------------------------------------------------------- */

  const handleMinimize = useCallback(() => {
    if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  }, []);

  const handleMaximize = useCallback(() => {
    if (window.electronAPI?.maximizeWindow) {
      window.electronAPI.maximizeWindow();
    }
  }, []);

  const handleClose = useCallback(() => {
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (platform === "windows") {
      handleMaximize();
    }
  }, [platform, handleMaximize]);

  /* ---------------------------------------------------------------------- */
  /* macOS uses native title bar                                            */
  /* ---------------------------------------------------------------------- */

  if (platform === "mac") {
    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="title-bar">
      <div
        className="title-bar-drag-region"
        onDoubleClick={handleDoubleClick}
      >
        {/* ================================================================ */}
        {/* Left: Application Identity                                        */}
        {/* ================================================================ */}

        <div className="title-bar-content">
          <div className="title-bar-title">
            <div className="title-bar-app">
              {appIcon && (
                <img
                  src={appIcon}
                  alt="OffyAI"
                  className="title-bar-app-icon"
                  draggable="false"
                />
              )}

              <span className="title-bar-app-name">
                OffyAI
              </span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Right: Window Controls                                         */}
          {/* ============================================================ */}

          <div className="title-bar-controls">
            <button
              type="button"
              onClick={handleMinimize}
              className="title-bar-button minimize-button"
              title="Minimize"
              aria-label="Minimize window"
            >
              <Minus
                className="title-bar-icon-minimize"
                strokeWidth={1.7}
              />
            </button>

            <button
              type="button"
              onClick={handleMaximize}
              className="title-bar-button maximize-button"
              title={
                isMaximized
                  ? "Restore"
                  : "Maximize"
              }
              aria-label={
                isMaximized
                  ? "Restore window"
                  : "Maximize window"
              }
            >
              {isMaximized ? (
                <Maximize2
                  className="title-bar-icon-maximize"
                  strokeWidth={1.7}
                />
              ) : (
                <Square
                  className="title-bar-icon-maximize"
                  strokeWidth={1.7}
                />
              )}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="title-bar-button close-button"
              title="Close"
              aria-label="Close window"
            >
              <X
                className="title-bar-icon-close"
                strokeWidth={1.8}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;