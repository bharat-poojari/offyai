import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#0f9c8f",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

export const DonutChart = ({
  data,
  title,
  unit = "",
}) => {
  const validData =
    Array.isArray(data)
      ? data.filter(
          (item) =>
            item &&
            typeof item.value ===
              "number" &&
            Number.isFinite(
              item.value
            ) &&
            item.value > 0
        )
      : [];

  if (
    validData.length === 0
  ) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-200">
        <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h3>

        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-[var(--text-secondary)]">
            No data available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-200">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        {title}
      </h3>

      <div className="h-64">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>
            <Pie
              data={validData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({
                name,
                percent,
              }) =>
                `${name}: ${(
                  percent * 100
                ).toFixed(0)}%`
              }
            >
              {validData.map(
                (entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      COLORS[
                        index %
                          COLORS.length
                      ]
                    }
                  />
                )
              )}
            </Pie>

            <Tooltip
              formatter={(
                value,
                name
              ) => [
                `${Number(value).toFixed(1)}${unit}`,
                name,
              ]}
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius:
                  "8px",
                color: "var(--text-primary)",
              }}
            />

            <Legend
              wrapperStyle={{
                color: "var(--text-secondary)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DonutChart;