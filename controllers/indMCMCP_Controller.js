// controllers/dataController.js
let stimuli_processing;

const { pool } = require('../config/database');
const sampling = require('../models/sampling');
const transformer = require('../models/transformer');
const gk = require('../models/gatekeeper');

/////////////////////// stimuli processing before sending to the frontend ///////////////////////
if (process.env.mode==='test') {
  stimuli_processing = transformer.raw;
} else if (process.env.mode==='image') {
  stimuli_processing = transformer.to_image;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////


/////////////////////// experiment settings ///////////////////////
const n_chain = Number(process.env.n_chain);
const classes = process.env.classes.split("/");
const class_questions = process.env.class_questions.split("/");
const n_class = classes.length;
const max_trial = Number(process.env.trial_per_participant_per_class);
const class_orders_consensus = [];
for (let i = 0; i < 100; i++) {
  class_orders_consensus.push(sampling.shuffle(Array.from(Array(n_class).keys())));
}
////////////////////////////////////////////////////////////////////////////////////////////


/////////////////////// proposal function: isotropic Gaussian ///////////////////////
const proposal_cov = Array(Number(process.env.dim)).fill().map((_, i) => 
  Array(Number(process.env.dim)).fill().map((_, j) => i === j ? Number(process.env.proposal_cov) : 0)
);  // align with process.env.dim 
////////////////////////////////////////////////////////////////////////////////////////////


////////////////// gatekeeper define ///////////////////////
// console.log(process.env.gatekeeper)
let gatekeeper;

if (process.env.gatekeeper==='False') {
  gatekeeper = false;
} else if (process.env.gatekeeper==='Custom') {
  const gatekeeper_means = JSON.parse(process.env.gatekeeper_means);
  const gatekeeper_covs = JSON.parse(process.env.gatekeeper_covs);
  gatekeeper = {}
  for (cate of classes) {
    var gatekeeper_parameters = {
      // n*n covariance matrix to define the gatekeeper
      sigma : gatekeeper_covs[cate],
      // n-dimensional mean vector
      mu : gatekeeper_means[cate]
    }
    // call a gaussian gatekeeper class with customized parameters
    gatekeeper[cate] = new gk.Gaussian(gatekeeper_parameters);
  }
} else {
  gatekeeper = false;
}
/////////////////////////////////////////////////////////////////////


///////////////////////// api functions /////////////////////////

exports.set_table_ind = async (req, res, next) => {
  const name = req.body.names;
  var class_order = sampling.shuffle(Array.from(Array(n_class).keys()));
  // console.log(classes, class_questions);
  var table_name;
  try {
    for (let i=1; i<=n_chain; i++) {
      // console.log(i);
      for (let j=0; j<n_class; j++) {
        table_name = name + '_' + classes[j] + `_no${i}`;
        await pool.query(`CREATE TABLE IF NOT EXISTS ${table_name} (
          id SERIAL PRIMARY KEY,
          trial INTEGER NOT NULL,
          choices JSON NOT NULL,
          picked BOOLEAN, 
          gatekeeper BOOLEAN
          );`);  
      }
    }
    res.status(200).json({
      "class_order": class_order, 
      "classes": classes, 
      "class_questions": class_questions, 
      "n_rest": Number(process.env.n_rest), 
      "mode": process.env.mode,
    });
  } catch (error) {
    next(error);
  }
};

///////////////////////////////////////////////////////////
/////////////////////initialize the choices

exports.start_choices_ind = async (req, res, next) => {
  // console.log(req.header);
  const name = req.header('ID');
  const current_class = req.header('current_class');
  var table_name, current_state, proposal;
  // console.log(name);
  try {
    for (let i=1; i<=n_chain; i++) {
      // console.log(i);
      table_name = name + '_' + current_class + `_no${i}`;
      current_state = sampling.uniform_array(Number(process.env.dim));
      proposal = sampling.gaussian_array(current_state, proposal_cov);
      await pool.query(
        `INSERT INTO ${table_name} (trial, choices) 
        VALUES (1, $1), (1, $2)`,
        [JSON.stringify(current_state), JSON.stringify(proposal)]
      );
    }
    if (!gatekeeper) {
      res.status(200).json({
        "current": await stimuli_processing(current_state), 
        "proposal": await stimuli_processing(proposal), 
        "table_no": n_chain});
    } else {
      proposal = await gatekeeper[current_class].processing(current_state, proposal, table_name, proposal_cov);
      res.status(200).json({
        "current": await stimuli_processing(current_state), 
        "proposal": await stimuli_processing(proposal), 
        "table_no": n_chain});
    }
    
  } catch (error) {
    next(error);
  };
};

////////////////////////////////////
///////////////////////////////////////////////////////////////


exports.get_choices_ind = async (req, res, next) => {
  // console.log("begin");
  const name = req.header('ID');
  const current_class = req.header('current_class');
  const table_no = Math.floor(Math.random() * n_chain) + 1;
  const table_name = name + '_' + current_class + `_no${table_no}`;
  // const dim = process.env.dim;
  try {
    var current_state, proposal, picked_stimuli;
    
    // console.log(table_name);
    picked_stimuli = await pool.query(`
      SELECT trial, choices FROM (
      SELECT trial, choices, picked FROM ${table_name} ORDER BY id DESC FETCH FIRST 2 ROWS ONLY
      ) AS subquery WHERE picked = true LIMIT 1
      `);

    if (picked_stimuli.rowCount===0) {
      const stimuli_in_new_table = await pool.query(`
        SELECT choices FROM ${table_name} ORDER BY id ASC FETCH FIRST 2 ROWS ONLY
        `);
      current_state = stimuli_in_new_table.rows[0].choices;
      proposal = stimuli_in_new_table.rows[1].choices;
    } else {
      current_state = picked_stimuli.rows[0].choices;
      proposal = sampling.gaussian_array(current_state, proposal_cov);
      // console.log("continue-2");
      await pool.query(
        `INSERT INTO ${table_name} (trial, choices) 
        VALUES (${picked_stimuli.rows[0].trial+1}, $1), (${picked_stimuli.rows[0].trial+1}, $2)`,
        [JSON.stringify(current_state), JSON.stringify(proposal)]
      );
    }

    if (!gatekeeper) {
      res.status(200).json({
        "current": await stimuli_processing(current_state), 
        "proposal": await stimuli_processing(proposal), 
        "table_no": table_no});
    } else {
      proposal = await gatekeeper[current_class].processing(current_state, proposal, table_name, proposal_cov);
      res.status(200).json({
        "current": await stimuli_processing(current_state), 
        "proposal": await stimuli_processing(proposal), 
        "table_no": table_no});
    }
  } catch (error) {
    next(error);
  }
};

////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////

exports.register_choices_ind = async (req, res, next) => {
  const name = req.header('ID');
  const n_trial = req.header('n_trial');
  const selected = req.body.choice;
  // console.log(selected);
  try {
    // console.log(name);
    await pool.query(
      `UPDATE ${name} SET picked = true WHERE id = (
      SELECT id FROM ${name} ORDER BY id DESC OFFSET ${1-selected} LIMIT 1);`,
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
