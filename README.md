# AI Tweet Detector (Chrome Extension)

Detects AI-generated tweets on Twitter/X using Hugging Face (default) or GPTZero.
The extension adds AI likelihood badges, can hide or collapse tweets above a threshold,
and provides usage stats in the popup.
Results are probabilistic and may be inaccurate.
Not affiliated with X Corp. or Twitter.

## User Onboarding
- Open the popup and choose local-only for on-device scoring, or add an API key for network analysis.
- Set your threshold. Lower means stricter filtering.
- Choose Hide or Collapse. They are mutually exclusive.
- Use Clear cache after changing models or thresholds.

The same checklist is available from the Info button in the popup.

## Features
- Hugging Face Inference API (default) or GPTZero integration
- Local-only heuristic scoring or API-based scoring with heuristic fallback
- AI likelihood badge on each tweet
- Hide or collapse tweets above a configurable threshold
- Configurable contexts (timeline, replies, search, tweet pages)
- Local cache and usage statistics
- Heuristic mode suggestion displayed when local-only mode is enabled

## Setup
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `ai-tweet-detector` folder.
4. Open the extension popup, choose local-only or network analysis, and paste your API key if needed.
5. Refresh Twitter/X to start analyzing.

The extension runs on `https://twitter.com/*` and `https://x.com/*`.

## Providers
### Hugging Face (Default)
- Create a token at https://huggingface.co/settings/tokens (read access is enough).
- Default model: `openai-community/roberta-large-openai-detector`
- Requests are routed through `https://router.huggingface.co`.

### GPTZero (Optional)
- Create an account and generate an API key at https://gptzero.me.
- Switch the provider to GPTZero in the popup.

## Configuration
Open the extension popup to:
- Enable or disable detection
- Hide tweets above the threshold, or collapse them instead
- Adjust the threshold
- Toggle analysis contexts
- View usage stats, clear cache, or reveal hidden tweets

## Data Handling
See `PRIVACY.md` for the full data handling policy.

## Security
See `SECURITY.md` for vulnerability reporting.

## Testing
Automated tests:
- `npm test` runs the local test suite
- `npm run test:heuristics` for heuristic scoring
- `npm run test:popup` for popup logic
- `npm run test:filtering` for filtering decisions
- `npm run benchmark` to run the heuristics benchmark set (defaults to threshold 72)

Manual testing steps are documented in `TESTING.md`.

## Development
- Optional secret-scan hook: `git config core.hooksPath githooks`
- Bypass on false positives: `SKIP_SECRET_SCAN=1 git commit ...` or `git commit --no-verify`
- CI runs tests on pushes and pull requests.
- Release workflow builds a zip artifact on tags/releases.
- CWS upload: use the release zip (allowlist) and avoid uploading the full repo so internal datasets (e.g. `benchmarks/`) are excluded.

## File Structure
```
ai-tweet-detector/
|-- .github/
|   `-- workflows/
|-- manifest.json
|-- background.js
|-- content.js
|-- filtering.js
|-- heuristics.js
|-- heuristics-suggestion.json
|-- popup.html
|-- popup-logic.js
|-- popup.js
|-- styles.css
|-- package.json
|-- benchmarks/
|   `-- heuristics-benchmark-real.jsonl (gitignored)
|-- scripts/
|   |-- benchmark-utils.js
|   |-- build-real-benchmark.js
|   |-- run-benchmark.js
|   `-- run-benchmark-suite.js
|-- PRIVACY.md
|-- SECURITY.md
|-- TESTING.md
|-- logo.png
|-- dist/ (generated, gitignored)
|-- githooks/
|   `-- pre-commit
|-- tests/
|   |-- filtering.test.js
|   |-- heuristics.test.js
|   |-- popup-logic.test.js
|   |-- run-tests.js
|   `-- test-harness.js
`-- icons/
    |-- icon16.png
    |-- icon48.png
    `-- icon128.png
```
