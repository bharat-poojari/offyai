import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { METRICS_UPDATE_INTERVAL } from "../utils/constants";

/* -------------------------------------------------------------------------- */
/* Default metrics                                                            */
/* -------------------------------------------------------------------------- */

const createDefaultMetrics = () => ({
  cpu: 0,
  memory: 0,
  gpu: 0,
  gpuAvailable: false,
  tokensPerSecond: 0,
  responseTimeMs: 0,
  tokensGenerated: 0,
  contextLength: 0,
  model: "",
  modelName: "",
  sessionId: null,
  timestamp: new Date().toISOString(),
});

/* -------------------------------------------------------------------------- */
/* Electron availability                                                      */
/* -------------------------------------------------------------------------- */

const isElectron =
  typeof window !== "undefined" &&
  typeof window.electronAPI !== "undefined";

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export const useMetrics = (sessionId = null) => {
  const [metrics, setMetrics] = useState(
    createDefaultMetrics()
  );

  const [history, setHistory] = useState([]);

  const [isConnected, setIsConnected] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const intervalRef = useRef(null);

  const requestInProgressRef =
    useRef(false);

  const mountedRef =
    useRef(false);

  const pollingRef =
    useRef(false);

  /* ---------------------------------------------------------------------- */
  /* Stop polling                                                           */
  /* ---------------------------------------------------------------------- */

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    pollingRef.current = false;
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Fetch metrics                                                           */
  /* ---------------------------------------------------------------------- */

  const fetchMetrics = useCallback(
    async ({ manual = false } = {}) => {
      /*
       * Prevent concurrent requests.
       */

      if (requestInProgressRef.current) {
        return false;
      }

      requestInProgressRef.current = true;

      if (manual && mountedRef.current) {
        setLoading(true);
      }

      try {
        /*
         * The application is now a static Electron frontend.
         *
         * Therefore metrics MUST go through Electron IPC.
         *
         * Do NOT use:
         *
         *     fetch("/api/...")
         *
         * or:
         *
         *     axios.get("/api/...")
         *
         * because the frontend is loaded through file://.
         */

        if (!isElectron) {
          throw new Error(
            "Electron IPC is unavailable. OffyAI must be running inside Electron."
          );
        }

        if (
          typeof window.electronAPI.getMetrics !==
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

        if (!mountedRef.current) {
          return false;
        }

        /*
         * Validate response.
         */

        if (
          !data ||
          typeof data !== "object" ||
          Array.isArray(data)
        ) {
          throw new Error(
            "Invalid metrics response."
          );
        }

        /*
         * Merge returned metrics with defaults.
         */

        const normalizedMetrics = {
          ...createDefaultMetrics(),
          ...data,
          sessionId:
            data.sessionId ??
            sessionId ??
            null,
          timestamp:
            data.timestamp ||
            new Date().toISOString(),
        };

        setMetrics(
          normalizedMetrics
        );

        setIsConnected(true);
        setError(null);

        /*
         * Add successful sample to history.
         */

        setHistory((previous) => {
          const next = [
            ...previous,
            normalizedMetrics,
          ];

          /*
           * Keep the most recent 60 samples.
           */

          return next.slice(-60);
        });

        return true;
      } catch (err) {
        if (!mountedRef.current) {
          return false;
        }

        const message =
          err?.message ||
          "Unable to retrieve metrics.";

        console.error(
          "Failed to fetch metrics:",
          err
        );

        setError(message);
        setIsConnected(false);

        /*
         * Preserve the last known metrics.
         */

        setMetrics((previous) => ({
          ...previous,
          timestamp:
            new Date().toISOString(),
        }));

        /*
         * Stop polling after failure.
         */

        stopPolling();

        return false;
      } finally {
        requestInProgressRef.current = false;

        if (
          mountedRef.current &&
          manual
        ) {
          setLoading(false);
        }
      }
    },
    [sessionId, stopPolling]
  );

  /* ---------------------------------------------------------------------- */
  /* Start polling                                                           */
  /* ---------------------------------------------------------------------- */

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      return;
    }

    const interval =
      Number(METRICS_UPDATE_INTERVAL);

    const safeInterval =
      Number.isFinite(interval) &&
      interval >= 1000
        ? interval
        : 5000;

    pollingRef.current = true;

    intervalRef.current =
      setInterval(async () => {
        const connected =
          await fetchMetrics();

        if (!connected) {
          stopPolling();
        }
      }, safeInterval);
  }, [
    fetchMetrics,
    stopPolling,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Initial connection + polling                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    mountedRef.current = true;

    let cancelled = false;

    const initialize = async () => {
      const connected =
        await fetchMetrics({
          manual: true,
        });

      if (
        cancelled ||
        !mountedRef.current
      ) {
        return;
      }

      if (connected) {
        startPolling();
      }
    };

    initialize();

    return () => {
      cancelled = true;

      mountedRef.current = false;

      stopPolling();

      requestInProgressRef.current =
        false;
    };
  }, [
    fetchMetrics,
    startPolling,
    stopPolling,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Manual refresh                                                          */
  /* ---------------------------------------------------------------------- */

  const refresh = useCallback(
    async () => {
      const connected =
        await fetchMetrics({
          manual: true,
        });

      if (
        connected &&
        mountedRef.current
      ) {
        startPolling();
      } else if (!connected) {
        stopPolling();
      }

      return connected;
    },
    [
      fetchMetrics,
      startPolling,
      stopPolling,
    ]
  );

  /* ---------------------------------------------------------------------- */
  /* Return API                                                              */
  /* ---------------------------------------------------------------------- */

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