const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

class ExperimentConfig {
    constructor(envPath, scope='global') {
        this.envPath = envPath;
        this.scope = scope;
        this.env = {};
        this.loadConfig();
    }

    loadConfig() {
        // Load .env file
        if (fs.existsSync(this.envPath)) {
            if (this.scope === 'global') {
                dotenv.config({ path: this.envPath });
            } else if (this.scope === 'local') {
                this.env = dotenv.parse(fs.readFileSync(this.envPath));
            } else {
                throw new Error(`Unknown scope: ${this.scope}. Use 'global' or 'local'.`);
            }
        }
    }

    set(key, value) {
        this.scope === 'global' ? process.env[key] = value : this.env[key] = value;
    }
    
    get(key) {
        return this.scope === 'global' ? process.env[key] : this.env[key];
    }
    
    getArray(key, separator = '|') {
        const value = this.get(key);
        return value ? value.split(separator) : [];
    }
    
    getBoolean(key) {
        return this.get(key) === 'true';
    }
    
    getNumber(key) {
        return parseInt(this.get(key), 10);
    }

    getFloat(key) {
        return parseFloat(this.get(key));
    }
}

module.exports = { ExperimentConfig };