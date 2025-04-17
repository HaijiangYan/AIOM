const MultivariateNormal = require("multivariate-normal").default;

// Function to generate a Gaussian random number
function gaussianRandom(mean=0, stdDev=1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
}

function uniform_array(x, min=0, max=1) {
    return Array(x).fill().map(() => Math.random() * (max - min) + min);
}

// function to generate a uniform array with each item in different ranges, ranges={'0', [0, 1], '1', [0, 2]}
function uniform_array_ranges(x, ranges) {
    return Array(x).fill().map((_, i) => {
        const range = ranges[Object.keys(ranges)[i]]; // Get the range for the current index 
        const min = range[0];
        const max = range[1];
        return Math.random() * (max - min) + min; // Generate a random number in the range
    }
    );
}

function gaussian_array(mean, cov) {
    const distribution = MultivariateNormal(mean, cov);
    return distribution.sample();
}

function shuffle(array) {
    let currentIndex = array.length;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Function to create array with custom start position
function createShiftedArray(length, start) {
    return Array.from(Array(length).keys()).map(i => (i + start) % length);
}

function calculateMean(arrays) {
  const length = arrays.length;
  const sum = arrays.reduce((acc, array) => {
    return acc.map((val, idx) => val + array[idx]);
  }, new Array(arrays[0].length).fill(0));

  return sum.map(val => val / length);
}

function calculateMode(arrays) {
  const frequencyMap = arrays.flat().reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  const mode = Object.keys(frequencyMap).reduce((a, b) => frequencyMap[a] > frequencyMap[b] ? a : b);
  return mode;
}

module.exports = {uniform_array_ranges, gaussianRandom, uniform_array, gaussian_array, shuffle, createShiftedArray, calculateMean, calculateMode};