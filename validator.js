const Validator = (() => {
  const state = {
    backtest: {},
    live: {},
    overall: { wins:0, losses:0, signals:0, accuracy:null, coverage:0 },
    pending: {},
    tickSequence: 0
  };

  const MIN_SAMPLE = 50;
  const STEP = 5;
  const MIN_BACKTEST_SIGNALS = 5;
  const levels = new Set(["EARLY","CONFIRMED","HIGH"]);

  function empty() { return { wins:0, losses:0, signals:0, accuracy:null, coverage:0, edgeScore:50 }; }
  function outcome(direction, digit) {
    if (direction === "EVEN") return digit % 2 === 0;
    if (direction === "ODD") return digit % 2 === 1;
    return null;
  }
  function summarize(wins, losses, evaluations) {
    const signals = wins + losses;
    const accuracy = signals ? wins / signals * 100 : null;
    const coverage = evaluations ? signals / evaluations * 100 : 0;
    // Conservative validated edge score. It is NOT a win probability.
    const shrink = Math.sqrt(signals / Math.max(1, signals + 20));
    const edgeScore = accuracy == null ? 50 : 50 + (accuracy - 50) * shrink;
    return { wins, losses, signals, accuracy:accuracy == null?null:Number(accuracy.toFixed(1)), coverage:Number(coverage.toFixed(1)), edgeScore:Number(Math.max(0,Math.min(100,edgeScore)).toFixed(1)) };
  }

  function replay(market, ticks) {
    const book = Array.isArray(ticks) ? ticks : [];
    let wins=0, losses=0, evaluations=0;
    // Walk forward: score using only ticks before the next outcome tick.
    for (let i=MIN_SAMPLE; i < book.length-1; i+=STEP) {
      const current = book.slice(0,i+1);
      const scored = Scanner.scoreHistory(market,current);
      evaluations++;
      if (!levels.has(scored.level) || !scored.direction) continue;
      const ok = outcome(scored.direction, book[i+1].digit);
      if (ok === true) wins++; else if (ok === false) losses++;
    }
    return { ...summarize(wins,losses,evaluations), evaluations };
  }

  function runBacktests() {
    const markets = CONFIG.MARKETS;
    let totalWins=0,totalLosses=0,totalEval=0;
    for (const market of markets) {
      const result = replay(market, Scanner.getMarketHistory(market.symbol));
      state.backtest[market.symbol] = result;
      totalWins += result.wins; totalLosses += result.losses; totalEval += result.evaluations;
    }
    const total = summarize(totalWins,totalLosses,totalEval);
    state.overall = total;
    emit();
    return state;
  }

  function liveScoreFor(item, tick) {
    if (!item || !levels.has(item.level) || !item.direction) return;
    const key = item.symbol;
    const pending = state.pending[key];
    if (pending) return;
    state.pending[key] = { direction:item.direction, createdAt:Date.now(), price:tick.price, digit:tick.digit, confidence:item.confidence, level:item.level, sequence:state.tickSequence };
  }

  function resolve(symbol, tick) {
    const pending = state.pending[symbol];
    if (!pending) return;
    const ok = outcome(pending.direction,tick.digit);
    const live = state.live[symbol] || empty();
    live.wins += ok ? 1 : 0;
    live.losses += ok ? 0 : 1;
    state.live[symbol] = { ...summarize(live.wins,live.losses,(live.wins+live.losses)) };
    delete state.pending[symbol];
    emit();
  }

  function onScan(event) {
    const scan = event.detail;
    if (!scan) return;
    for (const item of scan.markets || []) {
      // A pending prediction is resolved by the next tick before a new one is opened.
      if (!state.pending[item.symbol]) {
        const latest = Scanner.getMarketHistory(item.symbol).at(-1);
        if (latest) liveScoreFor(item,latest);
      }
    }
    emit();
  }

  function onTick(event) {
    const {symbol,digit,price} = event.detail;
    // Scanner processes the tick listener first. Incrementing here lets us
    // distinguish the current observation from the next observation.
    state.tickSequence++;
    const pending = state.pending[symbol];
    if (pending && pending.sequence < state.tickSequence) {
      resolve(symbol,{digit,price});
    }
  }

  function emit() { window.dispatchEvent(new CustomEvent("validation:update", { detail:getSnapshot() })); }
  function getMarket(symbol) { return { backtest:state.backtest[symbol]||empty(), live:state.live[symbol]||empty() }; }
  function leaderValidation(symbol) { return getMarket(symbol); }
  function getSnapshot() { return { backtest:{...state.backtest}, live:{...state.live}, overall:{...state.overall} }; }

  window.addEventListener("deriv:history", () => {
    // Run after the scanner has loaded the current history. A small delay lets all
    // same-connection history responses populate before replay starts.
    clearTimeout(window.__v6BacktestTimer);
    window.__v6BacktestTimer=setTimeout(runBacktests,100);
  });
  window.addEventListener("scanner:update", onScan);
  window.addEventListener("deriv:tick", onTick);

  return { runBacktests, getSnapshot, getMarket, leaderValidation };
})();
