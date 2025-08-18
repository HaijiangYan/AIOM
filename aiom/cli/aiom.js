#!/usr/bin/env node
const localdownloader = require('../src/services/download.js');
const heroku = require('../src/services/heroku.js');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
    console.log(`
🧪 Behavioral Experiments Framework CLI

Usage:
  npx aiom download  # Download local data
  npx aiom heroku    # Heroku operations
  npx aiom run       # Start the local testing server
  npx aiom dev       # Start the local development server with nodemon
    `);
}

async function heroku_operation() {
    let op = args[1];
    if (op === 'deploy') {
        await heroku.deploy();
    } else if (op === 'download') {
        await heroku.download();
    } else {
        console.log('Usage: node heroku.js <services>');
        console.log('npx aiom heroku deploy   # Deploy the app to Heroku');
        console.log('npx aiom heroku download # Download data from a Heroku app');
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
            console.log('npx aiom download participants   # Download participants table');
            console.log('npx aiom download all            # Download all tables');
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
    try {
        if (command === 'heroku') {
            await heroku_operation();
        } else if (command === 'download') {
            await local_download();
        } else if (command === 'run') {
            const { spawn } = require('child_process');
            spawn('node', ['app.js'], {
                shell: true,
                cwd: process.cwd(),
                stdio: 'inherit'
            });
        } else if (command === 'dev') {
            const { spawn } = require('child_process');
            spawn('npx', ['nodemon', 'app.js'], {
                shell: true,
                cwd: process.cwd(),
                stdio: 'inherit'
            });
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