/**
 * Even/Odd data engine.
 * Converts quotes to last digits and keeps per-market history.
 */
const EvenOdd = {
  histories: new Map(),

  reset(symbol) {
    this.histories.set(symbol, []);
  },

  history(symbol) {
    if (!this.histories.has(symbol)) this.histories.set(symbol, []);
    return this.histories.get(symbol);
  },

  seed(symbol, prices) {
    const h = [];
    for (const price of prices || []) {
      const digit = this.lastDigit(price);
      if (Number.isInteger(digit)) h.push(digit);
    }
    this.histories.set(symbol, h.slice(-CONFIG.MAX_HISTORY));
    return this.histories.get(symbol);
  },

  addTick(symbol, quote) {
    const digit = this.lastDigit(quote);
    if (!Number.isInteger(digit)) return null;
    const h = this.history(symbol);
    h.push(digit);
    if (h.length > CONFIG.MAX_HISTORY) h.splice(0, h.length - CONFIG.MAX_HISTORY);
    return digit;
  },

  lastDigit(quote) {
    if (quote === null || quote === undefined) return null;
    const text = String(quote);
    const digits = text.replace(/\D/g, "");
    if (!digits) return null;
    return Number(digits.at(-1));
  }
};
