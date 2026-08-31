"use strict";

const DEFAULT_MODEL_ID = "offyai";
const DEFAULT_MODEL_FILE = "offyai.gguf";

function buildProtectedDefaultModel({ defaultPath = `models/${DEFAULT_MODEL_FILE}` } = {}) {
  return {
    id: DEFAULT_MODEL_ID,
    fileName: DEFAULT_MODEL_FILE,
    name: DEFAULT_MODEL_ID,
    type: "local",
    path: defaultPath,
  };
}

function isProtectedDefaultModel(modelId, fileName = "") {
  const candidates = [
    String(modelId || "").trim().toLowerCase(),
    String(fileName || "").trim().toLowerCase(),
  ];

  return candidates.some((value) => {
    if (!value) {
      return false;
    }

    const normalized = value.replace(/\\/g, "/");

    return (
      normalized === DEFAULT_MODEL_ID ||
      normalized === DEFAULT_MODEL_FILE.toLowerCase() ||
      normalized === `${DEFAULT_MODEL_ID}.gguf` ||
      normalized === `${DEFAULT_MODEL_ID}.bin` ||
      normalized === `${DEFAULT_MODEL_ID}.ggml`
    );
  });
}

function chooseValidFallbackModel(settings = {}, defaultPath = `models/${DEFAULT_MODEL_FILE}`) {
  const items = Array.isArray(settings.availableModels)
    ? settings.availableModels.filter((model) => model && typeof model === "object")
    : [];

  const currentModelId = typeof settings.model === "string" ? settings.model.trim() : "";
  const activeModelId = settings.activeModel && typeof settings.activeModel === "object"
    ? String(settings.activeModel.id || settings.activeModel.modelId || settings.activeModel.name || "").trim()
    : "";

  const nonDefaultCandidates = items.filter((model) => !isProtectedDefaultModel(model.id, model.fileName || model.name));

  const preferred =
    nonDefaultCandidates.find((model) => model.id === currentModelId || model.fileName === currentModelId || model.name === currentModelId) ||
    nonDefaultCandidates.find((model) => model.id === activeModelId || model.fileName === activeModelId || model.name === activeModelId) ||
    nonDefaultCandidates[0] ||
    items.find((model) => model.id === currentModelId || model.fileName === currentModelId || model.name === currentModelId) ||
    items.find((model) => model.id === activeModelId || model.fileName === activeModelId || model.name === activeModelId) ||
    items[0] ||
    buildProtectedDefaultModel({ defaultPath });

  if (!preferred || typeof preferred !== "object") {
    return buildProtectedDefaultModel({ defaultPath });
  }

  return {
    ...preferred,
    id: preferred.id || DEFAULT_MODEL_ID,
    fileName: preferred.fileName || DEFAULT_MODEL_FILE,
    name: preferred.name || preferred.id || DEFAULT_MODEL_ID,
    type: preferred.type || "local",
    path: preferred.path || defaultPath,
  };
}

function ensureDefaultModelEntry(settings = {}, { defaultPath = `models/${DEFAULT_MODEL_FILE}` } = {}) {
  const protectedDefault = buildProtectedDefaultModel({ defaultPath });

  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {
      ...settings,
      availableModels: [protectedDefault],
      model: DEFAULT_MODEL_ID,
      activeModel: protectedDefault,
    };
  }

  const nextSettings = { ...settings };

  if (!Array.isArray(nextSettings.availableModels)) {
    nextSettings.availableModels = [];
  }

  const filteredModels = nextSettings.availableModels
    .filter((model) => model && typeof model === "object")
    .filter((model) => {
      const matchesDefaultIdentity =
        isProtectedDefaultModel(model.id, model.fileName) ||
        isProtectedDefaultModel(model.id, model.name) ||
        isProtectedDefaultModel(model.fileName, model.name);

      if (!matchesDefaultIdentity) {
        return true;
      }

      return model.id === DEFAULT_MODEL_ID && model.fileName === DEFAULT_MODEL_FILE;
    });

  const defaultIndex = filteredModels.findIndex((model) =>
    model &&
    model.id === DEFAULT_MODEL_ID &&
    model.fileName === DEFAULT_MODEL_FILE
  );

  if (defaultIndex >= 0) {
    filteredModels[defaultIndex] = {
      ...filteredModels[defaultIndex],
      ...protectedDefault,
    };
  } else {
    filteredModels.unshift(protectedDefault);
  }

  nextSettings.availableModels = filteredModels.filter((model, index, list) => {
    if (!model || typeof model !== "object") {
      return false;
    }

    if (model.id === DEFAULT_MODEL_ID && model.fileName === DEFAULT_MODEL_FILE) {
      return index === list.findIndex((candidate) =>
        candidate &&
        typeof candidate === "object" &&
        candidate.id === DEFAULT_MODEL_ID &&
        candidate.fileName === DEFAULT_MODEL_FILE
      );
    }

    return true;
  });

  const defaultModel = nextSettings.availableModels.find((model) =>
    model &&
    typeof model === "object" &&
    model.id === DEFAULT_MODEL_ID &&
    model.fileName === DEFAULT_MODEL_FILE
  );

  const otherModels = nextSettings.availableModels.filter((model) => !(
    model &&
    typeof model === "object" &&
    model.id === DEFAULT_MODEL_ID &&
    model.fileName === DEFAULT_MODEL_FILE
  ));

  const orderedModels = [];

  if (defaultModel) {
    orderedModels.push(defaultModel);
  }

  orderedModels.push(...otherModels.sort((a, b) => {
    const left = (a?.name || a?.id || a?.fileName || "").toString().toLowerCase();
    const right = (b?.name || b?.id || b?.fileName || "").toString().toLowerCase();
    return left.localeCompare(right);
  }));

  nextSettings.availableModels = orderedModels;

  const validModelIds = new Set(
    nextSettings.availableModels
      .filter((model) => model && typeof model === "object")
      .map((model) => model.id)
      .filter(Boolean)
  );

  const currentModelId =
    typeof nextSettings.model === "string" && nextSettings.model.trim()
      ? nextSettings.model.trim()
      : "";

  const activeModelId =
    nextSettings.activeModel &&
    typeof nextSettings.activeModel === "object"
      ? String(nextSettings.activeModel.id || nextSettings.activeModel.modelId || nextSettings.activeModel.name || "").trim()
      : "";

  const activeModelIsValid =
    activeModelId &&
    validModelIds.has(activeModelId);

  const fallbackModel = chooseValidFallbackModel(nextSettings, defaultPath);

  const selectedModelMatch =
    currentModelId && validModelIds.has(currentModelId)
      ? nextSettings.availableModels.find((model) => model && model.id === currentModelId)
      : null;

  const activeModelMatch =
    activeModelIsValid
      ? nextSettings.availableModels.find((model) => model && model.id === activeModelId)
      : null;

  if (selectedModelMatch) {
    nextSettings.model = selectedModelMatch.id;
    nextSettings.activeModel = {
      ...selectedModelMatch,
      id: selectedModelMatch.id,
      fileName: selectedModelMatch.fileName || selectedModelMatch.name || DEFAULT_MODEL_FILE,
      name: selectedModelMatch.name || selectedModelMatch.id || DEFAULT_MODEL_ID,
      type: selectedModelMatch.type || "local",
      path: selectedModelMatch.path || defaultPath,
    };
  } else if (activeModelMatch) {
    nextSettings.model = activeModelMatch.id;
    nextSettings.activeModel = {
      ...activeModelMatch,
      id: activeModelMatch.id,
      fileName: activeModelMatch.fileName || activeModelMatch.name || DEFAULT_MODEL_FILE,
      name: activeModelMatch.name || activeModelMatch.id || DEFAULT_MODEL_ID,
      type: activeModelMatch.type || "local",
      path: activeModelMatch.path || defaultPath,
    };
  } else if (fallbackModel && fallbackModel.id && validModelIds.has(fallbackModel.id)) {
    nextSettings.model = fallbackModel.id;
    nextSettings.activeModel = {
      ...fallbackModel,
      id: fallbackModel.id || DEFAULT_MODEL_ID,
      fileName: fallbackModel.fileName || DEFAULT_MODEL_FILE,
      name: fallbackModel.name || fallbackModel.id || DEFAULT_MODEL_ID,
      type: fallbackModel.type || "local",
      path: fallbackModel.path || defaultPath,
    };
  } else if (nextSettings.availableModels.some((model) => model && model.id === DEFAULT_MODEL_ID)) {
    nextSettings.model = DEFAULT_MODEL_ID;
    nextSettings.activeModel = {
      ...buildProtectedDefaultModel({ defaultPath }),
      path: defaultPath,
    };
  }

  if (
    nextSettings.activeModel &&
    typeof nextSettings.activeModel === "object" &&
    isProtectedDefaultModel(nextSettings.activeModel.id, nextSettings.activeModel.fileName)
  ) {
    nextSettings.activeModel = {
      ...nextSettings.activeModel,
      id: DEFAULT_MODEL_ID,
      fileName: DEFAULT_MODEL_FILE,
      name: DEFAULT_MODEL_ID,
      type: "local",
      path: nextSettings.activeModel.path || defaultPath,
    };
  }

  if (!nextSettings.model || !validModelIds.has(nextSettings.model)) {
    nextSettings.model = nextSettings.activeModel?.id || DEFAULT_MODEL_ID;
  }

  return nextSettings;
}

module.exports = {
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_FILE,
  buildProtectedDefaultModel,
  isProtectedDefaultModel,
  ensureDefaultModelEntry,
};
