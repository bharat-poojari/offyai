import { PerformanceLineChart } from './LineChart';
import { DonutChart } from './DonutChart';
import { COLORS } from '../../utils/constants';

export const RealTimeCharts = ({ history, metrics }) => {
  // Prepare data for charts
  const tokenDistribution = [
    { name: 'Prompt Tokens', value: metrics.contextLength || 0 },
    { name: 'Completion Tokens', value: metrics.tokensGenerated || 0 },
  ];

  const systemUsage = [
    { name: 'CPU', value: metrics.cpu || 0 },
    { name: 'Memory', value: metrics.memory || 0 },
    { name: 'GPU', value: metrics.gpu || 0 },
  ];

  // Prepare chart data with proper timestamp field
  const prepareChartData = (historyData) => {
    if (!historyData || historyData.length === 0) {
      return [];
    }
    
    return historyData.map((item, index) => ({
      ...item,
      timestamp: item.timestamp || new Date(Date.now() - (historyData.length - index) * 2000).toISOString()
    }));
  };

  const chartData = prepareChartData(history);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PerformanceLineChart
        data={chartData}
        dataKey="tokensPerSecond"
        color={COLORS.primary}
        title="Tokens per Second"
      />
      
      <PerformanceLineChart
        data={chartData}
        dataKey="responseTimeMs"
        color={COLORS.success}
        title="Response Time (ms)"
      />
      
      <DonutChart
        data={tokenDistribution.filter(item => item.value > 0)}
        title="Token Distribution"
      />
      
      <DonutChart
        data={systemUsage.filter(item => item.value > 0)}
        title="System Usage (%)"
      />
    </div>
  );
};