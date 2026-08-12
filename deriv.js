// ==============================
// Deriv WebSocket Connection
// ==============================

let ws = null;
let connected = false;

function connectDeriv() {

    console.log("Connecting to Deriv...");

    ws = new WebSocket(WS_URL);

    ws.onopen = function () {

        connected = true;

        console.log("Connected.");

        ws.send(JSON.stringify({
            ticks: SYMBOL,
            subscribe: 1
        }));

    };

    ws.onmessage = function (event) {

        const data = JSON.parse(event.data);

        if (!data.tick) return;

        const price = data.tick.quote;

        const lastDigit = Number(
            price.toString().slice(-1)
        );

        if (!isNaN(lastDigit)) {

            console.log("Last Digit:", lastDigit);

            if (typeof processDigit === "function") {

                processDigit(lastDigit);

            }

        }

    };

    ws.onerror = function (error) {

        console.log("WebSocket Error", error);

    };

    ws.onclose = function () {

        connected = false;

        console.log("Disconnected. Reconnecting in 3 seconds...");

        setTimeout(connectDeriv, 3000);

    };

}

connectDeriv();
