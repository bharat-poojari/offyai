import React, { useState, useEffect } from "react";
import { 
  MessageSquare, 
  BarChart3, 
  Plus, 
  Settings, 
  Upload,
  Cpu,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight
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
  onSettingsOpen,
  onModelUploadOpen
}) => {
  const [appIcon, setAppIcon] = useState(null);
  const { currentModel, isLoading } = useModel();
  const { resolvedTheme } = useTheme();

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

  const getThemeClasses = () => {
    if (resolvedTheme === 'dark') {
      return {
        background: 'bg-gray-900',
        border: 'border-gray-700',
        text: {
          primary: 'text-white',
          secondary: 'text-gray-300',
          muted: 'text-gray-400'
        },
        button: {
          hover: 'hover:bg-gray-800',
          active: 'bg-gray-800'
        }
      };
    } else {
      return {
        background: 'bg-white',
        border: 'border-gray-200',
        text: {
          primary: 'text-gray-900',
          secondary: 'text-gray-600',
          muted: 'text-gray-500'
        },
        button: {
          hover: 'hover:bg-gray-50',
          active: 'bg-gray-50'
        }
      };
    }
  };

  const formatModelName = (model) => {
    if (!model) return "No model";
    
    const name = model.name || model.id;
    return name
      .replace(/\.(gguf|bin|ggml)$/i, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const modelName = currentModel ? formatModelName(currentModel) : "No model";
  const theme = getThemeClasses();

  const menuItems = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "metrics", label: "Analytics", icon: BarChart3 },
  ];

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffTime = now - date;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: "short" });
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    } catch {
      return "";
    }
  };

  const getSessionTitle = (session) => {
    if (session.messages && session.messages.length > 0) {
      const firstUserMsg = session.messages.find((m) => m.role === "user");
      if (firstUserMsg && firstUserMsg.content) {
        return firstUserMsg.content.length > 25
          ? firstUserMsg.content.slice(0, 25) + "..."
          : firstUserMsg.content;
      }
    }
    return "New Chat";
  };

  return (
    <div className={`${theme.background} border-r ${theme.border} h-full flex flex-col overflow-hidden relative`}>
      
      {/* Header with Logo and Toggle Button */}
      <div className={`p-3 border-b ${theme.border}`}>
        <div className="flex items-center justify-between">
          {isExpanded && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                {appIcon ? (
                  <img 
                    src={appIcon} 
                    alt="OffyAI" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img 
                    src="/images/offyai.png" 
                    alt="OffyAI" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) {
                        e.target.parentNode.innerHTML = '<span class="text-white font-bold text-sm">O</span>';
                      }
                    }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold ${theme.text.primary} text-sm truncate`}>OffyAI</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                  <span className={`text-xs ${isConnected ? "text-green-500" : "text-red-500"}`}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {!isExpanded && (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                {appIcon ? (
                  <img 
                    src={appIcon} 
                    alt="OffyAI" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img 
                    src="/images/offyai.png" 
                    alt="OffyAI" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) {
                        e.target.parentNode.innerHTML = '<span class="text-white font-bold text-sm">O</span>';
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}
          
          {/* Toggle Button - Always visible */}
          <button 
            onClick={onToggle}
            className={`p-1.5 ${theme.button.hover} rounded-lg transition-colors flex-shrink-0 ${!isExpanded && 'absolute right-2 top-3'}`}
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? 
              <ChevronLeft className={`w-4 h-4 ${theme.text.secondary}`} /> : 
              <ChevronRight className={`w-4 h-4 ${theme.text.secondary}`} />
            }
          </button>
        </div>
      </div>

      {/* Model Status */}
      {modelName && modelName !== "No model" && (
        <div className={`p-2 mx-2 mt-2 rounded-lg border ${theme.border} ${theme.button.hover}`}>
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            {isExpanded && (
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium ${theme.text.primary} truncate`}>
                  {isLoading ? "Loading..." : modelName}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Chat Button */}
      <div className="p-2">
        <button
          onClick={onCreateNewChat}
          className={`w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm ${!isExpanded && 'px-2'}`}
          title={!isExpanded ? "New Chat" : ""}
        >
          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
          {isExpanded && <span>New Chat</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => onViewChange(item.id)} 
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm mb-0.5 ${
                isActive 
                  ? `bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300` 
                  : `${theme.text.secondary} ${theme.button.hover}`
              } ${!isExpanded && 'justify-center px-2'}`}
              title={!isExpanded ? item.label : ""}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {isExpanded && item.label}
            </button>
          );
        })}
      </nav>

      {/* Chat History - Only show when expanded */}
      {isExpanded && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-medium ${theme.text.muted} uppercase tracking-wide`}>Recent Chats</h3>
              <span className={`text-xs ${theme.text.muted} bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded`}>
                {chatSessions.length}
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
            {chatSessions.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className={`w-8 h-8 ${theme.text.muted} mx-auto mb-2`} />
                <p className={`text-xs ${theme.text.muted}`}>No chats yet</p>
                <p className={`text-xs ${theme.text.muted} mt-1`}>Start a conversation</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => onSwitchChat(session.id)}
                    className={`group relative p-2 rounded-lg cursor-pointer transition-colors ${
                      currentSessionId === session.id
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                        : `${theme.button.hover} ${theme.text.primary}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-blue-700 dark:text-blue-300' : theme.text.primary}`}>
                          {getSessionTitle(session)}
                        </div>
                        <div className={`text-xs flex items-center gap-1 mt-0.5 ${
                          currentSessionId === session.id 
                            ? "text-blue-600 dark:text-blue-400"
                            : theme.text.muted
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(session.updatedAt)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-colors rounded flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className={`p-2 border-t ${theme.border}`}>
        <div className={`space-y-1 ${!isExpanded && 'flex flex-col items-center'}`}>
          <button 
            onClick={onModelUploadOpen}
            className={`w-full flex items-center gap-2 px-3 py-2 ${theme.text.secondary} ${theme.button.hover} rounded-lg transition-colors text-sm ${!isExpanded && 'justify-center px-2'}`}
            title={!isExpanded ? "Upload Model" : ""}
          >
            <Upload className="w-3.5 h-3.5 flex-shrink-0" />
            {isExpanded && <span>Upload Model</span>}
          </button>
          <button 
            onClick={onSettingsOpen}
            className={`w-full flex items-center gap-2 px-3 py-2 ${theme.text.secondary} ${theme.button.hover} rounded-lg transition-colors text-sm ${!isExpanded && 'justify-center px-2'}`}
            title={!isExpanded ? "Settings" : ""}
          >
            <Settings className="w-3.5 h-3.5 flex-shrink-0" />
            {isExpanded && <span>Settings</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;