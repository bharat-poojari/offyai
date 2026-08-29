"use strict";

const fs = require("fs");
const path = require("path");

function resolveModelsDirectory({
  rootDir = __dirname,
  userDataDir,
  isPackaged = false,
  resourcesPath,
} = {}) {
  if (isPackaged) {
    const writableDir = userDataDir || process.env.APPDATA || process.env.HOME || path.resolve(rootDir, "..");
    return path.join(writableDir, "models");
  }

  const candidates = [
    path.resolve(rootDir, "models"),
    path.resolve(rootDir, "..", "models"),
    path.resolve(rootDir, "..", "..", "models"),
    path.resolve(process.cwd(), "models"),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Ignore and continue to the next candidate.
    }
  }

  return path.resolve(rootDir, "models");
}

module.exports = {
  resolveModelsDirectory,
};
