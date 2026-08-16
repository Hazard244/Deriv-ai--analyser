const AI = (() => {
  const state = { regime:"UNKNOWN", modelTrust:0, last:null };

  function analyze() {
    const scan = Scanner.getSnapshot();
    const signal = Signals.getSnapshot();
    if (!scan) return null;
    const top=scan.top3[0], second=scan.top3[1];
    const separation=top&&second?top.opportunity-second.opportunity:0;
    const validation=top ? Validator.getMarket(top.symbol) : {backtest:{},live:{}};
    const bt=validation.backtest||{};

    let trust=30;
    if (top?.samples>=250) trust+=15;
    if (top?.alignment>=80) trust+=10;
    if (top?.entropy<0.985) trust+=8;
    if (separation>=8) trust+=7;
    if ((bt.signals||0)>=20) trust+=10;
    if ((bt.accuracy||0)>=55) trust+=10;
    if ((bt.accuracy||100)<50 && (bt.signals||0)>=10) trust-=15;
    if (top?.level==="WAIT") trust-=10;
    trust=Math.max(0,Math.min(100,trust));

    const regime=!top?"UNKNOWN":top.entropy>0.985?"BALANCED":top.entropy<0.75?"DIRECTIONAL":"MIXED";
    const result={
      decision:signal?.direction||"NEUTRAL", level:signal?.level||"WAIT", market:signal?.market||"--",
      confidence:signal?.confidence||0, opportunity:signal?.opportunity||0,
      modelTrust:Number(trust.toFixed(1)), regime,
      validatedAccuracy:bt.accuracy ?? null, validatedSignals:bt.signals||0,
      validatedEdgeScore:bt.edgeScore ?? 50,
      top3:scan.top3.map(item=>{ const v=Validator.getMarket(item.symbol).backtest||{}; return {rank:item.rank,name:item.name,direction:item.direction,level:item.level,opportunity:item.opportunity,confidence:item.confidence,validatedAccuracy:v.accuracy??null,validatedSignals:v.signals||0}; }),
      rankingSeparation:Number(separation.toFixed(1))
    };
    state.regime=regime; state.modelTrust=result.modelTrust; state.last=result;
    window.dispatchEvent(new CustomEvent("ai:update",{detail:result}));
    return result;
  }
  window.addEventListener("signals:update",analyze);
  window.addEventListener("scanner:update",analyze);
  window.addEventListener("validation:update",analyze);
  return {analyze,getState:()=>({...state})};
})();
