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


## V5.2 live-stream architecture

V5.2 replaces the 10-WebSocket approach with one persistent WebSocket.
It sends 10 `ticks_history` requests (`subscribe: 0`) and 10 `ticks`
subscriptions (`subscribe: 1`) over the same connection.

The UI now surfaces the last Deriv API error/message type instead of
showing only a generic Connected state when no market data arrives.


## V5.3 live-data correction

V5.3 switches the market-data connection to Deriv's current public
WebSocket endpoint and removes dependence on the legacy app-id WebSocket
URL for read-only market data.

The analyzer requests:
- 1,000 historical ticks for each of the 10 volatility symbols
- one live `ticks` subscription containing all 10 symbols
- per-market live tick counters
- immediate rescanning after every live tick
- visible API error messages when Deriv rejects a request


## V5.4 history-request cleanup

The live stream is confirmed operational. V5.4 removes the unnecessary
`subscribe` field from one-shot `ticks_history` requests. The dedicated
`ticks` subscription remains unchanged.

This eliminates the remaining `InputValidationFailed: subscribe`
history-request error while preserving the working live stream.


## V6 self-auditing validation layer
V6 adds a deterministic validation engine before any future trading integration:
- walk-forward replay over each market's loaded history
- every prediction uses only ticks already observed
- the next tick is the outcome
- only EARLY/CONFIRMED/HIGH signals are evaluated
- rolling live WIN/LOSS tracking per market
- market-specific historical accuracy and signal coverage
- conservative validated edge score (not a probability)
- AI/meta trust now considers observed validation performance
- confidence is capped below 90 until validation evidence exists

A high opportunity score can therefore be rejected by the meta layer when the
same type of signal has not demonstrated useful out-of-sample performance.


## V6.1 calibration engine
V6.1 adds probability calibration on top of the deterministic V6 walk-forward validator.
- Converts model confidence into a raw probability proxy centered on the 50% Even/Odd base rate.
- Builds market-specific reliability bins from walk-forward predictions only.
- Uses smoothed empirical outcomes to avoid overreacting to tiny samples.
- Reports Brier score, Expected Calibration Error (ECE), accuracy, calibration quality, and sample count.
- Produces a calibrated probability for the current leader instead of treating raw confidence as a true probability.
- Recalibrates periodically while keeping the live scanner lightweight.
- No future ticks are used to calibrate a historical prediction.
