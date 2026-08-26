import React, { useState, useRef } from "react";
import { X, Upload, Cpu, AlertCircle, CheckCircle } from "lucide-react";
import { modelsAPI } from "../../utils/api";
import { useModel } from "../../contexts/ModelContext";

const ModelUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const { refreshModels } = useModel();

  const handleFileSelect = (files) => {
    const file = files[0];
    if (!file) return;

    setError(null);

    // Check file extension
    const allowedExtensions = ['.gguf', '.bin', '.ggml'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExt)) {
      setError(`Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed.`);
      return;
    }

    // Check file size (10GB max)
    if (file.size > 10 * 1024 * 1024 * 1024) {
      setError("File too large. Maximum size is 10GB.");
      return;
    }

    setSelectedFile(file);
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
      handleFileSelect(files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create progress simulation
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const result = await modelsAPI.uploadModel(selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Refresh models list
      await refreshModels();
      
      // Notify success
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }
      
      // Close modal after success
      setTimeout(() => {
        setUploading(false);
        setSelectedFile(null);
        setUploadProgress(0);
        onClose();
      }, 1000);

    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Upload failed. Please check your connection and try again.");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const resetModal = () => {
    setSelectedFile(null);
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setDragActive(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upload Model
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add a new AI model to your local collection
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={uploading}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              </div>
            </div>
          )}

          {!selectedFile ? (
            /* File Selection */
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragActive 
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" 
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Cpu className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-900 dark:text-white font-medium mb-2">
                Drag and drop your model file
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">or</p>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                accept=".gguf,.bin,.ggml"
              />
              
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div>Supported formats: .gguf, .bin, .ggml</div>
                <div>Maximum file size: 10GB</div>
              </div>
            </div>
          ) : (
            /* File Review */
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <div className="font-medium text-green-900 dark:text-green-100">
                      File Selected
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      Ready to upload
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Cpu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedFile.size)}
                    </div>
                  </div>
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Uploading...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Note:</strong> Large models may take several minutes to upload. 
                    Please don't close this window during upload.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-2xl">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {selectedFile ? 'Cancel' : 'Close'}
          </button>
          
          {selectedFile && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Model
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelUploadModal;