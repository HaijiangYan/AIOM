# Text Rating Task Example

This example demonstrates how to build a text-based rating experiment using AIOM's BaseController. The Text Rating task presents participants with text stimuli (words, sentences, or phrases) and collects Likert-scale ratings for each item, making it ideal for studies in psycholinguistics, sentiment analysis, and subjective judgments.

## Overview

The Text Rating task is designed for research requiring subjective evaluations of textual materials. It features:
- **Text-based stimulus presentation** from a simple `.txt` file
- **Configurable Likert-scale ratings** (default: 7-point scale)
- **Automatic progress tracking** through all stimuli
- **Simple text file management** - no complex file organization required
- **Efficient data storage** with one column per stimulus

## Table of Contents

- [Experiment Design](#experiment-design)
- [Controller Implementation](#controller-implementation)
- [Key Features](#key-features)
- [Configuration Parameters](#configuration-parameters)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Setup Requirements](#setup-requirements)
- [Best Practices](#best-practices)

---

## Experiment Design

### Task Structure

Participants rate text stimuli on a configurable scale:
1. **Text presentation**: Display one text stimulus at a time
2. **Rating collection**: Participants provide ratings using a Likert scale
3. **Progress tracking**: Automatic advancement through all available stimuli
4. **Completion detection**: Task ends when all items are rated

### Rating Scale

```javascript
this.rating_levels = 7; // Default: 7-point Likert scale
```

The scale is fully configurable - modify `rating_levels` for different scale lengths (e.g., 5-point, 9-point, 10-point scales).

---

## Controller Implementation

### Basic Setup

```javascript
const { BaseController } = require('aiom');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        
        // Core configuration
        this.task = task;
        this.stimuli_path = path.join(this.expPath, 'stimuli');
        this.rating_levels = 7;        // Likert scale points
        this.n_rest = 200;            // Break duration (ms)
        
        // Load stimuli from text file
        this.stimuli = this._txt2list(path.join(this.stimuli_path, 'materials.txt'));
        this.colnames = this.stimuli.map((_, i) => `text_${i + 1}`);
        
        this._initialize();
    }
}
```

### Stimulus Loading

The task uses AIOM's built-in `_txt2list()` method to load stimuli:

```javascript
// Load from materials.txt - one stimulus per line
this.stimuli = this._txt2list(path.join(this.stimuli_path, 'materials.txt'));

// Generate column names for database
this.colnames = this.stimuli.map((_, i) => `text_${i + 1}`);

// Example materials.txt:
// happiness
// sadness  
// excitement
// anxiety
// peace
```

### Initialization Method

Creates a streamlined database schema with one column per text stimulus:

```javascript
async _initialize() {
    try {
        // Base participant columns
        const baseColumns = [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },
            { name: 'participant', type: 'TEXT UNIQUE NOT NULL' }
        ];
        
        // One rating column per stimulus
        const stimulusColumns = this.colnames.map(colname => ({
            name: colname,
            type: 'INTEGER'  // Store rating as integer
        }));
        
        await this._DB_create_table(this.task, [...baseColumns, ...stimulusColumns]);
        
        console.log(`✅ ${this.task} initialized with ${this.stimuli.length} text stimuli`);
    } catch (error) {
        console.error(`Error setting up ${this.task} database:`, error);
    }
}
```

---

## Key Features

### 1. Simple Text File Management

No complex file organization required - just one text file:

```javascript
// Single file contains all stimuli
this.stimuli = this._txt2list(path.join(this.stimuli_path, 'materials.txt'));

// Example materials.txt content:
/*
The weather is beautiful today
I feel anxious about the presentation
This movie made me laugh
The news was quite disturbing
I love spending time with friends
*/
```

### 2. Intelligent Stimulus Selection

Presents only unrated stimuli to each participant:

```javascript
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    try {
        // Get participant's progress
        const participant = await this._DB_get_row(this.task, { participant: name });
        
        // Find stimuli that haven't been rated (null values)
        const null_colnames = this.colnames.filter(colname => 
            participant.rows[0][colname] === null
        );
        
        // Randomly select from unrated stimuli
        const selected_index = this.colnames.indexOf(this._random_choice(null_colnames));
        const selected_stimulus = this.stimuli[selected_index];

        res.status(200).json({
            "selected_index": selected_index,
            "stimulus": selected_stimulus
        });
    } catch (error) {
        next(error);
    }
}
```

### 3. Streamlined Data Collection

Simple rating storage with automatic progress calculation:

```javascript
async register_choices(req, res, next) {
    const name = req.header('ID');
    const n_trial = parseInt(req.header('n_trial'));
    const rating = req.body.rating;
    const stimulus_index = parseInt(req.header('stimulus_index'));
    
    try {
        // Store rating in appropriate column
        await this._DB_update_row(this.task, {
            [this.colnames[stimulus_index]]: rating
        }, { participant: name });
        
        // Calculate progress and completion
        const progress = n_trial / this.stimuli.length;
        const finished = n_trial >= this.stimuli.length ? 1 : 0;
        
        res.status(200).json({
            "finish": finished,
            "progress": progress
        });
    } catch (error) {
        next(error);
    }
}
```

### 4. Configurable Rating Scale

Easy to modify for different research needs:

```javascript
// 5-point scale
this.rating_levels = 5; // 1 = Strongly Disagree, 5 = Strongly Agree

// 9-point scale
this.rating_levels = 9; // 1 = Extremely Negative, 9 = Extremely Positive

// 10-point scale
this.rating_levels = 10; // 1 = Not at all, 10 = Extremely
```

---

## Configuration Parameters

### Core Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task` | String | - | Task identifier (e.g., 'text_rating') |
| `rating_levels` | Number | `7` | Number of points on rating scale |
| `n_rest` | Number | `200` | Break duration (milliseconds) |
| `stimuli_path` | String | `'stimuli'` | Directory containing materials.txt |

### Auto-Generated Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `stimuli` | Array | Text stimuli loaded from materials.txt |
| `colnames` | Array | Database column names (`text_1`, `text_2`, etc.) |

---

## API Endpoints

### `POST /api/text_rating/set_up`
Initialize participant and return scale configuration.

**Request:**
```javascript
{
    "names": "participant_id"
}
```

**Response:**
```javascript
{
    "rating_levels": 7,
    "n_rest": 200
}
```

### `GET /api/text_rating/get_stimuli`
Get the next text stimulus for rating.

**Headers:**
- `ID`: Participant identifier

**Response:**
```javascript
{
    "selected_index": 3,
    "stimulus": "The weather is beautiful today"
}
```

### `POST /api/text_rating/register_choices`
Submit rating and get progress update.

**Headers:**
- `ID`: Participant identifier
- `n_trial`: Current trial number
- `stimulus_index`: Index of current stimulus

**Request:**
```javascript
{
    "rating": 6
}
```

**Response:**
```javascript
{
    "finish": 0,
    "progress": 0.4
}
```

---

## Database Schema

### Main Task Table

Table name: `text_rating` (or your custom task name)

#### Base Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing ID |
| `participant` | TEXT UNIQUE NOT NULL | Participant identifier |

#### Dynamic Stimulus Columns
One column per text stimulus:

| Column | Type | Description |
|--------|------|-------------|
| `text_1` | INTEGER | Rating for first stimulus |
| `text_2` | INTEGER | Rating for second stimulus |
| `text_3` | INTEGER | Rating for third stimulus |
| ... | ... | ... (continues for all stimuli) |

**Example row:**
```sql
participant | text_1 | text_2 | text_3 | text_4 | text_5
P001       | 7      | 3      | 5      | 6      | 2
```

---

## Setup Requirements

### Directory Structure

```
your_study/
├── experiments/
│   └── text_rating/
│       ├── controller.js           # This controller file
│       ├── stimuli/
│       │   └── materials.txt       # Text stimuli file
│       ├── public/
│       │   ├── experiment.ejs      # Frontend template
│       │   └── static/
│       │       ├── experiment.js   # Frontend JavaScript
│       │       └── experiment.css  # Frontend styles
│       └── custom_text/
│           └── instruction.html    # Task instructions
└── .env                           # Environment configuration
```

### Stimulus File Format

**materials.txt** should contain one stimulus per line:

```txt
happiness
sadness
excitement
worry
contentment
frustration
joy
fear
peace
anger
```

For sentence/phrase stimuli:
```txt
The weather is beautiful today
I feel anxious about the presentation
This movie made me laugh
The news was quite disturbing
I love spending time with friends
Work has been stressful lately
```

### Frontend Integration

Your frontend JavaScript should handle the rating interface:

```javascript
// Get stimulus
fetch('/api/text_rating/get_stimuli', {
    headers: { 'ID': participantId }
})
.then(response => response.json())
.then(data => {
    document.getElementById('stimulus-text').textContent = data.stimulus;
    currentStimulusIndex = data.selected_index;
});

// Submit rating
function submitRating(rating) {
    fetch('/api/text_rating/register_choices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ID': participantId,
            'n_trial': trialNumber.toString(),
            'stimulus_index': currentStimulusIndex.toString()
        },
        body: JSON.stringify({
            rating: rating
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.finish === 1) {
            showCompletionScreen();
        } else {
            updateProgressBar(data.progress);
            trialNumber++;
            loadNextStimulus();
        }
    });
}

// Create rating scale buttons
function createRatingScale(levels) {
    const container = document.getElementById('rating-container');
    for (let i = 1; i <= levels; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.onclick = () => submitRating(i);
        container.appendChild(button);
    }
}
```

---

## Best Practices

### 1. Scale Design Considerations

Choose appropriate scale lengths and labels:

```javascript
// For valence ratings
this.rating_levels = 9;
// Labels: 1 = Very Negative, 5 = Neutral, 9 = Very Positive

// For agreement scales  
this.rating_levels = 7;
// Labels: 1 = Strongly Disagree, 4 = Neutral, 7 = Strongly Agree

// For frequency scales
this.rating_levels = 5;
// Labels: 1 = Never, 2 = Rarely, 3 = Sometimes, 4 = Often, 5 = Always
```

### 2. Stimulus Preparation

Prepare clean, consistent text stimuli:

```javascript
// Good stimulus preparation
const cleanStimuli = rawStimuli
    .map(text => text.trim())                    // Remove whitespace
    .filter(text => text.length > 0)             // Remove empty lines
    .filter(text => !text.startsWith('#'));      // Remove comments
```

### 3. Data Validation

Validate ratings before storage:

```javascript
async register_choices(req, res, next) {
    const rating = parseInt(req.body.rating);
    
    // Validate rating is within scale bounds
    if (rating < 1 || rating > this.rating_levels) {
        return res.status(400).json({
            error: `Rating must be between 1 and ${this.rating_levels}`
        });
    }
    
    // Continue with processing...
}
```

### 4. Randomization Control

Control stimulus presentation order:

```javascript
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    try {
        const participant = await this._DB_get_row(this.task, { participant: name });
        const null_colnames = this.colnames.filter(colname => 
            participant.rows[0][colname] === null
        );
        
        // Option 1: Random selection (default)
        const selected_colname = this._random_choice(null_colnames);
        
        // Option 2: Sequential presentation
        // const selected_colname = null_colnames[0];
        
        // Option 3: Balanced randomization
        // const selected_colname = this._balancedRandomSelection(null_colnames, name);
        
        const selected_index = this.colnames.indexOf(selected_colname);
        // Continue...
    } catch (error) {
        next(error);
    }
}
```

### 5. Multi-Scale Extensions

Extend for multiple rating dimensions:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // Multiple rating dimensions
    this.dimensions = ['valence', 'arousal', 'dominance'];
    this.rating_levels = 9;
    
    // Generate column names for each dimension
    this.colnames = this.stimuli.flatMap((_, i) =>
        this.dimensions.map(dim => `text_${i + 1}_${dim}`)
    );
}

// Database columns: text_1_valence, text_1_arousal, text_1_dominance, etc.
```

### 6. Large Stimulus Set Management

Handle large stimulus sets efficiently:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // For very large stimulus sets, consider sampling
    this.all_stimuli = this._txt2list(path.join(this.stimuli_path, 'materials.txt'));
    this.sample_size = 100; // Present only subset per participant
    
    // Each participant gets random subset
    this.stimuli = this._shuffle(this.all_stimuli).slice(0, this.sample_size);
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create an efficient text rating experiment. The simple design allows for easy customization of rating scales, text stimuli, and data collection while maintaining robust database operations and minimal setup requirements.