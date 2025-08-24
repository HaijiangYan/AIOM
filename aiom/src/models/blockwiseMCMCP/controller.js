const { BaseController } = require('aiom');
const { GaussianKDE: gk } = require('./utils/gatekeeper');
const https = require('https');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this.task = task;
        // Initialize experiment settings
        this.imageurl = 'http://localhost:8000';
        this.n_chain = 7;
        this.max_trial = 10;
        this.n_rest = 200;
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.class_questions = [
            'who looks happier?', 
            'who looks sadder?', 
            'who looks more surprised?', 
            'who looks angrier?', 
            'who looks more neutral?', 
            'who looks more disgusted?', 
            'who looks more fearful?'
        ];
        this.n_class = this.classes.length;
        this.dim = 16;
        this.lower_bound = -10;
        this.upper_bound = 10;
        // if not gatekeeper, proposal_cov is the covariance of the proposal distribution; if gatekeeper, it is the bandwidth of the Gaussian proposal kernel
        this.proposal_bandwidth = 0.1;
        this.proposal_cov = Array(this.dim).fill().map((_, i) => 
            Array(this.dim).fill().map((_, j) => i === j ? this.proposal_bandwidth : 0)
        );

        this.stimuli_processing = this._latent2image;
        this.stimuli_processing_batch = this._latent2image_batch;

        // gatekeeper settings
        this.gatekeeper = true;
        this.gatekeeper_dir = 'gatekeepers';
        this.temperature = 2.0;
        this.stuck_count = {};
        this.stuck_patience = 1000;
        this.min_proposal_distance = 2.0; 

        this.attention_check = true;
        this.attention_check_dir = 'stimuli/attention_check';
        this.attention_check_rate = 0.005;

        // initialize
        this._initialize();
    }

    // make sure that all internal functions (not exposed via API) are starting with a '_'
    async _initialize() {
        // set up database and basic settings for the current task in the back-end
        try {
            if (this.gatekeeper) {
                this.gatekeeper = {};
                for (const cate of this.classes) {
                    const modelFilename = `${cate}.json`;
                    const modelFilePath = path.join(this.expPath, this.gatekeeper_dir, modelFilename);
                    const modelParamsJson = fs.readFileSync(modelFilePath, 'utf8');
                    const gatekeeper_parameters = JSON.parse(modelParamsJson);
                    this.gatekeeper[cate] = new gk(gatekeeper_parameters, this.proposal_bandwidth);
                    console.log(`Gatekeeper ${cate} initialized successfully with custom models in ${this.gatekeeper_dir}`); 
                }
            }
            for (const colname of this.classes) {
                await this._DB_add_column('participants', `${colname}_ss`, 'INTEGER NOT NULL DEFAULT 0');
                // await this._DB_add_columns('participants', {
                //     name: `${colname}_ss`,
                //     type: 'INTEGER NOT NULL DEFAULT 0'
                // });
            }
            // console.log(`✅ ${this.task} initialized successfully.`);
        } catch (error) {
          console.error(`Error setting up ${this.task} database:`, error);
        }
    }

    async set_up(req, res, next) {
        // 'api/task/set_up'
        // handle request from the front-end and send stimuli to client
        const name = req.body.names;
        var table_name;
        try {
          const shuffled_classes = this._shuffle([...this.classes]);

          for (let i=1; i<=this.n_chain; i++) {
            table_name = `${name}_blockwise_no${i}`;
            this.stuck_count[table_name] = 0;
            
            const columns = [
                { name: 'id', type: 'SERIAL PRIMARY KEY' },
                { name: 'stimulus', type: 'JSON NOT NULL' },
                { name: 'category', type: 'TEXT NOT NULL' },
                { name: 'for_prior', type: 'BOOLEAN' },
                { name: 'gatekeeper', type: 'BOOLEAN' }
            ];
            await this._DB_create_table(table_name, columns);
            
            const current_class = shuffled_classes[(i-1) % this.n_class];
            const current_state = this.gatekeeper 
                ? this._limit_array_in_range(this.gatekeeper[current_class].sampling(), this.lower_bound, this.upper_bound) 
                : this._uniform_array(this.dim, this.lower_bound, this.upper_bound);
            // Insert the initial state into the database
            await this._DB_add_row(table_name, {
                stimulus: JSON.stringify(current_state),
                category: current_class,
                for_prior: true
            });
          }
          res.status(200).json({
            "classes": this.classes, 
            "class_questions": this.class_questions, 
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
        const name = req.header('ID');
        const current_chain = Math.floor(Math.random() * this.n_chain) + 1;
        const table_name = `${name}_blockwise_no${current_chain}`;
        const attention_check_trial = Math.random() < this.attention_check_rate;
        try {
            if (attention_check_trial && this.attention_check) {
            const check_table = await this._DB_get_latest_row(
                table_name, 
                'stimulus, category, for_prior'
            );
            const current_class = check_table.rows[0].category;
            const attentionDir = path.join(this.expPath, this.attention_check_dir);
            const attention_stimuli = this._get_attention_stimuli_path(attentionDir, current_class);
            res.status(200).json({
                'trial_type': 'attention_check',
                'current_class': current_class,
                "current": this._grab_image(attention_stimuli[0]), 
                "proposal": this._grab_image(attention_stimuli[1]), 
                "attention_check": [attention_stimuli[2][0], attention_stimuli[2][1]]});
            } else {
            const new_stimuli = this.gatekeeper 
                ? await this._generate_stimulus_independence_gatekeeper(table_name)
                : await this._generate_stimulus(table_name);
            // if (this.gatekeeper) {
            //   let gatekeeper_result = await this._bw_gatekeeper(new_stimuli, table_name);
            //   while (gatekeeper_result === 0) {
            //     new_stimuli = await this._generate_stimulus(table_name);
            //     gatekeeper_result = await this._bw_gatekeeper(new_stimuli, table_name);
            //   }
            //   new_stimuli = gatekeeper_result;
            // }

            if (new_stimuli.trial_type === 'likelihood') {
                const stimuli_list = [new_stimuli.current_state, new_stimuli.proposal];
                const stimuli_list_processed = await this._retryAsync(this.stimuli_processing_batch, [stimuli_list], this);
                res.status(200).json({
                'trial_type': new_stimuli.trial_type,
                'current_class': new_stimuli.current_class,
                'current_chain': current_chain,
                'current_position': new_stimuli.current_state,
                'proposal_position': new_stimuli.proposal,
                "current": stimuli_list_processed[0], 
                "proposal": stimuli_list_processed[1]});
            } else if (new_stimuli.trial_type === 'prior') {
                res.status(200).json({
                'trial_type': new_stimuli.trial_type,
                'stimulus_position': new_stimuli.current_state,
                'current_stimulus': new_stimuli.stimulus,
                'current_chain': current_chain,
                "current": new_stimuli.current_class, 
                "proposal": new_stimuli.proposal});
            }
            }
        } catch (error) {
            next(error);
        }
    }

    // Override register_choices if needed
    async register_choices(req, res, next) {
        // 'api/task/register_choices'
        // receive the participant's choices and update the database and count the number of trials
        const name = req.header('ID');
        const pid = req.header('name');
        const n_trial = req.header('n_trial');
        const selected = req.body.choice;
        // console.log(`Participant ${pid} made a choice: ${selected}`);
        if (req.header('trial_type') === 'likelihood') {
            try {
            const current_class = req.header('current_class');
            console.log(`Trial${n_trial}: Participant ${pid} selected ${selected} for ${current_class}`);
            await this._DB_add_row(name, {
                stimulus: JSON.stringify(selected),
                category: current_class,
                for_prior: false
            });
            await this._DB_update_row_plusone('participants', `${current_class}_ss`, { participant: pid });
        
            if (n_trial < this.max_trial) {
                res.status(200).json({"finish": 0, "progress": n_trial/this.max_trial});
            } else {
                res.status(200).json({"finish": 1, "progress": 1});
            }
            } catch (error) {
            next(error);
            }
        } else if (req.header('trial_type') === 'prior') {
            try {
            const current_stimulus = req.body.current_position;
            console.log(`Trial${n_trial}: Participant ${pid} selected ${selected}`);
            // console.log(n_trial);
            await this._DB_add_row(name, {
                stimulus: JSON.stringify(current_stimulus),
                category: selected,
                for_prior: true
            });

            if (n_trial < this.max_trial) {
                res.status(200).json({"finish": 0, "progress": n_trial/this.max_trial});
            } else {
                res.status(200).json({"finish": 1, "progress": 1});
            }
            } catch (error) {
            next(error);
            }
        }
    }

    async _generate_stimulus(table_name) {
        var current_state, current_class, proposal, trial_type;
        const check_table = await this._DB_get_latest_row(
            table_name, 
            'stimulus, category, for_prior'
        );
        current_state = check_table.rows[0].stimulus;
        current_class = check_table.rows[0].category;
        // console.log(check_table);
        if (check_table.rows[0].for_prior) {
          const proposal_center = current_state;
          proposal = this._limit_array_in_range(this._multivariate_gaussian_array(proposal_center, this.proposal_cov), this.lower_bound, this.upper_bound);
          trial_type = 'likelihood';
          return {
            current_state: current_state,
            current_class: current_class,
            proposal: proposal,
            trial_type: trial_type
          };
        } else {
          proposal = this.classes[Math.floor(Math.random() * this.n_class)];
          while (proposal === current_class) {
            proposal = this.classes[Math.floor(Math.random() * this.n_class)];
          }
          trial_type = 'prior';
          const pcx = await this.stimuli_processing(current_state);
          return {
            current_state: current_state,
            current_class: current_class,
            stimulus: pcx.image,
            proposal: proposal,
            trial_type: trial_type
          };
        }
    }

    // this._limit_array_in_range(this.gatekeeper[current_class].sampling(), this.lower_bound, this.upper_bound)
    async _generate_stimulus_independence_gatekeeper(table_name) {
        const name = table_name.split('_blockwise_')[0];
        var current_state, current_class, proposal, trial_type;
        const check_table = await this._DB_get_latest_row(
            table_name, 
            'stimulus, category, for_prior'
        );
        current_state = check_table.rows[0].stimulus;
        current_class = check_table.rows[0].category;
        // console.log(check_table);
        // Initialize stuck count for the table if it doesn't exist (normally it should be initialized in set_table)
        if (!(table_name in this.stuck_count)) {
            this.stuck_count[table_name] = 0;
        }
        
        if (check_table.rows[0].for_prior) {
          if (this.stuck_count[table_name] > this.stuck_patience) {
            // forced switch to another class
            this.stuck_count[table_name] = 0;
            current_class = this.classes[Math.floor(Math.random() * this.n_class)];
            while (current_class === check_table.rows[0].category) {
              current_class = this.classes[Math.floor(Math.random() * this.n_class)];
            }
            console.log(`Participant ${name} is stuck in ${check_table.rows[0].category}, switching to another class: ${current_class}`);
          }
          proposal = this._limit_array_in_range(this.gatekeeper[current_class].sampling(), this.lower_bound, this.upper_bound)
          trial_type = 'likelihood';
          const distance_between_current_and_proposal = this._euclideanDistance(current_state, proposal);
          if (distance_between_current_and_proposal <= this.min_proposal_distance) {
            // if the proposal is too close to the current state, we need to randomly accept one and sample again
            const auto_accepted = Math.random() < 0.5 ? proposal : current_state;
            await this._DB_add_row(table_name, {
                stimulus: JSON.stringify(auto_accepted),
                category: current_class,
                for_prior: false,
                gatekeeper: true
            });
            return this._generate_stimulus_independence_gatekeeper(table_name);
          }
          return {
            current_state: current_state,
            current_class: current_class,
            proposal: proposal,
            trial_type: trial_type
          };
        } else {
          const pcx = await this._retryAsync(this.stimuli_processing, [current_state], this);
          const conditional_image = pcx.image;
          // const proposal_index = this._sampleFromDistribution(pcx.posterior);
          proposal = pcx.posterior;
          trial_type = 'prior';
          if (proposal === current_class) {
            this.stuck_count[table_name]++;
            // if the proposal is the same as the current class, we need to sample again
            await this._DB_add_row(table_name, {
                stimulus: JSON.stringify(current_state),
                category: current_class,
                for_prior: true,
                gatekeeper: true
            });
            return this._generate_stimulus_independence_gatekeeper(table_name);
          }
          this.stuck_count[table_name] = 0;
          return {
            current_state: current_state,
            current_class: current_class,
            stimulus: conditional_image,
            proposal: proposal,
            trial_type: trial_type
          };
        }
    }

    async _bw_gatekeeper(new_stimuli, table_name) {
        if (new_stimuli.trial_type === 'likelihood') {
            if (Math.random() > this.gatekeeper[new_stimuli.current_class].acceptance(new_stimuli.current_state, new_stimuli.proposal, this.temperature)) {
            await this._DB_add_row(table_name, {
                stimulus: JSON.stringify(new_stimuli.current_state),
                category: new_stimuli.current_class,
                for_prior: false,
                gatekeeper: true
            });
            } else {
                return new_stimuli;
            }
        } else if (new_stimuli.trial_type === 'prior') {
            const density_current = this.gatekeeper[new_stimuli.current_class].density(new_stimuli.current_state);
            const density_proposal = this.gatekeeper[new_stimuli.proposal].density(new_stimuli.current_state);
            const acceptance_prob = Math.exp(density_proposal/this.temperature) / (Math.exp(density_current/this.temperature) + Math.exp(density_proposal/this.temperature));
            if (Math.random() > acceptance_prob) {
                // reject the proposal
                await this._DB_add_row(table_name, {
                    stimulus: JSON.stringify(new_stimuli.current_state),
                    category: new_stimuli.current_class,
                    for_prior: true,
                    gatekeeper: true
                });
            } else {
                return new_stimuli;
            }
        }
            return 0;
    }

    _get_attention_stimuli_path(attentionDir, current_class) {
        const dirlist = fs.readdirSync(attentionDir); 
        const matchingDirs = dirlist.filter(dir => dir.includes(current_class)); 
        if (matchingDirs.length === 0) {
            throw new Error(`No attention check directory found for class: ${current_class}`);
        }
        const attention_check_dir = matchingDirs[Math.floor(Math.random() * matchingDirs.length)];
        const s1 = attention_check_dir.split('_')[0];
        const s2 = attention_check_dir.split('_')[1];
        const example_path = path.join(attentionDir, attention_check_dir);
        // list all files in the production_example directory
        const exampleFiles = fs.readdirSync(example_path);
        const extension = exampleFiles[0].split('.').pop();
        const attention_stimulus_1 = path.join(attentionDir, attention_check_dir, s1+'.'+extension);
        const attention_stimulus_2 = path.join(attentionDir, attention_check_dir, s2+'.'+extension);
        return [attention_stimulus_1, attention_stimulus_2, [s1, s2]];
    }

    _latent2image(array) {
        const url = new URL(this.imageurl + '/generate');
        const postData = JSON.stringify({ vector: array });

        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (!response.image) {
                            console.error('Invalid response format from image generation service:', response);
                            resolve({
                                image: this._noise_image(),
                                posterior: this.classes[Math.floor(Math.random() * this.n_class)]
                            });
                        } else {
                            resolve({
                                image: `data:image/png;base64,${response.image}`,
                                posterior: response.pred_label
                            });
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        resolve({
                            image: this._noise_image(),
                            posterior: this.classes[Math.floor(Math.random() * this.n_class)]
                        });
                    }
                });
            });

            req.on('error', (err) => {
                console.error('Error:', err);
                resolve({
                    image: this._noise_image(),
                    posterior: this.classes[Math.floor(Math.random() * this.n_class)]
                });
            });

            req.write(postData);
            req.end();
        });
    }
}

module.exports = { Controller };