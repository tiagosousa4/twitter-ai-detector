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
const fileArgs = [];
let thresholdArg = null;
let precisionTargetRaw = process.env.PRECISION_TARGET || "";
let suggestionFileArg = null;
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
    if (args[i + 1]) {
      fileArgs.push(args[i + 1]);
    }
    i += 1;
    continue;
  }
  if (arg.startsWith("--file=")) {
    const value = arg.split("=", 2)[1];
    if (value) {
      fileArgs.push(value);
    }
    continue;
  }
  if (arg === "--suggestion-file") {
    suggestionFileArg = args[i + 1] || suggestionFileArg;
    i += 1;
    continue;
  }
  if (arg.startsWith("--suggestion-file=")) {
    suggestionFileArg = arg.split("=", 2)[1] || suggestionFileArg;
    continue;
  }
  fileArgs.push(arg);
}

const defaultRealPath = path.join(
  __dirname,
  "..",
  "benchmarks",
  "heuristics-benchmark-real.jsonl"
);

const files =
  fileArgs.length > 0
    ? fileArgs
    : [defaultRealPath].filter((filePath) => fs.existsSync(filePath));

if (!files.length) {
  console.error(
    "No benchmark files found. Build one with node scripts/build-real-benchmark.js"
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

function summarizeDataset(filePath) {
  const entries = loadBenchmarkEntries(filePath);
  const averages = getScoreAverages(entries);
  const current = evaluateEntries(entries, threshold, false);
  const sweep = sweepThresholds(entries, precisionTarget);
  const sourceSummaries = getSourceSummaries(entries, threshold);
  return {
    filePath,
    entries,
    averages,
    current,
    sweep,
    sourceSummaries
  };
}

const datasets = files.map((filePath) => {
  try {
    return summarizeDataset(filePath);
  } catch (err) {
    console.error(err.message || `Failed to load benchmark: ${filePath}`);
    process.exit(1);
  }
});

console.log("Heuristics Benchmark Suite");
console.log(`Threshold: ${threshold}`);
console.log(`Datasets: ${datasets.length}`);

datasets.forEach((dataset) => {
  const counts = dataset.averages.counts;
  console.log("");
  console.log(`Dataset: ${dataset.filePath}`);
  console.log(`Samples: ${dataset.entries.length} (AI ${counts.ai}, Human ${counts.human})`);
  console.log(`Accuracy: ${(dataset.current.accuracy * 100).toFixed(1)}%`);
  console.log(`Precision: ${(dataset.current.precision * 100).toFixed(1)}%`);
  console.log(`Recall: ${(dataset.current.recall * 100).toFixed(1)}%`);
  console.log(`F1: ${(dataset.current.f1 * 100).toFixed(1)}%`);
  console.log(`Avg AI score: ${dataset.averages.avgAi.toFixed(1)}`);
  console.log(`Avg Human score: ${dataset.averages.avgHuman.toFixed(1)}`);
  console.log(
    `Suggested threshold (max F1): ${dataset.sweep.best.threshold} (Precision ${(
      dataset.sweep.best.precision * 100
    ).toFixed(1)}%, Recall ${(dataset.sweep.best.recall * 100).toFixed(1)}%)`
  );
  if (dataset.sweep.conservative.precision >= precisionTarget) {
    console.log(
      `Suggested threshold (precision >= ${Math.round(
        precisionTarget * 100
      )}%): ${dataset.sweep.conservative.threshold} (Precision ${(
        dataset.sweep.conservative.precision * 100
      ).toFixed(1)}%, Recall ${(dataset.sweep.conservative.recall * 100).toFixed(1)}%)`
    );
  } else {
    console.log(
      `Suggested threshold (precision >= ${Math.round(
        precisionTarget * 100
      )}%): none found`
    );
  }

  if (dataset.sourceSummaries.length) {
    const maxSources = 6;
    console.log("Source breakdown:");
    dataset.sourceSummaries.slice(0, maxSources).forEach((item) => {
      console.log(
        `- ${item.source}: ${item.count} samples (Acc ${(item.accuracy * 100).toFixed(
          1
        )}%, Prec ${(item.precision * 100).toFixed(1)}%, Rec ${(
          item.recall * 100
        ).toFixed(1)}%, F1 ${(item.f1 * 100).toFixed(1)}%)`
      );
    });
    if (dataset.sourceSummaries.length > maxSources) {
      console.log(
        `- ${dataset.sourceSummaries.length - maxSources} more sources not shown`
      );
    }
  }
});

if (datasets.length > 1) {
  const combinedEntries = datasets.flatMap((dataset) => dataset.entries);
  const combinedAverages = getScoreAverages(combinedEntries);
  const combinedCurrent = evaluateEntries(combinedEntries, threshold, false);
  const combinedSweep = sweepThresholds(combinedEntries, precisionTarget);
  console.log("");
  console.log("Combined summary:");
  console.log(
    `Samples: ${combinedEntries.length} (AI ${combinedAverages.counts.ai}, Human ${combinedAverages.counts.human})`
  );
  console.log(`Accuracy: ${(combinedCurrent.accuracy * 100).toFixed(1)}%`);
  console.log(`Precision: ${(combinedCurrent.precision * 100).toFixed(1)}%`);
  console.log(`Recall: ${(combinedCurrent.recall * 100).toFixed(1)}%`);
  console.log(`F1: ${(combinedCurrent.f1 * 100).toFixed(1)}%`);
  console.log(`Avg AI score: ${combinedAverages.avgAi.toFixed(1)}`);
  console.log(`Avg Human score: ${combinedAverages.avgHuman.toFixed(1)}`);
  console.log(
    `Suggested threshold (max F1): ${combinedSweep.best.threshold} (Precision ${(
      combinedSweep.best.precision * 100
    ).toFixed(1)}%, Recall ${(combinedSweep.best.recall * 100).toFixed(1)}%)`
  );
}

if (writeSuggestion) {
  const suggestionPath = path.join(__dirname, "..", "heuristics-suggestion.json");
  let suggestionFile =
    suggestionFileArg ||
    (files.find((filePath) => path.resolve(filePath) === path.resolve(defaultRealPath)) ||
      files[0]);
  const suggestionDataset = datasets.find(
    (dataset) => path.resolve(dataset.filePath) === path.resolve(suggestionFile)
  );
  if (!suggestionDataset) {
    console.error(`Suggestion file not loaded: ${suggestionFile}`);
    process.exit(1);
  }
  const bestResult = evaluateEntries(
    suggestionDataset.entries,
    suggestionDataset.sweep.best.threshold,
    false
  );
  const payload = buildSuggestionPayload({
    best: suggestionDataset.sweep.best,
    bestAccuracy: bestResult.accuracy,
    conservative: suggestionDataset.sweep.conservative,
    precisionTarget,
    samples: suggestionDataset.entries.length,
    sourceFile: path.basename(suggestionDataset.filePath)
  });
  writeSuggestionFile(suggestionPath, payload);
}
