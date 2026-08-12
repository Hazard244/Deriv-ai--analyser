// Store the last 100 digits
const digitHistory = [];
const MAX_HISTORY = 100;

// Called whenever a new tick arrives
function processTick(price) {

    // Convert the price to a string
    const priceString = price.toString();

    // Get the last numeric digit
    const digits = priceString.replace(/\D/g, "");

    if (!digits.length) return;

    const lastDigit = parseInt(digits[digits.length - 1]);

    // Save the digit
    digitHistory.push(lastDigit);

    // Keep only the latest 100 digits
    if (digitHistory.length > MAX_HISTORY) {
        digitHistory.shift();
    }

    updateEvenOddAnalysis();
}

function updateEvenOddAnalysis() {

    let even = 0;
    let odd = 0;

    digitHistory.forEach(digit => {
        if (digit % 2 === 0) {
            even++;
        } else {
            odd++;
        }
    });

    const total = digitHistory.length || 1;

    const evenProbability = ((even / total) * 100).toFixed(1);
    const oddProbability = ((odd / total) * 100).toFixed(1);

    document.getElementById("evenProbability").textContent =
        evenProbability + "%";

    document.getElementById("oddProbability").textContent =
        oddProbability + "%";

}
