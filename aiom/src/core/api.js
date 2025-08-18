// routes/api.js
const { pool } = require('./database');
const path = require('path');

class experiment_api_router {
    // experiment_api_router is used for API routes that are specific to an experiment defined in task_order
    constructor(app, tasks, experimentPath) {
        this.app = app;
        this.tasks = tasks;
        this.experimentPath = experimentPath;
        this.do_attention_check = false;
        this.tasks.map(task => {
            this.setupRoutes(task);
            console.log(`API routes for task "${task}" set up.`);
        });
        this.setupAddonRoutes();
    }

    setupRoutes(task) {
        const controller_path = path.join(this.experimentPath, 'experiments', task, 'controller.js');
        try {
            const { Controller } = require(controller_path);
            const taskController = new Controller(this.experimentPath, task);
            if (taskController.attention_check) {
                this.do_attention_check = true;
            }

            // Get all method names except constructor and initialize
            const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(taskController))
                .filter(
                    name =>
                        name !== 'constructor' &&
                        name !== 'initialize' &&
                        ! name.startsWith('_') &&
                        typeof taskController[name] === 'function'
                );

            for (const method of methodNames) {
                // You can choose your own route naming convention here
                const route = `/api/${task}/${method}`;
                if (method.startsWith('get')) {
                    this.app.get(route, taskController[method].bind(taskController));
                } else {
                    this.app.post(route, taskController[method].bind(taskController));
                }
            }
        } catch (error) {
            console.error(`❌ Error loading controller for task "${task}":`, error);
        }
    }

    async setupAddonRoutes() {
        if (this.do_attention_check) {
            await pool.query(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS "attention_check_fail" INTEGER DEFAULT 0;`);
            const Controller = require('../controllers/addon/attention_check');
            this.app.post('/api/register_attentioncheck', Controller.register_attentioncheck);
            console.log('✅ Attention check set up.');
        }
    }
}

class basic_api_router {
    // basic_api_router is used for basic API routes that do not require a specific task
    constructor(app, config) {
        this.app = app;
        this.config = config;
    }

    static async create(app, config) {
        const instance = new basic_api_router(app, config);
        await instance.initialize();
        instance.setupRoutes();
        return instance;
    }

    setupRoutes() {
        // Register participant
        this.app.post("/api/submit_id", this.register_participant.bind(this));
        // Handle completion redirect
        if (this.config.getBoolean('prolific')) {
            const Controller = require('../controllers/addon/prolific_Controller');
            this.app.get("/api/complete_redirect", Controller.complete_redirect)
        } else {
            this.app.get("/api/complete_redirect", (req, res) => {
                res.status(200).json({ success: true });
            });
        }
    }

    async register_participant(req, res) {
        const name = req.body.names;
        try {
            await pool.query(
            `INSERT INTO participants (participant) 
            VALUES ($1)
            ON CONFLICT (participant) DO NOTHING`,
            [name]
            );
            res.status(200).json({ success: true, message: 'Participant registered successfully.' });
        } catch (error) {
            console.error('Error inserting participant:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }
    }

    async initialize() {
        try {
            // Create table if it doesn't exist
            await pool.query(`CREATE TABLE IF NOT EXISTS participants (
            id SERIAL PRIMARY KEY,
            participant TEXT NOT NULL UNIQUE, 
            completion TEXT, 
            bonus_issued BOOLEAN DEFAULT false
            );`);
        } catch (error) {
            console.error('Error setting up initialization database:', error);
        }
    }
}

module.exports = { basic_api_router, experiment_api_router };