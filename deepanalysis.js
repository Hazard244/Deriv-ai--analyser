const DeepAnalysis = (() => {
  function analyze(item) {
    if (!item) return null;

    const book = Scanner.getMarketHistory(item.symbol);
    const windows = Object.fromEntries(
      CONFIG.WINDOWS.map(n => {
        const a = book.slice(-n);
        const even = a.filter(t => t.digit % 2 === 0).length;
        const odd = a.length - even;
        return [n, {
          samples: a.length,
          even: a.length ? Number((even / a.length * 100).toFixed(1)) : 50,
          odd: a.length ? Number((odd / a.length * 100).toFixed(1)) : 50
        }];
      })
    );

    const consistency = CONFIG.WINDOWS
      .map(n => windows[n])
      .filter(w => w.samples)
      .map(w => w.even > w.odd ? "EVEN" : w.odd > w.even ? "ODD" : "NEUTRAL");

    const evenCount = consistency.filter(x => x === "EVEN").length;
    const oddCount = consistency.filter(x => x === "ODD").length;

    return {
      symbol: item.symbol,
      name: item.name,
      rank: item.rank,
      direction: item.direction,
      level: item.level,
      opportunity: item.opportunity,
      confidence: item.confidence,
      alignment: item.alignment,
      entropy: item.entropy,
      markovEdge: item.markovEdge,
      windows,
      dominantWindows: evenCount > oddCount ? "EVEN" : oddCount > evenCount ? "ODD" : "MIXED",
      consistency: Math.max(evenCount, oddCount) / Math.max(1, consistency.length) * 100,
      caution: item.entropy > 0.985
        ? "Near-balanced distribution; treat the setup as weak."
        : "No automatic trade instruction."
    };
  }

  function top3() {
    const scan = Scanner.getSnapshot();
    return scan ? scan.top3.map(analyze) : [];
  }

  return { analyze, top3 };
})();
