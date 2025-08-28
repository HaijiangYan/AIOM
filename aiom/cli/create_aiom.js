#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const localdownloader = require('../src/services/download.js');
const heroku = require('../src/services/heroku.js');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
    console.log(`
🧪 Behavioral Experiments Framework (version ${require('../package.json').version})

Usage:
  - Build a study
  aiom create [study_name(optional)]
  aiom list      # List all available task templates you can use in your study

  - Run a study
  aiom run       # Start the local testing server
  aiom download  # Download local data
  aiom heroku    # Deployment operations
    `);
}

function listTemplates() {
    return new Promise((resolve, reject) => {
        const templatesDir = path.join(__dirname, '..', 'src', 'models');
        fs.readdir(templatesDir, (err, files) => {
            if (err) {
                console.error('Error reading templates directory:', err);
                return reject(err);
            }
            const templates = files.filter(file => fs.statSync(path.join(templatesDir, file)).isDirectory());
            console.log('Available task templates:');
            console.log(templates.join(', ') + '\n');
            resolve();
        });
    });
}

async function addTask() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    function ask(question) {
        return new Promise(resolve => rl.question(question, resolve));
    }
    let task = args[1];
    if (!task) {
        await listTemplates();
        task = await ask('Task to add to this study: ');
    }
    const srcPath = path.join(__dirname, '..', 'src', 'models', task);
    const studyDir = process.cwd();
    if (fs.existsSync(srcPath)) {
        fs.cpSync(srcPath, path.join(studyDir, 'tasks', task), { recursive: true, force: true });
    } else {
        // copy the completely customized template
        fs.cpSync(
            path.join(__dirname, '..', 'src', 'models', 'custom'),
            path.join(studyDir, 'tasks', task),
            { recursive: true, force: true }
        );
    }
    console.log(`✅ Task "${task}" added successfully, which is from the template "${fs.existsSync(srcPath) ? task : 'custom'}".`);
}

async function createStudy() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function ask(question) {
        return new Promise(resolve => rl.question(question, resolve));
    }

    try {
        console.log('🧪 Creating a new aiom study...\n');
        
        // Use command line argument or ask for name
        let name = args[1];
        if (!name) {
            name = await ask('Set your study name (without spaces or hyphens): ');
        }
        await listTemplates();
        const type = await ask('Tasks you wish to add to this study (e.g., Any_template_from_above/Any_customized_name_for_new_task/...): ');
        const prolific = await ask('Will Use Prolific for recruitment? (y/n): ');

        const studyDir = path.join(process.cwd(), name);
        if (fs.existsSync(studyDir)) {
            console.error(`❌ Study directory "${studyDir}" already exists. Please use a different name.`);
            process.exit(1);
        }
        // Create default customized text file for your study
        fs.cpSync(
            path.join(__dirname, '..', 'src', 'templates', 'custom_text'),
            path.join(studyDir, 'custom_text'), 
            { recursive: true, force: true }
        );
        // copy experiment templates for your study
        const exp_types = type.split('/').map(t => t.trim());
        for (const exp_type of exp_types) {
            const srcPath = path.join(__dirname, '..', 'src', 'models', exp_type);
            if (fs.existsSync(srcPath)) {
                fs.cpSync(srcPath, path.join(studyDir, 'tasks', exp_type), { recursive: true, force: true });
            } else {
                // copy the completely customized template
                fs.cpSync(
                    path.join(__dirname, '..', 'src', 'models', 'custom'),
                    path.join(studyDir, 'tasks', exp_type),
                    { recursive: true, force: true }
                );
            }
        }
        console.log('✅ Templates copied successfully.');
        
        // Create package.json
        const packageJson = {
            name: name,
            version: "0.0.1",
            description: type,
            main: "app.js",
            bin: {
                // "aiom": "./node_modules/aiom/cli/aiom.js"
            },
            scripts: {
                "start": "node app.js"
            },
            dependencies: {
                "aiom": "*"
            }
        };
        
        fs.writeFileSync(
            path.join(studyDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
        
        // Create .env file based on your current configuration
        let envContent = `# Database Configuration (used if prolific is false)
DB_USER=postgres
DB_PASSWORD=aiom
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aiom

# prolific settings
prolific=${prolific === 'y' ? 'true' : 'false'}
prolific_completion_bonus=1.0
`;

envContent += `
# Multi-experiment settings
# task order (multi-task: 'categorization|production', or single-task: 'blockwise-MCMCP'. Tasks must exist in your ./tasks)
task_order=${type.replace(/\//g, '|')}
`;
        
        fs.writeFileSync(path.join(studyDir, '.env'), envContent);
        console.log('\n✅ .env created');

        // create .gitignore
        const gitignoreContent = `node_modules/
npm-debug.log
db_export/
downloads/
.DS_Store`;
        fs.writeFileSync(path.join(studyDir, '.gitignore'), gitignoreContent);
        console.log('\n✅ .gitignore created');
        
        // Create app.js
        const appJs = `const { createExperiment } = require('aiom');

const experiment = createExperiment({
    experimentPath: __dirname
});

const port = process.env.PORT || 3000;
experiment.start(port);
`;
        fs.writeFileSync(path.join(studyDir, 'app.js'), appJs);
        console.log(`\n✅ Study "${name}" created successfully!`);
        console.log(`\nNext steps:`);
        console.log(`  cd ${name}      # Get in the study`);
        console.log(`  npm install     # Install dependencies`);
        console.log(`  aiom run        # Start the study locally`);
        console.log(`  aiom download   # Download local data`);
        console.log(`  aiom heroku     # Deployment`);

    } catch (error) {
        console.error('Error creating study:', error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function heroku_operation() {
    let op = args[1];
    if (op === 'deploy') {
        await heroku.deploy();
    } else if (op === 'download') {
        await heroku.download();
    } else {
        console.log('Usage: node heroku.js <services>');
        console.log('aiom heroku deploy   # Deploy the app to Heroku');
        console.log('aiom heroku download # Download data from a Heroku app');
    }
}

async function local_download() {
    const downloader = new localdownloader();
    const experimentDir = process.cwd();
    let tableName = args[1];
    try {
        if (!tableName) {
            // Show available tables and usage
            const tables = await downloader.listTables();
            console.log('📊 Available tables:');
            tables.forEach(table => console.log(`  - ${table}`));
            console.log('\n📝 Usage:');
            console.log('aiom download participants   # Download participants table');
            console.log('aiom download all            # Download all tables');
            return;
        } else if (tableName === 'all') {
            await downloader.downloadAllTables(experimentDir + '/db_export');
        } else {
            await downloader.downloadTable(tableName, experimentDir + '/db_export');
        }
    } catch (error) {
        console.error('❌ Download failed:', error.message);
        console.error('💡 Make sure your database is running and .env is configured correctly');
        process.exit(1);
    } finally {
        await downloader.close();
    }
}

async function main() {
    let request = true;
    try {
        if (command === 'list') {
            await listTemplates();
            request = false;
        }

        if (command === 'create') {
            await createStudy();
            request = false;
        }

        if (command === 'add') {
            await addTask();
            request = false;
        }
        
        if (command === 'run') {
            request = false;
            const { spawn } = require('child_process');
            spawn('node', ['app.js'], {
                shell: true,
                cwd: process.cwd(),
                stdio: 'inherit'
            });
        }
        
        if (command === 'download') {
            await local_download();
            request = false;
        } 
        
        if (command === 'heroku') {
            await heroku_operation();
            request = false;
        }
        
        if (command === 'help' || !command) {
            showHelp();
            request = false;
        }

        if (request) {
            console.error(`Unknown command: ${command}`);
            showHelp();
            process.exit(1);
        }

        } catch (error) {
            console.error('CLI error:', error);
            process.exit(1);
        }
}

main();