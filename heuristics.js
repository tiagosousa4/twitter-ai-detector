(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.aiDetectorHeuristics = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const HEURISTIC_SCORE_POWER = 1.5;

  function normalizeScore(score) {
    if (!Number.isFinite(score)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function applyHeuristicCurve(score) {
    const normalized = normalizeScore(score);
    const adjusted = Math.round(
      Math.pow(normalized / 100, HEURISTIC_SCORE_POWER) * 100
    );
    return normalizeScore(adjusted);
  }

  function heuristicScore(text) {
    const safeText = String(text || "");
    const patterns = [
      /delve into/gi,
      /it\'s important to note/gi,
      /in conclusion/gi,
      /as an ai/gi,
      /overall/gi,
      /furthermore/gi,
      /moreover/gi,
      /this highlights/gi
    ];

    const formalMarkers = [/therefore/gi, /consequently/gi, /in summary/gi];

    const listPattern = /\b\d+\.[\s\S]+\b\d+\./g;
    let score = 10;
    let matches = 0;

    patterns.forEach((pattern) => {
      const found = safeText.match(pattern);
      if (found) {
        matches += found.length;
      }
    });

    formalMarkers.forEach((pattern) => {
      const found = safeText.match(pattern);
      if (found) {
        matches += found.length;
      }
    });

    if (!/[\!\?\,]/.test(safeText)) {
      score += 10;
    }

    if (!/[\'\"\-]/.test(safeText)) {
      score += 5;
    }

    if (listPattern.test(safeText)) {
      score += 15;
    }

    score += Math.min(matches * 8, 60);

    if (!/[a-zA-Z]/.test(safeText)) {
      score = 0;
    }

    return applyHeuristicCurve(score);
  }

  return {
    HEURISTIC_SCORE_POWER,
    normalizeScore,
    applyHeuristicCurve,
    heuristicScore
  };
});
