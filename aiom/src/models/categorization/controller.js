const { BaseController } = require('aiom');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this.stimuli_path = path.join(this.expPath, 'stimuli');
        // Add your custom initialization here
        this.task = task;
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.n_rest = 200;
        const files = fs.readdirSync(this.stimuli_path);
        this.colnames = files.map(file => file.split('.')[0]);
        this.postfix = files[0].split('.')[1];
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
                { name: colname, type: 'TEXT' },
                { name: `${colname}_conf`, type: 'INTEGER' },
                { name: `${colname}_rt`, type: 'INTEGER' }
            ]);
            await this._DB_create_table(this.task, [...baseColumns, ...stimulusColumns]);
            // console.log(`✅ ${this.task} initialized successfully.`);
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
        let selected_stimulus;
        try {
        // check if the participant already exists in the table
        const participant = await this._DB_get_row(this.task, { participant: name });
        const null_colnames = this.colnames.filter(colname => participant.rows[0][colname] === null);
        selected_stimulus = null_colnames[Math.floor(Math.random() * null_colnames.length)];
        const stimulus_path = path.join(this.stimuli_path, selected_stimulus + '.' + this.postfix);
        res.status(200).json({
            "filename": selected_stimulus,
            "stimulus": this._grab_image(stimulus_path)
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
        const filename = req.header('filename');
        const n_trial = req.header('n_trial');
        const selected = req.body.choice; 
        const confidence = req.body.confidence;
        const reaction_time = req.body.rt;
        const max_trial = this.colnames.length;
        try {
        await this._DB_update_row(this.task, {
            [filename]: selected,
            [`${filename}_conf`]: confidence,
            [`${filename}_rt`]: reaction_time
        }, { participant: name });

        if (n_trial < max_trial) {
            res.status(200).json({"finish": 0, "progress": n_trial/max_trial});
        } else {
            res.status(200).json({"finish": 1, "progress": 0});
        }
        } catch (error) {
        next(error);
        }
    }
}

module.exports = { Controller };