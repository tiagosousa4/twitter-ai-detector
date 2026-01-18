importScripts("heuristics.js");

const { normalizeScore, heuristicScore } = aiDetectorHeuristics;

const DEFAULT_SETTINGS = {
  apiKey: "",
  hfApiKey: "",
  hfModel: "openai-community/roberta-large-openai-detector",
  provider: "huggingface",
  localOnly: true,
  filterEnabled: true,
  collapseEnabled: false,
  enabled: true,
  threshold: 72,
  analyzeTimeline: true,
  analyzeReplies: true,
  analyzeSearch: false,
  analyzeTweetPages: true
};

const SYNC_SETTINGS = {
  hfModel: "openai-community/roberta-large-openai-detector",
  provider: "huggingface",
  localOnly: true,
  filterEnabled: true,
  collapseEnabled: false,
  enabled: true,
  threshold: 72,
  analyzeTimeline: true,
  analyzeReplies: true,
  analyzeSearch: false,
  analyzeTweetPages: true
};

const LOCAL_SETTINGS = {
  apiKey: "",
  hfApiKey: ""
};

const GPTZERO_LIMIT = 10000;

const DEFAULT_STATS = {
  totalAnalyzed: 0,
  avgScore: 0,
  hiddenCount: 0,
  apiCharsUsed: 0,
  apiLimit: 0,
  apiErrors: 0,
  lastError: "",
  fallbackMode: false,
  lastProvider: "huggingface"
};

const RATE_LIMIT_MS = 800;
const MAX_RETRIES = 2;
const CACHE_MAX_ITEMS = 500;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 5000;
const MODEL_ID_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}(?:@[a-zA-Z0-9._-]{1,64})?$/;

const HF_LABEL_MAP = {
  "openai-community/roberta-large-openai-detector": {
    ai: ["LABEL_1"],
    human: ["LABEL_0"]
  },
  "openai-community/roberta-base-openai-detector": {
    ai: ["LABEL_1"],
    human: ["LABEL_0"]
  }
};

const HF_ROUTER_BASE = "https://router.huggingface.co";

let settingsCache = { ...DEFAULT_SETTINGS };
let cacheLoaded = false;
let statsLoaded = false;
let cache = {};
let stats = { ...DEFAULT_STATS };
let settingsReady = null;

let queue = [];
let processing = false;
let lastRequestTime = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageGet(area, keys) {
  return new Promise((resolve) => {
    chrome.storage[area].get(keys, (items) => resolve(items || {}));
  });
}

function storageSet(area, values) {
  return new Promise((resolve) => {
    chrome.storage[area].set(values, () => resolve());
  });
}

function storageRemove(area, keys) {
  return new Promise((resolve) => {
    chrome.storage[area].remove(keys, () => resolve());
  });
}

async function refreshSettingsCache() {
  const syncSettings = await storageGet("sync", SYNC_SETTINGS);
  const localSettings = await storageGet("local", LOCAL_SETTINGS);
  settingsCache = { ...DEFAULT_SETTINGS, ...syncSettings, ...localSettings };
}

async function migrateSecrets() {
  const syncSecrets = await storageGet("sync", ["apiKey", "hfApiKey"]);
  const localSecrets = await storageGet("local", LOCAL_SETTINGS);
  const toStore = {};

  if (syncSecrets.apiKey && !localSecrets.apiKey) {
    toStore.apiKey = syncSecrets.apiKey;
  }
  if (syncSecrets.hfApiKey && !localSecrets.hfApiKey) {
    toStore.hfApiKey = syncSecrets.hfApiKey;
  }

  if (Object.keys(toStore).length) {
    await storageSet("local", toStore);
  }

  if (syncSecrets.apiKey || syncSecrets.hfApiKey) {
    await storageRemove("sync", ["apiKey", "hfApiKey"]);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" && areaName !== "local") {
    return;
  }
  Object.keys(changes).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
      return;
    }
    settingsCache[key] = changes[key].newValue;
  });
});

function ensureSettingsReady() {
  if (!settingsReady) {
    settingsReady = (async () => {
      await migrateSecrets();
      await refreshSettingsCache();
    })();
  }
  return settingsReady;
}

ensureSettingsReady();


function buildHuggingFaceEndpoints(safeModel) {
  return [
    `${HF_ROUTER_BASE}/hf-inference/models/${safeModel}`,
    `${HF_ROUTER_BASE}/models/${safeModel}`
  ];
}

function sanitizeHuggingFaceModel(model) {
  if (typeof model !== "string") {
    return null;
  }

  const trimmed = model.trim();
  if (!MODEL_ID_PATTERN.test(trimmed)) {
    return null;
  }

  const [base, revision] = trimmed.split("@");
  const [owner, repo] = base.split("/");
  if (!owner || !repo) {
    return null;
  }

  const safeBase = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return revision ? `${safeBase}@${encodeURIComponent(revision)}` : safeBase;
}

function isTrustedSender(sender) {
  return sender && sender.id === chrome.runtime.id;
}

function isTwitterUrl(url) {
  return (
    typeof url === "string" &&
    (url.startsWith("https://twitter.com/") || url.startsWith("https://x.com/"))
  );
}

function pruneCache() {
  const now = Date.now();
  const entries = Object.entries(cache).filter(([, entry]) => {
    return entry && entry.timestamp && now - entry.timestamp <= CACHE_TTL_MS;
  });

  entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
  const limited = entries.slice(0, CACHE_MAX_ITEMS);
  const pruned = Object.fromEntries(limited);
  const changed = Object.keys(pruned).length !== Object.keys(cache).length;
  cache = pruned;
  return changed;
}

async function loadCache() {
  if (cacheLoaded) {
    return;
  }
  const res = await storageGet("local", ["aiCache"]);
  cache = res.aiCache || {};
  const changed = pruneCache();
  cacheLoaded = true;
  if (changed) {
    await storageSet("local", { aiCache: cache });
  }
}

async function saveCache() {
  pruneCache();
  await storageSet("local", { aiCache: cache });
}

async function loadStats() {
  if (statsLoaded) {
    return;
  }
  const res = await storageGet("local", ["stats"]);
  stats = { ...DEFAULT_STATS, ...(res.stats || {}) };
  statsLoaded = true;
}

async function saveStats() {
  await storageSet("local", { stats });
}

async function syncStatsProvider(provider) {
  await loadStats();
  let changed = false;

  if (stats.lastProvider !== provider) {
    stats.lastProvider = provider;
    stats.fallbackMode = false;
    changed = true;
  }

  const limit = provider === "gptzero" ? GPTZERO_LIMIT : 0;
  if (stats.apiLimit !== limit) {
    stats.apiLimit = limit;
    changed = true;
  }

  if (changed) {
    await saveStats();
  }
}

async function setFallbackMode(enabled) {
  await loadStats();
  stats.fallbackMode = enabled;
  await saveStats();
}

async function updateStatsWithScore(score, method, textLength, provider) {
  await loadStats();
  stats.totalAnalyzed += 1;
  const nextAvg =
    (stats.avgScore * (stats.totalAnalyzed - 1) + score) / stats.totalAnalyzed;
  stats.avgScore = Math.round(nextAvg * 10) / 10;

  if (method === "api" && textLength) {
    stats.apiCharsUsed += textLength;
  }

  if (provider === "gptzero" && stats.apiCharsUsed >= GPTZERO_LIMIT) {
    stats.fallbackMode = true;
  }

  await saveStats();
}

async function updateHiddenCount(delta) {
  await loadStats();
  stats.hiddenCount = Math.max(0, stats.hiddenCount + delta);
  await saveStats();
}

async function recordError(message) {
  await loadStats();
  stats.apiErrors += 1;
  stats.lastError = message;
  await saveStats();
}

async function buildHeuristicResult(text, provider) {
  const score = heuristicScore(text);
  await updateStatsWithScore(score, "heuristic", 0, provider);
  return { success: true, score, method: "heuristic" };
}


async function callGptZeroWithRetries(text, apiKey) {
  let attempt = 0;
  let backoff = 500;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetch("https://api.gptzero.me/v2/predict/text", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ document: text })
      });

      if (response.status === 401) {
        throw { type: "auth" };
      }

      if (response.status === 429) {
        throw { type: "rate" };
      }

      if (!response.ok) {
        throw { type: "server", status: response.status };
      }

      const data = await response.json();
      const prob =
        data &&
        data.documents &&
        data.documents[0] &&
        data.documents[0].completely_generated_prob;

      if (typeof prob !== "number") {
        throw { type: "bad_response" };
      }

      return normalizeScore(prob * 100);
    } catch (err) {
      const type = err && err.type;
      const isRetryable = !type || type === "server" || type === "bad_response";

      if (!isRetryable || attempt >= MAX_RETRIES) {
        if (!type) {
          throw { type: "network", message: err && err.message };
        }
        throw err;
      }

      await delay(backoff);
      backoff *= 2;
      attempt += 1;
    }
  }

  throw { type: "network", message: "Retry loop failed" };
}

function extractHuggingFaceScore(data, model) {
  let predictions = data;

  if (Array.isArray(predictions) && Array.isArray(predictions[0])) {
    predictions = predictions[0];
  }

  if (!Array.isArray(predictions)) {
    return null;
  }

  const scored = predictions.filter(
    (item) => item && typeof item.score === "number"
  );

  if (!scored.length) {
    return null;
  }

  const map = HF_LABEL_MAP[model];
  if (map) {
    const findByLabels = (labels) =>
      scored.find((item) => labels.includes(String(item.label)));

    const aiMatch = findByLabels(map.ai);
    if (aiMatch) {
      return aiMatch.score * 100;
    }

    const humanMatch = findByLabels(map.human);
    if (humanMatch) {
      return (1 - humanMatch.score) * 100;
    }

    return null;
  }

  const findByLabel = (regex) =>
    scored.find((item) => item.label && regex.test(item.label));

  const aiLabel = findByLabel(/ai|generated|fake|machine/i);
  if (aiLabel) {
    return aiLabel.score * 100;
  }

  const humanLabel = findByLabel(/human|real|original/i);
  if (humanLabel) {
    return (1 - humanLabel.score) * 100;
  }

  const label1 = scored.find(
    (item) => String(item.label).toUpperCase() === "LABEL_1"
  );
  if (label1) {
    return label1.score * 100;
  }

  const label0 = scored.find(
    (item) => String(item.label).toUpperCase() === "LABEL_0"
  );
  if (label0) {
    return (1 - label0.score) * 100;
  }

  const top = scored.sort((a, b) => b.score - a.score)[0];
  return top.score * 100;
}

async function callHuggingFaceWithRetries(text, apiKey, model, safeModel) {
  let attempt = 0;
  let backoff = 700;
  const endpoints = buildHuggingFaceEndpoints(safeModel);

  while (attempt <= MAX_RETRIES) {
    try {
      let lastEndpointError = null;

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: text,
            options: { wait_for_model: true }
          })
        });

        if (response.status === 401 || response.status === 403) {
          throw { type: "auth" };
        }

        if (response.status === 429) {
          throw { type: "rate" };
        }

        if (response.status === 503) {
          const data = await response.json().catch(() => null);
          const waitFor = data && data.estimated_time;
          throw { type: "loading", retryAfter: waitFor ? waitFor * 1000 : null };
        }

        if (response.status === 404) {
          lastEndpointError = { type: "not_found" };
          continue;
        }

        if (response.status === 410) {
          lastEndpointError = { type: "endpoint" };
          continue;
        }

        if (!response.ok) {
          throw { type: "server", status: response.status };
        }

        const data = await response.json();
        const score = extractHuggingFaceScore(data, model);

        if (!Number.isFinite(score)) {
          throw { type: "bad_response" };
        }

        return normalizeScore(score);
      }

      if (lastEndpointError) {
        throw lastEndpointError;
      }

      throw { type: "server" };
    } catch (err) {
      const type = err && err.type;
      const isRetryable =
        !type ||
        type === "server" ||
        type === "bad_response" ||
        type === "loading";

      if (type === "loading" && err.retryAfter) {
        await delay(err.retryAfter);
        attempt += 1;
        continue;
      }

      if (!isRetryable || attempt >= MAX_RETRIES) {
        if (!type) {
          throw { type: "network", message: err && err.message };
        }
        throw err;
      }

      await delay(backoff);
      backoff *= 2;
      attempt += 1;
    }
  }

  throw { type: "network", message: "Retry loop failed" };
}

async function analyzeText(text) {
  await ensureSettingsReady();
  const provider = settingsCache.provider || "huggingface";
  await syncStatsProvider(provider);

  if (settingsCache.localOnly) {
    return buildHeuristicResult(text, provider);
  }

  if (provider === "gptzero") {
    const apiKey = settingsCache.apiKey;

    if (!apiKey) {
      return { success: false, error: "API_KEY_MISSING" };
    }

    if (stats.fallbackMode || stats.apiCharsUsed >= GPTZERO_LIMIT) {
      return buildHeuristicResult(text, provider);
    }

    try {
      const score = await callGptZeroWithRetries(text, apiKey);
      await updateStatsWithScore(score, "api", text.length, provider);
      return { success: true, score, method: "api" };
    } catch (err) {
      if (err.type === "auth") {
        await recordError("Invalid API key");
        return { success: false, error: "API_KEY_INVALID" };
      }

      if (err.type === "rate") {
        await recordError("Rate limit exceeded, switching to heuristics");
        await setFallbackMode(true);
        return buildHeuristicResult(text, provider);
      }

      await recordError("API error, using heuristics");
      return buildHeuristicResult(text, provider);
    }
  }

  const hfApiKey = settingsCache.hfApiKey;
  const hfModel = settingsCache.hfModel || DEFAULT_SETTINGS.hfModel;
  const safeModel = sanitizeHuggingFaceModel(hfModel);

  if (!hfApiKey) {
    return { success: false, error: "API_KEY_MISSING" };
  }

  if (!safeModel) {
    await recordError("Invalid Hugging Face model ID");
    return { success: false, error: "MODEL_INVALID" };
  }

  if (stats.fallbackMode) {
    return buildHeuristicResult(text, provider);
  }

  try {
    const score = await callHuggingFaceWithRetries(
      text,
      hfApiKey,
      hfModel,
      safeModel
    );
    await updateStatsWithScore(score, "api", text.length, provider);
    return { success: true, score, method: "api" };
  } catch (err) {
    if (err.type === "endpoint") {
      await recordError("Hugging Face endpoint unavailable");
      return { success: false, error: "ENDPOINT_UNAVAILABLE" };
    }

    if (err.type === "not_found") {
      await recordError("Hugging Face model not found");
      return { success: false, error: "MODEL_NOT_FOUND" };
    }

    if (err.type === "auth") {
      await recordError("Invalid API key");
      return { success: false, error: "API_KEY_INVALID" };
    }

    if (err.type === "rate") {
      await recordError("Rate limit exceeded, switching to heuristics");
      await setFallbackMode(true);
      return buildHeuristicResult(text, provider);
    }

    await recordError("API error, using heuristics");
    return buildHeuristicResult(text, provider);
  }
}

async function handleAnalyzeRequest(text, tweetId) {
  await loadCache();

  if (cache[tweetId]) {
    return {
      success: true,
      score: cache[tweetId].score,
      method: cache[tweetId].method,
      tweetId,
      cached: true
    };
  }

  const result = await analyzeText(text);

  if (result.success) {
    cache[tweetId] = {
      score: result.score,
      method: result.method,
      timestamp: Date.now()
    };
    await saveCache();
  }

  return { ...result, tweetId };
}

async function processQueue() {
  if (processing) {
    return;
  }
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    const now = Date.now();
    const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));

    if (wait > 0) {
      await delay(wait);
    }

    lastRequestTime = Date.now();

    try {
      const result = await handleAnalyzeRequest(item.text, item.tweetId);
      item.respond(result);
    } catch (err) {
      item.respond({
        success: false,
        error: "ANALYSIS_FAILED",
        tweetId: item.tweetId
      });
    }
  }

  processing = false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    return;
  }

  if (!message || !message.action) {
    return;
  }

  if (message.action === "analyzeTweet") {
    if (!sender.tab || !isTwitterUrl(sender.tab.url)) {
      sendResponse({ success: false, error: "UNAUTHORIZED" });
      return true;
    }
    const text = String(message.text || "");
    const clippedText =
      text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
    queue.push({
      text: clippedText,
      tweetId: message.tweetId || "",
      respond: sendResponse
    });
    processQueue();
    return true;
  }

  if (message.action === "getStats") {
    loadStats().then(() => sendResponse(stats));
    return true;
  }

  if (message.action === "clearCache") {
    cache = {};
    cacheLoaded = true;
    storageSet("local", { aiCache: {} }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "resetStats") {
    stats = { ...DEFAULT_STATS };
    statsLoaded = true;
    storageSet("local", { stats }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "hiddenDelta") {
    const delta = Number(message.delta || 0);
    updateHiddenCount(delta).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "setFallbackMode") {
    setFallbackMode(!!message.enabled).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "syncProvider") {
    const provider = message.provider || "huggingface";
    syncStatsProvider(provider).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "broadcastToTabs") {
    const payload = message.payload;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      tabs.forEach((tab) => {
        if (!tab.id) {
          return;
        }
        const sendResult = chrome.tabs.sendMessage(tab.id, payload, () => {
          void chrome.runtime.lastError;
        });
        if (sendResult && typeof sendResult.catch === "function") {
          sendResult.catch(() => {});
        }
      });
      sendResponse({ success: true, sent: tabs.length });
    });
    return true;
  }
});
















