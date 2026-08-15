/**
 * Meta decision layer.
 * This is a deterministic ensemble, not a claim of machine learning.
 * Online learning can be added after forward-test data is collected.
 */
const AI = {
  decide(history) {
    const signal = Signals.analyze(history);
    if (!signal.candidates.length) {
      return {
        ...signal,
        decision: "WAIT",
        label: "INSUFFICIENT DATA"
      };
    }

    const best = signal.candidates[0];
    const decision = signal.level === "WAIT"
      ? "WAIT"
      : signal.level;

    return {
      ...signal,
      decision,
      label: `${decision} ${best.direction}`,
      modelAgreement: this.agreement(signal)
    };
  },

  agreement(signal) {
    if (!signal.candidates.length) return 0;
    const s = signal.candidates[0];
    const support = s.reasons.length;
    return Math.min(100, support / 5 * 100);
  }
};
