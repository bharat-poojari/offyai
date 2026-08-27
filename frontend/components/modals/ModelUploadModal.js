import React, {
  useEffect,
  useState,
} from "react";

import {
  X,
  Upload,
  Cpu,
  AlertCircle,
  CheckCircle,
  FileUp,
  HardDrive,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { useModel } from "../../contexts/ModelContext";

const SUPPORTED_EXTENSIONS = [
  ".gguf",
  ".bin",
  ".ggml",
];

const MAX_FILE_SIZE =
  10 * 1024 * 1024 * 1024;

const ModelUploadModal = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const {
    refreshModels,
  } = useModel();

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);

  const [
    selecting,
    setSelecting,
  ] = useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState(0);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  /* ---------------------------------------------------------------------- */
  /* Reset                                                                   */
  /* ---------------------------------------------------------------------- */

  const resetModal =
    () => {
      if (uploading) {
        return;
      }

      setSelectedFile(
        null
      );

      setSelecting(
        false
      );

      setUploading(
        false
      );

      setUploadProgress(
        0
      );

      setError("");

      setSuccess("");
    };

  /* ---------------------------------------------------------------------- */
  /* Reset when modal closes                                                 */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isOpen && !uploading) {
      resetModal();
    }
  }, [isOpen]);

  /* ---------------------------------------------------------------------- */
  /* Validate selected file                                                  */
  /* ---------------------------------------------------------------------- */

  const validateFile =
    (file) => {
      if (!file) {
        return "No model file was selected.";
      }

      const fileName =
        String(
          file.name || ""
        );

      const lowerName =
        fileName.toLowerCase();

      const extension =
        SUPPORTED_EXTENSIONS.find(
          (item) =>
            lowerName.endsWith(
              item
            )
        );

      if (!extension) {
        return (
          "Unsupported model format. " +
          "Please select a .gguf, .bin, or .ggml file."
        );
      }

      if (
        typeof file.size ===
          "number" &&
        file.size >
          MAX_FILE_SIZE
      ) {
        return (
          "The selected model is too large. " +
          "The maximum supported size is 10 GB."
        );
      }

      return null;
    };

  /* ---------------------------------------------------------------------- */
  /* Format size                                                             */
  /* ---------------------------------------------------------------------- */

  const formatFileSize =
    (bytes) => {
      if (
        typeof bytes !==
          "number" ||
        !Number.isFinite(
          bytes
        ) ||
        bytes < 0
      ) {
        return "Unknown size";
      }

      if (bytes === 0) {
        return "0 B";
      }

      const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB",
      ];

      const index =
        Math.min(
          Math.floor(
            Math.log(bytes) /
              Math.log(1024)
          ),
          units.length - 1
        );

      return `${parseFloat(
        (
          bytes /
          Math.pow(
            1024,
            index
          )
        ).toFixed(2)
      )} ${units[index]}`;
    };

  /* ---------------------------------------------------------------------- */
  /* Select file                                                             */
  /* ---------------------------------------------------------------------- */

  const handleSelectFile =
    async () => {
      if (
        selecting ||
        uploading
      ) {
        return;
      }

      setError("");
      setSuccess("");
      setSelecting(true);

      try {
        if (
          typeof window ===
            "undefined" ||
          !window.electronAPI
        ) {
          throw new Error(
            "Electron API is unavailable. Please restart the desktop application."
          );
        }

        if (
          typeof window.electronAPI
            .selectModelFile !==
          "function"
        ) {
          throw new Error(
            "Model file picker is unavailable. Please update the Electron preload script."
          );
        }

        const result =
          await window.electronAPI.selectModelFile();

        if (!result) {
          throw new Error(
            "The file picker returned no result."
          );
        }

        if (
          result.canceled
        ) {
          return;
        }

        if (
          result.success !==
          true
        ) {
          throw new Error(
            result.error ||
              "Unable to select the model file."
          );
        }

        const file =
          result.file;

        if (!file) {
          throw new Error(
            "No model file was returned."
          );
        }

        const validationError =
          validateFile(
            file
          );

        if (
          validationError
        ) {
          throw new Error(
            validationError
          );
        }

        /*
         * Never expose or display the full
         * filesystem path unnecessarily.
         *
         * The path is retained internally because
         * Electron needs it for the upload.
         */

        setSelectedFile({
          name:
            file.name,

          size:
            file.size,

          sizeFormatted:
            file.sizeFormatted ||
            formatFileSize(
              file.size
            ),

          extension:
            file.extension,

          modelId:
            file.modelId,

          path:
            file.path,
        });
      } catch (
        error
      ) {
        console.error(
          "Model file selection failed:",
          error
        );

        setSelectedFile(
          null
        );

        setError(
          error?.message ||
            "Unable to select model file."
        );
      } finally {
        setSelecting(
          false
        );
      }
    };

  /* ---------------------------------------------------------------------- */
  /* Upload                                                                  */
  /* ---------------------------------------------------------------------- */

  const handleUpload =
    async () => {
      if (
        !selectedFile ||
        uploading
      ) {
        return;
      }

      setError("");
      setSuccess("");
      setUploading(true);
      setUploadProgress(0);

      try {
        if (
          !window.electronAPI
        ) {
          throw new Error(
            "Electron API is unavailable."
          );
        }

        if (
          typeof window.electronAPI
            .uploadModel !==
          "function"
        ) {
          throw new Error(
            "Model upload IPC is unavailable."
          );
        }

        if (
          !selectedFile.path
        ) {
          throw new Error(
            "The selected model does not have a valid filesystem path."
          );
        }

        /*
         * The upload itself is performed in the
         * Electron main process.
         *
         * There is currently no byte-progress IPC
         * stream in the backend, so do NOT fake
         * progress.
         *
         * 10% means "upload started", and 100%
         * is only shown after the main process
         * confirms success.
         */

        setUploadProgress(10);

        const result =
          await window.electronAPI.uploadModel(
            selectedFile.path
          );

        if (
          !result ||
          result.success !==
            true
        ) {
          throw new Error(
            result?.error ||
              "Model upload failed."
          );
        }

        setUploadProgress(
          100
        );

        /*
         * Refresh the model list so the newly
         * uploaded model appears immediately.
         */

        if (
          typeof refreshModels ===
          "function"
        ) {
          await refreshModels();
        }

        setSuccess(
          result.message ||
            "Model uploaded successfully."
        );

        if (
          typeof onUploadSuccess ===
          "function"
        ) {
          await onUploadSuccess(
            result
          );
        }

        /*
         * Give React time to render the successful
         * state before closing the modal.
         */

        setTimeout(() => {
          setSelectedFile(
            null
          );

          setUploadProgress(
            0
          );

          setUploading(
            false
          );

          setSuccess("");

          onClose();
        }, 700);
      } catch (
        error
      ) {
        console.error(
          "Model upload failed:",
          error
        );

        setUploadProgress(
          0
        );

        setUploading(
          false
        );

        setError(
          error?.message ||
            "Model upload failed."
        );
      }
    };

  /* ---------------------------------------------------------------------- */
  /* Remove selected file                                                    */
  /* ---------------------------------------------------------------------- */

  const handleRemoveFile =
    () => {
      if (uploading) {
        return;
      }

      setSelectedFile(
        null
      );

      setError("");
      setSuccess("");
      setUploadProgress(
        0
      );
    };

  /* ---------------------------------------------------------------------- */
  /* Close                                                                   */
  /* ---------------------------------------------------------------------- */

  const handleClose =
    () => {
      if (
        uploading ||
        selecting
      ) {
        return;
      }

      resetModal();

      onClose();
    };

  /* ---------------------------------------------------------------------- */
  /* Escape key                                                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          handleClose();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isOpen,
    uploading,
    selecting,
  ]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-upload-title"
      >
        {/* ================================================================ */}
        {/* Header                                                           */}
        {/* ================================================================ */}

        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-3">
              <Upload className="h-6 w-6 text-blue-400" />
            </div>

            <div>
              <h2
                id="model-upload-title"
                className="text-lg font-semibold text-white"
              >
                Upload Model
              </h2>

              <p className="text-sm text-gray-400">
                Add a local GGUF, BIN, or GGML model
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              handleClose
            }
            disabled={
              uploading ||
              selecting
            }
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close upload dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ================================================================ */}
        {/* Body                                                             */}
        {/* ================================================================ */}

        <div className="space-y-5 p-6">
          {/* Error */}

          {error && (
            <div className="rounded-xl border border-red-800 bg-red-900/20 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

                <div>
                  <p className="font-medium text-red-300">
                    Upload error
                  </p>

                  <p className="mt-1 text-sm text-red-300/90">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success */}

          {success && (
            <div className="rounded-xl border border-green-800 bg-green-900/20 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />

                <div>
                  <p className="font-medium text-green-300">
                    Upload complete
                  </p>

                  <p className="mt-1 text-sm text-green-300/90">
                    {success}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* No file selected                                              */}
          {/* ============================================================ */}

          {!selectedFile && (
            <button
              type="button"
              onClick={
                handleSelectFile
              }
              disabled={
                selecting ||
                uploading
              }
              className="group w-full rounded-2xl border-2 border-dashed border-gray-600 bg-gray-900/30 p-10 text-center transition hover:border-blue-500 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-700 group-hover:bg-blue-500/10">
                {selecting ? (
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                ) : (
                  <FileUp className="h-8 w-8 text-gray-400 group-hover:text-blue-400" />
                )}
              </div>

              <p className="text-base font-medium text-white">
                {selecting
                  ? "Opening file picker..."
                  : "Select a model file"}
              </p>

              <p className="mt-2 text-sm text-gray-400">
                Choose a model from your computer
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition group-hover:bg-blue-500">
                <Upload className="h-4 w-4" />

                {selecting
                  ? "Please wait"
                  : "Browse Files"}
              </div>

              <div className="mt-5 space-y-1 text-xs text-gray-500">
                <p>
                  Supported: .gguf, .bin, .ggml
                </p>

                <p>
                  Maximum size: 10 GB
                </p>
              </div>
            </button>
          )}

          {/* ============================================================ */}
          {/* Selected file                                                 */}
          {/* ============================================================ */}

          {selectedFile && (
            <div className="space-y-4">
              <div className="rounded-xl border border-green-800 bg-green-900/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />

                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-green-300">
                      File selected
                    </p>

                    <p className="mt-1 text-sm text-green-300/80">
                      Ready to upload
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-blue-500/10 p-3">
                    <Cpu className="h-6 w-6 text-blue-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {selectedFile.name}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <HardDrive className="h-4 w-4" />

                        {selectedFile.sizeFormatted ||
                          formatFileSize(
                            selectedFile.size
                          )}
                      </span>

                      {selectedFile.extension && (
                        <span>
                          {selectedFile.extension.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload progress */}

              {uploading && (
                <div className="rounded-xl border border-blue-800 bg-blue-900/10 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-blue-300">
                      <Loader2 className="h-4 w-4 animate-spin" />

                      Uploading model...
                    </span>

                    <span className="font-medium text-blue-300">
                      {uploadProgress}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-gray-400">
                    Large model files can take several minutes to copy.
                  </p>
                </div>
              )}

              {/* Information */}

              {!uploading && (
                <div className="rounded-xl border border-yellow-800/70 bg-yellow-900/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />

                    <div>
                      <p className="font-medium text-yellow-300">
                        Before uploading
                      </p>

                      <p className="mt-1 text-sm text-yellow-300/80">
                        The model will be copied into the application's local models directory. Uploading does not automatically activate the model.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Footer                                                           */}
        {/* ================================================================ */}

        <div className="flex gap-3 border-t border-gray-700 bg-gray-900/30 px-6 py-5">
          <button
            type="button"
            onClick={
              selectedFile &&
              !uploading
                ? handleRemoveFile
                : handleClose
            }
            disabled={
              uploading ||
              selecting
            }
            className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-sm font-medium text-gray-200 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selectedFile
              ? "Choose Another"
              : "Cancel"}
          </button>

          {selectedFile && (
            <button
              type="button"
              onClick={
                handleUpload
              }
              disabled={
                uploading ||
                selecting
              }
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />

                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />

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