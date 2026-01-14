const DEFAULT_SETTINGS = {
  apiKey: "",
  hfApiKey: "",
  hfModel: "openai-community/roberta-large-openai-detector",
  provider: "huggingface",
  localOnly: true,
  filterEnabled: true,
  collapseEnabled: false,
  enabled: true,
  threshold: 75,
  analyzeTimeline: true,
  analyzeReplies: true,
  analyzeSearch: false,
  analyzeTweetPages: true
};

const TWEET_SELECTOR = "article[data-testid='tweet'], div[data-testid='tweet']";

let settings = { ...DEFAULT_SETTINGS };
const filteringLogic =
  typeof aiDetectorFiltering !== "undefined" ? aiDetectorFiltering : null;
const processedScores = new Map();
const pendingTweetIds = new Set();

const analyzeQueue = [];
let queueProcessing = false;

const intersectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        enqueueTweet(entry.target);
      }
    });
  },
  { threshold: 0.3 }
);

function sanitizeText(text) {
  if (!text) {
    return "";
  }
  return text.replace(/\s+/g, " ").replace(/\u200B/g, "").trim();
}

function parseColor(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    const intVal = parseInt(normalized, 16);
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255,
      a: 1
    };
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return null;
  }

  const parts = rgbMatch[1].split(",").map((part) => part.trim());
  if (parts.length < 3) {
    return null;
  }

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts.length > 3 ? Number(parts[3]) : 1;

  if (![r, g, b, a].every((num) => Number.isFinite(num))) {
    return null;
  }

  return { r, g, b, a };
}

function mixColors(base, accent, weight) {
  return {
    r: Math.round(base.r + (accent.r - base.r) * weight),
    g: Math.round(base.g + (accent.g - base.g) * weight),
    b: Math.round(base.b + (accent.b - base.b) * weight)
  };
}

function toRgbString(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function pickButtonTextColor(color) {
  const yiq = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return yiq >= 150 ? "#0f1419" : "#ffffff";
}

function resolveAccentColor() {
  const rootStyles = getComputedStyle(document.documentElement);
  const candidates = [
    rootStyles.getPropertyValue("--color-accent"),
    rootStyles.getPropertyValue("--color-primary"),
    rootStyles.getPropertyValue("--theme-primary"),
    rootStyles.getPropertyValue("--brand-color"),
    rootStyles.getPropertyValue("--link-color"),
    rootStyles.getPropertyValue("--text-link")
  ];

  let value = candidates
    .map((candidate) => candidate && candidate.trim())
    .find((candidate) => parseColor(candidate));

  if (!value) {
    const link = document.querySelector("a");
    value = link ? getComputedStyle(link).color : "";
  }

  return parseColor(value) || { r: 29, g: 155, b: 240, a: 1 };
}

function applyPlaceholderTheme(placeholder) {
  const bodyStyles = getComputedStyle(document.body);
  const rootStyles = getComputedStyle(document.documentElement);
  const textColor = (bodyStyles.color || "").trim();

  let base = parseColor(bodyStyles.backgroundColor);
  if (!base || base.a === 0) {
    base = parseColor(rootStyles.backgroundColor);
  }
  if (!base || base.a === 0) {
    base = { r: 255, g: 255, b: 255, a: 1 };
  }

  const accent = resolveAccentColor();
  const surface = mixColors(base, accent, 0.08);
  const border = mixColors(base, accent, 0.26);
  const pill = mixColors(base, accent, 0.14);

  placeholder.style.setProperty("--ai-detector-surface", toRgbString(surface));
  placeholder.style.setProperty("--ai-detector-border", toRgbString(border));
  placeholder.style.setProperty("--ai-detector-pill", toRgbString(pill));
  placeholder.style.setProperty(
    "--ai-detector-accent-rgb",
    `${accent.r}, ${accent.g}, ${accent.b}`
  );
  if (textColor) {
    placeholder.style.setProperty("--ai-detector-text", textColor);
  }
  placeholder.style.setProperty(
    "--ai-detector-button-text",
    pickButtonTextColor(accent)
  );
}

function hashText(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) + hash + text.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return Math.abs(hash).toString();
}

function getTweetId(element, text) {
  const link = element.querySelector("a[href*='/status/']");
  if (link && link.href) {
    const match = link.href.match(/status\/(\d+)/);
    if (match) {
      return match[1];
    }
  }

  if (text) {
    return `h${hashText(text)}`;
  }

  return "";
}

function getTweetText(element) {
  const textNodes = element.querySelectorAll(
    "div[data-testid='tweetText'], div[lang]"
  );

  const combined = Array.from(textNodes)
    .map((node) => node.innerText)
    .join(" ");

  return sanitizeText(combined);
}

function isReplyTweet(element) {
  const replyMarker = Array.from(element.querySelectorAll("span")).find(
    (node) => {
      const content = node.textContent || "";
      return content.toLowerCase().includes("replying to");
    }
  );

  return Boolean(replyMarker);
}

function shouldAnalyzeContext(element) {
  const path = window.location.pathname || "";
  const isSearch = path.includes("/search");
  const isStatus = path.includes("/status/");

  if (isSearch && !settings.analyzeSearch) {
    return false;
  }

  if (isStatus && !settings.analyzeTweetPages) {
    return false;
  }

  if (!isSearch && !isStatus && !settings.analyzeTimeline) {
    return false;
  }

  if (!settings.analyzeReplies && isReplyTweet(element)) {
    return false;
  }

  return true;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: "RUNTIME_ERROR" });
        return;
      }
      resolve(response || { success: false, error: "NO_RESPONSE" });
    });
  });
}

function getBadge(element) {
  let badge = element.querySelector(".ai-detector-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "ai-detector-badge loading";
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");

    const spinner = document.createElement("span");
    spinner.className = "ai-detector-spinner";
    spinner.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "ai-detector-badge-text";
    text.textContent = "Analyzing...";

    badge.appendChild(spinner);
    badge.appendChild(text);

    element.classList.add("ai-detector-tweet");
    element.appendChild(badge);
  }
  return badge;
}

function setBadgeLoading(badge) {
  badge.classList.add("loading");
  badge.classList.remove("low", "medium", "high", "estimated", "error");
  badge.classList.remove("loaded");
  const text = badge.querySelector(".ai-detector-badge-text");
  if (text) {
    text.textContent = "Analyzing...";
  }
  badge.setAttribute("aria-label", "Analyzing tweet");
}

function setBadgeError(badge, message) {
  badge.classList.remove("loading", "low", "medium", "high", "estimated");
  badge.classList.add("error", "loaded");
  const text = badge.querySelector(".ai-detector-badge-text");
  if (text) {
    text.textContent = message;
  }
  badge.setAttribute("aria-label", message);
}

function setBadgeScore(badge, score, method) {
  badge.classList.remove("loading", "low", "medium", "high", "error");
  badge.classList.add("loaded");

  if (score <= 30) {
    badge.classList.add("low");
  } else if (score <= 60) {
    badge.classList.add("medium");
  } else {
    badge.classList.add("high");
  }

  if (method === "heuristic") {
    badge.classList.add("estimated");
    badge.title = "Estimated with local heuristics";
  } else {
    badge.classList.remove("estimated");
    badge.title = "API analysis";
  }

  const text = badge.querySelector(".ai-detector-badge-text");
  if (text) {
    text.textContent = `${score}%`;
  }

  badge.setAttribute("aria-label", `AI likelihood ${score} percent`);
}

function collapseTweet(element, score) {
  if (element.dataset.aiDetectorCollapsed === "true") {
    return;
  }

  if (element.dataset.aiDetectorRevealed === "true") {
    return;
  }

  const collapse = document.createElement("div");
  const collapseId = `ai-detector-collapse-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  collapse.className = "ai-detector-collapse";
  collapse.id = collapseId;

  const info = document.createElement("div");
  info.className = "ai-detector-collapse-info";

  const dot = document.createElement("span");
  dot.className = "ai-detector-collapse-dot";

  const text = document.createElement("span");
  text.className = "ai-detector-collapse-text";
  text.textContent = "AI tweet collapsed";

  const scoreBadge = document.createElement("span");
  scoreBadge.className = "ai-detector-collapse-score";
  scoreBadge.textContent = `${score}% AI`;

  info.appendChild(dot);
  info.appendChild(text);
  info.appendChild(scoreBadge);

  const button = document.createElement("button");
  button.className = "ai-detector-collapse-btn";
  button.type = "button";
  button.textContent = "Expand";
  button.addEventListener("click", () => {
    revealTweet(element);
  });

  collapse.appendChild(info);
  collapse.appendChild(button);
  applyPlaceholderTheme(collapse);

  element.classList.add("ai-detector-collapsed");
  element.dataset.aiDetectorCollapsed = "true";
  element.dataset.aiDetectorCollapseId = collapseId;

  element.parentNode.insertBefore(collapse, element);

  sendMessage({ action: "hiddenDelta", delta: 1 });
}

function clearHiddenState(element) {
  const wasHidden = element.dataset.aiDetectorHidden === "true";
  const wasCollapsed = element.dataset.aiDetectorCollapsed === "true";

  if (!wasHidden && !wasCollapsed) {
    return false;
  }

  if (wasHidden) {
    const placeholderId = element.dataset.aiDetectorPlaceholderId;
    const placeholder = placeholderId
      ? document.getElementById(placeholderId)
      : null;

    if (placeholder) {
      placeholder.remove();
    }

    element.style.display = "";
    element.dataset.aiDetectorPlaceholderId = "";
  }

  if (wasCollapsed) {
    const collapseId = element.dataset.aiDetectorCollapseId;
    const collapse = collapseId ? document.getElementById(collapseId) : null;

    if (collapse) {
      collapse.remove();
    }

    element.classList.remove("ai-detector-collapsed");
    element.dataset.aiDetectorCollapseId = "";
  }

  element.dataset.aiDetectorHidden = "false";
  element.dataset.aiDetectorCollapsed = "false";

  sendMessage({ action: "hiddenDelta", delta: -1 });
  return true;
}

function hideTweet(element, score) {
  if (element.dataset.aiDetectorHidden === "true") {
    return;
  }

  if (element.dataset.aiDetectorRevealed === "true") {
    return;
  }

  const rect = element.getBoundingClientRect();
  const minHeight = Math.max(48, Math.round(rect.height));
  const placeholder = document.createElement("div");
  const placeholderId = `ai-detector-placeholder-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  placeholder.className = "ai-detector-placeholder";
  placeholder.id = placeholderId;
  placeholder.style.minHeight = `${minHeight}px`;

  const header = document.createElement("div");
  header.className = "ai-detector-placeholder-header";

  const dot = document.createElement("span");
  dot.className = "ai-detector-placeholder-dot";

  const title = document.createElement("span");
  title.className = "ai-detector-placeholder-title";
  title.textContent = "Hidden by AI Tweet Detector";

  const scoreBadge = document.createElement("span");
  scoreBadge.className = "ai-detector-placeholder-score";
  scoreBadge.textContent = `${score}% AI`;

  header.appendChild(dot);
  header.appendChild(title);
  header.appendChild(scoreBadge);

  const subtext = document.createElement("div");
  subtext.className = "ai-detector-placeholder-subtext";
  subtext.textContent = "This tweet exceeded your AI threshold.";

  const button = document.createElement("button");
  button.className = "ai-detector-reveal-btn";
  button.type = "button";
  button.textContent = "Reveal tweet";
  button.addEventListener("click", () => {
    revealTweet(element);
  });

  placeholder.appendChild(header);
  placeholder.appendChild(subtext);
  placeholder.appendChild(button);
  applyPlaceholderTheme(placeholder);

  element.parentNode.insertBefore(placeholder, element);
  element.style.display = "none";
  element.dataset.aiDetectorHidden = "true";
  element.dataset.aiDetectorPlaceholderId = placeholderId;

  sendMessage({ action: "hiddenDelta", delta: 1 });
}

function revealTweet(element) {
  const cleared = clearHiddenState(element);
  if (!cleared) {
    return;
  }
  element.dataset.aiDetectorRevealed = "true";
}

function getFilterAction(settingsSnapshot, score) {
  if (filteringLogic && typeof filteringLogic.getFilterAction === "function") {
    return filteringLogic.getFilterAction(settingsSnapshot, score);
  }

  if (!settingsSnapshot || !settingsSnapshot.enabled) {
    return "none";
  }

  const shouldCollapse =
    settingsSnapshot.collapseEnabled && score >= settingsSnapshot.threshold;
  const shouldHide =
    !settingsSnapshot.collapseEnabled &&
    settingsSnapshot.filterEnabled !== false &&
    score >= settingsSnapshot.threshold;

  if (shouldCollapse) {
    return "collapse";
  }

  if (shouldHide) {
    return "hide";
  }

  return "none";
}

function applyFiltering(element, score) {
  if (!settings.enabled) {
    return;
  }

  const action = getFilterAction(settings, score);

  if (action === "collapse") {
    if (element.dataset.aiDetectorHidden === "true") {
      clearHiddenState(element);
    }
    collapseTweet(element, score);
    return;
  }

  if (action === "hide") {
    if (element.dataset.aiDetectorCollapsed === "true") {
      clearHiddenState(element);
    }
    hideTweet(element, score);
    return;
  }

  if (
    element.dataset.aiDetectorHidden === "true" ||
    element.dataset.aiDetectorCollapsed === "true"
  ) {
    revealTweet(element);
  }
}

async function analyzeTweet(element) {
  if (!element || !element.isConnected) {
    return;
  }

  try {
    if (!settings.enabled || !shouldAnalyzeContext(element)) {
      return;
    }

    const text = getTweetText(element);
    if (!text) {
      return;
    }

    const tweetId = getTweetId(element, text);
    if (!tweetId) {
      return;
    }

    element.dataset.aiDetectorId = tweetId;

    if (processedScores.has(tweetId)) {
      const cached = processedScores.get(tweetId);
      setBadgeScore(getBadge(element), cached.score, cached.method);
      applyFiltering(element, cached.score);
      return;
    }

    if (pendingTweetIds.has(tweetId)) {
      return;
    }

    pendingTweetIds.add(tweetId);
    const badge = getBadge(element);
    setBadgeLoading(badge);

    const result = await sendMessage({
      action: "analyzeTweet",
      text,
      tweetId
    });

    pendingTweetIds.delete(tweetId);

    if (!result || !result.success) {
      if (result && result.error === "API_KEY_MISSING") {
        setBadgeError(badge, "API key");
        badge.title = "Add your API key in the extension popup";
      } else if (result && result.error === "API_KEY_INVALID") {
        setBadgeError(badge, "Invalid key");
        badge.title = "Your API key is invalid";
      } else if (result && result.error === "MODEL_INVALID") {
        setBadgeError(badge, "Model");
        badge.title = "Invalid Hugging Face model ID";
      } else if (result && result.error === "MODEL_NOT_FOUND") {
        setBadgeError(badge, "Model");
        badge.title = "Hugging Face model not found";
      } else if (result && result.error === "ENDPOINT_UNAVAILABLE") {
        setBadgeError(badge, "HF API");
        badge.title = "Hugging Face endpoint unavailable";
      } else {
        setBadgeError(badge, "Error");
        badge.title = "Unable to analyze this tweet";
      }
      return;
    }

    processedScores.set(tweetId, {
      score: result.score,
      method: result.method
    });

    setBadgeScore(badge, result.score, result.method);
    applyFiltering(element, result.score);
  } finally {
    if (element && element.dataset) {
      element.dataset.aiDetectorQueued = "false";
    }
  }
}
function enqueueTweet(element) {
  if (!element || element.dataset.aiDetectorQueued === "true") {
    return;
  }
  element.dataset.aiDetectorQueued = "true";
  analyzeQueue.push(element);
  processAnalyzeQueue();
}

async function processAnalyzeQueue() {
  if (queueProcessing) {
    return;
  }
  queueProcessing = true;

  while (analyzeQueue.length > 0) {
    const element = analyzeQueue.shift();
    await analyzeTweet(element);
  }

  queueProcessing = false;
}

function scanForTweets(root = document) {
  root.querySelectorAll(TWEET_SELECTOR).forEach((tweet) => {
    intersectionObserver.observe(tweet);
  });
}

function observeTweets() {
  scanForTweets();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        if (node.matches && node.matches(TWEET_SELECTOR)) {
          intersectionObserver.observe(node);
          return;
        }

        if (node.querySelectorAll) {
          node.querySelectorAll(TWEET_SELECTOR).forEach((tweet) => {
            intersectionObserver.observe(tweet);
          });
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function updateSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (res) => {
    settings = { ...DEFAULT_SETTINGS, ...res };
    processedScores.forEach((entry, tweetId) => {
      const element = document.querySelector(
        `${TWEET_SELECTOR}[data-ai-detector-id='${tweetId}']`
      );
      if (!element) {
        return;
      }
      applyFiltering(element, entry.score);
    });

    if (settings.enabled) {
      document.querySelectorAll(TWEET_SELECTOR).forEach((tweet) => {
        enqueueTweet(tweet);
      });
    }
  });
}

function applyIdsToTweets() {
  document.querySelectorAll(TWEET_SELECTOR).forEach((tweet) => {
    const text = getTweetText(tweet);
    const tweetId = getTweetId(tweet, text);
    if (tweetId && !tweet.dataset.aiDetectorId) {
      tweet.dataset.aiDetectorId = tweetId;
    }
  });
}

function revealAllHiddenTweets() {
  document.querySelectorAll(TWEET_SELECTOR).forEach((tweet) => {
    if (
      tweet.dataset.aiDetectorHidden === "true" ||
      tweet.dataset.aiDetectorCollapsed === "true"
    ) {
      revealTweet(tweet);
    }
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }
  updateSettings();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender || sender.id !== chrome.runtime.id) {
    return;
  }
  if (message && message.action === "revealAll") {
    revealAllHiddenTweets();
    sendResponse({ success: true });
  }

  if (message && message.action === "clearLocalState") {
    processedScores.clear();
    pendingTweetIds.clear();
    sendResponse({ success: true });
  }
});

updateSettings();
applyIdsToTweets();
observeTweets();











