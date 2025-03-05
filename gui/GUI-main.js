// GUI
const { app, BrowserWindow, ipcMain } = require('electron');
// const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'GUI-preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
  });

  win.loadFile('GUI-index.html');
  win.setPosition(30, 10);
}

// Handle data from the renderer process (GUI)
ipcMain.on('parameters', (event, data) => {
  // Generate .env file content based on the data received
  const envContent = `
experiment=${data.experiment}
group_table_name=${data.group_table_name}
max_turnpoint=${data.max_turnpoint}
trial_per_participant_per_label=${data.trial_per_participant_per_label}
consensus_n=${data.consensus_n}
trial_per_participant_per_class=${data.trial_per_participant_per_class}
n_rest=${data.n_rest}
class_questions=${data.class_questions}
classes=${data.classes}
dim=${data.dim}
n_chain=${data.n_chain}
mode=${data.mode}
imageurl=${data.imageurl}
proposal_cov=${data.proposal_cov}
gatekeeper=${data.gatekeeper}
gatekeeper_means=${data.gatekeeper_means}
gatekeeper_covs=${data.gatekeeper_covs}`;

  // Write to the .env file
  const envPath = path.join(__dirname, '..', '.env');
  fs.writeFileSync(envPath, envContent, { flag: 'w' });
  // Execute additional terminal commands if needed
  // Here we simply print a success message back to the renderer
  event.reply('submit-success', '.env file has been updated successfully!');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  console.log('quit setting up');
  // if (process.platform !== 'darwin') 
  app.quit();
});

// app.on('activate', () => {
//   if (BrowserWindow.getAllWindows().length === 0) createWindow();
// });

ipcMain.on('docker', (event, data) => {
  // Update .env file code (same as before)

  // Example terminal command after .env update
  if (data==='build') {
    event.reply('docker-success', `Experiment is building, test on "http://localhost:8080"`);
    const dockerComposeFilePath = path.join(__dirname, '..', 'docker', 'docker-compose.yml');
    const dockerProcess = spawn('docker', ['compose', '-f', dockerComposeFilePath, 'up', '--build']);
    // Listen for standard output from the Docker process
    dockerProcess.stdout.on('data', (data) => {
      event.reply('docker-output', data.toString());
    });

    // Listen for error output from the Docker process
    dockerProcess.stderr.on('data', (data) => {
      event.reply('docker-output', data.toString());
    });

    // Listen for the close event when the process is finished
    // dockerProcess.on('close', (code) => {
    //   event.reply('docker-success', `Docker build process exited with code ${code}, now you can visit http://localhost:8080`);
    // });

  } else if (data==='finish') {
    app.quit();
  }
  // setTimeout(() => {
  //   app.quit();
  // }, 1000); 
});


ipcMain.on('download', async (event, data) => {
  const progressUpdate = (message) => {
    event.reply('docker-output', message);
  };

  try {
    if (data==='local') {

      const downloadDir = path.join(__dirname, '..', 'db_export');
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir);
      }

      progressUpdate('Starting export...');

      const command = `docker exec postgres14 psql -U postgres -d mcmcp -c "COPY (SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') TO STDOUT"`;
      const { stdout, stderr } = await execPromise(command, { shell: true });

      const tableArray = stdout.trim().split('\n');

      for (const table of tableArray) {
        progressUpdate(`Exporting to ${downloadDir}\\${table.trim()}.csv`);
        await exportTableToCSV(table, downloadDir);
      }
      
      progressUpdate('Export completed: .\\db_export\\');
    }
  } catch (error) {
      progressUpdate('error');
      // throw error;
  }
});

function exportTableToCSV(table, downloadDir) {
  return new Promise((resolve, reject) => {
      // Create write stream for the CSV file
      const outputFile = path.join(downloadDir, `${table.trim()}.csv`);
      const writeStream = fs.createWriteStream(outputFile);
      // Spawn the process with separate arguments
      const child = spawn('docker', [
          'exec',
          'postgres14',
          'psql',
          '-U', 'postgres',
          '-d', 'mcmcp',
          '-c', `COPY ${table.trim()} TO STDOUT WITH CSV HEADER`
      ]);

      // Pipe the output directly to the file
      child.stdout.pipe(writeStream);

      // Handle potential errors
      child.stderr.on('data', (data) => {
          console.error(`Error for table ${table}:`, data.toString());
      });

      child.on('error', (error) => {
          console.error(`Process error for table ${table}:`, error);
          reject(error);
      });

      // Handle completion
      child.on('close', (code) => {
          writeStream.end();
          if (code === 0) {
              console.log(`Successfully exported ${table} to ${outputFile}`);
              resolve(outputFile);
          } else {
              reject(new Error(`Process exited with code ${code} for table ${table}`));
          }
      });

      // Handle write stream errors
      writeStream.on('error', (error) => {
          console.error(`Write stream error for ${table}:`, error);
          reject(error);
      });
  });
}

ipcMain.on('deploy', (event, data) => {
  if (data==='heroku') {
    event.reply('deploy', 'Starting Heroku deployment...');
    // Detect operating system
    // const platform = process.platform;
    // Function to run commands sequentially
    const runCommand = async (command, args = [], options = {}) => {
      return new Promise((resolve, reject) => {
        event.reply('deploy', `Running: ${command} ${args.join(' ')}`);
        
        const process = spawn(command, args, {
          shell: true,
          cwd: path.join(__dirname, '..'),
          ...options
        });
        
        process.stdout.on('data', (data) => {
          event.reply('deploy', data.toString());
        });
        
        process.stderr.on('data', (data) => {
          event.reply('deploy', data.toString());
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

    // Execute commands in sequence
    (async () => {
      try {
        // Check if already logged in
        try {
          await runCommand('heroku', ['auth:whoami']);
          event.reply('deploy', 'Already logged in to Heroku');
        } catch (e) {
          event.reply('deploy', 'Need to login to Heroku');
          const loginPromise = new Promise((resolve, reject) => {
            const loginProcess = spawn('heroku', ['login'], {
              shell: true,
              cwd: path.join(__dirname, '..'),
              stdio: 'pipe' // Important to enable stdin
            });
            
            loginProcess.stdout.on('data', (data) => {
              const output = data.toString();
              event.reply('deploy', output);
              
              // Look for the login prompt
              if (output.includes('Press any key to open up the browser to login')) {
                event.reply('deploy', 'Automatically opening browser for login...');
                // Send Enter key to trigger browser opening
                loginProcess.stdin.write('\n');
              }
            });
            
            loginProcess.stderr.on('data', (data) => {
              event.reply('deploy', data.toString());
            });
            
            loginProcess.on('close', (code) => {
              if (code === 0) {
                event.reply('deploy', 'Login successful');
                resolve();
              } else {
                reject(new Error(`Login failed with code ${code}`));
              }
            });
          });
          await loginPromise;
        }
        
        // Check if app exists
        const appName = 'mcmcp';
        try {
          await runCommand('heroku', ['apps:info', '--app', appName]);
          event.reply('deploy', `App ${appName} already exists`);
        } catch (e) {
          event.reply('deploy', `Creating app ${appName}...`);
          await runCommand('heroku', ['apps:create', appName]);
        }
        
        // Set stack to container
        await runCommand('heroku', ['stack:set', 'container', '--app', appName]);
        
        // Create PostgreSQL addon if not exists
        let isProvisioned = false;
        let attempts = 0;
        const maxAttempts = 36;
        // Check if DATABASE_URL exists in the config
        const configOutput = await runCommand('heroku', ['config', '--app', appName]);
        if (configOutput.includes('DATABASE_URL')) {
          event.reply('deploy', 'PostgreSQL is now fully provisioned and ready to use.');
          isProvisioned = true;
        } else {
          event.reply('deploy', 'PostgreSQL not set yet)');
          event.reply('deploy', 'Creating PostgreSQL addon...');
          await runCommand('heroku', ['addons:create', 'heroku-postgresql:essential-0', '--app', appName]);
          while (!isProvisioned && attempts < maxAttempts) {
            attempts++;
            event.reply('deploy', `Checking PostgreSQL status (attempt ${attempts}/${maxAttempts})...`);
            
            try {
              // Check if DATABASE_URL exists in the config
              const configOutput = await runCommand('heroku', ['config', '--app', appName]);
              
              if (configOutput.includes('DATABASE_URL')) {
                event.reply('deploy', 'PostgreSQL is now fully provisioned and ready to use.');
                isProvisioned = true;
                break;
              } else {
                event.reply('deploy', 'PostgreSQL still provisioning');
              }
            } catch (error) {
              event.reply('deploy', `Error checking status: ${error.message}`);
            }
            
            // Wait 5 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        if (!isProvisioned) {
          event.reply('deploy', 'Warning: Timed out waiting for PostgreSQL. Continuing anyway, but deployment might not work properly.');
        }

  
        
        // Initialize git if needed
        if (!fs.existsSync(path.join(__dirname, '..', '.git'))) {
          await runCommand('git', ['init']);
          await runCommand('git', ['add', '.']);
          await runCommand('git', ['commit', '-m', 'Initial commit for Heroku deployment']);
        }
        
        // Add Heroku remote if needed
        try {
          await runCommand('git', ['remote', 'get-url', 'heroku']);
        } catch (e) {
          await runCommand('git', ['remote', 'add', 'heroku', `https://git.heroku.com/${appName}.git`]);
        }
        
        // Push to Heroku
        await runCommand('git', ['push', 'heroku', 'main:main', '--force']);
        
        event.reply('deploy', 'Deployment completed successfully!');
        event.reply('deploy', `Your app is now available at: https://${appName}.herokuapp.com`);
        
      } catch (error) {
        event.reply('deploy', `Error: ${error.message}`);
      }
    })();

  } else if (data==='finish') {
    app.quit();
  }
  // setTimeout(() => {
  //   app.quit();
  // }, 1000); 
});

// { experiment, group_table_name, max_turnpoint,  
//   trial_per_participant_per_label, trial_per_participant_per_class, classes, class_questions, dim, n_chain, mode}