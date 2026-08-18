const Signals = (() => {
  function build() {
    const scan = Scanner.getSnapshot();
    if (!scan || !scan.top3.length) {
      return { level: "WAIT", direction: "NEUTRAL", confidence: 0, reason: "Scanner is collecting market data." };
    }

    const gateSnapshot = typeof DecisionGate !== "undefined" ? DecisionGate.getSnapshot() : null;
    const gated = gateSnapshot?.last;
    const top = gated?.symbol ? scan.markets.find(x => x.symbol === gated.symbol) : scan.top3[0];
    const deep = DeepAnalysis.analyze(top);

    return {
      level: gated?.gate || top.level,
      direction: top.direction,
      confidence: gated ? gated.calibratedProbability : top.confidence,
      rawConfidence: top.confidence,
      opportunity: top.opportunity,
      market: top.name,
      symbol: top.symbol,
      reason: gated ? gated.verdict : top.reason,
      gate: gated || null,
      deep
    };
  }

  function emit() {
    const signal = build();
    window.dispatchEvent(new CustomEvent("signals:update", { detail: signal }));
    return signal;
  }

  window.addEventListener("scanner:update", () => {
    if (typeof DecisionGate !== "undefined") DecisionGate.build();
    emit();
  });
  window.addEventListener("gate:update", emit);

  return { build, getSnapshot: build, emit };
})();
