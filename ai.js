// ==============================
// AI Decision Engine
// ==============================

function runAI() {

    const even = parseFloat(document.getElementById("evenProbability").innerText);
    const odd = parseFloat(document.getElementById("oddProbability").innerText);

    let confidence = 50;
    let signal = "WAIT";
    let reason = "No strong edge.";

    // Strong Even
    if (even >= 60) {
        confidence = even;
        signal = "EVEN";
        reason = "Even probability dominates.";
    }

    // Strong Odd
    if (odd >= 60) {
        confidence = odd;
        signal = "ODD";
        reason = "Odd probability dominates.";
    }

    // Very strong confidence
    if (confidence >= 75) {
        reason += " High-confidence setup.";
    }

    document.getElementById("confidence").innerText =
        confidence.toFixed(1) + "%";

    document.getElementById("signal").innerText = signal;
    document.getElementById("reason").innerText = reason;
}
