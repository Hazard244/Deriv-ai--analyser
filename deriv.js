const Deriv = (() => {
  const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(CONFIG.APP_ID)}`;
  const sockets = new Map();
  const reconnectTimers = new Map();
  const requestMarkets = new Map();
  let requestId = 0;
  let manualClose = false;

  const state = {
    connected: false,
    loading: false,
    streaming: false,
    marketsLoaded: 0,
    ticksReceived: 0,
    liveByMarket: {},
    connectedMarkets: 0,
    error: null
  };

  for (const market of CONFIG.MARKETS) {
    state.liveByMarket[market.symbol] = 0;
  }

  const emit = (name, detail = {}) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  function updateConnectionState() {
    state.connectedMarkets = [...sockets.values()]
      .filter(x => x.connected).length;

    state.connected = state.connectedMarkets > 0;
    state.streaming = [...sockets.values()]
      .some(x => x.streaming);

    state.loading = state.marketsLoaded < CONFIG.MARKETS.length;

    emit("deriv:state", { ...state, liveByMarket: { ...state.liveByMarket } });
  }

  function status(name, message) {
    emit("deriv:status", {
      status: name,
      message,
      ...state,
      liveByMarket: { ...state.liveByMarket }
    });
  }

  function lastDigit(price) {
    const digits = String(price).match(/\d/g);
    return digits ? Number(digits.at(-1)) : null;
  }

  function send(conn, payload) {
    if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) return null;

    const req_id = ++requestId;
    conn.ws.send(JSON.stringify({ ...payload, req_id }));
    return req_id;
  }

  function connectMarket(market) {
    if (manualClose) return;

    const existing = sockets.get(market.symbol);
    if (existing?.ws &&
        (existing.ws.readyState === WebSocket.OPEN ||
         existing.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const conn = {
      market,
      ws: null,
      connected: false,
      streaming: false,
      historyLoaded: false,
      reconnecting: false
    };

    sockets.set(market.symbol, conn);

    try {
      conn.ws = new WebSocket(WS_URL);
    } catch (error) {
      handleMarketError(conn, error);
      scheduleReconnect(market);
      return;
    }

    conn.ws.addEventListener("open", () => {
      conn.connected = true;
      conn.reconnecting = false;
      state.error = null;

      status(
        "connected",
        `${market.name} connected. Requesting history + live subscription...`
      );

      // IMPORTANT:
      // ticks_history with subscribe:1 returns the historical sample and
      // keeps the same subscription alive for subsequent live tick updates.
      send(conn, {
        ticks_history: market.symbol,
        end: "latest",
        count: CONFIG.HISTORY_TICKS,
        style: "ticks",
        subscribe: 1
      });

      updateConnectionState();
    });

    conn.ws.addEventListener("message", event => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      handleMessage(conn, data);
    });

    conn.ws.addEventListener("error", () => {
      handleMarketError(conn, new Error(`${market.name} WebSocket error.`));
    });

    conn.ws.addEventListener("close", () => {
      conn.connected = false;
      conn.streaming = false;
      updateConnectionState();

      emit("deriv:marketDisconnected", {
        symbol: market.symbol,
        name: market.name,
        ...state
      });

      if (!manualClose) scheduleReconnect(market);
    });
  }

  function connect() {
    manualClose = false;

    state.marketsLoaded = 0;
    state.ticksReceived = 0;
    state.error = null;

    for (const market of CONFIG.MARKETS) {
      state.liveByMarket[market.symbol] = 0;
      connectMarket(market);
    }

    status("connecting", `Opening ${CONFIG.MARKETS.length} independent market streams...`);
    updateConnectionState();
  }

  function handleMessage(conn, data) {
    const market = conn.market;

    if (data.error) {
      handleMarketError(
        conn,
        new Error(data.error.message || `${market.name} API error.`)
      );
      return;
    }

    if (data.history) {
      const prices = Array.isArray(data.history.prices)
        ? data.history.prices
        : [];

      const times = Array.isArray(data.history.times)
        ? data.history.times
        : [];

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
          time: epoch,
          source: "history"
        };
      }).filter(Boolean);

      if (!conn.historyLoaded) {
        conn.historyLoaded = true;
        state.marketsLoaded++;
      }

      emit("deriv:history", {
        symbol: market.symbol,
        name: market.name,
        ticks,
        loaded: state.marketsLoaded,
        total: CONFIG.MARKETS.length
      });

      updateConnectionState();

      // A successful history subscription is expected to produce subsequent
      // tick messages. Mark the stream as live immediately so the UI exposes
      // the state without falsely waiting for another request.
      conn.streaming = true;

      status(
        "streaming",
        `${market.name} history loaded; live subscription active.`
      );

      return;
    }

    if (data.tick) {
      const price = Number(data.tick.quote);
      if (!Number.isFinite(price)) return;

      const epoch = Number(data.tick.epoch) ||
        Math.floor(Date.now() / 1000);

      conn.streaming = true;
      state.ticksReceived++;
      state.liveByMarket[market.symbol]++;

      emit("deriv:tick", {
        symbol: market.symbol,
        name: market.name,
        price,
        digit: lastDigit(price),
        epoch,
        time: epoch,
        source: "live"
      });

      emit("deriv:liveActivity", {
        symbol: market.symbol,
        name: market.name,
        marketTicks: state.liveByMarket[market.symbol],
        totalTicks: state.ticksReceived
      });

      updateConnectionState();
    }
  }

  function handleMarketError(conn, error) {
    state.error = error?.message || "Unknown Deriv error.";

    emit("deriv:error", {
      symbol: conn.market.symbol,
      name: conn.market.name,
      message: state.error
    });

    status("error", `${conn.market.name}: ${state.error}`);
  }

  function scheduleReconnect(market) {
    if (manualClose) return;

    clearTimeout(reconnectTimers.get(market.symbol));

    const timer = setTimeout(() => {
      connectMarket(market);
    }, 3000);

    reconnectTimers.set(market.symbol, timer);

    emit("deriv:marketReconnecting", {
      symbol: market.symbol,
      name: market.name,
      delay: 3000
    });
  }

  function disconnectMarket(symbol) {
    const timer = reconnectTimers.get(symbol);
    if (timer) clearTimeout(timer);

    const conn = sockets.get(symbol);
    if (!conn) return;

    try {
      conn.ws?.close();
    } catch {}

    sockets.delete(symbol);
  }

  function disconnect() {
    manualClose = true;

    for (const timer of reconnectTimers.values()) {
      clearTimeout(timer);
    }
    reconnectTimers.clear();

    for (const symbol of [...sockets.keys()]) {
      disconnectMarket(symbol);
    }

    state.connected = false;
    state.loading = false;
    state.streaming = false;
    state.connectedMarkets = 0;

    emit("deriv:disconnected", {
      ...state,
      liveByMarket: { ...state.liveByMarket }
    });
  }

  return {
    connect,
    disconnect,
    getState: () => ({
      ...state,
      liveByMarket: { ...state.liveByMarket }
    })
  };
})();