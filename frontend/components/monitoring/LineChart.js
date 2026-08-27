import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const normalizeTimestamp = (
  timestamp
) => {
  if (
    typeof timestamp === "number" ||
    typeof timestamp === "string"
  ) {
    return timestamp;
  }

  return null;
};

const formatTime = (
  timestamp
) => {
  try {
    const date =
      new Date(timestamp);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "--";
    }

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  } catch (error) {
    return "--";
  }
};

export const PerformanceLineChart = ({
  data,
  dataKey,
  dataKeys,
  color,
  title,
  unit = "",
}) => {
  const sourceData =
    Array.isArray(data)
      ? data
      : [];

  /*
   * Backwards-compatible single-series support.
   */
  const series =
    Array.isArray(dataKeys) &&
    dataKeys.length > 0
      ? dataKeys
      : dataKey
        ? [
            {
              key: dataKey,
              name: title,
              color,
            },
          ]
        : [];

  if (
    sourceData.length === 0 ||
    series.length === 0
  ) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
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

  const chartData =
    sourceData
      .map((item) => {
        const timestamp =
          normalizeTimestamp(
            item?.timestamp
          );

        if (
          timestamp === null
        ) {
          return null;
        }

        const normalized = {
          timestamp,
        };

        series.forEach(
          (metric) => {
            const value =
              item?.[
                metric.key
              ];

            normalized[
              metric.key
            ] =
              typeof value ===
                "number" &&
              Number.isFinite(value)
                ? value
                : null;
          }
        );

        return normalized;
      })
      .filter(Boolean);

  if (
    chartData.length === 0
  ) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
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
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">
        {title}
      </h3>

      <div className="h-64">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 20,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
            />

            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="#9ca3af"
              fontSize={12}
              interval="preserveStartEnd"
            />

            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              domain={[
                0,
                100,
              ]}
              tickFormatter={(value) =>
                `${value}${unit}`
              }
            />

            <Tooltip
              formatter={(
                value,
                name
              ) => {
                if (
                  value === null ||
                  value === undefined
                ) {
                  return [
                    "--",
                    name,
                  ];
                }

                return [
                  `${Number(value).toFixed(1)}${unit}`,
                  name,
                ];
              }}
              labelFormatter={
                formatTime
              }
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

            {series.length > 1 && (
              <Legend />
            )}

            {series.map(
              (metric) => (
                <Line
                  key={
                    metric.key
                  }
                  type="monotone"
                  dataKey={
                    metric.key
                  }
                  name={
                    metric.name ||
                    metric.key
                  }
                  stroke={
                    metric.color ||
                    "#3b82f6"
                  }
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  activeDot={{
                    r: 4,
                    fill:
                      metric.color ||
                      "#3b82f6",
                  }}
                />
              )
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceLineChart;