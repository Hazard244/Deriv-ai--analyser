// patterns.js
// Pattern and transition-analysis layer for Even/Odd.

const Patterns = (() => {
  const DEFAULT_WINDOW = 250;

  function getTicks(count = DEFAULT_WINDOW) {
    if (
      typeof EvenOdd === "undefined" ||
      typeof EvenOdd.getRecent !== "function"
    ) {
      return [];
    }

    return EvenOdd.getRecent(count);
  }

  function transitionMatrix(count = DEFAULT_WINDOW) {
    const ticks = getTicks(count);

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
        matrix[previous][current] !== undefined
      ) {
        matrix[previous][current]++;
      }
    }

    return matrix;
  }

  function transitionProbabilities(
    count = DEFAULT_WINDOW
  ) {
    const matrix = transitionMatrix(count);

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

    return {
      matrix,
      probabilities
    };
  }

  function markovForecast(count = DEFAULT_WINDOW) {
    const ticks = getTicks(count);

    if (ticks.length === 0) {
      return {
        currentState: null,
        nextEven: 50,
        nextOdd: 50,
        direction: "NEUTRAL",
        edge: 0
      };
    }

    const currentState =
      ticks[ticks.length - 1].type;

    const result =
      transitionProbabilities(count);

    const nextEven =
      result.probabilities[currentState].EVEN;

    const nextOdd =
      result.probabilities[currentState].ODD;

    let direction = "NEUTRAL";

    if (nextEven > nextOdd) {
      direction = "EVEN";
    } else if (nextOdd > nextEven) {
      direction = "ODD";
    }

    return {
      currentState,
      nextEven,
      nextOdd,
      direction,
      edge: Math.abs(nextEven - nextOdd),
      matrix: result.matrix
    };
  }

  function alternation(count = 50) {
    const ticks = getTicks(count);

    if (ticks.length < 2) {
      return {
        switches: 0,
        observations: 0,
        rate: 0,
        strength: 0,
        active: false
      };
    }

    let switches = 0;

    for (let i = 1; i < ticks.length; i++) {
      if (
        ticks[i].type !==
        ticks[i - 1].type
      ) {
        switches++;
      }
    }

    const observations = ticks.length - 1;

    const rate =
      (switches / observations) * 100;

    return {
      switches,
      observations,
      rate,
      strength: Math.abs(rate - 50) * 2,
      active: rate >= 65
    };
  }

  function repetition(count = 50) {
    const ticks = getTicks(count);

    if (ticks.length < 2) {
      return {
        repeats: 0,
        observations: 0,
        rate: 0,
        active: false
      };
    }

    let repeats = 0;

    for (let i = 1; i < ticks.length; i++) {
      if (
        ticks[i].type ===
        ticks[i - 1].type
      ) {
        repeats++;
      }
    }

    const observations = ticks.length - 1;

    const rate =
      (repeats / observations) * 100;

    return {
      repeats,
      observations,
      rate,
      active: rate >= 65
    };
  }

  function currentStreak() {
    const ticks = getTicks(1000);

    if (ticks.length === 0) {
      return {
        type: null,
        length: 0
      };
    }

    const type =
      ticks[ticks.length - 1].type;

    let length = 0;

    for (
      let i = ticks.length - 1;
      i >= 0;
      i--
    ) {
      if (ticks[i].type !== type) {
        break;
      }

      length++;
    }

    return {
      type,
      length
    };
  }

  function longestStreak(count = DEFAULT_WINDOW) {
    const ticks = getTicks(count);

    let longestEven = 0;
    let longestOdd = 0;

    let currentType = null;
    let currentLength = 0;

    for (const tick of ticks) {
      if (tick.type === currentType) {
        currentLength++;
      } else {
        currentType = tick.type;
        currentLength = 1;
      }

      if (currentType === "EVEN") {
        longestEven =
          Math.max(
            longestEven,
            currentLength
          );
      } else if (currentType === "ODD") {
        longestOdd =
          Math.max(
            longestOdd,
            currentLength
          );
      }
    }

    return {
      longestEven,
      longestOdd
    };
  }

  function streakPressure() {
    const streak = currentStreak();

    if (!streak.type || streak.length < 2) {
      return {
        type: streak.type,
        length: streak.length,
        pressure: 0,
        direction: "NEUTRAL"
      };
    }

    /*
      This is deliberately NOT treated as a guaranteed
      reversal signal. It only measures how unusual the
      current streak is relative to a simple baseline.
    */

    const pressure =
      Math.min(
        100,
        Math.max(
          0,
          (streak.length - 1) * 12
        )
      );

    return {
      type: streak.type,
      length: streak.length,
      pressure,
      direction:
        streak.type === "EVEN"
          ? "ODD"
          : "EVEN"
    };
  }

  function recentBias(shortWindow = 25, longWindow = 250) {
    const shortTicks = getTicks(shortWindow);
    const longTicks = getTicks(longWindow);

    function ratio(ticks, type) {
      if (ticks.length === 0) {
        return 50;
      }

      return (
        ticks.filter(
          tick => tick.type === type
        ).length /
        ticks.length
      ) * 100;
    }

    const shortEven =
      ratio(shortTicks, "EVEN");

    const longEven =
      ratio(longTicks, "EVEN");

    const shortOdd = 100 - shortEven;
    const longOdd = 100 - longEven;

    const evenShift =
      shortEven - longEven;

    const oddShift =
      shortOdd - longOdd;

    let direction = "NEUTRAL";

    if (evenShift > 3) {
      direction = "EVEN";
    } else if (oddShift > 3) {
      direction = "ODD";
    }

    return {
      shortWindow,
      longWindow,
      shortEven,
      shortOdd,
      longEven,
      longOdd,
      evenShift,
      oddShift,
      direction
    };
  }

  function sequenceScore(count = 100) {
    const alt = alternation(count);
    const rep = repetition(count);
    const markov = markovForecast(count);

    let score = 0;

    if (alt.active) {
      score += Math.min(
        35,
        (alt.rate - 50) * 0.7
      );
    }

    if (rep.active) {
      score -= Math.min(
        35,
        (rep.rate - 50) * 0.7
      );
    }

    score +=
      Math.min(
        30,
        markov.edge * 0.5
      );

    return Math.max(
      -100,
      Math.min(100, score)
    );
  }

  function getSnapshot() {
    return {
      markov: markovForecast(250),
      transitions: transitionMatrix(250),
      alternation: alternation(50),
      repetition: repetition(50),
      currentStreak: currentStreak(),
      longestStreak: longestStreak(250),
      streakPressure: streakPressure(),
      recentBias: recentBias(25, 250),
      sequenceScore: sequenceScore(100)
    };
  }

  return {
    transitionMatrix,
    transitionProbabilities,
    markovForecast,
    alternation,
    repetition,
    currentStreak,
    longestStreak,
    streakPressure,
    recentBias,
    sequenceScore,
    getSnapshot
  };
})();

window.Patterns = Patterns;
