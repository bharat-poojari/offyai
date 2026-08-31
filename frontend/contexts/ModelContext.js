import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { modelsAPI } from "../utils/api";

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

const ModelContext = createContext(null);

export const useModel = () => {
  const context = useContext(ModelContext);

  if (!context) {
    throw new Error(
      "useModel must be used within a ModelProvider"
    );
  }

  return context;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Safely determine whether Electron IPC is available.
 */
const isElectron = () => {
  return (
    typeof window !== "undefined" &&
    Boolean(window.electronAPI)
  );
};

/**
 * Normalize the response returned by modelsAPI.list().
 *
 * Depending on the main.js/preload implementation, the result may be:
 *
 *   [ ...models ]
 *
 * or:
 *
 *   { data: [ ...models ] }
 *
 * or:
 *
 *   { models: [ ...models ] }
 */
const extractModels = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    response &&
    Array.isArray(response.data)
  ) {
    return response.data;
  }

  if (
    response &&
    Array.isArray(response.models)
  ) {
    return response.models;
  }

  return [];
};

/**
 * Safely compare model IDs.
 */
const getModelId = (model) => {
  if (!model) {
    return null;
  }

  if (typeof model === "string") {
    return model;
  }

  return (
    model.id ||
    model.modelId ||
    model.name ||
    model.model ||
    null
  );
};

/**
 * Create a minimal model object when settings contain
 * a model ID that isn't currently present in the model list.
 */
const createModelFromId = (
  modelId,
  modelType = "local"
) => {
  if (!modelId) {
    return null;
  }

  return {
    id: modelId,
    name: modelId,
    type: modelType,
  };
};

const isBuiltInDefaultModel = (model) => {
  const modelId = getModelId(model);
  const modelName = model?.name || model?.fileName || model?.model || "";

  return (
    modelId === "offyai" ||
    modelName === "offyai" ||
    modelName === "offyai.gguf" ||
    model?.fileName === "offyai.gguf"
  );
};

const getPreferredFallbackModel = (models) => {
  if (!Array.isArray(models) || models.length === 0) {
    return null;
  }

  const nonDefaultModel = models.find((model) => !isBuiltInDefaultModel(model));

  return nonDefaultModel || models[0] || null;
};

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export const ModelProvider = ({
  children,
}) => {
  const [
    currentModel,
    setCurrentModel,
  ] = useState(null);

  const [
    availableModels,
    setAvailableModels,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  /*
   * Prevent overlapping model requests.
   *
   * Without this, an interval/manual refresh could result in:
   *
   * request #1
   * request #2
   * request #3
   * ...
   *
   * all running simultaneously.
   */
  const loadingRef = useRef(false);

  /*
   * Prevent rapid repeated scans of the model directory.
   * A refresh triggered by a UI action should not immediately
   * retrigger the same work again while the previous request is still fresh.
   */
  const lastLoadTimestampRef = useRef(0);

  /*
   * Track whether the provider is still mounted.
   */
  const mountedRef = useRef(false);

  /* ---------------------------------------------------------------------- */
  /* Load Electron settings                                                  */
  /* ---------------------------------------------------------------------- */

  const getElectronSettings =
    useCallback(async () => {
      if (
        !isElectron() ||
        typeof window.electronAPI
          ?.getSettings !== "function"
      ) {
        return null;
      }

      try {
        return await window.electronAPI.getSettings();
      } catch (error) {
        console.warn(
          "Unable to read Electron settings:",
          error
        );

        return null;
      }
    }, []);

  /* ---------------------------------------------------------------------- */
  /* Find active model                                                       */
  /* ---------------------------------------------------------------------- */

  const resolveActiveModel =
    useCallback(
      async (models) => {
        /*
         * First try persisted Electron settings.
         */
        const settings =
          await getElectronSettings();

        if (settings) {
          /*
           * Prefer the user-selected model ID when it is valid and present.
           * A stale activeModel payload should never override the real saved
           * model choice.
           */
          if (settings.model) {
            const modelId =
              getModelId(
                settings.model
              );

            const matchingModel =
              models.find(
                (model) =>
                  getModelId(model) ===
                  modelId
              );

            if (matchingModel) {
              return matchingModel;
            }
          }

          if (
            settings.activeModel &&
            typeof settings.activeModel ===
              "object"
          ) {
            const activeId =
              getModelId(
                settings.activeModel
              );

            const matchingModel =
              models.find(
                (model) =>
                  getModelId(model) ===
                  activeId
              );

            if (matchingModel) {
              return matchingModel;
            }
          }
        }

        /*
         * If the saved selection is stale or missing, prefer the first valid
         * local model rather than forcing the built-in default. This keeps the
         * upload/import/delete/switch flow consistent after a model change.
         */
        if (models.length > 0) {
          return getPreferredFallbackModel(models);
        }

        return null;
      },
      [getElectronSettings]
    );

  /* ---------------------------------------------------------------------- */
  /* Load models                                                             */
  /* ---------------------------------------------------------------------- */

  const loadModels =
    useCallback(
      async ({
        silent = false,
        force = false,
      } = {}) => {
        const now = Date.now();

        /*
         * Do not start another request while one is already running.
         */
        if (loadingRef.current) {
          return;
        }

        /*
         * Debounce rapid refreshes to prevent expensive model scans from
         * stacking up when the app is switching models or re-rendering.
         */
        if (!force && !silent && now - lastLoadTimestampRef.current < 750) {
          return;
        }

        loadingRef.current = true;

        if (!silent) {
          setIsLoading(true);
        }

        setError(null);

        if (!isElectron()) {
          setAvailableModels([]);
          setCurrentModel(null);
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }

        try {
          /*
           * modelsAPI.list() now prefers Electron IPC.
           *
           * It will NOT require localhost:3001 in Electron.
           */
          const response =
            await modelsAPI.list();

          if (
            !mountedRef.current
          ) {
            return;
          }

          const models =
            extractModels(response);

          setAvailableModels((previousModels) =>
            models.length > 0 || previousModels.length === 0
              ? models
              : previousModels
          );

          lastLoadTimestampRef.current = Date.now();

          /*
           * Resolve the active model using persisted settings.
           */
          const activeModel =
            await resolveActiveModel(
              models
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          setCurrentModel(
            activeModel
          );
        } catch (error) {
          if (
            !mountedRef.current
          ) {
            return;
          }

          console.error(
            "Failed to load models:",
            error
          );

          /*
           * Keep previously loaded models instead of
           * replacing them with an empty array.
           *
           * This is important if a temporary IPC/model-service
           * failure occurs.
           */
          setError(
            error?.message ||
              "Unable to load models."
          );

          /*
           * Do NOT start another automatic retry here.
           *
           * The user can explicitly call refreshModels().
           */
        } finally {
          loadingRef.current = false;

          if (
            mountedRef.current &&
            !silent
          ) {
            setIsLoading(false);
          }
        }
      },
      [resolveActiveModel]
    );

  /* ---------------------------------------------------------------------- */
  /* Set active model                                                        */
  /* ---------------------------------------------------------------------- */

  const setActiveModel =
    useCallback(
      async (model) => {
        if (!model) {
          throw new Error(
            "A valid model is required."
          );
        }

        const modelId =
          getModelId(model);

        if (!modelId) {
          throw new Error(
            "The selected model does not have a valid ID."
          );
        }

        try {
          setError(null);

          /*
           * Tell main.js about the active model.
           */
          const result =
            await modelsAPI.setActive(
            modelId,
            model.type || "local",
            model.config ||
              model.modelConfig ||
              null
            );

          if (
            result &&
            result.success === false
          ) {
            throw new Error(
              result.error ||
                "Unable to activate the selected model."
            );
          }

          if (
            !mountedRef.current
          ) {
            return model;
          }

          /*
           * Update UI immediately and refresh the authoritative model list so
           * every component sees the new active selection consistently.
           */
          setCurrentModel(
            model
          );

          await loadModels({
            silent: false,
          });

          return model;
        } catch (error) {
          console.error(
            "Failed to set active model:",
            error
          );

          if (
            mountedRef.current
          ) {
            setError(
              error?.message ||
                "Unable to activate the selected model."
            );
          }

          throw error;
        }
      },
      [loadModels]
    );

  /* ---------------------------------------------------------------------- */
  /* Explicit model refresh                                                  */
  /* ---------------------------------------------------------------------- */

  const refreshModels =
    useCallback(
      async () => {
        /*
         * This is intentionally explicit.
         *
         * There is no setInterval here.
         */
        await loadModels({
          silent: false,
          force: true,
        });
      },
      [loadModels]
    );

  /* ---------------------------------------------------------------------- */
  /* Initial load                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    mountedRef.current = true;

    /*
     * Load once when the provider mounts.
     *
     * There is deliberately NO:
     *
     *   setInterval(loadModels, 10000)
     *
     * because model availability generally changes only after
     * a user action such as upload/delete/install/refresh.
     */
    loadModels({
      silent: false,
    });

    return () => {
      mountedRef.current = false;
    };
  }, [loadModels]);

  /* ---------------------------------------------------------------------- */
  /* Context value                                                           */
  /* ---------------------------------------------------------------------- */

  const value = {
    currentModel,
    availableModels,
    isLoading,
    error,

    setActiveModel,
    refreshModels,

    /*
     * Expose these for components that need to know
     * which transport/application architecture is active.
     */
    isElectron: isElectron(),
  };

  return (
    <ModelContext.Provider
      value={value}
    >
      {children}
    </ModelContext.Provider>
  );
};

export default ModelContext;