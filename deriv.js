const Deriv = (() => {
  // Current Deriv public market-data endpoint. No token/app-id is required
  // for read-only public ticks/history.
  const WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let manualClose = false;
  let requestId = 0;
  const requestMap = new Map();

  const state = {
    connected: false,
    loading: true,
    streaming: false,
    marketsLoaded: 0,
    ticksReceived: 0,
    liveByMarket: {},
    connectedMarkets: 0,
    error: null,
    lastMessageType: null,
    lastUpdate: null,
    lastServerMessage: null,
    reconnects: 0
  };

  for (const market of CONFIG.MARKETS) {
    state.liveByMarket[market.symbol] = 0;
  }

  const emit = (name, detail = {}) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  const snapshot = () => ({
    ...state,
    liveByMarket: { ...state.liveByMarket }
  });

  function status(name, message) {
    emit("deriv:status", {
      status: name,
      message,
      ...snapshot()
    });
  }

  function updateState() {
    state.connected = !!ws && ws.readyState === WebSocket.OPEN;
    state.connectedMarkets = state.connected ? CONFIG.MARKETS.length : 0;
    state.streaming = state.ticksReceived > 0;
    state.loading = state.marketsLoaded < CONFIG.MARKETS.length;
    emit("deriv:state", snapshot());
  }

  function nextId() {
    requestId += 1;
    return requestId;
  }

  function send(payload, kind) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      fail("WebSocket is not open; request was not sent.");
      return null;
    }

    const req_id = nextId();
    requestMap.set(req_id, kind || "");
    ws.send(JSON.stringify({ ...payload, req_id }));
    return req_id;
  }

  function resetState() {
    state.marketsLoaded = 0;
    state.ticksReceived = 0;
    state.error = null;
    state.lastMessageType = null;
    state.lastServerMessage = null;

    for (const market of CONFIG.MARKETS) {
      state.liveByMarket[market.symbol] = 0;
    }

    requestMap.clear();
  }

  function connect() {
    manualClose = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    resetState();
    openSocket();
  }

  function openSocket() {
    if (manualClose) return;

    if (ws &&
        (ws.readyState === WebSocket.OPEN ||
         ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    status("connecting", "Connecting to Deriv public market-data WebSocket...");

    try {
      ws = new WebSocket(WS_URL);
    } catch (error) {
      fail(error?.message || "Unable to create WebSocket.");
      scheduleReconnect();
      return;
    }

    ws.addEventListener("open", onOpen);
    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", onError);
    ws.addEventListener("close", onClose);

    updateState();
  }

  function onOpen() {
    reconnectAttempt = 0;
    state.error = null;
    state.lastUpdate = Date.now();

    status(
      "connected",
      "Connected. Requesting 10 histories and one 10-market live tick subscription..."
    );

    // Load each market's historical 1000 ticks.
    for (const market of CONFIG.MARKETS) {
      send({
        ticks_history: market.symbol,
        end: "latest",
        count: CONFIG.HISTORY_TICKS,
        style: "ticks",
        subscribe: 0
      }, `history:${market.symbol}`);
    }

    // One live subscription for all ten symbols.
    // Deriv's ticks endpoint accepts a symbol array.
    send({
      ticks: CONFIG.MARKETS.map(m => m.symbol),
      subscribe: 1
    }, "ticks:all");

    updateState();
  }

  function onMessage(event) {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    state.lastUpdate = Date.now();
    state.lastMessageType = data.msg_type || (data.error ? "error" : "unknown");
    state.lastServerMessage = data.msg_type || "message";

    if (data.error) {
      const request = data.req_id
        ? requestMap.get(data.req_id)
        : null;

      const detail = request ? ` [${request}]` : "";

      fail(
        `${data.error.code || "API_ERROR"}: ` +
        `${data.error.message || "Deriv API error"}${detail}`
      );

      emit("deriv:error", {
        ...snapshot(),
        message: state.error
      });

      updateState();
      return;
    }

    if (data.msg_type === "history" && data.history) {
      handleHistory(data);
      return;
    }

    if (data.msg_type === "tick" && data.tick) {
      handleTick(data);
      return;
    }

    updateState();
  }

  function handleHistory(data) {
    const symbol = findHistorySymbol(data);

    const prices = Array.isArray(data.history?.prices)
      ? data.history.prices
      : [];

    const times = Array.isArray(data.history?.times)
      ? data.history.times
      : [];

    if (!symbol || !prices.length) {
      fail(
        `History response missing symbol/data ` +
        `(req ${data.req_id ?? "unknown"}).`
      );
      return;
    }

    const ticks = prices.map((value, index) => {
      const price = Number(value);
      if (!Number.isFinite(price)) return null;

      const epoch = Number(times[index]) || null;

      return {
        symbol,
        name: marketName(symbol),
        price,
        digit: lastDigit(price),
        epoch,
        time: epoch,
        source: "history"
      };
    }).filter(Boolean);

    const request = data.req_id
      ? requestMap.get(data.req_id)
      : "";

    if (typeof request === "string" && request.startsWith("history:")) {
      requestMap.set(data.req_id, "loaded");
      state.marketsLoaded++;
    }

    emit("deriv:history", {
      symbol,
      name: marketName(symbol),
      ticks,
      loaded: state.marketsLoaded,
      total: CONFIG.MARKETS.length
    });

    status(
      "history",
      `${marketName(symbol)} history loaded ` +
      `(${ticks.length} ticks) — ` +
      `${state.marketsLoaded}/${CONFIG.MARKETS.length}`
    );

    updateState();
  }

  function findHistorySymbol(data) {
    const request = data.req_id
      ? requestMap.get(data.req_id)
      : "";

    if (typeof request === "string" && request.startsWith("history:")) {
      return request.slice("history:".length);
    }

    if (data.echo_req?.ticks_history) {
      return data.echo_req.ticks_history;
    }

    if (data.history?.symbol) {
      return data.history.symbol;
    }

    return null;
  }

  function handleTick(data) {
    const symbol = data.tick?.symbol || findTickSymbol(data);

    if (!symbol ||
        !CONFIG.MARKETS.some(m => m.symbol === symbol)) {
      return;
    }

    const price = Number(data.tick.quote);
    if (!Number.isFinite(price)) return;

    const epoch =
      Number(data.tick.epoch) ||
      Math.floor(Date.now() / 1000);

    state.ticksReceived++;
    state.liveByMarket[symbol]++;

    emit("deriv:tick", {
      symbol,
      name: marketName(symbol),
      price,
      digit: lastDigit(price),
      epoch,
      time: epoch,
      source: "live"
    });

    emit("deriv:liveActivity", {
      symbol,
      name: marketName(symbol),
      marketTicks: state.liveByMarket[symbol],
      totalTicks: state.ticksReceived
    });

    status(
      "streaming",
      `${marketName(symbol)} live tick received — ` +
      `${state.ticksReceived} total`
    );

    updateState();
  }

  function findTickSymbol(data) {
    if (data.echo_req?.ticks) {
      return Array.isArray(data.echo_req.ticks)
        ? data.echo_req.ticks[0]
        : data.echo_req.ticks;
    }

    return null;
  }

  function lastDigit(price) {
    const digits = String(price).match(/\d/g);
    return digits ? Number(digits.at(-1)) : null;
  }

  function marketName(symbol) {
    return CONFIG.MARKETS.find(m => m.symbol === symbol)?.name || symbol;
  }

  function fail(message) {
    state.error = String(message);
    status("error", state.error);
  }

  function onError() {
    fail("WebSocket transport error. Waiting for reconnect...");
  }

  function onClose(event) {
    state.connected = false;
    state.streaming = false;
    updateState();

    if (!manualClose) {
      status(
        "disconnected",
        `WebSocket closed (code ${event?.code ?? "unknown"}).`
      );
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (manualClose || reconnectTimer) return;

    reconnectAttempt++;
    state.reconnects++;

    const delay = Math.min(
      10000,
      1000 * Math.max(1, reconnectAttempt)
    );

    status(
      "reconnecting",
      `Reconnecting in ${Math.round(delay / 1000)}s...`
    );

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
  }

  function disconnect() {
    manualClose = true;

    clearTimeout(reconnectTimer);
    reconnectTimer = null;

    try {
      ws?.close();
    } catch {}

    ws = null;
    state.connected = false;
    state.streaming = false;
    state.connectedMarkets = 0;

    emit("deriv:disconnected", snapshot());
  }

  return {
    connect,
    disconnect,
    getState: snapshot
  };
})();
