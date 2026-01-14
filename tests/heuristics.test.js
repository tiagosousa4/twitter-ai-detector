const assert = require("node:assert/strict");
const { test } = require("./test-harness");

const {
  HEURISTIC_SCORE_POWER,
  normalizeScore,
  applyHeuristicCurve,
  applyHeuristicCalibration,
  heuristicScore
} = require("../heuristics");

test("normalizeScore clamps and rounds scores", () => {
  assert.equal(normalizeScore(-5), 0);
  assert.equal(normalizeScore(0), 0);
  assert.equal(normalizeScore(33.4), 33);
  assert.equal(normalizeScore(33.5), 34);
  assert.equal(normalizeScore(150), 100);
});

test("applyHeuristicCurve compresses low scores", () => {
  assert.equal(HEURISTIC_SCORE_POWER, 1.2);
  assert.equal(applyHeuristicCurve(25), 19);
  assert.ok(applyHeuristicCurve(25) < 25);
});

test("applyHeuristicCurve keeps bounds intact", () => {
  assert.equal(applyHeuristicCurve(0), 0);
  assert.equal(applyHeuristicCurve(100), 100);
});

test("applyHeuristicCalibration remaps anchor points", () => {
  assert.equal(applyHeuristicCalibration(0), 0);
  assert.equal(applyHeuristicCalibration(19), 75);
  assert.equal(applyHeuristicCalibration(100), 100);
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

test("heuristicScore reacts strongly to AI disclaimers", () => {
  const casual = heuristicScore("Just sharing a quick update.");
  const disclaimer = heuristicScore(
    "As an AI language model, I cannot assist with that request."
  );
  assert.ok(disclaimer > casual);
});

test("heuristicScore discounts casual language and repetition", () => {
  const repeated =
    "note note note note note note note note note note note note";
  const varied =
    "note one two three four five six seven eight nine ten eleven twelve";
  const casual = "lol!!! this is wild haha";
  assert.ok(heuristicScore(repeated) > heuristicScore(varied));
  assert.ok(heuristicScore(varied) > heuristicScore(casual));
});

test("heuristicScore reduces score for social signals", () => {
  const formal = "In conclusion, it is important to note this.";
  const social = "In conclusion, it is important to note this. #news @handle";
  assert.ok(heuristicScore(social) < heuristicScore(formal));
});

test("heuristicScore penalizes mentions more than emails", () => {
  const email = "In conclusion, contact me at test@example.com.";
  const mention = "In conclusion, contact me @example.";
  assert.ok(heuristicScore(mention) < heuristicScore(email));
});

test("heuristicScore recognizes numbered lists", () => {
  const listText = "1. first item\n2. second item\n3. third item";
  const notList = "Version 1.2.3 is out now.";
  assert.ok(heuristicScore(listText) > heuristicScore(notList));
});

test("heuristicScore reduces score when emojis appear", () => {
  const base = "In conclusion, this highlights our findings today.";
  const withEmoji = "In conclusion, this highlights our findings today \u{1F600}";
  assert.ok(heuristicScore(withEmoji) < heuristicScore(base));
});

test("heuristicScore avoids year-like lists", () => {
  const yearList = "2024. update details follow 2025. update details continue";
  const listText = "1. first item is detailed\n2. second item is explained";
  assert.ok(heuristicScore(yearList) < heuristicScore(listText));
});

test("heuristicScore does not double-count hashtags inside URLs", () => {
  const base = "In conclusion, see example.com/updates for context.";
  const withHash = "In conclusion, see example.com/#updates for context.";
  assert.ok(heuristicScore(withHash) <= heuristicScore(base));
});
