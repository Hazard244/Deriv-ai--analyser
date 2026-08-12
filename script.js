window.onload = () => {

    connectDeriv();

    const market = document.getElementById("marketSelect");

    market.addEventListener("change", () => {

        connectDeriv(symbolMap[market.value]);

    });

};
window.onNewTick = function(price) {

    document.getElementById("price").textContent =
        "Live Price: " + price;

    processTick(price);

};
