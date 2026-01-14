# Testing Guide

This document covers automated and manual tests for AI Tweet Detector.

## Automated Tests
Run all tests:
```
npm test
```

If PowerShell blocks npm scripts, run:
```
node tests/run-tests.js
```

Run specific suites:
```
npm run test:heuristics
npm run test:popup
npm run test:filtering
```

Benchmark the heuristics:
```
npm run benchmark
npm run benchmark:all
node scripts/run-benchmark.js benchmarks/heuristics-benchmark-real.jsonl 72
```

`npm run benchmark` uses `benchmarks/heuristics-benchmark-real.jsonl`.
If it is missing, build it with `node scripts/build-real-benchmark.js` (requires network).
The real dataset stays local (gitignored).

Coverage:
- Heuristic scoring normalization and curve behavior
- Popup logic (threshold hints, mutual exclusivity)
- Filtering decisions (hide vs collapse)

## Manual Test Checklist
1. Reload the extension in `chrome://extensions`.
2. Open the popup and verify the Info button toggles the onboarding panel.
3. Toggle Hide and Collapse to ensure only one can be enabled at a time.
4. Adjust the threshold slider and confirm the hint text updates.
5. Enable local-only mode and confirm no network calls are made.
6. Add an API key and verify remote analysis works for both providers.
7. Confirm badges show scores and update when tweets are re-analyzed.
8. Use Clear cache and verify tweets re-score after refresh.
9. Use Reveal hidden and confirm hidden/collapsed tweets reappear.
10. Confirm stats update after analysis and reset with Reset stats.

## Regression Checks
- Switching providers updates the model hint and token label.
- Disabled detection leaves tweets untouched but keeps badges available.
- Cache retention respects max size and TTL.
