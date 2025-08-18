const fs = require('fs');
const path = require('path');

/**
 * Calculates the Gelman-Rubin convergence diagnostic (R-hat) for two chains.
 * Assumes array1 and array2 are arrays of samples, where each sample is an array of parameters,
 * and each parameter can be multidimensional.
 * Example structure: array[sample_index][parameter_group_index][parameter_value_index]
 *
 * @param {number[][][]} array1 - The first chain of samples.
 * @param {number[][][]} array2 - The second chain of samples.
 * @returns {number[][] | null} A 2D array containing the R-hat values for each parameter,
 *                              or null if inputs are invalid (e.g., n <= 1).
 */
function gr_convergence(array1, array2) {
    // Basic validation
    if (!array1 || !array2 || array1.length === 0 || array1.length !== array2.length) {
        console.error("Invalid input arrays: Mismatched lengths or empty arrays.");
        return null;
    }
    const n = array1.length; // Number of samples per chain
    if (n <= 1) {
        console.error("Invalid input arrays: Need more than 1 sample (n > 1).");
        return null;
    }
    if (!array1[0] || !array2[0] || array1[0].length !== array2[0].length) {
        console.error("Invalid input arrays: Mismatched parameter group lengths.");
        return null;
    }
    const m = array1[0].length; // Number of parameter groups
    if (m === 0) {
        console.error("Invalid input arrays: No parameter groups found.");
        return null;
    }
     if (!array1[0][0] || !array2[0][0] || array1[0][0].length !== array2[0][0].length) {
        console.error("Invalid input arrays: Mismatched parameter value lengths.");
        return null;
    }
    const k = array1[0][0].length; // Number of dimensions per parameter
     if (k === 0) {
        console.error("Invalid input arrays: No parameter values found.");
        return null;
    }

    const num_chains = 2;

    // Initialize arrays for means and variances
    const mean1 = Array.from({ length: m }, () => Array(k).fill(0));
    const mean2 = Array.from({ length: m }, () => Array(k).fill(0));
    const var1 = Array.from({ length: m }, () => Array(k).fill(0));
    const var2 = Array.from({ length: m }, () => Array(k).fill(0));

    // Calculate chain means
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
            for (let l = 0; l < k; l++) {
                mean1[j][l] += array1[i][j][l];
                mean2[j][l] += array2[i][j][l];
            }
        }
    }
    for (let j = 0; j < m; j++) {
        for (let l = 0; l < k; l++) {
            mean1[j][l] /= n;
            mean2[j][l] /= n;
        }
    }

    // Calculate chain variances (s_j^2)
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
            for (let l = 0; l < k; l++) {
                var1[j][l] += Math.pow(array1[i][j][l] - mean1[j][l], 2);
                var2[j][l] += Math.pow(array2[i][j][l] - mean2[j][l], 2);
            }
        }
    }
    for (let j = 0; j < m; j++) {
        for (let l = 0; l < k; l++) {
            // Use (n-1) for sample variance
            var1[j][l] /= (n - 1);
            var2[j][l] /= (n - 1);
        }
    }

    // Calculate Within-chain variance (W)
    const W = Array.from({ length: m }, () => Array(k).fill(0));
    for (let j = 0; j < m; j++) {
        for (let l = 0; l < k; l++) {
            W[j][l] = (var1[j][l] + var2[j][l]) / num_chains;
        }
    }

    // Calculate Between-chain variance component (B/n)
    // B = n * variance(chain means)
    // For 2 chains, B = n * ( (mean1 - mean_overall)^2 + (mean2 - mean_overall)^2 ) / (num_chains - 1)
    // B = n * ( (mean1 - (m1+m2)/2)^2 + (mean2 - (m1+m2)/2)^2 )
    // B = n * ( ((m1-m2)/2)^2 + ((m2-m1)/2)^2 )
    // B = n * ( (m1-m2)^2 / 4 + (m1-m2)^2 / 4 ) = n * (m1-m2)^2 / 2
    // So, B/n = (mean1 - mean2)^2 / 2
    const B_over_n = Array.from({ length: m }, () => Array(k).fill(0));
     for (let j = 0; j < m; j++) {
        for (let l = 0; l < k; l++) {
            B_over_n[j][l] = Math.pow(mean1[j][l] - mean2[j][l], 2) / num_chains;
        }
    }

    // Calculate Estimated variance (Var_hat) and R-hat
    const R_hat = Array.from({ length: m }, () => Array(k).fill(NaN)); // Initialize with NaN
    for (let j = 0; j < m; j++) {
        for (let l = 0; l < k; l++) {
            const W_jl = W[j][l];
            const B_over_n_jl = B_over_n[j][l];

            // Estimated variance: Var_hat = (n-1)/n * W + B/n
            const Var_hat_jl = ((n - 1) / n) * W_jl + B_over_n_jl;

            // R-hat = sqrt( Var_hat / W )
            if (W_jl > 0) { // Avoid division by zero
                R_hat[j][l] = Math.sqrt(Var_hat_jl / W_jl);
            } else if (Var_hat_jl === 0) {
                 // If W is 0 and Var_hat is 0, chains are identical constants, R_hat is 1
                 R_hat[j][l] = 1.0;
            }
            // Otherwise, leave as NaN if W is 0 but Var_hat is not (shouldn't happen if B>=0)
        }
    }

    return R_hat;
}

/**
 * Estimates the variance of the sample mean for a potentially autocorrelated series
 * using the batch means method.
 *
 * @param {number[]} series - The time series of samples for a single parameter.
 * @param {number} [numBatches=30] - The number of batches to divide the series into.
 * @returns {number} The estimated variance of the sample mean, or NaN if calculation fails.
 */
function estimateVarianceOfMean_BatchMeans(series, numBatches = 30) {
    const n = series.length;

    // Need at least 2 samples per batch on average, and at least 2 batches
    if (n < 2 * numBatches || numBatches < 2) {
        console.warn(`Batch means: Not enough samples (${n}) for ${numBatches} batches. Falling back to simple variance.`);
        if (n < 2) return NaN;
        
        // Fallback to simple variance of mean (assuming independence)
        const mean = series.reduce((a, b) => a + b, 0) / n;
        const variance = series.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
        return variance / n; // Variance of the sample mean estimate
    }

    const batchSize = Math.floor(n / numBatches);
    const batchMeans = [];
    
    // Calculate mean for each batch
    for (let i = 0; i < numBatches; i++) {
        const start = i * batchSize;
        // Ensure the last batch includes any remaining samples
        const end = (i === numBatches - 1) ? n : (i + 1) * batchSize;
        
        if (start >= end) continue; // Skip if batch is empty (shouldn't happen with checks above)
        
        const batch = series.slice(start, end);
        const batchMean = batch.reduce((a, b) => a + b, 0) / batch.length;
        batchMeans.push(batchMean);
    }

    // Need at least 2 batch means to calculate variance
    if (batchMeans.length < 2) {
        console.warn(`Batch means: Could not form at least 2 batches.`);
        return NaN;
    }

    // Calculate the variance of the batch means
    const overallMeanOfBatches = batchMeans.reduce((a, b) => a + b, 0) / batchMeans.length;
    const varianceOfBatchMeans = batchMeans.reduce((sum, mean) => 
        sum + Math.pow(mean - overallMeanOfBatches, 2), 0) / (batchMeans.length - 1);

    // The variance of the overall sample mean is estimated by the variance of batch means 
    // divided by the number of batches
    return varianceOfBatchMeans / batchMeans.length;
}

/**
 * Calculates the Geweke convergence diagnostic for a chain of N-dimensional points.
 * Works with chains of form [[x1, y1, z1, ...], [x2, y2, z2, ...], ...] with any number of dimensions.
 * 
 * @param {number[][]} chainND - The chain samples where each element is an N-dimensional point
 * @param {number} [frac1=0.1] - Fraction of the chain for the first window (e.g., first 10%)
 * @param {number} [frac2=0.5] - Fraction of the chain for the second window (e.g., last 50%)
 * @param {number} [numBatches=30] - Number of batches for variance estimation
 * @returns {number[] | null} Array of Z-scores for each dimension, or null if invalid
 */
function gewekeDiagnostic(chainND, frac1 = 0.1, frac2 = 0.5, numBatches = 30) {
    // --- Basic Validation ---
    if (!chainND || !Array.isArray(chainND) || chainND.length === 0) {
        console.error("GewekeND: Invalid input chain");
        return null;
    }

    // Verify each sample is a point with consistent dimensions
    if (!Array.isArray(chainND[0])) {
        console.error("GewekeND: Expected chain elements to be arrays");
        return null;
    }
    
    const dimension = chainND[0].length; // Number of dimensions in each point
    if (dimension < 1) {
        console.error("GewekeND: Points must have at least one dimension");
        return null;
    }

    // Validate all samples have same dimensionality
    for (let i = 1; i < chainND.length; i++) {
        if (!Array.isArray(chainND[i]) || chainND[i].length !== dimension) {
            console.error(`GewekeND: Inconsistent dimensionality at sample ${i}. Expected ${dimension} dimensions.`);
            return null;
        }
    }

    const n = chainND.length; // Total number of samples

    if (frac1 <= 0 || frac1 >= 1 || frac2 <= 0 || frac2 >= 1 || frac1 + frac2 > 1) {
        console.error("GewekeND: Invalid fractions. Ensure 0 < frac1 < 1, 0 < frac2 < 1, and frac1 + frac2 <= 1");
        return null;
    }

    // Determine window sizes and positions
    const n1 = Math.floor(n * frac1);
    const n2Start = Math.floor(n * (1 - frac2));
    const n2 = n - n2Start; // Size of the second window

    // Check if windows are valid and non-overlapping
    if (n1 < 2 || n2 < 2 || n1 + n2 > n) {
        console.error(`GewekeND: Not enough samples for the specified fractions (n=${n}, n1=${n1}, n2=${n2}). Need at least 2 samples per window.`);
        return null;
    }

    // For each dimension, calculate Geweke Z-score
    const zScores = Array(dimension).fill(NaN); // Initialize with NaN for each dimension

    for (let dim = 0; dim < dimension; dim++) {
        // Extract the time series for the current dimension
        const paramSeries = chainND.map(sample => {
            if (!Array.isArray(sample) || typeof sample[dim] !== 'number') {
                throw new Error(`GewekeND: Invalid data structure at dimension ${dim}`);
            }
            return sample[dim];
        });

        // Extract windows for this dimension
        const windowA = paramSeries.slice(0, n1);
        const windowB = paramSeries.slice(n2Start); // From n2Start to the end

        // Calculate means
        const meanA = windowA.reduce((a, b) => a + b, 0) / n1;
        const meanB = windowB.reduce((a, b) => a + b, 0) / n2;

        // Estimate variance of the means using batch means
        const varMeanA = estimateVarianceOfMean_BatchMeans(windowA, numBatches);
        const varMeanB = estimateVarianceOfMean_BatchMeans(windowB, numBatches);

        // Calculate Z-score
        if (!isNaN(varMeanA) && !isNaN(varMeanB) && (varMeanA + varMeanB > 0)) {
            zScores[dim] = (meanA - meanB) / Math.sqrt(varMeanA + varMeanB);
        } else if (meanA === meanB) {
            zScores[dim] = 0; // If means are identical, Z is 0
        } else {
            console.warn(`GewekeND: Could not calculate Z-score for dimension ${dim} due to variance estimation issues.`);
        }
    }

    return zScores;
}

/**
 * Tests if an N-dimensional chain has converged based on Geweke diagnostic.
 *
 * @param {number[][]} chainND - The chain with N-dimensional points
 * @param {number} [threshold=1.96] - Z-score threshold for convergence (1.96 = 95% confidence)
 * @returns {Object} Result object with overall status and per-dimension results
 */
function isConverged(chainND, threshold = 1.96) {
    const zScores = gewekeDiagnostic(chainND, frac1=0.2, frac2=0.5, numBatches=20);
    const dimension = zScores.length;
    const dimensionResults = [];
    let allConverged = true;
    
    zScores.forEach((z, i) => {
        const converged = !isNaN(z) && Math.abs(z) < threshold;
        if (!converged) allConverged = false;
        
        const result = {
            dimension: i,
            zScore: isNaN(z) ? null : parseFloat(z.toFixed(4)),
            converged: converged
        };
        dimensionResults.push(result);
    });
    
    return {
        converged: allConverged,
        results: dimensionResults
    };
}

module.exports = { gr_convergence, gewekeDiagnostic, isConverged };