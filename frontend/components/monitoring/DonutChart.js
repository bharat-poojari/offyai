import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#0ea5e9",
  "#10b981",
  "#8b5cf6",
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
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {title}
        </h3>

        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-500 text-sm">
            No data available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
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
                backgroundColor:
                  "#1f2937",
                border:
                  "1px solid #374151",
                borderRadius:
                  "8px",
                color:
                  "#f9fafb",
              }}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DonutChart;