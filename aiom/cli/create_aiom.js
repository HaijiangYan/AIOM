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
  aiom create [study-name(optional)]
  aiom list      # List all available task templates

  - Run a study
  aiom run       # Start the local testing server
  aiom download  # Download local data
  aiom heroku    # Deployment operations
    `);
}

function listTemplates() {
    const templatesDir = path.join(__dirname, '..', 'src', 'models');
    fs.readdir(templatesDir, (err, files) => {
        if (err) {
            console.error('Error reading templates directory:', err);
            return;
        }
        const templates = files.filter(file => fs.statSync(path.join(templatesDir, file)).isDirectory());
        console.log('Available templates:');
        templates.forEach(template => {
            console.log(` - ${template}`);
        });
    });
}

async function createExperiment() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function ask(question) {
        return new Promise(resolve => rl.question(question, resolve));
    }

    try {
        console.log('🧪 Creating a new aiom experiment...\n');
        
        // Use command line argument or ask for name
        let name = args[1];
        if (!name) {
            name = await ask('Experiment name: ');
        }
        
        const type = await ask('Experiments you wish to add to this project (e.g., categorization/ANY_CUSTOMIZED_NAME/...): ');
        const prolific = await ask('Will Use Prolific? (y/n): ');
        
        const experimentDir = path.join(process.cwd(), name);
        if (fs.existsSync(experimentDir)) {
            console.error(`❌ Experiment directory "${experimentDir}" already exists. Please choose a different name.`);
            process.exit(1);
        }
        // Create default customized text file
        fs.cpSync(
            path.join(__dirname, '..', 'src', 'templates', 'custom_text'),
            path.join(experimentDir, 'custom_text'), 
            { recursive: true, force: true }
        );

        const exp_types = type.split('/').map(t => t.trim());
        for (const exp_type of exp_types) {
            const srcPath = path.join(__dirname, '..', 'src', 'models', exp_type);
            if (fs.existsSync(srcPath)) {
                fs.cpSync(srcPath, path.join(experimentDir, 'experiments', exp_type), { recursive: true, force: true });
            } else {
                // copy the completely customized template
                fs.cpSync(
                    path.join(__dirname, '..', 'src', 'models', 'custom'),
                    path.join(experimentDir, 'experiments', exp_type),
                    { recursive: true, force: true }
                );
            }
        }
        console.log('✅ Template copied successfully.');
        
        // Create package.json
        const packageJson = {
            name: name,
            version: "1.0.0",
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
            path.join(experimentDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
        
        // Create .env file based on your current configuration
        let envContent = `# Database Configuration (if prolific is false)
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
# task order (multi: 'categorization|production', single: 'blockwise-MCMCP')
task_order=${type.replace(/\//g, '|')}
`;
        
        fs.writeFileSync(path.join(experimentDir, '.env'), envContent);
        console.log('\n✅ .env created');

        // create .gitignore
        const gitignoreContent = `node_modules/
npm-debug.log
db_export/
downloads/
.DS_Store`;
        fs.writeFileSync(path.join(experimentDir, '.gitignore'), gitignoreContent);
        console.log('\n✅ .gitignore created');
        
        // Create app.js
        const appJs = `const { createExperiment } = require('aiom');

const experiment = createExperiment({
    experimentPath: __dirname
});

const port = process.env.PORT || 3000;
experiment.start(port);
`;
        fs.writeFileSync(path.join(experimentDir, 'app.js'), appJs);
        console.log(`\n✅ Experiment "${name}" created successfully!`);
        console.log(`\nNext steps:`);
        console.log(`  cd ${name}`);
        console.log(`  npm install`);
        console.log(`  aiom run        # Start the experiment`);
        console.log(`  aiom download   # Show local database`);
        console.log(`  aiom heroku     # Deployment`);

    } catch (error) {
        console.error('Error creating experiment:', error);
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
            await downloader.downloadAllTables(experimentDir + '/downloads');
        } else {
            await downloader.downloadTable(tableName, experimentDir + '/downloads');
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
            listTemplates();
            request = false;
        }

        if (command === 'create') {
            await createExperiment();
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