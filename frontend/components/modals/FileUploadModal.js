import React, { useState, useRef } from "react";
import { X, Upload, FileText, Image, Video, Mic, File, AlertCircle, CheckCircle } from "lucide-react";

const FileUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFiles = async (files) => {
    const fileArray = Array.from(files).filter(file => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'text/plain', 'text/markdown', 'text/csv', 'application/json',
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac',
        'video/mp4', 'video/avi', 'video/mov', 'video/webm'
      ];
      
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|md|csv|json|doc|docx|xls|xlsx)$/i)) {
        alert(`File type not supported: ${file.type || file.name}`);
        return false;
      }
      
      if (file.size > 100 * 1024 * 1024) {
        alert(`File too large: ${file.name} (max 100MB)`);
        return false;
      }
      
      return true;
    });
    
    setSelectedFiles(prev => [...prev, ...fileArray]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4 text-green-500" />;
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4 text-purple-500" />;
    if (file.type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (file.type.includes('audio')) return <Mic className="w-4 h-4 text-blue-500" />;
    if (file.type.includes('text') || file.name.match(/\.(txt|md|csv|json)$/)) return <FileText className="w-4 h-4 text-orange-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      setUploading(true);
      setTimeout(() => {
        onUpload(selectedFiles);
        setSelectedFiles([]);
        setUploading(false);
        onClose();
      }, 1000);
    }
  };

  const getFileTypeName = (file) => {
    if (file.type.startsWith('image/')) return 'Image';
    if (file.type.startsWith('video/')) return 'Video';
    if (file.type.includes('pdf')) return 'PDF';
    if (file.type.includes('audio')) return 'Audio';
    if (file.type.includes('text') || file.name.match(/\.(txt|md)$/)) return 'Text';
    if (file.name.match(/\.(csv)$/)) return 'CSV';
    if (file.name.match(/\.(json)$/)) return 'JSON';
    if (file.name.match(/\.(doc|docx)$/)) return 'Word Document';
    if (file.name.match(/\.(xls|xlsx)$/)) return 'Excel Spreadsheet';
    return 'Document';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
              <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Upload Files
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add files to your message
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Drag & Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg m-3 text-center transition-all duration-200 ${
            dragActive 
              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" 
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="p-4">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-900 dark:text-white font-medium text-sm mb-1">
              Drag and drop files here
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">or</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors text-xs"
            >
              <Upload className="w-3 h-3" />
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.mp3,.wav,.ogg,.aac,.mp4,.avi,.mov,.webm"
              disabled={uploading}
            />
            
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
              <div>Supported: Images, PDFs, Documents, Text, Audio, Video</div>
              <div>Maximum file size: 100MB per file</div>
            </div>
          </div>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="mx-3 mb-3">
            <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Selected Files ({selectedFiles.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-xs">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file)}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                        {file.name}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {getFileTypeName(file)} • {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="p-0.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mx-3 mb-3">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1">
                  <div className="font-medium text-yellow-900 dark:text-yellow-100">
                    Processing Files...
                  </div>
                  <div className="text-yellow-700 dark:text-yellow-300">
                    Please wait while we prepare your files
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-3 py-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 rounded transition-colors disabled:opacity-50 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading}
            className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center justify-center gap-1 text-xs"
          >
            {uploading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-3 h-3" />
                Upload ({selectedFiles.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;