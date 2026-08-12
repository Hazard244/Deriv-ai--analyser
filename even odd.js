// ==========================================
// DERIV AI EVEN/ODD ENGINE v2.0
// ==========================================

// Configuration
const MAX_HISTORY = 100;

// History
let digitHistory = [];

// Process every incoming tick
function processTick(price) {

    const cleanPrice = price.toString().replace(/\D/g, "");

    if (cleanPrice.length === 0) return;

    const lastDigit = parseInt(
        cleanPrice[cleanPrice.length - 1]
    );

    digitHistory.push(lastDigit);

    if (digitHistory.length > MAX_HISTORY) {
        digitHistory.shift();
    }

    analyzeEvenOdd(lastDigit);

}

// Main Analysis
function analyzeEvenOdd(lastDigit) {

    let even = 0;
    let odd = 0;

    digitHistory.forEach(digit => {

        if (digit % 2 === 0) {
            even++;
        } else {
            odd++;
        }

    });

    const total = digitHistory.length;

    if (total === 0) return;

    const evenProbability = (even / total) * 100;
    const oddProbability = (odd / total) * 100;

    // Recent momentum (last 20 ticks)
    const recent = digitHistory.slice(-20);

    let recentEven = 0;
    let recentOdd = 0;

    recent.forEach(digit => {

        if (digit % 2 === 0) {
            recentEven++;
        } else {
            recentOdd++;
        }

    });

    // Streak detection
    let streakType = "NONE";
    let streak = 1;

    if (digitHistory.length >= 2) {

        for (
            let i = digitHistory.length - 1;
            i > 0;
            i--
        ) {

            const current =
                digitHistory[i] % 2 === 0
                    ? "EVEN"
                    : "ODD";

            const previous =
                digitHistory[i - 1] % 2 === 0
                    ? "EVEN"
                    : "ODD";

            if (current === previous) {

                streak++;

            } else {

                streakType = current;
                break;

            }

        }

    }

    // Confidence
    let confidence = Math.max(
        evenProbability,
        oddProbability
    );

    confidence += streak * 2;

    confidence += Math.abs(
        recentEven - recentOdd
    );

    if (confidence > 99) confidence = 99;

    // Bias
    const bias =
        evenProbability >= oddProbability
            ? "EVEN"
            : "ODD";

    // Update dashboard
    updateDashboard({

        lastDigit,

        even,

        odd,

        evenProbability,

        oddProbability,

        confidence,

        bias,

        streak,

        streakType

    });

}
