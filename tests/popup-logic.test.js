const assert = require("node:assert/strict");
const { test } = require("./test-harness");
const { normalizeFilterCollapse, getThresholdHint } = require("../popup-logic");

test("normalizeFilterCollapse disables filter when collapse is enabled", () => {
  const result = normalizeFilterCollapse({
    filterEnabled: true,
    collapseEnabled: true
  });
  assert.equal(result.filterEnabled, false);
});

test("normalizeFilterCollapse keeps settings when not conflicting", () => {
  const result = normalizeFilterCollapse({
    filterEnabled: true,
    collapseEnabled: false
  });
  assert.equal(result.filterEnabled, true);
});

test("getThresholdHint uses collapse hint when collapsing", () => {
  const hint = getThresholdHint({ collapseEnabled: true }, 42);
  assert.equal(hint, "Collapsing tweets above 42% AI likelihood");
});

test("getThresholdHint uses hide hint when filtering", () => {
  const hint = getThresholdHint({ filterEnabled: true }, 75);
  assert.equal(hint, "Hiding tweets above 75% AI likelihood");
});

test("getThresholdHint uses scores-only hint when disabled", () => {
  const hint = getThresholdHint({ filterEnabled: false }, 10);
  assert.equal(hint, "Filtering disabled (scores only)");
});
