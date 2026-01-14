# Privacy Policy

## Summary
AI Tweet Detector analyzes tweet text on Twitter/X to estimate AI likelihood. It can run in local-only mode (no API calls) or send text to the selected provider (Hugging Face or GPTZero).

## Data Sent Off-Device
- Tweet text is sent to the chosen provider's API for scoring.
- No usernames, profile data, or cookies are explicitly collected by the extension.
- Provider services may log requests; refer to their privacy policies for details.

## Data Stored Locally
- API keys are stored in `chrome.storage.local` on your device and are not synced.
- Non-sensitive settings (thresholds, toggles, model ID, provider) are stored in `chrome.storage.sync` for optional cross-device sync.
- A local cache stores tweet scores and timestamps to reduce repeat requests.
- Usage stats are stored locally for display in the popup.

## User Controls
- Clear cache: removes cached scores.
- Reset stats: clears local stats.
- Reset defaults: restores settings to defaults and clears local keys.
- Local-only toggle: disables all network analysis.

## Data Sharing
The extension does not sell or share data with third parties beyond the selected scoring provider.

## Changes
If this policy changes, update this file and note changes in release notes.
