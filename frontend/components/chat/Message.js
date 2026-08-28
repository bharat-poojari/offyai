import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, Bot, Copy, Check, Code, FileText, Image, Video, Mic, Download } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const Message = ({ message }) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();

  const getBackgroundColor = () => {
    if (isUser) {
      return resolvedTheme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50';
    }
    return resolvedTheme === 'dark' ? 'bg-gray-800/50' : 'bg-white';
  };

  const getTextColor = () => {
    return resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900';
  };

  const getMutedTextColor = () => {
    return resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  };

  const getBorderColor = () => {
    return resolvedTheme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  const formatCodeBlocks = (content) => {
    if (!content) return null;
    
    const parts = content.split(/(```[\s\S]*?```|`[^`]*`)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const languageMatch = part.match(/^```(\w+)?/);
        const language = languageMatch ? languageMatch[1] : '';
        const code = part.slice(language ? language.length + 3 : 3, -3).trim();
        
        return (
          <div key={index} className={`my-2 rounded-lg overflow-hidden border ${getBorderColor()} ${resolvedTheme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
            {language && (
              <div className={`flex items-center justify-between px-2 py-1 ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'} border-b ${getBorderColor()}`}>
                <div className="flex items-center gap-1">
                  <Code className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <span className={`font-medium text-xs ${getTextColor()} uppercase`}>{language}</span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 text-xs ${getMutedTextColor()} ${resolvedTheme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-300'} rounded transition-colors`}
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            )}
            <pre className="p-2 overflow-x-auto text-xs custom-scrollbar">
              <code className={`${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'} font-mono`}>{code}</code>
            </pre>
          </div>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        const code = part.slice(1, -1);
        return (
          <code key={index} className={`${resolvedTheme === 'dark' ? 'bg-gray-700 text-gray-100' : 'bg-gray-200 text-gray-800'} px-1 py-0.5 rounded text-xs font-mono border ${getBorderColor()}`}>
            {code}
          </code>
        );
      } else {
        return part.split('\n').map((line, lineIndex) => (
          <div key={`${index}-${lineIndex}`} className={`${getTextColor()} text-sm leading-relaxed`}>
            {line}
            {lineIndex < part.split('\n').length - 1 && <br />}
          </div>
        ));
      }
    });
  };

  const renderContent = () => {
    if (!message.content) return null;

    return (
      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-p:leading-snug">
        {formatCodeBlocks(message.content)}
      </div>
    );
  };

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <Image className="w-3.5 h-3.5 text-green-500" />;
    if (fileType?.startsWith('video/')) return <Video className="w-3.5 h-3.5 text-purple-500" />;
    if (fileType?.includes('pdf')) return <FileText className="w-3.5 h-3.5 text-red-500" />;
    if (fileType?.includes('audio')) return <Mic className="w-3.5 h-3.5 text-blue-500" />;
    return <FileText className="w-3.5 h-3.5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        <div className={`text-xs font-medium ${getMutedTextColor()} uppercase tracking-wide`}>
          Attachments ({message.attachments.length})
        </div>
        {message.attachments.map((file, index) => (
          <div key={index} className={`flex items-center gap-1.5 p-1.5 rounded border ${resolvedTheme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
            {file.type === 'image' ? (
              <div className="flex-shrink-0 w-8 h-8 rounded overflow-hidden border border-gray-300 dark:border-gray-600">
                <img 
                  src={file.previewUrl || 'images/offyai.png'}
                  alt={file.originalName || file.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                {getFileIcon(file.type || 'file')}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-xs truncate ${resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                {file.originalName || file.name}
              </div>
              <div className={`text-xs ${resolvedTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {formatFileSize(file.size || 0)}
              </div>
            </div>
            <button 
              onClick={() => {
                if (file.path && window.electronAPI) {
                  window.electronAPI.openFile(file.path);
                }
              }}
              className={`p-1 ${resolvedTheme === 'dark' ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-800/30' : 'text-blue-500 hover:text-blue-700 hover:bg-blue-100'} rounded transition-colors`}
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex gap-2 p-2 ${getBackgroundColor()} border-b ${getBorderColor()} ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Avatar - Assistant */}
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shadow bg-gradient-to-br from-blue-500 to-purple-600">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col ${isUser ? 'items-end max-w-[80%]' : 'items-start max-w-[80%]'}`}>
        {/* Header */}
        <div className="flex items-center gap-1 mb-1">
          <span className={`font-medium text-xs ${getTextColor()}`}>
            {isUser ? "You" : "OffyAI"}
          </span>
          <span className={`text-xs ${getMutedTextColor()}`}>
            {formatTime(message.timestamp)}
          </span>
          {message.model && (
            <span className={`text-xs px-1 py-0.5 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
              {message.model}
            </span>
          )}
        </div>

        {/* Message Body */}
        <div className={`w-full rounded-lg p-2 ${isUser ? (resolvedTheme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50') : (resolvedTheme === 'dark' ? 'bg-gray-800/50' : 'bg-white')} border ${getBorderColor()}`}>
          <div className={`text-sm ${isUser ? (resolvedTheme === 'dark' ? 'text-white' : 'text-gray-800') : getTextColor()}`}>
            {renderContent()}
            {renderAttachments()}
          </div>

          {/* Actions */}
          {message.content && !isUser && (
            <div className="flex items-center gap-0.5 mt-1">
              <button
                onClick={handleCopy}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 text-xs ${getMutedTextColor()} ${resolvedTheme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} rounded transition-colors border ${getBorderColor()}`}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Avatar - User */}
      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shadow bg-blue-500">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Message;