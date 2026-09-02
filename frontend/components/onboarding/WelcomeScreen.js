import React, { memo, useMemo, useEffect, useCallback } from "react";
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Cpu,
  ShieldCheck,
  BarChart3,
  Paperclip,
} from "lucide-react";
/* The onboarding image is resolved dynamically for Electron and web builds. */
/* eslint-disable @next/next/no-img-element */
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
import { resolveImagePath } from "../../utils/imageResolver";

const WelcomeScreen = memo(({ onContinue, onOpenManual }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  /* ---------------------------------------------------------------------- */
  /* Static Data Memoization                                               */
  /* ---------------------------------------------------------------------- */

  const features = useMemo(
    () => [
      {
        icon: MessageSquare,
        title: "Private chat",
        description: "Conversations stay in your local workspace.",
      },
      {
        icon: Cpu,
        title: "Local models",
        description: "Run supported GGUF models on your machine.",
      },
      {
        icon: Paperclip,
        title: "File context",
        description: "Attach files directly to your conversations.",
      },
      {
        icon: BarChart3,
        title: "Live analytics",
        description: "Monitor generation and connection activity.",
      },
    ],
    []
  );

  /* ---------------------------------------------------------------------- */
  /* Event Handlers & Accessibility                                        */
  /* ---------------------------------------------------------------------- */

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onContinue?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContinue]);

  // Prevent backdrop clicks from propagating when clicking inside the modal
  const handleModalClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <AnimatePresence>
      <div
        onClick={onContinue}
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-colors duration-300 ${
          "bg-black/55"
        } backdrop-blur-md`}
      >
        {/* Subtle ambient lighting */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[15%] top-[15%] h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          <div className="absolute bottom-[10%] right-[15%] h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <motion.div
          onClick={handleModalClick}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{
            duration: 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          className={`relative w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${
            "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-black/20"
          }`}
        >
          {/* -------------------------------------------------------------- */}
          {/* HEADER                                                         */}
          {/* -------------------------------------------------------------- */}

          <div className="relative overflow-hidden bg-[var(--primary)] px-6 py-6 text-[var(--primary-foreground)] sm:px-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
                <img
                  src={resolveImagePath("images/offyai.png")}
                  alt="OffyAI"
                  className="h-8 w-8 object-contain"
                  draggable="false"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                  OffyAI
                </p>

                <h1
                  id="welcome-title"
                  className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]"
                >
                  Your private AI workspace.
                </h1>

                <p className="mt-2 max-w-md text-xs leading-5 opacity-85 sm:text-sm">
                  Run local models, chat privately, and work with your files
                  from one focused workspace.
                </p>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* CONTENT                                                        */}
          {/* -------------------------------------------------------------- */}

          <div className="px-6 py-5 sm:px-7 sm:py-6">
            <div className="mb-4">
              <h2
                className={`text-sm font-semibold ${
                  "text-[var(--text-primary)]"
                }`}
              >
                Everything you need
              </h2>

              <p
                className={`mt-1 text-xs ${
                  "text-[var(--text-secondary)]"
                }`}
              >
                A streamlined workspace for local AI.
              </p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {features.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.08 + index * 0.04,
                      duration: 0.25,
                    }}
                    className={`group rounded-xl border p-3 transition-all duration-200 ${
                      "border-[var(--border)] bg-[var(--surface-raised)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface)]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          "bg-[var(--accent-subtle)] text-[var(--primary)] group-hover:bg-[var(--accent)]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <h3
                          className={`text-xs font-semibold ${
                            "text-[var(--text-primary)]"
                          }`}
                        >
                          {feature.title}
                        </h3>

                        <p
                          className={`mt-0.5 text-[11px] leading-4 ${
                            "text-[var(--text-secondary)]"
                          }`}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ACTIONS                                                      */}
            {/* ------------------------------------------------------------ */}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onOpenManual}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--primary)]/50 hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <BookOpen className="h-3.5 w-3.5" />
                User manual
              </button>

              <button
                type="button"
                onClick={onContinue}
                className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-xs font-semibold text-[var(--primary-foreground)] shadow-lg shadow-[color:rgba(15,156,143,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--primary-hover)] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
              >
                Start using OffyAI
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* Minimal trust indicator */}
            <div
              className={`mt-4 flex items-center justify-center gap-1.5 text-[10px] ${
                "text-[var(--text-secondary)]"
              }`}
            >
              <ShieldCheck className="h-3 w-3" />
              Local-first AI workspace
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

WelcomeScreen.displayName = "WelcomeScreen";

export default WelcomeScreen;