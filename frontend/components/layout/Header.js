/* The Electron-resolved app icon is a dynamic URL. */
/* eslint-disable @next/next/no-img-element */
// Header.js
import React, { useEffect, useMemo, useState } from "react";
import { Settings, Upload, Cpu, RefreshCw } from "lucide-react";
import { useModel } from "../../contexts/ModelContext";

// Extracted helper function outside the component to avoid recreating it on every render
const formatModelName = (model) => {
  if (!model) return "No model selected";

  const name = model.name || model.id || "Unknown Model";

  return name
    .replace(/\.(gguf|bin|ggml)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const Header = ({
  isConnected,
  onToggleSidebar,
  onSettingsOpen,
  onModelUploadOpen,
  onChangeModel,
}) => {
  const [appIcon, setAppIcon] = useState(null);
  const { currentModel, isLoading } = useModel();

  useEffect(() => {
    let isMounted = true;

    const loadAppIcon = async () => {
      if (!window.electronAPI?.getAppIcon) return;

      try {
        const iconData = await window.electronAPI.getAppIcon();
        if (isMounted && iconData) {
          setAppIcon(iconData);
        }
      } catch (error) {
        console.error("Failed to load app icon:", error);
      }
    };

    loadAppIcon();

    return () => {
      isMounted = false;
    };
  }, []);

  const modelName = useMemo(
    () => (currentModel ? formatModelName(currentModel) : "No model selected"),
    [currentModel]
  );

  const hasModel = Boolean(currentModel) && modelName !== "No model selected";

  return (
    <header className="relative z-30 border-b border-[var(--border)] bg-[var(--header-bg)] px-4 py-2 backdrop-blur-xl shadow-[0_1px_3px_rgba(31,30,28,0.04)]">
      {/* Top ambient highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent" />

      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Brand & Status */}
        <div className="flex min-w-0 items-center gap-3">
          {/* App Branding */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-[var(--surface-raised)] ring-1 ring-[var(--border)]">
              <img
                src={appIcon || "images/offyai.png"}
                alt="OffyAI Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
              OffyAI
            </h1>
          </div>

          {/* Desktop Status Bar */}
          <div className="hidden min-w-0 items-center gap-2.5 md:flex">
            {/* Connection Indicator */}
            <div
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${
                isConnected
                  ? "border-green-200/70 bg-green-50/80 text-green-700 hover:border-green-300 hover:bg-green-100/80 dark:border-green-900/60 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                  : "border-red-200/70 bg-red-50/80 text-red-700 hover:border-red-300 hover:bg-red-100/80 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              }`}
              title={isConnected ? "Backend connected" : "Backend disconnected"}
            >
              <span className="relative flex h-1.5 w-1.5">
                {isConnected && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-green-400/60" />
                )}
                <span
                  className={`relative h-1.5 w-1.5 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              </span>
              <span>{isConnected ? "Connected" : "Disconnected"}</span>
            </div>

            {/* Active Model Indicator */}
            {hasModel && (
              <div
                className="group flex min-w-0 max-w-[260px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--accent-subtle)] px-2.5 py-1 text-[var(--text-primary)] shadow-sm transition-all duration-200 hover:bg-[var(--surface-raised)]"
                title={modelName}
              >
                <Cpu className="h-3 w-3 shrink-0 text-[var(--primary)] transition-transform duration-200 group-hover:scale-110" />
                <span className="truncate text-[11px] font-medium">
                  {isLoading ? "Loading..." : modelName}
                </span>
                {isLoading && (
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--primary)]" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Upload Button */}
          <button
            type="button"
            onClick={onModelUploadOpen}
            aria-label="Upload Model"
            title="Upload Model"
            className="group flex items-center gap-1.5 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-green-600/10 transition-all duration-200 hover:-translate-y-px hover:bg-green-700 hover:shadow-md hover:shadow-green-600/15 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            <Upload className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Change Model Button */}
          <button
            type="button"
            onClick={onChangeModel || onSettingsOpen}
            aria-label="Change Model"
            title="Change Model"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--accent-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span className="hidden sm:inline">Change model</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onSettingsOpen}
            aria-label="Open settings"
            title="Settings"
            className="group flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
          </button>
        </div>
      </div>

      {/* Mobile Status Bar */}
      <div className="mt-1.5 flex items-center gap-3 border-t border-gray-100/70 bg-gray-50/50 pt-1.5 dark:border-gray-700/50 dark:bg-gray-900/20 md:hidden">
        {/* Connection */}
        <div
          className={`flex items-center gap-1.5 ${
            isConnected
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {isConnected && (
              <span className="absolute inset-0 animate-ping rounded-full bg-green-400/60" />
            )}
            <span
              className={`relative h-1.5 w-1.5 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </span>
          <span className="text-[10px] font-medium">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Model */}
        {hasModel && (
          <>
            <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
            <div
              className="flex min-w-0 items-center gap-1.5 text-[var(--primary)]"
              title={modelName}
            >
              <Cpu className="h-3 w-3 shrink-0" />
              <span className="truncate text-[10px] font-medium">
                {isLoading ? "Loading..." : modelName}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Progress Bar for Loading */}
      {isLoading && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px overflow-hidden bg-[var(--accent-subtle)]">
          <div className="h-full w-full animate-pulse bg-gradient-to-r from-[var(--primary)] via-[var(--primary-hover)] to-[var(--accent)]" />
        </div>
      )}
    </header>
  );
};

export default Header;