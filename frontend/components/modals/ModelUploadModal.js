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
  Search,
  ExternalLink,
  MemoryStick,
  Gauge,
  Settings2,
} from "lucide-react";

import { useModel } from "../../contexts/ModelContext";
import { modelsAPI } from "../../utils/api";

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

const DEFAULT_LOGO_SRC = "images/offyai.png";

const RECOMMENDATION_GOALS = [
  {
    id: "general",
    label: "General AI",
    keywords: ["qwen", "llama", "mistral", "gemma", "phi", "deepseek"],
  },
  {
    id: "coding",
    label: "Coding",
    keywords: [
      "code",
      "coder",
      "qwen coder",
      "deepseek coder",
      "magicoder",
      "codellama",
    ],
  },
  {
    id: "reasoning",
    label: "Reasoning",
    keywords: ["reasoning", "deepseek r1", "qwen", "mistral", "math"],
  },
  {
    id: "writing",
    label: "Writing",
    keywords: ["instruct", "chat", "llama", "mistral", "qwen"],
  },
  {
    id: "research",
    label: "Research",
    keywords: ["llama", "qwen", "mistral", "phi", "instruct"],
  },
  {
    id: "roleplay",
    label: "Roleplay",
    keywords: ["chat", "instruct", "assistant", "qwen", "mistral"],
  },
  {
    id: "fast",
    label: "Fast responses",
    keywords: ["tiny", "small", "fast", "7b", "8b", "3b"],
  },
];

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

const formatTransferRate = (bytesPerSecond) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return "Waiting for data";
  }

  return `${formatFileSize(bytesPerSecond)}/s`;
};

const getModelFile = (model) => {
  const fileName = String(model?.recommendedFile || "").trim();
  const normalizedName = fileName.split("/").pop().toLowerCase();
  const sources = [
    ...(Array.isArray(model?.fileMetadata) ? model.fileMetadata : []),
    ...(Array.isArray(model?.siblings) ? model.siblings : []),
    ...(Array.isArray(model?.files) ? model.files : []),
  ];
  const file = sources.find((entry) => {
    const entryName = String(
      entry?.name || entry?.rfilename || entry?.filename || entry || ""
    ).trim();

    return (
      entryName === fileName ||
      entryName.split("/").pop().toLowerCase() === normalizedName
    );
  });
  const sizeBytes = Number(
    file?.sizeBytes ?? file?.size ?? file?.bytes ?? file?.lfs?.size
  );

  return {
    name: fileName,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : null,
  };
};

const getQuantizationLabel = (fileName = "") => {
  const precisionMatch = String(fileName).match(
    /(?:^|[-_])(F32|F16|BF16)(?:[-_.]|$)/i
  );

  if (precisionMatch?.[1]) {
    return precisionMatch[1].toUpperCase();
  }

  const match = String(fileName).match(
    /(?:^|[-_])(IQ?[0-9][A-Z0-9_]*|Q[0-9](?:_[A-Z0-9]+)*)\.(?:gguf|bin|ggml)$/i
  );

  return match?.[1]?.toUpperCase() || "Unspecified";
};

const getParameterLabel = (fileName = "") => {
  const match = String(fileName).match(
    /(?:^|[-_.\s])([0-9]+(?:\.[0-9]+)?)([kKmMbB])(?:[-_.\s]|$)/
  );

  return match?.[1] ? `${match[1]}${match[2].toUpperCase()}` : "Unknown";
};

const getModelParameterLabels = (model) => {
  const names = [model?.name, model?.id, ...(model?.ggufFiles || [])];

  return [
    ...new Set(
      names
        .map(getParameterLabel)
        .filter((label) => label !== "Unknown")
    ),
  ];
};

const getInstalledModel = (model, availableModels) => {
  const installed = Array.isArray(availableModels)
    ? availableModels
    : [];
  const modelId = String(model?.id || "").toLowerCase();
  const fileNames = (model?.ggufFiles || []).map((fileName) =>
    String(fileName).split("/").pop().toLowerCase()
  );

  return installed.find((localModel) => {
    const localId = String(localModel?.id || "").toLowerCase();
    const localFileName = String(
      localModel?.fileName || localModel?.name || ""
    )
      .split("/")
      .pop()
      .toLowerCase();

    return (
      (modelId && (localId === modelId || localId.includes(modelId))) ||
      (localFileName && fileNames.includes(localFileName))
    );
  });
};

const getMatchingModelFile = (model, quantization, parameter) => {
  const files = model?.ggufFiles || [];
  const modelHasParameter =
    parameter === "all" || getModelParameterLabels(model).includes(parameter);

  return (
    files.find(
      (fileName) =>
        (quantization === "all" ||
          getQuantizationLabel(fileName) === quantization) &&
        (parameter === "all" ||
          (modelHasParameter &&
            (getParameterLabel(fileName) === parameter ||
              getParameterLabel(fileName) === "Unknown")))
    ) ||
    files.find(
      (fileName) =>
        quantization === "all" ||
        getQuantizationLabel(fileName) === quantization
    ) ||
    files[0] ||
    model?.recommendedFile ||
    null
  );
};

const getMemoryRequirement = (sizeBytes) => {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "Size unavailable";
  }

  return `~${formatFileSize(sizeBytes * 1.15)} RAM recommended`;
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

const getGoalConfig = (goalId) =>
  RECOMMENDATION_GOALS.find((goal) => goal.id === goalId) ||
  RECOMMENDATION_GOALS[0];

const scoreRecommendation = (item, goalId) => {
  const name = String(item?.name || item?.id || "").toLowerCase();

  const tagText = [
    item?.pipelineTag,
    ...(Array.isArray(item?.tags) ? item.tags : []),
    item?.summary || "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const goalConfig = getGoalConfig(goalId);
  const goalKeywords = goalConfig.keywords;

  let score = 30;

  if (item?.downloads) {
    score += Math.min(
      20,
      Math.log10(item.downloads + 1) * 8
    );
  }

  if (item?.likes) {
    score += Math.min(
      15,
      Math.log10(item.likes + 1) * 9
    );
  }

  const modelFiles = collectRecommendationFiles(item);

  if (modelFiles.length) {
    score += 10;
  }

  if (item?.summary) {
    score += 5;
  }

  const keywordMatches = goalKeywords.filter((keyword) =>
    name.includes(keyword) || tagText.includes(keyword)
  ).length;

  score += keywordMatches * 12;

  if (/(qwen|deepseek|llama|mistral|gemma|phi)/i.test(name)) {
    score += 12;
  }

  if (/(7b|8b|14b|32b|70b)/i.test(name)) {
    score += 5;
  }

  if (/(q4|q5|q6|q8)/i.test(name)) {
    score += 4;
  }

  if (/(instruct|chat)/i.test(name)) {
    score += 3;
  }

  return Math.min(100, Math.max(45, Math.round(score)));
};

const collectRecommendationFiles = (item) => {
  const files = [];

  for (const source of [
    item?.ggufFiles,
    item?.siblings,
    item?.files,
  ]) {
    if (!Array.isArray(source)) {
      continue;
    }

    for (const entry of source) {
      const fileName = String(
        entry?.rfilename ||
          entry?.filename ||
          entry?.name ||
          entry ||
          ""
      ).trim();

      if (fileName && /\.(gguf|bin|ggml)$/i.test(fileName)) {
        files.push(fileName);
      }
    }
  }

  return [...new Set(files)];
};

const normalizeRecommendationResults = (items, goalId) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items]
    .filter((item) => {
      if (!item || !item.id) {
        return false;
      }

      const files = collectRecommendationFiles(item);

      const repoLooksLikeModel =
        /(gguf|bin|ggml)/i.test(
          String(item?.id || item?.name || "")
        ) ||
        (Array.isArray(item?.tags) &&
          item.tags.some((tag) =>
            /(gguf|bin|ggml)/i.test(String(tag))
          ));

      return files.length > 0 || repoLooksLikeModel;
    })
    .map((item) => {
      const files = collectRecommendationFiles(item);

      const fileName =
        item?.recommendedFile && files.includes(item.recommendedFile)
          ? item.recommendedFile
          : files[0] || item?.recommendedFile || null;

      const fileMetadata = Array.isArray(item?.fileMetadata)
        ? item.fileMetadata
            .filter((file) => files.includes(file?.name))
            .concat(
              files
                .filter(
                  (name) =>
                    !item.fileMetadata.some((file) => file?.name === name)
                )
                .map((name) => ({ name, sizeBytes: null }))
            )
        : files.map((name) => ({ name, sizeBytes: null }));

      return {
        ...item,
        ggufFiles: files,
        fileMetadata,
        score: scoreRecommendation(item, goalId),
        recommendedFile: fileName,
        fileLabel: fileName
          ? fileName.split("/").pop()
          : "GGUF model",
      };
    })
    .sort(
      (a, b) =>
        (b.score || 0) -
        (a.score || 0)
    );
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
        "relative overflow-hidden rounded-2xl border p-4",
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
          "absolute inset-y-0 left-0 w-[2px]",
          isError
            ? "bg-red-400/70"
            : "bg-emerald-400/70",
        ].join(" ")}
      />

      <div className="flex items-start gap-3">
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
        border-white/[0.07]
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
        hover:border-white/[0.12]
        hover:bg-white/[0.045]
        hover:text-gray-300
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
  onOpenSettings,
  logoSrc = DEFAULT_LOGO_SRC,
}) => {
  const {
    availableModels,
    refreshModels,
    setActiveModel,
  } = useModel();

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

  const [activeTab, setActiveTab] =
    useState("local");

  const [recommendationGoal, setRecommendationGoal] =
    useState("general");

  const [recommendationQuery, setRecommendationQuery] =
    useState("");

  const [quantizationFilter, setQuantizationFilter] =
    useState("all");

  const [parameterFilter, setParameterFilter] =
    useState("all");

  const [recommendations, setRecommendations] =
    useState([]);

  const [recommendationsLoading, setRecommendationsLoading] =
    useState(false);

  const recommendationRequestRef =
    useRef(0);

  const [recommendationError, setRecommendationError] =
    useState("");

  const [selectedRecommendation, setSelectedRecommendation] =
    useState(null);

  const [fitRecommendation, setFitRecommendation] =
    useState(null);

  const [resolvingFileMetadata, setResolvingFileMetadata] =
    useState(false);

  const fileMetadataRequestRef = useRef(0);

  const [downloadingRecommendation, setDownloadingRecommendation] =
    useState(false);

  const [downloadProgress, setDownloadProgress] =
    useState(null);

  const [showAdvancedFiles, setShowAdvancedFiles] =
    useState(false);

  const [downloadPaused, setDownloadPaused] =
    useState(false);

  const [hardwareMetrics, setHardwareMetrics] =
    useState(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const selectRecommendationVariant = useCallback(
    async (model, fileName) => {
      if (!model || !fileName) {
        return;
      }

      const fileMetadata = Array.isArray(model.fileMetadata)
        ? model.fileMetadata.find((file) => file.name === fileName)
        : null;
      const nextSelection = {
        ...model,
        recommendedFile: fileName,
        fileLabel: fileName.split("/").pop(),
        fileMetadata: fileMetadata
          ? [fileMetadata]
          : model.fileMetadata,
      };

      setSelectedRecommendation(nextSelection);
      setFitRecommendation(nextSelection);

      if (
        fileMetadata?.sizeBytes ||
        typeof window === "undefined" ||
        typeof window.electronAPI?.getHuggingFaceFileMetadata !== "function"
      ) {
        return;
      }

      const requestId = ++fileMetadataRequestRef.current;
      setResolvingFileMetadata(true);

      try {
        const result =
          await window.electronAPI.getHuggingFaceFileMetadata({
            repoId: model.id,
            fileName,
          });

        if (
          requestId !== fileMetadataRequestRef.current ||
          !result?.success ||
          !result.sizeBytes
        ) {
          return;
        }

        const resolvedSelection = {
          ...nextSelection,
          fileMetadata: [{ name: fileName, sizeBytes: result.sizeBytes }],
        };

        setSelectedRecommendation(resolvedSelection);
        setFitRecommendation(resolvedSelection);
      } catch (error) {
        console.warn("Unable to resolve model file metadata:", error);
      } finally {
        if (requestId === fileMetadataRequestRef.current) {
          setResolvingFileMetadata(false);
        }
      }
    },
    []
  );

  const filteredRecommendations = recommendations.filter((model) => {
    const files = model.ggufFiles || [];
    const hasQuantization =
      quantizationFilter === "all" ||
      files.some(
        (fileName) =>
          getQuantizationLabel(fileName) === quantizationFilter
      );
    const hasParameters =
      parameterFilter === "all" ||
      getModelParameterLabels(model).includes(parameterFilter);

    return hasQuantization && hasParameters;
  });

  const availableQuantizations = [
    ...new Set(
      recommendations.flatMap((model) =>
        (model.ggufFiles || []).map(getQuantizationLabel)
      )
    ),
  ].filter((label) => label !== "Unspecified");

  const availableParameters = [
    ...new Set(
      recommendations.flatMap((model) =>
        getModelParameterLabels(model)
      )
    ),
  ].filter((label) => label !== "Unknown");

  useEffect(() => {
    if (!filteredRecommendations.length) {
      setSelectedRecommendation(null);
      setFitRecommendation(null);
      return;
    }

    const current = selectedRecommendation;
    const currentVisible = current
      ? filteredRecommendations.find(
          (model) =>
            model.id === current.id &&
            model.source === current.source
        )
      : null;

    if (currentVisible) {
      if (
        current.recommendedFile &&
        currentVisible.ggufFiles?.includes(current.recommendedFile)
      ) {
        if (
          fitRecommendation &&
          (fitRecommendation?.id !== current.id ||
            fitRecommendation?.source !== current.source ||
            fitRecommendation?.recommendedFile !== current.recommendedFile)
        ) {
          setFitRecommendation(current);
        }
        return;
      }

      const matchingFile = getMatchingModelFile(
        currentVisible,
        quantizationFilter,
        parameterFilter
      );

      if (matchingFile && matchingFile !== current.recommendedFile) {
        const nextSelection = {
          ...currentVisible,
          recommendedFile: matchingFile,
          fileLabel: matchingFile.split("/").pop(),
        };

        setSelectedRecommendation(nextSelection);
        if (fitRecommendation) {
          setFitRecommendation(nextSelection);
        }
      }
      return;
    }

    const nextModel = filteredRecommendations[0];
    const matchingFile = getMatchingModelFile(
      nextModel,
      quantizationFilter,
      parameterFilter
    );
    const nextSelection = {
      ...nextModel,
      recommendedFile: matchingFile,
      fileLabel: matchingFile?.split("/").pop() || "GGUF model",
    };

    setSelectedRecommendation(nextSelection);
    if (fitRecommendation) {
      setFitRecommendation(nextSelection);
    }
  }, [
    filteredRecommendations,
    quantizationFilter,
    parameterFilter,
    selectedRecommendation,
    fitRecommendation,
    availableModels,
  ]);

  useEffect(() => {
    if (
      quantizationFilter !== "all" &&
      !availableQuantizations.includes(quantizationFilter)
    ) {
      setQuantizationFilter("all");
    }

    if (
      parameterFilter !== "all" &&
      !availableParameters.includes(parameterFilter)
    ) {
      setParameterFilter("all");
    }
  }, [
    availableQuantizations,
    availableParameters,
    quantizationFilter,
    parameterFilter,
  ]);

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

  useEffect(() => {
    if (
      typeof window?.electronAPI?.onModelDownloadProgress !==
      "function"
    ) {
      return undefined;
    }

    return window.electronAPI.onModelDownloadProgress(
      (progress) => {
        setDownloadProgress(progress);
      }
    );
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
     Recommendations
     ========================================================================== */

  const populateRecommendations = useCallback(
    async (
      customGoal = "general",
      customQuery = ""
    ) => {
      const requestId =
        ++recommendationRequestRef.current;

      setRecommendationError("");
      setRecommendationsLoading(true);

      try {
        const apiQuery =
          customQuery?.trim() ||
          getGoalConfig(customGoal).keywords[0];

        let result =
          await modelsAPI.searchModelCatalog({
            query: apiQuery,
            goal: customGoal,
            limit: 14,
          });

        if (
          !result?.success &&
          typeof modelsAPI.searchHuggingFaceModels ===
            "function"
        ) {
          const fallback =
            await modelsAPI.searchHuggingFaceModels({
              query: apiQuery,
              goal: customGoal,
              limit: 12,
            });

          if (fallback?.success) {
            result = fallback;
          }
        }

        if (!result?.success) {
          throw new Error(
            result?.error ||
              "Unable to load model recommendations."
          );
        }

        const normalized =
          normalizeRecommendationResults(
            result.data || [],
            customGoal
          );

        if (
          requestId !==
          recommendationRequestRef.current
        ) {
          return;
        }

        setRecommendations(
          normalized
        );

        setSelectedRecommendation(
          normalized[0] || null
        );
      } catch (
        searchError
      ) {
        if (
          requestId !==
          recommendationRequestRef.current
        ) {
          return;
        }

        console.error(
          "Recommendation search failed:",
          searchError
        );

        setRecommendationError(
          searchError?.message ||
            "Unable to browse recommended models right now."
        );

        setRecommendations([]);
        setSelectedRecommendation(null);
      } finally {
        if (
          requestId ===
          recommendationRequestRef.current
        ) {
          setRecommendationsLoading(false);
        }
      }
    },
    []
  );

  const handleBrowseModelDownload =
    useCallback(
      async (recommendation) => {
        if (
          !recommendation ||
          downloadingRecommendation
        ) {
          return;
        }

        setDownloadingRecommendation(
          true
        );

        setDownloadProgress({
          receivedBytes: 0,
          totalBytes: null,
          percent: null,
          bytesPerSecond: 0,
          repoId: recommendation.id,
          fileName:
            recommendation.fileLabel,
        });

        setError("");
        setSuccess("");

        try {
          const payload = {
            repoId: recommendation.id,
            fileName:
              recommendation.recommendedFile,
          };

          const result =
            await window.electronAPI.downloadHuggingFaceModel(
              payload
            );

          if (
            !result ||
            result.success !== true
          ) {
            throw new Error(
              result?.error ||
                "Model download failed."
            );
          }

          if (result.paused) {
            setDownloadPaused(true);
            return;
          }

          if (result.cancelled) {
            setDownloadPaused(false);
            setDownloadProgress(null);
            return;
          }

          if (
            typeof refreshModels ===
            "function"
          ) {
            await refreshModels();
          }

          const newModel =
            result?.model || null;

          if (
            newModel &&
            typeof window !==
              "undefined" &&
            window.confirm
          ) {
            const shouldSwitch =
              window.confirm(
                `Switch to "${
                  newModel.name ||
                  newModel.id ||
                  recommendation.name
                }" now?`
              );

            if (
              shouldSwitch &&
              typeof onOpenSettings ===
                "function"
            ) {
              onOpenSettings(
                "models"
              );
            }
          }

          setSuccess(
            result.message ||
              `Downloaded ${
                recommendation.fileLabel ||
                recommendation.name
              }.`
          );

          if (
            typeof onUploadSuccess ===
            "function"
          ) {
            await onUploadSuccess(
              result
            );
          }

          if (result.model) {
            setDownloadProgress(null);
            setSelectedRecommendation(
              null
            );
            setActiveTab("local");
          }
        } catch (
          downloadError
        ) {
          console.error(
            "Hugging Face model download failed:",
            downloadError
          );

          setError(
            downloadError?.message ||
              "Unable to download the recommended model."
          );
        } finally {
          setDownloadingRecommendation(
            false
          );
        }
      },
      [
        downloadingRecommendation,
        refreshModels,
        onUploadSuccess,
        setActiveModel,
        onOpenSettings,
      ]
    );

  const pauseModelDownload =
    useCallback(async () => {
      if (
        !downloadingRecommendation ||
        typeof window?.electronAPI
          ?.pauseModelDownload !==
          "function"
      ) {
        return;
      }

      await window.electronAPI.pauseModelDownload();
    }, [
      downloadingRecommendation,
    ]);

  const cancelModelDownload =
    useCallback(async () => {
      if (
        (!downloadingRecommendation &&
          !downloadPaused) ||
        typeof window?.electronAPI
          ?.cancelModelDownload !==
          "function"
      ) {
        return;
      }

      await window.electronAPI.cancelModelDownload();

      setDownloadPaused(false);
      setDownloadProgress(null);
    }, [
      downloadingRecommendation,
      downloadPaused,
    ]);

  const resumeModelDownload =
    useCallback(() => {
      if (
        !downloadPaused ||
        !downloadProgress?.repoId
      ) {
        return;
      }

      const model =
        recommendations.find(
          (item) =>
            item.id ===
            downloadProgress.repoId
        );

      if (model) {
        void handleBrowseModelDownload({
          ...model,
          recommendedFile:
            downloadProgress.fileName,
        });
      }
    }, [
      downloadPaused,
      downloadProgress,
      recommendations,
      handleBrowseModelDownload,
    ]);

  useEffect(() => {
    if (
      !isOpen ||
      activeTab !== "browse"
    ) {
      return;
    }

    void populateRecommendations();

    if (
      typeof window?.electronAPI
        ?.getMetrics ===
      "function"
    ) {
      void window.electronAPI
        .getMetrics()
        .then(setHardwareMetrics)
        .catch(() => {
          setHardwareMetrics(null);
        });
    }
  }, [
    isOpen,
    activeTab,
    populateRecommendations,
  ]);

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

        const newModel =
          result?.model || null;

        if (
          newModel &&
          typeof window !==
            "undefined" &&
          window.confirm
        ) {
          const shouldSwitch =
            window.confirm(
              `Switch to "${
                newModel.name ||
                newModel.id ||
                selectedFile.name
              }" now?`
            );

          if (
            shouldSwitch &&
            typeof onOpenSettings ===
              "function"
          ) {
            onOpenSettings(
              "models"
            );
          }
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
      setActiveModel,
      onOpenSettings,
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
          if (fitRecommendation) {
            setFitRecommendation(
              null
            );
          } else {
            handleClose();
          }
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
    fitRecommendation,
  ]);

  /* ==========================================================================
     Render
     ========================================================================== */

  if (!isOpen) {
    return null;
  }

  const fitModel = fitRecommendation || selectedRecommendation;
  const fitFile = getModelFile(fitModel);

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        p-2
        sm:p-4
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
          bg-black/85
          backdrop-blur-2xl
        "
      />

      {/* ====================================================================
          Modal
          ==================================================================== */}

      <div
        className="
          relative
          flex
          h-[min(94vh,940px)]
          w-full
          max-w-[calc(100vw-1rem)]
          flex-col
          overflow-hidden
          rounded-[28px]
          border
          border-white/[0.085]
          bg-[#090d12]/[0.98]
          shadow-[0_35px_120px_rgba(0,0,0,0.78)]
          ring-1
          ring-white/[0.035]
          animate-[modalIn_180ms_ease-out]
          sm:max-w-[980px]
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
            inset-x-10
            top-0
            z-10
            h-px
            bg-gradient-to-r
            from-transparent
            via-blue-400/80
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
            -right-44
            -top-44
            h-[360px]
            w-[360px]
            rounded-full
            bg-blue-500/[0.065]
            blur-[110px]
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            -left-44
            top-[45%]
            h-[340px]
            w-[340px]
            rounded-full
            bg-indigo-500/[0.035]
            blur-[110px]
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
            bg-white/[0.012]
            px-4
            py-4
            sm:px-6
            sm:py-5
          "
        >
          <div className="flex min-w-0 items-center gap-3.5">
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
                    tracking-[-0.015em]
                    text-white
                    sm:text-[16px]
                  "
                >
                  {activeTab === "browse"
                    ? "Model library"
                    : "Add local model"}
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
                  mt-1.5
                  max-w-[520px]
                  truncate
                  text-[10px]
                  leading-none
                  text-gray-500
                  sm:text-[11px]
                "
              >
                {activeTab === "browse"
                  ? "Browse open model hubs and install a model matched to your hardware"
                  : "Import a local GGUF, BIN, or GGML model into OFFYAI"}
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
              hover:border-white/[0.07]
              hover:bg-white/[0.05]
              hover:text-gray-100
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
            custom-scrollbar
            overscroll-contain
            p-3
            sm:p-4
          "
        >
          <div className="mx-auto w-full max-w-[920px] space-y-4">
            {/* ================================================================
                Tabs
                ================================================================ */}

            <div
              className="
                relative
                grid
                grid-cols-2
                gap-1
                rounded-2xl
                border
                border-white/[0.065]
                bg-[#0e141b]/90
                p-1.5
                shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_35px_rgba(0,0,0,0.12)]
              "
            >
              {[
                {
                  id: "local",
                  label: "Import local",
                  icon: Upload,
                },
                {
                  id: "browse",
                  label: "Browse open models",
                  icon: Sparkles,
                },
              ].map((tab) => {
                const TabIcon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                    className={[
                      "group flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-semibold transition-all duration-200 sm:text-[11px]",
                      activeTab ===
                      tab.id
                        ? "bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-[0_8px_28px_rgba(59,130,246,0.22)]"
                        : "text-gray-500 hover:bg-white/[0.035] hover:text-gray-200",
                    ].join(" ")}
                  >
                    <TabIcon
                      className={[
                        "h-3.5 w-3.5 transition-colors",
                        activeTab ===
                        tab.id
                          ? "text-blue-100"
                          : "text-gray-600 group-hover:text-gray-300",
                      ].join(" ")}
                    />

                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ================================================================
                Status messages
                ================================================================ */}

            {error && (
              <StatusMessage
                type="error"
                title="Unable to continue"
                message={error}
              />
            )}

            {success && (
              <StatusMessage
                type="success"
                title="Model imported"
                message={success}
              />
            )}

            {/* ================================================================
                Download progress
                ================================================================ */}

            {(downloadingRecommendation ||
              downloadPaused) &&
              downloadProgress && (
                <section
                  className="
                    relative
                    overflow-hidden
                    rounded-[20px]
                    border
                    border-blue-400/15
                    bg-gradient-to-br
                    from-blue-500/[0.075]
                    via-blue-500/[0.035]
                    to-indigo-500/[0.025]
                    p-4
                    shadow-[0_16px_50px_rgba(37,99,235,0.08)]
                  "
                  role="status"
                  aria-live="polite"
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
                      bg-blue-500/[0.08]
                      blur-3xl
                    "
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
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
                            border
                            border-blue-400/15
                            bg-blue-500/[0.10]
                          "
                        >
                          {downloadPaused ? (
                            <DownloadPauseIcon />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-blue-50">
                            {downloadPaused
                              ? "Download paused"
                              : downloadProgress.percent ===
                                100
                              ? "Finalizing installation..."
                              : "Downloading model..."}
                          </p>

                          <p
                            className="
                              mt-1
                              truncate
                              text-[10px]
                              text-blue-200/50
                            "
                            title={
                              downloadProgress.fileName
                            }
                          >
                            {downloadProgress.fileName ||
                              "Preparing model file"}
                          </p>
                        </div>
                      </div>

                      <span
                        className="
                          shrink-0
                          rounded-full
                          border
                          border-blue-300/10
                          bg-blue-400/[0.06]
                          px-2.5
                          py-1
                          text-[10px]
                          font-semibold
                          tabular-nums
                          text-blue-100
                        "
                      >
                        {Number.isFinite(
                          downloadProgress.percent
                        )
                          ? `${downloadProgress.percent}%`
                          : "Starting"}
                      </span>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-950/70 ring-1 ring-white/[0.025]">
                      <div
                        className="
                          h-full
                          rounded-full
                          bg-gradient-to-r
                          from-blue-600
                          via-blue-400
                          to-indigo-400
                          shadow-[0_0_18px_rgba(59,130,246,0.45)]
                          transition-[width]
                          duration-300
                        "
                        style={{
                          width: `${
                            Number.isFinite(
                              downloadProgress.percent
                            )
                              ? downloadProgress.percent
                              : 3
                          }%`,
                        }}
                      />
                    </div>

                    <div
                      className="
                        mt-2.5
                        flex
                        flex-wrap
                        justify-between
                        gap-x-3
                        gap-y-1
                        text-[9px]
                        text-blue-200/50
                      "
                    >
                      <span>
                        {formatFileSize(
                          downloadProgress.receivedBytes ||
                            0
                        )}
                        {Number.isFinite(
                          downloadProgress.totalBytes
                        )
                          ? ` of ${formatFileSize(
                              downloadProgress.totalBytes
                            )}`
                          : " received"}
                      </span>

                      <span>
                        {formatTransferRate(
                          downloadProgress.bytesPerSecond
                        )}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {downloadPaused ? (
                        <button
                          type="button"
                          onClick={
                            resumeModelDownload
                          }
                          className="
                            rounded-lg
                            bg-blue-500
                            px-3
                            py-2
                            text-[10px]
                            font-semibold
                            text-white
                            shadow-[0_6px_18px_rgba(59,130,246,0.2)]
                            transition
                            hover:bg-blue-400
                          "
                        >
                          Resume download
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={
                            pauseModelDownload
                          }
                          disabled={
                            !downloadingRecommendation
                          }
                          className="
                            rounded-lg
                            border
                            border-blue-300/15
                            bg-white/[0.045]
                            px-3
                            py-2
                            text-[10px]
                            font-semibold
                            text-blue-100
                            transition
                            hover:bg-white/[0.08]
                            disabled:opacity-50
                          "
                        >
                          Pause
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={
                          cancelModelDownload
                        }
                        className="
                          rounded-lg
                          border
                          border-red-300/15
                          bg-red-500/[0.07]
                          px-3
                          py-2
                          text-[10px]
                          font-semibold
                          text-red-200
                          transition
                          hover:bg-red-500/[0.14]
                        "
                      >
                        Cancel and remove
                      </button>
                    </div>
                  </div>
                </section>
              )}

            {/* =================================================================
                Browse models
                ================================================================= */}

            {activeTab === "browse" && (
              <div className="min-h-0 w-full">
                <div className="space-y-4">
                  {/* Search panel */}

                  <section
                    className="
                      relative
                      overflow-hidden
                      rounded-[22px]
                      border
                      border-white/[0.075]
                      bg-[#0e151d]/95
                      p-3.5
                      shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_50px_rgba(0,0,0,0.12)]
                      sm:p-4
                    "
                  >
                    <div
                      className="
                        pointer-events-none
                        absolute
                        -right-24
                        -top-24
                        h-48
                        w-48
                        rounded-full
                        bg-blue-500/[0.045]
                        blur-3xl
                      "
                    />

                    <div className="relative">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-gray-200">
                            Find your next model
                          </p>

                          <p className="mt-1 text-[9px] text-gray-600">
                            Recommendations are ranked for your selected use case.
                          </p>
                        </div>

                        <div
                          className="
                            hidden
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-blue-400/10
                            bg-blue-500/[0.06]
                            sm:flex
                          "
                        >
                          <Search className="h-3.5 w-3.5 text-blue-300" />
                        </div>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {RECOMMENDATION_GOALS.map(
                          (goal) => (
                            <button
                              key={goal.id}
                              type="button"
                              onClick={() => {
                                setRecommendationGoal(
                                  goal.id
                                );

                                setRecommendationQuery(
                                  ""
                                );

                                void populateRecommendations(
                                  goal.id,
                                  ""
                                );
                              }}
                              className={[
                                "rounded-full border px-2.5 py-1.5 text-[9px] font-medium tracking-wide transition-all",
                                recommendationGoal ===
                                goal.id
                                  ? "border-blue-400/25 bg-blue-500/[0.11] text-blue-200 shadow-[0_4px_14px_rgba(59,130,246,0.08)]"
                                  : "border-white/[0.07] bg-white/[0.015] text-gray-500 hover:border-white/[0.11] hover:bg-white/[0.035] hover:text-gray-200",
                              ].join(" ")}
                            >
                              {goal.label}
                            </button>
                          )
                        )}
                      </div>

                      <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <Search
                            className="
                              pointer-events-none
                              absolute
                              left-3
                              top-1/2
                              h-3.5
                              w-3.5
                              -translate-y-1/2
                              text-gray-600
                            "
                          />

                          <input
                            type="text"
                            value={
                              recommendationQuery
                            }
                            onChange={(
                              event
                            ) =>
                              setRecommendationQuery(
                                event.target.value
                              )
                            }
                            onKeyDown={(
                              event
                            ) => {
                              if (
                                event.key ===
                                "Enter"
                              ) {
                                void populateRecommendations(
                                  recommendationGoal,
                                  recommendationQuery
                                );
                              }
                            }}
                            placeholder="Search models, families, or quantization"
                            className="
                              h-10
                              w-full
                              rounded-xl
                              border
                              border-white/[0.075]
                              bg-[#090e14]
                              pl-9
                              pr-3
                              text-[10px]
                              text-white
                              placeholder:text-gray-600
                              outline-none
                              transition
                              focus:border-blue-500/40
                              focus:bg-[#0b1118]
                              focus:ring-2
                              focus:ring-blue-500/[0.07]
                            "
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void populateRecommendations(
                              recommendationGoal,
                              recommendationQuery
                            )
                          }
                          disabled={
                            recommendationsLoading
                          }
                          className="
                            flex
                            h-10
                            shrink-0
                            items-center
                            gap-1.5
                            rounded-xl
                            border
                            border-blue-400/15
                            bg-blue-600
                            px-3.5
                            text-[10px]
                            font-semibold
                            text-white
                            shadow-[0_8px_22px_rgba(37,99,235,0.18)]
                            transition-all
                            hover:bg-blue-500
                            hover:shadow-[0_10px_28px_rgba(37,99,235,0.24)]
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          "
                        >
                          {recommendationsLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Search className="h-3.5 w-3.5" />
                          )}

                          <span className="hidden sm:inline">
                            {recommendationsLoading
                              ? "Searching..."
                              : "Find model"}
                          </span>
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="min-w-0">
                          <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                            Quantization
                          </span>
                          <select
                            value={quantizationFilter}
                            onChange={(event) =>
                              setQuantizationFilter(event.target.value)
                            }
                            className="h-9 w-full rounded-xl border border-white/[0.075] bg-[#090e14] px-2.5 text-[10px] text-gray-300 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/[0.07]"
                          >
                            <option value="all">All available</option>
                            {availableQuantizations.map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                            Parameters
                          </span>
                          <select
                            value={parameterFilter}
                            onChange={(event) =>
                              setParameterFilter(event.target.value)
                            }
                            className="h-9 w-full rounded-xl border border-white/[0.075] bg-[#090e14] px-2.5 text-[10px] text-gray-300 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/[0.07]"
                          >
                            <option value="all">All sizes</option>
                            {availableParameters.map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <p className="mt-2 text-[9px] text-gray-600">
                        Showing {filteredRecommendations.length} of {recommendations.length} model repositories. Default selection favors the highest-quality available file.
                      </p>
                    </div>
                  </section>

                  {recommendationError && (
                    <StatusMessage
                      type="error"
                      title="Recommendation search failed"
                      message={
                        recommendationError
                      }
                    />
                  )}

                  {recommendationsLoading ? (
                    <div
                      className="
                        rounded-[22px]
                        border
                        border-white/[0.065]
                        bg-[#0e141b]/90
                        p-8
                        text-center
                      "
                    >
                      <div
                        className="
                          mx-auto
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-2xl
                          border
                          border-blue-400/10
                          bg-blue-500/[0.06]
                        "
                      >
                        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                      </div>

                      <p className="mt-4 text-[12px] font-medium text-gray-300">
                        Finding compatible models
                      </p>

                      <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-gray-600">
                        Loading model recommendations from open model sources...
                      </p>
                    </div>
                  ) : filteredRecommendations.length ===
                    0 ? (
                    <div
                      className="
                        rounded-[22px]
                        border
                        border-dashed
                        border-white/[0.075]
                        bg-[#0c1218]/80
                        p-8
                        text-center
                      "
                    >
                      <div
                        className="
                          mx-auto
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-2xl
                          border
                          border-white/[0.06]
                          bg-white/[0.02]
                        "
                      >
                        <Search className="h-5 w-5 text-gray-600" />
                      </div>

                      <p className="mt-4 text-[12px] font-medium text-gray-300">
                        No matching models
                      </p>

                      <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-gray-600">
                        Try a broader search or select another use case.
                      </p>
                    </div>
                  ) : (
                    <div className="custom-scrollbar max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                      {filteredRecommendations.map(
                        (model, index) => (
                          <div
                            key={`${model.source || "source"}-${model.id}-${model.recommendedFile}`}
                            className={[
                              "group relative overflow-hidden rounded-[20px] border p-3.5 transition-all duration-200 sm:p-4",
                              selectedRecommendation?.id ===
                              model.id
                                ? "border-blue-400/25 bg-gradient-to-br from-blue-500/[0.055] to-indigo-500/[0.02] shadow-[0_14px_45px_rgba(37,99,235,0.07)]"
                                : "border-white/[0.065] bg-[#0d141b]/90 hover:border-white/[0.105] hover:bg-[#101821]",
                            ].join(" ")}
                          >
                            <div
                              className="
                                pointer-events-none
                                absolute
                                -right-20
                                -top-20
                                h-40
                                w-40
                                rounded-full
                                bg-blue-500/[0.025]
                                blur-3xl
                                transition
                                group-hover:bg-blue-500/[0.045]
                              "
                            />

                            <div className="relative">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <div
                                    className="
                                      flex
                                      h-9
                                      w-9
                                      shrink-0
                                      items-center
                                      justify-center
                                      rounded-xl
                                      border
                                      border-blue-400/10
                                      bg-blue-500/[0.07]
                                      shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
                                    "
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      {index ===
                                        0 && (
                                        <span
                                          className="
                                            rounded-full
                                            border
                                            border-emerald-400/10
                                            bg-emerald-500/[0.055]
                                            px-1.5
                                            py-0.5
                                            text-[7px]
                                            font-semibold
                                            uppercase
                                            tracking-[0.12em]
                                            text-emerald-300/80
                                          "
                                        >
                                          Best match
                                        </span>
                                      )}

                                      <p className="min-w-0 truncate text-[12px] font-semibold text-gray-100">
                                        {model.name}
                                      </p>
                                    </div>

                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] text-gray-500">
                                      <span
                                        className="
                                          rounded-full
                                          border
                                          border-white/[0.05]
                                          bg-white/[0.025]
                                          px-1.5
                                          py-0.5
                                          uppercase
                                          tracking-[0.12em]
                                          text-gray-400
                                        "
                                      >
                                        {String(
                                          model.source ||
                                            "hub"
                                        )}
                                      </span>

                                      <span className="truncate">
                                        {model.id}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5">
                                  {getInstalledModel(
                                    model,
                                    availableModels
                                  ) && (
                                    <span
                                      className="
                                        rounded-full
                                        border
                                        border-emerald-400/15
                                        bg-emerald-500/[0.055]
                                        px-2
                                        py-1
                                        text-[8px]
                                        font-semibold
                                        uppercase
                                        tracking-[0.08em]
                                        text-emerald-300
                                      "
                                    >
                                      Installed
                                    </span>
                                  )}

                                  <div
                                    className="
                                      rounded-full
                                      border
                                      border-blue-400/15
                                      bg-blue-500/[0.055]
                                      px-2
                                      py-1
                                      text-[9px]
                                      font-semibold
                                      text-blue-200
                                    "
                                  >
                                    {model.score}%
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.055]">
                                <div
                                  className="
                                    h-full
                                    rounded-full
                                    bg-gradient-to-r
                                    from-emerald-500
                                    via-blue-500
                                    to-indigo-500
                                  "
                                  style={{
                                    width: `${model.score}%`,
                                  }}
                                />
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                                <div
                                  className="
                                    rounded-lg
                                    border
                                    border-white/[0.05]
                                    bg-white/[0.018]
                                    px-2
                                    py-1.5
                                  "
                                >
                                  <p className="truncate text-[8px] text-gray-600">
                                    FILE
                                  </p>
                                  <p
                                    className="mt-0.5 truncate text-[9px] font-medium text-gray-400"
                                    title={
                                      model.fileLabel ||
                                      model.recommendedFile
                                    }
                                  >
                                    {model.fileLabel ||
                                      model.recommendedFile ||
                                      "GGUF file"}
                                  </p>
                                </div>

                                <div
                                  className="
                                    rounded-lg
                                    border
                                    border-white/[0.05]
                                    bg-white/[0.018]
                                    px-2
                                    py-1.5
                                  "
                                >
                                  <p className="text-[8px] text-gray-600">
                                    SIZE
                                  </p>
                                  <p className="mt-0.5 text-[9px] font-medium text-gray-400">
                                    {getModelFile(
                                      model
                                    )?.sizeBytes
                                      ? formatFileSize(
                                          getModelFile(
                                            model
                                          ).sizeBytes
                                        )
                                      : "Pending"}
                                  </p>
                                </div>

                                <div
                                  className="
                                    rounded-lg
                                    border
                                    border-emerald-400/10
                                    bg-emerald-500/[0.025]
                                    px-2
                                    py-1.5
                                  "
                                >
                                  <p className="text-[8px] text-emerald-400/50">
                                    QUANT
                                  </p>
                                  <p className="mt-0.5 text-[9px] font-medium text-emerald-300">
                                    {getQuantizationLabel(
                                      model.recommendedFile
                                    )}
                                  </p>
                                </div>

                                <div
                                  className="
                                    rounded-lg
                                    border
                                    border-white/[0.05]
                                    bg-white/[0.018]
                                    px-2
                                    py-1.5
                                  "
                                >
                                  <p className="text-[8px] text-gray-600">
                                    DOWNLOADS
                                  </p>
                                  <p className="mt-0.5 text-[9px] font-medium text-gray-400">
                                    {model.downloads?.toLocaleString?.() ||
                                      0}
                                  </p>
                                </div>

                                <div
                                  className="
                                    rounded-lg
                                    border
                                    border-white/[0.05]
                                    bg-white/[0.018]
                                    px-2
                                    py-1.5
                                  "
                                >
                                  <p className="text-[8px] text-gray-600">
                                    LIKES
                                  </p>
                                  <p className="mt-0.5 text-[9px] font-medium text-gray-400">
                                    {model.likes?.toLocaleString?.() ||
                                      0}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void selectRecommendationVariant(
                                      model,
                                      model.recommendedFile
                                    );

                                    setShowAdvancedFiles(
                                      false
                                    );
                                  }}
                                  className="
                                    rounded-lg
                                    border
                                    border-white/[0.075]
                                    bg-white/[0.02]
                                    px-3
                                    py-2
                                    text-[10px]
                                    font-medium
                                    text-gray-400
                                    transition
                                    hover:border-white/[0.11]
                                    hover:bg-white/[0.045]
                                    hover:text-gray-200
                                  "
                                >
                                  View details
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleBrowseModelDownload(
                                      model
                                    )
                                  }
                                  disabled={
                                    downloadingRecommendation
                                  }
                                  className="
                                    inline-flex
                                    items-center
                                    gap-1.5
                                    rounded-lg
                                    border
                                    border-blue-400/15
                                    bg-blue-600
                                    px-3.5
                                    py-2
                                    text-[10px]
                                    font-semibold
                                    text-white
                                    shadow-[0_7px_20px_rgba(37,99,235,0.16)]
                                    transition
                                    hover:bg-blue-500
                                    hover:shadow-[0_9px_24px_rgba(37,99,235,0.22)]
                                    disabled:cursor-not-allowed
                                    disabled:opacity-50
                                  "
                                >
                                  {downloadingRecommendation &&
                                  selectedRecommendation?.id ===
                                    model.id ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Downloading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-3 w-3" />
                                      Download
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* =============================================================
                    Model fit modal
                    ============================================================= */}

                {fitRecommendation && (
                  <div
                    className="
                      fixed
                      inset-0
                      z-[120]
                      flex
                      items-center
                      justify-center
                      bg-black/75
                      p-2
                      backdrop-blur-xl
                      sm:p-5
                    "
                    role="presentation"
                    onMouseDown={(event) => {
                      if (
                        event.target ===
                        event.currentTarget
                      ) {
                        setFitRecommendation(
                          null
                        );
                      }
                    }}
                  >
                    <aside
                      className="
                        relative
                        max-h-[calc(100vh-1rem)]
                        w-full
                        max-w-[960px]
                        overflow-y-auto
                        rounded-[24px]
                        border
                        border-white/[0.10]
                        bg-[#0d1219]
                        shadow-[0_35px_120px_rgba(0,0,0,0.78)]
                        custom-scrollbar
                        sm:max-h-[calc(100vh-2.5rem)]
                      "
                    >
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

                      <div
                        className="
                          pointer-events-none
                          absolute
                          -right-32
                          -top-32
                          h-64
                          w-64
                          rounded-full
                          bg-blue-500/[0.045]
                          blur-[90px]
                        "
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setFitRecommendation(
                            null
                          )
                        }
                        className="
                          absolute
                          right-3
                          top-3
                          z-10
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center
                          rounded-lg
                          border
                          border-transparent
                          text-gray-600
                          transition
                          hover:border-white/[0.06]
                          hover:bg-white/[0.05]
                          hover:text-white
                        "
                        aria-label="Close model fit"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {fitModel ? (
                        <div className="relative p-4 sm:p-6">
                          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
                            {/* =================================================
                                Left
                                ================================================= */}

                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="
                                        inline-flex
                                        h-7
                                        w-7
                                        items-center
                                        justify-center
                                        rounded-lg
                                        border
                                        border-blue-400/10
                                        bg-blue-500/[0.07]
                                      "
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                                    </span>

                                    <p
                                      className="
                                        text-[9px]
                                        font-semibold
                                        uppercase
                                        tracking-[0.18em]
                                        text-blue-300/65
                                      "
                                    >
                                      Model fit
                                    </p>
                                  </div>

                                  <h3
                                    className="
                                      mt-3
                                      break-words
                                      text-[17px]
                                      font-semibold
                                      tracking-[-0.015em]
                                      text-white
                                    "
                                  >
                                    {
                                      fitModel.name
                                    }
                                  </h3>

                                  <p className="mt-1 break-all text-[10px] text-gray-600">
                                    {
                                      fitModel.id
                                    }
                                  </p>

                                  <p
                                    className="mt-2 truncate text-[10px] font-medium text-blue-200/80"
                                    title={fitModel.fileLabel || fitModel.recommendedFile}
                                  >
                                    {fitModel.fileLabel || fitModel.recommendedFile || "Model file unavailable"}
                                  </p>
                                </div>

                                <span
                                  className="
                                    shrink-0
                                    rounded-full
                                    border
                                    border-emerald-400/15
                                    bg-emerald-500/[0.06]
                                    px-2.5
                                    py-1.5
                                    text-[10px]
                                    font-semibold
                                    text-emerald-300
                                  "
                                >
                                  {
                                    fitModel.score
                                  }
                                  % match
                                </span>
                              </div>

                              <p className="mt-5 max-w-xl text-[11px] leading-[1.75] text-gray-500">
                                Recommended for{" "}
                                {getGoalConfig(
                                  recommendationGoal
                                ).label.toLowerCase()}{" "}
                                on this device. The selected quantization provides a practical balance between model quality, memory usage, and local performance.
                              </p>

                              {/* Stats */}

                              <div className="mt-5 grid grid-cols-2 gap-2">
                                <div
                                  className="
                                    rounded-2xl
                                    border
                                    border-white/[0.06]
                                    bg-white/[0.022]
                                    p-3.5
                                  "
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-500/[0.07]">
                                    <HardDrive className="h-4 w-4 text-blue-300" />
                                  </div>

                                  <p className="mt-3 text-[8px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                                    Download
                                  </p>

                                  <p className="mt-1 text-[12px] font-semibold text-gray-100">
                                    {resolvingFileMetadata
                                      ? "Checking..."
                                      : fitFile?.sizeBytes
                                      ? formatFileSize(
                                          fitFile.sizeBytes
                                        )
                                      : "Unavailable"}
                                  </p>
                                </div>

                                <div
                                  className="
                                    rounded-2xl
                                    border
                                    border-white/[0.06]
                                    bg-white/[0.022]
                                    p-3.5
                                  "
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-500/[0.07]">
                                    <MemoryStick className="h-4 w-4 text-emerald-300" />
                                  </div>

                                  <p className="mt-3 text-[8px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                                    Memory
                                  </p>

                                  <p className="mt-1 text-[12px] font-semibold text-gray-100">
                                    {resolvingFileMetadata
                                      ? "Calculating..."
                                      : getMemoryRequirement(
                                          fitFile?.sizeBytes
                                        )}
                                  </p>
                                </div>
                              </div>

                              {/* Performance */}

                              <div
                                className="
                                  mt-3
                                  rounded-2xl
                                  border
                                  border-white/[0.06]
                                  bg-white/[0.018]
                                  p-3.5
                                "
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/10 bg-amber-400/[0.05]">
                                    <Gauge className="h-4 w-4 text-amber-300" />
                                  </div>

                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-200">
                                      Performance
                                    </p>

                                    <p className="mt-0.5 text-[8px] text-gray-600">
                                      Device-specific benchmark
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 rounded-xl border border-white/[0.05] bg-black/[0.12] px-3 py-2.5">
                                  <p className="text-[10px] text-gray-500">
                                    No benchmark recorded for {fitModel.fileLabel || "this model"} on this device.
                                  </p>

                                  <p className="mt-1 text-[9px] text-gray-700">
                                    Install first, then run a real benchmark.
                                  </p>
                                </div>
                              </div>

                              {/* Device */}

                              <div
                                className="
                                  mt-3
                                  rounded-2xl
                                  border
                                  border-white/[0.06]
                                  bg-white/[0.018]
                                  p-3.5
                                "
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-500/[0.05]">
                                    <Cpu className="h-4 w-4 text-blue-300" />
                                  </div>

                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-200">
                                      Your device
                                    </p>

                                    <p className="mt-0.5 text-[8px] text-gray-600">
                                      Current hardware information
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <div className="rounded-xl border border-white/[0.05] bg-black/[0.12] p-2.5">
                                    <p className="text-[8px] uppercase tracking-wide text-gray-700">
                                      GPU
                                    </p>

                                    <p
                                      className="mt-1 truncate text-[10px] text-gray-300"
                                      title={
                                        hardwareMetrics?.gpuModel ||
                                        "GPU information unavailable"
                                      }
                                    >
                                      {hardwareMetrics?.gpuModel ||
                                        "GPU information unavailable"}
                                    </p>

                                    <p className="mt-1 text-[8px] text-gray-600">
                                      {hardwareMetrics?.gpuAvailable
                                        ? "GPU detected"
                                        : "GPU details unavailable"}
                                    </p>
                                  </div>

                                  <div className="rounded-xl border border-white/[0.05] bg-black/[0.12] p-2.5">
                                    <p className="text-[8px] uppercase tracking-wide text-gray-700">
                                      Memory
                                    </p>

                                    <p className="mt-1 text-[10px] text-gray-300">
                                      {hardwareMetrics?.system?.hardware
                                        ?.memoryTotalBytes
                                        ? `${formatFileSize(
                                            hardwareMetrics
                                              .system
                                              .hardware
                                              .memoryTotalBytes
                                          )} RAM`
                                        : "RAM capacity unavailable"}
                                    </p>

                                    <p className="mt-1 text-[8px] text-gray-600">
                                      {typeof hardwareMetrics?.memory ===
                                      "number"
                                        ? `${hardwareMetrics.memory.toFixed(
                                            0
                                          )}% memory in use`
                                        : "Usage unavailable"}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-2 rounded-xl border border-white/[0.05] bg-black/[0.12] px-2.5 py-2">
                                  <p
                                    className="truncate text-[9px] text-gray-500"
                                    title={
                                      hardwareMetrics?.system?.hardware
                                        ?.cpu ||
                                      "CPU information unavailable"
                                    }
                                  >
                                    {hardwareMetrics?.system?.hardware
                                      ?.cpu ||
                                      "CPU information unavailable"}
                                  </p>

                                  <p className="mt-1 text-[8px] text-gray-700">
                                    {hardwareMetrics?.system?.hardware
                                      ?.os ||
                                      "Operating system unavailable"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* =================================================
                                Right
                                ================================================= */}

                            <div
                              className="
                                min-w-0
                                lg:border-l
                                lg:border-white/[0.065]
                                lg:pl-6
                              "
                            >
                              <div className="mb-4">
                                <div className="flex items-center gap-2">
                                  <FileCode2 className="h-3.5 w-3.5 text-blue-300" />

                                  <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-gray-500">
                                    Model files
                                  </p>
                                </div>

                                <p className="mt-1.5 text-[10px] leading-relaxed text-gray-600">
                                  Choose the file variant you want to install.
                                </p>
                              </div>

                              <div
                                className="
                                  rounded-2xl
                                  border
                                  border-white/[0.06]
                                  bg-white/[0.018]
                                  p-3
                                "
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[8px] uppercase tracking-[0.13em] text-gray-700">
                                      Selected
                                    </p>

                                    <p
                                      className="mt-1 truncate text-[10px] font-medium text-gray-300"
                                      title={
                                        fitModel.recommendedFile
                                      }
                                    >
                                      {
                                        fitModel.fileLabel
                                      }
                                    </p>
                                  </div>

                                  <span className="shrink-0 rounded-full border border-emerald-400/10 bg-emerald-500/[0.04] px-2 py-1 text-[8px] font-semibold text-emerald-300">
                                    {getQuantizationLabel(
                                      fitModel.recommendedFile
                                    )}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setShowAdvancedFiles(
                                    (value) =>
                                      !value
                                  )
                                }
                                className="
                                  mt-2
                                  flex
                                  w-full
                                  items-center
                                  justify-center
                                  gap-2
                                  rounded-xl
                                  border
                                  border-white/[0.07]
                                  bg-white/[0.015]
                                  px-3
                                  py-2.5
                                  text-[10px]
                                  font-medium
                                  text-gray-500
                                  transition
                                  hover:bg-white/[0.04]
                                  hover:text-gray-200
                                "
                              >
                                <Settings2 className="h-3.5 w-3.5" />

                                {showAdvancedFiles
                                  ? "Hide file options"
                                  : "Show file options"}
                              </button>

                              {showAdvancedFiles && (
                                <div
                                  className="
                                    custom-scrollbar
                                    mt-2
                                    max-h-60
                                    space-y-1
                                    overflow-y-auto
                                    rounded-xl
                                    border
                                    border-white/[0.06]
                                    bg-black/20
                                    p-2
                                  "
                                >
                                  {(
                                    fitModel.ggufFiles ||
                                    []
                                  ).map(
                                    (
                                      fileName
                                    ) => (
                                      <button
                                        key={
                                          fileName
                                        }
                                        type="button"
                                        onClick={() => {
                                          void selectRecommendationVariant(
                                            fitModel,
                                            fileName
                                          );
                                        }}
                                        className={[
                                          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[9px] transition",
                                          fitModel.recommendedFile ===
                                          fileName
                                            ? "bg-blue-500/[0.13] text-blue-200"
                                            : "text-gray-600 hover:bg-white/[0.04] hover:text-gray-300",
                                        ].join(" ")}
                                      >
                                        <span className="truncate">
                                          {
                                            fileName
                                          }
                                        </span>

                                        {fitModel.recommendedFile ===
                                          fileName && (
                                          <CheckCircle2 className="h-3 w-3 shrink-0 text-blue-300" />
                                        )}
                                      </button>
                                    )
                                  )}
                                </div>
                              )}

                              <div className="mt-4 rounded-2xl border border-blue-400/10 bg-blue-500/[0.025] p-3.5">
                                <div className="flex items-start gap-2.5">
                                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/70" />

                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-300">
                                      Local installation
                                    </p>

                                    <p className="mt-1 text-[9px] leading-relaxed text-gray-600">
                                      The selected model will be installed into your local model storage.
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleBrowseModelDownload(
                                      fitModel
                                    )
                                  }
                                  disabled={
                                    downloadingRecommendation ||
                                    !fitModel.recommendedFile
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
                                    border-blue-400/15
                                    bg-blue-600
                                    px-3
                                    text-[10px]
                                    font-semibold
                                    text-white
                                    shadow-[0_8px_24px_rgba(37,99,235,0.18)]
                                    transition
                                    hover:bg-blue-500
                                    disabled:cursor-not-allowed
                                    disabled:opacity-50
                                  "
                                >
                                  {downloadingRecommendation ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Installing...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-3.5 w-3.5" />
                                      Install model
                                    </>
                                  )}
                                </button>

                                <a
                                  href={
                                    fitModel.repoUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    border
                                    border-white/[0.08]
                                    bg-white/[0.02]
                                    text-gray-500
                                    transition
                                    hover:border-white/[0.12]
                                    hover:bg-white/[0.05]
                                    hover:text-white
                                  "
                                  title="Open model on Hugging Face"
                                  aria-label="Open model on Hugging Face"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-10 text-center">
                          <Search className="mx-auto h-6 w-6 text-gray-600" />

                          <p className="mt-3 text-xs font-medium text-gray-300">
                            Select a model
                          </p>

                          <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-gray-600">
                            Review its size, quantization, requirements, and installation details here.
                          </p>
                        </div>
                      )}
                    </aside>
                  </div>
                )}
              </div>
            )}

            {/* =================================================================
                Local empty state
                ================================================================= */}

            {activeTab === "local" &&
              !selectedFile && (
                <div
                  className={[
                    "group relative overflow-hidden rounded-[24px] border transition-all duration-300",
                    dragActive
                      ? [
                          "border-blue-400/55",
                          "bg-blue-500/[0.065]",
                          "shadow-[0_0_0_1px_rgba(96,165,250,0.10),0_28px_90px_rgba(37,99,235,0.12)]",
                        ].join(" ")
                      : [
                          "border-white/[0.075]",
                          "bg-gradient-to-b from-white/[0.022] to-white/[0.012]",
                          "hover:border-white/[0.105]",
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
                  {/* Grid */}

                  <div
                    className="
                      pointer-events-none
                      absolute
                      inset-0
                      opacity-[0.025]
                      [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)]
                      [background-size:30px_30px]
                    "
                  />

                  {/* Glow */}

                  <div
                    className="
                      pointer-events-none
                      absolute
                      -right-28
                      -top-28
                      h-64
                      w-64
                      rounded-full
                      bg-blue-500/[0.06]
                      blur-3xl
                      transition-all
                      duration-500
                      group-hover:bg-blue-500/[0.10]
                    "
                  />

                  <div
                    className="
                      pointer-events-none
                      absolute
                      -bottom-32
                      -left-24
                      h-56
                      w-56
                      rounded-full
                      bg-indigo-500/[0.035]
                      blur-3xl
                    "
                  />

                  <div
                    className="
                      relative
                      flex
                      flex-col
                      items-center
                      px-5
                      py-10
                      text-center
                      sm:px-8
                      sm:py-14
                    "
                  >
                    {/* Logo */}

                    <div
                      className={[
                        "relative mb-7 flex h-[88px] w-[88px] items-center justify-center rounded-[26px] border transition-all duration-300",
                        dragActive
                          ? [
                              "scale-105",
                              "border-blue-400/25",
                              "bg-blue-500/[0.10]",
                              "shadow-[0_16px_50px_rgba(37,99,235,0.18)]",
                            ].join(" ")
                          : [
                              "border-white/[0.075]",
                              "bg-white/[0.028]",
                              "shadow-[0_14px_45px_rgba(0,0,0,0.18)]",
                              "group-hover:border-white/[0.11]",
                              "group-hover:bg-white/[0.04]",
                              "group-hover:shadow-[0_18px_55px_rgba(0,0,0,0.24)]",
                            ].join(" "),
                      ].join(" ")}
                    >
                      <div className="pointer-events-none absolute inset-2 rounded-[21px] border border-white/[0.035]" />

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

                    <div className="flex items-center gap-2">
                      {dragActive && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                      )}

                      <h3
                        className="
                          text-[16px]
                          font-semibold
                          tracking-[-0.015em]
                          text-gray-100
                        "
                      >
                        {selecting
                          ? "Opening file picker..."
                          : dragActive
                          ? "Drop your model here"
                          : "Import a local model"}
                      </h3>

                      {dragActive && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                      )}
                    </div>

                    {/* Description */}

                    <p
                      className="
                        mx-auto
                        mt-2.5
                        max-w-[410px]
                        text-[10px]
                        leading-[1.75]
                        text-gray-600
                      "
                    >
                      {selecting
                        ? "Please wait while the system opens the model picker."
                        : "Drag and drop your model here, or browse your computer to select a compatible local model."}
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
                          mt-7
                          inline-flex
                          h-10
                          items-center
                          gap-2
                          rounded-xl
                          border
                          border-blue-400/15
                          bg-blue-600
                          px-4
                          text-[10px]
                          font-semibold
                          text-white
                          shadow-[0_9px_28px_rgba(37,99,235,0.20)]
                          transition-all
                          duration-150
                          hover:border-blue-300/20
                          hover:bg-blue-500
                          hover:shadow-[0_12px_34px_rgba(37,99,235,0.27)]
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

                    {/* Hidden input */}

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
                        mt-8
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
                        Local only
                      </FeaturePill>
                    </div>
                  </div>
                </div>
              )}

            {/* =================================================================
                Selected Model
                ================================================================= */}

            {activeTab === "local" &&
              selectedFile && (
                <section className="space-y-3.5">
                  {/* Selected model */}

                  <div
                    className="
                      relative
                      overflow-hidden
                      rounded-[22px]
                      border
                      border-white/[0.075]
                      bg-gradient-to-br
                      from-white/[0.025]
                      to-white/[0.012]
                      shadow-[0_14px_45px_rgba(0,0,0,0.14)]
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
                        via-emerald-400/55
                        to-transparent
                      "
                    />

                    <div
                      className="
                        pointer-events-none
                        absolute
                        -right-24
                        -top-24
                        h-48
                        w-48
                        rounded-full
                        bg-blue-500/[0.04]
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
                          rounded-[15px]
                          border
                          border-blue-400/10
                          bg-blue-500/[0.07]
                          shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
                        "
                      >
                        <Cpu className="h-5 w-5 text-blue-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
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
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          </div>

                          <span
                            className="
                              text-[8px]
                              font-semibold
                              uppercase
                              tracking-[0.15em]
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
                          title={
                            selectedFile.name
                          }
                        >
                          {
                            selectedFile.name
                          }
                        </p>

                        <div
                          className="
                            mt-1.5
                            flex
                            flex-wrap
                            items-center
                            gap-x-3
                            gap-y-1
                            text-[9px]
                            text-gray-600
                          "
                        >
                          <span className="inline-flex items-center gap-1">
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

                  {/* Progress */}

                  {uploading && (
                    <div
                      className="
                        relative
                        overflow-hidden
                        rounded-[22px]
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
                          -right-20
                          -top-20
                          h-40
                          w-40
                          rounded-full
                          bg-blue-500/[0.07]
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
                        <div className="flex items-center gap-2.5">
                          <div
                            className="
                              flex
                              h-9
                              w-9
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
                            <p className="text-[11px] font-semibold text-blue-100">
                              Importing model
                            </p>

                            <p className="mt-0.5 text-[9px] text-gray-600">
                              Copying into local model storage
                            </p>
                          </div>
                        </div>

                        <span
                          className="
                            rounded-full
                            border
                            border-blue-400/10
                            bg-blue-500/[0.06]
                            px-2
                            py-1
                            text-[10px]
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

                  {/* Information */}

                  {!uploading &&
                    !success && (
                      <div
                        className="
                          relative
                          flex
                          items-start
                          gap-3
                          overflow-hidden
                          rounded-[20px]
                          border
                          border-amber-400/10
                          bg-amber-400/[0.025]
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
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold text-amber-200">
                            Before importing
                          </p>

                          <p
                            className="
                              mt-1
                              text-[9px]
                              leading-[1.7]
                              text-amber-200/50
                            "
                          >
                            The model will be copied into the application&apos;s local models directory. Importing it does not automatically activate the model.
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
                text-[8px]
                font-medium
                tracking-wide
                text-gray-700
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
            px-4
            py-3.5
            sm:px-6
            sm:py-4
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
              bg-white/[0.022]
              px-4
              text-[10px]
              font-semibold
              text-gray-500
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
                text-[10px]
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

/* ==========================================================================
   Small inline pause icon
   ========================================================================== */

const DownloadPauseIcon = () => (
  <div className="flex items-center gap-1">
    <span className="h-3.5 w-1 rounded-full bg-blue-300" />
    <span className="h-3.5 w-1 rounded-full bg-blue-300" />
  </div>
);

export default ModelUploadModal;