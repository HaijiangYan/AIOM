// routes/api.js
const express = require('express');
const router = express.Router();

if (process.env.experiment === "MCMCP") {
    const dataController = require('../controllers/groupMCMCP_Controller');
    router.post("/set_table", dataController.set_table_group);
    router.get('/start_choices', dataController.get_choices_group);
    router.get('/get_choices', dataController.get_choices_group);
    router.post('/register_choices', dataController.register_choices_group);
} else if (process.env.experiment === "individual-MCMCP") {
    const dataController = require('../controllers/indMCMCP_Controller');
    router.post("/set_table", dataController.set_table_ind);
    router.get('/start_choices', dataController.start_choices_ind);
    router.get('/get_choices', dataController.get_choices_ind);
    router.post('/register_choices', dataController.register_choices_ind);
} else if (process.env.experiment === "blockwise-MCMCP") {
    const dataController = require('../controllers/bwMCMCP_Controller');
    router.post("/set_table", dataController.set_table_blockwise);
    router.get('/start_choices', dataController.start_choices_blockwise);
    router.get('/get_choices', dataController.get_choices_blockwise);
    router.post('/register_choices', dataController.register_choices_blockwise);
} else if (process.env.experiment === "consensus-MCMCP") {
    const dataController = require('../controllers/consMCMCP_Controller');
    router.post("/set_table", dataController.set_table_consensus);
    router.get("/check_waitingroom", dataController.check_waitingroom);
    router.get('/start_choices', dataController.get_choices_consensus);
    router.get('/get_choices', dataController.get_choices_consensus);
    router.post('/register_choices', dataController.register_choices_consensus);
} else if (process.env.experiment === "GSP") {
    const dataController = require('../controllers/GSP_Controller');
    router.post("/set_table", dataController.set_table);
    router.get('/start_choices', dataController.start_choices);
    router.get('/get_choices', dataController.get_choices);
    router.post('/register_choices', dataController.register_choices);
} else if (process.env.experiment === "GSP-prior") {
    const dataController = require('../controllers/GSP_prior_Controller');
    router.post("/set_table", dataController.set_table);
    router.get('/start_choices', dataController.start_choices);
    router.get('/get_choices', dataController.get_choices);
    router.post('/register_choices', dataController.register_choices);
}

if (process.env.production === 'true') {
    const uploadController = require('../controllers/dataUpload');
    router.post('/upload_files', uploadController.upload_files);
}

if (process.env.categorization === 'true') {
    const catController = require('../controllers/categorization');
    async function initialize_Cat() {
        try {
          await catController.setupCategorization();
        } catch (error) {
          console.error('Failed to initialize categorization:', error);
          process.exit(1);
        }
    };
      
    initialize_Cat();
    router.get('/categorization_stimuli', catController.get_stimuli);
    router.post('/register_categorization', catController.register_choices);
}

module.exports = router;