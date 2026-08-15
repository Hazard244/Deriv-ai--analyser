/**
 * Deriv public market-data connector.
 * No API token or account authorization is used.
 * This analyzer is read-only and cannot place trades.
 */
const DerivAPI = {
  ws: null,
  connected: false,
  selectedSymbol: CONFIG.MARKETS[0].symbol,
  subscriptions: new Map(),
  reconnectTimer: null,
  reconnectDelay: CONFIG.API.RECONNECT_DELAY_MS,
  manuallyStopped: false,
  requestId: 0,

  init(symbol) {
    this.selectedSymbol = symbol || this.selectedSymbol;
  },

  connect() {
    this.manuallyStopped = false;
    this.clearReconnect();
    this.setStatus("CONNECTING", "connecting");

    try {
      this.ws = new WebSocket(CONFIG.API.URL);
    } catch (error) {
      this.handleError(error);
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = CONFIG.API.RECONNECT_DELAY_MS;
      this.setStatus("CONNECTED", "connected");
      this.subscribeMarket(this.selectedSymbol);
      this.requestHistory(this.selectedSymbol);
    };

    this.ws.onmessage = event => this.handleMessage(event.data);

    this.ws.onerror = error => this.handleError(error);

    this.ws.onclose = () => {
      this.connected = false;
      this.setStatus("DISCONNECTED", "offline");
      if (!this.manuallyStopped) this.scheduleReconnect();
    };
  },

  disconnect() {
    this.manuallyStopped = true;
    this.clearReconnect();
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
    this.ws = null;
    this.connected = false;
    this.setStatus("STOPPED", "offline");
  },

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  },

  subscribeMarket(symbol) {
    this.unsubscribeAll();
    this.selectedSymbol = symbol;
    const req = ++this.requestId;
    if (this.send({ ticks: symbol, subscribe: 1, req_id: req })) {
      this.subscriptions.set("ticks", symbol);
    }
  },

  requestHistory(symbol) {
    const req = ++this.requestId;
    this.send({
      ticks_history: symbol,
      end: "latest",
      count: CONFIG.HISTORY_LOAD,
      style: "ticks",
      subscribe: 0,
      req_id: req
    });
  },

  unsubscribeAll() {
    if (this.subscriptions.size) {
      this.send({ forget_all: "ticks", req_id: ++this.requestId });
      this.subscriptions.clear();
    }
  },

  handleMessage(raw) {
    let data;
    try { data = JSON.parse(raw); }
    catch { return; }

    if (data.error) {
      this.setStatus(`ERROR: ${data.error.message || "Deriv error"}`, "error");
      return;
    }

    if (data.msg_type === "history" && data.history) {
      const symbol = data.echo_req?.ticks_history || this.selectedSymbol;
      const prices = data.history.prices || [];
      EvenOdd.seed(symbol, prices);
      App.render(symbol, prices.at(-1), null, true);
      App.analyze(symbol);
      return;
    }

    if (data.msg_type === "tick" && data.tick) {
      const symbol = data.tick.symbol || this.selectedSymbol;
      const quote = data.tick.quote;
      const epoch = data.tick.epoch;
      const digit = EvenOdd.addTick(symbol, quote);

      App.onTick({
        symbol,
        quote,
        epoch,
        digit
      });
    }
  },

  handleError(error) {
    if (CONFIG.APP.DEBUG) console.error("Deriv WebSocket error:", error);
    this.setStatus("CONNECTION ERROR", "error");
  },

  scheduleReconnect() {
    if (this.reconnectTimer || this.manuallyStopped) return;
    const delay = this.reconnectDelay;
    this.setStatus(`RECONNECTING IN ${Math.ceil(delay / 1000)}s`, "connecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectDelay = Math.min(
      CONFIG.API.MAX_RECONNECT_DELAY_MS,
      Math.round(this.reconnectDelay * 1.7)
    );
  },

  clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  },

  setStatus(text, className) {
    App.setConnectionStatus(text, className);
  }
};
