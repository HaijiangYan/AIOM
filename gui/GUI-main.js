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
    event.reply('docker-success', `Experiment is building, after seeing 'Server running on port 8080' below, you can visit "http://localhost:8080" in your local browser to test the experiment`);
    const dockerComposeFilePath = path.join(__dirname, '..', 'docker-compose.yml');
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

// { experiment, group_table_name, max_turnpoint,  
//   trial_per_participant_per_label, trial_per_participant_per_class, classes, class_questions, dim, n_chain, mode}