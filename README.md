# AI Tweet Detector (Chrome Extension)

Detects AI-generated tweets on Twitter/X using Hugging Face (default) or GPTZero. The extension adds an AI likelihood badge to each tweet, can hide tweets above a configurable threshold, and provides usage stats in the popup.

## Features
- Hugging Face Inference API (default) or GPTZero integration
- Rate limiting, caching, and heuristic fallback
- Badge overlay on tweets with AI likelihood score
- Optional filtering + reveal controls
- Configurable contexts (timeline, replies, search, tweet pages)

## Setup
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `ai-tweet-detector` folder.
4. Click the extension icon, choose local-only or network analysis, and paste your API key if needed.
5. Refresh Twitter/X to start analyzing.

## Hugging Face (Default)
- Create a token at https://huggingface.co/settings/tokens (read access is enough).
- Default model: `openai-community/roberta-large-openai-detector`
- You can change the model ID in the popup.
- Requests are routed through `https://router.huggingface.co`.

## GPTZero (Optional)
- Create a GPTZero account and generate an API key at https://gptzero.me.
- Switch the provider to GPTZero in the popup.

## Settings
Open the extension popup to:
- Select provider (Hugging Face or GPTZero)
- Enable/disable detection
- Toggle filtering (hide tweets above the threshold or show scores only)
- Adjust the filter threshold
- Toggle analysis contexts
- View usage stats and reset cache

## Privacy
See `PRIVACY.md` for data handling and storage details.

## Security
See `SECURITY.md` for vulnerability reporting.

## Data Handling
- Tweet text is sent to the selected provider (Hugging Face or GPTZero) for scoring.
- API keys are stored locally in your browser profile and are not synced.
- Scores are cached locally to reduce repeat requests; clear the cache from the popup.
- Local-only mode keeps all analysis on-device and skips API calls.

## Notes
- When API errors or limits are hit, the extension switches to heuristic scoring.
- Hugging Face usage depends on your HF account limits.

## Development
- Optional secret-scan hook: `git config core.hooksPath githooks`
- Bypass on false positives: `SKIP_SECRET_SCAN=1 git commit ...` or `git commit --no-verify`
- GitHub Actions secret scan runs on pushes and pull requests.

## File Structure
```
ai-tweet-detector/
|-- manifest.json
|-- background.js
|-- content.js
|-- popup.html
|-- popup.js
|-- styles.css
|-- PRIVACY.md
|-- SECURITY.md
|-- githooks/
|   `-- pre-commit
`-- icons/
    |-- icon16.png
    |-- icon48.png
    `-- icon128.png
```

