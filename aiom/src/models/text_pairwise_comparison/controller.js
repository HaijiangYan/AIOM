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
        this.stimuli_group_1 = this._txt2list(path.join(this.stimuli_path, 'group_1.txt'));
        this.stimuli_group_2 = this._txt2list(path.join(this.stimuli_path, 'group_2.txt'));
        this.n_trial = 100;
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
                { name: 'participant', type: 'TEXT UNIQUE NOT NULL' }, 
                { name: 'vote_group_1', type: 'INTEGER NOT NULL DEFAULT 0' },
                { name: 'vote_group_2', type: 'INTEGER NOT NULL DEFAULT 0' }
            ];
            await this._DB_create_table(this.task, baseColumns);
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
        try {
            // check if the participant already exists in the table
            const stimulus_group_1 = this._random_choice(this.stimuli_group_1);
            const stimulus_group_2 = this._random_choice(this.stimuli_group_2);
            res.status(200).json({
                "stimulus_group_1": stimulus_group_1,
                "stimulus_group_2": stimulus_group_2
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
        const selected = req.body.choice;
        try {
            await this._DB_update_row_plusone(this.task, `vote_group_${selected}`, { participant: name });
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