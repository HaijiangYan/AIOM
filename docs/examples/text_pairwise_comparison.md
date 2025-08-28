# Text Pairwise Comparison Task Example

This example demonstrates how to build a pairwise comparison experiment using AIOM's BaseController. The Text Pairwise Comparison task presents participants with two text stimuli from different groups and asks them to choose which one they prefer, making it ideal for studies in preference research, linguistic comparison, and subjective evaluation.

## Overview

The Text Pairwise Comparison task is designed for research requiring comparative judgments between two groups of textual materials. It features:
- **Two-group comparison design** with separate stimulus files
- **Simple preference collection** (choose A or B)
- **Automatic vote counting** for each group
- **Fixed trial structure** with configurable trial count
- **Minimal setup requirements** - just two text files needed

## Table of Contents

- [Experiment Design](#experiment-design)
- [Controller Implementation](#controller-implementation)
- [Key Features](#key-features)
- [Configuration Parameters](#configuration-parameters)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Setup Requirements](#setup-requirements)
- [Step-by-Step Tutorial](#step-by-step-tutorial)
- [Best Practices](#best-practices)

---

## Experiment Design

### Task Structure

On each trial, participants see:
1. **Text from Group 1** (e.g., "I love sunny weather")
2. **Text from Group 2** (e.g., "I prefer rainy days")
3. **Choice prompt**: "Which statement do you prefer?"
4. **Response options**: Group 1 or Group 2

### Comparison Logic

```javascript
// Each trial randomly selects one item from each group
const stimulus_group_1 = this._random_choice(this.stimuli_group_1);
const stimulus_group_2 = this._random_choice(this.stimuli_group_2);
```

The task continues for a fixed number of trials (default: 100), accumulating votes for each group.

---

## Controller Implementation

### Basic Setup

Let's walk through the controller step by step, explaining each part for beginners:

```javascript
const { BaseController } = require('aiom');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        
        // STEP 1: Set up file paths
        // This tells the controller where to find your text files
        this.stimuli_path = path.join(this.expPath, 'stimuli');
        this.task = task;
        
        // STEP 2: Load your text stimuli from files
        // Each line in the .txt files becomes one stimulus
        this.stimuli_group_1 = this._txt2list(path.join(this.stimuli_path, 'group_1.txt'));
        this.stimuli_group_2 = this._txt2list(path.join(this.stimuli_path, 'group_2.txt'));
        
        // STEP 3: Configure experiment parameters
        this.n_trial = 100;    // How many comparisons each participant makes
        this.n_rest = 200;     // Break duration (milliseconds)
        
        // STEP 4: Initialize the database
        this._initialize();
    }
}
```

### Database Initialization (Step-by-Step)

```javascript
async _initialize() {
    try {
        // STEP 1: Define what information we want to store
        const baseColumns = [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },        // Auto-increment ID
            { name: 'participant', type: 'TEXT UNIQUE NOT NULL' }, // Participant name
            { name: 'vote_group_1', type: 'INTEGER NOT NULL DEFAULT 0' }, // Votes for group 1
            { name: 'vote_group_2', type: 'INTEGER NOT NULL DEFAULT 0' }  // Votes for group 2
        ];
        
        // STEP 2: Create the table in the database
        await this._DB_create_table(this.task, baseColumns);
        
        console.log(`✅ ${this.task} database initialized successfully`);
    } catch (error) {
        console.error(`❌ Error setting up ${this.task} database:`, error);
    }
}
```

**What this does:**
- Creates a table to store each participant's vote counts
- Each participant gets one row with running totals for both groups
- If the table already exists, it won't create a duplicate

---

## Key Features

### 1. Simple File-Based Stimulus Loading

**No coding required** - just create two text files:

```javascript
// Automatically loads stimuli from text files
this.stimuli_group_1 = this._txt2list(path.join(this.stimuli_path, 'group_1.txt'));
this.stimuli_group_2 = this._txt2list(path.join(this.stimuli_path, 'group_2.txt'));
```

**Example file contents:**

`group_1.txt`:
```
I love chocolate ice cream
Pizza is the best food
Summer is my favorite season
Dogs make great pets
```

`group_2.txt`:
```
Vanilla ice cream is superior
Burgers beat pizza any day
Winter has its charm
Cats are more independent
```

### 2. Random Stimulus Selection

Each trial presents a random pairing:

```javascript
async get_stimuli(req, res, next) {
    try {
        // Pick one random item from each group
        const stimulus_group_1 = this._random_choice(this.stimuli_group_1);
        const stimulus_group_2 = this._random_choice(this.stimuli_group_2);
        
        // Send both to the webpage
        res.status(200).json({
            "stimulus_group_1": stimulus_group_1,
            "stimulus_group_2": stimulus_group_2
        });
    } catch (error) {
        next(error);  // Handle any errors
    }
}
```

**What this does:**
- Randomly selects one statement from group_1.txt
- Randomly selects one statement from group_2.txt
- Sends both to your webpage for display

### 3. Automatic Vote Counting

The database keeps running totals:

```javascript
async register_choices(req, res, next) {
    const name = req.header('ID');           // Who is the participant?
    const n_trial = req.header('n_trial');   // What trial number is this?
    const selected = req.body.choice;        // Which group did they choose? (1 or 2)
    
    try {
        // STEP 1: Add one vote to the selected group
        await this._DB_update_row_plusone(this.task, `vote_group_${selected}`, { participant: name });
        
        // STEP 2: Check if experiment is finished
        if (n_trial < this.n_trial) {
            // More trials to go
            res.status(200).json({
                "finish": 0, 
                "progress": n_trial/this.n_trial  // Show progress (0.0 to 1.0)
            });
        } else {
            // Experiment complete
            res.status(200).json({
                "finish": 1, 
                "progress": 1.0
            });
        }
    } catch (error) {
        next(error);
    }
}
```

**What this does:**
- If participant chooses Group 1: `vote_group_1` increases by 1
- If participant chooses Group 2: `vote_group_2` increases by 1
- Calculates and returns progress percentage
- Tells the frontend when the experiment is complete

### 4. Participant Management

Handles new and returning participants:

```javascript
async set_up(req, res, next) {
    const name = req.body.names;  // Get participant name from webpage
    
    try {
        // Add new participant or skip if they already exist
        await this._DB_add_row(this.task, 
            { participant: name }, 
            { 
                onConflict: { 
                    columns: 'participant', 
                    action: 'nothing'  // Don't overwrite existing participants
                } 
            }
        );
        
        // Send configuration to webpage
        res.status(200).json({
            "n_rest": this.n_rest
        });
    } catch (error) {
        next(error);
    }
}
```

---

## Configuration Parameters

### Easy-to-Change Settings

| Parameter | Type | Default | What it does |
|-----------|------|---------|--------------|
| `n_trial` | Number | `100` | How many comparisons each participant makes |
| `n_rest` | Number | `200` | Break duration in milliseconds |

### Auto-Loaded Content

| Parameter | Type | Description |
|-----------|------|-------------|
| `stimuli_group_1` | Array | Text items from group_1.txt |
| `stimuli_group_2` | Array | Text items from group_2.txt |

**Want to change the number of trials?**
```javascript
this.n_trial = 50;  // Change from 100 to 50 trials
```

**Want longer breaks?**
```javascript
this.n_rest = 500;  // Change from 200ms to 500ms
```

---

## API Endpoints

### `POST /api/text_pairwise_comparison/set_up`
**What it does:** Initialize a new participant

**Your webpage sends:**
```javascript
{
    "names": "participant_001"
}
```

**Controller responds with:**
```javascript
{
    "n_rest": 200
}
```

### `GET /api/text_pairwise_comparison/get_stimuli`
**What it does:** Get two text items to compare

**Your webpage asks:** (no data needed)

**Controller responds with:**
```javascript
{
    "stimulus_group_1": "I love chocolate ice cream",
    "stimulus_group_2": "Vanilla ice cream is superior"
}
```

### `POST /api/text_pairwise_comparison/register_choices`
**What it does:** Record which group the participant chose

**Your webpage sends:**
```javascript
{
    "choice": "1"  // or "2"
}
```

**With headers:**
- `ID`: participant_001
- `n_trial`: 15 (current trial number)

**Controller responds with:**
```javascript
{
    "finish": 0,       // 0 = continue, 1 = done
    "progress": 0.15   // 15% complete
}
```

---

## Database Schema

### Simple Vote Counting Table

Table name: `text_pairwise_comparison`

| Column | Type | What it stores |
|--------|------|----------------|
| `id` | SERIAL PRIMARY KEY | Unique row ID |
| `participant` | TEXT | Participant name |
| `vote_group_1` | INTEGER | Total votes for Group 1 |
| `vote_group_2` | INTEGER | Total votes for Group 2 |

**Example data:**
```sql
id | participant    | vote_group_1 | vote_group_2
1  | participant_001| 45          | 55
2  | participant_002| 38          | 62
3  | participant_003| 52          | 48
```

This shows:
- Participant 001: Chose Group 1 forty-five times, Group 2 fifty-five times
- Participant 002: Preferred Group 2 more often
- Participant 003: Slightly preferred Group 1

---

## Setup Requirements

### Directory Structure

```
your_study/
├── experiments/
│   └── text_pairwise_comparison/
│       ├── controller.js              # This controller file
│       ├── stimuli/                   # Your text files go here
│       │   ├── group_1.txt           # First group of statements
│       │   └── group_2.txt           # Second group of statements
│       ├── public/
│       │   ├── experiment.ejs         # Your webpage template
│       │   └── static/
│       │       ├── experiment.js      # Webpage JavaScript
│       │       └── experiment.css     # Webpage styles
│       └── custom_text/
│           └── instruction.html       # Task instructions
└── .env                              # Configuration file
```

### Creating Your Text Files

**Step 1:** Create `stimuli/group_1.txt`
```
Positive statement 1
Positive statement 2  
Positive statement 3
Happy thought 1
Optimistic view 1
```

**Step 2:** Create `stimuli/group_2.txt`
```
Negative statement 1
Negative statement 2
Negative statement 3
Sad thought 1
Pessimistic view 1
```

**Important tips:**
- One statement per line
- No empty lines
- Keep statements similar in length
- Make sure you have enough content for your trial count

---

## Step-by-Step Tutorial

### Tutorial: Creating Your First Comparison Study

Let's create a study comparing **positive vs negative statements about technology**.

**Step 1: Prepare Your Stimuli**

Create `group_1.txt` (positive technology statements):
```
Technology makes life easier
Social media connects people worldwide
Smartphones help us stay organized
Video calls bring families together
Online learning opens new opportunities
```

Create `group_2.txt` (negative technology statements):
```
Technology makes people antisocial
Social media spreads misinformation
Smartphones are addictive
Screen time hurts relationships
Digital devices strain our eyes
```

**Step 2: Configure Your Experiment**

Modify the controller if needed:
```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    // ... existing code ...
    
    this.n_trial = 20;   // Start with just 20 trials for testing
    this.n_rest = 1000;  // Give participants 1-second breaks
    
    this._initialize();
}
```

**Step 3: Create Your Webpage**

Basic HTML structure for `experiment.ejs`:
```html
<div id="stimuli-container">
    <div class="stimulus-group">
        <h3>Statement A</h3>
        <p id="group-1-text"></p>
        <button onclick="selectGroup(1)">Choose A</button>
    </div>
    
    <div class="stimulus-group">
        <h3>Statement B</h3>
        <p id="group-2-text"></p>
        <button onclick="selectGroup(2)">Choose B</button>
    </div>
</div>

<div id="progress-container">
    <div id="progress-bar"></div>
    <p id="progress-text">Trial 1 of 20</p>
</div>
```

**Step 4: Add JavaScript Functionality**

Basic JavaScript for `experiment.js`:
```javascript
let currentTrial = 1;
let participantId = 'test_participant';

// Load stimuli for current trial
function loadStimuli() {
    fetch('/api/text_pairwise_comparison/get_stimuli', {
        headers: { 'ID': participantId }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('group-1-text').textContent = data.stimulus_group_1;
        document.getElementById('group-2-text').textContent = data.stimulus_group_2;
    });
}

// Handle participant choice
function selectGroup(groupNumber) {
    fetch('/api/text_pairwise_comparison/register_choices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ID': participantId,
            'n_trial': currentTrial.toString()
        },
        body: JSON.stringify({
            choice: groupNumber.toString()
        })
    })
    .then(response => response.json())
    .then(data => {
        updateProgress(data.progress);
        
        if (data.finish === 1) {
            showCompletionScreen();
        } else {
            currentTrial++;
            setTimeout(loadStimuli, 1000); // Brief pause between trials
        }
    });
}

// Update progress display
function updateProgress(progress) {
    const percentage = Math.round(progress * 100);
    document.getElementById('progress-bar').style.width = percentage + '%';
    document.getElementById('progress-text').textContent = 
        `Trial ${currentTrial} of 20 (${percentage}% complete)`;
}

// Start the experiment
document.addEventListener('DOMContentLoaded', function() {
    // Initialize participant
    fetch('/api/text_pairwise_comparison/set_up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: participantId })
    })
    .then(() => loadStimuli());
});
```

**Step 5: Test Your Experiment**

1. Run your AIOM server: `aiom run`
2. Open your experiment webpage
3. Click through a few trials to test
4. Check your database to see vote counts

---

## Best Practices

### 1. Stimulus Balance

Ensure your groups are comparable:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    // ... existing code ...
    
    // Check that groups have similar sizes
    console.log(`Group 1 has ${this.stimuli_group_1.length} items`);
    console.log(`Group 2 has ${this.stimuli_group_2.length} items`);
    
    if (Math.abs(this.stimuli_group_1.length - this.stimuli_group_2.length) > 5) {
        console.warn('⚠️  Groups have very different sizes - consider balancing');
    }
}
```

### 2. Input Validation

Always validate participant responses:

```javascript
async register_choices(req, res, next) {
    const selected = req.body.choice;
    
    // Make sure choice is valid
    if (selected !== '1' && selected !== '2') {
        return res.status(400).json({ 
            error: 'Choice must be "1" or "2"' 
        });
    }
    
    // Continue with processing...
}
```

### 3. Experiment Configuration

Make your experiment easily configurable:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // Load configuration from file if it exists
    const configPath = path.join(this.expPath, 'config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.n_trial = config.n_trial || 100;
        this.n_rest = config.n_rest || 200;
    } else {
        // Default values
        this.n_trial = 100;
        this.n_rest = 200;
    }
}
```

Example `config.json`:
```json
{
    "n_trial": 50,
    "n_rest": 500,
    "description": "Technology attitudes study"
}
```

### 4. Data Quality Checks

Add basic quality control:

```javascript
async register_choices(req, res, next) {
    const name = req.header('ID');
    const n_trial = parseInt(req.header('n_trial'));
    
    // Check for unreasonably fast responses (< 500ms)
    const responseTime = Date.now() - this.lastStimulusTime[name];
    if (responseTime < 500) {
        console.warn(`⚠️  Very fast response from ${name}: ${responseTime}ms`);
    }
    
    // Continue with processing...
}
```

### 5. Results Analysis Helper

Add a method to analyze results:

```javascript
async get_results(req, res, next) {
    try {
        const results = await this._DB_get_row(this.task, {});
        
        const summary = {
            total_participants: results.rows.length,
            total_votes_group_1: results.rows.reduce((sum, row) => sum + row.vote_group_1, 0),
            total_votes_group_2: results.rows.reduce((sum, row) => sum + row.vote_group_2, 0),
            participants: results.rows
        };
        
        res.status(200).json(summary);
    } catch (error) {
        next(error);
    }
}
```

### 6. Counterbalancing

Add position counterbalancing:

```javascript
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    
    try {
        const stimulus_group_1 = this._random_choice(this.stimuli_group_1);
        const stimulus_group_2 = this._random_choice(this.stimuli_group_2);
        
        // Randomly swap positions to counterbalance
        const swap_positions = Math.random() < 0.5;
        
        if (swap_positions) {
            res.status(200).json({
                "stimulus_group_1": stimulus_group_2,
                "stimulus_group_2": stimulus_group_1,
                "positions_swapped": true
            });
        } else {
            res.status(200).json({
                "stimulus_group_1": stimulus_group_1,
                "stimulus_group_2": stimulus_group_2,
                "positions_swapped": false
            });
        }
    } catch (error) {
        next(error);
    }
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create an efficient pairwise comparison experiment. The simple design makes it accessible for beginners while providing robust data collection and analysis capabilities. With just two text files and minimal configuration, you can run sophisticated preference studies across any domain.