window.onload = () => {

    connectDeriv();

    const market = document.getElementById("marketSelect");

    market.addEventListener("change", () => {

        connectDeriv(symbolMap[market.value]);

    });

};
