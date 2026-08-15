# Deriv Even/Odd AI Analyzer v3

A read-only browser analyzer for Even/Odd research on the ten selected Volatility Indices.

## Markets
- V10
- V10(1s)
- V25
- V25(1s)
- V50
- V50(1s)
- V75
- V75(1s)
- V100
- V100(1s)

## What this version does
1. Connects to Deriv's public WebSocket market-data stream.
2. Loads recent tick history.
3. Continues with live ticks.
4. Extracts the last digit.
5. Calculates multi-window parity statistics.
6. Calculates momentum, imbalance, switching, entropy and digit entropy.
7. Calculates parity transition probabilities and a simple first-order Markov estimate.
8. Scores Even and Odd separately.
9. Produces WAIT / PREPARE / EARLY / CONFIRMED / HIGH states.
10. Displays the reasoning behind the score.

## Security
This version does not request, store or expose a Deriv API token. It uses public market-data endpoints only.

## Important
The analyzer is not a prediction guarantee and does not place trades. Forward testing is required before considering any signal for real-money use.

## Next development stage
- opportunity ranking across all ten markets
- top-three deep analysis
- model reliability tracking
- online performance ledger
- signal outcome tracking
- adaptive weighting based on forward-test evidence
