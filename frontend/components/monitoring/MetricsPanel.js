import {
  useState,
  useEffect,
} from "react";

import { motion } from "framer-motion";

import {
  Cpu,
  MemoryStick,
  CpuIcon,
  Box,
  Activity,
  Thermometer,
  Server,
  Monitor,
} from "lucide-react";

import LoadingSpinner from "../ui/LoadingSpinner";

/* ============================================================================
 * METRIC CARD
 * ========================================================================== */

const MetricCard = ({
  icon: Icon,
  label,
  value,
  unit = "",
  color = "gray",
  loading = false,
  subtext,
}) => {
  const colorClasses = {
    blue: {
    background: "bg-[var(--accent-subtle)]",
    text: "text-[var(--primary)]",
    },

    green: {
      background: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
    },

    purple: {
      background: "bg-violet-500/10",
      text: "text-violet-600 dark:text-violet-400",
    },

    orange: {
      background: "bg-orange-500/10",
      text: "text-orange-600 dark:text-orange-400",
    },

    red: {
      background: "bg-red-500/10",
      text: "text-red-600 dark:text-red-400",
    },

    gray: {
      background: "bg-[var(--surface-raised)]",
      text: "text-[var(--text-secondary)]",
    },
  };

  const selected = colorClasses[color] || colorClasses.gray;

  const displayValue =
    typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "--";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-colors duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${selected.background}`}>
            <Icon className={`h-5 w-5 ${selected.text}`} />
          </div>

          <div>
            <div className="text-sm text-[var(--text-secondary)]">
              {label}
            </div>

            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {loading ? (
                <div className="h-6 w-8 animate-pulse rounded bg-[var(--surface-raised)]" />
              ) : (
                <>
                  {displayValue}

                  {unit && (
                    <span className="ml-1 text-sm text-[var(--text-secondary)]">
                      {unit}
                    </span>
                  )}
                </>
              )}
            </div>

            {subtext && (
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {subtext}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ============================================================================
 * MODEL NAME
 * ========================================================================== */

const formatModelName = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "No model selected";
  }

  return value
    .split(/[\\/]/)
    .pop()
    .replace(/\.(gguf|bin|ggml)$/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

/* ============================================================================
 * TEMPERATURE STATUS
 * ========================================================================== */

const getTemperatureStatus = (temperature) => {
  if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
    return null;
  }

  if (temperature >= 80) {
    return "High";
  }

  if (temperature >= 60) {
    return "Warm";
  }

  return "Normal";
};

/* ============================================================================
 * METRICS PANEL
 * ========================================================================== */

const MetricsPanel = ({ metrics, isConnected, loading = false }) => {
  const [modelName, setModelName] = useState("Loading model...");
  const [systemInfo, setSystemInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadSystemInfo = async () => {
      try {
        if (typeof window === "undefined" || !window.electronAPI?.getSystemInfo) {
          return;
        }

        const info = await window.electronAPI.getSystemInfo();

        if (!cancelled) {
          setSystemInfo(info);
        }
      } catch (error) {
        console.error("[MetricsPanel] Failed to load system info:", error);
      }
    };

    void loadSystemInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const directModel = metrics?.modelName || metrics?.model;

    if (directModel) {
      setModelName(formatModelName(directModel));
      return;
    }

    let cancelled = false;

    const loadModelFromSettings = async () => {
      try {
        if (typeof window === "undefined" || !window.electronAPI?.getSettings) {
          if (!cancelled) {
            setModelName("No model selected");
          }

          return;
        }

        const settings = await window.electronAPI.getSettings();

        if (cancelled) {
          return;
        }

        const configuredModel =
          settings?.activeModel?.name ||
          settings?.activeModel?.id ||
          settings?.model ||
          null;

        setModelName(formatModelName(configuredModel));
      } catch (error) {
        if (!cancelled) {
          console.error("[MetricsPanel] Failed to load model:", error);
          setModelName("Unable to determine model");
        }
      }
    };

    void loadModelFromSettings();

    return () => {
      cancelled = true;
    };
  }, [metrics?.model, metrics?.modelName]);

  if (!isConnected && loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />

        <div className="text-[var(--text-secondary)]">
          Loading real-time system metrics...
        </div>
      </div>
    );
  }

  const cpuCores = systemInfo?.cpu?.cores;
  const totalMemory = systemInfo?.memory?.total;
  const totalMemoryGB =
    typeof totalMemory === "number" && Number.isFinite(totalMemory)
      ? (totalMemory / 1024 / 1024 / 1024).toFixed(1)
      : null;

  const cpuTemperatureStatus = getTemperatureStatus(metrics?.temperature);
  const gpuTemperatureStatus = getTemperatureStatus(metrics?.gpuTemperature);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-violet-500/10 p-2">
            <Box className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>

          <div>
            <div className="text-sm text-[var(--text-secondary)]">
              Current Model
            </div>

            <div className="text-xl font-bold text-[var(--text-primary)]">
              {modelName}
            </div>

            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              Model information comes from the active application configuration.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-200">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-500" />

          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Real-time System Usage
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <MetricCard
            icon={Cpu}
            label="CPU Usage"
            value={metrics?.cpu}
            unit="%"
            color="blue"
            loading={loading}
            subtext={cpuCores ? `${cpuCores} cores` : undefined}
          />

          <MetricCard
            icon={MemoryStick}
            label="Memory Usage"
            value={metrics?.memory}
            unit="%"
            color="green"
            loading={loading}
            subtext={totalMemoryGB ? `${totalMemoryGB} GB total` : undefined}
          />

          {metrics?.gpuAvailable && (
            <MetricCard
              icon={CpuIcon}
              label="GPU Usage"
              value={metrics?.gpu}
              unit="%"
              color="purple"
              loading={loading}
              subtext={metrics?.gpuModel || "GPU detected"}
            />
          )}

          <MetricCard
            icon={Monitor}
            label="GPU Status"
            value={metrics?.gpuAvailable ? 100 : 0}
            unit="%"
            color={metrics?.gpuAvailable ? "green" : "gray"}
            loading={loading}
            subtext={metrics?.gpuAvailable ? "Available" : "Not available"}
          />
        </div>
      </div>

      {(typeof metrics?.temperature === "number" || typeof metrics?.gpuTemperature === "number") && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-200">
          <div className="mb-4 flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-orange-500" />

            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Temperature Monitoring
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {typeof metrics?.temperature === "number" && (
              <MetricCard
                icon={Thermometer}
                label="CPU Temperature"
                value={metrics.temperature}
                unit="°C"
                color="orange"
                loading={loading}
                subtext={cpuTemperatureStatus || undefined}
              />
            )}

            {metrics?.gpuAvailable && typeof metrics?.gpuTemperature === "number" && (
              <MetricCard
                icon={Thermometer}
                label="GPU Temperature"
                value={metrics.gpuTemperature}
                unit="°C"
                color="red"
                loading={loading}
                subtext={gpuTemperatureStatus || undefined}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-200">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-[var(--primary)]" />

            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Metrics Status
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Metrics IPC</span>

              <span className={`font-medium ${isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">GPU</span>

              <span className={`font-medium ${metrics?.gpuAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-secondary)]"}`}>
                {metrics?.gpuAvailable ? "Available" : "Unavailable"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Last Update</span>

              <span className="text-sm font-medium text-[var(--text-primary)]">
                {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : "--"}
              </span>
            </div>
          </div>
        </div>

        {systemInfo && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-200">
            <div className="mb-4 flex items-center gap-2">
              <Monitor className="h-5 w-5 text-[var(--primary)]" />

              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                System Information
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <span className="text-[var(--text-secondary)]">CPU</span>

                <span className="text-right text-sm font-medium text-[var(--text-primary)]">
                  {systemInfo.cpu?.brand || "Unknown"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Cores</span>

                <span className="font-medium text-[var(--text-primary)]">
                  {systemInfo.cpu?.cores || "--"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Memory</span>

                <span className="font-medium text-[var(--text-primary)]">
                  {totalMemoryGB ? `${totalMemoryGB} GB` : "--"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Platform</span>

                <span className="font-medium text-[var(--text-primary)]">
                  {systemInfo.platform || metrics?.system?.platform || "--"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Architecture</span>

                <span className="font-medium text-[var(--text-primary)]">
                  {systemInfo.arch || metrics?.system?.arch || "--"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsPanel;