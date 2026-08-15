// statistics.js
// Statistical analysis layer for the Even/Odd analyzer.

const Statistics = (() => {
  const WINDOWS = [50, 100, 250, 500, 1000];

  function getTicks(count) {
    if (
      typeof EvenOdd === "undefined" ||
      typeof EvenOdd.getRecent !== "function"
    ) {
      return [];
    }

    return EvenOdd.getRecent(count);
  }

  function probability(even, odd) {
    const total = even + odd;

    if (total === 0) {
      return {
        even: 50,
        odd: 50
      };
    }

    return {
      even: (even / total) * 100,
      odd: (odd / total) * 100
    };
  }

  function windowStats(count) {
    const ticks = getTicks(count);

    const even = ticks.filter(
      tick => tick.type === "EVEN"
    ).length;

    const odd = ticks.filter(
      tick => tick.type === "ODD"
    ).length;

    const probs = probability(even, odd);

    return {
      window: count,
      samples: ticks.length,
      even,
      odd,
      evenProbability: probs.even,
      oddProbability: probs.odd,
      edge: Math.abs(
        probs.even - probs.odd
      )
    };
  }

  function allWindows() {
    const result = {};

    WINDOWS.forEach(windowSize => {
      result[windowSize] =
        windowStats(windowSize);
    });

    return result;
  }

  function calculateImbalance(count = 50) {
    const ticks = getTicks(count);

    if (ticks.length === 0) {
      return {
        value: 0,
        percentage: 0,
        direction: "NEUTRAL"
      };
    }

    const even = ticks.filter(
      tick => tick.type === "EVEN"
    ).length;

    const odd = ticks.length - even;

    const value = even - odd;

    const percentage =
      (value / ticks.length) * 100;

    let direction = "NEUTRAL";

    if (percentage > 0) {
      direction = "EVEN";
    } else if (percentage < 0) {
      direction = "ODD";
    }

    return {
      value,
      percentage,
      direction
    };
  }

  function calculateSwitchRate(count = 100) {
    const ticks = getTicks(count);

    if (ticks.length < 2) {
      return {
        switches: 0,
        observations: 0,
        rate: 0
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

    return {
      switches,
      observations,
      rate:
        (switches / observations) * 100
    };
  }

  function calculateEntropy(count = 100) {
    const ticks = getTicks(count);

    if (ticks.length === 0) {
      return 1;
    }

    const even =
      ticks.filter(
        tick => tick.type === "EVEN"
      ).length / ticks.length;

    const odd = 1 - even;

    let entropy = 0;

    if (even > 0) {
      entropy -=
        even * Math.log2(even);
    }

    if (odd > 0) {
      entropy -=
        odd * Math.log2(odd);
    }

    return entropy;
  }

  function calculateDigitDistribution(count = 100) {
    const ticks = getTicks(count);

    const digits = Array(10).fill(0);

    ticks.forEach(tick => {
      if (
        Number.isInteger(tick.digit) &&
        tick.digit >= 0 &&
        tick.digit <= 9
      ) {
        digits[tick.digit]++;
      }
    });

    const total = ticks.length;

    const percentages = digits.map(
      value =>
        total > 0
          ? (value / total) * 100
          : 0
    );

    return {
      counts: digits,
      percentages
    };
  }

  function calculateDigitEntropy(count = 100) {
    const distribution =
      calculateDigitDistribution(count);

    let entropy = 0;

    distribution.percentages.forEach(
      percentage => {
        if (percentage <= 0) {
          return;
        }

        const probability =
          percentage / 100;

        entropy -=
          probability *
          Math.log2(probability);
      }
    );

    return entropy;
  }

  function calculateStreakStats(count = 250) {
    const ticks = getTicks(count);

    if (ticks.length === 0) {
      return {
        currentType: null,
        currentLength: 0,
        longestEven: 0,
        longestOdd: 0
      };
    }

    let currentType =
      ticks[ticks.length - 1].type;

    let currentLength = 0;

    for (
      let i = ticks.length - 1;
      i >= 0;
      i--
    ) {
      if (ticks[i].type !== currentType) {
        break;
      }

      currentLength++;
    }

    let longestEven = 0;
    let longestOdd = 0;

    let runType = ticks[0].type;
    let runLength = 1;

    for (let i = 1; i < ticks.length; i++) {
      if (ticks[i].type === runType) {
        runLength++;
      } else {
        if (runType === "EVEN") {
          longestEven =
            Math.max(
              longestEven,
              runLength
            );
        } else {
          longestOdd =
            Math.max(
              longestOdd,
              runLength
            );
        }

        runType = ticks[i].type;
        runLength = 1;
      }
    }

    if (runType === "EVEN") {
      longestEven =
        Math.max(
          longestEven,
          runLength
        );
    } else {
      longestOdd =
        Math.max(
          longestOdd,
          runLength
        );
    }

    return {
      currentType,
      currentLength,
      longestEven,
      longestOdd
    };
  }

  function calculateConfidenceAlignment() {
    const windows = allWindows();

    let evenVotes = 0;
    let oddVotes = 0;
    let totalVotes = 0;

    WINDOWS.forEach(windowSize => {
      const stats =
        windows[windowSize];

      if (!stats || stats.samples === 0) {
        return;
      }

      if (
        stats.evenProbability >
        stats.oddProbability
      ) {
        evenVotes++;
      } else if (
        stats.oddProbability >
        stats.evenProbability
      ) {
        oddVotes++;
      }

      totalVotes++;
    });

    let direction = "NEUTRAL";

    if (evenVotes > oddVotes) {
      direction = "EVEN";
    } else if (oddVotes > evenVotes) {
      direction = "ODD";
    }

    const alignment =
      totalVotes > 0
        ? (Math.max(
            evenVotes,
            oddVotes
          ) /
            totalVotes) *
          100
        : 0;

    return {
      direction,
      evenVotes,
      oddVotes,
      totalVotes,
      alignment
    };
  }

  function calculateComposite(count = 100) {
    const window = windowStats(count);
    const imbalance =
      calculateImbalance(count);
    const entropy =
      calculateEntropy(count);
    const switchRate =
      calculateSwitchRate(count);

    return {
      window,
      imbalance,
      entropy,
      switchRate
    };
  }

  function getSnapshot() {
    return {
      windows: allWindows(),
      imbalance: calculateImbalance(50),
      switchRate: calculateSwitchRate(100),
      entropy: calculateEntropy(100),
      digitDistribution:
        calculateDigitDistribution(100),
      digitEntropy:
        calculateDigitEntropy(100),
      streaks:
        calculateStreakStats(250),
      alignment:
        calculateConfidenceAlignment(),
      composite:
        calculateComposite(100)
    };
  }

  return {
    WINDOWS,
    windowStats,
    allWindows,
    calculateImbalance,
    calculateSwitchRate,
    calculateEntropy,
    calculateDigitDistribution,
    calculateDigitEntropy,
    calculateStreakStats,
    calculateConfidenceAlignment,
    calculateComposite,
    getSnapshot
  };
})();

window.Statistics = Statistics;
