const { BaseController } = require('aiom');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this.task = task;
        // Initialize experiment settings
        /////////////////////// GSP settings ///////////////////////
        this.imageurl = 'http://localhost:8000';
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
        this.resolution = {
            "0": 10, 
            "1": 10, 
            "2": 10,
            "3": 10,
            "4": 10,
            "5": 10,
            "6": 10,
            "7": 10,
            "8": 10,
            "9": 10,
            "10": 10,
            "11": 10,
            "12": 10,
            "13": 10,
            "14": 10,
            "15": 10
        };
        this.dim = Object.keys(this.range).length;
        this.n_chain = 1;  // n chains per class
        this.n_rest = 50;
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.class_question = {};
        for (let i=0; i<this.classes.length; i++) {
            this.class_question[this.classes[i]] = `Adjust the slider to match the following word as well as possible: ${this.classes[i]}`;
        }
        this.n_sample_per_class = 2; // number of trials will be n_sample_per_class * n_class * dim
        // function for getting stimuli
        this.stimuli_processing = this._latent2image_batch;
        /////////////////////////////////////////////////////////////
        // initialize
        this._initialize();
    }

    // make sure that all internal functions (not exposed via API) are starting with a '_'
    async _initialize() {
        // set up database and basic settings for the current task in the back-end
        try {
            // add a column in the participants table to track attendance of GSP-prior
            await this._DB_add_column('participants', 'gspp_attendance', 'BOOLEAN NOT NULL DEFAULT FALSE');
            // console.log(`✅ ${this.task} initialized successfully.`);
        } catch (error) {
          console.error(`Error setting up ${this.task} database:`, error);
        }
    }

    async set_up(req, res, next) {
        // 'api/task/set_up'
        // handle request from the front-end and send stimuli to client
        const name = req.body.pid;
        var table_name, starting_point, starting_category;
        try {
            // Mark participant as attending GSP-prior
            await this._DB_update_row('participants', { gspp_attendance: true }, { participant: name });
            for (let i=1; i<=this.n_chain; i++) {
                table_name = `${name}_gsp_prior_no${i}`;
                const columns = [
                    { name: 'id', type: 'SERIAL PRIMARY KEY' },
                    { name: 'sample', type: 'JSON NOT NULL' },
                    { name: 'current_dim', type: 'INTEGER NOT NULL' }, 
                    { name: 'current_category', type: 'TEXT NOT NULL' }
                ];
                await this._DB_create_table(table_name, columns); 
                // add starting point
                starting_point = this._uniform_array_ranges(this.dim, this.range);
                starting_category = this.classes[Math.floor(Math.random() * this.classes.length)]; 
                await this._DB_add_row(table_name, {
                    sample: JSON.stringify(starting_point),
                    current_dim: 0, 
                    current_category: starting_category
                });
            }
            res.status(200).json({
                "class_question": this.class_question, 
                "n_rest": this.n_rest,
            });
        } catch (error) {
            next(error);
        }
    }

    // Override existing methods
    async get_choices(req, res, next) {
        // 'api/task/get_choices'
        // handle request from the front-end and send stimuli to client
        const name = req.header('pid');
        const table_no = Math.floor(Math.random() * this.n_chain) + 1;
        const table_name = `${name}_gsp_prior_no${table_no}`;
        try {
            const result_ = await this._DB_get_latest_row(table_name, 'sample, current_dim, current_category');
            const current_state = result_.rows[0].sample;
            const current_dim = result_.rows[0].current_dim;  // keep it <= n_dim
            const pcx = await this.stimuli_processing([current_state]);
            if (current_dim === this.dim) {
                res.status(200).json({
                    "prior": true,
                    "stimuli": pcx[0],
                    "current_state": current_state,
                    "table_no": table_no});
            } else {
                // generate a set of list with changing the first element of starting point
                const current_category = result_.rows[0].current_category;
                // generate a set of list with changing the first element of starting point
                const { stimuli_list, proposed_values } = this._generate_stimuli_along_dimension(current_state, current_dim);
                res.status(200).json({
                    "stimuli": await this.stimuli_processing(stimuli_list),
                    "current_state": current_state,
                    "proposed_values": proposed_values,
                    "current_dim": current_dim,
                    "current_category": current_category,
                    "table_no": table_no
                });
            }
        } catch (error) {
            next(error);
        }
    }

    _generate_stimuli_along_dimension(current_state, current_dim) {
        const stimuli_list = [];
        const proposed_values = [];
        const adj_key = Object.keys(this.range)[current_dim];
        
        for (let i = 0; i < this.resolution[adj_key]; i++) {
            const new_point = [...current_state];
            new_point[current_dim] = this.range[adj_key][0] + 
                (i / (this.resolution[adj_key] - 1)) * 
                (this.range[adj_key][1] - this.range[adj_key][0]);
            
            stimuli_list.push(new_point);
            proposed_values.push(new_point[current_dim]);
        }
        
        return { stimuli_list, proposed_values };
    }

    // Override register_choices if needed
    async register_choices(req, res, next) {
        if (req.header('prior') === 'true') {
            const table_name = req.header('ID');
            const n_trial = req.header('n_trial');
            const selected = req.body.choice;
            const current_state = req.body.current_state;
            try {
                await this._DB_add_row(table_name, {
                    sample: JSON.stringify(current_state),
                    current_dim: 0,
                    current_category: selected
                });
                console.log(`${table_name.split('_')[0]} just selected ${selected} as new category in GSPP`);
                const n_sample_sofar = Math.floor(n_trial / (this.dim+1));
                if (n_sample_sofar < this.n_sample_per_class) {
                    res.status(200).json({"finish": 0, "progress": n_trial/(this.n_sample_per_class*(this.dim+1))});
                } else {
                    res.status(200).json({"finish": 1, "progress": 0});
                }
            } catch (error) {
                next(error);
            }
        } else {
            const table_name = req.header('ID');
            const n_trial = req.header('n_trial');
            const selected = req.body.choice;
            const current_dim = Number(req.header('current_dim'));
            const current_category = req.header('current_category');
            // console.log(selected);
            try {
                await this._DB_add_row(table_name, {
                    sample: JSON.stringify(selected),
                    current_dim: current_dim + 1,
                    current_category: current_category
                });
                console.log(`${table_name.split('_')[0]} just updated the dimension ${current_dim+1} with GSPP for ${current_category}`);
                res.status(200).json({"progress": n_trial/(this.n_sample_per_class*(this.dim+1))});
            } catch (error) {
                next(error);
            }
        }
    }
};

module.exports = { Controller };