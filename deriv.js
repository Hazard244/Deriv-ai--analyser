// ==========================================
// DERIV LIVE TICK ENGINE
// ==========================================

let ws = null;

const symbolMap = {
    "Volatility 10": "R_10",
    "Volatility 10 (1s)": "1HZ10V",
    "Volatility 25": "R_25",
    "Volatility 25 (1s)": "1HZ25V",
    "Volatility 50": "R_50",
    "Volatility 50 (1s)": "1HZ50V",
    "Volatility 75": "R_75",
    "Volatility 75 (1s)": "1HZ75V",
    "Volatility 100": "R_100",
    "Volatility 100 (1s)": "1HZ100V"
};

function connectDeriv(symbol = "R_10") {

    if (ws) {
        ws.close();
    }

    ws = new WebSocket(CONFIG.DERIV.WS_URL);

    ws.onopen = () => {

        displayConnection("Connected");

        ws.send(JSON.stringify({
            ticks: symbol,
            subscribe: 1
        }));

    };

    ws.onmessage = (event) => {

        const response = JSON.parse(event.data);

        if (response.tick) {

            const price = response.tick.quote;

            processTick(price);

        }

    };

    ws.onerror = () => {

        displayConnection("Connection Error");

    };

    ws.onclose = () => {

        displayConnection("Disconnected");

    };

}
