const Deriv = (() => {
  const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(CONFIG.APP_ID)}`;
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
    lastMessage: null,
    lastMessageType: null,
    lastUpdate: null,
    reconnects: 0
  };

  for (const market of CONFIG.MARKETS) state.liveByMarket[market.symbol] = 0;

  const emit = (name, detail = {}) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  function snapshot() {
    return { ...state, liveByMarket: { ...state.liveByMarket } };
  }

  function status(name, message) {
    emit("deriv:status", { status: name, message, ...snapshot() });
  }

  function updateState() {
    state.connected = !!ws && ws.readyState === WebSocket.OPEN;
    state.connectedMarkets = state.connected ? CONFIG.MARKETS.length : 0;
    state.streaming = Object.values(state.liveByMarket).some(v => v > 0);
    state.loading = state.marketsLoaded < CONFIG.MARKETS.length;
    emit("deriv:state", snapshot());
  }

  function nextId() {
    requestId += 1;
    return requestId;
  }

  function send(payload, kind = "request") {
    if (!ws || ws.readyState !== WebSocket.OPEN) return null;
    const req_id = nextId();
    requestMap.set(req_id, kind);
    ws.send(JSON.stringify({ ...payload, req_id }));
    return req_id;
  }

  function resetMarketCounters() {
    state.marketsLoaded = 0;
    state.ticksReceived = 0;
    for (const market of CONFIG.MARKETS) state.liveByMarket[market.symbol] = 0;
  }

  function connect() {
    manualClose = false;
    clearTimeout(reconnectTimer);
    resetMarketCounters();
    state.error = null;
    state.lastMessage = null;
    state.lastMessageType = null;
    openSocket();
  }

  function openSocket() {
    if (manualClose) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    status("connecting", `Connecting to Deriv market-data stream...`);

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
    status("connected", "Deriv WebSocket connected. Loading 10 histories and live streams...");

    // Request histories on one connection, then subscribe to live ticks on
    // the same connection. This avoids opening 10 simultaneous WebSockets.
    for (const market of CONFIG.MARKETS) {
      send({
        ticks_history: market.symbol,
        end: "latest",
        count: CONFIG.HISTORY_TICKS,
        style: "ticks",
        subscribe: 0
      }, `history:${market.symbol}`);
    }

    for (const market of CONFIG.MARKETS) {
      send({
        ticks: market.symbol,
        subscribe: 1
      }, `ticks:${market.symbol}`);
    }

    updateState();
  }

  function onMessage(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    state.lastMessage = Date.now();
    state.lastMessageType = data.msg_type || (data.error ? "error" : "unknown");
    state.lastUpdate = Date.now();

    if (data.error) {
      const request = data.req_id ? requestMap.get(data.req_id) : null;
      const detail = request ? ` (${request})` : "";
      fail(`${data.error.code || "API_ERROR"}: ${data.error.message || "Deriv API error"}${detail}`);
      emit("deriv:error", { ...snapshot(), message: state.error });
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
  }

  function handleHistory(data) {
    const symbol = data.history?.prices ? findSymbol(data) : null;
    const prices = Array.isArray(data.history?.prices) ? data.history.prices : [];
    const times = Array.isArray(data.history?.times) ? data.history.times : [];

    if (!symbol || !prices.length) {
      fail(`Received history response without a recognizable symbol (${data.req_id ?? "no req_id"}).`);
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

    // Each history request is sent once, so loaded count can safely advance once.
    const wasLoaded = requestMap.get(data.req_id) || "";
    if (wasLoaded.startsWith("history:")) {
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

    status("history", `${marketName(symbol)} history loaded (${ticks.length} ticks). ${state.marketsLoaded}/${CONFIG.MARKETS.length}`);
    updateState();
  }

  function findSymbol(data) {
    const req = data.req_id ? requestMap.get(data.req_id) : "";
    if (typeof req === "string" && req.startsWith("history:")) return req.slice(8);
    if (data.echo_req?.ticks_history) return data.echo_req.ticks_history;
    if (data.history?.symbol) return data.history.symbol;
    return null;
  }

  function handleTick(data) {
    const symbol = data.tick.symbol || findTickSymbol(data);
    if (!symbol || !CONFIG.MARKETS.some(m => m.symbol === symbol)) return;

    const price = Number(data.tick.quote);
    if (!Number.isFinite(price)) return;

    const epoch = Number(data.tick.epoch) || Math.floor(Date.now() / 1000);
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

    updateState();
  }

  function findTickSymbol(data) {
    const req = data.req_id ? requestMap.get(data.req_id) : "";
    if (typeof req === "string" && req.startsWith("ticks:")) return req.slice(6);
    if (data.echo_req?.ticks) return Array.isArray(data.echo_req.ticks) ? data.echo_req.ticks[0] : data.echo_req.ticks;
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
    fail("WebSocket error. Waiting for reconnect...");
  }

  function onClose() {
    state.connected = false;
    state.streaming = false;
    updateState();
    if (!manualClose) scheduleReconnect();
  }

  function scheduleReconnect() {
    if (manualClose || reconnectTimer) return;
    reconnectAttempt++;
    state.reconnects++;
    const delay = Math.min(10000, 1000 * Math.max(1, reconnectAttempt));
    status("reconnecting", `Reconnecting in ${Math.round(delay / 1000)}s...`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
  }

  function disconnect() {
    manualClose = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    try { ws?.close(); } catch {}
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
