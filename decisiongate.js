const DecisionGate = (() => {
  const state = { last: null, markets: {}, updatedAt: null };
  const ACTION_LEVELS = new Set(["EARLY", "CONFIRMED", "HIGH"]);
  const clamp = (n, a=0, b=100) => Math.max(a, Math.min(b, n));

  function evaluate(item) {
    if (!item) return empty("No candidate available.");

    const validation = Validator.getMarket(item.symbol) || {};
    const bt = validation.backtest || {};
    const cal = Calibration.calibrate(item.symbol, item.confidence, regimeFrom(item));
    const signals = Number(bt.signals || 0);
    const accuracy = Number(bt.accuracy ?? 0);
    const edge = Number(bt.edgeScore ?? 50);
    const alignment = Number(item.alignment || 0);
    const entropy = Number(item.entropy ?? 1);
    const markov = Number(item.markovEdge || 0);
    const separation = Number(item.separation || 0);
    const opportunity = Number(item.opportunity || 0);
    const calibrated = Number(cal.calibratedProbability || 0.5) * 100;
    const reliability = Number(cal.reliability || 0);
    const ece = Number(cal.ece ?? 0.2);

    let score = 0;
    const reasons = [];
    const blockers = [];

    // 1. Historical validation: strongest evidence layer.
    if (accuracy >= 55) score += 20;
    else if (accuracy >= 52) score += 12;
    else if (accuracy >= 50) score += 5;
    else blockers.push(`walk-forward ${accuracy.toFixed(1)}%`);

    // 2. Evidence size.
    if (signals >= 150) score += 12;
    else if (signals >= 100) score += 10;
    else if (signals >= 60) score += 7;
    else if (signals >= 30) score += 4;
    else blockers.push(`only ${signals} validated signals`);

    // 3. Calibration quality and reliability.
    if (calibrated >= 57) score += 18;
    else if (calibrated >= 55) score += 13;
    else if (calibrated >= 53) score += 8;
    else score += 2;

    if (reliability >= 50) score += 10;
    else if (reliability >= 30) score += 6;
    else if (signals >= 30) blockers.push(`calibration reliability ${reliability.toFixed(1)}`);

    if (ece <= 0.05) score += 8;
    else if (ece <= 0.10) score += 4;
    else if (signals >= 30) blockers.push(`ECE ${ece.toFixed(4)}`);

    // 4. Structural agreement.
    if (alignment >= 100) score += 10;
    else if (alignment >= 80) score += 7;
    else if (alignment >= 60) score += 3;
    else blockers.push(`alignment ${alignment.toFixed(0)}%`);

    if (markov >= 10) score += 6;
    else if (markov >= 5) score += 3;

    if (separation >= 18) score += 5;
    else if (separation >= 12) score += 3;

    // 5. Distribution/noise penalties.
    if (entropy > 0.985) { score -= 10; blockers.push("near-balanced entropy"); }
    else if (entropy > 0.95) score -= 5;
    if (item.switchRate > 75) { score -= 5; blockers.push("high switch-rate noise"); }

    // Opportunity is useful for ranking, but cannot override evidence.
    if (opportunity >= 85) score += 3;
    else if (opportunity >= 70) score += 2;

    score = Number(clamp(score).toFixed(1));

    const hardValidation = signals >= 30 && accuracy >= 50;
    const calibratedEnough = calibrated >= 53;
    const structureEnough = alignment >= 60 && separation >= 5;
    const calibrationUsable = signals < 30 || (reliability >= 20 && ece <= 0.12);

    let gate = "WAIT";
    if (hardValidation && calibratedEnough && structureEnough && calibrationUsable && score >= 68) gate = "EARLY";
    if (hardValidation && calibrated >= 54.5 && alignment >= 80 && score >= 78 && accuracy >= 52.5 && signals >= 60 && calibrationUsable) gate = "CONFIRMED";
    if (hardValidation && calibrated >= 57 && alignment >= 80 && score >= 88 && accuracy >= 55 && signals >= 100 && reliability >= 35 && ece <= 0.10) gate = "HIGH";

    if (gate === "WAIT") {
      if (accuracy >= 52) reasons.push(`validation ${accuracy.toFixed(1)}% is positive but not strong enough`);
      if (calibrated < 53) reasons.push(`calibrated probability ${calibrated.toFixed(1)}% is near base rate`);
      if (signals < 30) reasons.push("insufficient validation evidence");
      if (alignment < 60) reasons.push("multi-window agreement is weak");
    } else {
      reasons.push(`walk-forward ${accuracy.toFixed(1)}%`);
      reasons.push(`calibrated ${calibrated.toFixed(1)}%`);
      reasons.push(`${signals} validated signals`);
      reasons.push(`${alignment.toFixed(0)}% alignment`);
    }

    const actionable = ACTION_LEVELS.has(gate);
    return {
      market: item.name,
      symbol: item.symbol,
      direction: item.direction,
      gate,
      actionable,
      score,
      calibratedProbability: Number(calibrated.toFixed(1)),
      rawProbability: Number((cal.rawProbability * 100).toFixed(1)),
      validatedAccuracy: bt.accuracy ?? null,
      validatedSignals: signals,
      edgeScore: bt.edgeScore ?? null,
      calibrationReliability: reliability,
      calibrationECE: cal.ece ?? null,
      alignment,
      markovEdge: markov,
      separation,
      opportunity,
      blockers: [...new Set(blockers)],
      reasons,
      verdict: actionable ? "Evidence supports an actionable signal." : "Pattern detected, but evidence gate is not satisfied."
    };
  }

  function regimeFrom(item) {
    if (!item) return "UNKNOWN";
    if (Number(item.entropy) > 0.985) return "BALANCED";
    if (Number(item.entropy) < 0.75) return "DIRECTIONAL";
    return "MIXED";
  }

  function empty(message) {
    return {
      market: "--", symbol: "--", direction: "NEUTRAL", gate: "WAIT", actionable: false,
      score: 0, calibratedProbability: 50, rawProbability: 50, validatedAccuracy: null,
      validatedSignals: 0, edgeScore: null, calibrationReliability: 0, calibrationECE: null,
      alignment: 0, markovEdge: 0, separation: 0, opportunity: 0, blockers: [message],
      reasons: [], verdict: message
    };
  }

  function rank(scan) {
    if (!scan?.markets?.length) return [];
    const evaluated = scan.markets.map(item => ({ item, gate: evaluate(item) }));
    evaluated.sort((a, b) => {
      if (b.gate.score !== a.gate.score) return b.gate.score - a.gate.score;
      return b.item.opportunity - a.item.opportunity;
    });
    return evaluated;
  }

  function build() {
    const scan = Scanner.getSnapshot();
    const ranked = rank(scan);
    const best = ranked[0]?.gate || empty("Waiting for scanner data.");
    const actionable = ranked.find(x => x.gate.actionable)?.gate || null;
    state.markets = Object.fromEntries(ranked.map(x => [x.item.symbol, x.gate]));
    state.last = actionable || best;
    state.updatedAt = Date.now();
    window.dispatchEvent(new CustomEvent("gate:update", { detail: getSnapshot() }));
    return state.last;
  }

  function get(symbol) { return state.markets[symbol] || null; }
  function getSnapshot() { return { last: state.last, markets: { ...state.markets }, updatedAt: state.updatedAt }; }

  window.addEventListener("scanner:update", build);
  window.addEventListener("validation:update", () => { if (Scanner.getSnapshot()) build(); });
  window.addEventListener("calibration:update", () => { if (Scanner.getSnapshot()) build(); });

  return { evaluate, rank, build, get, getSnapshot };
})();
