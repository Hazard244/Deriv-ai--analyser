/**
 * ============================================
 * Deriv Even/Odd AI Analyzer
 * script.js
 * Main application entry point
 * ============================================
 */

window.addEventListener("load", () => {
    console.log(`${CONFIG.APP.NAME} v${CONFIG.APP.VERSION}`);
    DerivAPI.connect();
});
