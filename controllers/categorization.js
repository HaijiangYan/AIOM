// controllers/dataController.js
const { pool } = require('../config/database');
const transformer = require('../models/transformer');

/////////////// get all filenames in folder 'public/stimuli/categorization' and set a table ///////////////////
const fs = require('fs');
const path = require('path');
const folderPath = path.join(__dirname, '../public/stimuli/categorization');
const files = fs.readdirSync(folderPath);
const colnames = files.map(file => file.split('.')[0]);
const postfix = files[0].split('.')[1];
const cat_table_name = 'categorization';

exports.setupCategorization = async () => {
  try {
    // Create table if it doesn't exist
    await pool.query(`CREATE TABLE IF NOT EXISTS ${cat_table_name} (
      id SERIAL PRIMARY KEY,
      participant TEXT NOT NULL
    );`);
    // Add columns if they don't exist
    for (const colname of colnames) {
      await pool.query(`ALTER TABLE ${cat_table_name} ADD COLUMN IF NOT EXISTS "${colname}" TEXT;`);
    }
  } catch (error) {
    console.error('Error setting up categorization database:', error);
  }
}

exports.get_stimuli = async (req, res, next) => {
  const name = req.header('ID');
  let selected_stimulus;
  try {
    // check if the participant already exists in the table
    const participant = await pool.query(`SELECT * FROM ${cat_table_name} WHERE participant = $1`, [name]);
    if (participant.rowCount === 0) {
      await pool.query(`INSERT INTO ${cat_table_name} (participant) VALUES ($1)`, [name]);
      selected_stimulus = colnames[Math.floor(Math.random() * colnames.length)];
    } else {
      // get a colname from the participant's row where the value is null
      const null_colnames = colnames.filter(colname => participant.rows[0][colname] === null);
      selected_stimulus = null_colnames[Math.floor(Math.random() * null_colnames.length)];
    }
    const stimulus_path = path.join(__dirname, '../public/stimuli/categorization', selected_stimulus + '.' + postfix);
    res.status(200).json({
      "filename": selected_stimulus,
      "stimulus": transformer.grab_image(stimulus_path)
    });
    
  } catch (error) {
    next(error);
  };
};

////////////////////////////////////
///////////////////////////////////////////////////////////////

exports.register_choices = async (req, res, next) => {
  const name = req.header('ID');
  const filename = req.header('filename');
  const n_trial = req.header('n_trial');
  const selected = req.body.choice; 
  const max_trial = colnames.length;
  try {
    await pool.query(
      `UPDATE ${cat_table_name} SET "${filename}" = $1 WHERE participant = $2`,
      [selected, name]
    );

    if (n_trial < max_trial) {
      res.status(200).json({"finish": 0, "progress": n_trial/max_trial});
    } else {
      res.status(200).json({"finish": 1, "progress": 0});
    }
  } catch (error) {
    next(error);
  }
};
