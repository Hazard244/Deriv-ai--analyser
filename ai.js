const AI = (() => {
  const state = {
    regime: "UNKNOWN",
    modelTrust: 0,
    last: null
  };

  function analyze() {
    const scan = Scanner.getSnapshot();
    const signal = Signals.getSnapshot();

    if (!scan) return null;

    const top = scan.top3[0];
    const second = scan.top3[1];
    const separation = top && second ? top.opportunity - second.opportunity : 0;

    let trust = 40;
    if (top?.samples >= 250) trust += 15;
    if (top?.alignment >= 80) trust += 15;
    if (top?.entropy < 0.985) trust += 10;
    if (separation >= 8) trust += 10;
    if (top?.level === "WAIT") trust -= 10;

    trust = Math.max(0, Math.min(100, trust));

    const regime = !top ? "UNKNOWN" :
      top.entropy > 0.985 ? "BALANCED" :
      top.entropy < 0.75 ? "DIRECTIONAL" : "MIXED";

    const result = {
      decision: signal?.direction || "NEUTRAL",
      level: signal?.level || "WAIT",
      market: signal?.market || "--",
      confidence: signal?.confidence || 0,
      opportunity: signal?.opportunity || 0,
      modelTrust: Number(trust.toFixed(1)),
      regime,
      top3: scan.top3.map(item => ({
        rank: item.rank,
        name: item.name,
        direction: item.direction,
        level: item.level,
        opportunity: item.opportunity,
        confidence: item.confidence
      })),
      rankingSeparation: Number(separation.toFixed(1))
    };

    state.regime = regime;
    state.modelTrust = result.modelTrust;
    state.last = result;

    window.dispatchEvent(new CustomEvent("ai:update", { detail: result }));
    return result;
  }

  window.addEventListener("signals:update", analyze);
  window.addEventListener("scanner:update", analyze);

  return {
    analyze,
    getState: () => ({ ...state })
  };
})();
