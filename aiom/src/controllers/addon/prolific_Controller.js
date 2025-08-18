const { pool } = require('../../core/database');
const prolificService = require('../../services/prolific');

exports.complete_redirect = async (req, res) => {
  try {
    const participantId = req.header('ID');
    const completion_status = req.header('Status');
    const studyId = req.header('study_id');
    const bonus = parseFloat(process.env.prolific_completion_bonus) || 0.00;
    // Mark the experiment as completed in your database
    await pool.query(
      `UPDATE participants 
       SET completion = $1
       WHERE participant = $2`,
      [completion_status, participantId]
    );
    let completionURL = '';
    if (process.env.PROLIFIC_API_KEY) {
      completionURL = await prolificService.getCompletionRedirectUrl(studyId, completion_status);
      // enter the paying bonus track only when completion_status is 'COMPLETED'
      if (completion_status === 'COMPLETED') {
        const bonusResults = await payBonuses(participantId, studyId, bonus);
        console.log('Bonus results:', bonusResults);
      }
    } else {
      completionURL = 'https://app.prolific.com/submissions/complete?cc=no_prolific_api_key';
    }

    res.status(200).json({ 
        success: true, 
        completionUrl: completionURL 
    });

  } catch (error) {
    console.error('Error completing experiment:', error);
    res.status(500).json({ error: 'Failed to complete experiment' });
  }
};

async function payBonuses(participantId, studyId, amount=1.00) {
  try {
    // // Authentication check
    // if (!req.isAdmin) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }
    
    // Get completed participants with good data
    const result = await pool.query(`
      SELECT attention_check_fail, bonus_issued
      FROM participants
      WHERE participant = $1
    `, [participantId]);
    
    const n_fail = result.rows[0].attention_check_fail;
    const prolific_pid = participantId.replace('id_', '');
    const bonus_issued = result.rows[0].bonus_issued;
    let bonusReason;
    let bonusAmount = 0;
    let bonusResults = {
      participant: participantId,
      prolificPid: prolific_pid,
      amount: 0,
      success: false,
      error: 'No bonus or has already been paid'
    };
    
    // Bonus based on total trials completed
    if (n_fail === 0 && !bonus_issued) {
      bonusAmount = amount;
      bonusReason = 'Bonus for excellent participation with high quality data!';
    }
      
    if (bonusAmount > 0) {
      try {
        const result = await prolificService.payBonus(
          prolific_pid,
          studyId,
          bonusAmount,
          bonusReason
        );
        bonusResults = {
          participant: participantId,
          prolificPid: prolific_pid,
          amount: bonusAmount,
          success: true
        };
      } catch (error) {
        bonusResults = {
          participant: participantId,
          prolificPid: prolific_pid,
          amount: bonusAmount,
          success: false,
          error: error.message
        };
      }

      if (bonusResults.success) {
        await pool.query(
          `UPDATE participants SET bonus_issued = true WHERE participant = $1`,
          [participantId]
        );
      }
    }
    
    return bonusResults;
  } catch (error) {
    console.error('Error paying bonuses:', error);
    return bonusResults;
  }
};