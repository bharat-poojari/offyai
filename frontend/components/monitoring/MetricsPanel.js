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
      background:
        "bg-blue-500/10",
      text:
        "text-blue-500",
    },

    green: {
      background:
        "bg-green-500/10",
      text:
        "text-green-500",
    },

    purple: {
      background:
        "bg-purple-500/10",
      text:
        "text-purple-500",
    },

    orange: {
      background:
        "bg-orange-500/10",
      text:
        "text-orange-500",
    },

    red: {
      background:
        "bg-red-500/10",
      text:
        "text-red-500",
    },

    gray: {
      background:
        "bg-gray-500/10",
      text:
        "text-gray-500",
    },
  };

  const selected =
    colorClasses[color] ||
    colorClasses.gray;

  const displayValue =
    typeof value === "number" &&
    Number.isFinite(value)
      ? value.toFixed(1)
      : "--";

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="bg-gray-800 rounded-xl border border-gray-700 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${selected.background}`}
          >
            <Icon
              className={`w-5 h-5 ${selected.text}`}
            />
          </div>

          <div>
            <div className="text-sm text-gray-400">
              {label}
            </div>

            <div className="text-2xl font-bold text-white">
              {loading ? (
                <div className="w-8 h-6 bg-gray-700 rounded animate-pulse" />
              ) : (
                <>
                  {displayValue}

                  {unit && (
                    <span className="text-sm ml-1 text-gray-400">
                      {unit}
                    </span>
                  )}
                </>
              )}
            </div>

            {subtext && (
              <div className="text-xs text-gray-500 mt-1">
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

const formatModelName = (
  value
) => {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "No model selected";
  }

  return value
    .split(/[\\/]/)
    .pop()
    .replace(
      /\.(gguf|bin|ggml)$/i,
      ""
    )
    .replace(/-/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
};

/* ============================================================================
 * TEMPERATURE STATUS
 * ========================================================================== */

const getTemperatureStatus = (
  temperature
) => {
  if (
    typeof temperature !==
      "number" ||
    !Number.isFinite(
      temperature
    )
  ) {
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

const MetricsPanel = ({
  metrics,
  isConnected,
  loading = false,
}) => {
  const [
    modelName,
    setModelName,
  ] = useState(
    "Loading model..."
  );

  const [
    systemInfo,
    setSystemInfo,
  ] = useState(null);

  /* --------------------------------------------------------------------------
   * LOAD SYSTEM INFORMATION
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    const loadSystemInfo =
      async () => {
        try {
          if (
            typeof window ===
              "undefined" ||
            !window.electronAPI?.getSystemInfo
          ) {
            return;
          }

          const info =
            await window.electronAPI.getSystemInfo();

          if (
            !cancelled
          ) {
            setSystemInfo(
              info
            );
          }
        } catch (error) {
          console.error(
            "[MetricsPanel] Failed to load system info:",
            error
          );
        }
      };

    void loadSystemInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  /* --------------------------------------------------------------------------
   * MODEL NAME
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    const directModel =
      metrics?.modelName ||
      metrics?.model;

    if (directModel) {
      setModelName(
        formatModelName(
          directModel
        )
      );

      return;
    }

    let cancelled = false;

    const loadModelFromSettings =
      async () => {
        try {
          if (
            typeof window ===
              "undefined" ||
            !window.electronAPI?.getSettings
          ) {
            if (
              !cancelled
            ) {
              setModelName(
                "No model selected"
              );
            }

            return;
          }

          const settings =
            await window.electronAPI.getSettings();

          if (
            cancelled
          ) {
            return;
          }

          const configuredModel =
            settings?.activeModel
              ?.name ||
            settings?.activeModel
              ?.id ||
            settings?.model ||
            null;

          setModelName(
            formatModelName(
              configuredModel
            )
          );
        } catch (error) {
          if (
            !cancelled
          ) {
            console.error(
              "[MetricsPanel] Failed to load model:",
              error
            );

            setModelName(
              "Unable to determine model"
            );
          }
        }
      };

    void loadModelFromSettings();

    return () => {
      cancelled = true;
    };
  }, [
    metrics?.model,
    metrics?.modelName,
  ]);

  /* --------------------------------------------------------------------------
   * CONNECTION / LOADING
   * ------------------------------------------------------------------------ */

  if (
    !isConnected &&
    loading
  ) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <LoadingSpinner
          size="lg"
          className="mx-auto mb-4"
        />

        <div className="text-gray-400">
          Loading real-time system metrics...
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------------------
   * VALUES
   * ------------------------------------------------------------------------ */

  const cpuCores =
    systemInfo?.cpu?.cores;

  const totalMemory =
    systemInfo?.memory?.total;

  const totalMemoryGB =
    typeof totalMemory ===
      "number" &&
    Number.isFinite(
      totalMemory
    )
      ? (
          totalMemory /
          1024 /
          1024 /
          1024
        ).toFixed(1)
      : null;

  const cpuTemperatureStatus =
    getTemperatureStatus(
      metrics?.temperature
    );

  const gpuTemperatureStatus =
    getTemperatureStatus(
      metrics?.gpuTemperature
    );

  return (
    <div className="space-y-6">
      {/* ====================================================================
          MODEL
          ================================================================== */}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Box className="w-6 h-6 text-purple-500" />
          </div>

          <div>
            <div className="text-sm text-gray-400">
              Current Model
            </div>

            <div className="text-xl font-bold text-white">
              {modelName}
            </div>

            <div className="text-sm text-gray-400 mt-1">
              Model information comes from the active application configuration.
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          REAL-TIME SYSTEM METRICS
          ================================================================== */}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-green-500" />

          <h3 className="text-lg font-semibold text-white">
            Real-time System Usage
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={Cpu}
            label="CPU Usage"
            value={metrics?.cpu}
            unit="%"
            color="blue"
            loading={loading}
            subtext={
              cpuCores
                ? `${cpuCores} cores`
                : undefined
            }
          />

          <MetricCard
            icon={MemoryStick}
            label="Memory Usage"
            value={metrics?.memory}
            unit="%"
            color="green"
            loading={loading}
            subtext={
              totalMemoryGB
                ? `${totalMemoryGB} GB total`
                : undefined
            }
          />

          {metrics?.gpuAvailable && (
            <MetricCard
              icon={CpuIcon}
              label="GPU Usage"
              value={metrics?.gpu}
              unit="%"
              color="purple"
              loading={loading}
              subtext={
                metrics?.gpuModel ||
                "GPU detected"
              }
            />
          )}

          <MetricCard
            icon={Monitor}
            label="GPU Status"
            value={
              metrics?.gpuAvailable
                ? 100
                : 0
            }
            unit="%"
            color={
              metrics?.gpuAvailable
                ? "green"
                : "gray"
            }
            loading={loading}
            subtext={
              metrics?.gpuAvailable
                ? "Available"
                : "Not available"
            }
          />
        </div>
      </div>

      {/* ====================================================================
          TEMPERATURES
          ================================================================== */}

      {(typeof metrics?.temperature ===
        "number" ||
        typeof metrics?.gpuTemperature ===
          "number") && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-orange-500" />

            <h3 className="text-lg font-semibold text-white">
              Temperature Monitoring
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {typeof metrics?.temperature ===
              "number" && (
              <MetricCard
                icon={Thermometer}
                label="CPU Temperature"
                value={
                  metrics.temperature
                }
                unit="°C"
                color="orange"
                loading={loading}
                subtext={
                  cpuTemperatureStatus ||
                  undefined
                }
              />
            )}

            {metrics?.gpuAvailable &&
              typeof metrics?.gpuTemperature ===
                "number" && (
                <MetricCard
                  icon={Thermometer}
                  label="GPU Temperature"
                  value={
                    metrics.gpuTemperature
                  }
                  unit="°C"
                  color="red"
                  loading={loading}
                  subtext={
                    gpuTemperatureStatus ||
                    undefined
                  }
                />
              )}
          </div>
        </div>
      )}

      {/* ====================================================================
          CONNECTION / SYSTEM STATUS
          ================================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-blue-500" />

            <h3 className="text-lg font-semibold text-white">
              Metrics Status
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                Metrics IPC
              </span>

              <span
                className={`font-medium ${
                  isConnected
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {isConnected
                  ? "Connected"
                  : "Disconnected"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                GPU
              </span>

              <span
                className={`font-medium ${
                  metrics?.gpuAvailable
                    ? "text-green-500"
                    : "text-gray-500"
                }`}
              >
                {metrics?.gpuAvailable
                  ? "Available"
                  : "Unavailable"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                Last Update
              </span>

              <span className="text-white font-medium text-sm">
                {metrics?.timestamp
                  ? new Date(
                      metrics.timestamp
                    ).toLocaleTimeString()
                  : "--"}
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================================
            SYSTEM INFORMATION
            ============================================================== */}

        {systemInfo && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-purple-500" />

              <h3 className="text-lg font-semibold text-white">
                System Information
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-400">
                  CPU
                </span>

                <span className="text-white font-medium text-sm text-right">
                  {systemInfo.cpu?.brand ||
                    "Unknown"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  Cores
                </span>

                <span className="text-white font-medium">
                  {systemInfo.cpu?.cores ||
                    "--"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  Memory
                </span>

                <span className="text-white font-medium">
                  {totalMemoryGB
                    ? `${totalMemoryGB} GB`
                    : "--"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  Platform
                </span>

                <span className="text-white font-medium">
                  {systemInfo.platform ||
                    metrics?.system?.platform ||
                    "--"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  Architecture
                </span>

                <span className="text-white font-medium">
                  {systemInfo.arch ||
                    metrics?.system?.arch ||
                    "--"}
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