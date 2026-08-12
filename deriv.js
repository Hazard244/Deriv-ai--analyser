/**
 * ==========================================================
 * Deriv Even/Odd AI Analyzer
 * deriv.js
 * Handles WebSocket connection and authentication
 * ==========================================================
 */

let ws = null;

const DerivAPI = {

    appId: null,
    token: null,
    connected: false,

    async connect() {

        this.appId = prompt("Enter your Deriv App ID");
        this.token = prompt("Enter your Deriv API Token");

        if (!this.appId || !this.token) {
            alert("App ID and API Token are required.");
            return;
        }

        ws = new WebSocket(
            `${CONFIG.API.URL}?app_id=${this.appId}`
        );

        ws.onopen = () => {

            console.log("Connected to Deriv");

            this.connected = true;

            this.authorize();

        };

        ws.onmessage = (event) => {

            const data = JSON.parse(event.data);

            console.log(data);

        };

        ws.onerror = (error) => {

            console.error("WebSocket Error", error);

        };

        ws.onclose = () => {

            console.log("Disconnected");

            this.connected = false;

        };

    },

    authorize() {

        ws.send(JSON.stringify({

            authorize: this.token

        }));

    }

};
