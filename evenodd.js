// evenodd.js
// Core Even/Odd analysis engine.
// Receives historical and live ticks from deriv.js.

const EvenOdd = (() => {
  const MAX_HISTORY = 5000;

  let history = [];
  let currentSymbol = null;

  const listeners = new Set();

  function notify(type, data = {}) {
    const event = new CustomEvent(`evenodd:${type}`, {
      detail: data
    });

    window.dispatchEvent(event);

    listeners.forEach((listener) => {
      try {
        listener(type, data);
      } catch (error) {
        console.error("[EvenOdd] Listener error:", error);
      }
    });
  }

  function getLastDigit(price) {
    if (price === null || price === undefined) {
      return null;
    }

    const text = String(price);
    const digits = text.match(/\d/g);

    if (!digits || digits.length === 0) {
      return null;
    }

    return Number(digits[digits.length - 1]);
  }

  function classifyDigit(digit) {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      return null;
    }

    return digit % 2 === 0 ? "EVEN" : "ODD";
  }

  function normalizeTick(tick) {
    if (!tick) {
      return null;
    }

    const price = Number(tick.price);

    if (!Number.isFinite(price)) {
      return null;
    }

    const digit =
      Number.isInteger(tick.digit)
        ? tick.digit
        : getLastDigit(price);

    const type = classifyDigit(digit);

    if (type === null) {
      return null;
    }

    return {
      symbol: tick.symbol || currentSymbol,
      price,
      digit,
      type,
      epoch: Number(tick.epoch || tick.time) || Date.now() / 1000
    };
  }

  function addTick(rawTick) {
    const tick = normalizeTick(rawTick);

    if (!tick) {
      return null;
    }

    if (tick.symbol) {
      currentSymbol = tick.symbol;
    }

    history.push(tick);

    if (history.length > MAX_HISTORY) {
      history.splice(
        0,
        history.length - MAX_HISTORY
      );
    }

    notify("tick", tick);

    notify("update", getSnapshot());

    return tick;
  }

  function loadHistory(rawTicks, symbol = null) {
    if (!Array.isArray(rawTicks)) {
      return;
    }

    history = [];

    if (symbol) {
      currentSymbol = symbol;
    }

    rawTicks.forEach((tick) => {
      const normalized = normalizeTick({
        ...tick,
        symbol: tick.symbol || symbol
      });

      if (normalized) {
        history.push(normalized);
      }
    });

    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }

    notify("history", {
      symbol: currentSymbol,
      count: history.length
    });

    notify("update", getSnapshot());
  }

  function clear() {
    history = [];

    notify("clear", {
      symbol: currentSymbol
    });

    notify("update", getSnapshot());
  }

  function getHistory() {
    return [...history];
  }

  function getRecent(count = 50) {
    const n = Math.max(
      1,
      Math.min(Number(count) || 50, history.length)
    );

    return history.slice(-n);
  }

  function calculateWindow(count = 50) {
    const ticks = getRecent(count);

    if (ticks.length === 0) {
      return {
        count: 0,
        even: 0,
        odd: 0,
        evenProbability: 50,
        oddProbability: 50,
        edge: 0
      };
    }

    const even = ticks.filter(
      (tick) => tick.type === "EVEN"
    ).length;

    const odd = ticks.length - even;

    const evenProbability =
      (even / ticks.length) * 100;

    const oddProbability =
      (odd / ticks.length) * 100;

    return {
      count: ticks.length,
      even,
      odd,
      evenProbability,
      oddProbability,
      edge: Math.abs(
        evenProbability - oddProbability
      )
    };
  }

  function calculateStreak() {
    if (history.length === 0) {
      return {
        type: null,
        length: 0
      };
    }

    const lastType =
      history[history.length - 1].type;

    let length = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].type !== lastType) {
        break;
      }

      length++;
    }

    return {
      type: lastType,
      length
    };
  }

  function calculateTransitions(count = 250) {
    const ticks = getRecent(count);

    const matrix = {
      EVEN: {
        EVEN: 0,
        ODD: 0
      },
      ODD: {
        EVEN: 0,
        ODD: 0
      }
    };

    for (let i = 1; i < ticks.length; i++) {
      const previous = ticks[i - 1].type;
      const current = ticks[i].type;

      if (
        matrix[previous] &&
        Object.prototype.hasOwnProperty.call(
          matrix[previous],
          current
        )
      ) {
        matrix[previous][current]++;
      }
    }

    return matrix;
  }

  function calculateMarkov(count = 250) {
    const matrix = calculateTransitions(count);

    const probabilities = {
      EVEN: {
        EVEN: 50,
        ODD: 50
      },
      ODD: {
        EVEN: 50,
        ODD: 50
      }
    };

    for (const state of ["EVEN", "ODD"]) {
      const total =
        matrix[state].EVEN +
        matrix[state].ODD;

      if (total > 0) {
        probabilities[state].EVEN =
          (matrix[state].EVEN / total) * 100;

        probabilities[state].ODD =
          (matrix[state].ODD / total) * 100;
      }
    }

    const last =
      history.length > 0
        ? history[history.length - 1].type
        : null;

    return {
      matrix,
      probabilities,
      currentState: last,
      nextEvenProbability:
        last
          ? probabilities[last].EVEN
          : 50,
      nextOddProbability:
        last
          ? probabilities[last].ODD
          : 50
    };
  }

  function calculateMomentum(count = 25) {
    const ticks = getRecent(count);

    if (ticks.length < 2) {
      return {
        even: 0,
        odd: 0,
        direction: "NEUTRAL"
      };
    }

    const even =
      ticks.filter(
        (tick) => tick.type === "EVEN"
      ).length;

    const odd = ticks.length - even;

    const difference = even - odd;

    let direction = "NEUTRAL";

    if (difference > 0) {
      direction = "EVEN";
    } else if (difference < 0) {
      direction = "ODD";
    }

    return {
      even,
      odd,
      difference,
      direction
    };
  }

  function getSnapshot() {
    return {
      symbol: currentSymbol,
      totalTicks: history.length,
      lastTick:
        history.length > 0
          ? history[history.length - 1]
          : null,
      windows: {
        50: calculateWindow(50),
        100: calculateWindow(100),
        250: calculateWindow(250),
        500: calculateWindow(500),
        1000: calculateWindow(1000)
      },
      streak: calculateStreak(),
      momentum: calculateMomentum(25),
      markov: calculateMarkov(250)
    };
  }

  function setSymbol(symbol) {
    currentSymbol = symbol;
  }

  function getSymbol() {
    return currentSymbol;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  // Connect to Deriv's events.
  window.addEventListener(
    "deriv:history",
    (event) => {
      const data = event.detail || {};

      loadHistory(
        data.ticks || [],
        data.symbol || null
      );
    }
  );

  window.addEventListener(
    "deriv:tick",
    (event) => {
      addTick(event.detail);
    }
  );

  return {
    addTick,
    loadHistory,
    clear,
    getHistory,
    getRecent,
    calculateWindow,
    calculateStreak,
    calculateTransitions,
    calculateMarkov,
    calculateMomentum,
    getSnapshot,
    setSymbol,
    getSymbol,
    subscribe,
    getLastDigit,
    classifyDigit
  };
})();

window.EvenOdd = EvenOdd;
