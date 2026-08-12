/**
 * ==========================================================
 * Deriv Even/Odd AI Analyzer
 * config.js
 * Central configuration for the application
 * ==========================================================
 */

const CONFIG = {
  APP: {
    NAME: "Deriv Even/Odd AI Analyzer",
    VERSION: "1.0.0",
    DEBUG: true
  },

  API: {
    APP_ID: "YOUR_APP_ID",
    TOKEN: "YOUR_API_TOKEN",
    URL: "wss://ws.derivws.com/websockets/v3"
  },

  MARKETS: [
    "R_10",
    "R_10_1S",
    "R_25",
    "R_25_1S",
    "R_50",
    "R_50_1S",
    "R_75",
    "R_75_1S",
    "R_100",
    "R_100_1S"
  ],

  BUFFER: {
    MAX_TICKS: 10000
  },

  SIGNALS: {
    PREPARE: 60,
    WATCH: 70,
    EARLY: 80,
    CONFIRMED: 90,
    MIN_CONFIDENCE: 60
  },

  CONNECTION: {
    AUTO_RECONNECT: true,
    MAX_RETRIES: 20,
    RETRY_DELAY: 3000,
    HEARTBEAT_INTERVAL: 30000
  },

  RISK: {
    MAX_CONSECUTIVE_LOSSES: 3,
    COOLDOWN_MINUTES: 15,
    SIGNAL_EXPIRY_SECONDS: 30
  }
};

// Prevent accidental modification of configuration
Object.freeze(CONFIG);
