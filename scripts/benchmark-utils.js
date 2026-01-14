const fs = require("fs");
const { heuristicScore } = require("../heuristics");

function loadBenchmarkEntries(filePath) {
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`Failed to read benchmark file: ${filePath}`);
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    throw new Error("Benchmark file is empty.");
  }

  return lines.map((line, index) => {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (err) {
      throw new Error(`Invalid JSON on line ${index + 1}`);
    }

    const label = entry.label === "ai" ? "ai" : "human";
    const text = String(entry.text || "");
    const source = entry.source ? String(entry.source) : "";

    return {
      id: entry.id || `line-${index + 1}`,
      label,
      score: heuristicScore(text),
      text,
      source
    };
  });
}

function getLabelCounts(entries) {
  return entries.reduce(
    (acc, entry) => {
      if (entry.label === "ai") {
        acc.ai += 1;
      } else {
        acc.human += 1;
      }
      return acc;
    },
    { ai: 0, human: 0 }
  );
}

function getScoreAverages(entries) {
  let aiTotal = 0;
  let humanTotal = 0;
  let aiCount = 0;
  let humanCount = 0;

  entries.forEach((entry) => {
    if (entry.label === "ai") {
      aiTotal += entry.score;
      aiCount += 1;
    } else {
      humanTotal += entry.score;
      humanCount += 1;
    }
  });

  return {
    avgAi: aiCount ? aiTotal / aiCount : 0,
    avgHuman: humanCount ? humanTotal / humanCount : 0,
    counts: { ai: aiCount, human: humanCount }
  };
}

function evaluateEntries(entries, currentThreshold, collectMisclassified) {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  const misclassified = collectMisclassified ? [] : null;

  entries.forEach((entry) => {
    const predicted = entry.score >= currentThreshold ? "ai" : "human";
    if (entry.label === "ai" && predicted === "ai") {
      tp += 1;
    } else if (entry.label === "ai" && predicted === "human") {
      fn += 1;
    } else if (entry.label === "human" && predicted === "human") {
      tn += 1;
    } else {
      fp += 1;
    }

    if (collectMisclassified && entry.label !== predicted) {
      misclassified.push({
        id: entry.id,
        label: entry.label,
        predicted,
        score: entry.score,
        text: entry.text.slice(0, 120)
      });
    }
  });

  const total = tp + tn + fp + fn;
  const accuracy = total ? (tp + tn) / total : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 =
    precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    tp,
    tn,
    fp,
    fn,
    accuracy,
    precision,
    recall,
    f1,
    misclassified: misclassified || []
  };
}

function sweepThresholds(entries, precisionTarget) {
  let best = { threshold: 0, f1: -1, precision: -1, recall: -1 };
  let conservative = { threshold: 0, precision: 0, recall: 0, f1: 0 };

  for (let t = 0; t <= 100; t += 1) {
    const result = evaluateEntries(entries, t, false);
    if (
      result.f1 > best.f1 ||
      (result.f1 === best.f1 && result.precision > best.precision) ||
      (result.f1 === best.f1 &&
        result.precision === best.precision &&
        result.recall > best.recall)
    ) {
      best = {
        threshold: t,
        f1: result.f1,
        precision: result.precision,
        recall: result.recall
      };
    }

    if (result.precision >= precisionTarget) {
      if (
        result.recall > conservative.recall ||
        (result.recall === conservative.recall &&
          result.precision > conservative.precision)
      ) {
        conservative = {
          threshold: t,
          precision: result.precision,
          recall: result.recall,
          f1: result.f1
        };
      }
    }
  }

  return { best, conservative };
}

function getSourceSummaries(entries, currentThreshold) {
  const sources = new Map();
  entries.forEach((entry) => {
    if (!entry.source) {
      return;
    }
    if (!sources.has(entry.source)) {
      sources.set(entry.source, []);
    }
    sources.get(entry.source).push(entry);
  });

  if (!sources.size) {
    return [];
  }

  const summaries = [];
  sources.forEach((list, source) => {
    const counts = getLabelCounts(list);
    const result = evaluateEntries(list, currentThreshold, false);
    summaries.push({
      source,
      count: list.length,
      ai: counts.ai,
      human: counts.human,
      accuracy: result.accuracy,
      precision: result.precision,
      recall: result.recall,
      f1: result.f1
    });
  });

  summaries.sort((a, b) => b.count - a.count);
  return summaries;
}

function buildSuggestionPayload(options) {
  const precisionTarget = Math.max(0, Math.min(1, options.precisionTarget));
  const bestAccuracy = Number.isFinite(options.bestAccuracy) ? options.bestAccuracy : 0;
  return {
    threshold: options.best.threshold,
    accuracy: Number((bestAccuracy * 100).toFixed(1)),
    precision: Number((options.best.precision * 100).toFixed(1)),
    recall: Number((options.best.recall * 100).toFixed(1)),
    conservativeThreshold: options.conservative.threshold,
    conservativePrecision: Number((options.conservative.precision * 100).toFixed(1)),
    conservativeRecall: Number((options.conservative.recall * 100).toFixed(1)),
    precisionTarget: Number((precisionTarget * 100).toFixed(1)),
    samples: options.samples,
    sourceFile: options.sourceFile,
    note: "Suggested from benchmark sweep (max F1).",
    updatedAt: new Date().toISOString().slice(0, 10)
  };
}

function writeSuggestionFile(suggestionPath, payload) {
  fs.writeFileSync(suggestionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

module.exports = {
  loadBenchmarkEntries,
  getLabelCounts,
  getScoreAverages,
  evaluateEntries,
  sweepThresholds,
  getSourceSummaries,
  buildSuggestionPayload,
  writeSuggestionFile
};
