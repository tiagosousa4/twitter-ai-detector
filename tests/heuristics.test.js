const assert = require("node:assert/strict");

const {
  HEURISTIC_SCORE_POWER,
  normalizeScore,
  applyHeuristicCurve,
  heuristicScore
} = require("../heuristics");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function run() {
  let failed = 0;

  tests.forEach(({ name, fn }) => {
    try {
      fn();
      console.log(`ok - ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`not ok - ${name}`);
      console.error(err);
    }
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

test("normalizeScore clamps and rounds scores", () => {
  assert.equal(normalizeScore(-5), 0);
  assert.equal(normalizeScore(0), 0);
  assert.equal(normalizeScore(33.4), 33);
  assert.equal(normalizeScore(33.5), 34);
  assert.equal(normalizeScore(150), 100);
});

test("applyHeuristicCurve compresses low scores", () => {
  assert.equal(HEURISTIC_SCORE_POWER, 1.5);
  assert.equal(applyHeuristicCurve(25), 13);
  assert.ok(applyHeuristicCurve(25) < 25);
});

test("applyHeuristicCurve keeps bounds intact", () => {
  assert.equal(applyHeuristicCurve(0), 0);
  assert.equal(applyHeuristicCurve(100), 100);
});

test("heuristicScore returns 0 for non-letter text", () => {
  assert.equal(heuristicScore("1234 !!! ---"), 0);
});

test("heuristicScore increases with AI-like markers", () => {
  const base = heuristicScore("Hello world.");
  const boosted = heuristicScore(
    "In conclusion, delve into this. Furthermore, it's important to note."
  );
  assert.ok(boosted > base);
});

run();
