// ==========================================
// DERIV AI - PATTERN ENGINE v1.0
// ==========================================

const Patterns = {

    analyze(history) {

        return {

            streak: this.detectStreak(history),

            transitions: this.transitionMatrix(history),

            alternation: this.detectAlternation(history),

            exhaustion: this.detectExhaustion(history)

        };

    },

    detectStreak(history) {

        if (history.length === 0)
            return {
                type: "NONE",
                length: 0
            };

        const lastParity =
            history[history.length - 1] % 2 === 0
                ? "EVEN"
                : "ODD";

        let length = 1;

        for (let i = history.length - 2; i >= 0; i--) {

            const parity =
                history[i] % 2 === 0
                    ? "EVEN"
                    : "ODD";

            if (parity === lastParity)
                length++;
            else
                break;

        }

        return {

            type: lastParity,

            length

        };

    },

    transitionMatrix(history) {

        let EE = 0;
        let EO = 0;
        let OE = 0;
        let OO = 0;

        for (let i = 1; i < history.length; i++) {

            const prev =
                history[i - 1] % 2 === 0
                    ? "E"
                    : "O";

            const curr =
                history[i] % 2 === 0
                    ? "E"
                    : "O";

            if (prev === "E" && curr === "E") EE++;
            if (prev === "E" && curr === "O") EO++;
            if (prev === "O" && curr === "E") OE++;
            if (prev === "O" && curr === "O") OO++;

        }

        return {

            EE,

            EO,

            OE,

            OO

        };

    },

    detectAlternation(history) {

        const recent = history.slice(-20);

        let alternating = 0;

        for (let i = 1; i < recent.length; i++) {

            if (
                (recent[i] % 2) !==
                (recent[i - 1] % 2)
            ) {

                alternating++;

            }

        }

        return {

            score:
                recent.length > 1
                    ? (alternating / (recent.length - 1)) * 100
                    : 0

        };

    },

    detectExhaustion(history) {

        const streak = this.detectStreak(history);

        return {

            exhausted:
                streak.length >= 6,

            streak

        };

    }

};
