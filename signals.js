/**
 * Signal engine.
 * Produces an auditable score from independent feature groups.
 */
const Signals = {
  analyze(digits) {
    const stats = Statistics.analyze(digits);
    const patterns = Patterns.analyze(digits);

    if (digits.length < CONFIG.SIGNAL.MIN_HISTORY) {
      return this.empty(stats, patterns, "Collecting more ticks");
    }

    const candidates = ["EVEN", "ODD"].map(direction =>
      this.scoreDirection(direction, stats, patterns)
    );
    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const second = candidates[1];
    const separation = best.score - second.score;

    let level = "WAIT";
    if (best.score >= CONFIG.SIGNAL.PREPARE) level = "PREPARE";
    if (best.score >= CONFIG.SIGNAL.EARLY && separation >= 3) level = "EARLY";
    if (best.score >= CONFIG.SIGNAL.CONFIRMED && separation >= 5 &&
        best.confidence >= CONFIG.SIGNAL.MIN_EDGE + 50) level = "CONFIRMED";
    if (best.score >= CONFIG.SIGNAL.HIGH_CONFIDENCE && separation >= 8 &&
        best.confidence >= 75) level = "HIGH";

    if (best.confidence < 55 || separation < CONFIG.SIGNAL.MIN_EDGE) {
      level = "WAIT";
    }

    return {
      level,
      direction: best.direction,
      score: best.score,
      confidence: best.confidence,
      separation,
      reasons: best.reasons,
      candidates,
      stats,
      patterns
    };
  },

  scoreDirection(direction, stats, patterns) {
    let score = 50;
    const reasons = [];
    const sign = direction === "EVEN" ? 1 : -1;

    // Multi-window consensus: 50/100/250/500/1000
    const windows = [50, 100, 250, 500, 1000]
      .map(n => stats.windows[n])
      .filter(Boolean);

    let aligned = 0;
    for (const w of windows) {
      const p = direction === "EVEN" ? w.evenPct : w.oddPct;
      if (p > 50) aligned++;
      score += Math.max(-2, Math.min(2, (p - 50) / 5));
    }
    if (aligned >= 4) {
      score += 8;
      reasons.push(`${aligned}/5 windows favor ${direction}`);
    }

    const m = stats.momentum * sign;
    if (m > 10) { score += 7; reasons.push(`${direction} momentum`); }
    else if (m < -10) score -= 5;

    const imb = stats.imbalance * sign;
    if (imb > 8) { score += 6; reasons.push(`${direction} imbalance`); }

    const markov = patterns.nextByMarkov;
    if (markov.direction === direction && markov.confidence >= 55) {
      score += 7;
      reasons.push(`Markov favors ${direction} (${markov.confidence.toFixed(1)}%)`);
    }

    if (patterns.streak.type === (direction === "EVEN" ? "E" : "O")) {
      if (patterns.streak.length >= 2 && patterns.streak.length <= 5) {
        score += 3;
        reasons.push(`${direction} continuation streak`);
      }
      if (patterns.streak.length >= 6) score -= 3;
    }

    const alt = stats.switchRate;
    if (alt >= 60 && patterns.nextByMarkov.direction === direction) {
      score += 4;
      reasons.push("Alternation/transition support");
    }

    // Penalize extreme randomness rather than pretending it is predictive.
    if (stats.digitEntropy > 0.98) score -= 2;

    const confidence = this.confidenceFor(direction, stats, patterns);
    return {
      direction,
      score: Math.max(0, Math.min(100, score)),
      confidence,
      reasons
    };
  },

  confidenceFor(direction, stats, patterns) {
    const p100 = stats.windows[100] || { evenPct: 50, oddPct: 50 };
    const p250 = stats.windows[250] || { evenPct: 50, oddPct: 50 };
    const p500 = stats.windows[500] || { evenPct: 50, oddPct: 50 };
    const p = direction === "EVEN"
      ? [p100.evenPct, p250.evenPct, p500.evenPct]
      : [p100.oddPct, p250.oddPct, p500.oddPct];

    const base = p.reduce((a, b) => a + b, 0) / p.length;
    const markov = patterns.nextByMarkov.direction === direction
      ? patterns.nextByMarkov.confidence : 100 - patterns.nextByMarkov.confidence;

    return Math.max(50, Math.min(99, base * 0.65 + markov * 0.35));
  },

  empty(stats, patterns, reason) {
    return {
      level: "WAIT",
      direction: "NEUTRAL",
      score: 0,
      confidence: 50,
      separation: 0,
      reasons: [reason],
      candidates: [],
      stats,
      patterns
    };
  }
};

