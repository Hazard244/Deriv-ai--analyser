// ==========================================
// DERIV AI ANALYSER
// Dashboard Controller v1.0
// ==========================================

let currentMarket = "Volatility 10";

window.onload = () => {

    connectDeriv("R_10");

    const market = document.getElementById("marketSelect");

    if (market) {

        market.addEventListener("change", () => {

            currentMarket = market.value;

            connectDeriv(symbolMap[currentMarket]);

        });

    }

};

// Called by evenodd.js whenever analysis updates
function updateDashboard(data) {

    setText("lastDigit", data.lastDigit);

    setText("evenCount", data.even);

    setText("oddCount", data.odd);

    setText(
        "evenProbability",
        data.evenProbability.toFixed(1) + "%"
    );

    setText(
        "oddProbability",
        data.oddProbability.toFixed(1) + "%"
    );

    const signal = Signals.generate(digitHistory);

    setText("confidence", signal.confidence + "%");

    setText("decision", signal.decision);

    setText("direction", signal.direction);

    setText("opportunity", signal.score + "%");

    displayReasons(signal.reasons);

}

// Utility

function setText(id, value) {

    const element = document.getElementById(id);

    if (element)
        element.textContent = value;

}

// Display signal reasons

function displayReasons(reasons) {

    const panel = document.getElementById("reasons");

    if (!panel) return;

    panel.innerHTML = "";

    reasons.forEach(reason => {

        const item = document.createElement("li");

        item.textContent = reason;

        panel.appendChild(item);

    });

}

// Connection status

function displayConnection(status) {

    setText("status", status);

}
