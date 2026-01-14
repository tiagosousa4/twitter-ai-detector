const fs = require("fs");
const path = require("path");
const {
  loadBenchmarkEntries,
  getScoreAverages,
  evaluateEntries,
  sweepThresholds,
  getSourceSummaries,
  buildSuggestionPayload,
  writeSuggestionFile
} = require("./benchmark-utils");

const args = process.argv.slice(2);
let fileArg = null;
let thresholdArg = null;
let precisionTargetRaw = process.env.PRECISION_TARGET || "";
let writeSuggestion =
  process.env.WRITE_SUGGESTION === "1" || process.env.WRITE_SUGGESTION === "true";

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--write-suggestion") {
    writeSuggestion = true;
    continue;
  }
  if (arg === "--precision-target") {
    precisionTargetRaw = args[i + 1] || precisionTargetRaw;
    i += 1;
    continue;
  }
  if (arg.startsWith("--precision-target=")) {
    precisionTargetRaw = arg.split("=", 2)[1] || precisionTargetRaw;
    continue;
  }
  if (arg === "--threshold") {
    thresholdArg = args[i + 1] || thresholdArg;
    i += 1;
    continue;
  }
  if (arg.startsWith("--threshold=")) {
    thresholdArg = arg.split("=", 2)[1] || thresholdArg;
    continue;
  }
  if (arg === "--file") {
    fileArg = args[i + 1] || fileArg;
    i += 1;
    continue;
  }
  if (arg.startsWith("--file=")) {
    fileArg = arg.split("=", 2)[1] || fileArg;
    continue;
  }
  if (!fileArg) {
    fileArg = arg;
    continue;
  }
  if (!thresholdArg) {
    thresholdArg = arg;
  }
}

const defaultRealPath = path.join(
  __dirname,
  "..",
  "benchmarks",
  "heuristics-benchmark-real.jsonl"
);
const filePath = fileArg || defaultRealPath;
if (!fs.existsSync(filePath)) {
  console.error(
    `Benchmark file not found: ${filePath}. Build it with node scripts/build-real-benchmark.js`
  );
  process.exit(1);
}
const thresholdRaw = thresholdArg || process.env.THRESHOLD || "72";
const threshold = Number(thresholdRaw);

if (!Number.isFinite(threshold)) {
  console.error(`Invalid threshold: ${thresholdRaw}`);
  process.exit(1);
}

let precisionTarget = 0.99;
if (precisionTargetRaw !== "") {
  const parsedTarget = Number(precisionTargetRaw);
  if (!Number.isFinite(parsedTarget)) {
    console.error(`Invalid precision target: ${precisionTargetRaw}`);
    process.exit(1);
  }
  precisionTarget = parsedTarget > 1 ? parsedTarget / 100 : parsedTarget;
}

precisionTarget = Math.max(0, Math.min(1, precisionTarget));
let entries = [];
try {
  entries = loadBenchmarkEntries(filePath);
} catch (err) {
  console.error(err.message || `Failed to read benchmark file: ${filePath}`);
  process.exit(1);
}

const averages = getScoreAverages(entries);
const counts = averages.counts;
const current = evaluateEntries(entries, threshold, true);
const sweep = sweepThresholds(entries, precisionTarget);
const best = sweep.best;
const conservative = sweep.conservative;
const bestResult = evaluateEntries(entries, best.threshold, false);

if (writeSuggestion) {
  const suggestionPath = path.join(__dirname, "..", "heuristics-suggestion.json");
  const payload = buildSuggestionPayload({
    best,
    bestAccuracy: bestResult.accuracy,
    conservative,
    precisionTarget,
    samples: entries.length,
    sourceFile: path.basename(filePath)
  });
  writeSuggestionFile(suggestionPath, payload);
}

current.misclassified.sort(
  (a, b) => Math.abs(a.score - threshold) - Math.abs(b.score - threshold)
);

console.log("Heuristics Benchmark");
console.log(`File: ${filePath}`);
console.log(`Threshold: ${threshold}`);
console.log(`Samples: ${entries.length} (AI ${counts.ai}, Human ${counts.human})`);
console.log("");
console.log(`TP: ${current.tp}  FP: ${current.fp}  TN: ${current.tn}  FN: ${current.fn}`);
console.log(`Accuracy: ${(current.accuracy * 100).toFixed(1)}%`);
console.log(`Precision: ${(current.precision * 100).toFixed(1)}%`);
console.log(`Recall: ${(current.recall * 100).toFixed(1)}%`);
console.log(`F1: ${(current.f1 * 100).toFixed(1)}%`);
console.log(`Avg AI score: ${averages.avgAi.toFixed(1)}`);
console.log(`Avg Human score: ${averages.avgHuman.toFixed(1)}`);

const sourceSummaries = getSourceSummaries(entries, threshold);
if (sourceSummaries.length) {
  const maxSources = 6;
  console.log("");
  console.log("Source breakdown:");
  sourceSummaries.slice(0, maxSources).forEach((item) => {
    console.log(
      `- ${item.source}: ${item.count} samples (Acc ${(item.accuracy * 100).toFixed(
        1
      )}%, Prec ${(item.precision * 100).toFixed(1)}%, Rec ${(item.recall * 100).toFixed(
        1
      )}%, F1 ${(item.f1 * 100).toFixed(1)}%)`
    );
  });
  if (sourceSummaries.length > maxSources) {
    console.log(`- ${sourceSummaries.length - maxSources} more sources not shown`);
  }
}

console.log("");
console.log("Metric definitions:");
console.log("- Accuracy: overall correct classifications across all samples.");
console.log("- Precision: of items predicted AI, how many are truly AI.");
console.log("- Recall: of AI-labeled items, how many the heuristic detected.");
console.log("- F1: harmonic mean of precision and recall (balance of both).");
console.log("");
console.log(
  `Suggested threshold (max F1): ${best.threshold} (Precision ${(best.precision * 100).toFixed(
    1
  )}%, Recall ${(best.recall * 100).toFixed(1)}%)`
);
if (conservative.precision >= precisionTarget) {
  console.log(
    `Suggested threshold (precision >= ${Math.round(
      precisionTarget * 100
    )}%): ${conservative.threshold} (Precision ${(conservative.precision * 100).toFixed(
      1
    )}%, Recall ${(conservative.recall * 100).toFixed(1)}%)`
  );
} else {
  console.log(
    `Suggested threshold (precision >= ${Math.round(
      precisionTarget * 100
    )}%): none found`
  );
}

if (current.misclassified.length) {
  console.log("");
  console.log("Misclassified (closest to threshold):");
  current.misclassified.slice(0, 5).forEach((item) => {
    console.log(
      `- ${item.id}: ${item.label} -> ${item.predicted} (${item.score}): ${item.text}`
    );
  });
}
