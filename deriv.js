// deriv.js
// Deriv public market-data connector.
// No API token or App ID is required for public tick/history data.

const Deriv = (() => {
  const WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

  let socket = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let manualDisconnect = false;
  let currentSymbol = null;
  let subscribed = false;

  const state = {
    connected: false,
    loadingHistory: false,
    symbol: null,
    ticksReceived: 0,
    lastPrice: null,
    lastDigit: null,
    lastTickTime: null
  };

  function log(...args) {
    console.log("[Deriv]", ...args);
  }

  function emitStatus(status, message = "") {
    window.dispatchEvent(
      new CustomEvent("deriv:status", {
        detail: {
          status,
          message,
          ...state
        }
      })
    );
  }

  function emitTick(tick) {
    window.dispatchEvent(
      new CustomEvent("deriv:tick", {
        detail: tick
      })
    );
  }

  function emitHistory(history) {
    window.dispatchEvent(
      new CustomEvent("deriv:history", {
        detail: history
      })
    );
  }

  function emitError(error) {
    console.error("[Deriv]", error);

    window.dispatchEvent(
      new CustomEvent("deriv:error", {
        detail: {
          message: error?.message || String(error)
        }
      })
    );
  }

  function getConfig() {
    if (typeof CONFIG !== "undefined") {
      return CONFIG;
    }

    return {};
  }

  function getDefaultSymbol() {
    const config = getConfig();

    if (Array.isArray(config.MARKETS) && config.MARKETS.length > 0) {
      const first = config.MARKETS[0];

      return typeof first === "string"
        ? first
        : first.symbol || first.code || first.id;
    }

    if (Array.isArray(config.VOLATILITY_SYMBOLS)) {
      return config.VOLATILITY_SYMBOLS[0];
    }

    return "R_10";
  }

  function getHistoryCount() {
    const config = getConfig();

    return Number(
      config.HISTORY_TICKS ||
      config.HISTORY_COUNT ||
      1000
    );
  }

  function openSocket() {
    if (
      socket &&
      (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      )
    ) {
      return;
    }

    clearTimeout(reconnectTimer);

    emitStatus("connecting", "Connecting to Deriv...");

    try {
      socket = new WebSocket(WS_URL);
    } catch (error) {
      emitError(error);
      scheduleReconnect();
      return;
    }

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", handleError);
    socket.addEventListener("close", handleClose);
  }

  function handleOpen() {
    reconnectAttempts = 0;
    state.connected = true;

    log("WebSocket connected.");

    emitStatus("connected", "Connected to Deriv.");

    const symbol = currentSymbol || getDefaultSymbol();

    subscribe(symbol);
  }

  function handleMessage(event) {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.error) {
      emitError(new Error(data.error.message || "Deriv API error."));
      return;
    }

    if (data.history) {
      processHistoryResponse(data);
      return;
    }

    if (data.tick) {
      processLiveTick(data.tick);
      return;
    }
  }

  function processHistoryResponse(data) {
    state.loadingHistory = false;

    const prices = Array.isArray(data.history?.prices)
      ? data.history.prices
      : [];

    const times = Array.isArray(data.history?.times)
      ? data.history.times
      : [];

    const history = [];

    for (let i = 0; i < prices.length; i++) {
      const price = Number(prices[i]);

      if (!Number.isFinite(price)) {
        continue;
      }

      history.push({
        symbol: data.echo_req?.ticks_history || currentSymbol,
        price,
        time: Number(times[i]) || null,
        epoch: Number(times[i]) || null,
        digit: extractLastDigit(price)
      });
    }

    log(`Loaded ${history.length} historical ticks.`);

    emitHistory({
      symbol: currentSymbol,
      ticks: history
    });

    subscribeLive(currentSymbol);
  }

  function processLiveTick(tick) {
    const price = Number(tick.quote);

    if (!Number.isFinite(price)) {
      return;
    }

    const epoch = Number(tick.epoch);

    const item = {
      symbol: tick.symbol || currentSymbol,
      price,
      time: Number.isFinite(epoch) ? epoch : Math.floor(Date.now() / 1000),
      epoch: Number.isFinite(epoch) ? epoch : Math.floor(Date.now() / 1000),
      digit: extractLastDigit(price),
      id: tick.id || null
    };

    state.ticksReceived += 1;
    state.lastPrice = item.price;
    state.lastDigit = item.digit;
    state.lastTickTime = item.epoch;

    emitTick(item);
  }

  function extractLastDigit(price) {
    const text = String(price);

    const digits = text.match(/\d/g);

    if (!digits || digits.length === 0) {
      return null;
    }

    return Number(digits[digits.length - 1]);
  }

  function requestHistory(symbol) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const count = getHistoryCount();

    state.loadingHistory = true;

    emitStatus(
      "loading",
      `Loading ${count} historical ticks for ${symbol}...`
    );

    socket.send(
      JSON.stringify({
        ticks_history: symbol,
        end: "latest",
        count,
        style: "ticks"
      })
    );
  }

  function subscribeLive(symbol) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        forget_all: "ticks"
      })
    );

    socket.send(
      JSON.stringify({
        ticks: symbol,
        subscribe: 1
      })
    );

    subscribed = true;

    log(`Subscribed to live ticks: ${symbol}`);

    emitStatus(
      "streaming",
      `Streaming ${symbol}`
    );
  }

  function subscribe(symbol) {
    if (!symbol) {
      emitError(new Error("No Deriv market symbol supplied."));
      return;
    }

    currentSymbol = symbol;
    state.symbol = symbol;
    state.ticksReceived = 0;
    state.lastPrice = null;
    state.lastDigit = null;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      openSocket();
      return;
    }

    requestHistory(symbol);
  }

  function changeMarket(symbol) {
    if (!symbol || symbol === currentSymbol) {
      return;
    }

    log(`Changing market: ${currentSymbol} → ${symbol}`);

    subscribed = false;

    currentSymbol = symbol;
    state.symbol = symbol;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          forget_all: "ticks"
        })
      );

      requestHistory(symbol);
    } else {
      openSocket();
    }
  }

  function handleError(event) {
    emitError(
      new Error(
        event?.message || "WebSocket connection error."
      )
    );
  }

  function handleClose() {
    state.connected = false;
    subscribed = false;

    emitStatus(
      "disconnected",
      "Deriv connection closed."
    );

    socket = null;

    if (!manualDisconnect) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);

    reconnectAttempts += 1;

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts - 1),
      30000
    );

    log(`Reconnecting in ${delay}ms...`);

    emitStatus(
      "reconnecting",
      `Reconnecting in ${Math.round(delay / 1000)}s...`
    );

    reconnectTimer = setTimeout(() => {
      openSocket();
    }, delay);
  }

  function connect(symbol = null) {
    manualDisconnect = false;

    currentSymbol = symbol || currentSymbol || getDefaultSymbol();
    state.symbol = currentSymbol;

    openSocket();
  }

  function disconnect() {
    manualDisconnect = true;

    clearTimeout(reconnectTimer);

    if (socket) {
      try {
        socket.close();
      } catch {
        // Ignore close errors.
      }
    }

    socket = null;
    state.connected = false;
    subscribed = false;

    emitStatus(
      "disconnected",
      "Disconnected."
    );
  }

  function getState() {
    return {
      ...state,
      subscribed
    };
  }

  return {
    connect,
    disconnect,
    subscribe,
    changeMarket,
    getState
  };
})();

window.Deriv = Deriv;
