const express = require('express');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const errorHandler = require('../middleware/errorHandler');
const { ExperimentConfig } = require('./config');
const { pool } = require('./database');

class Experiment {
    constructor(options = {}) {
        this.paint_AIOM_in_CLI();
        this.experimentPath = options.experimentPath || process.cwd();
        this.config = new ExperimentConfig(path.join(this.experimentPath, '.env'), 'global');
        this.tasks = this.config.getArray('task_order');
        this.app = express();
        this.app.set('view engine', 'ejs');
        this.setupMiddleware();
        this.setupResources();
        // make sure that these routes are set up in the correct order
        (async () => {
            await this.setupBasicRoutes();
            await this.setupExperimentRoutes();
            this.setupOrderedExp();
        })();
    }

    paint_AIOM_in_CLI() {
        console.log(`
         █████╗ ██╗ ██████╗ ███╗   ███╗
        ██╔══██╗██║██╔═══██╗████╗ ████║
        ███████║██║██║   ██║██╔████╔██║
        ██╔══██║██║██║   ██║██║╚██╔╝██║
        ██║  ██║██║╚██████╔╝██║ ╚═╝ ██║
        ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝     ╚═╝                
        `);
    }
    
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(require('cookie-parser')());
        this.app.use(fileUpload({
            limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
            useTempFiles: false,
            createParentPath: true
        }));
        this.app.use(errorHandler);
    }

    setupResources() {
        // Serve package static files --- css styles, js scripts, etc.
        const packageStatic = path.join(__dirname, '..', 'static');
        this.app.use('/pkg-static', express.static(packageStatic));
        // Serve overall experiment static files --- custom text, stimuli, etc.
        const customTextDir = path.join(this.experimentPath, 'custom_text');
        this.app.use('/exp-static', express.static(customTextDir));
        // serve each experiment's static files
        for (const task of this.tasks) {
            const taskinstruction = path.join(this.experimentPath, 'tasks', task, 'custom_text');
            const taskStatic = path.join(this.experimentPath, 'tasks', task, 'public', 'static');
            this.app.use(`/exp-static/${task}`, express.static(taskinstruction));
            this.app.use(`/exp-static/${task}`, express.static(taskStatic));
        }
    }
    
    async setupBasicRoutes() {
        // Base routes that all experiments need
        this.app.get('/', this.renderTemplate.bind(this, 'index'));
        this.app.get('/consent', this.renderTemplate.bind(this, 'consent'));
        this.app.get('/introduction', this.renderTemplate.bind(this, 'introduction'));
        // this.app.get('/waitingroom', this.renderTemplate.bind(this, 'waitingroom'));
        this.app.get("/early_stop", this.renderTemplate.bind(this, 'early_stop'));
        this.app.get('/error', this.renderTemplate.bind(this, 'error'));

        const { basic_api_router } = require('./api');
        this.basic_api_handler = await basic_api_router.create(this.app, this.config);
    }

    async setupExperimentRoutes() {
        const { experiment_api_router } = require('./api');
        this.experiment_api_handler = new experiment_api_router(this.app, this.tasks, this.experimentPath);
    }

    setupOrderedExp() {
        this.app.get("/experiment/:stage", (req, res) => {
            const stage = req.params.stage;
            if (this.tasks.length === 0) { // No tasks available
                this.renderTemplate('debrief', req, res);
            } else if (stage === 'begin') {
                this.sendTask(this.tasks[0], req, res);
            } else if (this.tasks.includes(stage)) {
                const currentIndex = this.tasks.indexOf(stage);
                if (currentIndex < this.tasks.length - 1) {
                    this.sendTask(this.tasks[currentIndex + 1], req, res);
                } else {
                    this.renderTemplate('debrief', req, res);
                }
            } else {
                // Handle invalid stage
                console.error(`Invalid stage requested: ${stage}`);
                this.renderTemplate('debrief', req, res);
            }
        });

        this.app.get("/experiment/:task/get_experiment_page", (req, res) => {
            const task = req.params.task;
            const templatePath = path.join(this.experimentPath, 'tasks', task, 'public', 'experiment.ejs');
            res.render(templatePath, { taskName: task });
        });
    }

    setupAdminRoute() {
        this.app.get('/admin/db', async (req, res) => {
            try {
                // Get all table names
                const tablesResult = await pool.query(`
                    SELECT tablename FROM pg_tables 
                    WHERE schemaname = 'public'
                `);
                const tables = tablesResult.rows.map(row => row.tablename);

                // Get contents of each table
                const tableContents = {};
                for (const table of tables) {
                    const result = await pool.query(`SELECT * FROM "${table}" LIMIT 100`);
                    tableContents[table] = result.rows;
                }

                // Render the db_view template
                res.render(path.join(__dirname, '..', 'templates', 'base', 'db_view.ejs'), {
                    tables: tables,
                    tableContents: tableContents
                });
            } catch (error) {
                res.status(500).send(`<pre>${error.stack}</pre>`);
            }
        });
    }

    sendTask(task, req, res) {
        // if only one task, render it directly
        // if multiple tasks have been configured, render the hinge template to link different tasks
        const hinge = path.join(__dirname, '..', 'templates', 'base', 'hinge.ejs');

        if (this.tasks.length === 1) {
            res.render(path.join(this.experimentPath, 'tasks', task, 'public', 'experiment.ejs'), { taskName: task });
        } else {
            res.render(hinge, { stage_id: this.tasks.indexOf(task)+1, taskName: task });
        }
    }
    
    renderTemplate(templateName, req, res) {
        const templatePath = path.join(__dirname, '..', 'templates', 'base', `${templateName}.html`);
        res.sendFile(templatePath);
    }
    
    async start(port = 3000) {
        try {
            const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
            console.log('✅ Database connected successfully');
            console.log(`📅 Server time: ${result.rows[0].current_time}`);
            console.log(`🐘 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            throw error;
        }
        return this.app.listen(port, () => {
            console.log(`🧪 Experiments: ${this.tasks.join(', ')}`);
            if (process.env.NODE_ENV === 'production') {
                console.log('🌐 Ready to receive connections from Prolific');
            } else {
                const test_url = this.config.getBoolean('prolific')
                    ? `🌐 Server: http://localhost:${port}/?PROLIFIC_PID=test${Math.floor(Math.random() * 10000)}&STUDY_ID=test${Math.floor(Math.random() * 10000)}&SESSION_ID=test${Math.floor(Math.random() * 10000)}`
                    : `🌐 Server: http://localhost:${port}`;
                console.log(test_url);
                // Setup admin route for local database management
                this.setupAdminRoute();
                console.log(`🔎 View local database: http://localhost:${port}/admin/db`);
            }
        });
    }
}

module.exports = { Experiment };