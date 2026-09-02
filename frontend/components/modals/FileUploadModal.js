import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  X,
  Upload,
  UploadCloud,
  FileText,
  Image,
  Video,
  Mic,
  File,
  AlertCircle,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  FileType2,
  Plus,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",

  "application/pdf",

  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",

  "video/mp4",
  "video/avi",
  "video/mov",
  "video/webm",
]);

const ALLOWED_EXTENSIONS = /\.(txt|md|csv|json|doc|docx|xls|xlsx)$/i;

const ACCEPT_ATTRIBUTE =
  ".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.mp3,.wav,.ogg,.aac,.mp4,.avi,.mov,.webm";

const FileUploadModal = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const dropZoneRef = useRef(null);

  /* ---------------------------------------------------------------------- */
  /* RESET                                                                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setDragActive(false);
      setUploading(false);
      setErrorMessage("");
    }
  }, [isOpen]);

  /* ---------------------------------------------------------------------- */
  /* KEYBOARD                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !uploading) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, uploading, onClose]);

  /* ---------------------------------------------------------------------- */
  /* FILE VALIDATION                                                         */
  /* ---------------------------------------------------------------------- */

  const validateFile = useCallback((file) => {
    if (!file) {
      return {
        valid: false,
        reason: "Invalid file.",
      };
    }

    const extensionAllowed =
      ALLOWED_EXTENSIONS.test(file.name);

    const mimeAllowed =
      ALLOWED_MIME_TYPES.has(file.type);

    if (!mimeAllowed && !extensionAllowed) {
      return {
        valid: false,
        reason: `Unsupported file type: ${file.name}`,
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        reason: `${file.name} exceeds the 100 MB limit.`,
      };
    }

    return {
      valid: true,
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* ADD FILES                                                              */
  /* ---------------------------------------------------------------------- */

  const handleFiles = useCallback(
    (files) => {
      if (!files || uploading) return;

      const incomingFiles = Array.from(files);

      const validFiles = [];
      const errors = [];

      incomingFiles.forEach((file) => {
        const validation = validateFile(file);

        if (!validation.valid) {
          errors.push(validation.reason);
          return;
        }

        validFiles.push(file);
      });

      setSelectedFiles((previous) => {
        const existingKeys = new Set(
          previous.map(
            (file) =>
              `${file.name}-${file.size}-${file.lastModified}`
          )
        );

        const uniqueIncoming = validFiles.filter(
          (file) => {
            const key = `${file.name}-${file.size}-${file.lastModified}`;

            if (existingKeys.has(key)) {
              return false;
            }

            existingKeys.add(key);
            return true;
          }
        );

        return [...previous, ...uniqueIncoming];
      });

      if (errors.length > 0) {
        setErrorMessage(
          errors.length === 1
            ? errors[0]
            : `${errors.length} files could not be added.`
        );
      } else {
        setErrorMessage("");
      }
    },
    [uploading, validateFile]
  );

  /* ---------------------------------------------------------------------- */
  /* DRAG & DROP                                                             */
  /* ---------------------------------------------------------------------- */

  const handleDragEnter = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!uploading) {
      setDragActive(true);
    }
  }, [uploading]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!uploading) {
      event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    }
  }, [uploading]);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      event.currentTarget === event.target ||
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      setDragActive(false);

      if (uploading) return;

      const files = event.dataTransfer?.files;

      if (files?.length) {
        handleFiles(files);
      }
    },
    [handleFiles, uploading]
  );

  /* ---------------------------------------------------------------------- */
  /* FILE INPUT                                                              */
  /* ---------------------------------------------------------------------- */

  const handleFileInput = useCallback(
    (event) => {
      const files = event.target?.files;

      if (files?.length) {
        handleFiles(files);
      }

      // Allows selecting the same file again later.
      event.target.value = "";
    },
    [handleFiles]
  );

  /* ---------------------------------------------------------------------- */
  /* REMOVE FILE                                                             */
  /* ---------------------------------------------------------------------- */

  const removeFile = useCallback(
    (index) => {
      if (uploading) return;

      setSelectedFiles((previous) =>
        previous.filter((_, fileIndex) => fileIndex !== index)
      );

      setErrorMessage("");
    },
    [uploading]
  );

  const clearFiles = useCallback(() => {
    if (uploading) return;

    setSelectedFiles([]);
    setErrorMessage("");
  }, [uploading]);

  /* ---------------------------------------------------------------------- */
  /* FILE HELPERS                                                            */
  /* ---------------------------------------------------------------------- */

  const getFileIcon = useCallback((file) => {
    const name = file?.name || "";
    const type = file?.type || "";

    if (type.startsWith("image/")) {
      return <Image alt="" aria-hidden="true" className="h-4 w-4" />;
    }

    if (type.startsWith("video/")) {
      return <Video className="h-4 w-4" />;
    }

    if (type.startsWith("audio/")) {
      return <Mic className="h-4 w-4" />;
    }

    if (type.includes("pdf")) {
      return <FileText className="h-4 w-4" />;
    }

    if (
      type.includes("json") ||
      /\.json$/i.test(name)
    ) {
      return <FileJson className="h-4 w-4" />;
    }

    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      /\.(xls|xlsx)$/i.test(name)
    ) {
      return <FileSpreadsheet className="h-4 w-4" />;
    }

    if (
      type.includes("word") ||
      /\.(doc|docx)$/i.test(name)
    ) {
      return <FileType2 className="h-4 w-4" />;
    }

    if (
      type.startsWith("text/") ||
      /\.(txt|md|csv)$/i.test(name)
    ) {
      return <FileText className="h-4 w-4" />;
    }

    return <File className="h-4 w-4" />;
  }, []);

  const getFileIconStyle = useCallback((file) => {
    const type = file?.type || "";
    const name = file?.name || "";

    if (type.startsWith("image/")) {
      return "bg-emerald-500/10 text-emerald-500";
    }

    if (type.startsWith("video/")) {
      return "bg-violet-500/10 text-violet-500";
    }

    if (type.startsWith("audio/")) {
      return "bg-[var(--accent-subtle)] text-[var(--primary)]";
    }

    if (type.includes("pdf")) {
      return "bg-red-500/10 text-red-500";
    }

    if (
      type.includes("json") ||
      /\.json$/i.test(name)
    ) {
      return "bg-amber-500/10 text-amber-500";
    }

    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      /\.(xls|xlsx)$/i.test(name)
    ) {
      return "bg-green-500/10 text-green-600";
    }

    if (
      type.includes("word") ||
      /\.(doc|docx)$/i.test(name)
    ) {
      return "bg-[var(--accent-subtle)] text-[var(--primary)]";
    }

    return "bg-gray-500/10 text-gray-500";
  }, []);

  const getFileTypeName = useCallback((file) => {
    const type = file?.type || "";
    const name = file?.name || "";

    if (type.startsWith("image/")) return "Image";
    if (type.startsWith("video/")) return "Video";
    if (type.startsWith("audio/")) return "Audio";
    if (type.includes("pdf")) return "PDF";

    if (type.includes("json") || /\.json$/i.test(name)) {
      return "JSON";
    }

    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      /\.(xls|xlsx)$/i.test(name)
    ) {
      return "Spreadsheet";
    }

    if (
      type.includes("word") ||
      /\.(doc|docx)$/i.test(name)
    ) {
      return "Word";
    }

    if (type.includes("csv") || /\.csv$/i.test(name)) {
      return "CSV";
    }

    if (
      type.startsWith("text/") ||
      /\.(txt|md)$/i.test(name)
    ) {
      return "Text";
    }

    return "Document";
  }, []);

  const formatFileSize = useCallback((bytes) => {
    if (!Number.isFinite(bytes)) return "0 B";

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(
      bytes /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  }, []);

  /* ---------------------------------------------------------------------- */
  /* SUMMARY                                                                 */
  /* ---------------------------------------------------------------------- */

  const totalSize = useMemo(
    () =>
      selectedFiles.reduce(
        (total, file) => total + file.size,
        0
      ),
    [selectedFiles]
  );

  const selectedCount = selectedFiles.length;

  /* ---------------------------------------------------------------------- */
  /* UPLOAD                                                                  */
  /* ---------------------------------------------------------------------- */

  const handleUpload = useCallback(async () => {
    if (
      selectedFiles.length === 0 ||
      uploading ||
      typeof onUpload !== "function"
    ) {
      return;
    }

    setUploading(true);
    setErrorMessage("");

    try {
      await Promise.resolve(
        onUpload(selectedFiles)
      );

      setSelectedFiles([]);
      setUploading(false);
      onClose?.();
    } catch (error) {
      console.error(
        "File upload failed:",
        error
      );

      setUploading(false);

      setErrorMessage(
        error?.message ||
          "Something went wrong while processing the files."
      );
    }
  }, [
    selectedFiles,
    uploading,
    onUpload,
    onClose,
  ]);

  /* ---------------------------------------------------------------------- */
  /* OUTSIDE CLICK                                                           */
  /* ---------------------------------------------------------------------- */

  const handleBackdropClick = useCallback(
    (event) => {
      if (
        event.target === event.currentTarget &&
        !uploading
      ) {
        onClose?.();
      }
    },
    [uploading, onClose]
  );

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        p-3
        sm:p-4
      "
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="
          absolute
          inset-0
          bg-black/45
          backdrop-blur-[6px]
          dark:bg-black/60
        "
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-upload-title"
        className="
          relative
          z-10
          flex
          max-h-[min(720px,calc(100vh-24px))]
          w-full
          max-w-xl
          flex-col
          overflow-hidden
          rounded-2xl
          border
          border-[var(--border)]
          bg-[var(--surface)]
          shadow-[0_28px_70px_rgba(15,23,42,0.18)]
          dark:shadow-black/50
        "
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {/* ================================================================ */}
        {/* HEADER                                                           */}
        {/* ================================================================ */}

        <header
          className="
            flex
            shrink-0
            items-center
            justify-between
            border-b
            border-[var(--border)]
            bg-[var(--surface-raised)]
            px-4
            py-3.5
            sm:px-5
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[var(--accent-subtle)]
                text-[var(--primary)]
                ring-1
                ring-[var(--ring)]/20
              "
            >
              <UploadCloud className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2
                id="file-upload-title"
                className="
                  truncate
                  text-sm
                  font-semibold
                  tracking-tight
                  text-[var(--text-primary)]
                "
              >
                Upload files
              </h2>

              <p
                className="
                  mt-0.5
                  truncate
                  text-[11px]
                  text-[var(--text-secondary)]
                "
              >
                Add documents and media to your conversation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close upload dialog"
            title="Close"
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              text-[var(--text-secondary)]
              transition-all
              duration-150
              hover:bg-[var(--surface-raised)]
              hover:text-[var(--text-primary)]
              active:scale-95
              disabled:pointer-events-none
              disabled:opacity-40
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[var(--ring)]
            "
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* ================================================================ */}
        {/* BODY                                                             */}
        {/* ================================================================ */}

        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            overscroll-contain
            p-3
            sm:p-4
          "
        >
          {/* ============================================================ */}
          {/* DROPZONE                                                       */}
          {/* ============================================================ */}

          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              group
              relative
              overflow-hidden
              rounded-xl
              border
              transition-all
              duration-200
              ${
                dragActive
                  ? `
                    border-[var(--primary)]
                    bg-[var(--accent-subtle)]
                    shadow-lg
                    shadow-[color:rgba(15,156,143,0.12)]
                  `
                  : `
                    border-dashed
                    border-[var(--border)]
                    bg-[var(--surface-raised)]
                    hover:border-[var(--primary)]/50
                    hover:bg-[var(--surface)]
                  `
              }
              ${
                uploading
                  ? "pointer-events-none opacity-60"
                  : ""
              }
            `}
          >
            {/* Active glow */}
            {dragActive && (
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  bg-[var(--accent-subtle)]
                "
              />
            )}

            <div
              className="
                relative
                flex
                flex-col
                items-center
                justify-center
                px-4
                py-7
                text-center
                sm:py-8
              "
            >
              <div
                className={`
                  mb-3
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-2xl
                  transition-all
                  duration-300
                  ${
                    dragActive
                      ? `
                        scale-110
                        bg-[var(--primary)]
                        text-[var(--primary-foreground)]
                        shadow-lg
                        shadow-[color:rgba(15,156,143,0.2)]
                      `
                      : `
                        bg-[var(--surface)]
                        text-[var(--text-secondary)]
                        shadow-sm
                        ring-1
                        ring-[var(--border)]
                        group-hover:-translate-y-0.5
                        group-hover:text-[var(--primary)]
                      `
                  }
                `}
              >
                {dragActive ? (
                  <UploadCloud className="h-5 w-5" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </div>

              <h3
                className="
                  text-sm
                  font-semibold
                  text-[var(--text-primary)]
                "
              >
                {dragActive
                  ? "Drop your files here"
                  : "Drag & drop files here"}
              </h3>

              <p
                className="
                  mt-1
                  text-[11px]
                  text-[var(--text-secondary)]
                "
              >
                or choose files from your computer
              </p>

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={uploading}
                className="
                  mt-4
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  bg-[var(--primary)]
                  px-3.5
                  py-2
                  text-xs
                  font-medium
                  text-[var(--primary-foreground)]
                  shadow-sm
                  shadow-[color:rgba(15,156,143,0.16)]
                  transition-all
                  duration-200
                  hover:-translate-y-px
                  hover:bg-[var(--primary-hover)]
                  hover:shadow-md
                  active:translate-y-0
                  disabled:pointer-events-none
                  disabled:opacity-50
                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[var(--ring)]
                  focus-visible:ring-offset-2
                  focus-visible:ring-offset-[var(--surface)]
                "
              >
                <Plus className="h-3.5 w-3.5" />
                Browse files
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTRIBUTE}
                onChange={handleFileInput}
                disabled={uploading}
                className="hidden"
              />

              <div
                className="
                  mt-4
                  flex
                  max-w-full
                  flex-wrap
                  items-center
                  justify-center
                  gap-x-3
                  gap-y-1
                  text-[9px]
                  text-gray-400
                  dark:text-gray-500
                "
              >
                <span>100 MB max per file</span>
                <span className="h-0.5 w-0.5 rounded-full bg-gray-300 dark:bg-gray-700" />
                <span>Multiple files supported</span>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* ERROR                                                          */}
          {/* ============================================================ */}

          {errorMessage && (
            <div
              className="
                mt-3
                flex
                items-start
                gap-2.5
                rounded-xl
                border
                border-red-200
                bg-red-50
                px-3
                py-2.5
                dark:border-red-900/60
                dark:bg-red-950/20
              "
              role="alert"
            >
              <AlertCircle
                className="
                  mt-0.5
                  h-4
                  w-4
                  shrink-0
                  text-red-500
                "
              />

              <p
                className="
                  min-w-0
                  flex-1
                  text-[11px]
                  leading-relaxed
                  text-red-700
                  dark:text-red-300
                "
              >
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={() =>
                  setErrorMessage("")
                }
                className="
                  shrink-0
                  text-red-400
                  hover:text-red-600
                  dark:hover:text-red-300
                "
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* SELECTED FILES HEADER                                         */}
          {/* ============================================================ */}

          {selectedCount > 0 && (
            <div className="mt-4">
              <div
                className="
                  mb-2
                  flex
                  min-w-0
                  items-center
                  justify-between
                  gap-3
                "
              >
                <div className="min-w-0">
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <h3
                      className="
                        truncate
                        text-xs
                        font-semibold
                        text-gray-800
                        dark:text-gray-100
                      "
                    >
                      Selected files
                    </h3>

                    <span
                      className="
                        rounded-md
                        bg-gray-100
                        px-1.5
                        py-0.5
                        text-[9px]
                        font-medium
                        text-gray-500
                        dark:bg-gray-800
                        dark:text-gray-400
                      "
                    >
                      {selectedCount}
                    </span>
                  </div>

                  <p
                    className="
                      mt-0.5
                      text-[9px]
                      text-gray-400
                      dark:text-gray-500
                    "
                  >
                    {formatFileSize(totalSize)} total
                  </p>
                </div>

                {!uploading && (
                  <button
                    type="button"
                    onClick={clearFiles}
                    className="
                      shrink-0
                      rounded-md
                      px-2
                      py-1
                      text-[10px]
                      font-medium
                      text-gray-400
                      transition-colors
                      hover:bg-red-50
                      hover:text-red-500
                      dark:hover:bg-red-950/30
                    "
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* ======================================================== */}
              {/* FILE LIST                                                  */}
              {/* ======================================================== */}

              <div
                className="
                  max-h-52
                  space-y-1.5
                  overflow-y-auto
                  overscroll-contain
                  pr-0.5
                "
              >
                {selectedFiles.map(
                  (file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                      className="
                        group
                        flex
                        min-w-0
                        items-center
                        gap-2.5
                        rounded-xl
                        border
                        border-gray-200/80
                        bg-white
                        px-2.5
                        py-2
                        transition-all
                        duration-150
                        hover:border-gray-300
                        hover:shadow-sm
                        dark:border-gray-800
                        dark:bg-gray-800/60
                        dark:hover:border-gray-700
                      "
                    >
                      {/* Icon */}
                      <div
                        className={`
                          flex
                          h-8
                          w-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          ${getFileIconStyle(file)}
                        `}
                      >
                        {getFileIcon(file)}
                      </div>

                      {/* File information */}
                      <div className="min-w-0 flex-1">
                        <div
                          className="
                            truncate
                            text-[11px]
                            font-medium
                            text-gray-800
                            dark:text-gray-100
                          "
                          title={file.name}
                        >
                          {file.name}
                        </div>

                        <div
                          className="
                            mt-0.5
                            flex
                            min-w-0
                            items-center
                            gap-1.5
                            text-[9px]
                            text-gray-400
                            dark:text-gray-500
                          "
                        >
                          <span>
                            {getFileTypeName(file)}
                          </span>

                          <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-700" />

                          <span>
                            {formatFileSize(file.size)}
                          </span>

                          <Check
                            className="
                              h-2.5
                              w-2.5
                              text-emerald-500
                            "
                          />
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() =>
                          removeFile(index)
                        }
                        disabled={uploading}
                        aria-label={`Remove ${file.name}`}
                        title="Remove file"
                        className="
                          flex
                          h-7
                          w-7
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          text-gray-400
                          opacity-0
                          transition-all
                          duration-150
                          hover:bg-red-50
                          hover:text-red-500
                          group-hover:opacity-100
                          group-focus-within:opacity-100
                          disabled:pointer-events-none
                          disabled:opacity-30
                          dark:hover:bg-red-950/30
                          focus:opacity-100
                          focus:outline-none
                          focus-visible:ring-2
                          focus-visible:ring-red-500
                        "
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* PROCESSING                                                    */}
          {/* ============================================================ */}

          {uploading && (
            <div
              className="
                mt-3
                overflow-hidden
                rounded-xl
                border
                border-[var(--primary)]/30
                bg-[var(--accent-subtle)]
              "
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className="
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-[var(--accent)]
                    text-[var(--primary)]
                  "
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="
                      text-[11px]
                      font-semibold
                      text-[var(--text-primary)]
                    "
                  >
                    Processing files
                  </p>

                  <p
                    className="
                      mt-0.5
                      truncate
                      text-[9px]
                      text-[var(--text-secondary)]
                    "
                  >
                    Preparing {selectedCount}{" "}
                    {selectedCount === 1
                      ? "file"
                      : "files"}{" "}
                    for your conversation...
                  </p>
                </div>
              </div>

              <div className="h-0.5 w-full overflow-hidden bg-[var(--border)]">
                <div
                  className="
                    h-full
                    w-1/3
                    animate-[fileUploadProgress_1.4s_ease-in-out_infinite]
                    bg-[var(--primary)]
                  "
                />
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SUPPORTED TYPES                                               */}
          {/* ============================================================ */}

          <div
            className="
              mt-4
              rounded-xl
              border
              border-gray-200/70
              bg-gray-50/60
              px-3
              py-2.5
              dark:border-gray-800
              dark:bg-gray-800/30
            "
          >
            <div
              className="
                flex
                items-start
                gap-2
              "
            >
              <CheckCircle2
                className="
                  mt-0.5
                  h-3.5
                  w-3.5
                  shrink-0
                  text-emerald-500
                "
              />

              <div className="min-w-0">
                <p
                  className="
                    text-[10px]
                    font-medium
                    text-gray-700
                    dark:text-gray-300
                  "
                >
                  Supported files
                </p>

                <p
                  className="
                    mt-0.5
                    text-[9px]
                    leading-relaxed
                    text-gray-400
                    dark:text-gray-500
                  "
                >
                  Text, Markdown, CSV, JSON, PDF, Word,
                  Excel, images, audio, and video.
                  Processing availability depends on the
                  active model.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* FOOTER                                                           */}
        {/* ================================================================ */}

        <footer
          className="
            flex
            shrink-0
            flex-col-reverse
            gap-2
            border-t
            border-[var(--border)]
            bg-[var(--surface-raised)]
            p-3
            sm:flex-row
            sm:items-center
            sm:justify-end
            sm:px-4
            sm:py-3
          "
        >
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="
              inline-flex
              min-h-9
              flex-1
              items-center
              justify-center
              rounded-lg
              border
              border-[var(--border)]
              bg-[var(--surface)]
              px-3
              py-2
              text-xs
              font-medium
              text-[var(--text-secondary)]
              transition-all
              duration-150
              hover:bg-[var(--surface-raised)]
              hover:text-[var(--text-primary)]
              active:scale-[0.99]
              disabled:pointer-events-none
              disabled:opacity-50
              sm:flex-none
              sm:min-w-[100px]
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[var(--ring)]
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUpload}
            disabled={
              selectedCount === 0 ||
              uploading
            }
            className="
              inline-flex
              min-h-9
              flex-1
              items-center
              justify-center
              gap-1.5
              rounded-lg
              bg-[var(--primary)]
              px-3
              py-2
              text-xs
              font-medium
              text-[var(--primary-foreground)]
              shadow-sm
              shadow-[color:rgba(15,156,143,0.16)]
              transition-all
              duration-200
              hover:-translate-y-px
              hover:bg-[var(--primary-hover)]
              hover:shadow-md
              active:translate-y-0
              disabled:pointer-events-none
              disabled:cursor-not-allowed
              disabled:opacity-40
              sm:flex-none
              sm:min-w-[125px]
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[var(--ring)]
              focus-visible:ring-offset-2
              focus-visible:ring-offset-[var(--surface)]
            "
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload
                {selectedCount > 0 && (
                  <span className="ml-0.5 rounded bg-white/15 px-1.5 py-0.5 text-[9px]">
                    {selectedCount}
                  </span>
                )}
              </>
            )}
          </button>
        </footer>
      </div>

      {/* Self-contained progress animation */}
      <style>
        {`
          @keyframes fileUploadProgress {
            0% {
              transform: translateX(-100%);
            }

            50% {
              transform: translateX(150%);
            }

            100% {
              transform: translateX(350%);
            }
          }
        `}
      </style>
    </div>
  );
};

export default FileUploadModal;