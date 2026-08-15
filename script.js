(() => {
  const $ = id => document.getElementById(id);
  const fmt = (value, decimals = 1) =>
    Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : "--";

  let queued = false;

  function queueRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  function renderRanking(scan) {
    const container = $("ranking");
    if (!container || !scan) return;

    container.innerHTML = scan.top3.map(item => `
      <div class="rank">
        <span class="rank-number">#${item.rank}</span>
        <strong>${item.name}</strong>
        <span>${item.direction}</span>
        <span>${item.level}</span>
        <b>${fmt(item.opportunity)}</b>
      </div>
    `).join("");
  }

  function renderDeep(scan) {
    const container = $("deep");
    if (!container || !scan?.top3?.length) return;

    container.innerHTML = scan.top3.map(item => `
      <div class="deep-row">
        <strong>${item.name}</strong>
        <span>${item.direction}</span>
        <span>Align ${item.alignment}%</span>
        <span>Entropy ${fmt(item.entropy, 3)}</span>
        <span>Markov ${fmt(item.markovEdge)}%</span>
      </div>
    `).join("");
  }

  function render() {
    const scan = Scanner.getSnapshot();
    const signal = Signals.getSnapshot();
    const ai = AI.getState().last;
    const d = Deriv.getState();

    $("connection").textContent = d.connected
      ? d.streaming ? "Streaming all 10 markets" : "Connected"
      : "Disconnected";

    $("status").textContent =
      `${d.marketsLoaded}/${CONFIG.MARKETS.length} histories • ${d.ticksReceived} live ticks`;

    if (signal) {
      $("signal").textContent = signal.level;
      $("direction").textContent = signal.direction;
      $("confidence").textContent = fmt(signal.confidence);
      $("leader").textContent = signal.market || "--";
      $("opportunity").textContent = fmt(signal.opportunity);
      $("reason").textContent = signal.reason || "Scanning...";
    }

    $("regime").textContent = ai?.regime || "UNKNOWN";

    renderRanking(scan);
    renderDeep(scan);
  }

  window.addEventListener("deriv:status", queueRender);
  window.addEventListener("deriv:error", queueRender);
  window.addEventListener("deriv:history", queueRender);
  window.addEventListener("deriv:tick", queueRender);
  window.addEventListener("scanner:update", queueRender);
  window.addEventListener("signals:update", queueRender);
  window.addEventListener("ai:update", queueRender);

  document.addEventListener("DOMContentLoaded", () => {
    render();
    Deriv.connect();
    Scanner.start();
  });
})();
