const Patterns = (() => {
  function recent(n = 250) { return EvenOdd.recent(n); }

  function transitions(n = 250) {
    const a = recent(n);
    const matrix = {
      EVEN: { EVEN: 0, ODD: 0 },
      ODD: { EVEN: 0, ODD: 0 }
    };

    for (let i = 1; i < a.length; i++) {
      matrix[a[i - 1].type][a[i].type]++;
    }

    return matrix;
  }

  function markov(n = 250) {
    const matrix = transitions(n);
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

    const currentState = EvenOdd.streak().type;
    const nextEven = currentState ? probabilities[currentState].EVEN : 50;
    const nextOdd = currentState ? probabilities[currentState].ODD : 50;

    return {
      currentState,
      nextEven,
      nextOdd,
      edge: Math.abs(nextEven - nextOdd),
      direction: nextEven > nextOdd ? "EVEN" : nextOdd > nextEven ? "ODD" : "NEUTRAL"
    };
  }

  function sequence(n = 100) {
    const a = recent(n);
    if (a.length < 2) return { alternation: 0, repetition: 0 };

    let switches = 0;
    for (let i = 1; i < a.length; i++) {
      if (a[i].type !== a[i - 1].type) switches++;
    }

    const observations = a.length - 1;

    return {
      alternation: (switches / observations) * 100,
      repetition: ((observations - switches) / observations) * 100
    };
  }

  function bias(shortWindow = 25, longWindow = 250) {
    const short = recent(shortWindow);
    const long = recent(longWindow);

    const ratio = (items, type) =>
      items.length
        ? (items.filter(x => x.type === type).length / items.length) * 100
        : 50;

    const shortEven = ratio(short, "EVEN");
    const longEven = ratio(long, "EVEN");
    const shortOdd = 100 - shortEven;
    const longOdd = 100 - longEven;

    const evenShift = shortEven - longEven;
    const oddShift = shortOdd - longOdd;

    return {
      shortEven,
      shortOdd,
      longEven,
      longOdd,
      evenShift,
      oddShift,
      direction: evenShift > 3 ? "EVEN" : oddShift > 3 ? "ODD" : "NEUTRAL"
    };
  }

  function getSnapshot() {
    return {
      markov: markov(),
      sequence: sequence(),
      streak: EvenOdd.streak(),
      bias: bias(),
      transitions: transitions()
    };
  }

  return {
    transitions,
    markov,
    sequence,
    bias,
    getSnapshot
  };
})();
