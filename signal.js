function generateSignal(evenProbability, oddProbability) {

    let decision = "WAIT";
    let confidence = Math.max(evenProbability, oddProbability);

    if (confidence >= 55) decision = "PREPARE";
    if (confidence >= 65) decision = "EARLY SIGNAL";
    if (confidence >= 75) decision = "ENTER";

    const direction = evenProbability > oddProbability ? "EVEN" : "ODD";

    document.getElementById("decision").textContent =
        decision + " • " + direction;

    document.getElementById("confidence").textContent =
        confidence.toFixed(1) + "%";
}
