const Calibration = (() => {
  const state = {
    markets: {},
    regimes: {},
    overall: { samples:0, brier:null, ece:null, accuracy:null, bins:[] },
    lastUpdate: null
  };

  const MIN_SAMPLE = 50;
  const STEP = CONFIG.VALIDATION_STEP || 5;
  const LEVELS = new Set(["EARLY","CONFIRMED","HIGH"]);
  const BIN_COUNT = 10;
  const ROLLING_LIMIT = 2000;
  const REGIMES = ["BALANCED","MIXED","DIRECTIONAL","UNKNOWN"];
  const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const empty = () => ({samples:0,brier:null,ece:null,accuracy:null,bins:[],quality:"UNCALIBRATED",reliability:0});

  function outcome(direction,digit) {
    if (direction === "EVEN") return digit % 2 === 0;
    if (direction === "ODD") return digit % 2 === 1;
    return null;
  }

  // Scanner confidence is a score, not a true probability. Keep the mapping
  // conservative around the 50% Even/Odd base rate.
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

  function buildBins(records) {
    const bins = Array.from({length:BIN_COUNT},(_,i) => ({
      lower:i/10, upper:(i+1)/10, samples:0, wins:0, empirical:null, calibrated:null
    }));
    for (const r of records) {
      const idx = Math.min(BIN_COUNT-1, Math.floor(clamp(r.p) * BIN_COUNT));
      bins[idx].samples++;
      if (r.y) bins[idx].wins++;
    }
    for (const b of bins) {
      if (!b.samples) continue;
      // Jeffreys smoothing; shrink tiny bins toward 50% until evidence grows.
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
    // Pull toward adjacent bins to reduce discontinuities at bin edges.
    const center = (b.lower + b.upper) / 2;
    const local = clamp(1 - Math.abs(x-center) / 0.1, 0, 1);
    return clamp(x * (1-local*0.75) + b.calibrated * (local*0.75));
  }

  function metrics(records,bins) {
    if (!records.length) return empty();
    let brier=0,wins=0,ece=0;
    for (const r of records) {
      const cal = interpolate(bins,r.p);
      brier += (cal-r.y) ** 2;
      wins += r.y;
    }
    for (const b of bins) {
      if (!b.samples) continue;
      ece += (b.samples/records.length) * Math.abs(b.calibrated - b.wins/b.samples);
    }
    const accuracy = wins/records.length*100;
    const quality = qualityFor(records.length,ece);
    return {
      samples:records.length,
      brier:Number((brier/records.length).toFixed(4)),
      ece:Number(ece.toFixed(4)),
      accuracy:Number(accuracy.toFixed(1)),
      bins, quality, reliability:reliabilityFor(records.length,ece)
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
    if (book.length < MIN_SAMPLE+1) return {records,metrics:empty()};
    for (let i=MIN_SAMPLE;i<book.length-1;i+=STEP) {
      const scored=Scanner.scoreHistory(market,book.slice(0,i+1));
      addRecord(records,scored,book[i+1].digit);
    }
    const bins=buildBins(records);
    return {records,metrics:metrics(records,bins)};
  }

  function buildModel(records) {
    const allBins=buildBins(records);
    const overall=metrics(records,allBins);
    const regimes={};
    for (const regime of REGIMES) {
      const subset=records.filter(r=>r.regime===regime);
      regimes[regime]=metrics(subset,buildBins(subset));
    }
    return {records,overall,regimes};
  }

  function run() {
    let allRecords=[];
    for (const market of CONFIG.MARKETS) {
      const replayed=replay(market,Scanner.getMarketHistory(market.symbol));
      const model=buildModel(replayed.records);
      state.markets[market.symbol]={...model.overall, rollingSamples:model.records.length};
      for (const regime of REGIMES) {
        const key=`${market.symbol}:${regime}`;
        state.regimes[key]=model.regimes[regime];
      }
      allRecords=allRecords.concat(model.records);
    }
    const overallBins=buildBins(allRecords);
    state.overall=metrics(allRecords,overallBins);
    state.lastUpdate=Date.now();
    emit();
    return getSnapshot();
  }

  function selectModel(symbol,regime) {
    const specific=state.regimes[`${symbol}:${regime}`];
    const market=state.markets[symbol];
    // Regime model is preferred only when it has enough evidence.
    if (specific && specific.samples >= 30) return specific;
    return market || empty();
  }

  function calibrate(symbol,confidence,regime="UNKNOWN") {
    const p=rawProbability(confidence);
    const model=selectModel(symbol,regime);
    if (!model || !model.samples) {
      return {rawProbability:Number(p.toFixed(3)),calibratedProbability:Number(p.toFixed(3)),sampleCount:0,quality:"UNCALIBRATED",reliability:0,regime};
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
    return {
      markets:{...state.markets},
      regimes:{...state.regimes},
      overall:{...state.overall},
      lastUpdate:state.lastUpdate
    };
  }
  function emit() { window.dispatchEvent(new CustomEvent("calibration:update",{detail:getSnapshot()})); }

  window.addEventListener("deriv:history",() => {
    clearTimeout(window.__v61CalibrationTimer);
    window.__v61CalibrationTimer=setTimeout(run,180);
  });
  window.addEventListener("scanner:update",() => {
    if (Date.now()-(state.lastUpdate||0)>15000) {
      clearTimeout(window.__v61CalibrationTimer);
      window.__v61CalibrationTimer=setTimeout(run,50);
    }
  });

  return {run,calibrate,getMarket,getSnapshot};
})();
