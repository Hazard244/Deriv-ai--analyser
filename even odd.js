// evenodd.js
// ===============================
// Even/Odd Analysis Engine
// Stores the latest 100 ticks,
// calculates probabilities,
// and updates the dashboard.
// ===============================

// Store last digits
const digitHistory = [];
const MAX_HISTORY = 100;

// Process every incoming tick
function processTick(price) {

    // Convert price to string
    const priceString = price.toString();

    // Keep only numeric characters
    const digits = priceString.replace(/\D/g, "");

    if (digits.length === 0) return;

    // Extract last digit
    const lastDigit = parseInt(digits[digits.length - 1]);

    // Save digit
    digitHistory.push(lastDigit);

    // Keep only latest 100 digits
    if (digitHistory.length > MAX_HISTORY) {
        digitHistory.shift();
    }

    // Refresh analysis
    updateEvenOddAnalysis();
}

// Analyse stored digits
function updateEvenOddAnalysis() {

    let even = 0;
    let odd = 0;

    // Count Even & Odd
    digitHistory.forEach(digit => {
        if (digit % 2 === 0) {
            even++;
        } else {
            odd++;
        }
    });

    const total = digitHistory.length || 1;

    const evenProbability = Number(
        ((even / total) * 100).toFixed(1)
    );

    const oddProbability = Number(
        ((odd / total) * 100).toFixed(1)
    );

    // Update dashboard
    const evenElement = document.getElementById("evenProbability");
    const oddElement = document.getElementById("oddProbability");

    if (evenElement) {
        evenElement.textContent = evenProbability + "%";
    }

    if (oddElement) {
        oddElement.textContent = oddProbability + "%";
    }

    // Generate trading signal
    if (typeof generateSignal === "function") {
        generateSignal(evenProbability, oddProbability);
    }
}

// Optional helper functions

function getDigitHistory() {
    return digitHistory;
}

function clearDigitHistory() {
    digitHistory.length = 0;
}
