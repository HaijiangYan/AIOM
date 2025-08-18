// come into effect when the user set production to true in .env file
const { pool } = require('../../core/database');

exports.register_attentioncheck = async (req, res, next) => {
    try {
      const attention_check_result = req.body.result;
      const pid = req.header('ID');
      console.log(pid, "attention check success:", attention_check_result);
      let fail_count = 0;
      if (!attention_check_result) {
        const result = await pool.query(
          `UPDATE participants 
          SET attention_check_fail = attention_check_fail + 1 
          WHERE participant = $1
          RETURNING attention_check_fail`,
          [pid]
        );
        fail_count = result.rows[0].attention_check_fail;
      }
      res.status(200).json({
        'status': 'success', 
        'fail_count': fail_count,
      });
;
    } catch (error) {
      next(error);
    }
  }