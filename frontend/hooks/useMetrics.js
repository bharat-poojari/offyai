import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import {
  METRICS_UPDATE_INTERVAL,
} from "../utils/constants";

/* ============================================================================
 * DEFAULT METRICS
 *
 * null means the metric is unavailable.
 * It must NOT be converted to zero because zero is a real measurement.
 * ========================================================================== */

const createDefaultMetrics = () => ({
  cpu: null,
  memory: null,

  gpu: null,
  gpuAvailable: false,

  temperature: null,
  gpuTemperature: null,
  gpuModel: null,

  model: null,
  modelName: null,

  timestamp: null,

  system: null,
});

/* ============================================================================
 * ELECTRON AVAILABILITY
 * ========================================================================== */

const isElectron =
  typeof window !== "undefined" &&
  typeof window.electronAPI !== "undefined";

/* ============================================================================
 * NUMBER NORMALIZATION
 * ========================================================================== */

const normalizeNumber = (value) => {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  return null;
};

/* ============================================================================
 * METRIC NORMALIZATION
 * ========================================================================== */

const normalizeMetrics = (
  data
) => {
  const defaults =
    createDefaultMetrics();

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return defaults;
  }

  return {
    ...defaults,

    cpu:
      normalizeNumber(
        data.cpu
      ),

    memory:
      normalizeNumber(
        data.memory
      ),

    gpu:
      normalizeNumber(
        data.gpu
      ),

    gpuAvailable:
      data.gpuAvailable === true,

    temperature:
      normalizeNumber(
        data.temperature
      ),

    gpuTemperature:
      normalizeNumber(
        data.gpuTemperature
      ),

    gpuModel:
      typeof data.gpuModel === "string" &&
      data.gpuModel.trim()
        ? data.gpuModel.trim()
        : null,

    model:
      typeof data.model === "string" &&
      data.model.trim()
        ? data.model
        : null,

    modelName:
      typeof data.modelName === "string" &&
      data.modelName.trim()
        ? data.modelName
        : null,

    timestamp:
      typeof data.timestamp === "string"
        ? data.timestamp
        : new Date().toISOString(),

    system:
      data.system &&
      typeof data.system === "object"
        ? data.system
        : null,
  };
};

/* ============================================================================
 * HOOK
 * ========================================================================== */

export const useMetrics = (
  sessionId = null
) => {
  const [
    metrics,
    setMetrics,
  ] = useState(
    createDefaultMetrics()
  );

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    isConnected,
    setIsConnected,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  const intervalRef =
    useRef(null);

  const requestInProgressRef =
    useRef(false);

  const mountedRef =
    useRef(false);

  const pollingRef =
    useRef(false);

  /* ==========================================================================
   * STOP POLLING
   * ======================================================================== */

  const stopPolling =
    useCallback(() => {
      if (
        intervalRef.current !== null
      ) {
        clearInterval(
          intervalRef.current
        );

        intervalRef.current = null;
      }

      pollingRef.current = false;
    }, []);

  /* ==========================================================================
   * FETCH METRICS
   * ======================================================================== */

  const fetchMetrics =
    useCallback(
      async ({
        manual = false,
      } = {}) => {
        if (
          requestInProgressRef.current
        ) {
          return false;
        }

        requestInProgressRef.current =
          true;

        if (
          manual &&
          mountedRef.current
        ) {
          setLoading(true);
        }

        try {
          if (!isElectron) {
            throw new Error(
              "Electron IPC is unavailable. OffyAI must be running inside Electron."
            );
          }

          if (
            typeof window.electronAPI
              .getMetrics !==
            "function"
          ) {
            throw new Error(
              "Electron metrics IPC is unavailable."
            );
          }

          const data =
            await window.electronAPI.getMetrics(
              sessionId
            );

          if (
            !mountedRef.current
          ) {
            return false;
          }

          if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
          ) {
            throw new Error(
              "Invalid metrics response."
            );
          }

          const normalized =
            normalizeMetrics(
              data
            );

          setMetrics(
            normalized
          );

          setIsConnected(true);
          setError(null);

          /*
           * Store only actual successful samples.
           */
          setHistory(
            (previous) => {
              const next = [
                ...previous,
                normalized,
              ];

              return next.slice(-60);
            }
          );

          return true;
        } catch (err) {
          if (
            !mountedRef.current
          ) {
            return false;
          }

          const message =
            err?.message ||
            "Unable to retrieve metrics.";

          console.error(
            "[useMetrics] Failed to fetch metrics:",
            err
          );

          setError(
            message
          );

          setIsConnected(
            false
          );

          /*
           * Keep the last real measurement.
           * Do not replace it with fake zeros.
           */
          setMetrics(
            (previous) => ({
              ...previous,
              timestamp:
                new Date().toISOString(),
            })
          );

          /*
           * Do not manufacture a history point on failure.
           */
          return false;
        } finally {
          requestInProgressRef.current =
            false;

          if (
            mountedRef.current &&
            manual
          ) {
            setLoading(false);
          }
        }
      },
      [sessionId]
    );

  /* ==========================================================================
   * START POLLING
   * ======================================================================== */

  const startPolling =
    useCallback(() => {
      if (
        pollingRef.current
      ) {
        return;
      }

      const configuredInterval =
        Number(
          METRICS_UPDATE_INTERVAL
        );

      const interval =
        Number.isFinite(
          configuredInterval
        ) &&
        configuredInterval >= 1000
          ? configuredInterval
          : 5000;

      pollingRef.current =
        true;

      intervalRef.current =
        setInterval(() => {
          /*
           * A failed sample does not permanently disable real-time
           * monitoring. The next interval gets another real sample.
           */
          void fetchMetrics();
        }, interval);
    }, [fetchMetrics]);

  /* ==========================================================================
   * INITIALIZATION
   * ======================================================================== */

  useEffect(() => {
    mountedRef.current =
      true;

    if (!isElectron) {
      setLoading(false);

      return () => {
        mountedRef.current = false;
        stopPolling();
        requestInProgressRef.current = false;
      };
    }

    const initialize =
      async () => {
        const connected =
          await fetchMetrics({
            manual: true,
          });

        if (
          !mountedRef.current
        ) {
          return;
        }

        /*
         * Start polling regardless of the first result.
         *
         * If the server/system is temporarily unavailable, the next
         * interval will retry rather than requiring a manual refresh.
         */
        startPolling();

        if (!connected) {
          setLoading(false);
        }
      };

    void initialize();

    return () => {
      mountedRef.current =
        false;

      stopPolling();

      requestInProgressRef.current =
        false;
    };
  }, [
    fetchMetrics,
    startPolling,
    stopPolling,
  ]);

  /* ==========================================================================
   * MANUAL REFRESH
   * ======================================================================== */

  const refresh =
    useCallback(
      async () => {
        const connected =
          await fetchMetrics({
            manual: true,
          });

        if (
          mountedRef.current &&
          !pollingRef.current
        ) {
          startPolling();
        }

        return connected;
      },
      [
        fetchMetrics,
        startPolling,
      ]
    );

  /* ==========================================================================
   * RETURN API
   * ======================================================================== */

  return {
    metrics,
    history,
    isConnected,
    loading,
    error,
    refresh,
  };
};

export default useMetrics;