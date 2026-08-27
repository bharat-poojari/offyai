import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  X,
  Upload,
  Cpu,
  AlertCircle,
  CheckCircle2,
  FileUp,
  HardDrive,
  Loader2,
  FileCode2,
  ShieldCheck,
  Sparkles,
  FolderOpen,
} from "lucide-react";

import { useModel } from "../../contexts/ModelContext";

/* ==========================================================================
   Constants
   ========================================================================== */

const SUPPORTED_EXTENSIONS = Object.freeze([
  ".gguf",
  ".bin",
  ".ggml",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "10 GB";

const DEFAULT_LOGO_SRC = "/offyai.png";

/* ==========================================================================
   Helpers
   ========================================================================== */

const formatFileSize = (bytes) => {
  if (
    typeof bytes !== "number" ||
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return "Unknown size";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${parseFloat(value.toFixed(2))} ${units[index]}`;
};

const getExtension = (fileName = "") => {
  const lowerName = String(fileName).toLowerCase();

  return (
    SUPPORTED_EXTENSIONS.find((extension) =>
      lowerName.endsWith(extension)
    ) || ""
  );
};

const validateFile = (file) => {
  if (!file) {
    return "No model file was selected.";
  }

  const extension = getExtension(file.name);

  if (!extension) {
    return (
      "Unsupported model format. " +
      "Please select a .gguf, .bin, or .ggml file."
    );
  }

  if (
    typeof file.size === "number" &&
    file.size > MAX_FILE_SIZE
  ) {
    return (
      `The selected model is too large. ` +
      `The maximum supported size is ${MAX_FILE_SIZE_LABEL}.`
    );
  }

  return null;
};

/* ==========================================================================
   Small UI Components
   ========================================================================== */

const StatusMessage = ({
  type,
  title,
  message,
}) => {
  const isError = type === "error";

  return (
    <div
      className={[
        "relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4",
        "animate-[fadeIn_180ms_ease-out]",
        "backdrop-blur-xl",
        isError
          ? "border-red-400/15 bg-red-500/[0.055]"
          : "border-emerald-400/15 bg-emerald-500/[0.055]",
      ].join(" ")}
      role={isError ? "alert" : "status"}
    >
      <div
        className={[
          "absolute inset-y-0 left-0 w-px",
          isError
            ? "bg-red-400/60"
            : "bg-emerald-400/60",
        ].join(" ")}
      />

      <div
        className={[
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          isError
            ? "border-red-400/10 bg-red-500/10"
            : "border-emerald-400/10 bg-emerald-500/10",
        ].join(" ")}
      >
        {isError ? (
          <AlertCircle className="h-4 w-4 text-red-400" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        )}
      </div>

      <div className="min-w-0 pt-0.5">
        <p
          className={[
            "text-sm font-semibold tracking-tight",
            isError
              ? "text-red-200"
              : "text-emerald-200",
          ].join(" ")}
        >
          {title}
        </p>

        <p
          className={[
            "mt-1 text-xs leading-relaxed",
            isError
              ? "text-red-200/60"
              : "text-emerald-200/60",
          ].join(" ")}
        >
          {message}
        </p>
      </div>
    </div>
  );
};

const FeaturePill = ({
  icon,
  children,
}) => {
  return (
    <div
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        border-white/[0.065]
        bg-white/[0.025]
        px-2.5
        py-1.5
        text-[10px]
        font-medium
        tracking-wide
        text-gray-500
        shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]
        transition-all
        duration-150
        hover:border-white/[0.11]
        hover:bg-white/[0.045]
        hover:text-gray-400
      "
    >
      {icon}
      <span>{children}</span>
    </div>
  );
};

/* ==========================================================================
   OFFYAI Logo
   ========================================================================== */

const OffyaiLogo = ({
  src = DEFAULT_LOGO_SRC,
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
    xl: "h-16 w-16",
  };

  const imageSize =
    sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className={[
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        "rounded-[14px]",
        "border border-white/[0.09]",
        "bg-white/[0.045]",
        "shadow-[0_8px_30px_rgba(0,0,0,0.18)]",
        imageSize,
        className,
      ].join(" ")}
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-[-35%]
          rounded-full
          bg-blue-500/[0.10]
          blur-2xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          rounded-[14px]
          bg-gradient-to-br
          from-white/[0.07]
          via-transparent
          to-transparent
        "
      />

      <img
        src={src}
        alt="OFFYAI"
        draggable="false"
        className="
          relative
          h-[68%]
          w-[68%]
          object-contain
          select-none
        "
      />
    </div>
  );
};

/* ==========================================================================
   Component
   ========================================================================== */

const ModelUploadModal = ({
  isOpen,
  onClose,
  onUploadSuccess,
  logoSrc = DEFAULT_LOGO_SRC,
}) => {
  const { refreshModels } = useModel();

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [selecting, setSelecting] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [dragActive, setDragActive] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const successTimerRef =
    useRef(null);

  const fileInputRef =
    useRef(null);

  /* ==========================================================================
     Cleanup
     ========================================================================== */

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(
          successTimerRef.current
        );
      }
    };
  }, []);

  /* ==========================================================================
     Reset
     ========================================================================== */

  const resetModal = useCallback(() => {
    if (uploading || selecting) {
      return;
    }

    setSelectedFile(null);
    setSelecting(false);
    setUploading(false);
    setUploadProgress(0);
    setDragActive(false);
    setError("");
    setSuccess("");

    if (successTimerRef.current) {
      clearTimeout(
        successTimerRef.current
      );

      successTimerRef.current = null;
    }
  }, [
    uploading,
    selecting,
  ]);

  /* ==========================================================================
     Reset when closed
     ========================================================================== */

  useEffect(() => {
    if (!isOpen && !uploading) {
      setSelectedFile(null);
      setSelecting(false);
      setUploadProgress(0);
      setDragActive(false);
      setError("");
      setSuccess("");
    }
  }, [
    isOpen,
    uploading,
  ]);

  /* ==========================================================================
     Process file
     ========================================================================== */

  const processFile = useCallback(
    (file) => {
      if (!file) {
        return;
      }

      const validationError =
        validateFile(file);

      if (validationError) {
        setSelectedFile(null);
        setError(validationError);
        setSuccess("");
        return;
      }

      const extension =
        file.extension ||
        getExtension(file.name);

      setError("");
      setSuccess("");

      setSelectedFile({
        name: file.name,
        size: file.size,
        sizeFormatted:
          file.sizeFormatted ||
          formatFileSize(file.size),
        extension,
        modelId: file.modelId,
        path: file.path,
      });
    },
    []
  );

  /* ==========================================================================
     Electron picker
     ========================================================================== */

  const handleSelectFile =
    useCallback(async () => {
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

        if (result.canceled) {
          return;
        }

        if (
          result.success !== true
        ) {
          throw new Error(
            result.error ||
              "Unable to select the model file."
          );
        }

        if (!result.file) {
          throw new Error(
            "No model file was returned."
          );
        }

        processFile(
          result.file
        );
      } catch (
        selectionError
      ) {
        console.error(
          "Model file selection failed:",
          selectionError
        );

        setSelectedFile(null);

        setError(
          selectionError?.message ||
            "Unable to select model file."
        );
      } finally {
        setSelecting(false);
      }
    }, [
      selecting,
      uploading,
      processFile,
    ]);

  /* ==========================================================================
     Drag & Drop
     ========================================================================== */

  const handleDragEnter =
    useCallback(
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (
          !uploading &&
          !selecting
        ) {
          setDragActive(true);
        }
      },
      [
        uploading,
        selecting,
      ]
    );

  const handleDragOver =
    useCallback(
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (
          !uploading &&
          !selecting
        ) {
          event.dataTransfer.dropEffect =
            "copy";

          setDragActive(true);
        }
      },
      [
        uploading,
        selecting,
      ]
    );

  const handleDragLeave =
    useCallback((event) => {
      event.preventDefault();
      event.stopPropagation();

      if (
        event.currentTarget ===
        event.target
      ) {
        setDragActive(false);
      }
    }, []);

  const handleDrop =
    useCallback(
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        setDragActive(false);

        if (
          uploading ||
          selecting
        ) {
          return;
        }

        const files =
          Array.from(
            event.dataTransfer?.files ||
              []
          );

        if (!files.length) {
          return;
        }

        processFile(files[0]);
      },
      [
        uploading,
        selecting,
        processFile,
      ]
    );

  /* ==========================================================================
     Native input
     ========================================================================== */

  const handleNativeFileInput =
    useCallback(
      (event) => {
        const file =
          event.target.files?.[0];

        if (file) {
          processFile(file);
        }

        event.target.value = "";
      },
      [processFile]
    );

  /* ==========================================================================
     Upload
     ========================================================================== */

  const handleUpload =
    useCallback(async () => {
      if (
        !selectedFile ||
        uploading
      ) {
        return;
      }

      setError("");
      setSuccess("");
      setUploading(true);

      /*
       * No fake byte-level progress.
       * 10% = operation started.
       * 100% = Electron confirmed completion.
       */
      setUploadProgress(10);

      try {
        if (
          typeof window ===
            "undefined" ||
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

        const result =
          await window.electronAPI.uploadModel(
            selectedFile.path
          );

        if (
          !result ||
          result.success !== true
        ) {
          throw new Error(
            result?.error ||
              "Model upload failed."
          );
        }

        setUploadProgress(100);

        if (
          typeof refreshModels ===
          "function"
        ) {
          await refreshModels();
        }

        const successMessage =
          result.message ||
          "Model uploaded successfully.";

        setSuccess(
          successMessage
        );

        if (
          typeof onUploadSuccess ===
          "function"
        ) {
          await onUploadSuccess(
            result
          );
        }

        successTimerRef.current =
          setTimeout(() => {
            setSelectedFile(null);
            setUploadProgress(0);
            setUploading(false);
            setSuccess("");
            onClose();
          }, 800);
      } catch (
        uploadError
      ) {
        console.error(
          "Model upload failed:",
          uploadError
        );

        setUploadProgress(0);
        setUploading(false);

        setError(
          uploadError?.message ||
            "Model upload failed."
        );
      }
    }, [
      selectedFile,
      uploading,
      refreshModels,
      onUploadSuccess,
      onClose,
    ]);

  /* ==========================================================================
     Remove
     ========================================================================== */

  const handleRemoveFile =
    useCallback(() => {
      if (uploading) {
        return;
      }

      setSelectedFile(null);
      setError("");
      setSuccess("");
      setUploadProgress(0);
    }, [uploading]);

  /* ==========================================================================
     Close
     ========================================================================== */

  const handleClose =
    useCallback(() => {
      if (
        uploading ||
        selecting
      ) {
        return;
      }

      resetModal();
      onClose();
    }, [
      uploading,
      selecting,
      resetModal,
      onClose,
    ]);

  /* ==========================================================================
     Keyboard
     ========================================================================== */

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
    handleClose,
  ]);

  /* ==========================================================================
     Render
     ========================================================================== */

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
        p-4
      "
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      {/* ====================================================================
          Backdrop
          ==================================================================== */}

      <div
        className="
          absolute
          inset-0
          bg-black/80
          backdrop-blur-xl
        "
      />

      {/* ====================================================================
          Modal
          ==================================================================== */}

      <div
        className="
          relative
          flex
          max-h-[calc(100vh-2rem)]
          w-full
          max-w-[560px]
          flex-col
          overflow-hidden
          rounded-[24px]
          border
          border-white/[0.09]
          bg-[#0c0e13]/95
          shadow-[0_32px_120px_rgba(0,0,0,0.72)]
          ring-1
          ring-black/30
          animate-[modalIn_180ms_ease-out]
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-upload-title"
        aria-describedby="model-upload-description"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        {/* ==================================================================
            Top accent
            ================================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            inset-x-8
            top-0
            h-px
            bg-gradient-to-r
            from-transparent
            via-blue-400/70
            to-transparent
          "
        />

        {/* ==================================================================
            Ambient lighting
            ================================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            -right-40
            -top-40
            h-80
            w-80
            rounded-full
            bg-blue-500/[0.055]
            blur-[90px]
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            -left-40
            top-1/2
            h-72
            w-72
            rounded-full
            bg-indigo-500/[0.025]
            blur-[90px]
          "
        />

        {/* ==================================================================
            Header
            ================================================================== */}

        <header
          className="
            relative
            flex
            shrink-0
            items-center
            justify-between
            border-b
            border-white/[0.065]
            px-6
            py-5
          "
        >
          <div className="flex min-w-0 items-center gap-3.5">

            {/* OFFYAI Logo */}

            <OffyaiLogo
              src={logoSrc}
              size="md"
            />

            <div className="min-w-0">

              <div className="flex items-center gap-2.5">
                <h2
                  id="model-upload-title"
                  className="
                    truncate
                    text-[15px]
                    font-semibold
                    tracking-[-0.01em]
                    text-white
                  "
                >
                  Add local model
                </h2>

                <span
                  className="
                    hidden
                    items-center
                    rounded-full
                    border
                    border-blue-400/10
                    bg-blue-500/[0.055]
                    px-2
                    py-0.5
                    text-[8px]
                    font-semibold
                    uppercase
                    tracking-[0.14em]
                    text-blue-300/70
                    sm:inline-flex
                  "
                >
                  OFFYAI
                </span>
              </div>

              <p
                id="model-upload-description"
                className="
                  mt-1
                  text-[11px]
                  leading-none
                  text-gray-500
                "
              >
                Import a local GGUF, BIN, or GGML model
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={
              uploading ||
              selecting
            }
            className="
              ml-4
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-transparent
              text-gray-500
              transition-all
              duration-150
              hover:border-white/[0.06]
              hover:bg-white/[0.045]
              hover:text-gray-200
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500/30
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
            aria-label="Close upload dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* ==================================================================
            Body
            ================================================================== */}

        <main
          className="
            relative
            min-h-0
            flex-1
            overflow-y-auto
            p-5
            sm:p-6
          "
        >
          <div className="space-y-4">

            {/* Error */}

            {error && (
              <StatusMessage
                type="error"
                title="Unable to continue"
                message={error}
              />
            )}

            {/* Success */}

            {success && (
              <StatusMessage
                type="success"
                title="Model imported"
                message={success}
              />
            )}

            {/* =================================================================
                Empty / Drop Zone
                ================================================================= */}

            {!selectedFile && (
              <div
                className={[
                  "group relative overflow-hidden rounded-[22px] border transition-all duration-200",
                  dragActive
                    ? [
                        "border-blue-400/60",
                        "bg-blue-500/[0.065]",
                        "shadow-[0_0_0_1px_rgba(96,165,250,0.10),0_24px_80px_rgba(37,99,235,0.10)]",
                      ].join(" ")
                    : [
                        "border-white/[0.075]",
                        "bg-white/[0.018]",
                        "hover:border-white/[0.11]",
                        "hover:bg-white/[0.025]",
                      ].join(" "),
                  uploading ||
                  selecting
                    ? "pointer-events-none opacity-60"
                    : "",
                ].join(" ")}
                onDragEnter={
                  handleDragEnter
                }
                onDragOver={
                  handleDragOver
                }
                onDragLeave={
                  handleDragLeave
                }
                onDrop={
                  handleDrop
                }
              >
                {/* Drop zone grid */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    opacity-[0.025]
                    [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)]
                    [background-size:28px_28px]
                  "
                />

                {/* Ambient glow */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    -right-24
                    -top-24
                    h-56
                    w-56
                    rounded-full
                    bg-blue-500/[0.06]
                    blur-3xl
                    transition-all
                    duration-500
                    group-hover:bg-blue-500/[0.09]
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    -bottom-32
                    -left-20
                    h-48
                    w-48
                    rounded-full
                    bg-indigo-500/[0.035]
                    blur-3xl
                  "
                />

                <div
                  className="
                    relative
                    px-5
                    py-9
                    text-center
                    sm:px-8
                    sm:py-11
                  "
                >
                  {/* =========================================================
                      OFFYAI Logo
                      ========================================================= */}

                  <div
                    className={[
                      "mx-auto mb-6 flex h-[82px] w-[82px] items-center justify-center rounded-[24px] border transition-all duration-300",
                      dragActive
                        ? [
                            "scale-105",
                            "border-blue-400/25",
                            "bg-blue-500/[0.10]",
                            "shadow-[0_12px_40px_rgba(37,99,235,0.16)]",
                          ].join(" ")
                        : [
                            "border-white/[0.075]",
                            "bg-white/[0.028]",
                            "shadow-[0_12px_40px_rgba(0,0,0,0.16)]",
                            "group-hover:border-white/[0.11]",
                            "group-hover:bg-white/[0.04]",
                            "group-hover:shadow-[0_16px_50px_rgba(0,0,0,0.22)]",
                          ].join(" "),
                    ].join(" ")}
                  >
                    {selecting ? (
                      <div
                        className="
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-2xl
                          border
                          border-blue-400/10
                          bg-blue-500/[0.07]
                        "
                      >
                        <Loader2
                          className="
                            h-6
                            w-6
                            animate-spin
                            text-blue-400
                          "
                        />
                      </div>
                    ) : (
                      <OffyaiLogo
                        src={logoSrc}
                        size="lg"
                        className="
                          border-0
                          bg-transparent
                          shadow-none
                        "
                      />
                    )}
                  </div>

                  {/* Heading */}

                  <h3
                    className="
                      text-[15px]
                      font-semibold
                      tracking-[-0.01em]
                      text-gray-100
                    "
                  >
                    {selecting
                      ? "Opening file picker..."
                      : dragActive
                      ? "Drop your model here"
                      : "Import a local model"}
                  </h3>

                  {/* Description */}

                  <p
                    className="
                      mx-auto
                      mt-2
                      max-w-[380px]
                      text-[11px]
                      leading-[1.7]
                      text-gray-500
                    "
                  >
                    {selecting
                      ? "Please wait while the system opens the model picker."
                      : "Drag and drop your model here, or browse your computer to select a file."}
                  </p>

                  {/* Browse */}

                  {!selecting && (
                    <button
                      type="button"
                      onClick={
                        handleSelectFile
                      }
                      disabled={
                        uploading ||
                        selecting
                      }
                      className="
                        mt-6
                        inline-flex
                        h-10
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-blue-400/10
                        bg-blue-600
                        px-4
                        text-[11px]
                        font-semibold
                        text-white
                        shadow-[0_8px_24px_rgba(37,99,235,0.18)]
                        transition-all
                        duration-150
                        hover:border-blue-300/15
                        hover:bg-blue-500
                        hover:shadow-[0_10px_30px_rgba(37,99,235,0.25)]
                        focus:outline-none
                        focus:ring-2
                        focus:ring-blue-500/35
                        active:scale-[0.98]
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                      "
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Browse files
                    </button>
                  )}

                  {/* Hidden native input */}

                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".gguf,.bin,.ggml"
                    onChange={
                      handleNativeFileInput
                    }
                    disabled={
                      uploading ||
                      selecting
                    }
                  />

                  {/* Feature pills */}

                  <div
                    className="
                      mt-7
                      flex
                      flex-wrap
                      items-center
                      justify-center
                      gap-1.5
                    "
                  >
                    <FeaturePill
                      icon={
                        <FileCode2 className="h-3 w-3 text-blue-400/80" />
                      }
                    >
                      GGUF / BIN / GGML
                    </FeaturePill>

                    <FeaturePill
                      icon={
                        <HardDrive className="h-3 w-3 text-gray-500" />
                      }
                    >
                      Up to 10 GB
                    </FeaturePill>

                    <FeaturePill
                      icon={
                        <ShieldCheck className="h-3 w-3 text-emerald-400/80" />
                      }
                    >
                      Local
                    </FeaturePill>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================
                Selected Model
                ================================================================= */}

            {selectedFile && (
              <section className="space-y-4">

                {/* Selected model card */}

                <div
                  className="
                    relative
                    overflow-hidden
                    rounded-[20px]
                    border
                    border-white/[0.075]
                    bg-white/[0.022]
                    shadow-[0_12px_40px_rgba(0,0,0,0.12)]
                  "
                >
                  <div
                    className="
                      absolute
                      inset-x-0
                      top-0
                      h-px
                      bg-gradient-to-r
                      from-transparent
                      via-emerald-400/50
                      to-transparent
                    "
                  />

                  <div
                    className="
                      absolute
                      -right-20
                      -top-20
                      h-40
                      w-40
                      rounded-full
                      bg-blue-500/[0.035]
                      blur-3xl
                    "
                  />

                  <div
                    className="
                      relative
                      flex
                      items-center
                      gap-3.5
                      p-4
                      sm:p-5
                    "
                  >
                    <div
                      className="
                        flex
                        h-12
                        w-12
                        shrink-0
                        items-center
                        justify-center
                        rounded-[14px]
                        border
                        border-blue-400/10
                        bg-blue-500/[0.07]
                        shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
                      "
                    >
                      <Cpu className="h-5 w-5 text-blue-400" />
                    </div>

                    <div className="min-w-0 flex-1">

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <div
                          className="
                            flex
                            h-4
                            w-4
                            items-center
                            justify-center
                            rounded-full
                            bg-emerald-400/10
                          "
                        >
                          <CheckCircle2
                            className="
                              h-3
                              w-3
                              text-emerald-400
                            "
                          />
                        </div>

                        <span
                          className="
                            text-[9px]
                            font-semibold
                            uppercase
                            tracking-[0.14em]
                            text-emerald-400
                          "
                        >
                          Ready to import
                        </span>
                      </div>

                      <p
                        className="
                          mt-1.5
                          truncate
                          text-[13px]
                          font-semibold
                          tracking-[-0.005em]
                          text-gray-100
                        "
                        title={selectedFile.name}
                      >
                        {selectedFile.name}
                      </p>

                      <div
                        className="
                          mt-1.5
                          flex
                          flex-wrap
                          items-center
                          gap-x-3
                          gap-y-1
                          text-[10px]
                          text-gray-500
                        "
                      >
                        <span
                          className="
                            inline-flex
                            items-center
                            gap-1
                          "
                        >
                          <HardDrive className="h-3 w-3" />

                          {selectedFile.sizeFormatted ||
                            formatFileSize(
                              selectedFile.size
                            )}
                        </span>

                        {selectedFile.extension && (
                          <>
                            <span className="h-0.5 w-0.5 rounded-full bg-gray-700" />

                            <span className="font-medium uppercase tracking-wider">
                              {selectedFile.extension.replace(
                                ".",
                                ""
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleRemoveFile
                      }
                      disabled={
                        uploading
                      }
                      className="
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-transparent
                        text-gray-600
                        transition-all
                        hover:border-white/[0.06]
                        hover:bg-white/[0.05]
                        hover:text-gray-300
                        disabled:cursor-not-allowed
                        disabled:opacity-40
                      "
                      aria-label="Choose another model"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* ===========================================================
                    Progress
                    =========================================================== */}

                {uploading && (
                  <div
                    className="
                      relative
                      overflow-hidden
                      rounded-[20px]
                      border
                      border-blue-400/10
                      bg-blue-500/[0.045]
                      p-4
                    "
                  >
                    <div
                      className="
                        pointer-events-none
                        absolute
                        -right-16
                        -top-16
                        h-32
                        w-32
                        rounded-full
                        bg-blue-500/[0.06]
                        blur-3xl
                      "
                    />

                    <div
                      className="
                        relative
                        mb-3
                        flex
                        items-center
                        justify-between
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2.5
                        "
                      >
                        <div
                          className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-blue-400/10
                            bg-blue-500/[0.08]
                          "
                        >
                          <Loader2
                            className="
                              h-3.5
                              w-3.5
                              animate-spin
                              text-blue-400
                            "
                          />
                        </div>

                        <div>
                          <p
                            className="
                              text-[11px]
                              font-semibold
                              text-blue-100
                            "
                          >
                            Importing model
                          </p>

                          <p
                            className="
                              mt-0.5
                              text-[9px]
                              text-gray-500
                            "
                          >
                            Copying into local model storage
                          </p>
                        </div>
                      </div>

                      <span
                        className="
                          text-[11px]
                          font-semibold
                          tabular-nums
                          text-blue-300
                        "
                      >
                        {uploadProgress}%
                      </span>
                    </div>

                    <div
                      className="
                        relative
                        h-1.5
                        overflow-hidden
                        rounded-full
                        bg-white/[0.06]
                      "
                    >
                      <div
                        className="
                          h-full
                          rounded-full
                          bg-gradient-to-r
                          from-blue-600
                          via-blue-500
                          to-blue-400
                          shadow-[0_0_12px_rgba(59,130,246,0.35)]
                          transition-[width]
                          duration-300
                        "
                        style={{
                          width: `${uploadProgress}%`,
                        }}
                      />
                    </div>

                    <p
                      className="
                        relative
                        mt-2.5
                        text-[9px]
                        text-gray-600
                      "
                    >
                      Large models may take several minutes to copy.
                    </p>
                  </div>
                )}

                {/* ===========================================================
                    Information
                    =========================================================== */}

                {!uploading &&
                  !success && (
                    <div
                      className="
                        relative
                        flex
                        items-start
                        gap-3
                        overflow-hidden
                        rounded-[18px]
                        border
                        border-amber-400/10
                        bg-amber-400/[0.03]
                        p-4
                      "
                    >
                      <div
                        className="
                          mt-0.5
                          flex
                          h-8
                          w-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          border
                          border-amber-400/10
                          bg-amber-400/[0.055]
                        "
                      >
                        <AlertCircle
                          className="
                            h-3.5
                            w-3.5
                            text-amber-400
                          "
                        />
                      </div>

                      <div>
                        <p
                          className="
                            text-[11px]
                            font-semibold
                            text-amber-200
                          "
                        >
                          Before importing
                        </p>

                        <p
                          className="
                            mt-1
                            text-[10px]
                            leading-[1.65]
                            text-amber-200/55
                          "
                        >
                          The model will be copied into the application's local models directory. Importing it does not automatically activate the model.
                        </p>
                      </div>
                    </div>
                  )}
              </section>
            )}

            {/* =================================================================
                Footer information
                ================================================================= */}

            <div
              className="
                flex
                items-center
                justify-center
                gap-1.5
                pt-1
                text-[9px]
                font-medium
                tracking-wide
                text-gray-600
              "
            >
              <ShieldCheck className="h-3 w-3" />

              <span>
                Models remain on your local machine
              </span>
            </div>
          </div>
        </main>

        {/* ==================================================================
            Footer
            ================================================================== */}

        <footer
          className="
            relative
            flex
            shrink-0
            gap-2.5
            border-t
            border-white/[0.065]
            bg-white/[0.012]
            px-5
            py-4
            sm:px-6
          "
        >
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
            className="
              flex
              h-10
              flex-1
              items-center
              justify-center
              rounded-xl
              border
              border-white/[0.075]
              bg-white/[0.025]
              px-4
              text-[11px]
              font-semibold
              text-gray-400
              transition-all
              duration-150
              hover:border-white/[0.11]
              hover:bg-white/[0.05]
              hover:text-gray-200
              focus:outline-none
              focus:ring-2
              focus:ring-white/10
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {selectedFile
              ? "Choose another"
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
              className="
                flex
                h-10
                flex-1
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-blue-400/10
                bg-blue-600
                px-4
                text-[11px]
                font-semibold
                text-white
                shadow-[0_8px_24px_rgba(37,99,235,0.18)]
                transition-all
                duration-150
                hover:border-blue-300/15
                hover:bg-blue-500
                hover:shadow-[0_10px_30px_rgba(37,99,235,0.25)]
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500/35
                active:scale-[0.99]
                disabled:cursor-not-allowed
                disabled:border-transparent
                disabled:bg-gray-800
                disabled:text-gray-600
                disabled:shadow-none
              "
            >
              {uploading ? (
                <>
                  <Loader2
                    className="
                      h-3.5
                      w-3.5
                      animate-spin
                    "
                  />

                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />

                  Import model
                </>
              )}
            </button>
          )}
        </footer>
      </div>

      {/* ====================================================================
          Local animations
          ==================================================================== */}

      <style>
        {`
          @keyframes modalIn {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.985);
            }

            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ModelUploadModal;