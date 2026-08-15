(() => {
  const $ = id => document.getElementById(id);
  const format = (value, decimals = 1) =>
    Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : "--";

  let renderQueued = false;

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;

    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function populateMarkets() {
    const select = $("market");
    if (!select) return;

    select.innerHTML = CONFIG.MARKETS
      .map(market => `<option value="${market.symbol}">${market.name}</option>`)
      .join("");

    select.value = CONFIG.MARKETS[0].symbol;
    select.addEventListener("change", () => {
      Deriv.changeMarket(select.value);
    });
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function render() {
    const snapshot = EvenOdd.getSnapshot();
    const stats = Statistics.getSnapshot();
    const patterns = Patterns.getSnapshot();
    const signal = Signals.getSnapshot();
    const ai = AI.getState().last;

    setText("status", `${snapshot.symbol || "--"} • ${snapshot.totalTicks} ticks`);
    setText("connection", Deriv.getState().connected
      ? Deriv.getState().streaming ? "Streaming" : "Connected"
      : "Disconnected");

    setText("price", snapshot.lastTick?.price ?? "--");
    setText("digit", snapshot.lastTick?.digit ?? "--");
    setText("level", signal.level);
    setText("direction", signal.direction);
    setText("confidence", format(signal.confidence));
    setText("regime", ai?.regime || "UNKNOWN");
    setText("even", format(stats.windows[50]?.evenProbability));
    setText("odd", format(stats.windows[50]?.oddProbability));
    setText("entropy", format(stats.entropy, 3));
    setText("markov", `${format(patterns.markov.nextEven)} / ${format(patterns.markov.nextOdd)}`);
    setText("reason", signal.reason || "Collecting data...");
  }

  window.addEventListener("deriv:status", queueRender);
  window.addEventListener("deriv:error", queueRender);
  window.addEventListener("deriv:history", queueRender);
  window.addEventListener("deriv:tick", queueRender);
  window.addEventListener("signals:update", queueRender);
  window.addEventListener("ai:update", queueRender);

  document.addEventListener("DOMContentLoaded", () => {
    populateMarkets();
    render();
    Deriv.connect(CONFIG.MARKETS[0].symbol);
  });
})();
