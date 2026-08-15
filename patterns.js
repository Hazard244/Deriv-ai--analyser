/**
 * Pattern and transition engine.
 */
const Patterns = {
  analyze(digits) {
    const transitions = this.transitionProbabilities(digits);
    const streak = this.streak(digits);
    const alternation = this.alternation(digits, 30);

    return {
      streak,
      transitions,
      alternation,
      exhaustion: streak.length >= 6,
      nextByMarkov: this.markovPrediction(digits, transitions)
    };
  },

  parity(d) {
    return d % 2 === 0 ? "E" : "O";
  },

  streak(digits) {
    if (!digits.length) return { type: "NONE", length: 0 };
    const type = this.parity(digits.at(-1));
    let length = 1;
    for (let i = digits.length - 2; i >= 0; i--) {
      if (this.parity(digits[i]) === type) length++;
      else break;
    }
    return { type, length };
  },

  transitionProbabilities(digits) {
    const counts = { EE: 0, EO: 0, OE: 0, OO: 0 };
    for (let i = 1; i < digits.length; i++) {
      const key = this.parity(digits[i - 1]) + this.parity(digits[i]);
      counts[key]++;
    }
    const eTotal = counts.EE + counts.EO;
    const oTotal = counts.OE + counts.OO;
    return {
      counts,
      fromEven: {
        even: eTotal ? counts.EE / eTotal * 100 : 50,
        odd: eTotal ? counts.EO / eTotal * 100 : 50
      },
      fromOdd: {
        even: oTotal ? counts.OE / oTotal * 100 : 50,
        odd: oTotal ? counts.OO / oTotal * 100 : 50
      }
    };
  },

  markovPrediction(digits, t) {
    if (!digits.length) return { direction: "NEUTRAL", confidence: 50 };
    const last = this.parity(digits.at(-1));
    const pEven = last === "E" ? t.fromEven.even : t.fromOdd.even;
    const pOdd = last === "E" ? t.fromEven.odd : t.fromOdd.odd;
    return pEven >= pOdd
      ? { direction: "EVEN", confidence: pEven }
      : { direction: "ODD", confidence: pOdd };
  },

  alternation(digits, size = 30) {
    const data = digits.slice(-size);
    if (data.length < 2) return 50;
    let changes = 0;
    for (let i = 1; i < data.length; i++) {
      changes += this.parity(data[i]) !== this.parity(data[i - 1]) ? 1 : 0;
    }
    return changes / (data.length - 1) * 100;
  }
};
