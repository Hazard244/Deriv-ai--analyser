/**
 * Main UI/controller.
 */
const App = {
  lastTickAt: null,
  tickCount: 0,

  start() {
    this.buildMarkets();
    this.bindEvents();
    this.setConnectionStatus("READY", "offline");
    this.renderEmpty();
  },

  buildMarkets() {
    const select = document.getElementById("marketSelect");
    select.innerHTML = CONFIG.MARKETS.map(m =>
      `<option value="${m.symbol}">${m.name} — ${m.label}</option>`
    ).join("");
    select.value = CONFIG.MARKETS[0].symbol;
  },

  bindEvents() {
    document.getElementById("connectBtn").addEventListener("click", () => {
      if (DerivAPI.connected) DerivAPI.disconnect();
      else DerivAPI.connect();
      this.updateConnectButton();
    });

    document.getElementById("marketSelect").addEventListener("change", e => {
      const symbol = e.target.value;
      EvenOdd.reset(symbol);
      this.tickCount = 0;
      if (DerivAPI.connected) {
        DerivAPI.subscribeMarket(symbol);
        DerivAPI.requestHistory(symbol);
      }
      this.setMarketName(symbol);
      this.renderEmpty();
    });
  },

  onTick(tick) {
    this.tickCount++;
    this.lastTickAt = Date.now();
    this.render(tick.symbol, tick.quote, tick.digit, false);
    this.analyze(tick.symbol);
    this.updateConnectButton();
  },

  analyze(symbol) {
    const history = EvenOdd.history(symbol);
    const decision = AI.decide(history);
    this.renderDecision(decision);
    this.renderStats(decision);
    this.renderHistory(history);
  },

  render(symbol, quote, digit, seeded) {
    this.setMarketName(symbol);
    document.getElementById("price").textContent =
      quote === null || quote === undefined ? "—" : quote;
    document.getElementById("lastDigit").textContent =
      Number.isInteger(digit) ? digit : "—";
    document.getElementById("tickCount").textContent =
      EvenOdd.history(symbol).length.toLocaleString();
    document.getElementById("dataMode").textContent =
      seeded ? "HISTORICAL + LIVE" : "LIVE";
  },

  renderDecision(d) {
    document.getElementById("decision").textContent = d.label || "WAIT";
    document.getElementById("decisionLevel").textContent = d.decision || "WAIT";
    document.getElementById("confidence").textContent =
      `${Number(d.confidence || 50).toFixed(1)}%`;
    document.getElementById("score").textContent =
      `${Number(d.score || 0).toFixed(1)}/100`;
    document.getElementById("separation").textContent =
      `${Number(d.separation || 0).toFixed(1)}`;
    document.getElementById("reason").textContent =
      d.reasons?.length ? d.reasons.join(" • ") : "Waiting for enough evidence.";
    document.getElementById("agreement").textContent =
      `${Number(d.modelAgreement || 0).toFixed(0)}%`;
  },

  renderStats(d) {
    const w100 = d.stats?.windows?.[100];
    const w500 = d.stats?.windows?.[500];
    document.getElementById("even100").textContent =
      w100 ? `${w100.evenPct.toFixed(1)}%` : "—";
    document.getElementById("odd100").textContent =
      w100 ? `${w100.oddPct.toFixed(1)}%` : "—";
    document.getElementById("even500").textContent =
      w500 ? `${w500.evenPct.toFixed(1)}%` : "—";
    document.getElementById("odd500").textContent =
      w500 ? `${w500.oddPct.toFixed(1)}%` : "—";
    document.getElementById("momentum").textContent =
      `${Number(d.stats?.momentum || 0).toFixed(1)}`;
    document.getElementById("switchRate").textContent =
      `${Number(d.stats?.switchRate || 0).toFixed(1)}%`;
    document.getElementById("entropy").textContent =
      `${Number(d.stats?.entropy || 0).toFixed(3)}`;
    document.getElementById("streak").textContent =
      d.patterns?.streak ? `${d.patterns.streak.type} × ${d.patterns.streak.length}` : "—";
    document.getElementById("markov").textContent =
      d.patterns?.nextByMarkov
        ? `${d.patterns.nextByMarkov.direction} ${d.patterns.nextByMarkov.confidence.toFixed(1)}%`
        : "—";
  },

  renderHistory(history) {
    const el = document.getElementById("digitHistory");
    el.textContent = history.slice(-40).join(" ");
  },

  renderEmpty() {
    this.renderDecision({
      label: "WAIT",
      decision: "WAIT",
      confidence: 50,
      score: 0,
      separation: 0,
      reasons: ["Collecting tick history…"],
      modelAgreement: 0
    });
    ["even100","odd100","even500","odd500","momentum","switchRate","entropy","streak","markov"]
      .forEach(id => document.getElementById(id).textContent = "—");
    document.getElementById("digitHistory").textContent = "Waiting for ticks…";
  },

  setMarketName(symbol) {
    const market = CONFIG.MARKETS.find(m => m.symbol === symbol);
    document.getElementById("marketName").textContent = market?.name || symbol;
  },

  setConnectionStatus(text, className) {
    const el = document.getElementById("connectionStatus");
    el.textContent = text;
    el.className = `status ${className || ""}`;
    this.updateConnectButton();
  },

  updateConnectButton() {
    const btn = document.getElementById("connectBtn");
    btn.textContent = DerivAPI.connected ? "Disconnect" : "Connect";
  }
};

window.addEventListener("DOMContentLoaded", () => App.start());
