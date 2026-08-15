const Signals = (() => {
  function build() {
    const evenOdd = EvenOdd.getSnapshot();
    const stats = Statistics.getSnapshot();
    const patterns = Patterns.getSnapshot();
    const historySize = evenOdd.totalTicks;

    if (historySize < 50) {
      return {
        level: "WAIT",
        direction: "NEUTRAL",
        score: 0,
        confidence: 0,
        historySize,
        separation: 0,
        evenScore: 0,
        oddScore: 0,
        reasons: ["Collecting tick history."],
        warnings: []
      };
    }

    const score = { EVEN: 0, ODD: 0 };
    const reasons = [];
    const warnings = [];

    const alignment = stats.alignment;

    if (alignment.direction !== "NEUTRAL") {
      score[alignment.direction] += alignment.alignment * 0.25;
      reasons.push(`${alignment.direction} alignment ${alignment.alignment.toFixed(0)}%`);
    } else {
      warnings.push("Multi-window direction is mixed.");
    }

    const windows = Object.values(stats.windows);
    const evenProbability = windows.reduce((sum, w) => sum + w.evenProbability, 0) / windows.length;
    const oddProbability = windows.reduce((sum, w) => sum + w.oddProbability, 0) / windows.length;
    const probabilityDirection = evenProbability > oddProbability ? "EVEN" :
      oddProbability > evenProbability ? "ODD" : "NEUTRAL";
    const probabilityEdge = Math.abs(evenProbability - oddProbability);

    if (probabilityDirection !== "NEUTRAL") {
      score[probabilityDirection] += Math.min(25, probabilityEdge * 1.25);
      if (probabilityEdge >= 5) {
        reasons.push(`${probabilityDirection} average edge ${probabilityEdge.toFixed(1)}%`);
      }
    }

    if (stats.imbalance.direction !== "NEUTRAL") {
      score[stats.imbalance.direction] += Math.min(15, Math.abs(stats.imbalance.percentage) * 0.75);
    }

    if (patterns.markov.direction !== "NEUTRAL") {
      score[patterns.markov.direction] += Math.min(15, patterns.markov.edge * 0.6);
    }

    if (patterns.bias.direction !== "NEUTRAL") {
      const shift = patterns.bias.direction === "EVEN"
        ? Math.abs(patterns.bias.evenShift)
        : Math.abs(patterns.bias.oddShift);
      score[patterns.bias.direction] += Math.min(10, shift * 0.5);
    }

    if (stats.entropy > 0.985) {
      warnings.push("Distribution is near balanced.");
    }

    const winner = score.EVEN > score.ODD ? "EVEN" :
      score.ODD > score.EVEN ? "ODD" : "NEUTRAL";

    const winningScore = winner === "EVEN" ? score.EVEN : winner === "ODD" ? score.ODD : 0;
    const losingScore = winner === "EVEN" ? score.ODD : winner === "ODD" ? score.EVEN : 0;
    const separation = Math.max(0, winningScore - losingScore);

    let confidence = winningScore +
      Math.min(10, alignment.alignment * 0.1) +
      Math.min(5, separation * 0.1);

    if (stats.entropy > 0.985) confidence -= 12;
    confidence = Math.max(0, Math.min(100, confidence));

    let level = "WAIT";

    if (historySize >= 50 && confidence >= CONFIG.LEVELS.PREPARE) level = "PREPARE";
    if (historySize >= 100 && confidence >= CONFIG.LEVELS.EARLY && separation >= 8) level = "EARLY";
    if (historySize >= 250 && confidence >= CONFIG.LEVELS.CONFIRMED &&
        alignment.alignment >= 60 && separation >= 12) level = "CONFIRMED";
    if (historySize >= 500 && confidence >= CONFIG.LEVELS.HIGH &&
        alignment.alignment >= 80 && separation >= 18 && stats.entropy < 0.985) level = "HIGH";

    if (separation < 5) level = "WAIT";

    return {
      level,
      direction: level === "WAIT" ? "NEUTRAL" : winner,
      score: Number(winningScore.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      separation: Number(separation.toFixed(2)),
      evenScore: Number(score.EVEN.toFixed(2)),
      oddScore: Number(score.ODD.toFixed(2)),
      historySize,
      reasons,
      warnings,
      reason: reasons.length ? reasons.join(" • ") : "No strong alignment yet."
    };
  }

  function emit() {
    const signal = build();
    window.dispatchEvent(new CustomEvent("signals:update", { detail: signal }));
    return signal;
  }

  window.addEventListener("evenodd:update", emit);

  return {
    build,
    getSnapshot: build,
    emit
  };
})();
