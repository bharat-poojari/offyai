import React from "react";
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Cpu,
  ShieldCheck,
  BarChart3,
  Paperclip,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
import { resolveImagePath } from "../../utils/imageResolver";

const WelcomeScreen = ({ onContinue, onOpenManual }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const features = [
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
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${
        isDark ? "bg-black/75" : "bg-slate-950/55"
      } backdrop-blur-md`}
    >
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[15%] top-[15%] h-56 w-56 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute bottom-[10%] right-[15%] h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.3,
          ease: [0.22, 1, 0.36, 1],
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className={`relative w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${
          isDark
            ? "border-white/10 bg-gray-950 text-white shadow-black/50"
            : "border-gray-200 bg-white text-gray-900 shadow-slate-900/20"
        }`}
      >
        {/* -------------------------------------------------------------- */}
        {/* HEADER                                                         */}
        {/* -------------------------------------------------------------- */}

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-6 py-6 sm:px-7">
          {/* Small decorative glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex items-start gap-4">
            {/* Real OffyAI Logo */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
              <img
                src={resolveImagePath("images/offyai.png")}
                alt="OffyAI"
                className="h-8 w-8 object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100">
                OffyAI
              </p>

              <h1
                id="welcome-title"
                className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[28px]"
              >
                Your private AI workspace.
              </h1>

              <p className="mt-2 max-w-md text-xs leading-5 text-blue-100 sm:text-sm">
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
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Everything you need
            </h2>

            <p
              className={`mt-1 text-xs ${
                isDark ? "text-gray-500" : "text-gray-500"
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
                    isDark
                      ? "border-gray-800 bg-gray-900/70 hover:border-gray-700 hover:bg-gray-900"
                      : "border-gray-200 bg-gray-50/70 hover:border-gray-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isDark
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <h3
                        className={`text-xs font-semibold ${
                          isDark ? "text-gray-100" : "text-gray-900"
                        }`}
                      >
                        {feature.title}
                      </h3>

                      <p
                        className={`mt-0.5 text-[11px] leading-4 ${
                          isDark ? "text-gray-500" : "text-gray-500"
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
          {/* ACTIONS                                                       */}
          {/* ------------------------------------------------------------ */}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onOpenManual}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-medium transition-all ${
                isDark
                  ? "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              User manual
            </button>

            <button
              type="button"
              onClick={onContinue}
              className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Start using OffyAI

              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Minimal trust indicator */}
          <div
            className={`mt-4 flex items-center justify-center gap-1.5 text-[10px] ${
              isDark ? "text-gray-600" : "text-gray-400"
            }`}
          >
            <ShieldCheck className="h-3 w-3" />
            Local-first AI workspace
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WelcomeScreen;
