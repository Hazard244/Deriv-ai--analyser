// signals.js
// Decision and signal-generation layer for Even/Odd.
// This layer does NOT place trades.

const Signals = (() => {
  const MIN_DATA = 50;

  const LEVELS = {
    WAIT: 0,
    PREPARE: 35,
    EARLY: 55,
    CONFIRMED: 70,
    HIGH: 85
  };

  function clamp(value, min = 0, max = 100) {
    return Math.max(
      min,
      Math.min(max, value)
    );
  }

  function getStatistics() {
    if (
      typeof Statistics === "undefined" ||
      typeof Statistics.getSnapshot !== "function"
    ) {
      return null;
    }

    return Statistics.getSnapshot();
  }

  function getPatterns() {
    if (
      typeof Patterns === "undefined" ||
      typeof Patterns.getSnapshot !== "function"
    ) {
      return null;
    }

    return Patterns.getSnapshot();
  }

  function getHistorySize() {
    if (
      typeof EvenOdd === "undefined" ||
      typeof EvenOdd.getHistory !== "function"
    ) {
      return 0;
    }

    return EvenOdd.getHistory().length;
  }

  function calculateWindowAlignment(stats) {
    if (!stats || !stats.windows) {
      return {
        direction: "NEUTRAL",
        alignment: 0,
        evenVotes: 0,
        oddVotes: 0,
        total: 0
      };
    }

    let evenVotes = 0;
    let oddVotes = 0;
    let total = 0;

    Object.values(stats.windows).forEach(window => {
      if (!window || window.samples < 10) {
        return;
      }

      if (
        window.evenProbability >
        window.oddProbability
      ) {
        evenVotes++;
      } else if (
        window.oddProbability >
        window.evenProbability
      ) {
        oddVotes++;
      }

      total++;
    });

    if (total === 0) {
      return {
        direction: "NEUTRAL",
        alignment: 0,
        evenVotes,
        oddVotes,
        total
      };
    }

    let direction = "NEUTRAL";

    if (evenVotes > oddVotes) {
      direction = "EVEN";
    } else if (oddVotes > evenVotes) {
      direction = "ODD";
    }

    const alignment =
      (
        Math.max(
          evenVotes,
          oddVotes
        ) / total
      ) * 100;

    return {
      direction,
      alignment,
      evenVotes,
      oddVotes,
      total
    };
  }

  function probabilityEdge(stats) {
    if (!stats || !stats.windows) {
      return {
        direction: "NEUTRAL",
        edge: 0,
        probability: 50
      };
    }

    const windows =
      Object.values(stats.windows)
        .filter(
          window => window.samples > 0
        );

    if (windows.length === 0) {
      return {
        direction: "NEUTRAL",
        edge: 0,
        probability: 50
      };
    }

    let evenTotal = 0;
    let oddTotal = 0;

    windows.forEach(window => {
      evenTotal +=
        window.evenProbability;

      oddTotal +=
        window.oddProbability;
    });

    const evenProbability =
      evenTotal / windows.length;

    const oddProbability =
      oddTotal / windows.length;

    const edge =
      Math.abs(
        evenProbability -
        oddProbability
      );

    let direction = "NEUTRAL";

    if (evenProbability > oddProbability) {
      direction = "EVEN";
    } else if (oddProbability > evenProbability) {
      direction = "ODD";
    }

    return {
      direction,
      edge,
      probability:
        Math.max(
          evenProbability,
          oddProbability
        ),
      evenProbability,
      oddProbability
    };
  }

  function scoreComponent(
    direction,
    candidate,
    points
  ) {
    if (
      !candidate ||
      candidate === "NEUTRAL"
    ) {
      return 0;
    }

    return candidate === direction
      ? points
      : -points;
  }

  function buildSignal() {
    const historySize = getHistorySize();
    const stats = getStatistics();
    const patterns = getPatterns();

    if (
      !stats ||
      !patterns ||
      historySize < MIN_DATA
    ) {
      return {
        level: "WAIT",
        direction: "NEUTRAL",
        score: 0,
        confidence: 0,
        reason: "Insufficient tick data.",
        historySize
      };
    }

    const alignment =
      calculateWindowAlignment(stats);

    const edge =
      probabilityEdge(stats);

    let evenScore = 0;
    let oddScore = 0;

    const reasons = [];
    const warnings = [];

    /*
      1. Multi-window alignment
      Maximum contribution: 25
    */

    if (alignment.direction === "EVEN") {
      evenScore +=
        alignment.alignment * 0.25;

      reasons.push(
        `${alignment.evenVotes}/${alignment.total} windows favor EVEN`
      );
    } else if (
      alignment.direction === "ODD"
    ) {
      oddScore +=
        alignment.alignment * 0.25;

      reasons.push(
        `${alignment.oddVotes}/${alignment.total} windows favor ODD`
      );
    } else {
      warnings.push(
        "Multi-window direction is mixed."
      );
    }

    /*
      2. Probability edge
      Maximum contribution: 25
    */

    const probabilityPoints =
      clamp(edge.edge * 1.25, 0, 25);

    if (edge.direction === "EVEN") {
      evenScore += probabilityPoints;
    } else if (
      edge.direction === "ODD"
    ) {
      oddScore += probabilityPoints;
    }

    if (edge.edge >= 8) {
      reasons.push(
        `${edge.direction} has ${edge.edge.toFixed(1)}% statistical edge`
      );
    }

    /*
      3. Imbalance
      Maximum contribution: 15
    */

    const imbalance =
      stats.imbalance;

    const imbalancePoints =
      clamp(
        Math.abs(
          imbalance.percentage
        ) * 0.75,
        0,
        15
      );

    if (imbalance.direction === "EVEN") {
      evenScore += imbalancePoints;
    } else if (
      imbalance.direction === "ODD"
    ) {
      oddScore += imbalancePoints;
    }

    /*
      4. Markov
      Maximum contribution: 15
    */

    const markov =
      patterns.markov;

    const markovEdge =
      Math.abs(
        markov.nextEven -
        markov.nextOdd
      );

    const markovPoints =
      clamp(
        markovEdge * 0.6,
        0,
        15
      );

    if (markov.direction === "EVEN") {
      evenScore += markovPoints;
    } else if (
      markov.direction === "ODD"
    ) {
      oddScore += markovPoints;
    }

    if (markovEdge >= 8) {
      reasons.push(
        `Markov model favors ${markov.direction}`
      );
    }

    /*
      5. Recent bias
      Maximum contribution: 10
    */

    const bias =
      patterns.recentBias;

    const biasPoints =
      clamp(
        Math.max(
          Math.abs(bias.evenShift),
          Math.abs(bias.oddShift)
        ) * 0.5,
        0,
        10
      );

    if (bias.direction === "EVEN") {
      evenScore += biasPoints;
    } else if (
      bias.direction === "ODD"
    ) {
      oddScore += biasPoints;
    }

    /*
      6. Sequence behavior
      Maximum contribution: 10
    */

    const sequenceScore =
      patterns.sequenceScore;

    if (sequenceScore > 0) {
      const candidate =
        patterns.markov.direction;

      if (candidate === "EVEN") {
        evenScore +=
          Math.min(
            10,
            sequenceScore * 0.1
          );
      } else if (
        candidate === "ODD"
      ) {
        oddScore +=
          Math.min(
            10,
            sequenceScore * 0.1
          );
      }
    }

    /*
      Determine winner.
    */

    const totalPossible = 100;

    const winner =
      evenScore > oddScore
        ? "EVEN"
        : oddScore > evenScore
        ? "ODD"
        : "NEUTRAL";

    const winningScore =
      winner === "EVEN"
        ? evenScore
        : winner === "ODD"
        ? oddScore
        : 0;

    const losingScore =
      winner === "EVEN"
        ? oddScore
        : winner === "ODD"
        ? evenScore
        : 0;

    const separation =
      Math.max(
        0,
        winningScore -
        losingScore
      );

    /*
      Entropy / randomness filter.
      High entropy means the distribution is
      closer to balanced and therefore provides
      less directional information.
    */

    const entropy =
      Number(stats.entropy);

    if (entropy >= 0.98) {
      warnings.push(
        "Distribution is highly balanced."
      );
    }

    /*
      Alternation/repetition conflict check.
    */

    const alternation =
      patterns.alternation;

    const repetition =
      patterns.repetition;

    if (
      alternation.active &&
      repetition.active
    ) {
      warnings.push(
        "Sequence structure is conflicting."
      );
    }

    /*
      Confidence.
      This is a model score, NOT a guaranteed
      probability of winning the next contract.
    */

    let confidence =
      winningScore;

    confidence +=
      Math.min(
        10,
        alignment.alignment * 0.1
      );

    confidence +=
      Math.min(
        5,
        separation * 0.1
      );

    if (entropy >= 0.98) {
      confidence -= 12;
    }

    if (
      warnings.includes(
        "Sequence structure is conflicting."
      )
    ) {
      confidence -= 8;
    }

    confidence =
      clamp(confidence);

    /*
      Signal level.
    */

    let level = "WAIT";

    if (
      historySize >= 50 &&
      confidence >= LEVELS.PREPARE
    ) {
      level = "PREPARE";
    }

    if (
      historySize >= 100 &&
      confidence >= LEVELS.EARLY &&
      separation >= 8
    ) {
      level = "EARLY";
    }

    if (
      historySize >= 250 &&
      confidence >= LEVELS.CONFIRMED &&
      alignment.alignment >= 60 &&
      separation >= 12
    ) {
      level = "CONFIRMED";
    }

    if (
      historySize >= 500 &&
      confidence >= LEVELS.HIGH &&
      alignment.alignment >= 80 &&
      separation >= 18 &&
      entropy < 0.98
    ) {
      level = "HIGH";
    }

    /*
      Prevent a directional signal when the
      competing scores are essentially tied.
    */

    if (
      winner === "NEUTRAL" ||
      separation < 5
    ) {
      level = "WAIT";
    }

    if (
      warnings.length >= 2 &&
      level !== "PREPARE"
    ) {
      level = "PREPARE";
    }

    const primaryReason =
      reasons.length > 0
        ? reasons.join(" • ")
        : "No strong alignment yet.";

    return {
      timestamp: Date.now(),
      level,
      direction:
        level === "WAIT"
          ? "NEUTRAL"
          : winner,
      score: Number(
        winningScore.toFixed(2)
      ),
      confidence: Number(
        confidence.toFixed(2)
      ),
      separation: Number(
        separation.toFixed(2)
      ),
      evenScore: Number(
        evenScore.toFixed(2)
      ),
      oddScore: Number(
        oddScore.toFixed(2)
      ),
      historySize,
      alignment,
      edge,
      entropy,
      reasons,
      warnings,
      reason: primaryReason
    };
  }

  function getSnapshot() {
    return buildSignal();
  }

  function emitSignal() {
    const signal = buildSignal();

    window.dispatchEvent(
      new CustomEvent(
        "signals:update",
        {
          detail: signal
        }
      )
    );

    return signal;
  }

  /*
    Recalculate whenever the Even/Odd engine
    receives a new tick.
  */

  window.addEventListener(
    "evenodd:update",
    () => {
      emitSignal();
    }
  );

  return {
    buildSignal,
    getSnapshot,
    emitSignal,
    LEVELS
  };
})();

window.Signals = Signals;
