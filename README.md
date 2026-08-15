# Deriv AI Even/Odd Analyzer V5

V5 adds the multi-market opportunity scanner while preserving the read-only Even/Odd scope.

## Markets
Only:
v10, v10(1s), v25, v25(1s), v50, v50(1s), v75, v75(1s), v100, v100(1s).

## V5 pipeline
Deriv public market data
-> 1,000-tick history for all 10 markets
-> live subscriptions for all 10
-> fast scanner
-> 50/100/250/500/1000 window analysis
-> Even/Odd distribution
-> multi-window alignment
-> entropy
-> Markov transition edge
-> switch-rate/noise penalty
-> opportunity score
-> rank all 10
-> top 3 deep analysis
-> AI/meta summary
-> dashboard

## Scoring
Opportunity is a ranking score, not a win probability.
Confidence is an internal model score, not a guaranteed probability.

The scanner penalizes:
- near-balanced entropy
- weak multi-window agreement
- tiny Markov edges
- very rapid alternation/noisy behavior

## Security
No private API token is included. Public market data only.

## Trading
This build is read-only and does not place trades.


## V5.1 live-stream fix

Each of the 10 markets now uses an independent WebSocket connection.
The history request uses `ticks_history` with `subscribe: 1`, so the
historical sample and the persistent live stream are tied together.

The dashboard reports:
- total historical markets loaded
- total live ticks received
- number of markets that have received at least one live tick
- per-market live tick counters in the internal state

A live tick immediately updates that market's rolling history and triggers
a fresh opportunity ranking.
