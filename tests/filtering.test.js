const assert = require("node:assert/strict");
const { test } = require("./test-harness");
const { getFilterAction } = require("../filtering");

test("getFilterAction returns none when disabled", () => {
  const action = getFilterAction({ enabled: false, threshold: 10 }, 50);
  assert.equal(action, "none");
});

test("getFilterAction collapses when collapse enabled", () => {
  const action = getFilterAction(
    { enabled: true, collapseEnabled: true, threshold: 20 },
    25
  );
  assert.equal(action, "collapse");
});

test("getFilterAction hides when filtering enabled", () => {
  const action = getFilterAction(
    { enabled: true, collapseEnabled: false, filterEnabled: true, threshold: 20 },
    25
  );
  assert.equal(action, "hide");
});

test("getFilterAction ignores filter when disabled", () => {
  const action = getFilterAction(
    { enabled: true, collapseEnabled: false, filterEnabled: false, threshold: 20 },
    25
  );
  assert.equal(action, "none");
});
