import React from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Download,
  HelpCircle,
  Code2,
  Cpu,
  FileText,
  FolderOpen,
  Gauge,
  Keyboard,
  MessageSquare,
  Paperclip,
  PanelLeft,
  Play,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const helpSections = [
  {
    title: "Chat",
    icon: MessageSquare,
    color: "blue",
    description:
      "Start conversations, switch between sessions, and continue previous work without losing context.",
    steps: [
      "Create a new chat from the sidebar.",
      "Type a prompt and press Enter to send.",
      "Use Shift + Enter when you need a new line.",
      "Switch between conversations from Recent Chats.",
    ],
  },
  {
    title: "Models",
    icon: Cpu,
    color: "violet",
    description:
      "Run supported local GGUF models through your local model server.",
    steps: [
      "Use Upload Model in the sidebar footer.",
      "Choose a .gguf, .bin, or .ggml file up to 10 GB.",
      "The desktop application starts the local model server during launch.",
      "Select the active model in Settings after it is loaded.",
    ],
  },
  {
    title: "Files",
    icon: Paperclip,
    color: "emerald",
    description:
      "Attach supported files directly to your prompts and keep them associated with the conversation.",
    steps: [
      "Click the attachment button beside the composer.",
      "Select one or more supported files.",
      "Review attachments before sending.",
      "Open previously attached files from their message.",
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    color: "amber",
    description:
      "Inspect local server availability and generation-related metrics while the system is running.",
    steps: [
      "Open Analytics from the navigation.",
      "Use it inside the Electron application, where metrics IPC is available.",
      "Review CPU, memory, GPU, temperature, and model information when reported.",
      "A missing GPU or temperature value means that hardware data is unavailable.",
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    color: "slate",
    description:
      "Configure application behavior, appearance, and local server preferences.",
    steps: [
      "Open Settings from the sidebar footer.",
      "Adjust appearance, chat, and local server settings.",
      "Save changes to persist them and restart the local server when required.",
      "Return to Chat and confirm the selected model before sending a prompt.",
    ],
  },
  {
    title: "Code & output",
    icon: Code2,
    color: "cyan",
    description:
      "Work with generated code and quickly reuse useful responses.",
    steps: [
      "Ask the model for code using a clear technical prompt.",
      "Use the code-block Copy action to copy snippets.",
      "Keep larger tasks separated into focused prompts.",
      "Verify generated code before using it in production.",
    ],
  },
];

const colorMap = {
  blue: {
    icon: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-400/10",
    glow: "from-blue-500/20",
    badge:
      "bg-blue-500/10 text-blue-400 border-blue-400/10",
  },
  violet: {
    icon: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-400/10",
    glow: "from-violet-500/20",
    badge:
      "bg-violet-500/10 text-violet-400 border-violet-400/10",
  },
  emerald: {
    icon: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-400/10",
    glow: "from-emerald-500/20",
    badge:
      "bg-emerald-500/10 text-emerald-400 border-emerald-400/10",
  },
  amber: {
    icon: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-400/10",
    glow: "from-amber-500/20",
    badge:
      "bg-amber-500/10 text-amber-400 border-amber-400/10",
  },
  slate: {
    icon: "text-slate-400",
    iconBg: "bg-slate-500/10 border-slate-400/10",
    glow: "from-slate-500/20",
    badge:
      "bg-slate-500/10 text-slate-400 border-slate-400/10",
  },
  cyan: {
    icon: "text-cyan-400",
    iconBg: "bg-cyan-500/10 border-cyan-400/10",
    glow: "from-cyan-500/20",
    badge:
      "bg-cyan-500/10 text-cyan-400 border-cyan-400/10",
  },
};

const workflow = [
  {
    number: "01",
    title: "Choose a model",
    description:
      "Load a supported local model. The desktop application starts its local server during launch.",
    icon: Cpu,
  },
  {
    number: "02",
    title: "Start a chat",
    description:
      "Create a conversation and describe exactly what you want the model to do.",
    icon: MessageSquare,
  },
  {
    number: "03",
    title: "Add context",
    description:
      "Attach relevant files when the task requires documents, images, or other supported inputs.",
    icon: Paperclip,
  },
  {
    number: "04",
    title: "Generate & refine",
    description:
      "Review the response, copy useful results, and continue the conversation to refine the output.",
    icon: Sparkles,
  },
];

const shortcuts = [
  {
    keys: ["Enter"],
    label: "Send message",
  },
  {
    keys: ["Shift", "Enter"],
    label: "New line",
  },
];

const HelpPage = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const surface = "border-[var(--border)] bg-[var(--surface)]";
  const muted = "text-[var(--text-secondary)]";
  const heading = "text-[var(--text-primary)]";

  return (
    <div
      className={`
        custom-scrollbar
        h-full
        overflow-y-auto
        ${
          "bg-[var(--background)]"
        }
      `}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* ================================================================ */}
        {/* HERO                                                             */}
        {/* ================================================================ */}

        <section
          className={`
            relative
            overflow-hidden
            rounded-3xl
            border
            ${surface}
            p-6
            sm:p-8
            lg:p-10
          `}
        >
          {/* Decorative background */}

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className={`
                absolute
                -right-24
                -top-32
                h-72
                w-72
                rounded-full
                bg-blue-500/10
                blur-3xl
              `}
            />

            <div
              className={`
                absolute
                -bottom-32
                left-1/3
                h-64
                w-64
                rounded-full
                bg-violet-500/10
                blur-3xl
              `}
            />

            <div
              className={`
                absolute
                inset-0
                opacity-[0.025]
                ${
                  isDark
                    ? "bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)]"
                    : "bg-[radial-gradient(circle_at_1px_1px,black_1px,transparent_0)]"
                }
                [background-size:24px_24px]
              `}
            />
          </div>

          <div className="relative">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/10 bg-blue-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  OffyAI guide
                </div>

                <h1
                  className={`
                    text-3xl
                    font-semibold
                    tracking-tight
                    sm:text-4xl
                    ${heading}
                  `}
                >
                  Everything you need to
                  <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    {" "}
                    get more from OffyAI.
                  </span>
                </h1>

                <p
                  className={`
                    mt-4
                    max-w-xl
                    text-sm
                    leading-6
                    sm:text-base
                    ${muted}
                  `}
                >
                  Learn how to manage chats, run local
                  models, attach files, inspect analytics,
                  and get better results from your
                  conversations.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <div
                    className={`
                      inline-flex items-center gap-2
                      rounded-lg border px-3 py-2
                      text-xs
                      ${
                        isDark
                          ? "border-white/[0.06] bg-white/[0.03] text-gray-300"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                      }
                    `}
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    Local-first workflow
                  </div>

                  <div
                    className={`
                      inline-flex items-center gap-2
                      rounded-lg border px-3 py-2
                      text-xs
                      ${
                        isDark
                          ? "border-white/[0.06] bg-white/[0.03] text-gray-300"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                      }
                    `}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Your workspace
                  </div>
                </div>
              </div>

              <div className={`max-w-sm rounded-2xl border p-5 ${surface}`}>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
                  <h2 className={`text-sm font-semibold ${heading}`}>
                    Before you start
                  </h2>
                </div>
                <p className={`mt-3 text-xs leading-5 ${muted}`}>
                  OffyAI uses Electron IPC for local models, settings, files,
                  and analytics. Running the exported frontend in a browser
                  displays the interface, but local model features require the
                  desktop application.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* QUICK START                                                      */}
        {/* ================================================================ */}

        <section className="mt-8">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-blue-400" />

              <h2
                className={`text-lg font-semibold ${heading}`}
              >
                Quick start
              </h2>
            </div>

            <p className={`mt-1 text-sm ${muted}`}>
              The basic OffyAI workflow from model to
              finished response.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {workflow.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.number}
                  className={`
                    group
                    relative
                    overflow-hidden
                    rounded-2xl
                    border
                    ${surface}
                    p-5
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    ${
                      isDark
                        ? "hover:border-white/[0.12] hover:bg-white/[0.04]"
                        : "hover:border-gray-300 hover:shadow-sm"
                    }
                  `}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={`
                        flex h-9 w-9
                        items-center justify-center
                        rounded-xl
                        ${
                          isDark
                            ? "bg-blue-500/10"
                            : "bg-blue-50"
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 text-blue-400" />
                    </div>

                    <span
                      className={`text-[10px] font-semibold tracking-widest ${
                        isDark
                          ? "text-gray-600"
                          : "text-gray-400"
                      }`}
                    >
                      {item.number}
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-semibold ${heading}`}
                  >
                    {item.title}
                  </h3>

                  <p
                    className={`mt-2 text-xs leading-5 ${muted}`}
                  >
                    {item.description}
                  </p>

                  {index < workflow.length - 1 && (
                    <ChevronRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-gray-500 md:block" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURE GUIDE                                                    */}
        {/* ================================================================ */}

        <section className="mt-10">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-violet-400" />

              <h2
                className={`text-lg font-semibold ${heading}`}
              >
                Feature guide
              </h2>
            </div>

            <p className={`mt-1 text-sm ${muted}`}>
              Detailed guidance for the main areas of the
              application.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {helpSections.map((section) => {
              const Icon = section.icon;
              const colors =
                colorMap[section.color];

              return (
                <section
                  key={section.title}
                  className={`
                    group
                    relative
                    overflow-hidden
                    rounded-2xl
                    border
                    ${surface}
                    p-5
                    transition-all
                    duration-200
                    ${
                      isDark
                        ? "hover:border-white/[0.1]"
                        : "hover:border-gray-300 hover:shadow-sm"
                    }
                  `}
                >
                  <div
                    className={`
                      pointer-events-none
                      absolute
                      -right-20
                      -top-20
                      h-40
                      w-40
                      rounded-full
                      bg-gradient-to-br
                      ${colors.glow}
                      to-transparent
                      blur-2xl
                    `}
                  />

                  <div className="relative">
                    <div className="flex items-start gap-4">
                      <div
                        className={`
                          flex h-10 w-10
                          shrink-0
                          items-center justify-center
                          rounded-xl
                          border
                          ${colors.iconBg}
                        `}
                      >
                        <Icon
                          className={`h-5 w-5 ${colors.icon}`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-sm font-semibold ${heading}`}
                          >
                            {section.title}
                          </h3>

                          <span
                            className={`
                              rounded-md
                              border
                              px-1.5 py-0.5
                              text-[9px]
                              font-medium
                              ${colors.badge}
                            `}
                          >
                            Guide
                          </span>
                        </div>

                        <p
                          className={`mt-1.5 text-xs leading-5 ${muted}`}
                        >
                          {section.description}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`
                        mt-5
                        border-t
                        pt-4
                        ${
                          isDark
                            ? "border-white/[0.06]"
                            : "border-gray-100"
                        }
                      `}
                    >
                      <div className="space-y-2.5">
                        {section.steps.map(
                          (step, index) => (
                            <div
                              key={step}
                              className="flex items-start gap-2.5"
                            >
                              <div
                                className={`
                                  mt-0.5
                                  flex h-4 w-4
                                  shrink-0
                                  items-center justify-center
                                  rounded-full
                                  ${
                                    isDark
                                      ? "bg-white/[0.06]"
                                      : "bg-gray-100"
                                  }
                                `}
                              >
                                <Check
                                  className={`h-2.5 w-2.5 ${colors.icon}`}
                                />
                              </div>

                              <p
                                className={`text-xs leading-5 ${muted}`}
                              >
                                {step}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        {/* ================================================================ */}
        {/* BETTER PROMPTING                                                  */}
        {/* ================================================================ */}

        <section
          className={`
            mt-10
            overflow-hidden
            rounded-2xl
            border
            ${surface}
          `}
        >
          <div className="grid lg:grid-cols-2">
            <div className="p-6 sm:p-7">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Sparkles className="h-5 w-5 text-amber-400" />
              </div>

              <h2
                className={`text-lg font-semibold ${heading}`}
              >
                Get better results from your prompts
              </h2>

              <p className={`mt-2 text-sm leading-6 ${muted}`}>
                Local models generally perform better when
                the task, context, constraints, and desired
                output format are explicit.
              </p>
            </div>

            <div
              className={`
                border-t
                p-6
                sm:p-7
                lg:border-l
                lg:border-t-0
                ${
                  isDark
                    ? "border-white/[0.06]"
                    : "border-gray-200"
                }
              `}
            >
              <div className="space-y-3">
                {[
                  {
                    icon: Search,
                    title: "Be specific",
                    text: "State the exact task and expected result.",
                  },
                  {
                    icon: FileText,
                    title: "Provide context",
                    text: "Include relevant information or attach source files.",
                  },
                  {
                    icon: Code2,
                    title: "Define the format",
                    text: "Ask for Markdown, JSON, code, a table, or another format.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Verify important output",
                    text: "Treat generated content as a draft that may require validation.",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-3"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />

                      <div>
                        <p
                          className={`text-xs font-semibold ${heading}`}
                        >
                          {item.title}
                        </p>

                        <p
                          className={`mt-0.5 text-xs leading-5 ${muted}`}
                        >
                          {item.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SHORTCUTS + FILES                                                */}
        {/* ================================================================ */}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Shortcuts */}

          <section
            className={`
              rounded-2xl
              border
              ${surface}
              p-6
            `}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10">
                <Keyboard className="h-4 w-4 text-cyan-400" />
              </div>

              <div>
                <h2
                  className={`text-sm font-semibold ${heading}`}
                >
                  Keyboard shortcuts
                </h2>

                <p className={`mt-0.5 text-xs ${muted}`}>
                  Useful controls for faster navigation.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label}
                  className={`
                    flex items-center justify-between
                    rounded-xl
                    border
                    px-3 py-2.5
                    ${
                      isDark
                        ? "border-white/[0.05] bg-white/[0.02]"
                        : "border-gray-100 bg-gray-50"
                    }
                  `}
                >
                  <span
                    className={`text-xs ${muted}`}
                  >
                    {shortcut.label}
                  </span>

                  <div className="flex items-center gap-1">
                    {shortcut.keys.map(
                      (key) => (
                        <kbd
                          key={key}
                          className={`
                            min-w-7
                            rounded-md
                            border
                            px-1.5
                            py-1
                            text-center
                            text-[10px]
                            font-medium
                            ${
                              isDark
                                ? "border-white/[0.08] bg-white/[0.05] text-gray-300"
                                : "border-gray-200 bg-white text-gray-600 shadow-sm"
                            }
                          `}
                        >
                          {key}
                        </kbd>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Files */}

          <section
            className={`
              rounded-2xl
              border
              ${surface}
              p-6
            `}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                <FolderOpen className="h-4 w-4 text-emerald-400" />
              </div>

              <div>
                <h2
                  className={`text-sm font-semibold ${heading}`}
                >
                  Working with files
                </h2>

                <p className={`mt-0.5 text-xs ${muted}`}>
                  Keep file-based conversations organized.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                {
                  icon: Upload,
                  text: "Attach files directly from the message composer.",
                },
                {
                  icon: FileText,
                  text: "Use descriptive filenames so attachments are easy to identify.",
                },
                {
                  icon: Paperclip,
                  text: "Review the attachment list before sending your prompt.",
                },
                {
                  icon: Download,
                  text: "Open previously attached files from their message.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.text}
                    className="flex items-start gap-3"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />

                    <p
                      className={`text-xs leading-5 ${muted}`}
                    >
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ================================================================ */}
        {/* TROUBLESHOOTING                                                  */}
        {/* ================================================================ */}

        <section
          className={`
            mt-4
            rounded-2xl
            border
            ${surface}
            p-6
          `}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
              <HelpCircle className="h-4 w-4 text-red-400" />
            </div>

            <div>
              <h2
                className={`text-sm font-semibold ${heading}`}
              >
                Troubleshooting
              </h2>

              <p className={`mt-0.5 text-xs ${muted}`}>
                Common things to check when something does
                not work as expected.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "No response",
                text: "Check that a chat is selected and the local model server is running.",
                icon: Bot,
              },
              {
                title: "Model unavailable",
                text: "Verify that the model was uploaded correctly and is available to the server.",
                icon: Cpu,
              },
              {
                title: "Slow generation",
                text: "Review Analytics and consider model size, hardware resources, and server configuration.",
                icon: Gauge,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className={`
                    rounded-xl
                    border
                    p-4
                    ${
                      isDark
                        ? "border-white/[0.05] bg-white/[0.02]"
                        : "border-gray-100 bg-gray-50"
                    }
                  `}
                >
                  <Icon className="h-4 w-4 text-red-400" />

                  <h3
                    className={`mt-3 text-xs font-semibold ${heading}`}
                  >
                    {item.title}
                  </h3>

                  <p
                    className={`mt-1.5 text-xs leading-5 ${muted}`}
                  >
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOOTER                                                           */}
        {/* ================================================================ */}

        <div className="flex flex-col items-center justify-between gap-3 px-2 py-8 text-center sm:flex-row sm:text-left">
          <div>
            <p
              className={`text-xs font-medium ${heading}`}
            >
              OffyAI
            </p>

            <p
              className={`mt-0.5 text-[10px] ${muted}`}
            >
              Local AI workspace
            </p>
          </div>

          <div
            className={`
              flex items-center gap-2
              text-[10px]
              ${muted}
            `}
          >
            <PanelLeft className="h-3.5 w-3.5" />
            Use the sidebar to navigate between workspace
            areas.
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;

