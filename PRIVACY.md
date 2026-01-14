# Privacy Policy

This policy explains how AI Tweet Detector handles data. It applies to the
extension only, not to third-party providers.

## Summary
AI Tweet Detector analyzes tweet text to estimate AI likelihood. It can run
entirely on-device (local-only mode) or send tweet text to a selected provider
for scoring (Hugging Face or GPTZero).

## Data Collected
The extension processes:
- Tweet text on Twitter/X pages
- Configuration settings (threshold, toggles, model ID, provider)

The extension does not collect usernames, profile data, or cookies.

## Data Sent Off-Device
When local-only mode is disabled:
- Tweet text is sent to the selected provider API for scoring.
- Provider services may log requests; refer to their privacy policies.

When local-only mode is enabled:
- No tweet text is sent off-device.

## Local Storage
Stored in `chrome.storage.local`:
- API keys (never synced)
- Local cache of tweet scores (timestamped)
- Usage statistics

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

## Data Sharing
The extension does not sell or share data with third parties beyond the
selected scoring provider.

## Changes
If this policy changes, update this file and document the change in release
notes.

## Contact
For privacy questions, open an issue at:
`https://github.com/tiagosousa4/twitter-ai-detector/issues`
