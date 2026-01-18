# Privacy Policy

This policy explains how AI Tweet Detector handles data. It applies to the
extension only, not to third-party providers.

## Summary
AI Tweet Detector analyzes tweet text to estimate AI likelihood. It can run
entirely on-device (local-only mode) or send tweet text to a selected provider
for scoring (Hugging Face or GPTZero).
Tweet text is truncated to 5,000 characters before analysis.

## Data Collected
The extension processes:
- Tweet text on Twitter/X pages
- Configuration settings (threshold, toggles, model ID, provider)

The extension does not collect usernames, profile data, or cookies.
We do not operate a backend service and do not receive or store tweet text,
API keys, or other content on our servers.

## Data Sent Off-Device
When local-only mode is disabled:
- Tweet text is sent to the selected provider API for scoring (truncated to 5,000 characters).
- Provider services may log requests; refer to their privacy policies.
  Provider services may process data in other countries; refer to their policies for data location and transfers.
We do not receive a copy of the tweet text or the provider responses.

When local-only mode is enabled:
- No tweet text is sent off-device.

## Local Storage
Stored in `chrome.storage.local`:
- API keys (never synced)
- Local cache of tweet scores keyed by tweet IDs (or a text hash when no status ID is available)
- Usage statistics
API keys stay on-device and are only used to authenticate requests to the
selected provider.

Stored in `chrome.storage.session` (or `chrome.storage.local` fallback):
- Revealed tweet IDs (up to 300) so hidden/collapsed tweets stay visible

Stored in `chrome.storage.sync`:
- Non-sensitive settings such as thresholds, toggles, and model ID

Cache retention:
- Max 500 items
- TTL of 7 days

## User Controls
The popup provides:
- Local-only toggle (prevents network analysis)
- Clear cache (removes cached scores)
- Reset stats (clears local stats)
- Reset defaults (restores default settings)
- Reveal hidden (shows any hidden or collapsed tweets)

## Data Sharing
The extension does not sell or share data with third parties beyond the
selected scoring provider.

## Changes
If this policy changes, update this file and document the change in release
notes.

## Contact
For privacy questions, open an issue at:
`https://github.com/tiagosousa4/twitter-ai-detector/issues`
