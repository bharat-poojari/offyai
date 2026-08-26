import Head from "next/head";
import { useEffect, useState, useCallback } from "react";

import Layout from "../components/layout/Layout";
import ChatInterface from "../components/chat/ChatInterface";
import MetricsPanel from "../components/monitoring/MetricsPanel";
import { RealTimeCharts } from "../components/monitoring/RealTimeCharts";

import { useLocalStorage } from "../hooks/useLocalStorage";
import { useChat } from "../hooks/useChat";
import { useMetrics } from "../hooks/useMetrics";

import {
  SETTINGS_KEY,
  DEFAULT_MODEL,
} from "../utils/constants";

import { systemAPI } from "../utils/api";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const formatModelName = (modelData) => {
  if (!modelData) {
    return "No model selected";
  }

  /*
   * Direct string model name.
   */
  if (typeof modelData === "string") {
    const value = modelData.trim();

    if (!value) {
      return "No model selected";
    }

    /*
     * If it is already a friendly model name, preserve it.
     */
    if (
      !value.includes(".gguf") &&
      !value.includes(".bin") &&
      !value.includes("/") &&
      !value.includes("\\")
    ) {
      return value;
    }

    return cleanModelName(value);
  }

  /*
   * Object model information.
   */
  if (typeof modelData === "object") {
    if (
      modelData.modelName &&
      modelData.modelName !== "unknown"
    ) {
      return formatModelName(
        modelData.modelName
      );
    }

    if (modelData.name) {
      return cleanModelName(
        modelData.name
      );
    }

    if (
      modelData.id &&
      modelData.id !== "unknown"
    ) {
      return cleanModelName(
        modelData.id
      );
    }

    if (
      modelData.model &&
      modelData.model !== "unknown"
    ) {
      return cleanModelName(
        modelData.model
      );
    }
  }

  return "Unknown Model";
};

const cleanModelName = (value) => {
  if (!value) {
    return "Unknown Model";
  }

  let name = String(value);

  /*
   * Remove directory portion.
   */
  name = name.split(/[\\/]/).pop();

  /*
   * Remove common model file extensions.
   */
  name = name
    .replace(/\.gguf$/i, "")
    .replace(/\.bin$/i, "");

  /*
   * Convert separators into spaces.
   */
  name = name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /*
   * Capitalize words without modifying the remainder excessively.
   */
  if (!name) {
    return "Unknown Model";
  }

  return name.replace(
    /\b\w/g,
    (letter) => letter.toUpperCase()
  );
};

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

const Home = () => {
  const [currentView, setCurrentView] =
    useState("chat");

  /*
   * useMetrics is responsible for application metrics.
   *
   * It should NOT be used as a backend health check.
   */
  const {
    metrics,
    history,
    isConnected,
    refresh,
  } = useMetrics();

  /*
   * Application status is maintained in ONE place only.
   *
   * There is deliberately no separate backend status.
   */
  const [appStatus, setAppStatus] =
    useState({
      ready: false,
      electron: false,
      aiConnected: false,
      backend: false,
      llama: false,
      error: null,
    });

  const [settings, setSettings] =
    useLocalStorage(
      SETTINGS_KEY,
      {
        apiKey: "",
        model: DEFAULT_MODEL,
        serverUrl:
          "http://localhost:8080",
      }
    );

  const [currentModelName, setCurrentModelName] =
    useState("No model selected");

  const {
    chatSessions,
    currentSessionId,
    messages,
    isLoading,
    error,
    sendMessage,
    createNewChat,
    switchToChat,
    deleteChat,
    deleteAllChats,
    stopGeneration,
    setCurrentSessionId,
  } = useChat();

  /* ---------------------------------------------------------------------- */
  /* Electron detection                                                     */
  /* ---------------------------------------------------------------------- */

  const isElectron =
    typeof window !== "undefined" &&
    Boolean(window.electronAPI);

  /* ---------------------------------------------------------------------- */
  /* Application status                                                     */
  /* ---------------------------------------------------------------------- */

  const checkApplicationStatus =
    useCallback(async () => {
      try {
        /*
         * This is now the ONLY status check performed by Home.
         *
         * systemAPI.getServerStatus() has already been modified to use
         * Electron IPC instead of assuming localhost:3001.
         */
        const status =
          await systemAPI.getServerStatus();

        const electron =
          typeof window !== "undefined" &&
          Boolean(window.electronAPI);

        /*
         * Electron itself is the application host.
         *
         * Therefore backend:false must NOT automatically mean
         * application disconnected.
         */
        const ready =
          electron
            ? true
            : Boolean(status?.backend);

        const aiConnected =
          Boolean(
            status?.aiConnected ??
            status?.llama ??
            false
          );

        setAppStatus({
          ready,
          electron,
          aiConnected,
          backend:
            Boolean(status?.backend),
          llama:
            Boolean(status?.llama),
          error:
            status?.error || null,
        });
      } catch (error) {
        console.error(
          "Failed to check application status:",
          error
        );

        /*
         * Do not make Electron appear broken simply because
         * an optional status handler is unavailable.
         */
        const electron =
          typeof window !== "undefined" &&
          Boolean(window.electronAPI);

        setAppStatus({
          ready: electron,
          electron,
          aiConnected: false,
          backend: false,
          llama: false,
          error:
            error?.message ||
            "Unable to determine application status.",
        });
      }
    }, []);

  useEffect(() => {
    let mounted = true;

    const runStatusCheck = async () => {
      if (!mounted) {
        return;
      }

      await checkApplicationStatus();
    };

    runStatusCheck();

    /*
     * One status poller only.
     *
     * Five seconds is retained for compatibility with the previous
     * behavior, but Layout.js no longer has another poller.
     */
    const interval = setInterval(
      runStatusCheck,
      5000
    );

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [checkApplicationStatus]);

  /* ---------------------------------------------------------------------- */
  /* Model name                                                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let modelData = null;

    if (
      metrics?.modelName &&
      metrics.modelName !== "unknown"
    ) {
      modelData = metrics;
    } else if (
      metrics?.model &&
      metrics.model !== "unknown"
    ) {
      modelData = metrics.model;
    } else {
      modelData = settings?.model;
    }

    setCurrentModelName(
      formatModelName(modelData)
    );
  }, [
    metrics?.model,
    metrics?.modelName,
    settings?.model,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Chat callbacks                                                          */
  /* ---------------------------------------------------------------------- */

  const onCreateNewChat = useCallback(() => {
    createNewChat();
  }, [createNewChat]);

  const onSwitchChat = useCallback(
    (id) => {
      switchToChat(id);
    },
    [switchToChat]
  );

  const onDeleteChat = useCallback(
    (id) => {
      deleteChat(id);
    },
    [deleteChat]
  );

  const onClearAllChats = useCallback(() => {
    deleteAllChats();
  }, [deleteAllChats]);

  /* ---------------------------------------------------------------------- */
  /* Current chat                                                            */
  /* ---------------------------------------------------------------------- */

  const currentChat =
    chatSessions.find(
      (chat) =>
        chat.id === currentSessionId
    ) || null;

  const currentModel =
    settings?.model ||
    DEFAULT_MODEL;

  /* ---------------------------------------------------------------------- */
  /* Connection state                                                        */
  /* ---------------------------------------------------------------------- */

  /*
   * IMPORTANT:
   *
   * Do not use:
   *
   *   isConnected && serverStatus.backend
   *
   * because backend no longer exists in the Electron architecture.
   *
   * Metrics connectivity and application readiness are separate concepts.
   */
  const effectiveIsConnected =
    isElectron
      ? Boolean(
          appStatus.ready &&
          (
            isConnected ||
            appStatus.aiConnected ||
            !appStatus.error
          )
        )
      : Boolean(
          isConnected &&
          appStatus.ready
        );

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <>
      <Head>
        <title>
          OffyAI - Modern AI Web UI
        </title>

        <meta
          name="description"
          content="Advanced AI chat interface with real-time monitoring"
        />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
      </Head>

      <div className="w-full h-full text-sm">
        <Layout
          currentView={currentView}
          onViewChange={setCurrentView}
          isConnected={
            effectiveIsConnected
          }
          currentModel={
            currentModelName
          }
          chatSessions={
            chatSessions
          }
          currentSessionId={
            currentSessionId
          }
          onCreateNewChat={
            onCreateNewChat
          }
          onSwitchChat={
            onSwitchChat
          }
          onDeleteChat={
            onDeleteChat
          }
          onClearAllChats={
            onClearAllChats
          }
        >
          {currentView ===
            "chat" && (
            <ChatInterface
              currentChat={
                currentChat
              }
              messages={messages}
              isLoading={
                isLoading
              }
              error={error}
              sendMessage={async (
                text,
                model,
                attachments
              ) =>
                sendMessage(
                  text,
                  model,
                  attachments
                )
              }
              stopGeneration={
                stopGeneration
              }
            />
          )}

          {currentView ===
            "metrics" && (
            <div className="p-4 space-y-4 h-full overflow-auto custom-scrollbar">
              <MetricsPanel
                metrics={metrics}
                isConnected={
                  effectiveIsConnected
                }
              />

              <RealTimeCharts
                history={history}
                metrics={metrics}
              />
            </div>
          )}
        </Layout>
      </div>
    </>
  );
};

export default Home;