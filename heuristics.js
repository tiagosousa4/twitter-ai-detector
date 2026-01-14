(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.aiDetectorHeuristics = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const HEURISTIC_SCORE_POWER = 1.2;
  // Remap heuristic scores so the best raw threshold (19) displays as 75.
  const CALIBRATION_ANCHOR_RAW = 19;
  const CALIBRATION_ANCHOR_MAPPED = 75;
  const STRONG_PATTERNS = [
    /as an ai language model/gi,
    /as a language model/gi,
    /i(?:'m| am) unable to/gi,
    /i cannot assist/gi,
    /i (?:cannot|can't|do not|don't) (?:access|provide|help)/gi,
    /i don't have (?:access|browsing)/gi
  ];
  const WEAK_PATTERNS = [
    /as an ai\b/gi,
    /delve into/gi,
    /it is important to note/gi,
    /it(?:'s| is) worth noting/gi,
    /in conclusion/gi,
    /in today's world/gi,
    /overall/gi,
    /furthermore/gi,
    /moreover/gi,
    /this highlights/gi,
    /this (?:suggests|indicates) that/gi,
    /let's (?:explore|break down|take a look)/gi,
    /there are (?:several|multiple) (?:ways|factors)/gi,
    /additionally/gi,
    /as such/gi,
    /in summary/gi
  ];
  const FORMAL_MARKERS = [/therefore/gi, /consequently/gi, /nevertheless/gi];
  const STRUCTURE_MARKERS = [
    /\bfirst(?:ly)?\b/gi,
    /\bsecond(?:ly)?\b/gi,
    /\bthird(?:ly)?\b/gi,
    /\bon the (?:one|other) hand\b/gi
  ];
  const TOPIC_PATTERNS = [
    /\bartificial intelligence\b/gi,
    /\bai\b/gi,
    /\bmachine learning\b/gi,
    /\bdeep learning\b/gi,
    /\bneural network(?:s)?\b/gi,
    /\brobot(?:s|ics)?\b/gi,
    /\bchatbot(?:s)?\b/gi,
    /\bautonomous\b/gi,
    /\bnlp\b/gi,
    /\bdata\b/gi,
    /\bautomation\b/gi,
    /\balgorithm(?:s)?\b/gi,
    /\btransform(?:ing|s|ed)?\b/gi,
    /\brevolutioniz(?:ing|es|ed)?\b/gi,
    /\bcybersecurity\b/gi,
    /\bquantum\b/gi,
    /\bethical\b/gi,
    /\bethics\b/gi,
    /\bresponsible\b/gi,
    /\bmodel(?:s)?\b/gi,
    /\bmarket(?:s)?\b/gi,
    /\bfinancial\b/gi,
    /\bfinance\b/gi,
    /\beconom(?:y|ic)\b/gi,
    /\binvest(?:ment|ing|or)s?\b/gi,
    /\bportfolio(?:s)?\b/gi,
    /\bstock(?:s)?\b/gi,
    /\bstock market\b/gi,
    /\bearnings\b/gi,
    /\btrading\b/gi,
    /\btrader(?:s)?\b/gi,
    /\bcrypto(?:currency|currencies)?\b/gi,
    /\bbitcoin\b/gi,
    /\bblockchain\b/gi,
    /\bdiversif(?:y|ying|ication)\b/gi,
    /\bhedge\b/gi,
    /\bfund(?:s)?\b/gi,
    /\bbullish\b/gi,
    /\bbearish\b/gi,
    /\banalyst(?:s)?\b/gi,
    /\banalysis\b/gi,
    /\bsector\b/gi,
    /\boil\b/gi,
    /\bprice(?:s)?\b/gi,
    /\bgrowth\b/gi,
    /\bglobal\b/gi,
    /\bindustr(?:y|ies)\b/gi,
    /\bquarter\b/gi,
    /\boutlook\b/gi,
    /\bcurrenc(?:y|ies)\b/gi,
    /\bfiscal\b/gi,
    /\bpolicy\b/gi,
    /\bpolicies\b/gi,
    /\bfed\b/gi,
    /\btrade\b/gi
  ];
  const SOFT_TOPIC_PATTERNS = [
    /\bcomputer science\b/gi,
    /\bcoding\b/gi,
    /\bprogramming\b/gi,
    /\bsoftware\b/gi,
    /\bdeveloper(?:s)?\b/gi,
    /\bengineer(?:s)?\b/gi,
    /\binnovat(?:ion|ive|e|es|ed|ing)?\b/gi,
    /\btechnology\b/gi,
    /\bdigital\b/gi
  ];
  const CORE_TOPIC_PATTERNS = [
    /\bartificial intelligence\b/gi,
    /\bai\b/gi,
    /\bmachine learning\b/gi,
    /\bdeep learning\b/gi,
    /\bneural network(?:s)?\b/gi,
    /\bchatbot(?:s)?\b/gi,
    /\bnlp\b/gi,
    /\bdata\b/gi,
    /\balgorithm(?:s)?\b/gi,
    /\bautomation\b/gi,
    /\bcybersecurity\b/gi,
    /\bquantum\b/gi,
    /\bcrypto(?:currency|currencies)?\b/gi,
    /\bbitcoin\b/gi,
    /\bblockchain\b/gi,
    /\bstock(?:s)?\b/gi,
    /\bstock market\b/gi,
    /\bearnings\b/gi,
    /\binvest(?:ment|ing|or)s?\b/gi,
    /\bportfolio(?:s)?\b/gi,
    /\bfinancial\b/gi,
    /\bfinance\b/gi,
    /\bmarket(?:s)?\b/gi,
    /\btrading\b/gi,
    /\btrader(?:s)?\b/gi,
    /\bhedge\b/gi,
    /\bfund(?:s)?\b/gi,
    /\bbullish\b/gi,
    /\bbearish\b/gi
  ];
  const TICKER_PATTERN = /\$[A-Z]{2,5}\b/g;
  const CASUAL_PATTERNS = [
    /\b(lol|lmao|rofl|omg|idk|imo|imho|btw|tbh)\b/gi,
    /\b(haha|hehe)\b/gi
  ];
  const URL_PATTERN = /https?:\/\/\S+/gi;
  const WWW_PATTERN = /\bwww\.\S+/gi;
  const BARE_URL_PATTERN = /\b[a-z0-9.-]+\.[a-z]{2,6}(?:\/\S*)?/gi;
  const MENTION_PATTERN = /(^|[^A-Za-z0-9_.])@([A-Za-z0-9_]{1,15})/g;
  const HASHTAG_PATTERN = /(^|[^A-Za-z0-9_])#([A-Za-z0-9_]{1,50})/g;
  const CONTRACTION_PATTERN = /\b\w+'(?:t|s|re|ve|d|ll)\b/i;
  const EMOJI_PATTERN = /[\u{1F1E6}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  const LIST_ITEM_PATTERN = /(?:^|[\n\r]|\s)(\d+)\.\s+\S+/g;
  const LETTER_PATTERN = /\p{L}/u;
  const WORD_PATTERN = /\p{L}[\p{L}'-]*/gu;

  function normalizeScore(score) {
    if (!Number.isFinite(score)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function applyHeuristicCurve(score, powerOverride) {
    const normalized = normalizeScore(score);
    const power =
      Number.isFinite(powerOverride) && powerOverride > 0
        ? powerOverride
        : HEURISTIC_SCORE_POWER;
    const adjusted = Math.round(
      Math.pow(normalized / 100, power) * 100
    );
    return normalizeScore(adjusted);
  }

  function applyHeuristicCalibration(score) {
    const normalized = normalizeScore(score);
    if (normalized <= CALIBRATION_ANCHOR_RAW) {
      const scaled =
        (normalized / CALIBRATION_ANCHOR_RAW) * CALIBRATION_ANCHOR_MAPPED;
      return normalizeScore(scaled);
    }
    const remainingRaw = 100 - CALIBRATION_ANCHOR_RAW;
    const remainingMapped = 100 - CALIBRATION_ANCHOR_MAPPED;
    const scaled =
      CALIBRATION_ANCHOR_MAPPED +
      ((normalized - CALIBRATION_ANCHOR_RAW) / remainingRaw) * remainingMapped;
    return normalizeScore(scaled);
  }

  function countMatches(patterns, text) {
    return patterns.reduce((total, pattern) => {
      const matches = text.match(pattern);
      return total + (matches ? matches.length : 0);
    }, 0);
  }

  function countMatchAll(pattern, text) {
    let count = 0;
    for (const _ of text.matchAll(pattern)) {
      count += 1;
    }
    return count;
  }

  function countSocialSignals(text) {
    const urlMatches = text.match(URL_PATTERN) || [];
    const wwwMatches = text.match(WWW_PATTERN) || [];
    const withoutHttp = text.replace(URL_PATTERN, " ").replace(WWW_PATTERN, " ");
    const bareMatches = withoutHttp.match(BARE_URL_PATTERN) || [];
    const withoutUrls = withoutHttp.replace(BARE_URL_PATTERN, " ");
    const mentionCount = countMatchAll(MENTION_PATTERN, withoutUrls);
    const hashtagCount = countMatchAll(HASHTAG_PATTERN, withoutUrls);

    return {
      urlCount: urlMatches.length + wwwMatches.length + bareMatches.length,
      mentionCount,
      hashtagCount
    };
  }

  function analyzeListItems(text) {
    const matches = Array.from(text.matchAll(LIST_ITEM_PATTERN));
    const numbers = matches.map((match) => Number(match[1]));
    return {
      count: numbers.length,
      hasSmallIndex: numbers.some((num) => Number.isFinite(num) && num <= 5)
    };
  }

  function heuristicScore(text) {
    const safeText = String(text || "").trim();
    if (!LETTER_PATTERN.test(safeText)) {
      return 0;
    }

    const words = safeText.match(WORD_PATTERN) || [];
    const wordCount = words.length;
    const uniqueWords = new Set(words.map((word) => word.toLowerCase())).size;
    const uniqueRatio = wordCount ? uniqueWords / wordCount : 0;

    const sentenceMatches = safeText.match(/[.!?]+/g) || [];
    const sentenceCount = Math.max(1, sentenceMatches.length);
    const avgWordsPerSentence = wordCount / sentenceCount;

    const punctuationMatches = safeText.match(/[.,!?;:]/g) || [];
    const nonSpaceLength = Math.max(1, safeText.replace(/\s+/g, "").length);
    const punctuationRatio = punctuationMatches.length / nonSpaceLength;

    const lengthFactor =
      wordCount < 8 ? 0.5 : wordCount < 12 ? 0.75 : wordCount < 16 ? 0.9 : 1;

    let positiveScore = 0;
    let negativeScore = 0;

    const strongMatches = countMatches(STRONG_PATTERNS, safeText);
    positiveScore += Math.min(strongMatches * 18, 60);

    const weakMatches = countMatches(WEAK_PATTERNS, safeText);
    positiveScore += Math.min(weakMatches * 12, 60) * lengthFactor;

    const formalMatches = countMatches(FORMAL_MARKERS, safeText);
    positiveScore += Math.min(formalMatches * 6, 24) * lengthFactor;
    if (formalMatches > 0 && weakMatches > 0) {
      positiveScore += 10 * lengthFactor;
    }

    const structureMatches = countMatches(STRUCTURE_MARKERS, safeText);
    positiveScore += Math.min(structureMatches * 6, 18) * lengthFactor;
    if (structureMatches >= 2 && wordCount >= 12) {
      positiveScore += 12 * lengthFactor;
    }

    const topicMatches = countMatches(TOPIC_PATTERNS, safeText);
    const softTopicMatches = countMatches(SOFT_TOPIC_PATTERNS, safeText);
    const coreTopicMatches = countMatches(CORE_TOPIC_PATTERNS, safeText);
    if (topicMatches > 0) {
      positiveScore += Math.min(topicMatches * 6, 36) * lengthFactor;
    }
    if (softTopicMatches > 0) {
      positiveScore += Math.min(softTopicMatches * 2, 8) * lengthFactor;
    }
    if (topicMatches >= 2 && wordCount >= 8) {
      positiveScore = Math.max(positiveScore, 75);
    }
    if (topicMatches >= 3 && wordCount >= 10) {
      positiveScore = Math.max(positiveScore, 85);
    }
    if (topicMatches >= 4) {
      positiveScore = Math.max(positiveScore, 90);
    }

    const listInfo = analyzeListItems(safeText);
    if (listInfo.count >= 2 && listInfo.hasSmallIndex) {
      positiveScore += 12 * lengthFactor;
    }

    if (wordCount >= 12 && (weakMatches >= 2 || (weakMatches >= 1 && formalMatches >= 1))) {
      positiveScore = Math.max(positiveScore, 70);
    }

    if (wordCount >= 12 && structureMatches >= 2 && listInfo.count >= 2) {
      positiveScore = Math.max(positiveScore, 65);
    }

    if (wordCount >= 12) {
      if (uniqueRatio < 0.55) {
        positiveScore += 12 * lengthFactor;
      }
      if (uniqueRatio < 0.45) {
        positiveScore += 8 * lengthFactor;
      }
    }

    if (sentenceCount >= 2) {
      if (avgWordsPerSentence >= 18) {
        positiveScore += 8 * lengthFactor;
      }
      if (avgWordsPerSentence >= 26) {
        positiveScore += 8 * lengthFactor;
      }
    }

    if (wordCount >= 12) {
      if (punctuationRatio < 0.01) {
        positiveScore += 6 * lengthFactor;
      }
      if (punctuationRatio < 0.005) {
        positiveScore += 8 * lengthFactor;
      }
    }

    if (wordCount >= 35) {
      positiveScore += 6 * lengthFactor;
    }
    if (wordCount >= 50) {
      positiveScore += 8 * lengthFactor;
    }

    const hasContraction = CONTRACTION_PATTERN.test(safeText);
    if (wordCount >= 12 && !hasContraction) {
      positiveScore += 4 * lengthFactor;
    }
    if (wordCount >= 20 && !hasContraction && formalMatches > 0) {
      positiveScore += 6 * lengthFactor;
    }

    if (hasContraction) {
      negativeScore += 4;
    }
    if (wordCount <= 6) {
      negativeScore += 12;
    }
    if (wordCount <= 3) {
      negativeScore += 8;
    }

    if (countMatches(CASUAL_PATTERNS, safeText) > 0) {
      negativeScore += 6;
    }

    const socialCounts = countSocialSignals(safeText);
    const urlPenalty = Math.min(socialCounts.urlCount * 1.5, 4);
    let mentionPenalty = Math.min(socialCounts.mentionCount * 4, 12);
    const hashtagPenalty = Math.min(socialCounts.hashtagCount * 0.5, 3);
    const tickerMatches = safeText.match(TICKER_PATTERN) || [];
    if (coreTopicMatches >= 1 || tickerMatches.length > 0) {
      mentionPenalty *= 0.6;
    }
    negativeScore += urlPenalty + mentionPenalty + hashtagPenalty;
    if (socialCounts.hashtagCount >= 2 && socialCounts.mentionCount === 0) {
      positiveScore += 6 * lengthFactor;
    }
    if (socialCounts.hashtagCount >= 3) {
      positiveScore += 6 * lengthFactor;
    }
    if (
      coreTopicMatches === 1 &&
      wordCount >= 10 &&
      (socialCounts.hashtagCount >= 1 || EMOJI_PATTERN.test(safeText))
    ) {
      positiveScore = Math.max(positiveScore, 55);
    }

    if (tickerMatches.length > 0) {
      positiveScore += Math.min(tickerMatches.length * 10, 24) * lengthFactor;
      if (wordCount >= 4) {
        positiveScore = Math.max(positiveScore, 45);
      }
    }

    if (safeText.endsWith("?")) {
      negativeScore += 3;
    }

    if (/[!?]{2,}/.test(safeText)) {
      negativeScore += 4;
    }

    if (EMOJI_PATTERN.test(safeText)) {
      negativeScore += 1;
    }

    if (strongMatches > 0) {
      negativeScore *= 0.7;
    } else if (weakMatches > 2 && formalMatches > 0) {
      negativeScore *= 0.85;
    } else if (topicMatches >= 2) {
      negativeScore *= 0.9;
    }

    if (strongMatches > 0 && positiveScore < 90) {
      positiveScore = 90;
    }

    let score = positiveScore - Math.max(0, negativeScore);

    if (wordCount >= 12 && (weakMatches > 0 || formalMatches > 0) && score > 35) {
      score = Math.min(score * 1.5, 100);
    }

    if (wordCount >= 12 && structureMatches >= 2 && score > 30) {
      score = Math.min(score * 1.25, 100);
    }

    if (topicMatches >= 2 && score > 30) {
      score = Math.min(score * 1.25, 100);
    }

    const structureBoosted =
      wordCount >= 12 && structureMatches >= 2 && weakMatches > 0;
    if (structureBoosted && score < 90) {
      score = 90;
    }
    let curvePower = HEURISTIC_SCORE_POWER;
    if (strongMatches > 0) {
      curvePower = 1.2;
    } else if (structureBoosted) {
      curvePower = 1.1;
    } else if (positiveScore >= 55) {
      curvePower = 1.3;
    }
    const curved = applyHeuristicCurve(score, curvePower);
    return applyHeuristicCalibration(curved);
  }

  return {
    HEURISTIC_SCORE_POWER,
    normalizeScore,
    applyHeuristicCurve,
    applyHeuristicCalibration,
    heuristicScore
  };
});
