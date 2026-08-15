/**
 * Deriv Even/Odd AI Analyzer
 * Configuration only. No secrets are stored here.
 */
const CONFIG = Object.freeze({
  APP: {
    NAME: "Deriv Even/Odd AI Analyzer",
    VERSION: "3.0.0",
    DEBUG: false
  },

  API: {
    // Public market-data WebSocket. No API token is required for ticks.
    URL: "wss://ws.binaryws.com/websockets/v3",
    RECONNECT_DELAY_MS: 2500,
    MAX_RECONNECT_DELAY_MS: 15000
  },

  MARKETS: [
    { symbol: "R_10", name: "V10", label: "Volatility 10" },
    { symbol: "R_10_1S", name: "V10(1s)", label: "Volatility 10 (1s)" },
    { symbol: "R_25", name: "V25", label: "Volatility 25" },
    { symbol: "R_25_1S", name: "V25(1s)", label: "Volatility 25 (1s)" },
    { symbol: "R_50", name: "V50", label: "Volatility 50" },
    { symbol: "R_50_1S", name: "V50(1s)", label: "Volatility 50 (1s)" },
    { symbol: "R_75", name: "V75", label: "Volatility 75" },
    { symbol: "R_75_1S", name: "V75(1s)", label: "Volatility 75 (1s)" },
    { symbol: "R_100", name: "V100", label: "Volatility 100" },
    { symbol: "R_100_1S", name: "V100(1s)", label: "Volatility 100 (1s)" }
  ],

  WINDOWS: [50, 100, 250, 500, 1000],
  HISTORY_LOAD: 1000,
  MAX_HISTORY: 5000,

  SIGNAL: {
    MIN_HISTORY: 100,
    PREPARE: 58,
    EARLY: 66,
    CONFIRMED: 72,
    HIGH_CONFIDENCE: 80,
    MIN_EDGE: 6
  },

  RISK: {
    SIGNAL_EXPIRY_TICKS: 8,
    MAX_CONSECUTIVE_LOSSES: 3,
    COOLDOWN_TICKS: 20
  }
});
