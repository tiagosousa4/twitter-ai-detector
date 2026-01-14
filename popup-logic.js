(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.aiDetectorPopupLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function normalizeFilterCollapse(settings) {
    if (settings && settings.collapseEnabled && settings.filterEnabled) {
      return { ...settings, filterEnabled: false };
    }
    return settings;
  }

  function getThresholdHint(settings, value) {
    const displayValue = Number.isFinite(Number(value)) ? value : "";
    const collapsing = !!(settings && settings.collapseEnabled);
    const filtering = settings && settings.filterEnabled !== false;

    if (collapsing) {
      return `Collapsing tweets above ${displayValue}% AI likelihood`;
    }

    if (filtering) {
      return `Hiding tweets above ${displayValue}% AI likelihood`;
    }

    return "Filtering disabled (scores only)";
  }

  return {
    normalizeFilterCollapse,
    getThresholdHint
  };
});
