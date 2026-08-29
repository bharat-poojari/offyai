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


const SettingsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("general");

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
  const { setActiveModel } = useModel();


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

    const loadTimer = window.setTimeout(() => {
      loadSettings();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [isOpen]);


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

      setSettings(verifiedSettings);

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

      setSettings(verifiedSettings);

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
      if (
        typeof setActiveModel === "function" &&
        verifiedSettings.activeModel
      ) {
        try {
          await setActiveModel(
            verifiedSettings.activeModel
          );
        } catch (contextError) {
          console.warn(
            "Model context update failed:",
            contextError
          );
        }
      }

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
  | Delete model file
  |   ↓
  | Update settings.json
  |   ↓
  | Return result
  |   ↓
  | getSettings()
  |   ↓
  | React
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
      if (
        typeof setActiveModel === "function" &&
        verifiedSettings.activeModel
      ) {
        try {
          await setActiveModel(
            verifiedSettings.activeModel
          );
        } catch (contextError) {
          console.warn(
            "Model context update after deletion failed:",
            contextError
          );
        }
      }

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

  const SaveButtons = ({
    label = "Save Settings",
    showRestart = false
  }) => (
    <div className="flex flex-wrap gap-3 pt-4">

      <button
        type="button"
        onClick={handleResetDefaults}
        disabled={saving || deletingModelId !== null}
        className="
          px-4 py-2
          border border-amber-300 dark:border-amber-700
          text-amber-700 dark:text-amber-300
          hover:bg-amber-50 dark:hover:bg-amber-950/30
          disabled:opacity-50
          rounded-lg
          transition-colors
          flex items-center gap-2
        "
      >
        <RotateCcw className="w-4 h-4" />
        Restore Defaults
      </button>

      <button
        type="button"
        onClick={onClose}
        disabled={saving || deletingModelId !== null}
        className="
          px-4 py-2
          text-gray-700 dark:text-gray-300
          bg-gray-100 dark:bg-gray-600
          hover:bg-gray-200 dark:hover:bg-gray-500
          disabled:opacity-50
          rounded-lg
          transition-colors
        "
      >
        Cancel
      </button>


      <button
        type="button"
        onClick={handleSave}
        disabled={saving || deletingModelId !== null}
        className="
          px-4 py-2
          bg-blue-600 hover:bg-blue-700
          disabled:bg-gray-400
          text-white
          rounded-lg
          transition-colors
          flex items-center gap-2
        "
      >
        {saving ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}

        {saving ? "Saving..." : label}
      </button>


      {showRestart && (
        <button
          type="button"
          onClick={handleApplyAndRestart}
          disabled={saving || deletingModelId !== null}
          className="
            px-4 py-2
            bg-emerald-600 hover:bg-emerald-500
            disabled:bg-gray-400
            text-white
            rounded-lg
            transition-colors
            flex items-center gap-2
          "
        >
          <RotateCcw className="w-4 h-4" />

          {saving
            ? "Applying..."
            : "Apply & Restart"}
        </button>
      )}

    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | General
  |--------------------------------------------------------------------------
  */

  const renderGeneralSettings = () => (
    <div className="space-y-6">

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

        <h3 className="text-lg font-semibold tracking-tight mb-4">
          Application Configuration
        </h3>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* API Key */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              API Key
            </label>

            <div className="relative">

              <input
                type={
                  showApiKey
                    ? "text"
                    : "password"
                }
                value={settings.apiKey ?? ""}
                onChange={(event) =>
                  updateSetting(
                    "apiKey",
                    event.target.value
                  )
                }
                className="
                  w-full
                  px-3 py-2 pr-10
                  border border-gray-300 dark:border-gray-600
                  rounded-lg
                  focus:outline-none
                  focus:ring-2
                  focus:ring-blue-500
                  bg-white dark:bg-gray-700
                  text-gray-900 dark:text-white
                "
              />


              <button
                type="button"
                onClick={() =>
                  setShowApiKey(
                    (value) => !value
                  )
                }
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-500
                "
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>

            </div>

          </div>


          {/* Server URL */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Server URL
            </label>

            <input
              type="url"
              value={settings.serverUrl ?? ""}
              onChange={(event) =>
                updateSetting(
                  "serverUrl",
                  event.target.value
                )
              }
              required
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            />

          </div>


          {/* Model ID */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Model
            </label>

            <input
              type="text"
              value={settings.model ?? ""}
              readOnly
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-gray-100 dark:bg-gray-900
                text-gray-700 dark:text-gray-300
              "
            />

            <p className="text-xs text-gray-500 mt-1">
              Select the active model from the Models tab.
            </p>

          </div>


          {/* Theme */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Theme
            </label>

            <select
              value={settings.theme ?? "dark"}
              onChange={(event) =>
                handleThemeChange(
                  event.target.value
                )
              }
              disabled={saving || deletingModelId !== null}
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            >

              <option value="light">
                Light
              </option>

              <option value="dark">
                Dark
              </option>

              <option value="system">
                System
              </option>

            </select>

          </div>

        </div>

      </div>


      {/* Active model */}

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

        <h3 className="text-lg font-semibold tracking-tight mb-4">
          Active Model
        </h3>

        {settings.activeModel ? (

          <div className="
            rounded-lg
            border border-gray-200 dark:border-gray-700
            p-4
          ">

            <div className="font-medium">
              {settings.activeModel.name ||
                settings.activeModel.id}
            </div>

            <div className="text-sm text-gray-500 mt-1">
              ID: {settings.activeModel.id}
            </div>

            {settings.activeModel.fileName && (
              <div className="text-sm text-gray-500">
                File: {settings.activeModel.fileName}
              </div>
            )}

            {settings.activeModel.path && (
              <div className="text-sm text-gray-500 break-all">
                Path: {settings.activeModel.path}
              </div>
            )}

            <div className="text-sm text-gray-500">
              Type: {settings.activeModel.type}
            </div>

          </div>

        ) : (

          <div className="text-gray-500">
            No active model configured.
          </div>

        )}

      </div>


      <SaveButtons />

    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | Performance
  |--------------------------------------------------------------------------
  */

  const renderPerformanceSettings = () => (
    <div className="space-y-6">

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

        <h3 className="text-lg font-semibold tracking-tight mb-6">
          Performance
        </h3>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CPU Threads */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              CPU Threads:{" "}
              {settings.performance.cpuThreads}
            </label>

            <input
              type="range"
              min="1"
              max="32"
              step="1"
              value={
                settings.performance.cpuThreads
              }
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "cpuThreads",
                  Number(event.target.value)
                )
              }
              className="w-full accent-blue-600 cursor-pointer"
            />

          </div>


          {/* GPU Layers */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              GPU Layers:{" "}
              {settings.performance.gpuLayers}
            </label>

            <input
              type="number"
              min="0"
              max="999"
              step="1"
              value={
                settings.performance.gpuLayers
              }
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "gpuLayers",
                  Number(event.target.value)
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            />

            <p className="text-xs text-gray-500 mt-1">
              0 means CPU-only inference.
            </p>

          </div>


          {/* Context Size */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Context Size:{" "}
              {settings.performance.contextSize}
            </label>

            <input
              type="number"
              min="512"
              step="512"
              value={
                settings.performance.contextSize
              }
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "contextSize",
                  Number(event.target.value)
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            />

          </div>


          {/* Batch Size */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Batch Size:{" "}
              {settings.performance.batchSize}
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={
                settings.performance.batchSize
              }
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "batchSize",
                  Number(event.target.value)
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            />

          </div>

        </div>


        <div className="mt-8 space-y-4">

          {/* mmap */}

          <label className="flex items-center">

            <input
              type="checkbox"
              checked={
                settings.performance.mmap
              }
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "mmap",
                  event.target.checked
                )
              }
              className="
                rounded
                border-gray-300
                text-blue-600
                focus:ring-blue-500
              "
            />

            <span className="ml-2 text-sm">
              Memory Mapping (mmap)
            </span>

          </label>


          {/* mlock */}

          <label className="flex items-center">

            <input
              type="checkbox"
              checked={
                settings.performance.mlock
              }
              onChange={(event) =>
                updateNestedSetting(
                  "performance",
                  "mlock",
                  event.target.checked
                )
              }
              className="
                rounded
                border-gray-300
                text-blue-600
                focus:ring-blue-500
              "
            />

            <span className="ml-2 text-sm">
              Lock Model Memory (mlock)
            </span>

          </label>

        </div>

      </div>


      <SaveButtons
        label="Save Performance Settings"
        showRestart
      />

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
      <div className="space-y-6">

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

          <div className="flex items-center justify-between mb-6">

            <div>

              <h3 className="text-lg font-semibold tracking-tight">
                Available Models
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                Models currently listed in settings.json.
              </p>

            </div>


            <div className="
              text-sm
              px-3 py-1
              rounded-full
              bg-gray-100 dark:bg-gray-700
            ">
              {availableModels.length} model
              {availableModels.length === 1
                ? ""
                : "s"}
            </div>

          </div>


          {availableModels.length === 0 ? (

            <div className="
              text-center
              py-10
              text-gray-500
            ">
              No models are listed in settings.json.
            </div>

          ) : (

            <div className="space-y-3">

              {availableModels.map((model) => {

                const isActive =
                  settings.activeModel?.id ===
                  model.id;

                const isDeleting =
                  deletingModelId === model.id;

                return (
                  <div
                    key={model.id}
                    className={`
                      w-full
                      p-4
                      border
                      rounded-lg
                      transition-colors
                      ${
                        isActive
                          ? `
                            border-blue-500/70
                            bg-blue-50/80
                            shadow-md shadow-blue-500/10 dark:bg-blue-950/30
                          `
                          : `
                            border-slate-200 dark:border-slate-700/80
                            hover:border-gray-400
                            dark:hover:border-gray-500
                          `
                      }
                    `}
                  >

                    <div className="
                      flex
                      items-start
                      justify-between
                      gap-4
                    ">

                      {/* Model information */}

                      <button
                        type="button"
                        onClick={() =>
                          handleSetActiveModel(model)
                        }
                        disabled={
                          saving ||
                          deletingModelId !== null
                        }
                        className="
                          flex-1
                          min-w-0
                          text-left
                          disabled:opacity-50
                          disabled:cursor-not-allowed
                        "
                      >

                        <div className="font-medium">

                          {model.name ||
                            model.id}

                        </div>


                        <div className="
                          text-sm
                          text-gray-500
                          mt-1
                          break-all
                        ">

                          {model.fileName ||
                            model.id}

                        </div>


                        <div className="
                          text-xs
                          text-gray-500
                          mt-1
                          flex flex-wrap
                          gap-3
                        ">

                          {model.type && (
                            <span>
                              Type: {model.type}
                            </span>
                          )}

                          {model.size && (
                            <span>
                              Size: {model.size}
                            </span>
                          )}

                          {model.uploadedAt && (
                            <span>
                              Added:{" "}
                              {model.uploadedAt}
                            </span>
                          )}

                        </div>

                      </button>


                      {/* Right-side actions */}

                      <div className="
                        flex
                        items-center
                        gap-2
                        flex-shrink-0
                      ">

                        {isActive && (
                          <CheckCircle
                            className="
                              w-5 h-5
                              text-green-500
                            "
                            title="Active model"
                          />
                        )}


                        {/* Delete */}

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteModel(model)
                          }
                          disabled={
                            saving ||
                            deletingModelId !== null ||
                            isActive
                          }
                          title={
                            isActive
                              ? "Select another model before deleting this model"
                              : "Delete model"
                          }
                          className="
                            inline-flex
                            items-center
                            justify-center
                            gap-2
                            px-3
                            py-2
                            rounded-lg
                            border
                            border-red-200
                            dark:border-red-800
                            bg-red-50
                            dark:bg-red-900/20
                            text-red-600
                            dark:text-red-400
                            hover:bg-red-100
                            dark:hover:bg-red-900/40
                            hover:border-red-300
                            dark:hover:border-red-700
                            disabled:opacity-40
                            disabled:cursor-not-allowed
                            transition-colors
                          "
                        >

                          {isDeleting ? (
                            <RefreshCw
                              className="
                                w-4 h-4
                                animate-spin
                              "
                            />
                          ) : (
                            <Trash2
                              className="w-4 h-4"
                            />
                          )}

                          <span className="hidden sm:inline">
                            {isDeleting
                              ? "Deleting..."
                              : "Delete"}
                          </span>

                        </button>

                      </div>

                    </div>

                  </div>
                );
              })}

            </div>

          )}

        </div>


        {/* Active Model */}

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

          <h3 className="text-lg font-semibold tracking-tight mb-4">
            Active Model
          </h3>

          {settings.activeModel ? (

            <div className="
              p-4
              rounded-lg
              border
              border-blue-200
              dark:border-blue-800
              bg-blue-50/80 dark:bg-blue-950/30
            ">

              <div className="font-medium">
                {settings.activeModel.name ||
                  settings.activeModel.id}
              </div>

              <div className="text-sm text-gray-500 mt-1">
                {settings.activeModel.fileName}
              </div>

              <div className="text-xs text-gray-500 mt-1 break-all">
                {settings.activeModel.path}
              </div>

            </div>

          ) : (

            <div className="text-gray-500">
              No active model.
            </div>

          )}

        </div>


        {/* Model actions */}

        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            onClick={handleOpenModelsFolder}
            disabled={
              saving ||
              deletingModelId !== null
            }
            className="
              px-4 py-2
              bg-slate-700 hover:bg-slate-600
              disabled:bg-gray-400
              text-white
              rounded-lg
              transition-colors
              flex items-center gap-2
            "
          >

            <FolderOpen className="w-4 h-4" />

            Open Models Folder

          </button>


          <button
            type="button"
            onClick={handleApplyAndRestart}
            disabled={
              saving ||
              deletingModelId !== null
            }
            className="
              px-4 py-2
              bg-emerald-600 hover:bg-emerald-500
              disabled:bg-gray-400
              text-white
              rounded-lg
              transition-colors
              flex items-center gap-2
            "
          >

            <RotateCcw className="w-4 h-4" />

            {saving
              ? "Applying..."
              : "Apply & Restart"}

          </button>

        </div>

      </div>
    );
  };


  /*
  |--------------------------------------------------------------------------
  | Theme
  |--------------------------------------------------------------------------
  */

  const renderThemeSettings = () => (
    <div className="space-y-6">

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

        <h3 className="text-lg font-semibold tracking-tight mb-6">
          Appearance
        </h3>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Light */}

          <button
            type="button"
            disabled={
              saving ||
              deletingModelId !== null
            }
            onClick={() =>
              handleThemeChange("light")
            }
            className={`
              p-5
              border
              rounded-lg
              transition-colors
              ${
                settings.theme === "light"
                  ? `
                    border-blue-500
                    bg-blue-50
                    dark:bg-blue-900/20
                  `
                  : `
                    border-gray-200
                    dark:border-gray-700
                    hover:border-gray-400
                  `
              }
            `}
          >

            <Sun className="
              w-8 h-8
              mx-auto
              mb-3
              text-yellow-500
            " />

            <div className="font-medium">
              Light
            </div>

          </button>


          {/* Dark */}

          <button
            type="button"
            disabled={
              saving ||
              deletingModelId !== null
            }
            onClick={() =>
              handleThemeChange("dark")
            }
            className={`
              p-5
              border
              rounded-lg
              transition-colors
              ${
                settings.theme === "dark"
                  ? `
                    border-blue-500
                    bg-blue-50
                    dark:bg-blue-900/20
                  `
                  : `
                    border-gray-200
                    dark:border-gray-700
                    hover:border-gray-400
                  `
              }
            `}
          >

            <Moon className="
              w-8 h-8
              mx-auto
              mb-3
              text-blue-500
            " />

            <div className="font-medium">
              Dark
            </div>

          </button>


          {/* System */}

          <button
            type="button"
            disabled={
              saving ||
              deletingModelId !== null
            }
            onClick={() =>
              handleThemeChange("system")
            }
            className={`
              p-5
              border
              rounded-lg
              transition-colors
              ${
                settings.theme === "system"
                  ? `
                    border-blue-500
                    bg-blue-50
                    dark:bg-blue-900/20
                  `
                  : `
                    border-gray-200
                    dark:border-gray-700
                    hover:border-gray-400
                  `
              }
            `}
          >

            <Monitor className="
              w-8 h-8
              mx-auto
              mb-3
              text-gray-500
            " />

            <div className="font-medium">
              System
            </div>

          </button>

        </div>

      </div>


      <SaveButtons
        label="Save Appearance"
      />

    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | Chat
  |--------------------------------------------------------------------------
  */

  const renderChatSettings = () => (
    <div className="space-y-6">

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

        <h3 className="text-lg font-semibold tracking-tight mb-6">
          Chat Generation
        </h3>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Max Tokens */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Max Tokens:{" "}
              {settings.chat.maxTokens}
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={
                settings.chat.maxTokens
              }
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "maxTokens",
                  Number(event.target.value)
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            />

          </div>


          {/* Temperature */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Temperature:{" "}
              {settings.chat.temperature}
            </label>

            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={
                settings.chat.temperature
              }
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "temperature",
                  Number(event.target.value)
                )
              }
              className="w-full accent-blue-600 cursor-pointer"
            />

          </div>


          {/* Top P */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Top P:{" "}
              {settings.chat.topP}
            </label>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={
                settings.chat.topP
              }
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "topP",
                  Number(event.target.value)
                )
              }
              className="w-full accent-blue-600 cursor-pointer"
            />

          </div>


          {/* Top K */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Top K:{" "}
              {settings.chat.topK}
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={
                settings.chat.topK
              }
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "topK",
                  Number(event.target.value)
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            />

          </div>


          {/* Context Window */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Context Window:{" "}
              {settings.chat.contextWindow}
            </label>

            <input
              type="number"
              min="512"
              step="512"
              value={
                settings.chat.contextWindow
              }
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "contextWindow",
                  Number(event.target.value)
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            />

          </div>

        </div>


        <div className="mt-8 space-y-5">

          {/* Memory */}

          <div>

            <label
              htmlFor="chat-memory-mode"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
            >
              Conversation Memory
            </label>

            <select
              id="chat-memory-mode"
              value={settings.chat.memoryMode || "chat"}
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "memoryMode",
                  event.target.value
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
              "
            >
              <option value="off">Off</option>
              <option value="chat">This chat only (recommended)</option>
              <option value="application">All chats in this application</option>
            </select>

            <p className="text-xs text-gray-500 mt-2">
              Uses only conversations stored locally in this application.
              Deleting a chat also removes it from application memory.
            </p>

          </div>

          {/* Stream */}

          <label className="flex items-center">

            <input
              type="checkbox"
              checked={
                settings.chat.streamResponses
              }
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "streamResponses",
                  event.target.checked
                )
              }
              className="
                rounded
                border-gray-300
                text-blue-600
                focus:ring-blue-500
              "
            />

            <span className="ml-2 text-sm">
              Stream Responses
            </span>

          </label>


          {/* System Prompt */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              System Prompt
            </label>

            <textarea
              rows={6}
              value={
                settings.chat.systemPrompt ?? ""
              }
              onChange={(event) =>
                updateNestedSetting(
                  "chat",
                  "systemPrompt",
                  event.target.value
                )
              }
              className="
                w-full
                px-3 py-2
                border border-gray-300 dark:border-gray-600
                rounded-lg
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
                resize-y
              "
            />

          </div>

        </div>

      </div>


      <SaveButtons
        label="Save Chat Settings"
        showRestart
      />

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
            {/* User Profile */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">
              <h3 className="text-lg font-semibold tracking-tight mb-6">
                Your Profile
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Avatar */}
                <div className="flex flex-col items-center">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                    Profile Photo
                  </label>
                  <div className="relative h-24 w-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
                    {userPhotoPreview ? (
                      <img
                        src={userPhotoPreview}
                        alt="User profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No photo</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUserPhotoChange}
                    className="mt-3 text-sm"
                  />
                </div>

                <div className="space-y-4">
                  {/* User Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={settings.profile?.userName || ""}
                      onChange={(e) =>
                        updateNestedSetting("profile", "userName", e.target.value)
                      }
                      placeholder="Enter your name"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* User About */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      About You
                    </label>
                    <textarea
                      value={settings.profile?.userAbout || ""}
                      onChange={(e) =>
                        updateNestedSetting("profile", "userAbout", e.target.value)
                      }
                      placeholder="Brief description about yourself"
                      rows="3"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Identity */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">
              <h3 className="text-lg font-semibold tracking-tight mb-6">
                AI Identity
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Avatar */}
                <div className="flex flex-col items-center">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                    AI Photo
                  </label>
                  <div className="relative h-24 w-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
                    {aiPhotoPreview ? (
                      <img
                        src={aiPhotoPreview}
                        alt="AI profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No photo</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAiPhotoChange}
                    className="mt-3 text-sm"
                  />
                </div>

                <div className="space-y-4">
                  {/* AI Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      AI Name
                    </label>
                    <input
                      type="text"
                      value={settings.profile?.aiName || ""}
                      onChange={(e) =>
                        updateNestedSetting("profile", "aiName", e.target.value)
                      }
                      placeholder="AI name (e.g., OffyAI)"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* AI About */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      About AI
                    </label>
                    <textarea
                      value={settings.profile?.aiAbout || ""}
                      onChange={(e) =>
                        updateNestedSetting("profile", "aiAbout", e.target.value)
                      }
                      placeholder="Brief description of the AI"
                      rows="3"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* User Context Injection */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">
              <h3 className="text-lg font-semibold tracking-tight mb-4">
                Chat Context
              </h3>

              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.profile?.includeUserContext || false}
                  onChange={(e) =>
                    updateNestedSetting("profile", "includeUserContext", e.target.checked)
                  }
                  className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Include my profile in system prompt
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Your name and about text will be prepended to the AI&apos;s system prompt, providing context about you.
                  </span>
                </div>
              </label>
            </div>

            <SaveButtons label="Save Profile Settings" />
          </div>
        );
  };

  const renderUISettings = () => (
    <div className="space-y-6">

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

        <h3 className="text-lg font-semibold tracking-tight mb-6">
          Interface
        </h3>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Font size */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Font Size:{" "}
              {settings.ui.fontSize}px
            </label>

            <input
              type="range"
              min="10"
              max="24"
              step="1"
              value={
                settings.ui.fontSize
              }
              onChange={(event) =>
                updateNestedSetting(
                  "ui",
                  "fontSize",
                  Number(event.target.value)
                )
              }
              className="w-full accent-blue-600 cursor-pointer"
            />

          </div>


          {/* Sidebar */}

          <div>

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Sidebar Width:{" "}
              {settings.ui.sidebarWidth}px
            </label>

            <input
              type="range"
              min="180"
              max="500"
              step="10"
              value={
                settings.ui.sidebarWidth
              }
              onChange={(event) =>
                updateNestedSetting(
                  "ui",
                  "sidebarWidth",
                  Number(event.target.value)
                )
              }
              className="w-full accent-blue-600 cursor-pointer"
            />

          </div>

        </div>


      </div>


      <SaveButtons
        label="Save Interface Settings"
      />

    </div>
  );


  /*
  |--------------------------------------------------------------------------
  | Security
  |--------------------------------------------------------------------------
  */

  const renderSecuritySettings = () => (
    <div className="space-y-6">

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)] dark:shadow-black/20 backdrop-blur-sm p-6 sm:p-7 transition-all duration-200">

        <h3 className="text-lg font-semibold tracking-tight mb-6">
          Security
        </h3>


        <div className="space-y-6">

          <label className="flex items-center">

            <input
              type="checkbox"
              checked={
                settings.security.encryptLocalData
              }
              onChange={(event) =>
                updateNestedSetting(
                  "security",
                  "encryptLocalData",
                  event.target.checked
                )
              }
              className="
                rounded
                border-gray-300
                text-blue-600
                focus:ring-blue-500
              "
            />

            <span className="ml-2 text-sm">
              Encrypt Local Data
            </span>

          </label>


          <label className="flex items-center">

            <input
              type="checkbox"
              checked={
                settings.security.autoClearHistory
              }
              onChange={(event) =>
                updateNestedSetting(
                  "security",
                  "autoClearHistory",
                  event.target.checked
                )
              }
              className="
                rounded
                border-gray-300
                text-blue-600
                focus:ring-blue-500
              "
            />

            <span className="ml-2 text-sm">
              Auto-clear Chat History
            </span>

          </label>


          <label className="flex items-center">

            <input
              type="checkbox"
              checked={
                settings.security.clearOnExit
              }
              onChange={(event) =>
                updateNestedSetting(
                  "security",
                  "clearOnExit",
                  event.target.checked
                )
              }
              className="
                rounded
                border-gray-300
                text-blue-600
                focus:ring-blue-500
              "
            />

            <span className="ml-2 text-sm">
              Clear Data on Exit
            </span>

          </label>


          <label className="flex items-center">

            <input
              type="checkbox"
              checked={
                settings.security.blockTracking
              }
              onChange={(event) =>
                updateNestedSetting(
                  "security",
                  "blockTracking",
                  event.target.checked
                )
              }
              className="
                rounded
                border-gray-300
                text-blue-600
                focus:ring-blue-500
              "
            />

            <span className="ml-2 text-sm">
              Block Tracking
            </span>

          </label>

        </div>

      </div>


      <SaveButtons
        label="Save Security Settings"
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
      <div className="
        fixed
        inset-0
        bg-slate-950/70 flex items-center justify-center z-50 p-4 sm:p-6 backdrop-blur-md
      ">

        <div className="
          bg-white
          dark:bg-gray-800
          rounded-xl
          p-8
          shadow-xl
          flex
          flex-col
          items-center
          gap-3
        ">

          <RefreshCw
            className="
              w-6 h-6
              text-blue-500
              animate-spin
            "
          />

          <span className="
            text-gray-700
            dark:text-gray-300
          ">
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
    {
      id: "general",
      label: "General",
      icon: SettingsIcon
    },
    {
      id: "performance",
      label: "Performance",
      icon: Zap
    },
    {
      id: "models",
      label: "Models",
      icon: Cpu
    },
    {
      id: "profile",
      label: "Profile",
      icon: User
    },
    {
      id: "theme",
      label: "Appearance",
      icon: Palette
    },
    {
      id: "ui",
      label: "Interface",
      icon: Layout
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare
    },
  ];


  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="
      fixed
      inset-0
      bg-black
      bg-opacity-50
      flex
      items-center
      justify-center
      z-50
      p-4
      backdrop-blur-sm
    ">

      <div className="
        bg-white/95 dark:bg-slate-950/95 rounded-3xl border border-white/20 dark:border-slate-700/70 w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-slate-950/20 dark:shadow-black/40 backdrop-blur-xl
      ">


        {/* Header */}

        <div className="
          flex
          items-center
          justify-between
          p-5 sm:p-6
          border-b border-slate-200 dark:border-slate-800
        ">

          <div className="
            flex
            items-center
            gap-3
          ">

            <div className="
              p-2
              bg-blue-100
              dark:bg-blue-900/30
              rounded-lg
            ">

              <SettingsIcon
                className="
                  w-6 h-6
                  text-blue-600
                  dark:text-blue-400
                "
              />

            </div>


            <div>

              <h2 className="
                text-xl
                font-semibold
                text-gray-900
                dark:text-white
              ">
                Settings
              </h2>

              <p className="
                text-sm
                text-gray-500
                dark:text-gray-400
              ">
                Loaded directly from settings.json
              </p>

            </div>

          </div>


          <button
            type="button"
            onClick={onClose}
            disabled={
              saving ||
              deletingModelId !== null
            }
            className="
              p-2
              hover:bg-gray-100
              dark:hover:bg-gray-700
              rounded-lg
              transition-colors
              disabled:opacity-50
            "
          >

            <X className="
              w-5 h-5
              text-gray-500
              dark:text-gray-400
            " />

          </button>

        </div>


        {/* Message */}

        {message.text && (
          <div className={`
            mx-6
            mt-4
            p-3
            rounded-lg
            border
            ${
              message.type === "success"
                ? `
                  bg-green-50
                  border-green-200
                  text-green-800
                  dark:bg-green-900/20
                  dark:border-green-800
                  dark:text-green-200
                `
                : `
                  bg-red-50
                  border-red-200
                  text-red-800
                  dark:bg-red-900/20
                  dark:border-red-800
                  dark:text-red-200
                `
            }
          `}>

            <div className="
              flex
              items-center
              gap-2
            ">

              {message.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}

              <span className="text-sm">
                {message.text}
              </span>

            </div>

          </div>
        )}


        {/* Tabs */}

        <div className="
          flex
          border-b border-slate-200 dark:border-slate-800
          overflow-x-auto
        ">

          {tabs.map((tab) => {

            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(tab.id)
                }
                disabled={
                  saving ||
                  deletingModelId !== null
                }
                className={`
                  flex
                  items-center
                  gap-2
                  px-4
                  py-3
                  font-medium
                  border-b-2
                  transition-colors
                  whitespace-nowrap
                  disabled:opacity-50
                  ${
                    activeTab === tab.id
                      ? `
                        border-blue-500
                        text-blue-600
                        dark:text-blue-400
                      `
                      : `
                        border-transparent
                        text-gray-500
                        dark:text-gray-400
                        hover:text-gray-700
                        dark:hover:text-gray-300
                      `
                  }
                `}
              >

                <Icon className="w-4 h-4" />

                {tab.label}

              </button>
            );
          })}

        </div>


        {/* Content */}

        <div className="
          flex-1
          overflow-y-auto
          p-6
        ">

          {activeTab === "general" &&
            renderGeneralSettings()}

          {activeTab === "performance" &&
            renderPerformanceSettings()}

          {activeTab === "models" &&
            renderModelSettings()}
          {activeTab === "profile" &&
            renderProfileSettings()}


          {activeTab === "theme" &&
            renderThemeSettings()}

          {activeTab === "ui" &&
            renderUISettings()}

          {activeTab === "chat" &&
            renderChatSettings()}

        </div>

      </div>

    </div>
  );
};


export default SettingsModal;