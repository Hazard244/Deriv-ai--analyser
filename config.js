const CONFIG = Object.freeze({
  APP_ID: "1089",
  HISTORY_TICKS: 1000,
  MAX_HISTORY: 5000,
  SCAN_INTERVAL_MS: 1000,
  WINDOWS: [50, 100, 250, 500, 1000],
  MARKETS: [
    { symbol: "R_10", name: "v10" },
    { symbol: "1HZ10V", name: "v10(1s)" },
    { symbol: "R_25", name: "v25" },
    { symbol: "1HZ25V", name: "v25(1s)" },
    { symbol: "R_50", name: "v50" },
    { symbol: "1HZ50V", name: "v50(1s)" },
    { symbol: "R_75", name: "v75" },
    { symbol: "1HZ75V", name: "v75(1s)" },
    { symbol: "R_100", name: "v100" },
    { symbol: "1HZ100V", name: "v100(1s)" }
  ],
  LEVELS: Object.freeze({
    PREPARE: 35,
    EARLY: 55,
    CONFIRMED: 70,
    HIGH: 85
  })
});
