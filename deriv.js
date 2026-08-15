const Deriv = (() => {
  const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(CONFIG.APP_ID)}`;
  let ws = null;
  let reconnectTimer = null;
  let manualClose = false;
  let requestId = 0;
  let historyRequests = new Map();

  const state = {
    connected: false,
    loading: false,
    streaming: false,
    marketsLoaded: 0,
    ticksReceived: 0,
    error: null
  };

  const emit = (name, detail = {}) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  function status(name, message) {
    emit("deriv:status", { status: name, message, ...state });
  }

  function lastDigit(price) {
    const digits = String(price).match(/\d/g);
    return digits ? Number(digits.at(-1)) : null;
  }

  function send(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return null;
    const req_id = ++requestId;
    ws.send(JSON.stringify({ ...payload, req_id }));
    return req_id;
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    manualClose = false;
    status("connecting", "Connecting to Deriv...");

    try {
      ws = new WebSocket(WS_URL);
    } catch (error) {
      handleError(error);
      scheduleReconnect();
      return;
    }

    ws.addEventListener("open", () => {
      state.connected = true;
      state.error = null;
      state.marketsLoaded = 0;
      state.ticksReceived = 0;
      status("connected", "Connected. Loading all 10 markets...");
      requestAllHistory();
    });

    ws.addEventListener("message", event => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      handleMessage(data);
    });

    ws.addEventListener("error", () => {
      handleError(new Error("Deriv WebSocket error."));
    });

    ws.addEventListener("close", () => {
      state.connected = false;
      state.loading = false;
      state.streaming = false;
      emit("deriv:disconnected", { ...state });
      if (!manualClose) scheduleReconnect();
    });
  }

  function requestAllHistory() {
    state.loading = true;
    state.marketsLoaded = 0;
    historyRequests.clear();

    for (const market of CONFIG.MARKETS) {
      const req_id = send({
        ticks_history: market.symbol,
        end: "latest",
        count: CONFIG.HISTORY_TICKS,
        style: "ticks"
      });

      if (req_id) historyRequests.set(req_id, market);
    }

    status("loading", `Loading ${CONFIG.HISTORY_TICKS} ticks × ${CONFIG.MARKETS.length} markets...`);
  }

  function subscribeAll() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    send({ forget_all: "ticks" });

    for (const market of CONFIG.MARKETS) {
      send({ ticks: market.symbol, subscribe: 1 });
    }

    state.streaming = true;
    status("streaming", "Streaming all 10 Volatility Indices.");
  }

  function handleMessage(data) {
    if (data.error) {
      handleError(new Error(data.error.message || "Deriv API error."));
      return;
    }

    if (data.history) {
      const market = historyRequests.get(data.req_id) ||
        CONFIG.MARKETS.find(m => m.symbol === data.echo_req?.ticks_history);

      if (!market) return;

      const prices = Array.isArray(data.history.prices) ? data.history.prices : [];
      const times = Array.isArray(data.history.times) ? data.history.times : [];

      const ticks = prices.map((value, index) => {
        const price = Number(value);
        if (!Number.isFinite(price)) return null;

        const epoch = Number(times[index]) || null;

        return {
          symbol: market.symbol,
          name: market.name,
          price,
          digit: lastDigit(price),
          epoch,
          time: epoch
        };
      }).filter(Boolean);

      state.marketsLoaded++;
      emit("deriv:history", {
        symbol: market.symbol,
        name: market.name,
        ticks,
        loaded: state.marketsLoaded,
        total: CONFIG.MARKETS.length
      });

      if (state.marketsLoaded >= CONFIG.MARKETS.length) {
        state.loading = false;
        subscribeAll();
      }
      return;
    }

    if (data.tick) {
      const symbol = data.tick.symbol;
      const market = CONFIG.MARKETS.find(m => m.symbol === symbol);
      if (!market) return;

      const price = Number(data.tick.quote);
      if (!Number.isFinite(price)) return;

      const epoch = Number(data.tick.epoch) || Math.floor(Date.now() / 1000);

      state.ticksReceived++;

      emit("deriv:tick", {
        symbol,
        name: market.name,
        price,
        digit: lastDigit(price),
        epoch,
        time: epoch
      });
    }
  }

  function handleError(error) {
    state.error = error?.message || "Unknown Deriv error.";
    emit("deriv:error", { message: state.error });
    status("error", state.error);
  }

  function scheduleReconnect() {
    if (manualClose) return;

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
    status("reconnecting", "Connection lost. Retrying in 3 seconds...");
  }

  function disconnect() {
    manualClose = true;
    clearTimeout(reconnectTimer);

    try {
      if (ws?.readyState === WebSocket.OPEN) send({ forget_all: "ticks" });
      ws?.close();
    } catch {}

    ws = null;
    state.connected = false;
    state.loading = false;
    state.streaming = false;
  }

  return {
    connect,
    disconnect,
    getState: () => ({ ...state })
  };
})();
