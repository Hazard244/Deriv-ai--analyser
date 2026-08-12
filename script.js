// ==============================
// Main Controller
// ==============================

function processDigit(lastDigit) {

    // Update Even/Odd statistics
    updateEvenOddAnalysis(lastDigit);

    // Detect patterns
    detectPatterns();

    // Generate signal
    generateSignal();

    // Run AI decision engine
    runAI();

    // Update screen
    updateDashboard();

}
