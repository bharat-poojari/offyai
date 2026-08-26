import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, Gauge, CpuIcon, Database, Clock, Box, Activity, Thermometer, Zap, HardDrive } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';

const MetricCard = ({ icon: Icon, label, value, unit, color, loading = false, subtext }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gray-800 rounded-xl border border-gray-700 p-4"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          color === 'blue' ? 'bg-blue-500/10' : 
          color === 'green' ? 'bg-green-500/10' : 
          color === 'purple' ? 'bg-purple-500/10' : 
          color === 'orange' ? 'bg-orange-500/10' : 
          color === 'red' ? 'bg-red-500/10' : 
          'bg-gray-500/10'
        }`}>
          <Icon className={`w-5 h-5 ${
            color === 'blue' ? 'text-blue-500' : 
            color === 'green' ? 'text-green-500' : 
            color === 'purple' ? 'text-purple-500' : 
            color === 'orange' ? 'text-orange-500' : 
            color === 'red' ? 'text-red-500' : 
            'text-gray-500'
          }`} />
        </div>
        <div>
          <div className="text-sm text-gray-400">{label}</div>
          <div className="text-2xl font-bold text-white">
            {loading ? (
              <div className="w-8 h-6 bg-gray-700 rounded animate-pulse"></div>
            ) : (
              <>
                {value !== undefined && value !== null ? value.toFixed(1) : '--'}
                {unit && <span className="text-sm ml-1 text-gray-400">{unit}</span>}
              </>
            )}
          </div>
          {subtext && (
            <div className="text-xs text-gray-500 mt-1">{subtext}</div>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);

const MetricsPanel = ({ metrics, isConnected, loading = false }) => {
  const [modelName, setModelName] = useState("Loading model...");
  const [systemInfo, setSystemInfo] = useState(null);

  useEffect(() => {
    const loadModelName = async () => {
      try {
        // First try to get from metrics
        if (metrics.modelName && metrics.modelName !== "unknown" && metrics.modelName !== "Unknown Model") {
          const name = metrics.modelName
            .replace(/\.(gguf|bin|ggml)$/i, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase());
          setModelName(name);
          return;
        }

        if (metrics.model && metrics.model !== "unknown") {
          const name = metrics.model.split(/[\\/]/).pop()
            .replace(/\.(gguf|bin|ggml)$/i, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase());
          setModelName(name);
          return;
        }

        // Fallback to getting from electron API settings
        if (window.electronAPI?.getSettings) {
          const settings = await window.electronAPI.getSettings();
          let name = "No model selected";
          
          if (settings.activeModel) {
            name = settings.activeModel.name || settings.activeModel.id;
          } else if (settings.model) {
            name = settings.model;
          }
          
          // Format the name
          name = name
            .replace(/\.(gguf|bin|ggml)$/i, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase());
          
          setModelName(name);
        } else {
          setModelName("No model selected");
        }
      } catch (error) {
        console.error("Failed to load model name:", error);
        setModelName("Error loading model");
      }
    };

    const loadSystemInfo = async () => {
      try {
        if (window.electronAPI?.getSystemInfo) {
          const info = await window.electronAPI.getSystemInfo();
          setSystemInfo(info);
        }
      } catch (error) {
        console.error("Failed to load system info:", error);
      }
    };

    loadModelName();
    loadSystemInfo();
  }, [metrics.model, metrics.modelName]);

  if (!isConnected || loading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <div className="text-gray-400">
          {loading ? "Loading metrics..." : "Connecting to metrics server..."}
        </div>
      </div>
    );
  }

  // Calculate performance status
  const getPerformanceStatus = () => {
    if (metrics.tokensPerSecond > 20) return { status: 'Fast', color: 'text-green-500', bg: 'bg-green-500' };
    if (metrics.tokensPerSecond > 10) return { status: 'Moderate', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    return { status: 'Slow', color: 'text-red-500', bg: 'bg-red-500' };
  };

  const performanceStatus = getPerformanceStatus();

  return (
    <div className="space-y-6">
      {/* Model Info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Box className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <div className="text-sm text-gray-400">Current Model</div>
            <div className="text-xl font-bold text-white">{modelName}</div>
            <div className="text-sm text-gray-400">
              Context: {metrics.contextLength > 0 ? metrics.contextLength.toLocaleString() : 'Unknown'} tokens
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Performance Metrics */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-white">Real-time Performance</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard 
            icon={Cpu} 
            label="CPU Usage" 
            value={metrics.cpu} 
            unit="%" 
            color="blue" 
            loading={loading}
            subtext={`${systemInfo?.cpu?.cores || '?'} cores`}
          />
          <MetricCard 
            icon={MemoryStick} 
            label="Memory" 
            value={metrics.memory} 
            unit="%" 
            color="green" 
            loading={loading}
            subtext={`${systemInfo?.memory ? (systemInfo.memory.total / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '?'} total`}
          />
          <MetricCard 
            icon={CpuIcon} 
            label="GPU Usage" 
            value={metrics.gpu} 
            unit="%" 
            color="purple" 
            loading={loading}
            subtext={metrics.gpuAvailable ? 'Available' : 'Not available'}
          />
          <MetricCard 
            icon={Gauge} 
            label="Tokens/sec" 
            value={metrics.tokensPerSecond} 
            color="orange" 
            loading={loading}
            subtext={performanceStatus.status}
          />
          <MetricCard 
            icon={Clock} 
            label="Response Time" 
            value={metrics.responseTimeMs} 
            unit="ms" 
            color="red" 
            loading={loading}
          />
          <MetricCard 
            icon={Database} 
            label="Total Tokens" 
            value={metrics.tokensGenerated} 
            color="blue" 
            loading={loading}
          />
        </div>
      </div>

      {/* Temperature Monitoring */}
      {(metrics.temperature > 0 || metrics.gpuTemperature > 0) && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-white">Temperature Monitoring</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.temperature > 0 && (
              <MetricCard 
                icon={Thermometer} 
                label="CPU Temperature" 
                value={metrics.temperature} 
                unit="°C" 
                color="orange" 
                loading={loading}
                subtext={metrics.temperature > 80 ? 'High' : metrics.temperature > 60 ? 'Warm' : 'Normal'}
              />
            )}
            {metrics.gpuTemperature > 0 && (
              <MetricCard 
                icon={Thermometer} 
                label="GPU Temperature" 
                value={metrics.gpuTemperature} 
                unit="°C" 
                color="red" 
                loading={loading}
                subtext={metrics.gpuTemperature > 80 ? 'High' : metrics.gpuTemperature > 60 ? 'Warm' : 'Normal'}
              />
            )}
          </div>
        </div>
      )}

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Generation Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tokens Generated</span>
              <span className="text-white font-medium">
                {metrics.tokensGenerated > 0 ? metrics.tokensGenerated.toLocaleString() : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Avg Response Time</span>
              <span className="text-white font-medium">
                {metrics.responseTimeMs > 0 ? `${metrics.responseTimeMs.toFixed(0)} ms` : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tokens per Second</span>
              <span className="text-white font-medium">
                {metrics.tokensPerSecond > 0 ? metrics.tokensPerSecond.toFixed(1) : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Context Length</span>
              <span className="text-white font-medium">
                {metrics.contextLength > 0 ? metrics.contextLength.toLocaleString() : '--'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">GPU Available</span>
              <span className={`font-medium ${metrics.gpuAvailable ? 'text-green-500' : 'text-red-500'}`}>
                {metrics.gpuAvailable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Connection</span>
              <span className={`font-medium ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Platform</span>
              <span className="text-white font-medium text-sm">
                {metrics.system?.platform || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Last Update</span>
              <span className="text-white font-medium text-sm">
                {metrics.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Status */}
      {metrics.tokensPerSecond > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Performance Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Speed</span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${performanceStatus.bg}`}></div>
                <span className={`font-medium ${performanceStatus.color}`}>
                  {performanceStatus.status}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${performanceStatus.bg}`}
                style={{ 
                  width: `${Math.min(metrics.tokensPerSecond * 5, 100)}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Slow</span>
              <span>Moderate</span>
              <span>Fast</span>
            </div>
          </div>
        </div>
      )}

      {/* System Information */}
      {systemInfo && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-400">CPU</div>
              <div className="text-white font-medium">
                {systemInfo.cpu?.brand || 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Cores</div>
              <div className="text-white font-medium">
                {systemInfo.cpu?.cores || '?'}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Memory</div>
              <div className="text-white font-medium">
                {systemInfo.memory ? `${(systemInfo.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Platform</div>
              <div className="text-white font-medium">
                {systemInfo.platform} {systemInfo.arch}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricsPanel;