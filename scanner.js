const Scanner = (() => {
  const books = new Map();
  let lastScan = null;
  let timer = null;

  for (const market of CONFIG.MARKETS) books.set(market.symbol, []);

  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

  function push(symbol, tick) {
    const book = books.get(symbol);
    if (!book || !tick) return;
    book.push(tick);
    if (book.length > CONFIG.MAX_HISTORY) book.splice(0, book.length - CONFIG.MAX_HISTORY);
  }

  function load(symbol, ticks) {
    if (!books.has(symbol)) return;
    books.set(symbol, Array.isArray(ticks) ? ticks.slice(-CONFIG.MAX_HISTORY) : []);
  }

  function windowStats(book, n) {
    const a = book.slice(-n);
    if (!a.length) return { samples: 0, even: 50, odd: 50, edge: 0, direction: "NEUTRAL" };
    const even = a.filter(x => Number.isInteger(x.digit) && x.digit % 2 === 0).length;
    const odd = a.length - even;
    const evenPct = even / a.length * 100;
    const oddPct = odd / a.length * 100;
    return { samples: a.length, even: evenPct, odd: oddPct, edge: Math.abs(evenPct - oddPct), direction: evenPct > oddPct ? "EVEN" : oddPct > evenPct ? "ODD" : "NEUTRAL" };
  }

  function entropy(book, n = 100) {
    const w = windowStats(book, n);
    if (!w.samples) return 1;
    const p = w.even / 100, q = w.odd / 100;
    return (p ? -p * Math.log2(p) : 0) + (q ? -q * Math.log2(q) : 0);
  }

  function markov(book, n = 250) {
    const a = book.slice(-n);
    const m = { EVEN: { EVEN: 0, ODD: 0 }, ODD: { EVEN: 0, ODD: 0 } };
    for (let i = 1; i < a.length; i++) {
      const prev = a[i - 1].digit % 2 === 0 ? "EVEN" : "ODD";
      const next = a[i].digit % 2 === 0 ? "EVEN" : "ODD";
      m[prev][next]++;
    }
    const current = a.length ? (a.at(-1).digit % 2 === 0 ? "EVEN" : "ODD") : null;
    if (!current) return { current: null, even: 50, odd: 50, edge: 0, direction: "NEUTRAL" };
    const total = m[current].EVEN + m[current].ODD;
    const even = total ? m[current].EVEN / total * 100 : 50;
    const odd = total ? m[current].ODD / total * 100 : 50;
    return { current, even, odd, edge: Math.abs(even - odd), direction: even > odd ? "EVEN" : odd > even ? "ODD" : "NEUTRAL" };
  }

  function switchRate(book, n = 100) {
    const a = book.slice(-n);
    if (a.length < 2) return 50;
    let switches = 0;
    for (let i = 1; i < a.length; i++) if ((a[i].digit % 2) !== (a[i - 1].digit % 2)) switches++;
    return switches / (a.length - 1) * 100;
  }

  function multiWindow(book) {
    const windows = CONFIG.WINDOWS.map(n => ({ n, ...windowStats(book, n) }));
    const valid = windows.filter(w => w.samples >= Math.min(w.n, 50));
    const evenVotes = valid.filter(w => w.direction === "EVEN").length;
    const oddVotes = valid.filter(w => w.direction === "ODD").length;
    const total = valid.length;
    const direction = evenVotes > oddVotes ? "EVEN" : oddVotes > evenVotes ? "ODD" : "NEUTRAL";
    return { windows, direction, alignment: total ? Math.max(evenVotes, oddVotes) / total * 100 : 0, evenVotes, oddVotes, total };
  }

  function scoreBook(book, market) {
    const sample = book.length;
    if (sample < 50) return { ...market, samples: sample, opportunity: 0, direction: "NEUTRAL", level: "WAIT", confidence: 0, reason: "Collecting history." };

    const multi = multiWindow(book), short = windowStats(book, 50), medium = windowStats(book, 250), long = windowStats(book, 1000);
    const mk = markov(book), ent = entropy(book), switches = switchRate(book);
    let evenScore = 0, oddScore = 0;
    if (multi.direction === "EVEN") evenScore += multi.alignment * 0.30;
    if (multi.direction === "ODD") oddScore += multi.alignment * 0.30;
    if (short.direction === "EVEN") evenScore += short.edge * 0.70;
    if (short.direction === "ODD") oddScore += short.edge * 0.70;
    if (medium.direction === "EVEN") evenScore += medium.edge * 0.40;
    if (medium.direction === "ODD") oddScore += medium.edge * 0.40;
    if (long.direction === "EVEN") evenScore += long.edge * 0.20;
    if (long.direction === "ODD") oddScore += long.edge * 0.20;
    if (mk.direction === "EVEN") evenScore += mk.edge * 0.35;
    if (mk.direction === "ODD") oddScore += mk.edge * 0.35;

    const winner = evenScore > oddScore ? "EVEN" : oddScore > evenScore ? "ODD" : "NEUTRAL";
    const winning = winner === "EVEN" ? evenScore : winner === "ODD" ? oddScore : 0;
    const losing = winner === "EVEN" ? oddScore : winner === "ODD" ? evenScore : 0;
    const separation = Math.max(0, winning - losing);
    let opportunity = winning + Math.min(15, separation);
    if (ent > 0.985) opportunity -= 12; else if (ent > 0.95) opportunity -= 6;
    if (multi.alignment < 60) opportunity -= 8;
    if (mk.edge < 3) opportunity -= 3;
    if (switches > 75) opportunity -= 5;
    opportunity = clamp(opportunity);

    let level = "WAIT";
    if (opportunity >= CONFIG.LEVELS.PREPARE) level = "PREPARE";
    if (opportunity >= CONFIG.LEVELS.EARLY && separation >= 8 && multi.alignment >= 60) level = "EARLY";
    if (opportunity >= CONFIG.LEVELS.CONFIRMED && separation >= 12 && multi.alignment >= 80 && ent < 0.985) level = "CONFIRMED";
    if (opportunity >= CONFIG.LEVELS.HIGH && separation >= 18 && multi.alignment >= 80 && ent < 0.95) level = "HIGH";
    if (separation < 5 || winner === "NEUTRAL") level = "WAIT";

    // Confidence is deliberately capped below 90 until live/backtest evidence exists.
    const rawConfidence = clamp(opportunity * 0.78 + multi.alignment * 0.08 + Math.min(5, separation * 0.10));
    const confidence = Math.min(89, rawConfidence);
    const reasons = [];
    if (multi.direction !== "NEUTRAL") reasons.push(`${multi.direction} ${multi.alignment.toFixed(0)}% multi-window alignment`);
    if (short.edge >= 5) reasons.push(`${short.direction} ${short.edge.toFixed(1)}% short-window edge`);
    if (mk.edge >= 3) reasons.push(`Markov ${mk.direction} ${mk.edge.toFixed(1)}% edge`);
    if (ent > 0.985) reasons.push("near-balanced distribution penalty");

    return {
      ...market, samples: sample, opportunity: Number(opportunity.toFixed(1)),
      direction: level === "WAIT" ? "NEUTRAL" : winner, level,
      confidence: Number(confidence.toFixed(1)), separation: Number(separation.toFixed(1)),
      entropy: Number(ent.toFixed(3)), alignment: Number(multi.alignment.toFixed(0)),
      markovEdge: Number(mk.edge.toFixed(1)), shortEven: Number(short.even.toFixed(1)),
      shortOdd: Number(short.odd.toFixed(1)), switchRate: Number(switches.toFixed(1)),
      reason: reasons.join(" • ") || "Insufficient edge."
    };
  }

  function scoreMarket(market) { return scoreBook(books.get(market.symbol) || [], market); }

  function scan() {
    const results = CONFIG.MARKETS.map(scoreMarket).sort((a,b) => b.opportunity - a.opportunity);
    const top3 = results.slice(0,3).map((market,index) => ({ rank:index+1, ...market }));
    lastScan = { timestamp:Date.now(), markets:results, top3 };
    window.dispatchEvent(new CustomEvent("scanner:update", { detail:lastScan }));
    return lastScan;
  }

  function start() { if (!timer) { timer=setInterval(scan,CONFIG.SCAN_INTERVAL_MS); scan(); } }
  function stop() { clearInterval(timer); timer=null; }

  window.addEventListener("deriv:history", e => { load(e.detail.symbol,e.detail.ticks); scan(); });
  window.addEventListener("deriv:tick", e => { push(e.detail.symbol,e.detail); scan(); });

  return { start, stop, scan, getSnapshot:()=>lastScan, getMarketHistory:symbol=>[...(books.get(symbol)||[])], scoreHistory:(market,ticks)=>scoreBook(Array.isArray(ticks)?ticks:[],market) };
})();
