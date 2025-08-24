const { BaseController } = require('aiom');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        // Add your custom initialization here
        this.task = task;
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'disgust', 'fear', 'other'];
        this.n_trial = 10;
        this.n_rest = 200;
        this.modality = 'image';
        this.imageurl = 'http://localhost:8000';
        this.stimuli_processing = this._latent2image_batch;
        this.dim = 8; // Number of dimensions for the stimuli
        this.range = {
            "0": [-10, 10], 
            "1": [-10, 10], 
            "2": [-10, 10], 
            "3": [-10, 10],
            "4": [-10, 10], 
            "5": [-10, 10], 
            "6": [-10, 10], 
            "7": [-10, 10]
        };
        // initialize
        this._initialize();
    }

    // make sure that all internal functions (not exposed via API) are starting with a '_'
    async _initialize() {
        // set up database and basic settings for the current task in the back-end
        try {
            await this._DB_add_column('participants', 'rc_attendance', 'BOOLEAN NOT NULL DEFAULT FALSE');
            // console.log(`✅ ${this.task} initialized successfully.`);
        } catch (error) {
            console.error(`Error setting up ${this.task} database:`, error);
        }
    }

    async set_up(req, res, next) {
        // 'api/task/set_up'
        // handle request from the front-end and send stimuli to client
        const name = req.body.names;
        const table_name = `${name}_${this.task}`;
        try {
            await this._DB_update_row('participants', { rc_attendance: true }, { participant: name });
            const columns = [
                { name: 'id', type: 'SERIAL PRIMARY KEY' },
                { name: 'sample', type: 'JSON NOT NULL' },
                { name: 'categorization', type: 'TEXT' }, 
                { name: 'intensity', type: 'INTEGER' }
            ];
            await this._DB_create_table(table_name, columns);
            res.status(200).json({
                "classes": this.classes, 
                "n_rest": this.n_rest, 
            });
        } catch (error) {
            next(error);
        }
    }

    // Override existing methods
    async get_stimuli(req, res, next) {
        // 'api/task/get_stimuli'
        // handle request from the front-end and send stimuli to client
        const name = req.header('ID');
        const table_name = `${name}_${this.task}`;
        try {
            const sample = this._uniform_array_ranges(this.dim, this.range);
            await this._DB_add_row(table_name, {
                sample: JSON.stringify(sample)
            });
            const pcx = await this.stimuli_processing([sample]);
            res.status(200).json({
                "stimulus": pcx[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Override register_choices if needed
    async register_choices(req, res, next) {
        // 'api/task/register_choices'
        // receive the participant's choices and update the database and count the number of trials
        const name = req.header('ID');
        const table_name = `${name}_${this.task}`;
        const n_trial = req.header('n_trial');
        const selected = req.body.choice; 
        const intensity = req.body.intensity;
        // const reaction_time = req.body.rt;
        try {
            await this._DB_update_last_row(table_name, {
                categorization: selected,
                intensity: intensity,
            });

            if (n_trial < this.n_trial) {
                res.status(200).json({"finish": 0, "progress": n_trial/this.n_trial});
            } else {
                res.status(200).json({"finish": 1, "progress": 0});
            }
        } catch (error) {
            next(error);
        }
    }
}

module.exports = { Controller };