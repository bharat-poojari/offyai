export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
export const DEFAULT_MODEL = "gpt2-124m-fresh-Q8_0";
export const DEFAULT_CONTEXT_LENGTH = 1024;
export const METRICS_UPDATE_INTERVAL = 3000;
export const CHAT_HISTORY_KEY = "offyai_chat_history";
export const SETTINGS_KEY = "offyai_settings";
export const MODELS = [
  {
    id: "gpt2-124m-fresh-Q8_0",
    name: "GPT-2 124M Fresh",
    contextLength: 1024,
    description: "Small GPT-2 model fine-tuned on fresh data",
  },
];
export const COLORS = {
  primary: "#0ea5e9",
  secondary: "#7e22ce",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};
export const MAX_FILE_SIZE = 104857600;
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "video/mp4",
  "video/avi",
  "video/mov",
  "video/webm",
];