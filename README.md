# Deriv AI Even/Odd Analyzer v4.1

Clean replacement build for a read-only Even/Odd analysis tool.

## Supported markets
Only:
- v10
- v10(1s)
- v25
- v25(1s)
- v50
- v50(1s)
- v75
- v75(1s)
- v100
- v100(1s)

## Architecture
Deriv public ticks
-> historical tick loader
-> live tick stream
-> last-digit extraction
-> Even/Odd engine
-> multi-window statistics
-> sequence and Markov analysis
-> signal engine
-> AI/meta summary
-> dashboard

## Signal levels
WAIT -> PREPARE -> EARLY -> CONFIRMED -> HIGH

The confidence number is an internal model score, not a guaranteed probability of winning.

## Security
No private API token is included. The browser uses Deriv's public market-data WebSocket endpoint.

## Important
This is an analyzer, not an automatic trading bot.
