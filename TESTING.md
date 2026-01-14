# Testing Guide

This document captures manual test steps for the recent security-related changes.

## 1) Local-only API keys / synced non-sensitive prefs
1. Reload the extension in `chrome://extensions`.
2. Open the popup on a normal page, paste your HF token, click Save.
3. Open the service worker console (Extensions -> Details -> Service worker -> Inspect) and run:

```js
chrome.storage.local.get(["apiKey","hfApiKey"])
chrome.storage.sync.get(["apiKey","hfApiKey"])
```

Expected:
- Keys present in `local`.
- Keys absent in `sync`.

4. Change a non-sensitive setting (e.g., threshold) and verify it lands in sync:

```js
chrome.storage.sync.get(["threshold","enabled","provider"])
```

Expected:
- Non-sensitive values appear in `sync`.

## 2) Secret migration (sync -> local)
1. In the service worker console, seed sync keys:

```js
chrome.storage.sync.set({ apiKey: "old_sync_key", hfApiKey: "old_sync_hf" })
```

2. Reload the extension.
3. Check storage:

```js
chrome.storage.local.get(["apiKey","hfApiKey"])
chrome.storage.sync.get(["apiKey","hfApiKey"])
```

Expected:
- Keys moved to `local`.
- Keys removed from `sync`.

## 3) Cache pruning (TTL + size cap)
1. Seed cache entries (some old, some fresh):

```js
const old = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days
const fresh = Date.now();
const cache = {};
for (let i = 0; i < 600; i++) {
  cache["id"+i] = { score: 50, method: "api", timestamp: i < 300 ? old : fresh };
}
chrome.storage.local.set({ aiCache: cache });
```

2. Trigger load (analyze any tweet or run):

```js
chrome.runtime.sendMessage({ action: "analyzeTweet", text: "test", tweetId: "test-id" })
```

3. Inspect cache size:

```js
chrome.storage.local.get("aiCache")
```

Expected:
- Cache size <= 500.
- Old entries removed.

## 4) HF label mapping
1. Set provider to Hugging Face.
2. Set model to `openai-community/roberta-large-openai-detector`.
3. Refresh X/Twitter and verify badges show percentages (no errors).

## 5) Popup broadcast change (no errors on non-Twitter pages)
1. Open the popup while on `chrome://extensions`.
2. Click "Reveal hidden" or "Clear cache".

Expected:
- No errors in `chrome://extensions` -> Errors.

## 6) README data-handling disclosure
1. Open `README.md`.
2. Confirm the "Data Handling" section exists and matches your policy.

## 7) Filtering toggle (scores only mode)
1. Open the extension popup on any page.
2. Toggle "Hide tweets above threshold" off.
3. Refresh X/Twitter and confirm badges show while tweets are not hidden.
