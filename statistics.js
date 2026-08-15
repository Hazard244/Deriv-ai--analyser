/**
 * Statistical feature engine.
 * All calculations are descriptive; none guarantees the next outcome.
 */
const Statistics = {
  analyze(digits) {
    const windows = {};
    for (const size of CONFIG.WINDOWS) {
      windows[size] = this.window(digits, size);
    }

    return {
      windows,
      momentum: this.momentum(digits, 30),
      imbalance: this.imbalance(digits, 50),
      switchRate: this.switchRate(digits, 100),
      entropy: this.entropy(digits, 100),
      digitEntropy: this.digitEntropy(digits, 100),
      parityVolatility: this.parityVolatility(digits, 50),
      sampleSize: digits.length
    };
  },

  window(digits, size) {
    const data = digits.slice(-size);
    const n = data.length;
    if (!n) {
      return { size, n: 0, even: 0, odd: 0, evenPct: 50, oddPct: 50, edge: 0 };
    }
    const even = data.filter(d => d % 2 === 0).length;
    const odd = n - even;
    const evenPct = even / n * 100;
    const oddPct = odd / n * 100;
    return {
      size, n, even, odd,
      evenPct, oddPct,
      edge: Math.abs(evenPct - oddPct)
    };
  },

  momentum(digits, size = 30) {
    const data = digits.slice(-size);
    if (!data.length) return 0;
    const weighted = data.reduce((sum, d, i) => {
      const weight = i + 1;
      return sum + (d % 2 === 0 ? weight : -weight);
    }, 0);
    const max = data.reduce((sum, _, i) => sum + i + 1, 0);
    return max ? weighted / max * 100 : 0;
  },

  imbalance(digits, size = 50) {
    const w = this.window(digits, size);
    return w.n ? (w.even - w.odd) / w.n * 100 : 0;
  },

  switchRate(digits, size = 100) {
    const data = digits.slice(-size);
    if (data.length < 2) return 50;
    let switches = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] % 2) !== (data[i - 1] % 2)) switches++;
    }
    return switches / (data.length - 1) * 100;
  },

  entropy(digits, size = 100) {
    const data = digits.slice(-size);
    if (data.length < 2) return 1;
    const p = this.switchRate(data, data.length) / 100;
    if (p <= 0 || p >= 1) return 0;
    return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  },

  digitEntropy(digits, size = 100) {
    const data = digits.slice(-size);
    if (!data.length) return 1;
    const counts = Array(10).fill(0);
    data.forEach(d => counts[d]++);
    let h = 0;
    for (const c of counts) {
      if (!c) continue;
      const p = c / data.length;
      h -= p * Math.log2(p);
    }
    return h / Math.log2(10);
  },

  parityVolatility(digits, size = 50) {
    const data = digits.slice(-size);
    if (data.length < 2) return 0;
    let changes = 0;
    for (let i = 1; i < data.length; i++) {
      changes += Math.abs(data[i] - data[i - 1]);
    }
    return changes / (data.length - 1);
  }
};
