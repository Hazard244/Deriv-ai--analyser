# Deriv AI Even/Odd Analyzer v4
Read-only browser analyzer for the ten Volatility Indices: v10, v10(1s), v25, v25(1s), v50, v50(1s), v75, v75(1s), v100, v100(1s).

Pipeline: public Deriv tick/history -> last digit -> Even/Odd history -> multi-window statistics -> patterns/Markov -> signal engine -> AI summary -> dashboard.

No personal API token is required for public market-data analysis. The app does not place trades. Confidence is a model score, not a guaranteed win probability.
