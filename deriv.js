let ws = null;
let currentSymbol = "R_10";

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

    currentSymbol = symbol;

    if (ws) {
        ws.close();
    }

    ws = new WebSocket(CONFIG.DERIV.WS_URL);

    ws.onopen = () => {

        document.getElementById("status").textContent = "Connected";
        document.getElementById("status").style.color = "#00ff88";

        ws.send(JSON.stringify({
            ticks: symbol,
            subscribe: 1
        }));
    };

    ws.onmessage = (event) => {

        const data = JSON.parse(event.data);

        if (data.tick) {

            const price = data.tick.quote;

            console.log("Live Tick:", price);

            if(window.onNewTick){
                window.onNewTick(price);
            }

        }

    };

    ws.onclose = () => {
        document.getElementById("status").textContent = "Disconnected";
        document.getElementById("status").style.color = "red";
    };

                                }
