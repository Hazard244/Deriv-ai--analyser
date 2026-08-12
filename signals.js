// ==========================================
// DERIV AI - SIGNAL ENGINE v1.0
// ==========================================

const Signals = {

    generate(history) {

        const stats = Statistics.analyze(history);
        const patterns = Patterns.analyze(history);

        let score = 50;
        const reasons = [];

        // ---------- Probability ----------
        const p100 = stats.w100;

        if (p100.evenProbability >= 60) {
            score += 10;
            reasons.push("Strong EVEN probability");
        }

        if (p100.oddProbability >= 60) {
            score += 10;
            reasons.push("Strong ODD probability");
        }

        // ---------- Momentum ----------
        if (stats.momentum > 8) {
            score += 10;
            reasons.push("Positive momentum");
        }

        if (stats.momentum < -8) {
            score += 10;
            reasons.push("Negative momentum");
        }

        // ---------- Imbalance ----------
        if (Math.abs(stats.imbalance) >= 8) {
            score += 8;
            reasons.push("Market imbalance detected");
        }

        // ---------- Entropy ----------
        if (stats.entropy < 45) {
            score += 8;
            reasons.push("Low randomness");
        }

        // ---------- Streak ----------
        if (patterns.streak.length >= 4) {
            score += 6;
            reasons.push(
                patterns.streak.type +
                " streak (" +
                patterns.streak.length +
                ")"
            );
        }

        // ---------- Alternation ----------
        if (patterns.alternation.score >= 70) {
            score += 5;
            reasons.push("Alternating pattern");
        }

        if (score > 100) score = 100;

        // ---------- Decision ----------
        let decision = "WAIT";

        if (score >= 65)
            decision = "PREPARE";

        if (score >= 80)
            decision = "EARLY";

        if (score >= 90)
            decision = "ENTER";

        // ---------- Direction ----------
        let direction =
            p100.evenProbability >= p100.oddProbability
                ? "EVEN"
                : "ODD";

        return {

            score,

            confidence: score,

            decision,

            direction,

            reasons,

            statistics: stats,

            patterns

        };

    }

};
