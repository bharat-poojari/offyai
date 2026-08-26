import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const PerformanceLineChart = ({ data, dataKey, color, title }) => {
  // If no data, show placeholder
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-500 text-sm">No data available</div>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return timestamp;
    }
  };

  // Prepare chart data - ensure we have valid numbers
  const chartData = data.map(item => ({
    ...item,
    [dataKey]: typeof item[dataKey] === 'number' ? item[dataKey] : 0,
    timestamp: item.timestamp || new Date().toISOString()
  }));

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
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
              domain={[0, 'auto']}
            />
            <Tooltip
              formatter={(value) => [value?.toFixed?.(2) || value, title]}
              labelFormatter={formatTime}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f9fafb'
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};