/* Model preview URLs may be local Electron paths or data URLs. */
/* eslint-disable @next/next/no-img-element */
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
  Download,
  ChevronRight,
  Compass,
  Layers,
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
   Helpers (unchanged logic)
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
   Small UI primitives
   ========================================================================== */

const StatusMessage = ({ type, title, message }) => {
  const isError = type === "error";

  return (
    <div
      className={[
        "flex items-start gap-3 border-l-2 px-4 py-3",
        isError
          ? "border-l-red-400 bg-red-500/[0.07]"
          : "border-l-emerald-400 bg-emerald-500/[0.07]",
      ].join(" ")}
      role={isError ? "alert" : "status"}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      )}

      <div className="min-w-0">
        <p
          className={[
            "text-[12px] font-medium",
            isError ? "text-red-200" : "text-emerald-200",
          ].join(" ")}
        >
          {title}
        </p>
        <p
          className={[
            "mt-0.5 text-[11px] leading-relaxed",
            isError ? "text-red-200/60" : "text-emerald-200/60",
          ].join(" ")}
        >
          {message}
        </p>
      </div>
    </div>
  );
};

const StatChip = ({ icon, label, value, accent }) => (
  <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <p
      className={[
        "mt-1.5 truncate font-mono text-[12px] font-medium",
        accent || "text-[var(--text-primary)]",
      ].join(" ")}
      title={typeof value === "string" ? value : undefined}
    >
      {value}
    </p>
  </div>
);

const DownloadPauseIcon = () => (
  <div className="flex items-center gap-1">
    <span className="h-3.5 w-1 rounded-sm bg-teal-300" />
    <span className="h-3.5 w-1 rounded-sm bg-teal-300" />
  </div>
);

/* ==========================================================================
   OFFYAI Logo
   ========================================================================== */

const OffyaiLogo = ({ src = DEFAULT_LOGO_SRC, size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-14 w-14",
  };

  const imageSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className={[
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]",
        imageSize,
        className,
      ].join(" ")}
    >
      <img
        src={src}
        alt="OFFYAI"
        draggable="false"
        className="relative h-[64%] w-[64%] select-none object-contain"
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
    useState("browse");

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
  const isBusyDownload = downloadingRecommendation || downloadPaused;

  const TABS = [
    { id: "browse", label: "Browse open models", icon: Compass },
    { id: "local", label: "Import local", icon: Upload },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Backdrop */}
      <div className="model-upload-backdrop absolute inset-0 bg-[#040507]/85 backdrop-blur-md" />

      {/* Modal shell -- sized to use nearly the full viewport */}
      <div
        className="model-upload-modal relative flex h-[92vh] w-[96vw] max-w-[1360px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-[0_30px_100px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-upload-title"
        aria-describedby="model-upload-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* ==================================================================
            Header — logo, tabs and close all in one compact row
            ================================================================== */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <OffyaiLogo src={logoSrc} size="sm" />

            <div className="min-w-0">
              <h2
                id="model-upload-title"
                className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
              >
                {activeTab === "browse" ? "Model library" : "Add local model"}
              </h2>
              <p
                id="model-upload-description"
                className="truncate text-[10.5px] text-[var(--text-secondary)]"
              >
                {activeTab === "browse"
                  ? "Search open model hubs and install what fits your hardware"
                  : "Import a GGUF, BIN, or GGML file from your machine"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-0.5">
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                      active
                        ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
                    ].join(" ")}
                  >
                    <TabIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={uploading || selecting}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Close upload dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ==================================================================
            Status banners
            ================================================================== */}
        {error && <StatusMessage type="error" title="Unable to continue" message={error} />}
        {success && <StatusMessage type="success" title="Model imported" message={success} />}

        {/* ==================================================================
            Download progress — slim full-width bar
            ================================================================== */}
        {isBusyDownload && downloadProgress && (
          <div className="shrink-0 border-b border-[var(--border)] bg-[var(--accent-subtle)] px-4 py-2.5 sm:px-5" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {downloadPaused ? (
                  <DownloadPauseIcon />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-300" />
                )}
                <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">
                  {downloadPaused
                    ? "Paused"
                    : downloadProgress.percent === 100
                    ? "Finalizing installation"
                    : "Downloading"}
                </p>
                <span className="truncate font-mono text-[10.5px] text-[var(--text-secondary)]">
                  {downloadProgress.fileName || "Preparing model file"}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <span className="font-mono text-[10.5px] text-[var(--text-secondary)]">
                  {formatFileSize(downloadProgress.receivedBytes || 0)}
                  {Number.isFinite(downloadProgress.totalBytes)
                    ? ` / ${formatFileSize(downloadProgress.totalBytes)}`
                    : ""}
                </span>
                <span className="font-mono text-[10.5px] text-[var(--text-secondary)]">
                  {formatTransferRate(downloadProgress.bytesPerSecond)}
                </span>
                <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-[var(--text-primary)]">
                  {Number.isFinite(downloadProgress.percent) ? `${downloadProgress.percent}%` : "--"}
                </span>

                {downloadPaused ? (
                  <button
                    type="button"
                    onClick={resumeModelDownload}
                    className="rounded-md bg-[var(--primary)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pauseModelDownload}
                    disabled={!downloadingRecommendation}
                    className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10.5px] font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-raised)] disabled:opacity-50"
                  >
                    Pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancelModelDownload}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10.5px] font-medium text-[var(--danger)] transition hover:bg-[var(--surface-raised)]"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300 transition-[width] duration-300"
                style={{
                  width: `${Number.isFinite(downloadProgress.percent) ? downloadProgress.percent : 3}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ==================================================================
            Body
            ================================================================== */}
        <main className="relative min-h-0 flex-1 overflow-hidden">
          {activeTab === "local" ? (
            <LocalImportPane
              selectedFile={selectedFile}
              uploading={uploading}
              selecting={selecting}
              dragActive={dragActive}
              uploadProgress={uploadProgress}
              handleDragEnter={handleDragEnter}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleSelectFile={handleSelectFile}
              handleRemoveFile={handleRemoveFile}
              handleNativeFileInput={handleNativeFileInput}
              fileInputRef={fileInputRef}
              success={success}
            />
          ) : (
            <BrowsePane
              recommendationGoal={recommendationGoal}
              setRecommendationGoal={setRecommendationGoal}
              recommendationQuery={recommendationQuery}
              setRecommendationQuery={setRecommendationQuery}
              populateRecommendations={populateRecommendations}
              recommendationsLoading={recommendationsLoading}
              recommendationError={recommendationError}
              filteredRecommendations={filteredRecommendations}
              recommendations={recommendations}
              quantizationFilter={quantizationFilter}
              setQuantizationFilter={setQuantizationFilter}
              parameterFilter={parameterFilter}
              setParameterFilter={setParameterFilter}
              availableQuantizations={availableQuantizations}
              availableParameters={availableParameters}
              selectedRecommendation={selectedRecommendation}
              selectRecommendationVariant={selectRecommendationVariant}
              availableModels={availableModels}
              handleBrowseModelDownload={handleBrowseModelDownload}
              downloadingRecommendation={downloadingRecommendation}
              fitModel={fitModel}
              fitFile={fitFile}
              resolvingFileMetadata={resolvingFileMetadata}
              hardwareMetrics={hardwareMetrics}
              showAdvancedFiles={showAdvancedFiles}
              setShowAdvancedFiles={setShowAdvancedFiles}
            />
          )}
        </main>

        {/* ==================================================================
            Footer — only meaningful for the local-import flow
            ================================================================== */}
        {activeTab === "local" && (
          <footer className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={selectedFile && !uploading ? handleRemoveFile : handleClose}
              disabled={uploading || selecting}
              className="flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedFile ? "Choose another" : "Cancel"}
            </button>

            {selectedFile && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || selecting}
                className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[11px] font-semibold text-[var(--primary-foreground)] shadow-[0_8px_20px_rgba(15,156,143,0.18)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-raised)] disabled:text-[var(--text-secondary)] disabled:shadow-none"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   Local import pane
   ========================================================================== */

const LocalImportPane = ({
  selectedFile,
  uploading,
  selecting,
  dragActive,
  uploadProgress,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleSelectFile,
  handleRemoveFile,
  handleNativeFileInput,
  fileInputRef,
  success,
}) => {
  if (!selectedFile) {
    return (
      <div
        className={[
          "model-upload-pane flex h-full flex-col items-center justify-center gap-6 border-2 border-dashed px-6 text-center transition-colors",
          dragActive
            ? "border-[var(--primary)]/50 bg-[var(--accent-subtle)]"
            : "border-[var(--border)] bg-transparent",
          uploading || selecting ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={[
            "flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--border)] transition-colors",
            dragActive
              ? "bg-[var(--accent-subtle)]"
              : "bg-[var(--surface-raised)]",
          ].join(" ")}
        >
          {selecting ? (
            <Loader2 className="h-6 w-6 animate-spin text-teal-300" />
          ) : (
            <FolderOpen className={dragActive ? "h-7 w-7 text-[var(--primary)]" : "h-7 w-7 text-[var(--text-secondary)]"} />
          )}
        </div>

        <div>
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
            {selecting
              ? "Opening file picker..."
              : dragActive
              ? "Drop your model here"
              : "Drag a model file into this window"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
            {selecting
              ? "Please wait while the system opens the model picker."
              : "Or browse your computer for a compatible GGUF, BIN, or GGML file."}
          </p>
        </div>

        {!selecting && (
          <button
            type="button"
            onClick={handleSelectFile}
            disabled={uploading || selecting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-[11.5px] font-semibold text-[var(--primary-foreground)] shadow-[0_10px_30px_rgba(15,156,143,0.18)] transition-all hover:bg-[var(--primary-hover)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen className="h-4 w-4" />
            Browse files
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".gguf,.bin,.ggml"
          onChange={handleNativeFileInput}
          disabled={uploading || selecting}
        />

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {[
            { icon: <FileCode2 className="h-3 w-3 text-[var(--primary)]" />, label: "GGUF · BIN · GGML" },
            { icon: <HardDrive className="h-3 w-3 text-[var(--text-secondary)]" />, label: "Up to 10 GB" },
            { icon: <ShieldCheck className="h-3 w-3 text-[var(--success)]" />, label: "Stored locally only" },
          ].map((pill) => (
            <span
              key={pill.label}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--text-secondary)]"
            >
              {pill.icon}
              {pill.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-px overflow-y-auto bg-[var(--border)] lg:grid-cols-[1.1fr_0.9fr]">
      {/* Left: file summary */}
      <div className="flex flex-col gap-4 bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--success)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ready to import
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--primary)]/20 bg-[var(--accent-subtle)]">
            <Cpu className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]" title={selectedFile.name}>
              {selectedFile.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {selectedFile.sizeFormatted || formatFileSize(selectedFile.size)}
              </span>
              {selectedFile.extension && (
                <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 uppercase text-[var(--text-secondary)]">
                  {selectedFile.extension.replace(".", "")}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            disabled={uploading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Choose another model"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {uploading && (
          <div className="rounded-xl border border-teal-400/15 bg-teal-500/[0.05] p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" />
                <p className="text-[11.5px] font-medium text-teal-100">Copying into local storage</p>
              </div>
              <span className="font-mono text-[11px] font-semibold text-teal-200">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300 transition-[width] duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-2 text-[10.5px] text-gray-600">Large models may take several minutes to copy.</p>
          </div>
        )}

        {!uploading && !success && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-[10.5px] leading-relaxed text-amber-200/70">
              This copies the file into OFFYAI&apos;s local models directory. Importing does not automatically activate it — switch to it from Settings afterward.
            </p>
          </div>
        )}
      </div>

      {/* Right: what happens next */}
      <div className="flex flex-col justify-between bg-[var(--surface)] p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">What happens next</p>
          <ol className="mt-3 space-y-3">
            {[
              ["Copy", "The file is copied byte-for-byte into your local models folder."],
              ["Register", "OFFYAI reads the file and adds it to your model list."],
              ["Activate", "You choose when to switch to it from Settings."],
            ].map(([title, body], idx) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] font-mono text-[9.5px] text-gray-400">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-[11.5px] font-medium text-gray-200">{title}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-gray-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.015] px-3.5 py-3 text-[10.5px] text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
          Nothing leaves your machine — models are read and stored locally only.
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   Browse pane — dense list on the left, persistent detail panel on the right
   ========================================================================== */

const BrowsePane = ({
  recommendationGoal,
  setRecommendationGoal,
  recommendationQuery,
  setRecommendationQuery,
  populateRecommendations,
  recommendationsLoading,
  recommendationError,
  filteredRecommendations,
  recommendations,
  quantizationFilter,
  setQuantizationFilter,
  parameterFilter,
  setParameterFilter,
  availableQuantizations,
  availableParameters,
  selectedRecommendation,
  selectRecommendationVariant,
  availableModels,
  handleBrowseModelDownload,
  downloadingRecommendation,
  fitModel,
  fitFile,
  resolvingFileMetadata,
  hardwareMetrics,
  showAdvancedFiles,
  setShowAdvancedFiles,
}) => {
  return (
    <div className="flex h-full min-h-0">
      {/* ==================================================================
          Left: search, filters, results
          ================================================================== */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="shrink-0 space-y-3 border-b border-[var(--border)] p-3.5">
          <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
            {RECOMMENDATION_GOALS.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => {
                  setRecommendationGoal(goal.id);
                  setRecommendationQuery("");
                  void populateRecommendations(goal.id, "");
                }}
                className={[
                  "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                  recommendationGoal === goal.id
                    ? "border-[var(--primary)]/50 bg-[var(--accent-subtle)] text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--primary)]/50 hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                {goal.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={recommendationQuery}
                onChange={(event) => setRecommendationQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void populateRecommendations(recommendationGoal, recommendationQuery);
                  }
                }}
                placeholder="Search models or families"
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] pl-8 pr-2.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--ring)]"
              />
            </div>
            <button
              type="button"
              onClick={() => void populateRecommendations(recommendationGoal, recommendationQuery)}
              disabled={recommendationsLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--primary)]/30 bg-[var(--accent-subtle)] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Search models"
            >
              {recommendationsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={quantizationFilter}
              onChange={(event) => setQuantizationFilter(event.target.value)}
              className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--ring)]"
            >
              <option value="all">All quantizations</option>
              {availableQuantizations.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={parameterFilter}
              onChange={(event) => setParameterFilter(event.target.value)}
              className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--ring)]"
            >
              <option value="all">All sizes</option>
              {availableParameters.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[10px] text-[var(--text-secondary)]">
            {filteredRecommendations.length} of {recommendations.length} repositories
          </p>
        </div>

        {recommendationError && (
          <div className="shrink-0 border-b border-white/[0.08]">
            <StatusMessage type="error" title="Search failed" message={recommendationError} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          {recommendationsLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
              <p className="text-[11px] text-[var(--text-secondary)]">Finding compatible models...</p>
            </div>
          ) : filteredRecommendations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <Search className="h-5 w-5 text-[var(--text-secondary)]" />
              <p className="text-[11px] font-medium text-[var(--text-primary)]">No matching models</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Try a broader search or another use case.</p>
            </div>
          ) : (
            filteredRecommendations.map((model, index) => {
              const isSelected =
                selectedRecommendation?.id === model.id &&
                selectedRecommendation?.source === model.source;
              const installed = getInstalledModel(model, availableModels);
              const isThisDownloading = downloadingRecommendation && isSelected;

              return (
                <button
                  key={`${model.source || "source"}-${model.id}-${model.recommendedFile}`}
                  type="button"
                  onClick={() => {
                    void selectRecommendationVariant(model, model.recommendedFile);
                    setShowAdvancedFiles(false);
                  }}
                  className={[
                    "group flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-3.5 text-left transition-all hover:border-[var(--primary)]/50 hover:bg-[var(--surface)]",
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--accent-subtle)] shadow-sm"
                      : "border-l-[var(--border)]",
                  ].join(" ")}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--primary)]/30 bg-[var(--accent-subtle)]">
                    <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {index === 0 && (
                        <span className="rounded-md border border-[var(--primary)]/40 bg-[var(--accent)] px-1.5 py-0.5 text-[8.5px] font-bold text-[var(--primary)]">
                          Best
                        </span>
                      )}
                      <p className="truncate text-[11.5px] font-medium text-[var(--text-primary)]">{model.name}</p>
                      {installed && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[9.5px] text-[var(--text-secondary)]">
                      {model.fileLabel} · {getQuantizationLabel(model.recommendedFile)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="rounded-md border border-[var(--primary)]/30 bg-[var(--accent-subtle)] px-1.5 py-1 font-mono text-[10px] font-bold text-[var(--primary)]">{model.score}%</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleBrowseModelDownload(model);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.stopPropagation();
                          void handleBrowseModelDownload(model);
                        }
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-secondary)] opacity-0 transition-opacity hover:bg-[var(--surface-raised)] hover:text-[var(--primary)] group-hover:opacity-100"
                      aria-label={`Download ${model.name}`}
                    >
                      {isThisDownloading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ==================================================================
          Right: persistent detail panel
          ================================================================== */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-[var(--surface)] text-[var(--text-primary)] custom-scrollbar">
        {!fitModel ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <Search className="h-6 w-6 text-[var(--text-secondary)]" />
            <p className="text-[12px] font-medium text-[var(--text-primary)]">Select a model</p>
            <p className="max-w-sm text-[10.5px] leading-relaxed text-[var(--text-secondary)]">
              Its size, quantization, memory needs, and install action will appear here.
            </p>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--primary)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Recommended for {getGoalConfig(recommendationGoal).label.toLowerCase()}
                </div>
                <h3 className="mt-2 break-words text-[19px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">
                  {fitModel.name}
                </h3>
                <p className="mt-1 break-all font-mono text-[10.5px] text-[var(--text-secondary)]">{fitModel.id}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md border border-[var(--primary)]/30 bg-[var(--accent-subtle)] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[var(--primary)]">
                  {fitModel.score}%
                </span>
                {fitModel.repoUrl && (
                  <a
                    href={fitModel.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                    title="Open on Hugging Face"
                    aria-label="Open model source"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip
                icon={<HardDrive className="h-3 w-3" />}
                label="Download"
                value={
                  resolvingFileMetadata
                    ? "Checking..."
                    : fitFile?.sizeBytes
                    ? formatFileSize(fitFile.sizeBytes)
                    : "Unavailable"
                }
              />
              <StatChip
                icon={<MemoryStick className="h-3 w-3" />}
                label="Memory"
                value={resolvingFileMetadata ? "Calculating..." : getMemoryRequirement(fitFile?.sizeBytes)}
                accent="text-[var(--primary)]"
              />
              <StatChip
                icon={<Layers className="h-3 w-3" />}
                label="Quantization"
                value={getQuantizationLabel(fitModel.recommendedFile)}
                accent="text-[var(--primary)]"
              />
              <StatChip
                icon={<Gauge className="h-3 w-3" />}
                label="Downloads"
                value={(fitModel.downloads || 0).toLocaleString()}
              />
            </div>

            {/* File variant selector */}
            <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9.5px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Selected file</p>
                  <p
                    className="mt-1 truncate font-mono text-[11px] text-[var(--text-primary)]"
                    title={fitModel.recommendedFile}
                  >
                    {fitModel.fileLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFiles((value) => !value)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                >
                  <Settings2 className="h-3 w-3" />
                  {showAdvancedFiles ? "Hide" : "Other files"}
                </button>
              </div>

              {showAdvancedFiles && (
                <div className="mt-3 max-h-44 space-y-1 overflow-y-auto custom-scrollbar border-t border-white/[0.06] pt-3">
                  {(fitModel.ggufFiles || []).map((fileName) => (
                    <button
                      key={fileName}
                      type="button"
                      onClick={() => void selectRecommendationVariant(fitModel, fileName)}
                      className={[
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors",
                        fitModel.recommendedFile === fileName
                          ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      <span className="truncate">{fileName}</span>
                      {fitModel.recommendedFile === fileName && (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-[var(--primary)]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Two-column: performance + device */}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
                <div className="flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-amber-300" />
                  <p className="text-[11px] font-medium text-[var(--text-primary)]">Performance</p>
                </div>
                <div className="mt-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <p className="text-[10.5px] text-[var(--text-secondary)]">
                    No benchmark recorded for {fitModel.fileLabel || "this model"} on this device.
                  </p>
                  <p className="mt-1 text-[9.5px] text-[var(--text-secondary)]">Install first, then run a benchmark.</p>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <p className="text-[11px] font-medium text-[var(--text-primary)]">Your device</p>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
                    <p className="text-[9px] text-[var(--text-secondary)]">GPU</p>
                    <p className="mt-0.5 truncate text-[10px] text-[var(--text-primary)]" title={hardwareMetrics?.gpuModel}>
                      {hardwareMetrics?.gpuModel || "Unavailable"}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
                    <p className="text-[9px] text-[var(--text-secondary)]">Memory</p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-primary)]">
                      {hardwareMetrics?.system?.hardware?.memoryTotalBytes
                        ? formatFileSize(hardwareMetrics.system.hardware.memoryTotalBytes)
                        : "Unavailable"}
                    </p>
                  </div>
                </div>
                <p
                  className="mt-1.5 truncate text-[9.5px] text-[var(--text-secondary)]"
                  title={hardwareMetrics?.system?.hardware?.cpu}
                >
                  {hardwareMetrics?.system?.hardware?.cpu || "CPU information unavailable"}
                </p>
              </div>
            </div>

            {/* Install action */}
            <div className="mt-5 flex items-center gap-2.5 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => void handleBrowseModelDownload(fitModel)}
                disabled={downloadingRecommendation || !fitModel.recommendedFile}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-[11.5px] font-semibold text-[var(--primary-foreground)] shadow-[0_10px_28px_rgba(15,156,143,0.18)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-raised)] disabled:text-[var(--text-secondary)] disabled:shadow-none"
              >
                {downloadingRecommendation ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Install model
                  </>
                )}
              </button>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelUploadModal;