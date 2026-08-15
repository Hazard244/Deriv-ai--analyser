const EvenOdd = (() => {
  let history = [];
  let symbol = null;

  const emitUpdate = () => {
    window.dispatchEvent(
      new CustomEvent("evenodd:update", {
        detail: getSnapshot()
      })
    );
  };

  function extractDigit(price) {
    const digits = String(price).match(/\d/g);
    return digits ? Number(digits[digits.length - 1]) : null;
  }

  function classifyDigit(digit) {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null;
    return digit % 2 === 0 ? "EVEN" : "ODD";
  }

  function normalizeTick(tick) {
    if (!tick) return null;

    const price = Number(tick.price);
    if (!Number.isFinite(price)) return null;

    const digit = Number.isInteger(tick.digit)
      ? tick.digit
      : extractDigit(price);

    const type = classifyDigit(digit);
    if (!type) return null;

    return {
      symbol: tick.symbol || symbol,
      price,
      digit,
      type,
      epoch: Number(tick.epoch || tick.time) || Math.floor(Date.now() / 1000),
      time: Number(tick.time || tick.epoch) || Math.floor(Date.now() / 1000)
    };
  }

  function loadHistory(ticks, nextSymbol = null) {
    history = [];
    symbol = nextSymbol || symbol;

    (Array.isArray(ticks) ? ticks : []).forEach(tick => {
      const normalized = normalizeTick({
        ...tick,
        symbol: tick.symbol || symbol
      });

      if (normalized) history.push(normalized);
    });

    history = history.slice(-CONFIG.MAX_HISTORY);
    emitUpdate();
  }

  function addTick(tick) {
    const normalized = normalizeTick(tick);
    if (!normalized) return null;

    symbol = normalized.symbol || symbol;
    history.push(normalized);

    if (history.length > CONFIG.MAX_HISTORY) {
      history.splice(0, history.length - CONFIG.MAX_HISTORY);
    }

    emitUpdate();
    return normalized;
  }

  function recent(count = 50) {
    const n = Math.max(0, Number(count) || 50);
    return history.slice(-n);
  }

  function windowStats(count = 50) {
    const ticks = recent(count);
    const even = ticks.filter(t => t.type === "EVEN").length;
    const odd = ticks.length - even;

    return {
      samples: ticks.length,
      even,
      odd,
      evenProbability: ticks.length ? (even / ticks.length) * 100 : 50,
      oddProbability: ticks.length ? (odd / ticks.length) * 100 : 50
    };
  }

  function streak() {
    if (!history.length) return { type: null, length: 0 };

    const currentType = history[history.length - 1].type;
    let length = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].type !== currentType) break;
      length++;
    }

    return { type: currentType, length };
  }

  function markov(count = 250) {
    const ticks = recent(count);
    const matrix = {
      EVEN: { EVEN: 0, ODD: 0 },
      ODD: { EVEN: 0, ODD: 0 }
    };

    for (let i = 1; i < ticks.length; i++) {
      matrix[ticks[i - 1].type][ticks[i].type]++;
    }

    const probabilities = {
      EVEN: { EVEN: 50, ODD: 50 },
      ODD: { EVEN: 50, ODD: 50 }
    };

    for (const state of ["EVEN", "ODD"]) {
      const total = matrix[state].EVEN + matrix[state].ODD;
      if (total) {
        probabilities[state].EVEN = (matrix[state].EVEN / total) * 100;
        probabilities[state].ODD = (matrix[state].ODD / total) * 100;
      }
    }

    const currentState = ticks.at(-1)?.type || null;

    return {
      matrix,
      currentState,
      nextEven: currentState ? probabilities[currentState].EVEN : 50,
      nextOdd: currentState ? probabilities[currentState].ODD : 50
    };
  }

  function getSnapshot() {
    return {
      symbol,
      totalTicks: history.length,
      lastTick: history.at(-1) || null,
      windows: Object.fromEntries(
        CONFIG.WINDOWS.map(n => [n, windowStats(n)])
      ),
      streak: streak(),
      markov: markov()
    };
  }

  window.addEventListener("deriv:history", event => {
    loadHistory(event.detail?.ticks || [], event.detail?.symbol || null);
  });

  window.addEventListener("deriv:tick", event => {
    addTick(event.detail);
  });

  return {
    loadHistory,
    addTick,
    recent,
    windowStats,
    streak,
    markov,
    getSnapshot,
    getHistory: () => [...history],
    getLastDigit: extractDigit,
    classifyDigit
  };
})();
