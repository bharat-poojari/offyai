import React, { useState, useEffect } from "react";
import { 
  X, Save, Upload, Server, Cpu, Download, Plus, Trash2, RefreshCw, CheckCircle, 
  AlertCircle, Wifi, FolderOpen, Moon, Sun, Monitor, Settings as SettingsIcon, 
  Shield, MessageSquare, Palette, Zap, Eye, EyeOff, Memory, CpuIcon, Gauge, 
  HardDrive, Network, Battery, Thermometer, Volume2, VolumeX, Bell, BellOff, 
  Keyboard, Mouse, Languages, Globe, Lock, Unlock, Shield as ShieldIcon, 
  Trash, Clock, Database, User, Users, Key, FileText, Archive, Smartphone, 
  Tablet, Monitor as MonitorIcon, Maximize2, Minimize2, Type, Image, Layout, 
  Sidebar, Eye as EyeIcon, Code, Terminal, Cloud, CloudOff, DownloadCloud, 
  UploadCloud, WifiOff, Ethernet, Bluetooth, Cctv, Fingerprint, Scan
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { modelsAPI, systemAPI } from "../../utils/api";
import { useModel } from "../../contexts/ModelContext";

const SettingsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("general");
  const [localModels, setLocalModels] = useState([]);
  const [remoteModels, setRemoteModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [showApiKey, setShowApiKey] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [serverStatus, setServerStatus] = useState({ backend: false, llama: false });
  const [performanceMetrics, setPerformanceMetrics] = useState({});
  
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { currentModel, setActiveModel, refreshModels } = useModel();
  
  const [settings, setSettings] = useState({
    apiKey: "",
    serverUrl: "http://localhost:8080",
    model: "gpt2-124m-fresh-Q8_0",
    theme: "system",
    performance: {
      lowMemoryMode: false,
      maxMemoryUsage: 2048,
      cpuThreads: 4,
      enableHardwareAcceleration: true,
      gpuLayers: 0,
      batchSize: 512,
      contextSize: 4096,
      flashAttention: false,
      quantize: "q4_0",
      cacheSize: 2048,
      prefetch: true,
      mmap: true,
      mlock: false
    },
    chat: {
      maxTokens: 4000,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      contextWindow: 4096,
      streamResponses: true,
      showTypingIndicator: true,
      autoContinue: false,
      retryAttempts: 3,
      timeout: 30000,
      systemPrompt: "You are a helpful AI assistant.",
      enableMarkdown: true,
      enableCodeHighlighting: true,
      showTokenCount: true,
      autoScroll: true,
      soundEnabled: true,
      notificationEnabled: false,
      typingSpeed: 50,
      responseDelay: 0
    },
    ui: {
      fontSize: 14,
      compactMode: false,
      showTimestamps: true,
      smoothScrolling: true,
      reduceAnimations: false,
      sidebarPosition: 'left',
      messageBubbles: true,
      avatarStyle: 'default',
      colorScheme: 'blue',
      density: 'comfortable',
      fontFamily: 'Inter',
      lineHeight: 1.5,
      borderRadius: 8,
      shadowIntensity: 'medium',
      highlightColor: '#3b82f6',
      backgroundType: 'solid',
      customBackground: '',
      sidebarWidth: 280,
      panelOpacity: 95,
      hoverEffects: true,
      focusRing: true,
      tooltipDelay: 500
    },
    security: {
      autoClearHistory: false,
      autoClearInterval: 24,
      secureMode: false,
      encryptLocalData: true,
      clearOnExit: false,
      sessionTimeout: 60,
      requireAuth: false,
      twoFactorAuth: false,
      auditLogging: true,
      dataRetention: 365,
      privacyMode: false,
      blockTracking: true,
      vpnMode: false,
      contentFilter: 'standard',
      allowedDomains: [],
      blockedDomains: [],
      maxFileSize: 100,
      allowedFileTypes: ['image/*', 'text/*', 'application/pdf'],
      autoUpdate: true,
      backupEnabled: true,
      backupInterval: 24
    },
    system: {
      language: 'en',
      region: 'US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      weekStart: 'sunday',
      measurementSystem: 'metric',
      keyboardLayout: 'us',
      mouseSpeed: 50,
      scrollSpeed: 50,
      powerMode: 'balanced',
      sleepDelay: 30,
      hibernateDelay: 120,
      notifications: true,
      soundEffects: true,
      autoStart: false,
      updateChannel: 'stable',
      logLevel: 'info',
      debugMode: false,
      performanceMode: false,
      hardwareAcceleration: true
    }
  });

  // Load settings and data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadModels();
      testConnection();
      loadSystemInfo();
      checkServerStatus();
      loadPerformanceMetrics();
    }
  }, [isOpen]);

  const showMessage = (type, text, duration = 5000) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), duration);
  };

  const loadSystemInfo = async () => {
    try {
      if (window.electronAPI?.getSystemInfo) {
        const info = await window.electronAPI.getSystemInfo();
        setSystemInfo(info);
      } else {
        const info = await systemAPI.getInfo();
        setSystemInfo(info);
      }
    } catch (error) {
      console.error("Failed to load system info:", error);
    }
  };

  const loadPerformanceMetrics = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/metrics/realtime`);
      if (response.ok) {
        const metrics = await response.json();
        setPerformanceMetrics(metrics);
      }
    } catch (error) {
      console.error("Failed to load performance metrics:", error);
    }
  };

  const checkServerStatus = async () => {
    try {
      if (window.electronAPI?.getServerStatus) {
        const status = await window.electronAPI.getServerStatus();
        setServerStatus(status);
      } else {
        const status = await systemAPI.getServerStatus();
        setServerStatus(status);
      }
    } catch (error) {
      console.error("Failed to check server status:", error);
    }
  };

  const loadSettings = async () => {
    try {
      let savedSettings = {};
      if (window.electronAPI?.getSettings) {
        savedSettings = await window.electronAPI.getSettings();
      } else {
        // Fallback to localStorage
        const localSettings = localStorage.getItem('offyai_settings');
        if (localSettings) {
          savedSettings = JSON.parse(localSettings);
        }
      }
      
      setSettings(prev => ({
        ...prev,
        ...savedSettings,
        performance: {
          ...prev.performance,
          ...savedSettings.performance
        },
        chat: {
          ...prev.chat,
          ...savedSettings.chat
        },
        ui: {
          ...prev.ui,
          ...savedSettings.ui
        },
        security: {
          ...prev.security,
          ...savedSettings.security
        },
        system: {
          ...prev.system,
          ...savedSettings.system
        }
      }));
    } catch (err) {
      console.error("Failed to load settings:", err);
      showMessage('error', 'Failed to load settings');
    }
  };

  const loadModels = async () => {
    try {
      setLoading(true);
      
      // Load from backend API
      const response = await modelsAPI.list();
      const models = response.data || [];
      setLocalModels(models.filter(m => m.type === 'local'));
      setRemoteModels(models.filter(m => m.type === 'remote'));
      
    } catch (error) {
      console.error("Failed to load models:", error);
      showMessage('error', `Failed to load models: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setConnectionStatus('testing');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/health`);
      
      if (response.ok) {
        setConnectionStatus('connected');
        showMessage('success', 'Connection test successful!');
      } else {
        setConnectionStatus('error');
        showMessage('error', `Connection failed: ${response.status}`);
      }
    } catch (error) {
      setConnectionStatus('error');
      showMessage('error', `Connection test failed: ${error.message}`);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      // Validate settings
      if (!settings.serverUrl) {
        showMessage('error', 'Server URL is required');
        return;
      }
      
      // Save settings
      if (window.electronAPI?.saveSettings) {
        await window.electronAPI.saveSettings(settings);
      } else {
        // Fallback to localStorage
        localStorage.setItem('offyai_settings', JSON.stringify(settings));
      }
      
      showMessage('success', 'Settings saved successfully');
      
      // Test connection after saving
      await testConnection();
      await checkServerStatus();
      
    } catch (err) {
      console.error("Failed to save settings:", err);
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setSettings(prev => ({ ...prev, theme: newTheme }));
    setTheme(newTheme);
  };

  const handleRestartLlamaServer = async () => {
    try {
      setLoading(true);
      if (window.electronAPI?.restartLlamaServer) {
        const result = await window.electronAPI.restartLlamaServer();
        if (result.success) {
          showMessage('success', 'Llama server restarted successfully');
          await checkServerStatus();
        } else {
          showMessage('error', result.error || 'Failed to restart llama server');
        }
      } else {
        showMessage('error', 'Llama server restart not available in browser');
      }
    } catch (error) {
      console.error("Failed to restart llama server:", error);
      showMessage('error', 'Failed to restart llama server');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActiveModel = async (model, modelType = "local") => {
    try {
      setLoading(true);
      
      // Update via backend API
      await modelsAPI.setActive(model.id, modelType);
      
      // Update local state
      setSettings(prev => ({ 
        ...prev, 
        activeModel: model,
        model: model.id 
      }));
      
      // Update model context
      await setActiveModel(model);
      
      showMessage('success', `Model activated: ${model.name || model.id}`);
      
    } catch (error) {
      console.error("Model activation error:", error);
      showMessage('error', `Failed to activate model: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModelsFolder = async () => {
    if (window.electronAPI?.openModelsFolder) {
      try {
        setLoading(true);
        await window.electronAPI.openModelsFolder();
        showMessage('success', 'Models folder opened');
      } catch (error) {
        console.error("Failed to open models folder:", error);
        showMessage('error', 'Failed to open models folder');
      } finally {
        setLoading(false);
      }
    } else {
      showMessage('error', 'Models folder access not available in browser');
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'testing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <Wifi className="w-4 h-4 text-red-500" />;
      default:
        return <Wifi className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'testing':
        return 'Testing...';
      case 'error':
        return 'Connection Failed';
      default:
        return 'Disconnected';
    }
  };

  const getServerStatusBadge = (service, status) => {
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        status 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }`}>
        <div className={`w-2 h-2 rounded-full mr-1 ${status ? 'bg-green-500' : 'bg-red-500'}`}></div>
        {service}: {status ? 'Running' : 'Stopped'}
      </span>
    );
  };

  // Enhanced settings sections with real implementations
  const renderGeneralSettings = () => (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Connection Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getConnectionStatusIcon()}
                <span className={`text-sm font-medium ${
                  connectionStatus === 'connected' ? 'text-green-600' :
                  connectionStatus === 'error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {getConnectionStatusText()}
                </span>
              </div>
              <button
                type="button"
                onClick={testConnection}
                disabled={loading}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Test
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {getServerStatusBadge("Backend", serverStatus.backend)}
              {getServerStatusBadge("Llama", serverStatus.llama)}
            </div>

            <button
              type="button"
              onClick={handleRestartLlamaServer}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              Restart Llama Server
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Current Model</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {currentModel ? 
              `${currentModel.name || currentModel.id} (${currentModel.type})` 
              : "No model selected"}
          </div>
          {performanceMetrics.tokensPerSecond > 0 && (
            <div className="mt-2 text-xs text-green-600 dark:text-green-400">
              Performance: {performanceMetrics.tokensPerSecond.toFixed(1)} tokens/sec
            </div>
          )}
          <button
            type="button"
            onClick={handleOpenModelsFolder}
            className="w-full mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Open Models Folder
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter your API key"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Server URL</label>
            <input
              type="url"
              value={settings.serverUrl}
              onChange={(e) => setSettings(prev => ({ ...prev, serverUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="http://localhost:8080"
              required
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </form>
  );

  const renderPerformanceSettings = () => (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              CPU Threads: {settings.performance.cpuThreads}
            </label>
            <input
              type="range"
              min="1"
              max={systemInfo?.cpu?.cores || 8}
              value={settings.performance.cpuThreads}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, cpuThreads: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              Recommended: {Math.max(1, Math.floor((systemInfo?.cpu?.cores || 4) / 2))} threads
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Max Memory Usage: {settings.performance.maxMemoryUsage} MB
            </label>
            <input
              type="range"
              min="512"
              max="8192"
              step="512"
              value={settings.performance.maxMemoryUsage}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, maxMemoryUsage: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              GPU Layers: {settings.performance.gpuLayers}
            </label>
            <input
              type="range"
              min="0"
              max="99"
              value={settings.performance.gpuLayers}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, gpuLayers: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              0 = CPU only, higher values use more GPU
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Context Size: {settings.performance.contextSize}
            </label>
            <input
              type="range"
              min="512"
              max="16384"
              step="512"
              value={settings.performance.contextSize}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, contextSize: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Batch Size: {settings.performance.batchSize}
            </label>
            <input
              type="range"
              min="128"
              max="2048"
              step="128"
              value={settings.performance.batchSize}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, batchSize: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Cache Size: {settings.performance.cacheSize} MB
            </label>
            <input
              type="range"
              min="512"
              max="8192"
              step="512"
              value={settings.performance.cacheSize}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, cacheSize: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.performance.lowMemoryMode}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, lowMemoryMode: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Low Memory Mode</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.performance.enableHardwareAcceleration}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, enableHardwareAcceleration: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Enable Hardware Acceleration</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.performance.flashAttention}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, flashAttention: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Flash Attention (Experimental)</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.performance.prefetch}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, prefetch: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Model Prefetching</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.performance.mmap}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, mmap: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Memory Mapping</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.performance.mlock}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, mlock: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Lock Memory (Prevent Swapping)</span>
          </label>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium mb-2">Quantization</label>
          <select
            value={settings.performance.quantize}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              performance: { ...prev.performance, quantize: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
          >
            <option value="q2_K">Q2_K (Smallest)</option>
            <option value="q3_K_S">Q3_K_S</option>
            <option value="q3_K_M">Q3_K_M</option>
            <option value="q3_K_L">Q3_K_L</option>
            <option value="q4_0">Q4_0 (Recommended)</option>
            <option value="q4_K_S">Q4_K_S</option>
            <option value="q4_K_M">Q4_K_M</option>
            <option value="q5_0">Q5_0</option>
            <option value="q5_K_S">Q5_K_S</option>
            <option value="q5_K_M">Q5_K_M</option>
            <option value="q6_K">Q6_K</option>
            <option value="q8_0">Q8_0 (Highest Quality)</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Performance Settings
        </button>
        <button
          type="button"
          onClick={handleRestartLlamaServer}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Apply & Restart
        </button>
      </div>
    </form>
  );

  const renderModelSettings = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Available Models</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading models...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Local Models */}
            <div>
              <h4 className="font-medium mb-3">Local Models ({localModels.length})</h4>
              {localModels.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Cpu className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No local models found</p>
                  <p className="text-sm">Upload models to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {localModels.map((model) => (
                    <div
                      key={model.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        currentModel?.id === model.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      onClick={() => handleSetActiveModel(model, "local")}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-sm text-gray-500">{model.size} • {model.format}</div>
                        </div>
                        {currentModel?.id === model.id && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Remote Models */}
            <div>
              <h4 className="font-medium mb-3">Remote Models ({remoteModels.length})</h4>
              {remoteModels.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No remote models configured
                </div>
              ) : (
                <div className="space-y-2">
                  {remoteModels.map((model) => (
                    <div
                      key={model.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        currentModel?.id === model.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      onClick={() => handleSetActiveModel(model, "remote")}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-sm text-gray-500">{model.url}</div>
                        </div>
                        {currentModel?.id === model.id && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleOpenModelsFolder}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Open Models Folder
        </button>
      </div>
    </div>
  );

  // Add other render methods for different tabs (theme, chat, ui, security, system)
  const renderThemeSettings = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Theme Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleThemeChange('light')}
            className={`p-4 border rounded-lg text-center transition-colors ${
              settings.theme === 'light' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}
          >
            <Sun className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <div className="font-medium">Light</div>
          </button>
          
          <button
            onClick={() => handleThemeChange('dark')}
            className={`p-4 border rounded-lg text-center transition-colors ${
              settings.theme === 'dark' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}
          >
            <Moon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <div className="font-medium">Dark</div>
          </button>
          
          <button
            onClick={() => handleThemeChange('system')}
            className={`p-4 border rounded-lg text-center transition-colors ${
              settings.theme === 'system' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}
          >
            <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-500" />
            <div className="font-medium">System</div>
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Theme Settings
        </button>
      </div>
    </div>
  );

  const renderChatSettings = () => (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Chat Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Tokens: {settings.chat.maxTokens}
            </label>
            <input
              type="range"
              min="100"
              max="8000"
              step="100"
              value={settings.chat.maxTokens}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, maxTokens: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Temperature: {settings.chat.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.chat.temperature}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, temperature: parseFloat(e.target.value) }
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Top P: {settings.chat.topP}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.chat.topP}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, topP: parseFloat(e.target.value) }
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Context Window: {settings.chat.contextWindow}
            </label>
            <input
              type="range"
              min="512"
              max="16384"
              step="512"
              value={settings.chat.contextWindow}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, contextWindow: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.chat.streamResponses}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, streamResponses: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Stream Responses</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.chat.showTypingIndicator}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, showTypingIndicator: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Show Typing Indicator</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.chat.enableMarkdown}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, enableMarkdown: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Enable Markdown Rendering</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.chat.enableCodeHighlighting}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, enableCodeHighlighting: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Enable Code Highlighting</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Chat Settings
        </button>
      </div>
    </form>
  );

  const renderUISettings = () => (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Interface Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Font Size: {settings.ui.fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="24"
              step="1"
              value={settings.ui.fontSize}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                ui: { ...prev.ui, fontSize: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Sidebar Width: {settings.ui.sidebarWidth}px
            </label>
            <input
              type="range"
              min="200"
              max="400"
              step="10"
              value={settings.ui.sidebarWidth}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                ui: { ...prev.ui, sidebarWidth: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.ui.compactMode}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                ui: { ...prev.ui, compactMode: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Compact Mode</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.ui.showTimestamps}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                ui: { ...prev.ui, showTimestamps: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Show Timestamps</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.ui.smoothScrolling}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                ui: { ...prev.ui, smoothScrolling: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Smooth Scrolling</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.ui.hoverEffects}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                ui: { ...prev.ui, hoverEffects: e.target.checked }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm">Hover Effects</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save UI Settings
        </button>
      </div>
    </form>
  );

  const renderSecuritySettings = () => (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Security & Privacy</h3>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.security.encryptLocalData}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, encryptLocalData: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm">Encrypt Local Data</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Encrypt chat history and settings stored locally</p>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.security.autoClearHistory}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, autoClearHistory: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm">Auto-clear Chat History</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Automatically clear chat history after {settings.security.autoClearInterval} hours</p>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.security.clearOnExit}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, clearOnExit: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm">Clear Data on Exit</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Clear all local data when application closes</p>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.security.blockTracking}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, blockTracking: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm">Block Tracking</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Prevent tracking and analytics</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Security Settings
        </button>
      </div>
    </form>
  );

  const renderSystemSettings = () => (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">System Settings</h3>
        
        {systemInfo && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium mb-2">System Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Platform:</span>
                <span className="ml-2">{systemInfo.platform} {systemInfo.arch}</span>
              </div>
              <div>
                <span className="text-gray-500">CPU:</span>
                <span className="ml-2">{systemInfo.cpu?.brand || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-gray-500">Cores:</span>
                <span className="ml-2">{systemInfo.cpu?.cores || '?'}</span>
              </div>
              <div>
                <span className="text-gray-500">Memory:</span>
                <span className="ml-2">{systemInfo.memory ? `${(systemInfo.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.system.hardwareAcceleration}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  system: { ...prev.system, hardwareAcceleration: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm">Hardware Acceleration</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Use GPU acceleration for better performance</p>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.system.performanceMode}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  system: { ...prev.system, performanceMode: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm">Performance Mode</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Optimize for maximum performance</p>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.system.autoStart}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  system: { ...prev.system, autoStart: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm">Start with System</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Automatically start with operating system</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save System Settings
        </button>
      </div>
    </form>
  );

  if (!isOpen) return null;

  const tabs = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "performance", label: "Performance", icon: Zap },
    { id: "models", label: "Models", icon: Cpu },
    { id: "theme", label: "Appearance", icon: Palette },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "ui", label: "Interface", icon: Monitor },
    { id: "security", label: "Security", icon: Shield },
    { id: "system", label: "System", icon: CpuIcon },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure your application</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading || saving}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Message Display */}
        {message.text && (
          <div className={`mx-6 mt-4 p-3 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={loading || saving}
                className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors disabled:opacity-50 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && activeTab !== 'models' ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          ) : (
            <>
              {activeTab === "general" && renderGeneralSettings()}
              {activeTab === "performance" && renderPerformanceSettings()}
              {activeTab === "models" && renderModelSettings()}
              {activeTab === "theme" && renderThemeSettings()}
              {activeTab === "chat" && renderChatSettings()}
              {activeTab === "ui" && renderUISettings()}
              {activeTab === "security" && renderSecuritySettings()}
              {activeTab === "system" && renderSystemSettings()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;