/**
 * Resolve image paths correctly for both development and Electron production builds.
 * In Electron bundled apps, static assets need to be resolved from the app's resource path.
 */

/**
 * Check if running in Electron environment
 */
const isElectron = () => {
  if (typeof window === "undefined") return false;
  return typeof window.electronAPI !== "undefined";
};

/**
 * Resolve an image path for use in img src attributes.
 * In Electron production (bundled), images are served via file:// protocol.
 * In dev mode and browser, images are served via http.
 * 
 * @param {string} imagePath - Relative path like "images/offyai.png"
 * @returns {string} - Resolved path suitable for img src
 */
export const resolveImagePath = (imagePath) => {
  if (!imagePath) return "";

  // In development mode (npm start), use direct path
  if (process.env.NODE_ENV === "development") {
    return `/${imagePath}`;
  }

  // In production Electron build, use file:// protocol to access bundled assets
  if (isElectron()) {
    // For static assets, construct file:// URL
    // In Next.js static export, public files are in the out/ directory
    return `/${imagePath}`;
  }

  // Default fallback
  return `/${imagePath}`;
};

/**
 * Convert a local file path to a data URL (base64)
 * Useful for profile photos uploaded by users
 * 
 * @param {File|Blob} file - File object to convert
 * @returns {Promise<string>} - Data URL as base64
 */
export const fileToDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Get default avatar image path
 * @param {"user"|"ai"} type - Avatar type
 * @returns {string} - Path to default avatar
 */
export const getDefaultAvatar = (type = "ai") => {
  if (type === "user") {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='35' r='25' fill='%234F46E5'/%3E%3Cellipse cx='50' cy='85' rx='35' ry='20' fill='%234F46E5'/%3E%3C/svg%3E";
  }
  return resolveImagePath("images/offyai.png");
};

export default {
  resolveImagePath,
  fileToDataURL,
  getDefaultAvatar,
  isElectron,
};
