import React, { useState, useEffect } from "react";
import { Menu, Settings, Upload, Cpu } from "lucide-react";
import { useModel } from "../../contexts/ModelContext";

const Header = ({ 
  isConnected, 
  onToggleSidebar, 
  onSettingsOpen,
  onModelUploadOpen 
}) => {
  const [appIcon, setAppIcon] = useState(null);
  const { currentModel, isLoading } = useModel();

  useEffect(() => {
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
  }, []);

  const formatModelName = (model) => {
    if (!model) return "No model selected";
    
    const name = model.name || model.id;
    return name
      .replace(/\.(gguf|bin|ggml)$/i, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const modelName = currentModel ? formatModelName(currentModel) : "No model selected";

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {appIcon ? (
                <img 
                  src={appIcon} 
                  alt="OffyAI" 
                  className="w-5 h-5 rounded"
                />
              ) : (
                <img 
                  src="/images/offyai.png" 
                  alt="OffyAI" 
                  className="w-5 h-5 rounded"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center text-white font-bold text-xs">O</div>';
                    }
                  }}
                />
              )}
              <h1 className="text-base font-semibold text-gray-900 dark:text-white">
                OffyAI
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
              isConnected 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? "Connected" : "Disconnected"}</span>
            </div>

            {modelName && modelName !== "No model selected" && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                <Cpu className="w-3 h-3" />
                <span className="max-w-32 truncate text-xs">
                  {isLoading ? "Loading..." : modelName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onModelUploadOpen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            title="Upload Model"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            onClick={onSettingsOpen}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Mobile status bar */}
      <div className="md:hidden flex items-center gap-3 mt-1.5 text-xs">
        <div className={`flex items-center gap-1 ${
          isConnected ? 'text-green-600' : 'text-red-600'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
        </div>

        {modelName && modelName !== "No model selected" && (
          <div className="flex items-center gap-1 text-blue-600">
            <Cpu className="w-3 h-3" />
            <span className="truncate text-xs">
              {isLoading ? "Loading..." : modelName}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;