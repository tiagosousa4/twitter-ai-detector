const fs = require("fs");
const path = require("path");
const https = require("https");

const OUTPUT_PATH =
  process.argv[2] ||
  path.join(__dirname, "..", "benchmarks", "heuristics-benchmark-real.jsonl");
const TOTAL_PER_CLASS = Number(process.env.SAMPLES || "250");
const MIN_LEN = Number(process.env.MIN_LEN || "20");
const MAX_LEN = Number(process.env.MAX_LEN || "280");
const SEED = process.env.SEED || "";
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || "200");
const MAX_RETRIES = Number(process.env.MAX_RETRIES || "6");

function createRng(seed) {
  let value = seed >>> 0;
  return function rng() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = SEED ? createRng(Number(SEED) || 1) : Math.random;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "ai-tweet-detector-benchmark",
            Accept: "application/json"
          }
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            resolve({ statusCode: res.statusCode || 0, headers: res.headers, body });
          });
        }
      )
      .on("error", reject);
  });
}

async function fetchJson(url) {
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const { statusCode, headers, body } = await fetchRaw(url);
    if (statusCode === 429 || statusCode >= 500) {
      const retryAfter = Number(headers["retry-after"]);
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 500 * (attempt + 1);
      await sleep(delay);
      attempt += 1;
      continue;
    }
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`Request failed (${statusCode}) for ${url}`);
    }
    try {
      return JSON.parse(body);
    } catch (err) {
      throw new Error(`Invalid JSON response for ${url}`);
    }
  }
  throw new Error(`Exceeded retries for ${url}`);
}

function buildRowsUrl(dataset, config, split, offset, length) {
  const params = [
    `dataset=${encodeURIComponent(dataset)}`,
    `config=${encodeURIComponent(config)}`,
    `split=${encodeURIComponent(split)}`,
    `offset=${offset}`,
    `length=${length}`
  ];
  return `https://datasets-server.huggingface.co/rows?${params.join("&")}`;
}

async function getTotalRows(dataset, config, split) {
  const url = buildRowsUrl(dataset, config, split, 0, 1);
  const data = await fetchJson(url);
  return data.num_rows_total || 0;
}

function normalizeText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\s+/g, " ").trim();
}

async function collectSamples(config, seen) {
  const pageSize = 100;
  const total = await getTotalRows(config.dataset, config.config, config.split);
  if (!total) {
    throw new Error(`No rows found for ${config.dataset}`);
  }

  const maxOffset = Math.max(0, total - pageSize);
  const samples = [];
  let attempts = 0;
  const fillRate = 0.6;
  const targetPages = Math.max(4, Math.ceil(config.count / (pageSize * fillRate)));
  const maxPages = Math.max(targetPages, 8);
  const usedOffsets = new Set();

  while (samples.length < config.count && attempts < maxPages) {
    let offset = Math.floor(rng() * (maxOffset + 1));
    while (usedOffsets.has(offset) && usedOffsets.size < maxPages) {
      offset = Math.floor(rng() * (maxOffset + 1));
    }
    usedOffsets.add(offset);
    const url = buildRowsUrl(
      config.dataset,
      config.config,
      config.split,
      offset,
      pageSize
    );
    const data = await fetchJson(url);
    const rows = Array.isArray(data.rows) ? data.rows : [];

    rows.forEach((row) => {
      if (samples.length >= config.count) {
        return;
      }
      const text = normalizeText(row.row && row.row[config.field]);
      if (!text) {
        return;
      }
      if (text.length < MIN_LEN || text.length > MAX_LEN) {
        return;
      }
      if (text.includes("\uFFFD")) {
        return;
      }
      if (seen.has(text)) {
        return;
      }
      seen.add(text);
      samples.push({
        label: config.label,
        text,
        source: config.source
      });
    });

    attempts += 1;
    if (REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  if (samples.length < config.count) {
    throw new Error(
      `Collected ${samples.length} of ${config.count} for ${config.dataset}`
    );
  }

  return samples;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

async function main() {
  const humanConfig = {
    label: "human",
    dataset: "cardiffnlp/tweet_eval",
    config: "sentiment",
    split: "train",
    field: "text",
    count: TOTAL_PER_CLASS,
    source: "cardiffnlp/tweet_eval:sentiment:train"
  };
  const aiPrimaryCount = Math.round(TOTAL_PER_CLASS * 0.6);
  const aiSecondaryCount = TOTAL_PER_CLASS - aiPrimaryCount;
  const aiConfigs = [
    {
      label: "ai",
      dataset: "rescrv/ai-tweets",
      config: "default",
      split: "train",
      field: "text",
      count: aiPrimaryCount,
      source: "rescrv/ai-tweets:train"
    },
    {
      label: "ai",
      dataset: "TimKoornstra/synthetic-financial-tweets-sentiment",
      config: "default",
      split: "train",
      field: "tweet",
      count: aiSecondaryCount,
      source: "TimKoornstra/synthetic-financial-tweets-sentiment:train"
    }
  ];

  const seen = new Set();
  const entries = [];

  console.log("Collecting human tweets...");
  entries.push(...(await collectSamples(humanConfig, seen)));

  for (const config of aiConfigs) {
    console.log(`Collecting AI tweets from ${config.dataset}...`);
    entries.push(...(await collectSamples(config, seen)));
  }

  const humanEntries = entries.filter((entry) => entry.label === "human");
  const aiEntries = entries.filter((entry) => entry.label === "ai");

  if (humanEntries.length !== TOTAL_PER_CLASS || aiEntries.length !== TOTAL_PER_CLASS) {
    throw new Error(
      `Counts mismatch. Human ${humanEntries.length}, AI ${aiEntries.length}`
    );
  }

  const idWidth = String(TOTAL_PER_CLASS).length;
  humanEntries.forEach((entry, index) => {
    entry.id = `human-${String(index + 1).padStart(idWidth, "0")}`;
  });
  aiEntries.forEach((entry, index) => {
    entry.id = `ai-${String(index + 1).padStart(idWidth, "0")}`;
  });

  const shuffled = shuffle([...humanEntries, ...aiEntries]);
  const lines = shuffled.map((entry) => JSON.stringify(entry));
  fs.writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${TOTAL_PER_CLASS * 2} samples to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
