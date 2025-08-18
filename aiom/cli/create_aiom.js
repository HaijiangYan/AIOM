#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
    console.log(`
🧪 Behavioral Experiments Framework CLI

Usage:
  npx aiom create [experiment-name(optional)]
  npx aiom help

Commands:
  create    Create a new experiment
  help      Show this help message

Examples:
  npx aiom create
  npx aiom create my-study
    `);
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
        
        const type = await ask('Experiments you wish to add to this project (e.g., blockwise-MCMCP/categorization/ANY_CUSTOMIZED_NAME/...): ');
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
                "aiom": "./node_modules/aiom/cli/aiom.js"
            },
            scripts: {
                "start": "node app.js",
                "dev": "nodemon app.js"
            },
            dependencies: {
                "aiom": "*", 
                "csv-writer": "^1.6.0"
            }, 
            devDependencies: {
                "nodemon": "^3.0.0" 
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
        console.log(`  npx aiom run        # Start the experiment`);
        console.log(`  npx aiom dev        # Start with auto-reload (development)`);
        console.log(`  npx aiom download   # Show local database`);
        console.log(`  npx aiom heroku     # Deploy to Heroku`);
        
    } catch (error) {
        console.error('Error creating experiment:', error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function main() {
    try {
        if (command === 'create') {
            await createExperiment();
        } else if (command === 'help' || !command) {
            showHelp();
        } else {
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