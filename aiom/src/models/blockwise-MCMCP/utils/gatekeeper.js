// different kinds of gatekeepers here

class GaussianKDE {
    constructor(parameters, proposal_bandwidth) {
        this.tree_data = parameters.tree_data;
        this.bandwidth = proposal_bandwidth || parameters.bandwidth;
        this.dimensionality = parameters.dimensionality;
        this.n_samples = parameters.n_samples;
        
        // Calculate mean
        let mean = new Array(this.dimensionality).fill(0);
        for (let i = 0; i < this.tree_data.length; i++) {
            for (let j = 0; j < this.dimensionality; j++) {
                mean[j] += this.tree_data[i][j];
            }
        }
        for (let j = 0; j < this.dimensionality; j++) {
            mean[j] /= this.tree_data.length;
        }
        this.mean = mean;
    }

    /**
     * Numerically stable log-sum-exp.
     * @param {number[]} arr Array of numbers (logarithms).
     * @returns {number} log(sum(exp(arr_i))).
     */
    static logSumExp(arr) {
        if (arr.length === 0) return -Infinity;
        const maxVal = Math.max(...arr);
        if (maxVal === -Infinity) return -Infinity;

        let sumExp = 0;
        for (let i = 0; i < arr.length; i++) {
            sumExp += Math.exp(arr[i] - maxVal);
        }
        return maxVal + Math.log(sumExp);
    }

    /**
     * Evaluates the density function of the gaussian at the given point
     */
    density(x) {
        if (x.length !== this.dimensionality) {
            throw new Error(`Input point dimensionality (${x.length}) does not match model dimensionality (${this.dimensionality}).`);
        }
        
        const logKernelConstant = -this.dimensionality * Math.log(this.bandwidth) - (this.dimensionality / 2) * Math.log(2 * Math.PI);

        const logKernelTerms = this.tree_data.map(trainSample => {
            let squaredDistance = 0;
            for (let j = 0; j < this.dimensionality; j++) {
                const diff = x[j] - trainSample[j];
                squaredDistance += diff * diff;
            }
            const expArgument = -0.5 * squaredDistance / (this.bandwidth * this.bandwidth);
            return expArgument + logKernelConstant;
        });

        const logLikelihoodSum = GaussianKDE.logSumExp(logKernelTerms);

        if (logLikelihoodSum === -Infinity) {
            return -Infinity;
        }
        
        return logLikelihoodSum - Math.log(this.n_samples);
    }

    /**
     * Calculate acceptance probability for MCMC sampling
     */
    acceptance(current, proposal, temperature = 1.0) {
        const density_current = this.density(current);
        const density_proposal = this.density(proposal);
        return Math.exp(density_proposal / temperature) / (Math.exp(density_current / temperature) + Math.exp(density_proposal / temperature));
    }

    /**
     * Process proposal through gatekeeper with rejection sampling
     */
    // async processing(current_state, proposal, table_name, proposal_cov) {
    //     let trial_number;
    //     let current_proposal = proposal;
    //     let acceptance_rate = this.acceptance(current_state, current_proposal);
        
    //     while (Math.random() > acceptance_rate) {
    //         trial_number = await pool.query(
    //             `UPDATE ${table_name} SET picked = true, gatekeeper = true WHERE id = (
    //             SELECT id FROM ${table_name} ORDER BY id DESC OFFSET 1 LIMIT 1) 
    //             RETURNING trial;`,
    //         );
            
    //         // Generate new proposal
    //         current_proposal = transformer.limit_array_in_range(
    //             sampling.gaussian_array(current_state, proposal_cov), 
    //             { min: lower_bound, max: upper_bound }
    //         );
    //         acceptance_rate = this.acceptance(current_state, current_proposal);
            
    //         await pool.query(
    //             `INSERT INTO ${table_name} (trial, choices) 
    //             VALUES ($1, $2), ($3, $4)`,
    //             [
    //                 trial_number.rows[0].trial + 1, 
    //                 JSON.stringify(current_state), 
    //                 trial_number.rows[0].trial + 1, 
    //                 JSON.stringify(current_proposal)
    //             ]
    //         );
    //     }
        
    //     return current_proposal;
    // }

    /**
     * Sample a new point from the KDE
     */
    sampling() {
        // 1. Pick a Kernel (one of the original data points)
        const randomIndex = Math.floor(Math.random() * this.n_samples);
        const selectedKernelCenter = this.tree_data[randomIndex];
        
        // 2. Sample from that Kernel (add Gaussian noise scaled by bandwidth)
        const newSample = [];
        for (let i = 0; i < this.dimensionality; i++) {
            const noise = this.gaussianRandom() * this.bandwidth;
            const value = parseFloat((selectedKernelCenter[i] + noise).toFixed(2));
            newSample.push(value);
        }
        return newSample;
    }

    // Function to generate a Gaussian random number
    gaussianRandom(mean=0, stdDev=1) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
        while (v === 0) v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdDev + mean;
    }
}

module.exports = { GaussianKDE };