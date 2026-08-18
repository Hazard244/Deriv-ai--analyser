const Calibration = (() => {
  const state = {
    markets: {},
    regimes: {},
    overall: { samples:0, brier:null, ece:null, accuracy:null, bins:[], quality:"UNCALIBRATED", reliability:0 },
    lastUpdate: null
  };

  const MIN_SAMPLE = 50;
  const STEP = CONFIG.VALIDATION_STEP || 5;
  const LEVELS = new Set(["EARLY","CONFIRMED","HIGH"]);
  const BIN_COUNT = 10;
  const ROLLING_LIMIT = 2000;
  const REGIMES = ["BALANCED","MIXED","DIRECTIONAL","UNKNOWN"];
  const MIN_MODEL_SAMPLES = 30;
  const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const empty = () => ({samples:0,brier:null,ece:null,accuracy:null,bins:[],quality:"UNCALIBRATED",reliability:0});

  function outcome(direction,digit) {
    if (direction === "EVEN") return digit % 2 === 0;
    if (direction === "ODD") return digit % 2 === 1;
    return null;
  }

  // Confidence is a model score, not a probability. Keep the proxy conservative
  // around the 50% Even/Odd base rate until enough empirical evidence exists.
  function rawProbability(confidence) {
    const c = clamp(Number(confidence || 0) / 100);
    return clamp(0.5 + (c - 0.5) * 0.80, 0.5, 0.98);
  }

  function regimeFromScore(scored) {
    if (!scored) return "UNKNOWN";
    if (Number(scored.entropy) > 0.985) return "BALANCED";
    if (Number(scored.entropy) < 0.75) return "DIRECTIONAL";
    return "MIXED";
  }

  function buildBins(records, probabilityField="p") {
    const bins = Array.from({length:BIN_COUNT},(_,i) => ({
      lower:i/10, upper:(i+1)/10, samples:0, wins:0, sumP:0, empirical:null, meanP:null, calibrated:null
    }));
    for (const r of records) {
      const p = clamp(Number(r[probabilityField] ?? r.p));
      const idx = Math.min(BIN_COUNT-1, Math.floor(p * BIN_COUNT));
      bins[idx].samples++;
      bins[idx].sumP += p;
      if (r.y) bins[idx].wins++;
    }
    for (const b of bins) {
      if (!b.samples) continue;
      // Jeffreys smoothing plus evidence shrinkage prevents tiny bins from
      // producing extreme probabilities.
      b.empirical = (b.wins + 0.5) / (b.samples + 1);
      const evidence = Math.min(1, b.samples / 50);
      b.calibrated = clamp(0.5 + (b.empirical - 0.5) * evidence);
    }
    return bins;
  }

  function interpolate(bins,p) {
    const x = clamp(p);
    const idx = Math.min(BIN_COUNT-1, Math.floor(x * BIN_COUNT));
    const b = bins[idx];
    if (!b || !b.samples || b.calibrated == null) return x;
    const center = (b.lower + b.upper) / 2;
    const local = clamp(1 - Math.abs(x-center) / 0.1, 0, 1);
    return clamp(x * (1-local*0.75) + b.calibrated * (local*0.75));
  }

  function metricSummary(records, probabilityField="calibrated") {
    if (!records.length) return empty();
    let brier=0, wins=0;
    const bins = Array.from({length:BIN_COUNT},(_,i) => ({
      lower:i/10, upper:(i+1)/10, samples:0, wins:0, sumP:0, empirical:null, meanP:null, calibrated:null
    }));

    for (const r of records) {
      const p = clamp(Number(r[probabilityField] ?? r.p));
      brier += (p-r.y) ** 2;
      wins += r.y;
      const idx = Math.min(BIN_COUNT-1, Math.floor(p*BIN_COUNT));
      bins[idx].samples++;
      bins[idx].sumP += p;
      if (r.y) bins[idx].wins++;
    }

    let ece=0;
    for (const b of bins) {
      if (!b.samples) continue;
      b.empirical = b.wins / b.samples;
      b.meanP = b.sumP / b.samples;
      b.calibrated = b.empirical;
      ece += (b.samples/records.length) * Math.abs(b.empirical - b.meanP);
    }

    const accuracy = wins/records.length*100;
    const quality = qualityFor(records.length,ece);
    return {
      samples:records.length,
      brier:Number((brier/records.length).toFixed(4)),
      ece:Number(ece.toFixed(4)),
      accuracy:Number(accuracy.toFixed(1)),
      bins,
      quality,
      reliability:reliabilityFor(records.length,ece)
    };
  }

  function qualityFor(samples,ece) {
    if (!samples) return "UNCALIBRATED";
    if (samples < 20) return "LOW";
    if (samples < 50) return "DEVELOPING";
    if (ece <= 0.05) return "CALIBRATED";
    if (ece <= 0.10) return "DEVELOPING";
    return "NEEDS_REVIEW";
  }

  function reliabilityFor(samples,ece) {
    if (!samples) return 0;
    const evidence = Math.min(1,samples/200);
    const fit = Math.max(0,1-(ece/0.15));
    return Number((100*evidence*fit).toFixed(1));
  }

  function addRecord(target,scored,nextDigit) {
    if (!LEVELS.has(scored.level) || !scored.direction) return;
    const y = outcome(scored.direction,nextDigit);
    if (y === null) return;
    target.push({
      p:rawProbability(scored.confidence),
      y:y?1:0,
      confidence:Number(scored.confidence||0),
      regime:regimeFromScore(scored)
    });
    if (target.length > ROLLING_LIMIT) target.splice(0,target.length-ROLLING_LIMIT);
  }

  function replay(market,ticks) {
    const book = Array.isArray(ticks) ? ticks : [];
    const records=[];
    if (book.length < MIN_SAMPLE+1) return records;

    for (let i=MIN_SAMPLE;i<book.length-1;i+=STEP) {
      const scored=Scanner.scoreHistory(market,book.slice(0,i+1));
      addRecord(records,scored,book[i+1].digit);
    }
    return records;
  }

  // Prequential evaluation: prediction i is calibrated only with records that
  // existed before prediction i. This prevents calibration leakage/in-sample optimism.
  function prequential(records, minHistory=MIN_MODEL_SAMPLES) {
    const evaluated=[];
    const history=[];
    for (const r of records) {
      let pCal = r.p;
      if (history.length >= minHistory) {
        const bins=buildBins(history);
        pCal=interpolate(bins,r.p);
      }
      evaluated.push({...r, calibrated:pCal});
      history.push(r);
    }
    return evaluated;
  }

  function buildModel(records) {
    const evaluated=prequential(records);
    const validation=metricSummary(evaluated,"calibrated");
    const finalBins=buildBins(records);
    return {records, evaluated, validation, finalBins};
  }

  function run() {
    let allEvaluated=[];
    for (const market of CONFIG.MARKETS) {
      const records=replay(market,Scanner.getMarketHistory(market.symbol));
      const model=buildModel(records);
      state.markets[market.symbol]={
        ...model.validation,
        rollingSamples:records.length,
        bins:model.finalBins
      };

      for (const regime of REGIMES) {
        const subset=records.filter(r=>r.regime===regime);
        const regimeModel=buildModel(subset);
        state.regimes[`${market.symbol}:${regime}`]={
          ...regimeModel.validation,
          rollingSamples:subset.length,
          bins:regimeModel.finalBins
        };
      }
      allEvaluated=allEvaluated.concat(model.evaluated);
    }

    // Overall calibration is also evaluated prequentially rather than by fitting
    // and scoring on the same records.
    const overallHistory=allEvaluated.map(r=>({
      p:r.p, y:r.y, calibrated:r.calibrated, confidence:r.confidence, regime:r.regime
    }));
    state.overall=metricSummary(overallHistory,"calibrated");
    state.lastUpdate=Date.now();
    emit();
    return getSnapshot();
  }

  function selectModel(symbol,regime) {
    const specific=state.regimes[`${symbol}:${regime}`];
    const market=state.markets[symbol];
    // Regime-specific calibration is used only when it has enough evidence.
    if (specific && specific.samples >= MIN_MODEL_SAMPLES) return specific;
    return market || empty();
  }

  function calibrate(symbol,confidence,regime="UNKNOWN") {
    const p=rawProbability(confidence);
    const model=selectModel(symbol,regime);
    if (!model || !model.samples || !model.bins?.length) {
      return {
        rawProbability:Number(p.toFixed(3)),
        calibratedProbability:Number(p.toFixed(3)),
        sampleCount:0,
        quality:"UNCALIBRATED",
        reliability:0,
        regime
      };
    }
    const cal=interpolate(model.bins,p);
    return {
      rawProbability:Number(p.toFixed(3)),
      calibratedProbability:Number(cal.toFixed(3)),
      sampleCount:model.samples,
      quality:model.quality,
      reliability:model.reliability,
      brier:model.brier,
      ece:model.ece,
      regime
    };
  }

  function getMarket(symbol) { return state.markets[symbol] || empty(); }
  function getSnapshot() {
    return { markets:{...state.markets}, regimes:{...state.regimes}, overall:{...state.overall}, lastUpdate:state.lastUpdate };
  }
  function emit() { window.dispatchEvent(new CustomEvent("calibration:update",{detail:getSnapshot()})); }

  window.addEventListener("deriv:history",() => {
    clearTimeout(window.__v62CalibrationTimer);
    window.__v62CalibrationTimer=setTimeout(run,180);
  });
  window.addEventListener("scanner:update",() => {
    if (Date.now()-(state.lastUpdate||0)>15000) {
      clearTimeout(window.__v62CalibrationTimer);
      window.__v62CalibrationTimer=setTimeout(run,50);
    }
  });

  return {run,calibrate,getMarket,getSnapshot};
})();
