const Deriv = (() => {
  const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(CONFIG.APP_ID)}`;
  let ws = null;
  let reconnectTimer = null;
  let manualClose = false;
  let requestId = 0;
  let symbol = CONFIG.MARKETS[0].symbol;

  const state = {
    connected: false,
    loading: false,
    streaming: false,
    symbol,
    ticksReceived: 0,
    lastPrice: null,
    lastDigit: null,
    error: null
  };

  const emit = (name, detail = {}) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  function status(statusName, message) {
    emit("deriv:status", { status: statusName, message, ...state });
  }

  function lastDigit(price) {
    const digits = String(price).match(/\d/g);
    return digits ? Number(digits[digits.length - 1]) : null;
  }

  function openConnection() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    status("connecting", "Connecting to Deriv...");
    manualClose = false;

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
      status("connected", "Connected to Deriv.");
      requestHistory();
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

      if (!manualClose) {
        scheduleReconnect();
      }
    });
  }

  function handleMessage(data) {
    if (data.error) {
      handleError(new Error(data.error.message || "Deriv API error."));
      return;
    }

    if (data.history) {
      state.loading = false;

      const prices = Array.isArray(data.history.prices)
        ? data.history.prices
        : [];

      const times = Array.isArray(data.history.times)
        ? data.history.times
        : [];

      const ticks = prices
        .map((price, index) => {
          const numericPrice = Number(price);
          if (!Number.isFinite(numericPrice)) return null;

          const epoch = Number(times[index]) || null;

          return {
            symbol,
            price: numericPrice,
            epoch,
            time: epoch,
            digit: lastDigit(numericPrice)
          };
        })
        .filter(Boolean);

      emit("deriv:history", { symbol, ticks });
      subscribeTicks();
      return;
    }

    if (data.tick) {
      const price = Number(data.tick.quote);
      if (!Number.isFinite(price)) return;

      const item = {
        symbol: data.tick.symbol || symbol,
        price,
        epoch: Number(data.tick.epoch) || Math.floor(Date.now() / 1000),
        time: Number(data.tick.epoch) || Math.floor(Date.now() / 1000),
        digit: lastDigit(price)
      };

      state.ticksReceived += 1;
      state.lastPrice = item.price;
      state.lastDigit = item.digit;
      state.streaming = true;

      emit("deriv:tick", item);
    }
  }

  function send(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ ...payload, req_id: ++requestId }));
    return true;
  }

  function requestHistory() {
    state.loading = true;
    state.streaming = false;
    status("loading", `Loading ${CONFIG.HISTORY_TICKS} ticks for ${marketName(symbol)}...`);

    send({
      ticks_history: symbol,
      end: "latest",
      count: CONFIG.HISTORY_TICKS,
      style: "ticks"
    });
  }

  function subscribeTicks() {
    send({ forget_all: "ticks" });
    const ok = send({ ticks: symbol, subscribe: 1 });

    if (ok) {
      state.streaming = true;
      status("streaming", `Streaming ${marketName(symbol)}.`);
    }
  }

  function marketName(value) {
    return CONFIG.MARKETS.find(m => m.symbol === value)?.name || value;
  }

  function changeMarket(nextSymbol) {
    if (!CONFIG.MARKETS.some(m => m.symbol === nextSymbol)) return;

    symbol = nextSymbol;
    state.symbol = symbol;
    state.ticksReceived = 0;
    state.lastPrice = null;
    state.lastDigit = null;

    if (ws && ws.readyState === WebSocket.OPEN) {
      requestHistory();
    } else {
      connect(symbol);
    }
  }

  function connect(initialSymbol = symbol) {
    if (CONFIG.MARKETS.some(m => m.symbol === initialSymbol)) {
      symbol = initialSymbol;
      state.symbol = symbol;
    }

    manualClose = false;
    clearTimeout(reconnectTimer);
    openConnection();
  }

  function scheduleReconnect() {
    if (manualClose) return;

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(openConnection, 3000);
    status("reconnecting", "Connection lost. Retrying in 3 seconds...");
  }

  function handleError(error) {
    state.error = error?.message || "Unknown Deriv error.";
    emit("deriv:error", { message: state.error });
    status("error", state.error);
  }

  function disconnect() {
    manualClose = true;
    clearTimeout(reconnectTimer);

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        send({ forget_all: "ticks" });
      }
      ws?.close();
    } catch {}

    ws = null;
    state.connected = false;
    state.loading = false;
    state.streaming = false;
    status("disconnected", "Disconnected.");
  }

  return {
    connect,
    disconnect,
    changeMarket,
    getState: () => ({ ...state }),
    getMarketName: marketName
  };
})();
