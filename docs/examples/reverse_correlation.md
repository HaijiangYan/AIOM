# Reverse Correlation Task Example

This example demonstrates how to build a reverse correlation experiment using AIOM's BaseController. The Reverse Correlation task generates random facial expression images from latent vectors and asks participants to categorize and rate the intensity of emotions they perceive, making it ideal for studying internal mental representations and perceptual biases.

## Overview

The Reverse Correlation task is designed to uncover participants' internal mental representations by analyzing their responses to randomly generated stimuli. It features:
- **Dynamic stimulus generation** from random latent vectors
- **Multi-dimensional emotion categorization** with intensity ratings
- **External image generation service integration** for creating facial expressions
- **Latent space exploration** across configurable dimensions and ranges
- **Individual participant data collection** in separate database tables

## Table of Contents

- [Experiment Design](#experiment-design)
- [Controller Implementation](#controller-implementation)
- [Key Features](#key-features)
- [Configuration Parameters](#configuration-parameters)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Setup Requirements](#setup-requirements)
- [Understanding the Method](#understanding-the-method)
- [Best Practices](#best-practices)

---

## Experiment Design

### Reverse Correlation Method

The reverse correlation technique works by:
1. **Generating random stimuli** from a multi-dimensional latent space
2. **Collecting categorization responses** for each generated image
3. **Analyzing response patterns** to reveal internal mental templates
4. **Mapping perceptual space** through statistical analysis of stimulus-response pairs

### Task Structure

On each trial, participants:
1. View a **computer-generated face image** (created from random latent vector)
2. **Categorize the emotion** displayed (happy, sad, surprise, etc.)
3. **Rate the intensity** of the perceived emotion
4. Continue for a fixed number of trials

### Emotion Categories

```javascript
this.classes = ['happy', 'sad', 'surprise', 'angry', 'disgust', 'fear', 'other'];
```

The 'other' category allows participants to indicate emotions not covered by the main six basic emotions.

---

## Controller Implementation

### Basic Setup

```javascript
const { BaseController } = require('aiom');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        
        // Core experiment configuration
        this.task = task;
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'disgust', 'fear', 'other'];
        this.n_trial = 10;                    // Number of trials per participant
        this.n_rest = 200;                    // Break duration (ms)
        
        // Stimulus generation settings
        this.modality = 'image';              // Stimulus type
        this.imageurl = 'http://localhost:8000'; // Image generation service URL
        this.stimuli_processing = this._latent2image_batch; // Processing function
        
        // Latent space configuration
        this.dim = 8;                         // Dimensionality of latent space
        this.range = {                        // Range for each dimension
            "0": [-10, 10], "1": [-10, 10], "2": [-10, 10], "3": [-10, 10],
            "4": [-10, 10], "5": [-10, 10], "6": [-10, 10], "7": [-10, 10]
        };
        
        this._initialize();
    }
}
```

### Initialization Method

Sets up participant tracking and individual data tables:

```javascript
async _initialize() {
    try {
        // Add attendance tracking to main participants table
        await this._DB_add_column('participants', 'rc_attendance', 'BOOLEAN NOT NULL DEFAULT FALSE');
        
        console.log(`✅ ${this.task} initialized successfully.`);
    } catch (error) {
        console.error(`Error setting up ${this.task} database:`, error);
    }
}
```

**What this does:**
- Adds an `rc_attendance` column to track which participants completed the RC task
- This allows you to run multiple tasks and track participation across all of them

---

## Key Features

### 1. Dynamic Latent Vector Generation

Each stimulus is created from a random point in multi-dimensional space:

```javascript
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    const table_name = `${name}_${this.task}`;
    
    try {
        // STEP 1: Generate random latent vector within specified ranges
        const sample = this._uniform_array_ranges(this.dim, this.range);
        
        // STEP 2: Store the latent vector in participant's table
        await this._DB_add_row(table_name, {
            sample: JSON.stringify(sample)
        });
        
        // STEP 3: Convert latent vector to image via external service
        const pcx = await this.stimuli_processing([sample]);
        
        // STEP 4: Send image to participant's browser
        res.status(200).json({
            "stimulus": pcx[0]
        });
    } catch (error) {
        next(error);
    }
}
```

**How latent vector generation works:**
```javascript
// Example: 8-dimensional vector with ranges [-10, 10] for each dimension
const sample = this._uniform_array_ranges(8, {
    "0": [-10, 10],  // Dimension 0: random value between -10 and 10
    "1": [-10, 10],  // Dimension 1: random value between -10 and 10
    // ... continues for all 8 dimensions
});

// Example result: [2.3, -7.1, 0.8, 9.2, -3.4, 1.7, -8.9, 4.5]
```

### 2. External Image Generation Service

Integrates with a separate service to convert latent vectors to images:

```javascript
// Uses the inherited _latent2image_batch method
this.stimuli_processing = this._latent2image_batch;

// This method:
// 1. Sends latent vector to external service at this.imageurl
// 2. Receives generated face image as base64 data
// 3. Returns image ready for display in browser
```

**Service Integration Requirements:**
- External service running at `http://localhost:8000` (or your specified URL)
- Service accepts POST requests with JSON: `{"vectors": [[dim1, dim2, ...]]}`
- Service returns JSON with base64 images: `{"images": ["data:image/png;base64,..."]}`

### 3. Individual Participant Data Tables

Each participant gets their own data table:

```javascript
async set_up(req, res, next) {
    const name = req.body.names;
    const table_name = `${name}_${this.task}`;  // e.g., "participant_001_RC"
    
    try {
        // Mark participant as having started RC task
        await this._DB_update_row('participants', 
            { rc_attendance: true }, 
            { participant: name }
        );
        
        // Create individual table for this participant
        const columns = [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },
            { name: 'sample', type: 'JSON NOT NULL' },      // Latent vector
            { name: 'categorization', type: 'TEXT' },       // Emotion category
            { name: 'intensity', type: 'INTEGER' }          // Intensity rating
        ];
        await this._DB_create_table(table_name, columns);
        
        res.status(200).json({
            "classes": this.classes,
            "n_rest": this.n_rest
        });
    } catch (error) {
        next(error);
    }
}
```

**Why individual tables?**
- Each participant may complete different numbers of trials
- Makes data analysis easier (each row = one stimulus-response pair)
- Prevents data conflicts between participants
- Easier to export individual participant data

### 4. Comprehensive Response Collection

Collects both categorical and continuous data:

```javascript
async register_choices(req, res, next) {
    const name = req.header('ID');
    const table_name = `${name}_${this.task}`;
    const n_trial = parseInt(req.header('n_trial'));
    const selected = req.body.choice;        // Emotion category
    const intensity = req.body.intensity;    // Intensity rating (1-10 scale)
    
    try {
        // Update the most recent stimulus entry with response data
        await this._DB_update_last_row(table_name, {
            categorization: selected,
            intensity: intensity
        });

        // Calculate progress and completion status
        if (n_trial < this.n_trial) {
            res.status(200).json({
                "finish": 0, 
                "progress": n_trial / this.n_trial
            });
        } else {
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

---

## Configuration Parameters

### Core Experiment Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `n_trial` | Number | `10` | Number of stimuli per participant |
| `n_rest` | Number | `200` | Break duration (milliseconds) |
| `classes` | Array | `['happy', 'sad', ...]` | Available emotion categories |

### Stimulus Generation Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `modality` | String | `'image'` | Type of stimuli to generate |
| `imageurl` | String | `'http://localhost:8000'` | Image generation service URL |
| `dim` | Number | `8` | Dimensionality of latent space |
| `range` | Object | `{"0": [-10, 10], ...}` | Value ranges for each dimension |

### Advanced Configuration Examples

**Higher-dimensional latent space:**
```javascript
this.dim = 16;
this.range = {};
for (let i = 0; i < 16; i++) {
    this.range[i.toString()] = [-5, 5];  // Smaller range, more dimensions
}
```

**Non-uniform dimension ranges:**
```javascript
this.range = {
    "0": [-20, 20],  // Wide range for major features
    "1": [-20, 20],
    "2": [-5, 5],    // Narrow range for subtle features
    "3": [-5, 5],
    "4": [-10, 10],  // Medium range
    "5": [-10, 10],
    "6": [-1, 1],    // Very narrow range
    "7": [-1, 1]
};
```

---

## API Endpoints

### `POST /api/RC/set_up`
Initialize participant and create individual data table.

**Request:**
```javascript
{
    "names": "participant_001"
}
```

**Response:**
```javascript
{
    "classes": ["happy", "sad", "surprise", "angry", "disgust", "fear", "other"],
    "n_rest": 200
}
```

### `GET /api/RC/get_stimuli`
Generate new stimulus from random latent vector.

**Headers:**
- `ID`: Participant identifier

**Response:**
```javascript
{
    "stimulus": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### `POST /api/RC/register_choices`
Submit categorization and intensity rating.

**Headers:**
- `ID`: Participant identifier
- `n_trial`: Current trial number

**Request:**
```javascript
{
    "choice": "happy",
    "intensity": 7
}
```

**Response:**
```javascript
{
    "finish": 0,
    "progress": 0.3
}
```

---

## Database Schema

### Participants Table (Extended)

Additional column for tracking RC task participation:

| Column | Type | Description |
|--------|------|-------------|
| `rc_attendance` | BOOLEAN | Whether participant completed RC task |

### Individual Participant Tables

Table name: `{participant_id}_RC` (e.g., `participant_001_RC`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing trial ID |
| `sample` | JSON | Latent vector that generated the stimulus |
| `categorization` | TEXT | Participant's emotion category choice |
| `intensity` | INTEGER | Intensity rating (typically 1-10) |

**Example participant data:**
```sql
-- Table: participant_001_RC
id | sample                              | categorization | intensity
1  | [2.3, -7.1, 0.8, 9.2, -3.4, 1.7, -8.9, 4.5] | happy         | 6
2  | [-1.2, 3.4, -6.7, 2.1, 8.9, -4.3, 0.5, -7.8] | sad          | 8
3  | [5.6, -2.1, 7.3, -9.4, 1.8, 6.2, -3.5, 0.7]  | surprise     | 4
```

---

## Setup Requirements

### Directory Structure

```
your_study/
├── experiments/
│   └── RC/
│       ├── controller.js              # This controller file
│       ├── public/
│       │   ├── experiment.ejs         # Frontend template
│       │   └── static/
│       │       ├── experiment.js      # Frontend JavaScript
│       │       └── experiment.css     # Frontend styles
│       └── custom_text/
│           └── instruction.html       # Task instructions
└── .env                              # Environment configuration
```

### External Service Requirements

You need an image generation service running that:

1. **Accepts HTTP POST requests** to `/generate` endpoint
2. **Receives JSON data** in format: `{"vector": [dim1, dim2, dim3, ...]}`
3. **Returns JSON response** with: `{"image": "base64_encoded_image_data"}`

**Example service interaction:**
```javascript
// Your controller sends:
POST http://localhost:8000/generate
Content-Type: application/json

{
    "vector": [2.3, -7.1, 0.8, 9.2, -3.4, 1.7, -8.9, 4.5]
}

// Service responds:
{
    "image": "iVBORw0KGgoAAAANSUhEUgAA...",  // base64 image data
    "pred_label": "happy"                    // optional: predicted emotion
}
```

### Frontend Integration

Your experiment webpage needs to handle:

```javascript
let currentTrial = 1;
let participantId = 'participant_001';

// Load next stimulus
function loadStimulus() {
    fetch('/api/RC/get_stimuli', {
        headers: { 'ID': participantId }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('stimulus-image').src = data.stimulus;
    });
}

// Submit response
function submitResponse(category, intensity) {
    fetch('/api/RC/register_choices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ID': participantId,
            'n_trial': currentTrial.toString()
        },
        body: JSON.stringify({
            choice: category,
            intensity: intensity
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.finish === 1) {
            showCompletionScreen();
        } else {
            currentTrial++;
            updateProgress(data.progress);
            setTimeout(loadStimulus, 200); // Brief pause
        }
    });
}
```

---

## Understanding the Method

### What is Reverse Correlation?

Reverse correlation is a powerful technique for understanding internal mental representations:

1. **Traditional approach**: Show controlled stimuli → measure responses
2. **Reverse correlation**: Show random stimuli → analyze which features predict specific responses

### How it Works

```javascript
// 1. Generate many random faces from latent space
const randomVectors = [
    [2.3, -7.1, 0.8, ...],  // Random vector 1
    [-1.2, 3.4, -6.7, ...], // Random vector 2
    [5.6, -2.1, 7.3, ...],  // Random vector 3
    // ... hundreds more
];

// 2. Collect responses for each face
const responses = [
    {vector: [2.3, -7.1, 0.8, ...], response: 'happy', intensity: 6},
    {vector: [-1.2, 3.4, -6.7, ...], response: 'sad', intensity: 8},
    {vector: [5.6, -2.1, 7.3, ...], response: 'surprise', intensity: 4},
    // ... corresponding responses
];

// 3. Analyze patterns (typically done in post-processing)
// - Which latent dimensions predict 'happy' responses?
// - What vector values are associated with high intensity ratings?
// - How do individual differences in responses reveal biases?
```

### Applications

- **Emotion perception research**: Understanding how people perceive emotions in faces
- **Individual differences**: Revealing personal biases in perception
- **Cross-cultural studies**: Comparing emotion recognition across cultures
- **Clinical research**: Studying altered perception in psychiatric conditions

---

## Best Practices

### 1. Sufficient Sample Size

Collect enough trials for reliable reverse correlation:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // For pilot studies
    this.n_trial = 50;   // Minimum for initial analysis
    
    // For publication-quality data
    this.n_trial = 200;  // Better statistical power
    
    // For individual difference studies
    this.n_trial = 500;  // High reliability for between-subject comparisons
}
```

### 2. Latent Space Configuration

Design your latent space thoughtfully:

```javascript
// Option 1: Uniform ranges (simplest)
this.range = {
    "0": [-10, 10], "1": [-10, 10], "2": [-10, 10], "3": [-10, 10],
    "4": [-10, 10], "5": [-10, 10], "6": [-10, 10], "7": [-10, 10]
};

// Option 2: Informed by previous research
this.range = {
    "0": [-20, 20],  // Major facial structure
    "1": [-20, 20],  // Major facial structure
    "2": [-10, 10],  // Moderate features
    "3": [-10, 10],  // Moderate features
    "4": [-5, 5],    // Subtle features
    "5": [-5, 5],    // Subtle features
    "6": [-2, 2],    // Very subtle features
    "7": [-2, 2]     // Very subtle features
};
```

### 3. Service Integration Testing

Test your image generation service thoroughly:

```javascript
async _test_image_service() {
    try {
        const test_vector = this._uniform_array_ranges(this.dim, this.range);
        console.log('Testing with vector:', test_vector);
        
        const result = await this._latent2image_batch([test_vector]);
        
        if (result && result[0]) {
            console.log('✅ Image service working');
            return true;
        } else {
            console.log('❌ Image service returned invalid response');
            return false;
        }
    } catch (error) {
        console.log('❌ Image service error:', error);
        return false;
    }
}

// Call during initialization
async _initialize() {
    await this._test_image_service();
    // ... rest of initialization
}
```

### 4. Fallback for Service Failures

Handle service failures gracefully:

```javascript
async get_stimuli(req, res, next) {
    const name = req.header('ID');
    const table_name = `${name}_${this.task}`;
    
    try {
        const sample = this._uniform_array_ranges(this.dim, this.range);
        
        await this._DB_add_row(table_name, {
            sample: JSON.stringify(sample)
        });
        
        try {
            // Try to generate image
            const pcx = await this.stimuli_processing([sample]);
            res.status(200).json({
                "stimulus": pcx[0]
            });
        } catch (serviceError) {
            console.warn('Image service failed, using noise image:', serviceError);
            
            // Fallback to noise image
            const noiseImage = this._noise_image(256, 256);
            res.status(200).json({
                "stimulus": noiseImage,
                "fallback": true
            });
        }
    } catch (error) {
        next(error);
    }
}
```

### 5. Data Quality Control

Monitor response patterns:

```javascript
async register_choices(req, res, next) {
    const name = req.header('ID');
    const selected = req.body.choice;
    const intensity = req.body.intensity;
    
    // Basic validation
    if (!this.classes.includes(selected)) {
        return res.status(400).json({
            error: 'Invalid emotion category'
        });
    }
    
    if (intensity < 1 || intensity > 10) {
        return res.status(400).json({
            error: 'Intensity must be between 1 and 10'
        });
    }
    
    // Quality control: warn about response patterns
    if (selected === 'other' && this._getConsecutiveOtherCount(name) > 5) {
        console.warn(`⚠️ Participant ${name} chose 'other' many times consecutively`);
    }
    
    // Continue with processing...
}
```

### 6. Analysis-Ready Data Export

Add methods for data analysis:

```javascript
async export_data(req, res, next) {
    const name = req.header('ID');
    const table_name = `${name}_${this.task}`;
    
    try {
        const data = await this._DB_get_row(table_name, {});
        
        // Format for analysis software (R, Python, etc.)
        const formatted_data = data.rows.map(row => ({
            trial_id: row.id,
            latent_vector: JSON.parse(row.sample),
            emotion_category: row.categorization,
            intensity_rating: row.intensity,
            participant: name
        }));
        
        res.status(200).json({
            participant: name,
            n_trials: formatted_data.length,
            data: formatted_data
        });
    } catch (error) {
        next(error);
    }
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create sophisticated reverse correlation experiments. The method provides powerful insights into internal mental representations while maintaining robust data collection and flexible configuration options.