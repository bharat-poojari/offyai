import { useState, useEffect } from "react";
import { Minus, Square, X, Maximize2, Monitor } from "lucide-react";

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState("");
  const [appIcon, setAppIcon] = useState(null);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) setPlatform("windows");
    else if (userAgent.includes("mac")) setPlatform("mac");
    else setPlatform("linux");

    // Load app icon
    const loadAppIcon = async () => {
      if (window.electronAPI?.getAppIcon) {
        try {
          const iconData = await window.electronAPI.getAppIcon();
          if (iconData) {
            setAppIcon(iconData);
          }
        } catch (error) {
          console.error("Failed to load app icon:", error);
        }
      }
    };

    loadAppIcon();

    // Listen for window state changes
    if (window.electronAPI?.onWindowStateChange) {
      const unsubscribe = window.electronAPI.onWindowStateChange((state) => {
        setIsMaximized(state === "maximized");
      });
      return unsubscribe;
    }
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximizeWindow) {
      window.electronAPI.maximizeWindow();
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    }
  };

  const handleDoubleClick = () => {
    if (platform === "windows") {
      handleMaximize();
    }
  };

  // Hide title bar on macOS (uses system title bar)
  if (platform === "mac") return null;

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region" onDoubleClick={handleDoubleClick}>
        <div className="title-bar-content">
          <div className="title-bar-title">
            <div className="flex items-center gap-2">
              {appIcon ? (
                <img 
                src="/images/offyai.png" 
                alt="OffyAI" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = '<span class="text-white font-bold text-sm">O</span>';
                }}
              />
              ) : (
                <Monitor className="w-4 h-4 mr-1" />
              )}
              <span className="text-sm font-medium">OffyAI</span>
            </div>
          </div>
          <div className="title-bar-controls">
            <button 
              onClick={handleMinimize} 
              className="title-bar-button minimize-button" 
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button 
              onClick={handleMaximize} 
              className="title-bar-button maximize-button" 
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <Maximize2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </button>
            <button 
              onClick={handleClose} 
              className="title-bar-button close-button" 
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;