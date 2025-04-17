// controllers/dataController.js

const { pool } = require('../config/database');
const sampling = require('../models/sampling');
const transformer = require('../models/transformer');


/////////////////////// experiment settings ///////////////////////
const mode = 'image';
const range = {"0": [-30, 30], "1": [-30, 30], "2": [-30, 30]};
const resolution = {"0": 10, "1": 10, "2": 10};
const n_dim = Object.keys(range).length;
const n_chain = 1;
const n_rest = 5;
const classes = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
const class_questions = [];
for (let i=0; i<classes.length; i++) {
  class_questions.push(`Adjust the slider to match the following word as well as possible: <br>${classes[i]}`);
}
const n_class = classes.length;
const max_ite_per_participant = 3;
////////////////////////////////////////////////////////////////////////////////////////////
let stimuli_processing, stimuli_processing_prior;
if (mode==='test') {
  stimuli_processing = transformer.raw;
  stimuli_processing_prior = transformer.raw;
} else if (mode==='image') {
  stimuli_processing = transformer.to_image_gsp;
  stimuli_processing_prior = transformer.to_image;
}

///////////////////////// api functions /////////////////////////

exports.set_table = async (req, res, next) => {
  const name = req.body.names;
  var table_name;
  try {
    for (let i=1; i<=n_chain; i++) {
      table_name = name + `_no${i}`;
      await pool.query(`CREATE TABLE IF NOT EXISTS ${table_name} (
        id SERIAL PRIMARY KEY,
        sample JSON NOT NULL, 
        current_dim INTEGER NOT NULL, 
        current_category TEXT NOT NULL
        );`);
    }
    res.status(200).json({
      "classes": classes, 
      "class_questions": class_questions, 
      "n_rest": n_rest, 
      "mode": mode,
    });
  } catch (error) {
    next(error);
  }
};

///////////////////////////////////////////////////////////
/////////////////////initialize the choices

exports.start_choices = async (req, res, next) => {
  // console.log(req.header);
  const name = req.header('ID');
  var table_name, starting_point, starting_category;
  // console.log(name);
  try {
    for (let i=1; i<=n_chain; i++) {
      // console.log(i);
      table_name = name + `_no${i}`;
      starting_point = sampling.uniform_array_ranges(n_dim, ranges=range);
      starting_category = classes[Math.floor(Math.random() * n_class)]; 
      await pool.query(
        `INSERT INTO ${table_name} (sample, current_dim, current_category) 
        VALUES ($1, $2, $3)`,
        [JSON.stringify(starting_point), 0, starting_category]
      );
    }
    // generate a set of list with changing the first element of starting point
    const stimuli_list = [];
    const proposed_values = [];
    const adj_key = Object.keys(range)[0];
    for (let i=0; i<resolution[adj_key]; i++) {
      const new_point = [...starting_point];
      new_point[0] = range[adj_key][0] + (i/(resolution[adj_key]-1)) * (range[adj_key][1] - range[adj_key][0]);
      stimuli_list.push(new_point);
      proposed_values.push(new_point[0]);
    }
    res.status(200).json({
      "stimuli": await stimuli_processing(stimuli_list),
      "current_state": starting_point,
      "current_dim": 0,
      "current_category": classes.indexOf(starting_category),
      "proposed_values": proposed_values,
      "table_no": n_chain});
    
  } catch (error) {
    next(error);
  };
};

////////////////////////////////////
///////////////////////////////////////////////////////////////


exports.get_choices = async (req, res, next) => {
  // console.log("begin");
  const name = req.header('ID');
  const table_no = Math.floor(Math.random() * n_chain) + 1;
  const table_name = name + `_no${table_no}`;
  try {
    var current_state, current_dim, current_category;

    const result_ = await pool.query(`
      SELECT sample, current_dim, current_category FROM ${table_name} ORDER BY id DESC LIMIT 1
      `);
    current_state = result_.rows[0].sample;
    current_dim = result_.rows[0].current_dim;
    if (current_dim >= n_dim) {
      res.status(200).json({
        "prior": true,
        "stimuli": await stimuli_processing_prior(current_state),
        "current_state": current_state,
        "table_no": table_no});
    } else {
      // generate a set of list with changing the first element of starting point
      current_category = result_.rows[0].current_category;
      const stimuli_list = [];
      const proposed_values = [];
      const adj_key = Object.keys(range)[current_dim];
      for (let i=0; i<resolution[adj_key]; i++) {
        const new_point = [...current_state];
        new_point[current_dim] = range[adj_key][0] + (i/(resolution[adj_key]-1)) * (range[adj_key][1] - range[adj_key][0]);
        stimuli_list.push(new_point);
        proposed_values.push(new_point[current_dim]);
      }

      res.status(200).json({
        "stimuli": await stimuli_processing(stimuli_list),
        "current_state": current_state,
        "proposed_values": proposed_values,
        "current_dim": current_dim,
        "current_category": classes.indexOf(current_category),
        "table_no": table_no});
    }
  } catch (error) {
    next(error);
  }
};

////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////

exports.register_choices = async (req, res, next) => {
  if (req.header('prior') === 'true') {
    const table_name = req.header('ID');
    const n_trial = req.header('n_trial');
    const selected = req.body.choice;
    const current_state = req.body.current_state;
    try {
      await pool.query(
        `INSERT INTO ${table_name} (sample, current_dim, current_category) 
        VALUES ($1, $2, $3)`,
        [JSON.stringify(current_state), 0, selected]
      );
      const ss = Math.floor(n_trial / (n_dim+1));
      if (ss < max_ite_per_participant) {
        res.status(200).json({"finish": 0, "progress": n_trial/(max_ite_per_participant*(n_dim+1))});
      } else {
        res.status(200).json({"finish": 1, "progress": 0});
      }
    } catch (error) {
      next(error);
    }
  } else {
    const table_name = req.header('ID');
    const n_trial = req.header('n_trial');
    const selected = req.body.choice;
    const current_dim = Number(req.header('current_dim'));
    const current_category = classes[req.header('current_category')];
    // console.log(selected);
    try {
      // console.log(name);
      await pool.query(
        `INSERT INTO ${table_name} (sample, current_dim, current_category) 
        VALUES ($1, $2, $3)`,
        [JSON.stringify(selected), current_dim+1, current_category]
      );
      res.status(200).json({"progress": n_trial/(max_ite_per_participant*(n_dim+1))});
    } catch (error) {
      next(error);
    }
  }
};