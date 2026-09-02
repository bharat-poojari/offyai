import { useMemo } from "react";
import { PerformanceLineChart } from "./LineChart";
import { DonutChart } from "./DonutChart";

export const RealTimeCharts = ({
  history,
  metrics,
}) => {
  const chartData = useMemo(
    () => (Array.isArray(history) ? history : []),
    [history]
  );

  const dataKeys = useMemo(
    () => [
      { key: "cpu", name: "CPU", color: "#0f9c8f" },
      { key: "memory", name: "Memory", color: "#10b981" },
      ...(metrics?.gpuAvailable
        ? [{ key: "gpu", name: "GPU", color: "#f59e0b" }]
        : []),
    ],
    [metrics?.gpuAvailable]
  );

  const systemUsage = useMemo(
    () => [
      { name: "CPU", value: typeof metrics?.cpu === "number" ? metrics.cpu : null },
      { name: "Memory", value: typeof metrics?.memory === "number" ? metrics.memory : null },
      ...(metrics?.gpuAvailable && typeof metrics?.gpu === "number"
        ? [{ name: "GPU", value: metrics.gpu }]
        : []),
    ],
    [metrics]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PerformanceLineChart
        data={chartData}
        dataKeys={dataKeys}
        title="System Usage Over Time"
        unit="%"
      />

      <DonutChart
        data={systemUsage}
        title="Current System Usage"
        unit="%"
      />
    </div>
  );
};

export default RealTimeCharts;