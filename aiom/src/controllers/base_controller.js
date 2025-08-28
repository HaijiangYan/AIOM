const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const axios = require('axios');
const { pool } = require('../core/database');

class Controller {
    constructor(experimentPath, task) {
        this.expPath = path.join(experimentPath, 'tasks', task);
        // this._initialize();
    }

    // make sure that all internal functions (not exposed via API) are starting with a '_'
    _initialize() {
        // Do nothing - customized in experiment directory
        // set up database and basic settings for the current task in the back-end
    }

    set_up(req, res, next) {
        // 'api/{task}/set_up'
        // Send the task-specific settings for the front-end and register the participant for the current task
        const name = req.body.names;
        try {
            res.status(200).json({
                "pid": name, 
            });
        } catch (error) {
            next(error);
        }
    }

    // make sure that all internal functions (not exposed via API) are starting with a '_'
    async _retryAsync(fn, args, context) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Call the function (e.g., stimuli_processing_batch)
                const result = await fn.apply(context || this, args);
                // If the function succeeds, return the result immediately
                return result; 
            } catch (error) {
                console.warn(`Attempt ${attempt} failed for ${fn.name}: ${error.message}`);
                if (attempt === 3) {
                    console.error(`All ${attempt} retries failed.`);
                    throw error;
                }
                // Wait for the specified delay before the next attempt
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // return a raw array input itself
    _raw(array) {
        return array;
    }

    _grab_image(path_img) {
        // get image data from the path
        const imageData = fs.readFileSync(path_img);
        const base64 = Buffer.from(imageData).toString('base64');
        return `data:image/png;base64,${base64}`;
    }

    _grab_text(path_txt) {
        // get text data from the path
        const textData = fs.readFileSync(path_txt, 'utf-8');
        return textData;
    }

    _txt2list(filePath) {
        const textData = this._grab_text(filePath);
        return textData.split('\n').map(line => line.trim()).filter(line => line);
    }

    _random_choice(array) {
        const randomIndex = Math.floor(Math.random() * array.length);
        return array[randomIndex];
    }

    // _latent2image(array) {
    //     // send a latent to a image generation service and get the image
    //     const url = this.imageurl+'/generate';
    //     return axios.post(url, {
    //         vector: array,
    //     }, {headers: {
    //         'accept': 'application/json', 
    //         'Content-Type': 'application/json',
    //         },
    //         responseType: 'json',
    //     })
    //     .then(response => {
    //         if (!response.data.image) {
    //             console.error('Invalid response format from image generation service:', response.data);
    //             throw new Error('Invalid response from image generation service.');
    //         }
    //         return {
    //             image: `data:image/png;base64,${response.data.image}`, 
    //             posterior: response.data.pred_label,
    //         };
    //     })
    //     .catch((error) => {
    //         console.error('Error:', error);
    //         throw error;
    //     });
    // }

    _latent2image_batch(obj) {
        const url = this.imageurl+'/generate_batch';
        return axios.post(url, {
            vector: obj,
        }, {headers: {
            'accept': 'application/json', 
            'Content-Type': 'application/json',
            },
            responseType: 'json',
        })
        .then(response => {
            if (!response.data.images[0]) {
                console.error('Invalid response format from image generation service:', response.data);
                throw new Error('Invalid response from image generation service.');
            }
            return response.data.images.map(img => `data:image/png;base64,${img}`);
        })
        .catch((error) => {
            console.error('Error:', error);
            // throw error;
            return obj.map(() => this._noise_image());
        });
    }

    _noise_image(width=64, height=64) {
        const noiseCanvas = createCanvas(width, height);
        const ctx = noiseCanvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const value = Math.random() * 255;
            imageData.data[i] = value;     // R
            imageData.data[i + 1] = value; // G
            imageData.data[i + 2] = value; // B
            imageData.data[i + 3] = 255;   // A
        }
        ctx.putImageData(imageData, 0, 0);
        return noiseCanvas.toDataURL();
    }

    // Shuffle an array
    _shuffle(array) {
        let currentIndex = array.length;
        while (currentIndex != 0) {
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // Generate a uniform random array
    _uniform_array(x, min=0, max=1) {
        return Array(x).fill().map(() => parseFloat((Math.random() * (max - min) + min).toFixed(2)));
    }

    // Generate a uniform random array within specified ranges
    _uniform_array_ranges(dim, ranges) {
        return Array.from({ length: dim }, (_, i) => {
            const [min, max] = ranges[i];
            return parseFloat((Math.random() * (max - min) + min).toFixed(2));
        });
    }

    // Generate a multivariate Gaussian random number
    _multivariate_gaussian_array(mean, cov) {
        const distribution = MultivariateNormal(mean, cov);
        const sample = distribution.sample();
        return parseFloat(sample.toFixed(2));
    }

    // Calculate the Euclidean distance between two arrays
    _euclideanDistance(a, b) {
        if (a.length !== b.length) {
            throw new Error('Arrays must have the same length');
        }
        return Math.sqrt(
            a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
        );
    }

    // Sample from a discrete distribution
    _sampleFromDistribution(probabilities) {
        const cumulativeProbabilities = [];
        let cumulativeSum = 0;
        for (let i = 0; i < probabilities.length; i++) {
            cumulativeSum += probabilities[i]; 
            cumulativeProbabilities.push(cumulativeSum);
        }
        
        const randomValue = Math.random() * cumulativeSum;
        for (let i = 0; i < cumulativeProbabilities.length; i++) {
            if (randomValue < cumulativeProbabilities[i]) {
                return i; // Return the index of the sampled item
            }
        }
        return null; // If no item is sampled, return null
    }

    // Limit array values to a specific range
    _limit_array_in_range(array, min, max) {
        return array.map((val) => {
            if (val < min) {
                const remainder = Math.abs(val-min) % (max-min);
                return max - remainder;
            }
            if (val > max) {
                const remainder = Math.abs(val-max) % (max-min);
                return min + remainder;
            }
            return val;
        });
    }

    // Create a shifted array
    _createShiftedArray(length, start) {
        return Array.from(Array(length).keys()).map(i => (i + start) % length);
    }

    // Calculate the mean of an array of arrays
    _calculateMean(arrays) {
    const length = arrays.length;
    const sum = arrays.reduce((acc, array) => {
        return acc.map((val, idx) => val + array[idx]);
    }, new Array(arrays[0].length).fill(0));
    return sum.map(val => val / length);
    }

    // Calculate the mode of an array of arrays
    _calculateMode(arrays) {
    const frequencyMap = arrays.flat().reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});
    const mode = Object.keys(frequencyMap).reduce((a, b) => frequencyMap[a] > frequencyMap[b] ? a : b);
    return mode;
    }

    _DB_create_table(tableName, columns) {
        const columnDefinitions = columns.map(col => `"${col.name}" ${col.type}`).join(', ');
        return pool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions});`);
    }

    _DB_add_column(tableName, columnName, columnType) {
        return pool.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${columnName}" ${columnType};`);
    }

    _DB_add_columns(tableName, columns) {
        // Handle single column object
        if (!Array.isArray(columns)) {
            return this._DB_add_column(tableName, columns.name, columns.type);
        }
        // Handle multiple columns array
        const promises = columns.map(col => 
            this._DB_add_column(tableName, col.name, col.type)
        );
        return Promise.all(promises);
    }

    _DB_remove_column(tableName, columnName) {
        return pool.query(`ALTER TABLE ${tableName} DROP COLUMN IF EXISTS "${columnName}";`);
    }

    _DB_add_row(tableName, row, options = {}) {
        const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
        const placeholders = Object.keys(row).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(row);
        let query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
        
        // Handle ON CONFLICT
        if (options.onConflict) {
            const conflictColumns = Array.isArray(options.onConflict.columns) 
                ? options.onConflict.columns.map(col => `"${col}"`).join(', ')
                : `"${options.onConflict.columns}"`;
            query += ` ON CONFLICT (${conflictColumns})`;
            if (options.onConflict.action === 'nothing') {
                query += ' DO NOTHING';
            } else if (options.onConflict.action === 'update') {
                const updateClauses = Object.keys(row)
                    .filter(key => !options.onConflict.columns.includes(key))
                    .map(key => `"${key}" = EXCLUDED."${key}"`)
                    .join(', ');
                query += ` DO UPDATE SET ${updateClauses}`;
            }
        }
        
        query += ';';
        return pool.query(query, values);
    }

    _DB_add_rows(tableName, rows) {
        if (rows.length === 0) return Promise.resolve();
        const columns = Object.keys(rows[0]).map(col => `"${col}"`).join(', ');
        const placeholderRows = rows.map((_, rowIndex) => {
            const placeholders = Object.keys(rows[0]).map((_, colIndex) => 
                `$${rowIndex * Object.keys(rows[0]).length + colIndex + 1}`
            ).join(', ');
            return `(${placeholders})`;
        }).join(', ');
        const values = rows.flatMap(row => Object.values(row));
        return pool.query(`INSERT INTO ${tableName} (${columns}) VALUES ${placeholderRows};`, values);
    }

    _DB_get_row(tableName, selectors, columns = '*') {
        const whereConditions = Object.keys(selectors).map((key, index) => `"${key}" = $${index + 1}`);
        const whereClause = whereConditions.join(' AND ');
        const values = Object.values(selectors);
        return pool.query(`SELECT ${columns} FROM ${tableName} WHERE ${whereClause}`, values);
    }

    _DB_get_latest_row(tableName, columns = '*') {
        return pool.query(`SELECT ${columns} FROM ${tableName} ORDER BY id DESC LIMIT 1`);
    }

    _DB_get_first_row(tableName, columns = '*') {
        return pool.query(`SELECT ${columns} FROM ${tableName} ORDER BY id ASC LIMIT 1`);
    }

    _DB_update_row_plusone(tableName, column, selectors) {
        if (typeof selectors === 'string') {
            // Handle single selector string (backward compatibility)
            return pool.query(`UPDATE ${tableName} SET ${column} = ${column} + 1 WHERE ${selectors}`);
        }
        // Handle object-based selectors with parameters
        const whereConditions = Object.keys(selectors).map((key, index) => `"${key}" = $${index + 1}`);
        const whereClause = whereConditions.join(' AND ');
        const values = Object.values(selectors);
        return pool.query(`UPDATE ${tableName} SET ${column} = ${column} + 1 WHERE ${whereClause}`, values);
    }

    _DB_update_row(tableName, col_values, selectors) {
        const setClause = Object.keys(col_values).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
        const whereConditions = Object.keys(selectors).map((key, index) => `"${key}" = $${index + 1 + Object.keys(col_values).length}`);
        const whereClause = whereConditions.join(' AND ');
        return pool.query(`UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`, [...Object.values(col_values), ...Object.values(selectors)]);
    }

    _DB_update_last_row(tableName, col_values) {
        const setClause = Object.keys(col_values).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
        return pool.query(`UPDATE ${tableName} SET ${setClause} WHERE id = (SELECT id FROM ${tableName} ORDER BY id DESC LIMIT 1)`, Object.values(col_values));
    }
}

module.exports = { Controller };