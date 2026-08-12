// ==========================================
// DERIV AI - STATISTICS ENGINE v1.0
// ==========================================

const Statistics = {

    windows: [25, 50, 100, 250],

    analyze(history) {

        const result = {};

        this.windows.forEach(window => {

            const data = history.slice(-window);

            let even = 0;
            let odd = 0;

            data.forEach(digit => {

                if (digit % 2 === 0)
                    even++;
                else
                    odd++;

            });

            const total = data.length || 1;

            result["w" + window] = {

                total,

                even,

                odd,

                evenProbability:
                    (even / total) * 100,

                oddProbability:
                    (odd / total) * 100

            };

        });

        result.momentum =
            this.calculateMomentum(history);

        result.entropy =
            this.calculateEntropy(history);

        result.volatility =
            this.calculateVolatility(history);

        result.imbalance =
            this.calculateImbalance(history);

        return result;

    },

    calculateMomentum(history) {

        const recent = history.slice(-20);

        let score = 0;

        recent.forEach(digit => {

            score += digit % 2 === 0 ? 1 : -1;

        });

        return score;

    },

    calculateEntropy(history) {

        const recent = history.slice(-50);

        let changes = 0;

        for (let i = 1; i < recent.length; i++) {

            if ((recent[i] % 2) !== (recent[i - 1] % 2))
                changes++;

        }

        return recent.length > 1
            ? (changes / (recent.length - 1)) * 100
            : 0;

    },

    calculateVolatility(history) {

        const recent = history.slice(-30);

        let total = 0;

        for (let i = 1; i < recent.length; i++) {

            total += Math.abs(
                recent[i] - recent[i - 1]
            );

        }

        return recent.length > 1
            ? total / (recent.length - 1)
            : 0;

    },

    calculateImbalance(history) {

        const recent = history.slice(-50);

        let even = 0;
        let odd = 0;

        recent.forEach(digit => {

            digit % 2 === 0
                ? even++
                : odd++;

        });

        return even - odd;

    }

};
