# Deriv AI Even/Odd Analyzer V6.5

V6.5 preserves the V6/V6.1/V6.2/V6.4 pipeline and adds evidence transparency plus market-history integrity protection.

## V6.5 changes
- Exactly 10 configured Volatility Indices remain in scope.
- History loading is counted by unique market symbol, so duplicate/replayed Deriv history responses cannot produce impossible values such as 20/10 histories.
- Duplicate history responses are counted and ignored for the loaded-market counter.
- Live-market count reflects markets that have actually produced ticks rather than merely having an open socket.
- Decision Gate exposes individual pass/fail evidence checks and the primary blocker.
- Market ECE and overall ECE are displayed separately.
- V6.4 adaptive reliability model is preserved.
- No automatic trading is performed.
