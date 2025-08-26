const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const e = require('express');
const experimentDir = process.cwd();
const arg = process.argv.slice(2)[0];
const runCommand = async (command, args = [], options = {}) => {
    return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
        shell: true,
        cwd: experimentDir,
        ...options
    });
    
    process.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    
    process.stderr.on('data', (data) => {
        console.log(data.toString());
    });
    
    process.on('close', (code) => {
        if (code === 0) {
        resolve();
        } else {
        reject(new Error(`Command exited with code ${code}`));
        }
    });
    });
};

async function deploy() {
    console.log('Starting Heroku deployment...');
    // check if dockerfile and heroku.yml exist
    if (!fs.existsSync(path.join(experimentDir, 'heroku.yml'))) {
        fs.cpSync(
            path.join(__dirname, '..', 'deploy'), 
            experimentDir, 
            { recursive: true, force: true }
        );
        console.log('heroku.yml and Dockerfile generated!.');
    }
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    function ask(question) {
        return new Promise(resolve => rl.question(question, resolve));
    }
    const studyName = path.basename(experimentDir);
    const appNameInput = await ask(`App name (press ENTER to use your study name '${studyName}'): `);
    const appName = appNameInput.trim() === '' ? studyName : appNameInput.trim();
    const region = await ask('Loaction of the App (us/eu): ');
    const dyno_type = await ask('Dyno type (eco/basic/standard-1x/standard-2x/...): ');
    const db_plan = await ask('Database plan (essential-0/essential-1/essential-2/standard-0/...): ');
    let PROLIFIC_API_KEY;
    if (process.env.prolific === 'true') {
        PROLIFIC_API_KEY = await ask('Prolific API key: ');
    }

    // Execute commands in sequence
    (async () => {
      try {
        // Check if already logged in
        try {
          await runCommand('heroku', ['auth:whoami']);
          console.log('Already logged in to Heroku');
        } catch (e) {
          console.log('Need to login to Heroku');
          const loginPromise = new Promise((resolve, reject) => {
            const loginProcess = spawn('heroku', ['login'], {
              shell: true,
              cwd: experimentDir,
              stdio: 'pipe' // Important to enable stdin
            });
            
            loginProcess.stdout.on('data', (data) => {
              console.log(data.toString());
              resolve();
            });
            
            loginProcess.stderr.on('data', (data) => {
              const output = data.toString();
              console.log(output);
              // Look for the login prompt
              if (output.includes('Press') && output.includes('browser'))  {
                console.log('Automatically opening browser for login...');
                loginProcess.stdin.write('\n');
              }
            });
          });
          await loginPromise;
        }
        
        // Check if app exists
        try {
          await runCommand('heroku', ['apps:info', '--app', appName]);
          console.log(`App ${appName} already exists`);
        } catch (e) {
          console.log(`Creating app ${appName} in region ${region}...`);
          await runCommand('heroku', ['apps:create', appName, '--region', region]);
        }

        try {
          if (process.env.prolific === 'true') {
            console.log(`Setting up Prolific API key as ${PROLIFIC_API_KEY}`);
            await runCommand('heroku', ['config:set', `PROLIFIC_API_KEY=${PROLIFIC_API_KEY}`, '--app', appName]);
          }
          // Set stack to container
          await runCommand('heroku', ['stack:set', 'container', '--app', appName]);
        } catch (error) {
          console.log(`Error: ${error.message}`);
        }
        
        // Create PostgreSQL addon if not exists
        let isProvisioned = false;
        let attempts = 0;
        const maxAttempts = 36;
        // Check if DATABASE_URL exists in the config
        const { stdout } = await execPromise('heroku config --app ' + appName, { 
          cwd: experimentDir
        });
        if (stdout.includes('DATABASE_URL')) {
          console.log('PostgreSQL is now fully provisioned and ready to use.');
          isProvisioned = true;
        } else {
          console.log('PostgreSQL not set yet)');
          console.log('Creating PostgreSQL addon...');
          await runCommand('heroku', ['addons:create', `heroku-postgresql:${db_plan}`, '--app', appName]);
          while (!isProvisioned && attempts < maxAttempts) {
            attempts++;
            console.log(`Checking PostgreSQL status (attempt ${attempts}/${maxAttempts})...`);
            
            try {
              // Check if DATABASE_URL exists in the config
              const { stdout } = await execPromise('heroku config --app ' + appName, { 
                cwd: experimentDir
              });
              
              if (stdout.includes('DATABASE_URL')) {
                console.log('PostgreSQL is now fully provisioned and ready to use.');
                isProvisioned = true;
                break;
              } else {
                console.log('PostgreSQL still provisioning');
              }
            } catch (error) {
              console.log(`Error checking status: ${error.message}`);
            }
            
            // Wait 5 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 6000));
          }
        }
        if (!isProvisioned) {
          console.log('Warning: Timed out waiting for PostgreSQL. Continuing anyway, but deployment might not work properly.');
        }

        // Initialize git if needed
        if (!fs.existsSync(path.join(experimentDir, '.git'))) {
          await runCommand('git', ['init']);
          await runCommand('git', ['add', '.']);
          await runCommand('git', ['commit', '-m "Initial commit for Heroku deployment"']);
          console.log('Initialized git repository automatically');
        } else {
          await runCommand('git', ['add', '.']);
          await runCommand('git', ['commit', '-m "Default update for Heroku deployment"']);
          console.log('Updated git repository automatically');
        }
        
        // remember to perform 'heroku authorizations:create' to create a token
        const { stdout: tokenOutput } = await execPromise('heroku auth:token', { 
          cwd: experimentDir
        });
        
        // Clean any whitespace from the token
        const herokuToken = tokenOutput.trim();
        // Add Heroku remote if needed
        try {
          await runCommand('git', ['remote', 'remove', 'heroku']);
        } catch (e) {
          // Ignore error if remote does not exist
        }
        const remoteUrl = `https://heroku:${herokuToken}@git.heroku.com/${appName}.git`;
        await runCommand('git', ['remote', 'add', 'heroku', remoteUrl]);
        
        // Push to Heroku
        await runCommand('git', ['push', 'heroku', 'main:main', '--force']);
        
        console.log('Deployment completed successfully!');

        // Set dyno plan
        const { stdout: dyno_plan } = await execPromise('heroku ps:type ' + dyno_type + ' --app ' + appName, { 
          cwd: experimentDir
        });
        console.log(`set dyno_plan as ${dyno_plan}`);

        // Get the actual app URL
        const { stdout: appInfoOutput } = await execPromise(`heroku info --app ${appName}`, { 
          cwd: experimentDir
        });
        let appUrl = `https://${appName}`;
        const webUrlMatch = appInfoOutput.match(/Web URL:\s+(https:\/\/[^\s]+)/);
        if (webUrlMatch && webUrlMatch[1]) {
          appUrl = webUrlMatch[1];
        }
        console.log(`Your app is now available at: ${appUrl}`);
        console.log('Press Ctrl+C to exit this process.');
        
      } catch (error) {
        console.log(`Error: ${error.message}`);
      }
    })();
  };

async function download() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
  }
  try {
    console.log('All Heroku apps:'); 
    const { stdout } = await execPromise('heroku apps --json', { 
      cwd: experimentDir 
    });
    const appnames = JSON.parse(stdout);
    // appnames.forEach(app => console.log(`  - ${app}`));
    appnames.forEach(app => console.log(`  - ${app.name}`));
    const appName = await ask('App you wish to download data from: ');
    const command_capture = `heroku pg:backups:capture -a ${appName}`;
    const command_download = `heroku pg:backups:download -a ${appName} -o ./db_export/${appName}.dump`
    const { stdout: captureOutput, stderr: captureError } = await execPromise(command_capture, { 
      shell: true, 
      cwd: experimentDir
    });
    console.log('Database backup captured from heroku successfully! Start downloading...');
    const { stdout: downloadOutput, stderr: downloadError } = await execPromise(command_download, { 
      shell: true, 
      cwd: experimentDir 
    });
    console.log('Database backup downloaded from heroku successfully!');
  } catch (error) {
      console.log(`Error during download: ${error.message}`);
      // throw error;
  }
};

// async function main() {
//     if (arg === 'deploy') {
//         await deploy();
//     } else if (arg === 'download') {
//         await download();
//     } else {
//         console.log('Usage: node heroku.js <deploy|download>');
//         console.log('npm run heroku deploy   - Deploy the app to Heroku');
//         console.log('npm run heroku download - Download data from a Heroku app');
//     }
// }

module.exports = {
    deploy,
    download
};