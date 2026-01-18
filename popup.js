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

const DEFAULT_SYNC_SETTINGS = {
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

const DEFAULT_LOCAL_SETTINGS = {
  apiKey: "",
  hfApiKey: ""
};

const MODEL_ID_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}(?:@[a-zA-Z0-9._-]{1,64})?$/;

const popupLogic =
  typeof aiDetectorPopupLogic !== "undefined" ? aiDetectorPopupLogic : null;
const normalizeFilterCollapse =
  popupLogic && typeof popupLogic.normalizeFilterCollapse === "function"
    ? popupLogic.normalizeFilterCollapse
    : (settings) => settings;
const getThresholdHint =
  popupLogic && typeof popupLogic.getThresholdHint === "function"
    ? popupLogic.getThresholdHint
    : (settings, value) => {
      const displayValue = Number.isFinite(Number(value)) ? value : "";
      const collapsing = !!(settings && settings.collapseEnabled);
      const filtering = settings && settings.filterEnabled !== false;

      if (collapsing) {
        return `Collapsing tweets above ${displayValue}% AI likelihood`;
      }

      if (filtering) {
        return `Hiding tweets above ${displayValue}% AI likelihood`;
      }

      return "Filtering disabled (scores only)";
    };

const elements = {
  provider: document.getElementById("provider"),
  apiKeyLabel: document.getElementById("apiKeyLabel"),
  apiKey: document.getElementById("apiKey"),
  showApiKeyToggle: document.getElementById("showApiKeyToggle"),
  hfModel: document.getElementById("hfModel"),
  modelRow: document.getElementById("modelRow"),
  modelHint: document.getElementById("modelHint"),
  localOnlyToggle: document.getElementById("localOnlyToggle"),
  filterToggle: document.getElementById("filterToggle"),
  collapseToggle: document.getElementById("collapseToggle"),
  privacyBanner: document.getElementById("privacyBanner"),
  signupLink: document.getElementById("signupLink"),
  saveApiKey: document.getElementById("saveApiKey"),
  apiUsage: document.getElementById("apiUsage"),
  apiStatus: document.getElementById("apiStatus"),
  enabledToggle: document.getElementById("enabledToggle"),
  threshold: document.getElementById("threshold"),
  thresholdValue: document.getElementById("thresholdValue"),
  thresholdHint: document.getElementById("thresholdHint"),
  analyzeTimeline: document.getElementById("analyzeTimeline"),
  analyzeReplies: document.getElementById("analyzeReplies"),
  analyzeSearch: document.getElementById("analyzeSearch"),
  analyzeTweetPages: document.getElementById("analyzeTweetPages"),
  statTotal: document.getElementById("statTotal"),
  statAvg: document.getElementById("statAvg"),
  statHidden: document.getElementById("statHidden"),
  statRemaining: document.getElementById("statRemaining"),
  fallbackStatus: document.getElementById("fallbackStatus"),
  clearCache: document.getElementById("clearCache"),
  revealAll: document.getElementById("revealAll"),
  resetDefaults: document.getElementById("resetDefaults"),
  resetStats: document.getElementById("resetStats"),
  infoToggle: document.getElementById("infoToggle"),
  infoPanel: document.getElementById("infoPanel"),
  infoClose: document.getElementById("infoClose"),
  heuristicSuggestion: document.getElementById("heuristicSuggestion"),
  heuristicSuggestionRow: document.getElementById("heuristicSuggestionRow")
};

let currentSettings = { ...DEFAULT_SETTINGS };
let heuristicSuggestion = {
  threshold: 72,
  accuracy: 98,
  precision: 99.6,
  recall: 96.4,
  conservativeThreshold: 72,
  conservativePrecision: 99.6,
  conservativeRecall: 96.4,
  precisionTarget: 99,
  samples: 500,
  note: "Suggested from benchmark sweep (max F1)."
};

function updateThresholdDisplay(value) {
  elements.thresholdValue.textContent = value;
  elements.thresholdHint.textContent = getThresholdHint(currentSettings, value);
}

function setStatus(message, tone = "") {
  elements.apiStatus.textContent = message;
  elements.apiStatus.style.color = tone || "";
}

function isValidModelId(value) {
  return MODEL_ID_PATTERN.test(String(value || "").trim());
}

function saveSettings(partial) {
  const syncUpdate = {};
  const localUpdate = {};

  Object.keys(partial).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_LOCAL_SETTINGS, key)) {
      localUpdate[key] = partial[key];
    } else {
      syncUpdate[key] = partial[key];
    }
  });

  if (Object.keys(syncUpdate).length) {
    chrome.storage.sync.set(syncUpdate);
  }
  if (Object.keys(localUpdate).length) {
    chrome.storage.local.set(localUpdate);
  }

  currentSettings = { ...currentSettings, ...partial };
}

function safeRuntimeMessage(message, callback) {
  chrome.runtime.sendMessage(message, (response) => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      return;
    }
    if (typeof callback === "function") {
      callback(response);
    }
  });
}


function updateProviderUI(provider) {
  const isHuggingFace = provider === "huggingface";

  elements.modelRow.style.display = isHuggingFace ? "flex" : "none";
  elements.apiKeyLabel.textContent = isHuggingFace
    ? "Hugging Face Token"
    : "GPTZero API Key";
  elements.signupLink.href = isHuggingFace
    ? "https://huggingface.co/settings/tokens"
    : "https://gptzero.me";
  elements.signupLink.textContent = isHuggingFace
    ? "Get a Hugging Face access token"
    : "Get a GPTZero API key";
  elements.modelHint.textContent = `Default: ${DEFAULT_SETTINGS.hfModel}`;
}

function updateApiKeyField(provider) {
  if (provider === "huggingface") {
    elements.apiKey.value = currentSettings.hfApiKey || "";
  } else {
    elements.apiKey.value = currentSettings.apiKey || "";
  }
}

function updateApiKeyVisibility() {
  elements.apiKey.type = elements.showApiKeyToggle.checked ? "text" : "password";
}

function updatePrivacyUI() {
  const localOnly = !!currentSettings.localOnly;
  elements.localOnlyToggle.checked = localOnly;

  if (localOnly) {
    elements.privacyBanner.style.display = "none";
  } else {
    elements.privacyBanner.style.display = "block";
  }

  if (elements.heuristicSuggestionRow) {
    elements.heuristicSuggestionRow.hidden = !localOnly;
  } else if (elements.heuristicSuggestion) {
    elements.heuristicSuggestion.hidden = !localOnly;
  }
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return `${value.toFixed(1)}%`;
}

function updateHeuristicSuggestionText() {
  if (!elements.heuristicSuggestion) {
    return;
  }
  const accuracy = formatPercentage(heuristicSuggestion.accuracy);
  const precision = formatPercentage(heuristicSuggestion.precision);
  const recall = formatPercentage(heuristicSuggestion.recall);
  const threshold = Number.isFinite(heuristicSuggestion.threshold)
    ? heuristicSuggestion.threshold
    : "n/a";
  elements.heuristicSuggestion.textContent =
    `Heuristic mode suggestion: ${threshold}% ` +
    `(Accuracy ${accuracy}, Precision ${precision}, Recall ${recall}).`;
}

function loadHeuristicSuggestion() {
  if (!chrome || !chrome.runtime || !chrome.runtime.getURL) {
    updateHeuristicSuggestionText();
    return;
  }
  const url = chrome.runtime.getURL("heuristics-suggestion.json");
  fetch(url)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data && typeof data === "object") {
        heuristicSuggestion = { ...heuristicSuggestion, ...data };
      }
      updateHeuristicSuggestionText();
    })
    .catch(() => {
      updateHeuristicSuggestionText();
    });
}

function setInfoPanelVisible(visible) {
  if (!elements.infoPanel || !elements.infoToggle) {
    return;
  }
  elements.infoPanel.hidden = !visible;
  elements.infoToggle.setAttribute("aria-expanded", visible ? "true" : "false");
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SYNC_SETTINGS, (syncRes) => {
    chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS, (localRes) => {
      const merged = { ...DEFAULT_SETTINGS, ...syncRes, ...localRes };
      const normalized = normalizeFilterCollapse(merged);
      if (
        normalized.filterEnabled !== merged.filterEnabled ||
        normalized.collapseEnabled !== merged.collapseEnabled
      ) {
        chrome.storage.sync.set({
          filterEnabled: normalized.filterEnabled,
          collapseEnabled: normalized.collapseEnabled
        });
      }

      currentSettings = normalized;
      elements.provider.value = currentSettings.provider || "huggingface";
      elements.hfModel.value = currentSettings.hfModel || DEFAULT_SETTINGS.hfModel;
      elements.enabledToggle.checked = currentSettings.enabled;
      elements.filterToggle.checked = currentSettings.filterEnabled !== false;
      elements.collapseToggle.checked = !!currentSettings.collapseEnabled;
      elements.threshold.value = currentSettings.threshold;
      updateThresholdDisplay(currentSettings.threshold);
      elements.analyzeTimeline.checked = currentSettings.analyzeTimeline;
      elements.analyzeReplies.checked = currentSettings.analyzeReplies;
      elements.analyzeSearch.checked = currentSettings.analyzeSearch;
      elements.analyzeTweetPages.checked = currentSettings.analyzeTweetPages;

      updateProviderUI(elements.provider.value);
      updateApiKeyField(elements.provider.value);
      updatePrivacyUI();
      updateHeuristicSuggestionText();
      updateApiKeyVisibility();
    });
  });
}

function updateStats(stats) {
  if (!stats) {
    return;
  }

  const hasLimit = Number(stats.apiLimit || 0) > 0;
  const remaining = hasLimit
    ? Math.max(0, stats.apiLimit - (stats.apiCharsUsed || 0))
    : null;

  elements.statTotal.textContent = stats.totalAnalyzed || 0;
  elements.statAvg.textContent = `${Math.round(stats.avgScore || 0)}%`;
  elements.statHidden.textContent = stats.hiddenCount || 0;
  elements.statRemaining.textContent = hasLimit ? remaining : "N/A";
  elements.apiUsage.textContent = hasLimit
    ? `Usage: ${stats.apiCharsUsed || 0} / ${stats.apiLimit || 0} chars`
    : "Usage: N/A";

  if (stats.fallbackMode) {
    elements.fallbackStatus.textContent = "Fallback mode active (heuristics)";
  } else {
    elements.fallbackStatus.textContent = "";
  }
}

function refreshStats() {
  safeRuntimeMessage({ action: "getStats" }, (response) => {
    updateStats(response);
  });
}

function sendToTwitterTabs(payload) {
  safeRuntimeMessage({ action: "broadcastToTabs", payload });
}

elements.provider.addEventListener("change", (event) => {
  const provider = event.target.value;
  saveSettings({ provider });
  updateProviderUI(provider);
  updateApiKeyField(provider);
  updatePrivacyUI();
  updateApiKeyVisibility();
  safeRuntimeMessage({ action: "syncProvider", provider }, () => {
    refreshStats();
  });
});

elements.showApiKeyToggle.addEventListener("change", () => {
  updateApiKeyVisibility();
});

elements.saveApiKey.addEventListener("click", () => {
  const key = elements.apiKey.value.trim();
  if (key.length < 10) {
    setStatus("API key looks too short", "#f87171");
    return;
  }

  if (elements.provider.value === "huggingface") {
    saveSettings({ hfApiKey: key, provider: "huggingface" });
  } else {
    saveSettings({ apiKey: key, provider: "gptzero" });
  }

  setStatus("API key saved", "#34d399");
});

elements.hfModel.addEventListener("change", (event) => {
  const modelInput = event.target.value.trim();
  const model = modelInput || DEFAULT_SETTINGS.hfModel;

  if (!isValidModelId(model)) {
    setStatus("Model must be owner/model", "#f87171");
    elements.hfModel.value = currentSettings.hfModel || DEFAULT_SETTINGS.hfModel;
    return;
  }

  saveSettings({ hfModel: model });
  elements.hfModel.value = model;
  setStatus("Model saved", "#34d399");
});

elements.localOnlyToggle.addEventListener("change", (event) => {
  const nextLocalOnly = event.target.checked;

  if (!nextLocalOnly) {
    const proceed = window.confirm(
      "Disable local-only mode? This will send tweet text to the selected provider."
    );

    if (!proceed) {
      elements.localOnlyToggle.checked = true;
      updatePrivacyUI();
      return;
    }
  }

  saveSettings({ localOnly: nextLocalOnly });
  updatePrivacyUI();
  setStatus(
    nextLocalOnly ? "Local-only mode enabled" : "Network analysis enabled",
    "#34d399"
  );
});

if (elements.infoToggle) {
  elements.infoToggle.addEventListener("click", () => {
    const isOpen = elements.infoPanel && !elements.infoPanel.hidden;
    setInfoPanelVisible(!isOpen);
  });
}

if (elements.infoClose) {
  elements.infoClose.addEventListener("click", () => {
    setInfoPanelVisible(false);
  });
}

elements.filterToggle.addEventListener("change", (event) => {
  const nextFilter = event.target.checked;
  const updates = { filterEnabled: nextFilter };
  if (nextFilter && elements.collapseToggle.checked) {
    elements.collapseToggle.checked = false;
    updates.collapseEnabled = false;
  }
  saveSettings(updates);
  updateThresholdDisplay(elements.threshold.value);
});

elements.collapseToggle.addEventListener("change", (event) => {
  const nextCollapse = event.target.checked;
  const updates = { collapseEnabled: nextCollapse };
  if (nextCollapse && elements.filterToggle.checked) {
    elements.filterToggle.checked = false;
    updates.filterEnabled = false;
  }
  saveSettings(updates);
  updateThresholdDisplay(elements.threshold.value);
});

elements.enabledToggle.addEventListener("change", (event) => {
  saveSettings({ enabled: event.target.checked });
});

elements.threshold.addEventListener("input", (event) => {
  updateThresholdDisplay(event.target.value);
});

elements.threshold.addEventListener("change", (event) => {
  saveSettings({ threshold: Number(event.target.value) });
});

elements.analyzeTimeline.addEventListener("change", (event) => {
  saveSettings({ analyzeTimeline: event.target.checked });
});

elements.analyzeReplies.addEventListener("change", (event) => {
  saveSettings({ analyzeReplies: event.target.checked });
});

elements.analyzeSearch.addEventListener("change", (event) => {
  saveSettings({ analyzeSearch: event.target.checked });
});

elements.analyzeTweetPages.addEventListener("change", (event) => {
  saveSettings({ analyzeTweetPages: event.target.checked });
});

elements.clearCache.addEventListener("click", () => {
  safeRuntimeMessage({ action: "clearCache" }, () => {
    sendToTwitterTabs({ action: "clearLocalState" });
    setStatus("Cache cleared", "#34d399");
  });
});

elements.revealAll.addEventListener("click", () => {
  sendToTwitterTabs({ action: "revealAll" });
});

elements.resetDefaults.addEventListener("click", () => {
  chrome.storage.sync.set({ ...DEFAULT_SYNC_SETTINGS }, () => {
    chrome.storage.local.set({ ...DEFAULT_LOCAL_SETTINGS }, () => {
      loadSettings();
      setStatus("Defaults restored", "#34d399");
    });
  });
});

elements.resetStats.addEventListener("click", () => {
  safeRuntimeMessage({ action: "resetStats" }, () => {
    refreshStats();
    setStatus("Stats reset", "#34d399");
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.stats) {
      refreshStats();
    }
    if (changes.apiKey || changes.hfApiKey) {
      loadSettings();
    }
  }

  if (areaName === "sync") {
    loadSettings();
  }
});

loadSettings();
loadHeuristicSuggestion();
refreshStats();


