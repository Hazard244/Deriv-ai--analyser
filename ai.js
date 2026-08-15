const AI = (() => {
  const state = {
    regime: "UNKNOWN",
    modelTrust: 0,
    last: null,
    history: []
  };

  function analyze() {
    const signal = Signals.getSnapshot();
    const stats = Statistics.getSnapshot();
    const patterns = Patterns.getSnapshot();

    const regime = stats.entropy < 0.75
      ? "DIRECTIONAL"
      : stats.entropy > 0.95
        ? "BALANCED"
        : "MIXED";

    let trust = 50;
    if (signal.historySize >= 250) trust += 15;
    if (signal.separation >= 12) trust += 15;
    if (stats.alignment.alignment >= 60) trust += 10;
    if (signal.warnings.length) trust -= 10;

    trust = Math.max(0, Math.min(100, trust));

    const result = {
      decision: signal.direction,
      level: signal.level,
      confidence: signal.confidence,
      modelTrust: Number(trust.toFixed(1)),
      regime,
      components: {
        multiWindowAlignment: Number(stats.alignment.alignment.toFixed(1)),
        markovEdge: Number(patterns.markov.edge.toFixed(1)),
        entropy: Number(stats.entropy.toFixed(3))
      },
      reasons: signal.reasons,
      warnings: signal.warnings
    };

    state.regime = regime;
    state.modelTrust = result.modelTrust;
    state.last = result;
    state.history.push(result);

    if (state.history.length > 200) state.history.shift();

    window.dispatchEvent(new CustomEvent("ai:update", { detail: result }));
    return result;
  }

  window.addEventListener("signals:update", analyze);

  return {
    analyze,
    getState: () => ({
      regime: state.regime,
      modelTrust: state.modelTrust,
      last: state.last,
      history: [...state.history]
    })
  };
})();
