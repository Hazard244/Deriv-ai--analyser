// =============================
// DERIV AI EVEN/ODD ANALYSER
// Main Controller
// =============================

let signalCooldown = false;
let lastSignal = "NONE";
let signalStrength = 0;

const ui = {
    lastDigit: document.getElementById("lastDigit"),
    evenCount: document.getElementById("evenCount"),
    oddCount: document.getElementById("oddCount"),
    evenProbability: document.getElementById("evenProbability"),
    oddProbability: document.getElementById("oddProbability"),
    confidence: document.getElementById("confidence"),
    recommendation: document.getElementById("recommendation"),
    status: document.getElementById("status"),
    signal: document.getElementById("signal"),
    marketBias: document.getElementById("marketBias")
};

function updateDashboard(data){

    ui.lastDigit.textContent = data.lastDigit;

    ui.evenCount.textContent = data.even;

    ui.oddCount.textContent = data.odd;

    ui.evenProbability.textContent =
        data.evenProbability.toFixed(1) + "%";

    ui.oddProbability.textContent =
        data.oddProbability.toFixed(1) + "%";

    ui.confidence.textContent =
        data.confidence.toFixed(1) + "%";

    ui.marketBias.textContent = data.bias;

    createRecommendation(data);

}

function createRecommendation(data){

    if(signalCooldown){
        ui.status.textContent="COOLDOWN";
        return;
    }

    let confidence=data.confidence;

    signalStrength=confidence;

    if(confidence<60){

        ui.status.textContent="WAIT";
        ui.signal.textContent="NO TRADE";
        ui.recommendation.textContent="Market has no edge.";

        return;

    }

    if(confidence>=60 && confidence<75){

        ui.status.textContent="PREPARE";

        ui.signal.textContent=data.bias;

        ui.recommendation.textContent=
        "Edge developing. Wait for confirmation.";

        return;

    }

    if(confidence>=75){

        ui.status.textContent="TRADE";

        ui.signal.textContent=data.bias;

        ui.recommendation.textContent=
        "High probability setup.";

        startCooldown();

    }

}

function startCooldown(){

    signalCooldown=true;

    setTimeout(()=>{

        signalCooldown=false;

    },30000);

}

function displayConnection(state){

    const connection=document.getElementById("connection");

    if(!connection) return;

    connection.textContent=state;

}

displayConnection("Connecting...");
