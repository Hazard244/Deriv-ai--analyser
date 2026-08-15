const Statistics = (() => {
  function ticks(n = 100) { return EvenOdd.recent(n); }

  function entropy(n = 100) {
    const a = ticks(n);
    if (!a.length) return 1;

    const even = a.filter(x => x.type === "EVEN").length / a.length;
    const odd = 1 - even;

    return (even ? -even * Math.log2(even) : 0) +
           (odd ? -odd * Math.log2(odd) : 0);
  }

  function imbalance(n = 50) {
    const a = ticks(n);
    const even = a.filter(x => x.type === "EVEN").length;
    const odd = a.length - even;
    const percentage = a.length ? ((even - odd) / a.length) * 100 : 0;

    return {
      value: even - odd,
      percentage,
      direction: percentage > 0 ? "EVEN" : percentage < 0 ? "ODD" : "NEUTRAL"
    };
  }

  function switchRate(n = 100) {
    const a = ticks(n);
    if (a.length < 2) return { rate: 0, switches: 0, observations: 0 };

    let switches = 0;
    for (let i = 1; i < a.length; i++) {
      if (a[i].type !== a[i - 1].type) switches++;
    }

    return {
      rate: (switches / (a.length - 1)) * 100,
      switches,
      observations: a.length - 1
    };
  }

  function digitDistribution(n = 100) {
    const a = ticks(n);
    const counts = Array(10).fill(0);

    a.forEach(tick => {
      if (Number.isInteger(tick.digit)) counts[tick.digit]++;
    });

    return {
      counts,
      percentages: counts.map(value => a.length ? (value / a.length) * 100 : 0)
    };
  }

  function alignment() {
    const windows = EvenOdd.getSnapshot().windows;
    let evenVotes = 0;
    let oddVotes = 0;
    let total = 0;

    Object.values(windows).forEach(window => {
      if (window.samples < 10) return;

      total++;

      if (window.evenProbability > window.oddProbability) evenVotes++;
      else if (window.oddProbability > window.evenProbability) oddVotes++;
    });

    return {
      evenVotes,
      oddVotes,
      total,
      direction: evenVotes > oddVotes ? "EVEN" : oddVotes > evenVotes ? "ODD" : "NEUTRAL",
      alignment: total ? (Math.max(evenVotes, oddVotes) / total) * 100 : 0
    };
  }

  function getSnapshot() {
    return {
      windows: EvenOdd.getSnapshot().windows,
      entropy: entropy(),
      imbalance: imbalance(),
      switchRate: switchRate(),
      digitDistribution: digitDistribution(),
      alignment: alignment()
    };
  }

  return {
    entropy,
    imbalance,
    switchRate,
    digitDistribution,
    alignment,
    getSnapshot
  };
})();
