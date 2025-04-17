// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from the 'public' directory
app.use(express.static('public'));

// Home page route.
app.get("/", (req, res) => {
    // res.send("./public/index.html");
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// consent page route.
app.get("/consent", (req, res) => {
    if (process.env.experiment==='blockwise-MCMCP') {
        res.sendFile(path.join(__dirname, 'public', 'consent/blockwise.html'));
    } else if (process.env.experiment==='consensus-MCMCP') {
        res.sendFile(path.join(__dirname, 'public', 'consent/consensus.html'));
    } else if (process.env.experiment==='GSP') {
        res.sendFile(path.join(__dirname, 'public', 'consent/gsp.html'));
    } else if (process.env.experiment==='GSP-prior') {
        res.sendFile(path.join(__dirname, 'public', 'consent/gsp-prior.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'consent/mcmcp.html'));
    }
});
// consent page route.
app.get("/instruction", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'instruction.html'));
});

// waiting page route.
app.get("/waitingroom", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waitingroom.html'));
});

// end main experiment
app.get("/thanks", (req, res) => {
    if (process.env.categorization==='true') {
        res.sendFile(path.join(__dirname, 'public', 'categorization.html'));
    } else if (process.env.production==='true') {
        res.sendFile(path.join(__dirname, 'public', 'upload.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'thanks.html'));
    }
});
app.get("/categorization_finished", (req, res) => {
    if (process.env.production==='true') {
        res.sendFile(path.join(__dirname, 'public', 'upload.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'thanks.html'));
    }
});
app.get("/upload_finished", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'thanks.html'));
});
// exp page route.
app.get("/experiment", (req, res) => {
    if (process.env.experiment==='blockwise-MCMCP') {
        res.sendFile(path.join(__dirname, 'public', 'experiment/blockwise.html'));
    } else if (process.env.experiment==='consensus-MCMCP') {
        res.sendFile(path.join(__dirname, 'public', 'experiment/consensus.html'));
    } else if (process.env.experiment==='GSP') {
        res.sendFile(path.join(__dirname, 'public', 'experiment/gsp.html'));
    } else if (process.env.experiment==='GSP-prior') {
        res.sendFile(path.join(__dirname, 'public', 'experiment/gsp-prior.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'experiment/mcmcp.html'));
    }
});

app.use('/api', apiRoutes);

app.use(errorHandler);

module.exports = app;