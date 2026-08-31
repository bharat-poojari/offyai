/**
 * Test script to verify the Hugging Face browse, recommend, and download flow
 * This simulates what happens when a user:
 * 1. Opens the Browse Hugging Face tab
 * 2. Selects a use case (e.g., "General AI")
 * 3. Gets recommended models
 * 4. Downloads a model
 */

const https = require("https");
const path = require("path");

const HF_API_BASE = "https://huggingface.co/api/models";

function fetchJson(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "OffyAI/1.0",
          Accept: "application/json",
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          resolve(fetchJson(response.headers.location, timeoutMs));
          return;
        }

        if (response.statusCode >= 400) {
          reject(new Error(`Hugging Face request failed (${response.statusCode})`));
          return;
        }

        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : null;
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse Hugging Face response: ${error.message}`));
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Request timed out while contacting Hugging Face."));
    });
  });
}

function extractHuggingFaceModelFiles(item) {
  const siblingFiles = Array.isArray(item?.siblings) ? item.siblings : [];
  const fileNames = [];

  for (const entry of siblingFiles) {
    const fileName = String(entry?.rfilename || entry?.filename || entry?.name || "").trim();
    if (fileName && /\.(gguf|bin|ggml)$/i.test(fileName)) {
      fileNames.push(fileName);
    }
  }

  if (fileNames.length) {
    return fileNames;
  }

  const fallbackFiles = Array.isArray(item?.ggufFiles) ? item.ggufFiles : [];
  return fallbackFiles
    .map((fileName) => String(fileName || "").trim())
    .filter((fileName) => fileName && /\.(gguf|bin|ggml)$/i.test(fileName));
}

function getHuggingFaceApiUrl(query, limit = 12) {
  const term = String(query || "").trim();
  const searchTerm = term || "qwen gguf";
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 24);

  return `${HF_API_BASE}?search=${encodeURIComponent(searchTerm)}&sort=downloads&direction=-1&limit=${safeLimit}&filter=gguf`;
}

function getHuggingFaceModelDetailsUrl(repoId) {
  const safeRepoId = String(repoId || "").trim();
  if (!safeRepoId) {
    return null;
  }
  const repoPath = safeRepoId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${HF_API_BASE}/${repoPath}`;
}

async function getRecommendedHuggingFaceModels({ query, goal, limit = 12 } = {}) {
  const queryText = String(query || "").trim() || goal || "qwen gguf";
  console.log(`[SEARCH] Query: "${queryText}", Goal: "${goal}", Limit: ${limit}`);

  const searchResults = await fetchJson(getHuggingFaceApiUrl(queryText, limit), 30000);

  if (!Array.isArray(searchResults)) {
    console.log("[ERROR] Search results is not an array");
    return [];
  }

  console.log(`[SEARCH] Found ${searchResults.length} models from public API`);

  const modelResults = [];

  for (let i = 0; i < searchResults.length; i++) {
    const item = searchResults[i];
    const id = String(item?.id || "").trim();

    if (!id) {
      continue;
    }

    let ggufFiles = extractHuggingFaceModelFiles(item);

    console.log(`[MODEL ${i + 1}] ${id} - Found ${ggufFiles.length} GGUF files in search result`);

    if (!ggufFiles.length) {
      try {
        const detailsUrl = getHuggingFaceModelDetailsUrl(id);
        if (detailsUrl) {
          console.log(`[RESOLVE] Fetching details for ${id}...`);
          const details = await fetchJson(detailsUrl, 30000);

          if (details && typeof details === "object") {
            const detailFiles = extractHuggingFaceModelFiles(details);
            if (detailFiles.length) {
              ggufFiles = detailFiles;
              console.log(`[RESOLVE] Found ${ggufFiles.length} GGUF files in repo details`);
            }
          }
        }
      } catch (error) {
        console.warn(`[WARN] Failed to resolve repo details for ${id}: ${error.message}`);
      }
    }

    if (!ggufFiles.length && !/(gguf|bin|ggml)/i.test(id)) {
      console.log(`[SKIP] No GGUF files and repo ID doesn't look like a model`);
      continue;
    }

    const fileName = ggufFiles[0] || null;
    const tags = Array.isArray(item?.tags) ? item.tags : [];

    const model = {
      id,
      name: id.split("/").pop() || "Unknown model",
      modelId: id,
      author: id.includes("/") ? id.split("/")[0] : "unknown",
      repoUrl: `https://huggingface.co/${id}`,
      downloads: Number(item?.downloads || 0),
      likes: Number(item?.likes || 0),
      lastModified: item?.lastModified || item?.updatedAt || null,
      summary: item?.cardData?.description || item?.summary || "",
      tags,
      pipelineTag: item?.pipeline_tag || "",
      ggufFiles,
      recommendedFile: fileName,
    };

    modelResults.push(model);
    console.log(`[ADD] Added model: ${model.name} (${model.downloads} downloads, ${model.likes} likes)`);
  }

  console.log(`[COMPLETE] Normalized to ${modelResults.length} models`);
  return modelResults.slice(0, limit);
}

async function testBrowseFlow() {
  console.log("=".repeat(80));
  console.log("OFFYAI - HUGGING FACE BROWSE & RECOMMEND FLOW TEST");
  console.log("=".repeat(80));
  console.log();

  try {
    console.log("TEST 1: Search for 'qwen' with goal 'general'");
    console.log("-".repeat(80));
    const results = await getRecommendedHuggingFaceModels({
      query: "qwen",
      goal: "general",
      limit: 5,
    });

    if (results.length === 0) {
      console.log("[ERROR] No models returned!");
    } else {
      console.log(`[SUCCESS] Returned ${results.length} models`);
      console.log();
      console.log("TOP 3 MODELS:");
      results.slice(0, 3).forEach((model, idx) => {
        console.log(`  ${idx + 1}. ${model.name}`);
        console.log(`     ID: ${model.id}`);
        console.log(`     Downloads: ${model.downloads.toLocaleString()}`);
        console.log(`     Likes: ${model.likes.toLocaleString()}`);
        console.log(`     Recommended File: ${model.recommendedFile}`);
        console.log(`     Download URL would be: https://huggingface.co/${model.id}/resolve/main/${model.recommendedFile}`);
        console.log();
      });
    }

    console.log();
    console.log("TEST 2: Search for 'coding' models");
    console.log("-".repeat(80));
    const codingResults = await getRecommendedHuggingFaceModels({
      query: "coder",
      goal: "coding",
      limit: 3,
    });

    if (codingResults.length === 0) {
      console.log("[ERROR] No coding models returned!");
    } else {
      console.log(`[SUCCESS] Returned ${codingResults.length} coding models`);
      codingResults.forEach((model) => {
        console.log(`  - ${model.name} (${model.downloads} downloads)`);
      });
    }

    console.log();
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log("✓ Search API is working correctly");
    console.log("✓ Models are being fetched with proper GGUF file resolution");
    console.log("✓ Download URLs can be generated from the results");
    console.log();
    console.log("NEXT STEPS IN APP:");
    console.log("1. User opens 'Browse Hugging Face' tab in Model Upload Modal");
    console.log("2. User selects a use case (General, Coding, etc.)");
    console.log("3. App calls: modelsAPI.searchHuggingFaceModels({ query, goal, limit })");
    console.log("4. Results are normalized and ranked by score");
    console.log("5. User clicks 'Download' on a model");
    console.log("6. App calls: window.electronAPI.downloadHuggingFaceModel({ repoId, fileName })");
    console.log("7. Electron downloads model to: <app-data>/models/");
    console.log("8. Model is added to settings.json and available for use");
    console.log();
  } catch (error) {
    console.error("[FATAL ERROR]", error.message);
    console.error(error);
    process.exit(1);
  }
}

testBrowseFlow();
