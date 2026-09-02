/* Settings photos may be local Electron paths or data URLs. */
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from "react";
import {
  X,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  Cpu,
  Zap,
  Palette,
  MessageSquare,
  Moon,
  Sun,
  Upload,
  FolderOpen,
  RotateCcw,
  Trash2,
  Monitor,
  User,
  Layout
} from "lucide-react";

import { useTheme } from "../../contexts/ThemeContext";
import { useModel } from "../../contexts/ModelContext";
import { useProfile } from "../../contexts/ProfileContext";
import { resolveImagePath, fileToDataURL } from "../../utils/imageResolver";
import { modelsAPI } from "../../utils/api";

/*
|--------------------------------------------------------------------------
| SettingsModal
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| settings.json is the ONLY source of truth.
|
| The frontend does NOT create default settings.
| The frontend does NOT use localStorage.
| The frontend does NOT merge settings.json with another settings object.
|
| Required Electron APIs:
|
|   window.electronAPI.getSettings()
|   window.electronAPI.saveSettings(settings)
|
| Optional Electron APIs:
|
|   window.electronAPI.restartLlamaServer()
|   window.electronAPI.openModelsFolder()
|   window.electronAPI.deleteModel(model)
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Presentational helpers
|--------------------------------------------------------------------------
|
| Purely visual — no state, no side effects. Every prop they take maps
| 1:1 to the same values/handlers the original checkboxes used, so
| swapping a <input type="checkbox"> for <Toggle> changes nothing about
| how settings are read or written.
|--------------------------------------------------------------------------
*/

const Toggle = ({ checked, onChange, disabled, title, description }) => (
  <div
    className={`
      flex items-start justify-between gap-4
      rounded-xl border p-4
      transition-colors
      ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      ${
        checked
          ? "border-[var(--border)] bg-[var(--accent-subtle)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border)]"
      }
    `}
  >
    <div className="min-w-0 flex-1">
      <div className="block text-sm font-medium text-[var(--text-primary)]">
        {title}
      </div>
      {description && (
        <div className="mt-0.5 block text-xs leading-relaxed text-[var(--text-secondary)]">
          {description}
        </div>
      )}
    </div>

    <button
      type="button"
      role="switch"
      aria-label={title}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (typeof onChange === "function") {
          onChange({ target: { checked: !checked } });
        }
      }}
      className={`
        relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200
        ${checked ? "border-[var(--primary)] bg-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface-raised)]"}
        ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span
        className={`
          inline-block h-5 w-5 rounded-full bg-[var(--surface)] shadow-sm transition-transform duration-200
          ${checked ? "translate-x-5" : "translate-x-0.5"}
        `}
      />
    </button>
  </div>
);

const FieldLabel = ({ children, hint }) => (
  <div className="mb-2 flex items-baseline justify-between gap-2">
    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
      {children}
    </label>
    {hint !== undefined && (
      <span className="font-mono text-xs text-[var(--primary)]">
        {hint}
      </span>
    )}
  </div>
);

const Panel = ({ title, description, children, className = "" }) => (
  <section
    className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 ${className}`}
  >
    {(title || description) && (
      <div className="mb-5">
        {title && (
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
        )}
        {description && (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
    )}
    {children}
  </section>
);

const inputClass = `
  w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]
  placeholder:text-[var(--text-secondary)] transition-colors
  focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
  disabled:cursor-not-allowed disabled:opacity-60
`;

const SaveButtons = ({
  label = "Save Settings",
  showRestart = false,
  saving,
  deletingModelId,
  onResetDefaults,
  onClose,
  onApplyAndRestart,
  onSave,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <button
      type="button"
      onClick={onResetDefaults}
      disabled={saving || deletingModelId !== null}
      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
    >
      <RotateCcw className="h-4 w-4" />
      Restore Defaults
    </button>

    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saving || deletingModelId !== null}
        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Cancel
      </button>

      {showRestart && (
        <button
          type="button"
          onClick={onApplyAndRestart}
          disabled={saving || deletingModelId !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 disabled:border-slate-300 disabled:text-slate-400 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
        >
          <RotateCcw className="h-4 w-4" />
          {saving ? "Applying..." : "Apply & Restart"}
        </button>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving || deletingModelId !== null}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500 disabled:bg-slate-400"
      >
        {saving ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? "Saving..." : label}
      </button>
    </div>
  </div>
);

const rangeClass = "w-full cursor-pointer accent-[var(--primary)]";

/*
|--------------------------------------------------------------------------
| Static UI metadata (labels only — not part of settings.json)
|--------------------------------------------------------------------------
*/

const TAB_META = {
  general: {
    label: "General",
    icon: SettingsIcon,
    blurb: "Connection, active model, and theme."
  },
  performance: {
    label: "Performance",
    icon: Zap,
    blurb: "Hardware usage and inference throughput."
  },
  models: {
    label: "Models",
    icon: Cpu,
    blurb: "Installed local models and storage."
  },
  profile: {
    label: "Profile",
    icon: User,
    blurb: "How you and the assistant are identified."
  },
  theme: {
    label: "Appearance",
    icon: Palette,
    blurb: "Light, dark, or system appearance."
  },
  ui: {
    label: "Interface",
    icon: Layout,
    blurb: "Layout density and text size."
  },
  chat: {
    label: "Chat",
    icon: MessageSquare,
    blurb: "Generation parameters and system prompt."
  }
};

const FOOTER_CONFIG = {
  general: { label: "Save Settings", showRestart: false },
  performance: { label: "Save Performance Settings", showRestart: true },
  profile: { label: "Save Profile Settings", showRestart: false },
  theme: { label: "Save Appearance", showRestart: false },
  ui: { label: "Save Interface Settings", showRestart: false },
  chat: { label: "Save Chat Settings", showRestart: true }
};

const SettingsModal = ({ isOpen, onClose, onImportModel, initialTab = "general" }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  /*
   * null means settings have not been loaded yet.
   *
   * This is intentional.
   *
   * DO NOT replace this with a hard-coded default object.
   */
  const [settings, setSettings] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /*
   * Tracks the model currently being deleted.
   *
   * null means no model deletion is in progress.
   */
  const [deletingModelId, setDeletingModelId] = useState(null);

  const [message, setMessage] = useState({
    type: "",
    text: ""
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [userPhotoPreview, setUserPhotoPreview] = useState("");
  const [aiPhotoPreview, setAiPhotoPreview] = useState("");

  const { setTheme } = useTheme();

  /*
   * Model context is retained because selecting a model should also
   * update the application's active model context.
   *
   * The settings UI itself still gets the model data from settings.json.
   */
  const { setActiveModel, refreshModels } = useModel();


  /*
  |--------------------------------------------------------------------------
  | Message helper
  |--------------------------------------------------------------------------
  */

  const showMessage = (type, text, duration = 5000) => {
    setMessage({
      type,
      text
    });

    window.setTimeout(() => {
      setMessage({
        type: "",
        text: ""
      });
    }, duration);
  };


  /*
  |--------------------------------------------------------------------------
  | Electron API validation
  |--------------------------------------------------------------------------
  */

  const requireElectronAPI = () => {
    if (!window.electronAPI) {
      throw new Error(
        "Electron settings API is not available. Run the application through Electron."
      );
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Load settings.json
  |--------------------------------------------------------------------------
  |
  | This function intentionally does NOT:
  |
  |   - create defaults
  |   - merge objects
  |   - read localStorage
  |   - read environment variables
  |   - read another settings source
  |
  | The returned object is used directly.
  |--------------------------------------------------------------------------
  */

  const loadSettings = async () => {
    try {
      setLoading(true);

      requireElectronAPI();

      if (typeof window.electronAPI.getSettings !== "function") {
        throw new Error(
          "window.electronAPI.getSettings() is not implemented."
        );
      }

      const loadedSettings =
        await window.electronAPI.getSettings();

      const liveModels = await modelsAPI.list();
      const scannedModels = Array.isArray(liveModels)
        ? liveModels
        : Array.isArray(liveModels?.data)
          ? liveModels.data
          : Array.isArray(liveModels?.models)
            ? liveModels.models
            : [];

      if (
        !loadedSettings ||
        typeof loadedSettings !== "object" ||
        Array.isArray(loadedSettings)
      ) {
        throw new Error(
          "settings.json returned invalid data."
        );
      }

      /*
       * IMPORTANT:
       *
       * Do NOT merge with previous state.
       *
       * The file completely replaces the frontend state.
       */
      setSettings({
        ...loadedSettings,
        availableModels:
          scannedModels.length > 0
            ? scannedModels.filter((model) => model?.type === "local")
            : Array.isArray(loadedSettings.availableModels)
              ? loadedSettings.availableModels
              : [],
        ui:
          loadedSettings.ui &&
          typeof loadedSettings.ui === "object" &&
          !Array.isArray(loadedSettings.ui)
            ? {
                fontSize: 13,
                sidebarWidth: 280,
                ...loadedSettings.ui
              }
            : {
                fontSize: 13,
                sidebarWidth: 280
              },
        profile:
          loadedSettings.profile &&
          typeof loadedSettings.profile === "object" &&
          !Array.isArray(loadedSettings.profile)
            ? loadedSettings.profile
            : {}
      });

          setUserPhotoPreview(loadedSettings.profile?.userPhoto || "");
          setAiPhotoPreview(loadedSettings.profile?.aiPhoto || "");

      /*
       * Synchronize the application's active theme from the file.
       */
      if (loadedSettings.theme) {
        setTheme(loadedSettings.theme);
      }

    } catch (error) {
      console.error(
        "Failed to load settings.json:",
        error
      );

      setSettings(null);

      showMessage(
        "error",
        error?.message ||
          "Failed to load settings.json."
      );

    } finally {
      setLoading(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Load settings whenever the modal opens
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveTab(initialTab || "general");

    const loadTimer = window.setTimeout(() => {
      loadSettings();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  // loadSettings is intentionally invoked only when the modal opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);


  /*
  |--------------------------------------------------------------------------
  | Generic setting update
  |--------------------------------------------------------------------------
  */

  const updateSetting = (key, value) => {
    setSettings((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        [key]: value
      };
    });
  };


  /*
  |--------------------------------------------------------------------------
  | Nested setting update
  |--------------------------------------------------------------------------
  */

  const updateNestedSetting = (
    section,
    key,
    value
  ) => {
    setSettings((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,

        [section]: {
          ...previous[section],
          [key]: value
        }
      };
    });
  };


  /*
  |--------------------------------------------------------------------------
  | Save settings.json
  |--------------------------------------------------------------------------
  |
  | The save operation:
  |
  | React state
  |     ↓
  | electronAPI.saveSettings()
  |     ↓
  | settings.json
  |     ↓
  | electronAPI.getSettings()
  |     ↓
  | React state
  |
  | The final getSettings() is intentional.
  | It verifies that the UI represents what is actually in the file.
  |--------------------------------------------------------------------------
  */

  const saveSettings = async () => {
    if (!settings) {
      throw new Error(
        "Settings have not been loaded."
      );
    }

    requireElectronAPI();

    if (
      typeof window.electronAPI.saveSettings !==
      "function"
    ) {
      throw new Error(
        "window.electronAPI.saveSettings() is not implemented."
      );
    }

    /*
     * Save the complete object.
     */
    await window.electronAPI.saveSettings(
      settings
    );

    /*
     * Immediately read the actual file again.
     */
    if (
      typeof window.electronAPI.getSettings !==
      "function"
    ) {
      throw new Error(
        "window.electronAPI.getSettings() is not implemented."
      );
    }

    const verifiedSettings =
      await window.electronAPI.getSettings();

    if (
      !verifiedSettings ||
      typeof verifiedSettings !== "object" ||
      Array.isArray(verifiedSettings)
    ) {
      throw new Error(
        "Saved settings could not be read back from settings.json."
      );
    }

    /*
     * Replace state with the actual saved file.
     */
    const normalizedSettings = {
      ...verifiedSettings,
      ui:
        verifiedSettings.ui &&
        typeof verifiedSettings.ui === "object" &&
        !Array.isArray(verifiedSettings.ui)
          ? verifiedSettings.ui
          : {},
      profile:
        verifiedSettings.profile &&
        typeof verifiedSettings.profile === "object" &&
        !Array.isArray(verifiedSettings.profile)
          ? verifiedSettings.profile
          : {}
    };

    setSettings(normalizedSettings);
    setUserPhotoPreview(normalizedSettings.profile?.userPhoto || "");
    setAiPhotoPreview(normalizedSettings.profile?.aiPhoto || "");

    window.dispatchEvent(
      new CustomEvent("offyai-settings-saved", {
        detail: normalizedSettings
      })
    );

    /*
     * Keep the application theme synchronized.
     */
    if (verifiedSettings.theme) {
      setTheme(verifiedSettings.theme);
    }

    return verifiedSettings;
  };


  /*
  |--------------------------------------------------------------------------
  | Save button handler
  |--------------------------------------------------------------------------
  */

  const handleSave = async (event) => {
    if (event) {
      event.preventDefault();
    }

    try {
      setSaving(true);

      if (!settings) {
        throw new Error(
          "Settings are not loaded."
        );
      }

      if (!settings.serverUrl) {
        throw new Error(
          "Server URL is required."
        );
      }

      await saveSettings();

      showMessage(
        "success",
        "Settings saved to settings.json."
      );

    } catch (error) {
      console.error(
        "Failed to save settings:",
        error
      );

      showMessage(
        "error",
        error?.message ||
          "Failed to save settings."
      );

    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const confirmed = window.confirm(
      "Restore the default settings?\n\n" +
      "This clears the API key and profile images, resets the profile names, and restores the local server URL. Installed models are kept."
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      requireElectronAPI();

      if (typeof window.electronAPI.resetSettings !== "function") {
        throw new Error(
          "window.electronAPI.resetSettings() is not implemented."
        );
      }

      const resetSettings = await window.electronAPI.resetSettings();
      const normalizedSettings = {
        ...resetSettings,
        profile: resetSettings.profile || {},
        ui: resetSettings.ui || {},
      };

      setSettings(normalizedSettings);
      setUserPhotoPreview("");
      setAiPhotoPreview("");
      setTheme(normalizedSettings.theme || "system");
      window.dispatchEvent(
        new CustomEvent("offyai-settings-saved", {
          detail: normalizedSettings,
        })
      );
      showMessage("success", "Default settings restored.");
    } catch (error) {
      console.error("Failed to restore default settings:", error);
      showMessage(
        "error",
        error?.message || "Failed to restore default settings."
      );
    } finally {
      setSaving(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Theme
  |--------------------------------------------------------------------------
  |
  | Theme changes immediately in the UI and are also written to
  | settings.json.
  |--------------------------------------------------------------------------
  */

  const handleThemeChange = async (newTheme) => {
    if (!settings) {
      return;
    }

    const nextSettings = {
      ...settings,
      theme: newTheme
    };

    /*
     * Immediate UI update.
     */
    setSettings(nextSettings);
    setTheme(newTheme);

    try {
      setSaving(true);

      requireElectronAPI();

      if (
        typeof window.electronAPI.saveSettings !==
        "function"
      ) {
        throw new Error(
          "window.electronAPI.saveSettings() is not implemented."
        );
      }

      await window.electronAPI.saveSettings(
        nextSettings
      );

      /*
       * Read the actual file again.
       */
      const verifiedSettings =
        await window.electronAPI.getSettings();

      if (
        !verifiedSettings ||
        typeof verifiedSettings !== "object" ||
        Array.isArray(verifiedSettings)
      ) {
        throw new Error(
          "Saved settings could not be read back from settings.json."
        );
      }

      setSettings({
        ...verifiedSettings,
        availableModels:
          Array.isArray(verifiedSettings.availableModels)
            ? verifiedSettings.availableModels
            : [],
      });

      if (typeof refreshModels === "function") {
        await refreshModels();
      }

      if (verifiedSettings.theme) {
        setTheme(verifiedSettings.theme);
      }

      showMessage(
        "success",
        "Theme saved to settings.json."
      );

    } catch (error) {
      console.error(
        "Failed to save theme:",
        error
      );

      /*
       * Reload the actual file so the UI does not
       * remain out of sync after an error.
       */
      try {
        await loadSettings();
      } catch {
        // Original error is already displayed.
      }

      showMessage(
        "error",
        error?.message ||
          "Failed to save theme."
      );

    } finally {
      setSaving(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Restart llama server
  |--------------------------------------------------------------------------
  |
  | Save first.
  | Then restart.
  |
  | This ensures the server restart happens after the new settings
  | have been written to settings.json.
  |--------------------------------------------------------------------------
  */

  const handleApplyAndRestart = async () => {
    try {
      setSaving(true);

      if (!settings) {
        throw new Error(
          "Settings are not loaded."
        );
      }

      /*
       * First save the current settings.
       */
      await saveSettings();

      requireElectronAPI();

      if (
        typeof window.electronAPI
          .restartLlamaServer !== "function"
      ) {
        throw new Error(
          "Llama server restart is not available."
        );
      }

      const result =
        await window.electronAPI.restartLlamaServer();

      if (
        result &&
        result.success === false
      ) {
        throw new Error(
          result.error ||
            "Failed to restart llama server."
        );
      }

      /*
       * Read settings again after restart.
       */
      const verifiedSettings =
        await window.electronAPI.getSettings();

      if (
        !verifiedSettings ||
        typeof verifiedSettings !== "object" ||
        Array.isArray(verifiedSettings)
      ) {
        throw new Error(
          "Settings could not be read after restart."
        );
      }

      setSettings({
        ...verifiedSettings,
        availableModels:
          Array.isArray(verifiedSettings.availableModels)
            ? verifiedSettings.availableModels
            : [],
      });

      if (verifiedSettings.theme) {
        setTheme(verifiedSettings.theme);
      }

      showMessage(
        "success",
        "Settings saved and llama server restarted."
      );

    } catch (error) {
      console.error(
        "Failed to apply settings:",
        error
      );

      showMessage(
        "error",
        error?.message ||
          "Failed to apply settings."
      );

    } finally {
      setSaving(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Active model
  |--------------------------------------------------------------------------
  |
  | availableModels comes from settings.json.
  |
  | We do not use modelsAPI.list() here.
  |--------------------------------------------------------------------------
  */

  const handleSetActiveModel = async (
    model
  ) => {
    try {
      setSaving(true);

      if (!settings) {
        throw new Error(
          "Settings are not loaded."
        );
      }

      await setActiveModel(model);

      /*
       * Read the actual file.
       */
      requireElectronAPI();

      if (
        typeof window.electronAPI.getSettings !==
        "function"
      ) {
        throw new Error(
          "window.electronAPI.getSettings() is not implemented."
        );
      }

      const verifiedSettings =
        await window.electronAPI.getSettings();

      if (
        !verifiedSettings ||
        typeof verifiedSettings !== "object" ||
        Array.isArray(verifiedSettings)
      ) {
        throw new Error(
          "Saved settings could not be read back from settings.json."
        );
      }

      setSettings(verifiedSettings);

      /*
       * Update ModelContext if available.
       *
       * This is application runtime state.
       * The persisted source remains settings.json.
       */
      showMessage(
        "success",
        `Active model changed to ${
          verifiedSettings.activeModel?.name ||
          verifiedSettings.model ||
          model.id
        }.`
      );

    } catch (error) {
      console.error(
        "Failed to change active model:",
        error
      );

      showMessage(
        "error",
        error?.message ||
          "Failed to change active model."
      );

    } finally {
      setSaving(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | DELETE MODEL
  |--------------------------------------------------------------------------
  |
  | The renderer must NOT directly manipulate the model filesystem.
  |
  | Instead:
  |
  | React
  |   ↓
  | electronAPI.deleteModel(model)
  |   ↓
  | Electron main process
  |   ↓
  | Delete model file and refresh settings
  |
  |--------------------------------------------------------------------------
  */

  const handleDeleteModel = async (model) => {
    if (!model) {
      return;
    }

    /*
     * Never allow deletion while another operation is running.
     */
    if (saving || deletingModelId !== null) {
      return;
    }

    /*
     * Determine model ID safely.
     */
    const modelId = model.id;

    if (
      modelId === "offyai" ||
      model.fileName === "offyai.gguf" ||
      model.name === "offyai" ||
      model.name === "offyai.gguf"
    ) {
      showMessage(
        "error",
        "The built-in OffyAI model cannot be deleted."
      );

      return;
    }

    if (!modelId) {
      showMessage(
        "error",
        "Cannot delete a model without a model ID."
      );

      return;
    }

    /*
     * Do not allow the active model to be deleted.
     *
     * The user should first select another model.
     */
    if (
      settings?.activeModel?.id &&
      settings.activeModel.id === modelId
    ) {
      showMessage(
        "error",
        "You cannot delete the active model. Select another model first."
      );

      return;
    }

    /*
     * Display name for the confirmation dialog.
     */
    const modelName =
      model.name ||
      model.fileName ||
      model.id;

    /*
     * Native confirmation is intentional here.
     *
     * Deleting a model is destructive.
     */
    const confirmed = window.confirm(
      `Delete "${modelName}"?\n\n` +
      `This will permanently delete the model file from the models folder ` +
      `and remove it from settings.json.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingModelId(modelId);

      requireElectronAPI();

      /*
       * Verify the Electron API exists.
       */
      if (
        typeof window.electronAPI.deleteModel !==
        "function"
      ) {
        throw new Error(
          "window.electronAPI.deleteModel() is not implemented."
        );
      }

      /*
       * Call Electron.
       *
       * Electron is responsible for:
       *
       *   1. validating the model
       *   2. validating the filesystem path
       *   3. deleting the actual model file
       *   4. removing the model from settings.json
       */
      const result =
        await window.electronAPI.deleteModel(
          model
        );

      /*
       * Support APIs that return:
       *
       *   { success: true }
       *
       * or
       *
       *   { success: false, error: "..." }
       */
      if (
        result &&
        typeof result === "object" &&
        result.success === false
      ) {
        throw new Error(
          result.error ||
            "Failed to delete model."
        );
      }

      /*
       * Read the actual settings.json again.
       *
       * We do not manually remove the model from React state.
       *
       * settings.json remains the single source of truth.
       */
      if (
        typeof window.electronAPI.getSettings !==
        "function"
      ) {
        throw new Error(
          "window.electronAPI.getSettings() is not implemented."
        );
      }

      const verifiedSettings =
        await window.electronAPI.getSettings();

      if (
        !verifiedSettings ||
        typeof verifiedSettings !== "object" ||
        Array.isArray(verifiedSettings)
      ) {
        throw new Error(
          "Model was deleted, but settings.json could not be read back."
        );
      }

      setSettings(verifiedSettings);

      if (typeof refreshModels === "function") {
        await refreshModels();
      }

      /*
       * Synchronize theme if necessary.
       */
      if (verifiedSettings.theme) {
        setTheme(verifiedSettings.theme);
      }

      /*
       * If the backend returned an active model,
       * synchronize ModelContext.
       */
      showMessage(
        "success",
        `"${modelName}" was deleted successfully.`
      );

    } catch (error) {
      console.error(
        "Failed to delete model:",
        error
      );

      showMessage(
        "error",
        error?.message ||
          "Failed to delete model."
      );

    } finally {
      setDeletingModelId(null);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Open models folder
  |--------------------------------------------------------------------------
  */

  const handleOpenModelsFolder = async () => {
    try {
      requireElectronAPI();

      if (
        typeof window.electronAPI
          .openModelsFolder !== "function"
      ) {
        throw new Error(
          "Models folder access is not available."
        );
      }

      await window.electronAPI.openModelsFolder();

    } catch (error) {
      console.error(
        "Failed to open models folder:",
        error
      );

      showMessage(
        "error",
        error?.message ||
          "Failed to open models folder."
      );
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Common save buttons
  |--------------------------------------------------------------------------
  */

  /*
  |--------------------------------------------------------------------------
  | General
  |--------------------------------------------------------------------------
  */

  const renderGeneralSettings = () => (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

      <Panel
        title="Application Configuration"
        description="Connection details used to reach the local inference server."
        className="xl:col-span-2"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {/* API Key */}
          <div>
            <FieldLabel>API Key</FieldLabel>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey ?? ""}
                onChange={(event) =>
                  updateSetting("apiKey", event.target.value)
                }
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Server URL */}
          <div>
            <FieldLabel>Server URL</FieldLabel>
            <input
              type="url"
              value={settings.serverUrl ?? ""}
              onChange={(event) =>
                updateSetting("serverUrl", event.target.value)
              }
              required
              className={inputClass}
            />
          </div>

          {/* Model ID */}
          <div>
            <FieldLabel>Model</FieldLabel>
            <input
              type="text"
              value={settings.model ?? ""}
              readOnly
              className={`${inputClass} cursor-not-allowed bg-[var(--surface-raised)] font-mono text-xs`}
            />
            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
              Select the active model from the Models tab.
            </p>
          </div>

          {/* Theme */}
          <div>
            <FieldLabel>Theme</FieldLabel>
            <select
              value={settings.theme ?? "dark"}
              onChange={(event) => handleThemeChange(event.target.value)}
              disabled={saving || deletingModelId !== null}
              className={inputClass}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

        </div>
      </Panel>

      {/* Active model */}
      <Panel title="Active Model">
        {settings.activeModel ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800/60 dark:bg-teal-950/20">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              <span className="truncate font-medium text-[var(--text-primary)]">
                {settings.activeModel.name || settings.activeModel.id}
              </span>
            </div>

            <dl className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold">ID</dt>
                <dd className="truncate font-mono">{settings.activeModel.id}</dd>
              </div>
              {settings.activeModel.fileName && (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold">File</dt>
                  <dd className="truncate font-mono">{settings.activeModel.fileName}</dd>
                </div>
              )}
              {settings.activeModel.path && (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold">Path</dt>
                  <dd className="break-all font-mono">{settings.activeModel.path}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold">Type</dt>
                <dd>{settings.activeModel.type}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No active model configured.
          </div>
        )}
      </Panel>

    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | Performance
  |--------------------------------------------------------------------------
  */

  const renderPerformanceSettings = () => (
    <div className="space-y-6">

      <Panel
        title="Compute"
        description="How the local model uses the hardware available to it."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

          <div>
            <FieldLabel hint={settings.performance.cpuThreads}>
              CPU Threads
            </FieldLabel>
            <input
              type="range"
              min="1"
              max="32"
              step="1"
              value={settings.performance.cpuThreads}
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "cpuThreads",
                  Number(event.target.value)
                )
              }
              className={rangeClass}
            />
          </div>

          <div>
            <FieldLabel hint={settings.performance.gpuLayers}>
              GPU Layers
            </FieldLabel>
            <input
              type="number"
              min="0"
              max="999"
              step="1"
              value={settings.performance.gpuLayers}
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "gpuLayers",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              0 means CPU-only inference.
            </p>
          </div>

          <div>
            <FieldLabel hint={settings.performance.contextSize}>
              Context Size
            </FieldLabel>
            <input
              type="number"
              min="512"
              step="512"
              value={settings.performance.contextSize}
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "contextSize",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel hint={settings.performance.batchSize}>
              Batch Size
            </FieldLabel>
            <input
              type="number"
              min="1"
              step="1"
              value={settings.performance.batchSize}
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "batchSize",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </div>

        </div>
      </Panel>

      <Panel title="Memory">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Toggle
            title="Memory Mapping (mmap)"
            description="Map the model file into memory instead of loading it fully."
            checked={settings.performance.mmap}
            onChange={(event) =>
              updateNestedSetting("performance", "mmap", event.target.checked)
            }
          />
          <Toggle
            title="Lock Model Memory (mlock)"
            description="Prevent the model from being swapped to disk."
            checked={settings.performance.mlock}
            onChange={(event) =>
              updateNestedSetting("performance", "mlock", event.target.checked)
            }
          />
        </div>
      </Panel>

    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | Models
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | availableModels is read directly from settings.json.
  |
  */

  const renderModelSettings = () => {
    const availableModels =
      Array.isArray(settings.availableModels)
        ? settings.availableModels
        : [];

    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        <Panel
          title="Available Models"
          description="Models currently listed in settings.json."
          className="xl:col-span-2"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {availableModels.length} model{availableModels.length === 1 ? "" : "s"}
            </div>
          </div>

          {availableModels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No models are listed in settings.json.
            </div>
          ) : (
            <div className="space-y-2.5">
              {availableModels.map((model) => {
                const isActive = settings.activeModel?.id === model.id;
                const isDeleting = deletingModelId === model.id;

                return (
                  <div
                    key={model.id}
                    className={`
                      rounded-xl border p-4 transition-colors
                      ${
                        isActive
                          ? "border-teal-400 bg-teal-50/70 dark:border-teal-700 dark:bg-teal-950/20"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">

                      <button
                        type="button"
                        onClick={() => handleSetActiveModel(model)}
                        disabled={saving || deletingModelId !== null}
                        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <CheckCircle className="h-4 w-4 shrink-0 text-teal-500" />
                          )}
                          <span className="truncate font-medium text-slate-900 dark:text-white">
                            {model.name || model.id}
                          </span>
                        </div>

                        <div className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                          {model.fileName || model.id}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                          {model.type && <span>Type: {model.type}</span>}
                          {model.size && <span>Size: {model.size}</span>}
                          {model.uploadedAt && <span>Added: {model.uploadedAt}</span>}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteModel(model)}
                        disabled={saving || deletingModelId !== null || isActive}
                        title={
                          isActive
                            ? "Select another model before deleting this model"
                            : "Delete model"
                        }
                        className="
                          inline-flex shrink-0 items-center justify-center gap-2
                          rounded-lg border border-red-200 bg-red-50 px-3 py-2
                          text-red-600 transition-colors
                          hover:border-red-300 hover:bg-red-100
                          disabled:cursor-not-allowed disabled:opacity-40
                          dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40
                        "
                      >
                        {isDeleting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">
                          {isDeleting ? "Deleting..." : "Delete"}
                        </span>
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-6">

          <Panel title="Active Model">
            {settings.activeModel ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800/60 dark:bg-teal-950/20">
                <div className="font-medium text-slate-900 dark:text-white">
                  {settings.activeModel.name || settings.activeModel.id}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                  {settings.activeModel.fileName}
                </div>
                <div className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                  {settings.activeModel.path}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                No active model.
              </div>
            )}
          </Panel>

          <Panel title="Actions" className="p-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={onImportModel}
                disabled={saving || deletingModelId !== null || !onImportModel}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-2.5 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate">Import Model</span>
              </button>

              <button
                type="button"
                onClick={handleOpenModelsFolder}
                disabled={saving || deletingModelId !== null}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="truncate">Open Folder</span>
              </button>

              <button
                type="button"
                onClick={handleApplyAndRestart}
                disabled={saving || deletingModelId !== null}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--primary)]/40 bg-[var(--accent-subtle)] px-2.5 py-2 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="truncate">{saving ? "Applying..." : "Restart"}</span>
              </button>
            </div>
          </Panel>

        </div>

      </div>
    );
  };


  /*
  |--------------------------------------------------------------------------
  | Theme
  |--------------------------------------------------------------------------
  */

  const renderThemeSettings = () => {
    const options = [
      { id: "light", label: "Light", icon: Sun, iconClass: "text-amber-500" },
      { id: "dark", label: "Dark", icon: Moon, iconClass: "text-indigo-400" },
      { id: "system", label: "System", icon: Monitor, iconClass: "text-slate-500" }
    ];

    return (
      <Panel
        title="Appearance"
        description="Choose how OffyAI looks. System follows your OS setting."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {options.map(({ id, label, icon: Icon, iconClass }) => {
            const isSelected = settings.theme === id;

            return (
              <button
                key={id}
                type="button"
                disabled={saving || deletingModelId !== null}
                onClick={() => handleThemeChange(id)}
                className={`
                  relative rounded-xl border p-6 text-center transition-colors
                  disabled:opacity-50
                  ${
                    isSelected
                      ? "border-teal-500 bg-teal-50/70 dark:border-teal-600 dark:bg-teal-950/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                  }
                `}
              >
                {isSelected && (
                  <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-teal-500" />
                )}
                <Icon className={`mx-auto mb-3 h-8 w-8 ${iconClass}`} />
                <div className="font-medium text-slate-900 dark:text-white">
                  {label}
                </div>
              </button>
            );
          })}
        </div>
      </Panel>
    );
  };


  /*
  |--------------------------------------------------------------------------
  | Chat
  |--------------------------------------------------------------------------
  */

  const renderChatSettings = () => (
    <div className="space-y-6">

      <Panel title="Generation Parameters">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">

          <div>
            <FieldLabel hint={settings.chat.maxTokens}>Max Tokens</FieldLabel>
            <input
              type="number"
              min="1"
              step="1"
              value={settings.chat.maxTokens}
              onChange={(event) =>
                updateNestedSetting("chat", "maxTokens", Number(event.target.value))
              }
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel hint={settings.chat.temperature}>Temperature</FieldLabel>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.chat.temperature}
              onChange={(event) =>
                updateNestedSetting("chat", "temperature", Number(event.target.value))
              }
              className={rangeClass}
            />
          </div>

          <div>
            <FieldLabel hint={settings.chat.topP}>Top P</FieldLabel>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.chat.topP}
              onChange={(event) =>
                updateNestedSetting("chat", "topP", Number(event.target.value))
              }
              className={rangeClass}
            />
          </div>

          <div>
            <FieldLabel hint={settings.chat.topK}>Top K</FieldLabel>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.chat.topK}
              onChange={(event) =>
                updateNestedSetting("chat", "topK", Number(event.target.value))
              }
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel hint={settings.chat.contextWindow}>
              Context Window
            </FieldLabel>
            <input
              type="number"
              min="512"
              step="512"
              value={settings.chat.contextWindow}
              onChange={(event) =>
                updateNestedSetting("chat", "contextWindow", Number(event.target.value))
              }
              className={inputClass}
            />
          </div>

        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <Panel title="Memory">
          <label
            htmlFor="chat-memory-mode"
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Conversation Memory
          </label>
          <select
            id="chat-memory-mode"
            value={settings.chat.memoryMode || "chat"}
            onChange={(event) =>
              updateNestedSetting("chat", "memoryMode", event.target.value)
            }
            className={inputClass}
          >
            <option value="off">Off</option>
            <option value="chat">This chat only (recommended)</option>
            <option value="application">All chats in this application</option>
          </select>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Uses only conversations stored locally in this application.
            Deleting a chat also removes it from application memory.
          </p>
        </Panel>

        <Panel title="Streaming">
          <Toggle
            title="Stream Responses"
            description="Show tokens as they are generated instead of waiting for the full reply."
            checked={settings.chat.streamResponses}
            onChange={(event) =>
              updateNestedSetting("chat", "streamResponses", event.target.checked)
            }
          />
        </Panel>

      </div>

      <Panel title="System Prompt">
        <textarea
          rows={8}
          value={settings.chat.systemPrompt ?? ""}
          onChange={(event) =>
            updateNestedSetting("chat", "systemPrompt", event.target.value)
          }
          className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
        />
      </Panel>

    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | Interface
  |--------------------------------------------------------------------------
  */

  const renderProfileSettings = () => {
    /*
    |--------------------------------------------------------------------------
    | Profile
    |--------------------------------------------------------------------------
    */

    const handleUserPhotoChange = async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const dataUrl = await fileToDataURL(file);
          setUserPhotoPreview(dataUrl);
          updateNestedSetting("profile", "userPhoto", dataUrl);
        } catch (error) {
          console.error("Failed to load user photo:", error);
        }
      }
    };

    const handleAiPhotoChange = async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const dataUrl = await fileToDataURL(file);
          setAiPhotoPreview(dataUrl);
          updateNestedSetting("profile", "aiPhoto", dataUrl);
        } catch (error) {
          console.error("Failed to load AI photo:", error);
        }
      }
    };

    return (
      <div className="space-y-6">

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* User Profile */}
          <Panel title="Your Profile">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-5">
              <div className="flex shrink-0 flex-col items-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-raised)]">
                  {userPhotoPreview ? (
                    <img
                      src={userPhotoPreview}
                      alt="User profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-8 w-8 text-[var(--text-secondary)]" />
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUserPhotoChange}
                  className="mt-2 w-24 text-xs text-[var(--text-secondary)] file:mr-2 file:rounded-md file:border-0 file:bg-[var(--surface-raised)] file:px-2 file:py-1 file:text-xs file:text-[var(--text-primary)]"
                />
              </div>

              <div className="w-full min-w-0 space-y-4">
                <div>
                  <FieldLabel>Your Name</FieldLabel>
                  <input
                    type="text"
                    value={settings.profile?.userName || ""}
                    onChange={(e) =>
                      updateNestedSetting("profile", "userName", e.target.value)
                    }
                    placeholder="Enter your name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>About You</FieldLabel>
                  <textarea
                    value={settings.profile?.userAbout || ""}
                    onChange={(e) =>
                      updateNestedSetting("profile", "userAbout", e.target.value)
                    }
                    placeholder="Brief description about yourself"
                    rows="3"
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>
            </div>
          </Panel>

          {/* AI Identity */}
          <Panel title="AI Identity">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-5">
              <div className="flex shrink-0 flex-col items-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-raised)]">
                  {aiPhotoPreview ? (
                    <img
                      src={aiPhotoPreview}
                      alt="AI profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Cpu className="h-8 w-8 text-[var(--text-secondary)]" />
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAiPhotoChange}
                  className="mt-2 w-24 text-xs text-[var(--text-secondary)] file:mr-2 file:rounded-md file:border-0 file:bg-[var(--surface-raised)] file:px-2 file:py-1 file:text-xs file:text-[var(--text-primary)]"
                />
              </div>

              <div className="w-full min-w-0 space-y-4">
                <div>
                  <FieldLabel>AI Name</FieldLabel>
                  <input
                    type="text"
                    value={settings.profile?.aiName || ""}
                    onChange={(e) =>
                      updateNestedSetting("profile", "aiName", e.target.value)
                    }
                    placeholder="AI name (e.g., OffyAI)"
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>About AI</FieldLabel>
                  <textarea
                    value={settings.profile?.aiAbout || ""}
                    onChange={(e) =>
                      updateNestedSetting("profile", "aiAbout", e.target.value)
                    }
                    placeholder="Brief description of the AI"
                    rows="3"
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>
            </div>
          </Panel>

        </div>

        {/* User Context Injection */}
        <Panel title="Chat Context">
          <Toggle
            title="Include my profile in system prompt"
            description="Your name and about text will be prepended to the AI's system prompt, providing context about you."
            checked={settings.profile?.includeUserContext || false}
            onChange={(e) =>
              updateNestedSetting("profile", "includeUserContext", e.target.checked)
            }
          />
        </Panel>

      </div>
    );
  };

  const renderUISettings = () => (
    <Panel
      title="Interface"
      description="Adjust density and text size to fit your screen."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

        <div>
          <FieldLabel hint={`${settings.ui.fontSize}px`}>Font Size</FieldLabel>
          <input
            type="range"
            min="10"
            max="24"
            step="1"
            value={settings.ui.fontSize}
            onChange={(event) =>
              updateNestedSetting("ui", "fontSize", Number(event.target.value))
            }
            className={rangeClass}
          />
        </div>

        <div>
          <FieldLabel hint={`${settings.ui.sidebarWidth}px`}>
            Sidebar Width
          </FieldLabel>
          <input
            type="range"
            min="180"
            max="500"
            step="10"
            value={settings.ui.sidebarWidth}
            onChange={(event) =>
              updateNestedSetting("ui", "sidebarWidth", Number(event.target.value))
            }
            className={rangeClass}
          />
        </div>

      </div>
    </Panel>
  );


  /*
  |--------------------------------------------------------------------------
  | Security
  |--------------------------------------------------------------------------
  */

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <Panel title="Security">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Toggle
            title="Encrypt Local Data"
            checked={settings.security.encryptLocalData}
            onChange={(event) =>
              updateNestedSetting("security", "encryptLocalData", event.target.checked)
            }
          />
          <Toggle
            title="Auto-clear Chat History"
            checked={settings.security.autoClearHistory}
            onChange={(event) =>
              updateNestedSetting("security", "autoClearHistory", event.target.checked)
            }
          />
          <Toggle
            title="Clear Data on Exit"
            checked={settings.security.clearOnExit}
            onChange={(event) =>
              updateNestedSetting("security", "clearOnExit", event.target.checked)
            }
          />
          <Toggle
            title="Block Tracking"
            checked={settings.security.blockTracking}
            onChange={(event) =>
              updateNestedSetting("security", "blockTracking", event.target.checked)
            }
          />
        </div>
      </Panel>

      <SaveButtons
        label="Save Security Settings"
        saving={saving}
        deletingModelId={deletingModelId}
        onResetDefaults={handleResetDefaults}
        onClose={onClose}
        onApplyAndRestart={handleApplyAndRestart}
        onSave={handleSave}
      />
    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | Do not render anything when closed
  |--------------------------------------------------------------------------
  */

  if (!isOpen) {
    return null;
  }


  /*
  |--------------------------------------------------------------------------
  | Loading state
  |--------------------------------------------------------------------------
  */

  if (loading || !settings) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md sm:p-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-8 py-8 shadow-xl">
          <RefreshCw className="h-6 w-6 animate-spin text-teal-500" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Loading settings.json...
          </span>
        </div>
      </div>
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Tabs
  |--------------------------------------------------------------------------
  |
  | These tabs correspond exactly to the sections in your settings.json.
  |
  */

  const tabs = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "performance", label: "Performance", icon: Zap },
    { id: "models", label: "Models", icon: Cpu },
    { id: "profile", label: "Profile", icon: User },
    { id: "theme", label: "Appearance", icon: Palette },
    { id: "ui", label: "Interface", icon: Layout },
    { id: "chat", label: "Chat", icon: MessageSquare },
  ];

  const activeMeta = TAB_META[activeTab] || {};
  const footerButtons = FOOTER_CONFIG[activeTab];


  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-5">
      <div
        className="
          flex h-[96vh] w-full max-w-[1500px] overflow-hidden
          rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl
        "
      >

        {/* Sidebar */}
        <aside
          className="
            flex w-16 shrink-0 flex-col border-r border-[var(--border)]
            bg-[var(--surface-raised)]
            sm:w-64
          "
        >

          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-5 sm:px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600">
              <SettingsIcon className="h-5 w-5 text-white" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                Settings
              </h2>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                settings.json
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-4 sm:px-3">
            <ul className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      disabled={saving || deletingModelId !== null}
                      title={tab.label}
                      className={`
                        flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                        transition-colors disabled:opacity-50
                        ${
                          isActive
                            ? "bg-teal-600 text-white"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="hidden truncate sm:inline">{tab.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Active model status */}
          <div className="border-t border-[var(--border)] p-3 sm:p-4">
            <div className="hidden text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] sm:block">
              Active Model
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  settings.activeModel ? "bg-[var(--primary)]" : "bg-[var(--text-secondary)]"
                }`}
              />
              <span className="hidden truncate text-xs font-medium text-[var(--text-primary)] sm:inline">
                {settings.activeModel
                  ? settings.activeModel.name || settings.activeModel.id
                  : "None configured"}
              </span>
            </div>
          </div>

        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Top bar */}
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-[var(--text-primary)]">
                {activeMeta.label}
              </h1>
              <p className="truncate text-sm text-[var(--text-secondary)]">
                {activeMeta.blurb}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving || deletingModelId !== null}
              className="
                shrink-0 rounded-lg p-2 text-slate-400 transition-colors
                hover:bg-slate-100 hover:text-slate-600
                disabled:opacity-50
                dark:hover:bg-slate-800 dark:hover:text-slate-200
              "
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Message */}
          {message.text && (
            <div className="px-5 pt-4 sm:px-8">
              <div
                className={`
                  flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm
                  ${
                    message.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
                  }
                `}
              >
                {message.type === "success" ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {activeTab === "general" && renderGeneralSettings()}
            {activeTab === "performance" && renderPerformanceSettings()}
            {activeTab === "models" && renderModelSettings()}
            {activeTab === "profile" && renderProfileSettings()}
            {activeTab === "theme" && renderThemeSettings()}
            {activeTab === "ui" && renderUISettings()}
            {activeTab === "chat" && renderChatSettings()}
          </div>

          {/* Sticky footer actions */}
          {footerButtons && (
            <div className="border-t border-[var(--border)] bg-[var(--surface-raised)] px-5 py-4 sm:px-8">
              <SaveButtons
                label={footerButtons.label}
                showRestart={footerButtons.showRestart}
                saving={saving}
                deletingModelId={deletingModelId}
                onResetDefaults={handleResetDefaults}
                onClose={onClose}
                onApplyAndRestart={handleApplyAndRestart}
                onSave={handleSave}
              />
            </div>
          )}

        </div>

      </div>
    </div>
  );
};


export default SettingsModal;