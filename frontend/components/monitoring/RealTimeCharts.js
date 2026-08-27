import { PerformanceLineChart } from "./LineChart";
import { DonutChart } from "./DonutChart";

export const RealTimeCharts = ({
  history,
  metrics,
}) => {
  const chartData =
    Array.isArray(history)
      ? history
      : [];

  const systemUsage = [
    {
      name: "CPU",
      value:
        typeof metrics?.cpu === "number"
          ? metrics.cpu
          : null,
    },
    {
      name: "Memory",
      value:
        typeof metrics?.memory === "number"
          ? metrics.memory
          : null,
    },
    ...(metrics?.gpuAvailable &&
    typeof metrics?.gpu === "number"
      ? [
          {
            name: "GPU",
            value: metrics.gpu,
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PerformanceLineChart
        data={chartData}
        dataKeys={[
          {
            key: "cpu",
            name: "CPU",
            color: "#3b82f6",
          },
          {
            key: "memory",
            name: "Memory",
            color: "#10b981",
          },
          ...(metrics?.gpuAvailable
            ? [
                {
                  key: "gpu",
                  name: "GPU",
                  color: "#8b5cf6",
                },
              ]
            : []),
        ]}
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