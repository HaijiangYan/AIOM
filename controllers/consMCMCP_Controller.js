// controllers/dataController.js
let stimuli_processing;

const { pool } = require('../config/database');
const sampling = require('../models/sampling');
const transformer = require('../models/transformer');

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
let consensus_table_participants = {};
let consensus_table_finished = {};
////////////////////////////////////////////////////////////////////////////////////////////


/////////////////////// proposal function: isotropic Gaussian ///////////////////////
const proposal_cov = Array(Number(process.env.dim)).fill().map((_, i) => 
  Array(Number(process.env.dim)).fill().map((_, j) => i === j ? Number(process.env.proposal_cov) : 0)
);  // align with process.env.dim 
////////////////////////////////////////////////////////////////////////////////////////////


///////////////////////// api functions /////////////////////////
exports.set_table_consensus = async (req, res, next) => {
  try {
  await pool.query(`CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    participant TEXT NOT NULL,
    team INTEGER NOT NULL
    );`); 
    
  const name = req.body.names;
  const n_row_result = await pool.query("SELECT COUNT(*) FROM participants");
  const n_row = parseInt(n_row_result.rows[0].count, 10);
  const team_id = Math.floor(n_row/Number(process.env.consensus_n))+1;

  await pool.query(`
    INSERT INTO participants (participant, team) 
    VALUES ($1, $2)`,
    [name, team_id]
  );
  // console.log(classes, class_questions);
  var table_name;
  var team_order
  if ((n_row+1)%Number(process.env.consensus_n)===0) {
    const teammates = await pool.query(`SELECT participant FROM participants WHERE team = $1`, [team_id]);
    for (let i=1; i<=n_chain; i++) {
      // console.log(i);
      for (let j=0; j<n_class; j++) {
        table_name = `consensus_${team_id}_${classes[j]}_no${i}`;
        // console.log(table_name);
        await pool.query(`CREATE TABLE IF NOT EXISTS ${table_name} (
          id SERIAL PRIMARY KEY,
          trial INTEGER NOT NULL,
          choices JSON NOT NULL,
          picked BOOLEAN
          );`);  
        team_order = sampling.createShiftedArray(Number(process.env.consensus_n), j*n_chain+i-1);
        var tempo_order = [];
        for (t_idx of team_order) {
          // await pool.query(`ALTER TABLE ${table_name} ADD ${teammates.rows[t_idx].participant+'_ready'} BOOLEAN;`); 
          await pool.query(`ALTER TABLE ${table_name} ADD ${teammates.rows[t_idx].participant} BOOLEAN;`); 
          tempo_order.push(teammates.rows[t_idx].participant);
        }
        consensus_table_participants[table_name] = tempo_order;
        consensus_table_finished[table_name] = 0;
      }
    }
  }
  res.status(200).json({
    "class_order": class_orders_consensus[team_id-1], 
    "classes": classes, 
    "class_questions": class_questions, 
    "n_rest": Number(process.env.n_rest), 
    "mode": process.env.mode,
    "team_id": team_id,
    "n_teammates": Number(process.env.consensus_n),
    "n_chain": n_chain,
  });
  } catch (error) {
    next(error);
  }
};

exports.check_waitingroom = async (req, res, next) => {
  const team_id = req.header('team_id');
  try {
    const teammates = await pool.query(`SELECT COUNT(*) FROM participants WHERE team = $1`, [team_id]);
    const numberOfteammates = parseInt(teammates.rows[0].count, 10);
    res.status(200).json({
      "count": numberOfteammates,
    });
  } catch (error) {
    next(error);
  }
}

///////////////////////////////////////////////////////////
/////////////////////initialize the choices
exports.get_choices_consensus = async (req, res, next) => {
  // console.log(req.header);
  const name = req.header('ID');
  const current_class = req.header('current_class');
  const team_id = req.header('team_id');
  const table_no = req.header('current_chain');
  const table_name = `consensus_${team_id}_${current_class}_no${table_no}`;
  var current_state, proposal, selfReady;
  // console.log(name);
  try {
    // Check if the table is empty
    const table_content = await pool.query(`SELECT COUNT(*) FROM ${table_name}`);
    const isTableEmpty = parseInt(table_content.rows[0].count, 10) === 0;
    // console.log(isTableEmpty);
    if (isTableEmpty) {
      // check the order of the participants
      const firstReady = consensus_table_participants[table_name][0];
      // console.log(c_order, firstReady);

      current_state = sampling.uniform_array(Number(process.env.dim));
      proposal = sampling.gaussian_array(current_state, proposal_cov);
      // console.log(current_state, proposal);

      await pool.query(
        `INSERT INTO ${table_name} (trial, choices, ${firstReady}) 
        VALUES (1, $1, null), (1, $2, $3)`,
        [JSON.stringify(current_state), JSON.stringify(proposal), true]
      );

      res.status(204).send();

    } else {
      if (consensus_table_finished[table_name] === 1) {
        res.status(201).send();
      } else {
        const stimuli_in_new_table = await pool.query(`
          SELECT trial, choices, ${name} FROM ${table_name} ORDER BY id DESC FETCH FIRST 2 ROWS ONLY
          `);
        current_state = stimuli_in_new_table.rows[1].choices;
        proposal = stimuli_in_new_table.rows[0].choices;
        selfReady = stimuli_in_new_table.rows[0][`${name}`];

        if (selfReady) {
          res.status(200).json({
            "progress": stimuli_in_new_table.rows[0].trial/(max_trial/n_chain),  // should be interger multiple of n_chain
            "current": await stimuli_processing(current_state), 
            "proposal": await stimuli_processing(proposal)});
        } else {
          res.status(204).send();
        }
      }
    }

  } catch (error) {
    next(error);
  };
};

////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
exports.register_choices_consensus = async (req, res, next) => {
  const name = req.header('ID');
  // const n_trial = req.header('n_trial');
  const table_no = req.header('table');
  const current_class = req.header('current_class');
  const team_id = req.header('team_id');
  const selected = req.body.choice;
  const table_name = `consensus_${team_id}_${current_class}_no${table_no}`;

  // const colnames = await pool.query(`
  //   SELECT column_name
  //   FROM information_schema.columns
  //   WHERE table_name = '${table_name}';
  // `);
  const c_order = consensus_table_participants[table_name];

  try {
    if (selected === 0) {  // select the current state
      // console.log('select 0');
      const selected_row = await pool.query(
        `UPDATE ${table_name} 
        SET picked = true WHERE id = (
        SELECT id FROM ${table_name} ORDER BY id DESC OFFSET 1 LIMIT 1)
        RETURNING trial, choices;`,
      );

      if (selected_row.rows[0].trial < max_trial/n_chain) {

        current_state = selected_row.rows[0].choices;
        proposal = sampling.gaussian_array(current_state, proposal_cov);

        await pool.query(
          `INSERT INTO ${table_name} (trial, choices, ${c_order[0]}) 
          VALUES ($4, $1, null), ($4, $2, $3)`,
          [JSON.stringify(current_state), JSON.stringify(proposal), true, selected_row.rows[0].trial+1]
        );
      } else {
        consensus_table_finished[table_name] = 1;
      }

    } else {  // select the proposal

      if (name===c_order[process.env.consensus_n - 1]) {  // you are the last participant
        // console.log('select 0 and last');
        const selected_row = await pool.query(
          `UPDATE ${table_name} 
          SET picked = true WHERE id = (
          SELECT id FROM ${table_name} ORDER BY id DESC LIMIT 1)
          RETURNING trial, choices;`,
        );

        if (selected_row.rows[0].trial < max_trial/n_chain) {
          current_state = selected_row.rows[0].choices;
          proposal = sampling.gaussian_array(current_state, proposal_cov);

          await pool.query(
            `INSERT INTO ${table_name} (trial, choices, ${c_order[0]}) 
            VALUES ($4, $1, null), ($4, $2, $3)`,
            [JSON.stringify(current_state), JSON.stringify(proposal), true, selected_row.rows[0].trial+1]
          );
        } else {
          consensus_table_finished[table_name] = 1;
        }
      } else {
        // console.log('select 0 and not last');
        // set the next participant ready
        const next_p_ready = c_order[c_order.indexOf(name)+1];
        await pool.query(
          `UPDATE ${table_name} 
          SET ${name} = false, ${next_p_ready} = true WHERE id = (
          SELECT id FROM ${table_name} ORDER BY id DESC LIMIT 1);`,
        );
      }
    }
    // console.log(consensus_table_finished[table_name]);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
};
