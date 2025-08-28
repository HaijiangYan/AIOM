# Gibbs Sampling with People (GSP) Task Example

This example demonstrates how to build a Gibbs sampling experiment using AIOM's BaseController. The GSP task implements a human-guided optimization process where participants iteratively adjust individual dimensions of a latent vector to match specific emotion concepts, providing insights into human perception of high-dimensional spaces and mental representations.

## Overview

The Gibbs Sampling with People task is designed to understand how humans navigate high-dimensional latent spaces to find representations that match their internal concepts. It features:
- **Dimension-wise optimization** through iterative adjustment
- **Slider-based interaction** for intuitive parameter control
- **Multi-emotion exploration** across basic emotion categories
- **External image generation** from latent vector manipulation
- **Convergence tracking** through systematic sampling chains
- **Individual chain management** for each emotion category

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

### Gibbs Sampling Process

The GSP method works by:
1. **Starting from random point** in multi-dimensional latent space
2. **Fixing all dimensions** except one (Gibbs sampling principle)
3. **Presenting slider interface** to adjust the active dimension
4. **Collecting optimal value** from participant
5. **Moving to next dimension** and repeating process
6. **Iterating through dimensions** multiple times to find optimal representation

### Task Structure

On each trial, participants:
1. See a **grid of generated images** representing different values along one dimension
2. Use a **slider to select** the value that best matches the target emotion
3. View the **selected image** as confirmation
4. Continue to the **next dimension** until all dimensions are optimized
5. Repeat the process for **multiple sampling iterations**

### Emotion Categories

```javascript
this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
this.class_question = {
    'happy': 'Adjust the slider to match the following word as well as possible: happy',
    'sad': 'Adjust the slider to match the following word as well as possible: sad',
    // ... and so on for each emotion
};
```

---

## Controller Implementation

### Basic Setup

```javascript
const { BaseController } = require('aiom');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this.task = task;
        
        // External service configuration
        this.imageurl = 'http://localhost:8000';
        this.stimuli_processing = this._latent2image_batch;
        
        // Latent space configuration
        this.dim = 8;                               // 8-dimensional latent space
        this.range = {                              // Range for each dimension
            "0": [-10, 10], "1": [-10, 10], "2": [-10, 10], "3": [-10, 10],
            "4": [-10, 10], "5": [-10, 10], "6": [-10, 10], "7": [-10, 10]
        };
        this.resolution = {                         // Slider resolution per dimension
            "0": 10, "1": 10, "2": 10, "3": 10, "4": 10, 
            "5": 10, "6": 10, "7": 10, "8": 10, "9": 10,
            "10": 10, "11": 10, "12": 10, "13": 10, "14": 10, "15": 10
        };
        
        // Experiment parameters
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.n_chain = 1;                          // Chains per emotion class
        this.n_rest = 5;                           // Break duration (seconds)
        this.max_samples_per_class = 2;            // Iterations through all dimensions
        
        // Generate question prompts
        this.class_question = {};
        for (let i = 0; i < this.classes.length; i++) {
            this.class_question[this.classes[i]] = 
                `Adjust the slider to match the following word as well as possible: ${this.classes[i]}`;
        }
        
        this._initialize();
    }
}
```

### Database Initialization

Sets up participant tracking and individual sampling chains:

```javascript
async _initialize() {
    try {
        // Add GSP attendance tracking to participants table
        await this._DB_add_column('participants', 'gsp_attendance', 'BOOLEAN NOT NULL DEFAULT FALSE');
        
        console.log(`✅ ${this.task} initialized successfully.`);
    } catch (error) {
        console.error(`Error setting up ${this.task} database:`, error);
    }
}
```

---

## Key Features

### 1. Individual Sampling Chain Creation

Each participant gets separate chains for each emotion:

```javascript
async set_up(req, res, next) {
    const name = req.body.pid;
    
    try {
        // Mark participant as attending GSP
        await this._DB_update_row('participants', 
            { gsp_attendance: true }, 
            { participant: name }
        );
        
        // Create chains for each emotion class
        const shuffled_class_question = this._shuffle(Object.entries(this.class_question));
        
        for (let i = 1; i <= this.n_chain; i++) {
            for (let j = 0; j < this.n_class; j++) {
                const table_name = `${name}_gsp_${this.classes[j]}_no${i}`;
                
                // Create table for this emotion chain
                const columns = [
                    { name: 'id', type: 'SERIAL PRIMARY KEY' },
                    { name: 'sample', type: 'JSON NOT NULL' },        // Current latent vector
                    { name: 'current_dim', type: 'INTEGER NOT NULL' }  // Active dimension
                ];
                await this._DB_create_table(table_name, columns);
                
                // Initialize with random starting point
                const starting_point = this._uniform_array_ranges(this.dim, this.range);
                await this._DB_add_row(table_name, {
                    sample: JSON.stringify(starting_point),
                    current_dim: 0
                });
            }
        }
        
        res.status(200).json({
            "ordered_class_question": Object.fromEntries(shuffled_class_question),
            "n_rest": this.n_rest
        });
    } catch (error) {
        next(error);
    }
}
```

**What this creates:**
- **Per-emotion chains**: `participant_001_gsp_happy_no1`, `participant_001_gsp_sad_no1`, etc.
- **Random initialization**: Each chain starts from a different random point
- **Dimension tracking**: Current active dimension stored for each chain

### 2. Dimension-wise Stimulus Generation

Generates images spanning the range of one dimension:

```javascript
async get_choices(req, res, next) {
    const name = req.header('ID');
    const current_class = req.header('current_class');
    const table_no = Math.floor(Math.random() * this.n_chain) + 1;
    const table_name = `${name}_gsp_${current_class}_no${table_no}`;
    
    try {
        // Get current state of the sampling chain
        const result_ = await this._DB_get_latest_row(table_name, 'sample, current_dim');
        const current_state = result_.rows[0].sample;
        const current_dim = result_.rows[0].current_dim % this.dim;
        
        // Generate stimuli along the current dimension
        const { stimuli_list, proposed_values } = 
            this._generate_stimuli_along_dimension(current_state, current_dim);
        
        res.status(200).json({
            "stimuli": await this.stimuli_processing(stimuli_list),
            "current_state": current_state,
            "proposed_values": proposed_values,
            "current_dim": current_dim,
            "table_no": table_no
        });
    } catch (error) {
        next(error);
    }
}

_generate_stimuli_along_dimension(current_state, current_dim) {
    const stimuli_list = [];
    const proposed_values = [];
    const adj_key = Object.keys(this.range)[current_dim];
    
    // Generate points along the current dimension
    for (let i = 0; i < this.resolution[adj_key]; i++) {
        const new_point = [...current_state];  // Copy current state
        
        // Vary only the current dimension
        new_point[current_dim] = this.range[adj_key][0] + 
            (i / (this.resolution[adj_key] - 1)) * 
            (this.range[adj_key][1] - this.range[adj_key][0]);
        
        stimuli_list.push(new_point);
        proposed_values.push(new_point[current_dim]);
    }
    
    return { stimuli_list, proposed_values };
}
```

**How dimension scanning works:**
```javascript
// Example: Dimension 2 of an 8D vector
// Current state: [2.1, -3.4, 0.0, 7.8, -1.2, 5.5, -8.9, 2.3]
// Scanning dimension 2 with range [-10, 10] and resolution 10

const generated_points = [
    [2.1, -3.4, -10.0, 7.8, -1.2, 5.5, -8.9, 2.3],  // Min value
    [2.1, -3.4,  -7.8, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,  -5.6, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,  -3.3, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,  -1.1, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,   1.1, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,   3.3, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,   5.6, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,   7.8, 7.8, -1.2, 5.5, -8.9, 2.3],  // 
    [2.1, -3.4,  10.0, 7.8, -1.2, 5.5, -8.9, 2.3]   // Max value
];
```

### 3. Progressive Optimization Tracking

Tracks progress through dimensions and iterations:

```javascript
async register_choices(req, res, next) {
    const table_name = req.header('table_name');
    const n_trial = Number(req.header('n_trial'));
    const selected = req.body.choice;               // Participant's chosen vector
    const current_dim = Number(req.header('current_dim'));
    
    try {
        // Store the participant's selection for this dimension
        await this._DB_add_row(table_name, {
            sample: JSON.stringify(selected),
            current_dim: current_dim + 1            // Move to next dimension
        });
        
        console.log(`${table_name.split('_')[0]} updated dimension ${current_dim + 1} with GSP`);
        
        // Calculate progress through sampling iterations
        const n_samples_sofar = Math.floor(n_trial / this.dim);
        
        if (n_samples_sofar < this.max_samples_per_class) {
            // More iterations needed
            res.status(200).json({
                "finish": 0, 
                "progress": n_trial / (this.max_samples_per_class * this.dim)
            });
        } else {
            // Sampling complete for this emotion
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

**Progress calculation:**
```javascript
// Example with 8 dimensions, 2 iterations per emotion:
// Total trials needed: 8 dimensions × 2 iterations = 16 trials

const n_trial = 5;              // Current trial number
const n_samples_sofar = Math.floor(5 / 8);  // = 0 (still in first iteration)
const progress = 5 / (2 * 8);   // = 0.3125 (31.25% complete)

// When n_trial = 8: finished first pass through all dimensions
// When n_trial = 16: finished second pass, experiment complete
```

---

## Configuration Parameters

### Latent Space Configuration

| Parameter | Type | Description |
|-----------|------|-------------|
| `dim` | Number | Dimensionality of latent space |
| `range` | Object | Value ranges for each dimension |
| `resolution` | Object | Number of slider positions per dimension |

**Example configurations:**

```javascript
// High-resolution sampling
this.resolution = {
    "0": 20, "1": 20, "2": 20, "3": 20,  // 20 positions per dimension
    "4": 20, "5": 20, "6": 20, "7": 20
};

// Non-uniform resolution
this.resolution = {
    "0": 15,  // High resolution for important dimensions
    "1": 15,
    "2": 10,  // Medium resolution
    "3": 10,
    "4": 5,   // Low resolution for fine details
    "5": 5,
    "6": 5,
    "7": 5
};

// Different ranges per dimension
this.range = {
    "0": [-20, 20],  // Wide range for major features
    "1": [-20, 20],
    "2": [-5, 5],    // Narrow range for subtle features
    "3": [-5, 5],
    "4": [-2, 2],    // Very narrow range
    "5": [-2, 2],
    "6": [-1, 1],
    "7": [-1, 1]
};
```

### Experiment Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_samples_per_class` | Number | `2` | Complete passes through all dimensions |
| `n_chain` | Number | `1` | Parallel chains per emotion class |
| `n_rest` | Number | `5` | Break duration (seconds) |
| `classes` | Array | `['happy', 'sad', ...]` | Target emotions |

---

## API Endpoints

### `POST /api/GSP/set_up`
Initialize participant and create sampling chains.

**Request:**
```javascript
{
    "pid": "participant_001"
}
```

**Response:**
```javascript
{
    "ordered_class_question": {
        "happy": "Adjust the slider to match the following word as well as possible: happy",
        "sad": "Adjust the slider to match the following word as well as possible: sad",
        // ... shuffled order of all emotions
    },
    "n_rest": 5
}
```

### `GET /api/GSP/get_choices`
Get slider interface for current dimension.

**Headers:**
- `ID`: Participant identifier
- `current_class`: Current emotion being optimized (e.g., "happy")

**Response:**
```javascript
{
    "stimuli": [
        "data:image/png;base64,...",  // Image at dimension minimum
        "data:image/png;base64,...",  // Image at position 1
        // ... 8 more images across dimension range
        "data:image/png;base64,..."   // Image at dimension maximum
    ],
    "current_state": [2.1, -3.4, 0.0, 7.8, -1.2, 5.5, -8.9, 2.3],
    "proposed_values": [-10, -7.8, -5.6, -3.3, -1.1, 1.1, 3.3, 5.6, 7.8, 10],
    "current_dim": 2,
    "table_no": 1
}
```

### `POST /api/GSP/register_choices`
Submit optimized value for current dimension.

**Headers:**
- `table_name`: Target chain table (e.g., "participant_001_gsp_happy_no1")
- `n_trial`: Current trial number
- `current_dim`: Dimension that was just optimized

**Request:**
```javascript
{
    "choice": [2.1, -3.4, 3.3, 7.8, -1.2, 5.5, -8.9, 2.3]  // Selected latent vector
}
```

**Response:**
```javascript
{
    "finish": 0,      // 0 = continue, 1 = emotion complete
    "progress": 0.375 // 37.5% through this emotion
}
```

---

## Database Schema

### Extended Participants Table

| Column | Type | Description |
|--------|------|-------------|
| `gsp_attendance` | BOOLEAN | Whether participant completed GSP task |

### Individual Sampling Chain Tables

Table name: `{participant_id}_gsp_{emotion}_{chain_no}` 

Example: `participant_001_gsp_happy_no1`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Sampling step identifier |
| `sample` | JSON | Latent vector at this step |
| `current_dim` | INTEGER | Next dimension to be optimized |

**Example chain data:**
```sql
-- Table: participant_001_gsp_happy_no1
id | sample                                    | current_dim
1  | [1.2, -0.5, 3.8, -2.1, 0.9, -4.2, 1.7, 0.3] | 0
2  | [5.5, -0.5, 3.8, -2.1, 0.9, -4.2, 1.7, 0.3] | 1  -- Optimized dim 0
3  | [5.5, -2.8, 3.8, -2.1, 0.9, -4.2, 1.7, 0.3] | 2  -- Optimized dim 1
4  | [5.5, -2.8, 7.2, -2.1, 0.9, -4.2, 1.7, 0.3] | 3  -- Optimized dim 2
-- ... continues through all dimensions multiple times
```

---

## Setup Requirements

### Directory Structure

```
your_study/
├── experiments/
│   └── GSP/
│       ├── controller.js              # This controller file
│       ├── public/
│       │   ├── experiment.ejs         # Frontend template
│       │   └── static/
│       │       ├── experiment.js      # Slider interface JavaScript
│       │       └── experiment.css     # Styling for slider UI
│       └── custom_text/
│           └── instruction.html       # Task instructions
└── .env                              # Environment configuration
```

### External Service Requirements

Image generation service at `http://localhost:8000` that:

1. **Accepts batch requests**: `/generate` endpoint
2. **Processes vector arrays**: `{"vectors": [[dim1, dim2, ...], [dim1, dim2, ...], ...]}`
3. **Returns image array**: `{"images": ["base64_1", "base64_2", ...]}`

### Frontend Implementation

The webpage needs a slider interface:

```html
<!-- Emotion prompt -->
<div id="prompt-container">
    <h2 id="emotion-prompt">Adjust the slider to match: happy</h2>
</div>

<!-- Image grid showing dimension variations -->
<div id="image-grid">
    <!-- Images populated by JavaScript -->
</div>

<!-- Slider interface -->
<div id="slider-container">
    <input type="range" id="dimension-slider" min="0" max="9" value="5" />
    <div id="slider-labels">
        <span>-10</span>
        <span>10</span>
    </div>
</div>

<!-- Selected image preview -->
<div id="selected-preview">
    <img id="selected-image" alt="Selected expression" />
    <button id="confirm-btn" onclick="confirmSelection()">Confirm Selection</button>
</div>
```

JavaScript for slider interaction:

```javascript
let currentStimuli = [];
let currentValues = [];
let currentState = [];

// Load dimension interface
async function loadDimension(emotionClass) {
    const response = await fetch('/api/GSP/get_choices', {
        headers: {
            'ID': participantId,
            'current_class': emotionClass
        }
    });
    
    const data = await response.json();
    
    currentStimuli = data.stimuli;
    currentValues = data.proposed_values;
    currentState = data.current_state;
    currentTableName = `${participantId}_gsp_${emotionClass}_no${data.table_no}`;
    
    // Display images in grid
    displayImageGrid(data.stimuli);
    
    // Update slider
    updateSlider(data.current_dim, data.proposed_values);
}

// Update display when slider moves
function onSliderChange(sliderValue) {
    const imageIndex = parseInt(sliderValue);
    document.getElementById('selected-image').src = currentStimuli[imageIndex];
}

// Confirm participant's choice
async function confirmSelection() {
    const sliderValue = document.getElementById('dimension-slider').value;
    const selectedIndex = parseInt(sliderValue);
    
    // Create the new latent vector with updated dimension
    const newState = [...currentState];
    newState[currentDim] = currentValues[selectedIndex];
    
    const response = await fetch('/api/GSP/register_choices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'table_name': currentTableName,
            'n_trial': trialNumber.toString(),
            'current_dim': currentDim.toString()
        },
        body: JSON.stringify({
            choice: newState
        })
    });
    
    const result = await response.json();
    
    if (result.finish === 1) {
        // Move to next emotion or complete experiment
        moveToNextEmotion();
    } else {
        // Continue with next dimension
        trialNumber++;
        updateProgress(result.progress);
        loadDimension(currentEmotion);
    }
}
```

---

## Understanding the Method

### What is Gibbs Sampling with People?

GSP is a human-in-the-loop optimization method that:

1. **Applies Gibbs sampling principle**: Optimize one dimension at a time while holding others fixed
2. **Uses human judgment**: Participants serve as the optimization function
3. **Explores high-dimensional spaces**: Systematically navigates complex latent representations
4. **Captures semantic relationships**: Reveals how humans understand abstract concepts

### Mathematical Foundation

```javascript
// Traditional Gibbs sampling updates one variable at a time:
// x^(t+1) = [x₁^(t+1), x₂^t, x₃^t, ..., xₙ^t]     // Update dimension 1
// x^(t+2) = [x₁^(t+1), x₂^(t+1), x₃^t, ..., xₙ^t] // Update dimension 2
// ... continue through all dimensions

// In GSP, humans provide the conditional distribution:
// P(x_i | x_{-i}, concept) where concept = "happiness", "sadness", etc.
```

### Research Applications

- **Semantic space mapping**: Understanding how concepts are represented in latent spaces
- **Individual differences**: Revealing personal concept boundaries and biases
- **Model evaluation**: Testing whether generative models align with human intuitions
- **Concept discovery**: Finding interpretable directions in high-dimensional spaces

---

## Best Practices

### 1. Dimension Organization

Structure dimensions by importance:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // Organize dimensions by semantic importance
    this.dimension_labels = {
        "0": "overall_expression_intensity",
        "1": "positive_negative_valence", 
        "2": "facial_width_narrow_wide",
        "3": "eye_openness",
        "4": "mouth_curvature",
        "5": "eyebrow_position",
        "6": "facial_symmetry",
        "7": "fine_details"
    };
    
    // Different resolutions based on importance
    this.resolution = {
        "0": 15,  // High resolution for key dimensions
        "1": 15,
        "2": 10,  // Medium resolution
        "3": 10,
        "4": 8,   // Lower resolution for subtle features
        "5": 8,
        "6": 5,
        "7": 5
    };
}
```

### 2. Convergence Monitoring

Track sampling convergence:

```javascript
async register_choices(req, res, next) {
    const table_name = req.header('table_name');
    const selected = req.body.choice;
    const current_dim = Number(req.header('current_dim'));
    
    try {
        // Store selection
        await this._DB_add_row(table_name, {
            sample: JSON.stringify(selected),
            current_dim: current_dim + 1
        });
        
        // Check for convergence
        if (current_dim === this.dim - 1) {  // Completed one full iteration
            const convergence = await this._checkConvergence(table_name);
            console.log(`Convergence metric for ${table_name}: ${convergence}`);
        }
        
        // Continue with normal flow...
    } catch (error) {
        next(error);
    }
}

async _checkConvergence(table_name) {
    const recent_samples = await this._DB_get_row(table_name, {}, 'sample', 
        `ORDER BY id DESC LIMIT ${this.dim * 2}`);
    
    if (recent_samples.rows.length < this.dim * 2) return 0;
    
    // Calculate distance between recent iterations
    const latest_iteration = recent_samples.rows.slice(0, this.dim);
    const previous_iteration = recent_samples.rows.slice(this.dim, this.dim * 2);
    
    let total_distance = 0;
    for (let i = 0; i < this.dim; i++) {
        const latest = JSON.parse(latest_iteration[i].sample);
        const previous = JSON.parse(previous_iteration[i].sample);
        total_distance += this._euclideanDistance(latest, previous);
    }
    
    return total_distance / this.dim;  // Average change per dimension
}
```

### 3. Adaptive Resolution

Adjust slider resolution based on participant behavior:

```javascript
_generate_stimuli_along_dimension(current_state, current_dim, iteration = 1) {
    const stimuli_list = [];
    const proposed_values = [];
    const adj_key = Object.keys(this.range)[current_dim];
    
    // Adaptive resolution: finer resolution in later iterations
    let current_resolution = this.resolution[adj_key];
    if (iteration > 1) {
        current_resolution = Math.min(current_resolution * 1.5, 20);
    }
    
    // Focus around current value in later iterations
    let range_min = this.range[adj_key][0];
    let range_max = this.range[adj_key][1];
    
    if (iteration > 1) {
        const current_val = current_state[current_dim];
        const range_width = (range_max - range_min) * 0.3; // 30% of original range
        range_min = Math.max(this.range[adj_key][0], current_val - range_width/2);
        range_max = Math.min(this.range[adj_key][1], current_val + range_width/2);
    }
    
    for (let i = 0; i < current_resolution; i++) {
        const new_point = [...current_state];
        new_point[current_dim] = range_min + 
            (i / (current_resolution - 1)) * (range_max - range_min);
        
        stimuli_list.push(new_point);
        proposed_values.push(new_point[current_dim]);
    }
    
    return { stimuli_list, proposed_values };
}
```

### 4. Multi-Chain Comparison

Run multiple chains for reliability:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    this.n_chain = 3;  // Run 3 independent chains per emotion
    
    // Different initialization strategies
    this.init_strategies = [
        'random',           // Completely random
        'center',           // Start near origin
        'extreme'           // Start at extreme values
    ];
}

async set_up(req, res, next) {
    // ... existing code ...
    
    for (let i = 1; i <= this.n_chain; i++) {
        for (let j = 0; j < this.n_class; j++) {
            const table_name = `${name}_gsp_${this.classes[j]}_no${i}`;
            
            // Different initialization for each chain
            let starting_point;
            switch (this.init_strategies[(i-1) % this.init_strategies.length]) {
                case 'random':
                    starting_point = this._uniform_array_ranges(this.dim, this.range);
                    break;
                case 'center':
                    starting_point = new Array(this.dim).fill(0);
                    break;
                case 'extreme':
                    starting_point = this._uniform_array_ranges(this.dim, this.range)
                        .map(x => x > 0 ? this.range["0"][1] * 0.8 : this.range["0"][0] * 0.8);
                    break;
            }
            
            await this._DB_add_row(table_name, {
                sample: JSON.stringify(starting_point),
                current_dim: 0,
                init_strategy: this.init_strategies[(i-1) % this.init_strategies.length]
            });
        }
    }
}
```

### 5. Data Analysis Support

Add methods for analyzing results:

```javascript
async analyze_convergence(req, res, next) {
    const participant_id = req.query.participant_id;
    const emotion_class = req.query.emotion_class;
    
    try {
        const results = {};
        
        // Analyze all chains for this emotion
        for (let chain = 1; chain <= this.n_chain; chain++) {
            const table_name = `${participant_id}_gsp_${emotion_class}_no${chain}`;
            const chain_data = await this._DB_get_row(table_name, {}, '*', 'ORDER BY id');
            
            // Calculate convergence metrics
            const samples = chain_data.rows.map(row => JSON.parse(row.sample));
            const final_sample = samples[samples.length - 1];
            
            results[`chain_${chain}`] = {
                final_vector: final_sample,
                n_iterations: Math.floor(samples.length / this.dim),
                convergence_path: this._analyzeConvergencePath(samples)
            };
        }
        
        // Compare chains
        results.inter_chain_reliability = this._calculateInterChainReliability(results);
        
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
}

_analyzeConvergencePath(samples) {
    const path_analysis = [];
    
    for (let i = this.dim; i < samples.length; i += this.dim) {
        const current_iteration = samples.slice(i - this.dim, i);
        const previous_iteration = samples.slice(i - 2 * this.dim, i - this.dim);
        
        if (previous_iteration.length === this.dim) {
            let change = 0;
            for (let d = 0; d < this.dim; d++) {
                change += Math.abs(current_iteration[d][d] - previous_iteration[d][d]);
            }
            path_analysis.push(change / this.dim);
        }
    }
    
    return path_analysis;
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create sophisticated Gibbs sampling experiments with human participants. The method provides powerful insights into how humans navigate high-dimensional concept spaces while maintaining robust data collection and systematic optimization tracking.