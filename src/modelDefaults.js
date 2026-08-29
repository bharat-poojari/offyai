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

  const activeModelIsValid =
    nextSettings.activeModel &&
    typeof nextSettings.activeModel === "object" &&
    typeof nextSettings.activeModel.id === "string" &&
    nextSettings.activeModel.id.trim() &&
    validModelIds.has(nextSettings.activeModel.id);

  if (activeModelIsValid) {
    nextSettings.model = nextSettings.activeModel.id;
  } else if (currentModelId && validModelIds.has(currentModelId)) {
    nextSettings.model = currentModelId;
  } else if (nextSettings.availableModels.some((model) => model && model.id === DEFAULT_MODEL_ID)) {
    nextSettings.model = DEFAULT_MODEL_ID;
  }

  if (
    !nextSettings.activeModel ||
    typeof nextSettings.activeModel !== "object" ||
    !validModelIds.has(nextSettings.activeModel.id)
  ) {
    nextSettings.activeModel = {
      ...protectedDefault,
      ...(nextSettings.activeModel && typeof nextSettings.activeModel === "object" ? nextSettings.activeModel : {}),
      id: DEFAULT_MODEL_ID,
      fileName: DEFAULT_MODEL_FILE,
      name: DEFAULT_MODEL_ID,
      type: "local",
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
    nextSettings.model = DEFAULT_MODEL_ID;
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
