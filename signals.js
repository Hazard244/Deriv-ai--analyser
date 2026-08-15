const Signals = (() => {
  function build() {
    const scan = Scanner.getSnapshot();
    if (!scan || !scan.top3.length) {
      return {
        level: "WAIT",
        direction: "NEUTRAL",
        confidence: 0,
        reason: "Scanner is collecting market data."
      };
    }

    const top = scan.top3[0];
    const deep = DeepAnalysis.analyze(top);

    return {
      level: top.level,
      direction: top.direction,
      confidence: top.confidence,
      opportunity: top.opportunity,
      market: top.name,
      symbol: top.symbol,
      reason: top.reason,
      deep
    };
  }

  function emit() {
    const signal = build();
    window.dispatchEvent(new CustomEvent("signals:update", { detail: signal }));
    return signal;
  }

  window.addEventListener("scanner:update", emit);

  return {
    build,
    getSnapshot: build,
    emit
  };
})();
