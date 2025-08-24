const { BaseController } = require('aiom');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this.stimuli_path = path.join(this.expPath, 'stimuli');  
        this.task = task;
        // this.stimuli_path should contain two .txt files as the comparison groups
        // each line in a .txt file should contain one stimulus, separated by new lines
        this.stimuli = this._txt2list(path.join(this.stimuli_path, 'materials.txt'));
        this.colnames = this.stimuli.map((_, i) => `text_${i + 1}`);
        this.rating_levels = 7; // e.g., 7-point Likert scale
        this.n_rest = 200;
        // initialize
        this._initialize();
    }

    // make sure that all internal functions (not exposed via API) are starting with a '_'
    async _initialize() {
        // set up database and basic settings for the current task in the back-end
        try {
            // Create table if it doesn't exist
            const baseColumns = [
                { name: 'id', type: 'SERIAL PRIMARY KEY' },
                { name: 'participant', type: 'TEXT UNIQUE NOT NULL' }
            ];
            const stimulusColumns = this.colnames.flatMap(colname => [
                { name: colname, type: 'INTEGER' }
            ]);
            await this._DB_create_table(this.task, [...baseColumns, ...stimulusColumns]);
        } catch (error) {
            console.error(`Error setting up ${this.task} database:`, error);
        }
    }

    async set_up(req, res, next) {
        // 'api/task/set_up'
        // handle request from the front-end and send stimuli to client
        const name = req.body.names;
        try {
            await this._DB_add_row(this.task, 
                { participant: name }, 
                { 
                    onConflict: { 
                        columns: 'participant', 
                        action: 'nothing' 
                    } 
                }
            );
            res.status(200).json({
                "rating_levels": this.rating_levels,
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
        try {
            const participant = await this._DB_get_row(this.task, { participant: name });
            const null_colnames = this.colnames.filter(colname => participant.rows[0][colname] === null);
            const selected_index = this.colnames.indexOf(this._random_choice(null_colnames));
            const selected_stimulus = this.stimuli[selected_index];

            res.status(200).json({
                "selected_index": selected_index,
                "stimulus": selected_stimulus
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
        const n_trial = req.header('n_trial');
        const rating = req.body.rating;
        const stimulus_index = req.header('stimulus_index');
        try {
            await this._DB_update_row(this.task, { [this.colnames[stimulus_index]]: rating }, { participant: name });
            if (n_trial < this.stimuli.length) {
                res.status(200).json({"finish": 0, "progress": n_trial/this.stimuli.length});
            } else {
                res.status(200).json({"finish": 1, "progress": 0});
            }
        } catch (error) {
            next(error);
        }
    }
}

module.exports = { Controller };