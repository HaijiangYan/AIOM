const { Experiment } = require('./core/experiment');
const { ExperimentConfig } = require('./core/config');
const { pool } = require('./core/database');

// Export main classes
module.exports = {
    Experiment,
    ExperimentConfig,
    // export controller for customization
    BaseController: require('./controllers/base_controller').Controller,
    pool,

    // Helper function to create experiment
    createExperiment: (options = {}) => {
        return new Experiment(options);
    },
};