/**
 * ============================================================
 * Deriv Even/Odd AI Analyzer
 * config.js
 * Version: 2.0.0
 * ============================================================
 * This file contains ONLY application configuration.
 * Never store your real App ID or API Token here.
 */

const CONFIG = Object.freeze({

    APP: {
        NAME: "Deriv Even/Odd AI Analyzer",
        VERSION: "2.0.0",
        DEBUG: true
    },

    API: {
        URL: "wss://ws.derivws.com/websockets/v3",

        // Credentials are supplied at runtime.
        APP_ID: null,
        TOKEN: null
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

    WINDOWS: {
        SHORT: 50,
        MEDIUM: 100,
        LONG: 250,
        EXTENDED: 500,
        ULTRA: 1000
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
        MAX_RETRIES: Infinity,
        RETRY_DELAY: 3000,
        HEARTBEAT_INTERVAL: 30000,
        REQUEST_TIMEOUT: 10000
    },

    RISK: {
        MAX_CONSECUTIVE_LOSSES: 3,
        COOLDOWN_MINUTES: 15,
        SIGNAL_EXPIRY_SECONDS: 30
    },

    PERFORMANCE: {
        TARGET_TICK_PROCESSING_MS: 5,
        TARGET_SIGNAL_MS: 100
    },

    STORAGE: {
        SAVE_HISTORY: true,
        SAVE_SETTINGS: true,
        MAX_HISTORY: 5000
    }

});
