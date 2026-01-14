(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.aiDetectorFiltering = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function getFilterAction(settings, score) {
    if (!settings || !settings.enabled) {
      return "none";
    }

    const threshold = Number(settings.threshold);
    const limit = Number.isFinite(threshold) ? threshold : 0;
    const collapseEnabled = !!settings.collapseEnabled;
    const filterEnabled = settings.filterEnabled !== false;

    if (collapseEnabled && score >= limit) {
      return "collapse";
    }

    if (!collapseEnabled && filterEnabled && score >= limit) {
      return "hide";
    }

    return "none";
  }

  return {
    getFilterAction
  };
});
