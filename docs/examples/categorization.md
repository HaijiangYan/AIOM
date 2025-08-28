# Categorization Task Example

This example demonstrates how to build a simple yet effective categorization experiment using AIOM's BaseController. The Categorization task presents participants with facial expression images and asks them to classify each into one of seven emotion categories while measuring response confidence and reaction times.

## Overview

The Categorization task is designed for studies in emotion recognition, facial expression processing, and perceptual categorization. It features:
- **Image-based stimulus presentation** from a predefined set
- **Multi-category classification** with confidence ratings
- **Reaction time measurement** for each response
- **Automatic progress tracking** and completion detection
- **Robust data storage** with conflict handling

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

Participants are presented with facial expression images one at a time and must:
1. **Categorize** the emotion displayed (happy, sad, surprise, angry, neutral, disgust, fear)
2. **Rate confidence** in their classification
3. Complete all available stimuli in the stimulus set

### Emotion Categories

```javascript
this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
```

The task supports any number of categories - simply modify the `classes` array to fit your experimental needs.

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
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.n_rest = 200; // Break interval (milliseconds)
        
        // Auto-detect stimulus files
        const files = fs.readdirSync(this.stimuli_path);
        this.colnames = files.map(file => file.split('.')[0]);
        this.postfix = files[0].split('.')[1]; // Assumes all files have same extension
        
        this._initialize();
    }
}
```

### Initialization Method

The `_initialize()` method creates a dynamic database schema based on available stimuli:

```javascript
async _initialize() {
    try {
        // Base participant columns
        const baseColumns = [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },
            { name: 'participant', type: 'TEXT UNIQUE NOT NULL' }
        ];
        
        // Dynamic columns for each stimulus file
        const stimulusColumns = this.colnames.flatMap(colname => [
            { name: colname, type: 'TEXT' },              // Response category
            { name: `${colname}_conf`, type: 'INTEGER' },  // Confidence rating
            { name: `${colname}_rt`, type: 'INTEGER' }     // Reaction time
        ]);
        
        await this._DB_create_table(this.task, [...baseColumns, ...stimulusColumns]);
        
        console.log(`✅ ${this.task} initialized with ${this.colnames.length} stimuli`);
    } catch (error) {
        console.error(`Error setting up ${this.task} database:`, error);
    }
}
```

---

## Key Features

### 1. Dynamic Stimulus Detection

The controller automatically detects all image files in the `stimuli/` directory:

```javascript
// Auto-detect stimulus files
const files = fs.readdirSync(this.stimuli_path);
this.colnames = files.map(file => file.split('.')[0]);  // Extract filenames
this.postfix = files[0].split('.')[1];                  // Get file extension

// Example: stimuli/face1.jpg, face2.jpg, face3.jpg
// Results in: colnames = ['face1', 'face2', 'face3'], postfix = 'jpg'
```

### 2. Intelligent Stimulus Selection

The task presents only stimuli that haven't been completed by the current participant:

```javascript
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    try {
        // Get participant's current progress
        const participant = await this._DB_get_row(this.task, { participant: name });
        
        // Find stimuli that haven't been completed (null responses)
        const null_colnames = this.colnames.filter(colname => 
            participant.rows[0][colname] === null
        );
        
        // Randomly select from remaining stimuli
        const selected_stimulus = null_colnames[Math.floor(Math.random() * null_colnames.length)];
        const stimulus_path = path.join(this.stimuli_path, selected_stimulus + '.' + this.postfix);
        
        res.status(200).json({
            "filename": selected_stimulus,
            "stimulus": this._grab_image(stimulus_path)
        });
    } catch (error) {
        next(error);
    }
}
```

### 3. Comprehensive Data Collection

Each response captures multiple data points:

```javascript
async register_choices(req, res, next) {
    const name = req.header('ID');
    const filename = req.header('filename');
    const n_trial = parseInt(req.header('n_trial'));
    
    // Collect all response data
    const selected = req.body.choice;        // Emotion category
    const confidence = req.body.confidence;  // Confidence rating
    const reaction_time = req.body.rt;       // Reaction time in ms
    
    try {
        // Update database with all collected data
        await this._DB_update_row(this.task, {
            [filename]: selected,
            [`${filename}_conf`]: confidence,
            [`${filename}_rt`]: reaction_time
        }, { participant: name });
        
        // Calculate and return progress
        const max_trial = this.colnames.length;
        const progress = n_trial / max_trial;
        const finished = n_trial >= max_trial ? 1 : 0;
        
        res.status(200).json({
            "finish": finished,
            "progress": progress
        });
    } catch (error) {
        next(error);
    }
}
```

### 4. Automatic Progress Tracking

The controller automatically tracks completion status:

- **Progress calculation**: `n_trial / total_stimuli`
- **Completion detection**: When all stimuli have been categorized
- **Client notification**: Frontend receives finish status and progress percentage

---

## Configuration Parameters

### Core Settings

| Parameter | Type | Description |
|-----------|------|-------------|
| `task` | String | Task identifier (usually 'categorization') |
| `classes` | Array | Available emotion categories |
| `n_rest` | Number | Break interval duration (ms) |
| `stimuli_path` | String | Path to stimulus image directory |

### Auto-Detected Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `colnames` | Array | Stimulus filenames (without extension) |
| `postfix` | String | File extension of stimulus images |

---

## API Endpoints

### `POST /api/categorization/set_up`
Initialize participant and return experiment configuration.

**Request:**
```javascript
{
    "names": "participant_id"
}
```

**Response:**
```javascript
{
    "classes": ["happy", "sad", "surprise", "angry", "neutral", "disgust", "fear"],
    "n_rest": 200
}
```

### `GET /api/categorization/get_stimuli`
Get the next stimulus image for categorization.

**Headers:**
- `ID`: Participant identifier

**Response:**
```javascript
{
    "filename": "face_001",
    "stimulus": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
}
```

### `POST /api/categorization/register_choices`
Submit categorization response and get progress update.

**Headers:**
- `ID`: Participant identifier
- `filename`: Current stimulus filename
- `n_trial`: Current trial number

**Request:**
```javascript
{
    "choice": "happy",
    "confidence": 7,
    "rt": 1250
}
```

**Response:**
```javascript
{
    "finish": 0,
    "progress": 0.25
}
```

---

## Database Schema

### Main Task Table

Table name: `categorization` (or your custom task name)

#### Base Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing ID |
| `participant` | TEXT UNIQUE NOT NULL | Participant identifier |

#### Dynamic Stimulus Columns
For each stimulus file (e.g., `face_001.jpg`):

| Column | Type | Description |
|--------|------|-------------|
| `face_001` | TEXT | Categorization response |
| `face_001_conf` | INTEGER | Confidence rating (1-10) |
| `face_001_rt` | INTEGER | Reaction time (milliseconds) |

**Example row:**
```sql
participant | face_001 | face_001_conf | face_001_rt | face_002 | face_002_conf | face_002_rt
P001       | happy    | 8            | 1250       | sad      | 6            | 1890
```

---

## Setup Requirements

### Directory Structure

```
your_study/
├── experiments/
│   └── categorization/
│       ├── controller.js          # This controller file
│       ├── stimuli/               # Stimulus images directory
│       │   ├── face_001.jpg      # Image files
│       │   ├── face_002.jpg
│       │   ├── face_003.jpg
│       │   └── ...
│       ├── public/
│       │   ├── experiment.ejs     # Frontend template
│       │   └── static/
│       │       ├── experiment.js  # Frontend JavaScript
│       │       └── experiment.css # Frontend styles
│       └── custom_text/
│           └── instruction.html   # Task instructions
└── .env                          # Environment configuration
```

### Stimulus Requirements

- **Supported formats**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- **Naming convention**: Use descriptive filenames (e.g., `face_001.jpg`, `emotion_happy_01.png`)
- **Consistency**: All images should have the same file extension
- **Size recommendations**: Optimize for web delivery (< 500KB per image)

### Frontend Integration

Your frontend JavaScript should handle:

```javascript
// Get stimulus
fetch('/api/categorization/get_stimuli', {
    headers: { 'ID': participantId }
})
.then(response => response.json())
.then(data => {
    document.getElementById('stimulus-image').src = data.stimulus;
    currentFilename = data.filename;
});

// Submit response
fetch('/api/categorization/register_choices', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'ID': participantId,
        'filename': currentFilename,
        'n_trial': trialNumber.toString()
    },
    body: JSON.stringify({
        choice: selectedCategory,
        confidence: confidenceRating,
        rt: reactionTime
    })
})
.then(response => response.json())
.then(data => {
    if (data.finish === 1) {
        // Experiment complete
        showCompletionScreen();
    } else {
        // Continue with next trial
        updateProgressBar(data.progress);
        loadNextStimulus();
    }
});
```

---

## Best Practices

### 1. Error Handling

Always include proper error handling in your API methods:

```javascript
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    try {
        // Your logic here
        res.status(200).json(result);
    } catch (error) {
        next(error); // Pass to error middleware
    }
}
```

### 2. Data Validation

Validate incoming data before database operations:

```javascript
async register_choices(req, res, next) {
    const { choice, confidence, rt } = req.body;
    
    // Validate inputs
    if (!choice || !this.classes.includes(choice)) {
        return res.status(400).json({ error: 'Invalid category choice' });
    }
    
    if (confidence < 1 || confidence > 10) {
        return res.status(400).json({ error: 'Confidence must be between 1-10' });
    }
    
    // Continue with processing...
}
```

### 3. Flexible Configuration

Make your task easily configurable:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // Load configuration from external file if desired
    this.loadConfiguration();
    
    // Or use environment variables
    this.classes = process.env.EMOTION_CLASSES?.split(',') || this.classes;
}

loadConfiguration() {
    const configPath = path.join(this.expPath, 'config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        Object.assign(this, config);
    }
}
```

### 4. Database Optimization

Use conflict handling for participant initialization:

```javascript
await this._DB_add_row(this.task, 
    { participant: name }, 
    { 
        onConflict: { 
            columns: 'participant', 
            action: 'nothing'  // Don't overwrite existing participants
        } 
    }
);
```

### 5. Scalable Stimulus Management

Design for large stimulus sets:

```javascript
// For very large stimulus sets, consider pagination
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    const batch_size = 10; // Present stimuli in batches
    
    try {
        const participant = await this._DB_get_row(this.task, { participant: name });
        const null_colnames = this.colnames.filter(colname => 
            participant.rows[0][colname] === null
        );
        
        // Randomly select from first N available stimuli
        const available = null_colnames.slice(0, batch_size);
        const selected_stimulus = this._random_choice(available);
        
        // Continue with stimulus loading...
    } catch (error) {
        next(error);
    }
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create a clean, efficient categorization experiment. The modular design allows for easy customization of categories, stimuli, and data collection while maintaining robust database operations and error handling.