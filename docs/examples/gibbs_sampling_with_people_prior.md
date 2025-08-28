# Gibbs Sampling with People with Prior (GSP_prior) Task Example

This example demonstrates how to build an advanced Gibbs sampling experiment with prior knowledge integration using AIOM's BaseController. The GSP_prior task extends the standard GSP method by incorporating participants' existing knowledge through an initial production phase, then using this prior information to guide the sampling process, providing deeper insights into how humans refine and optimize their internal representations.

## Overview

The Gibbs Sampling with People with Prior task combines production and optimization methodologies to understand how humans use prior knowledge to navigate high-dimensional spaces. It features:
- **Two-phase experimental design** with production followed by optimization
- **Prior knowledge extraction** through initial expression production
- **Informed initialization** using participant-specific starting points
- **Adaptive parameter adjustment** based on individual differences
- **Cross-phase data integration** linking production and optimization results
- **Enhanced convergence tracking** with baseline comparisons

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

### Two-Phase Process

**Phase 1: Prior Elicitation**
1. **Production task**: Participants create expressions using webcam/sliders
2. **Prior extraction**: System analyzes produced expressions to estimate latent representations
3. **Baseline establishment**: Creates participant-specific starting points for optimization

**Phase 2: Guided Optimization**
1. **Informed initialization**: Begin Gibbs sampling from prior-derived starting points
2. **Adaptive exploration**: Adjust search ranges based on prior knowledge
3. **Convergence tracking**: Compare optimization path to naive random initialization

### Task Structure

On each trial in Phase 2, participants:
1. See **prior-informed image variations** along one dimension
2. Use **adjusted slider ranges** centered around prior estimates
3. **Refine their concept** through iterative optimization
4. **Compare with baseline** to measure improvement over naive sampling

### Prior Integration Methods

```javascript
this.prior_integration_methods = {
    'initialization': 'Use prior as starting point',
    'range_adjustment': 'Center search ranges around prior estimates',
    'adaptive_resolution': 'Higher resolution near prior estimates',
    'hybrid_guidance': 'Combine multiple integration strategies'
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
        
        // Inherit GSP configuration
        this.imageurl = 'http://localhost:8000';
        this.stimuli_processing = this._latent2image_batch;
        
        // Extended configuration for prior integration
        this.dim = 8;
        this.range = {
            "0": [-10, 10], "1": [-10, 10], "2": [-10, 10], "3": [-10, 10],
            "4": [-10, 10], "5": [-10, 10], "6": [-10, 10], "7": [-10, 10]
        };
        this.resolution = {
            "0": 10, "1": 10, "2": 10, "3": 10, "4": 10, 
            "5": 10, "6": 10, "7": 10
        };
        
        // Prior-specific parameters
        this.prior_weight = 0.7;                    // How much to trust prior vs exploration
        this.adaptive_range_factor = 0.5;           // Shrink ranges around priors
        this.baseline_comparison = true;            // Run parallel naive chains
        this.prior_confidence_threshold = 0.6;      // Minimum confidence to use prior
        
        // Experiment parameters
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.n_chain = 2;                          // Prior-informed + baseline chains
        this.n_rest = 5;
        this.max_samples_per_class = 3;            // More iterations for refinement
        
        // Phase management
        this.current_phase = 'production';         // 'production' or 'optimization'
        this.production_methods = ['webcam', 'slider']; // Available production modes
        
        // Generate question prompts
        this.class_question = {};
        this.production_prompts = {};
        for (let i = 0; i < this.classes.length; i++) {
            this.class_question[this.classes[i]] = 
                `Refine the slider based on your previous experience to better match: ${this.classes[i]}`;
            this.production_prompts[this.classes[i]] = 
                `Create the most typical ${this.classes[i]} expression you can imagine`;
        }
        
        this._initialize();
    }
}
```

### Database Initialization

Sets up multi-phase tracking and prior storage:

```javascript
async _initialize() {
    try {
        // Add GSP_prior attendance tracking
        await this._DB_add_column('participants', 'gsp_prior_attendance', 'BOOLEAN NOT NULL DEFAULT FALSE');
        await this._DB_add_column('participants', 'production_phase_complete', 'BOOLEAN NOT NULL DEFAULT FALSE');
        
        // Create prior storage table
        await this._DB_create_table('participant_priors', [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },
            { name: 'participant_id', type: 'TEXT NOT NULL' },
            { name: 'emotion_class', type: 'TEXT NOT NULL' },
            { name: 'prior_vector', type: 'JSON NOT NULL' },          // Extracted prior representation
            { name: 'confidence_score', type: 'REAL NOT NULL' },      // Confidence in prior
            { name: 'production_method', type: 'TEXT NOT NULL' },     // How prior was obtained
            { name: 'extraction_date', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
            { name: 'UNIQUE(participant_id, emotion_class)', type: '' } // One prior per emotion per participant
        ]);
        
        console.log(`✅ ${this.task} initialized successfully.`);
    } catch (error) {
        console.error(`Error setting up ${this.task} database:`, error);
    }
}
```

---

## Key Features

### 1. Prior Knowledge Extraction

Analyzes production data to extract latent priors:

```javascript
async extract_priors(req, res, next) {
    const participant_id = req.header('ID');
    const emotion_class = req.header('emotion_class');
    const production_data = req.body.production_data;  // From production phase
    
    try {
        // Process production data to estimate latent representation
        const prior_vector = await this._estimate_latent_from_production(
            production_data, 
            emotion_class
        );
        
        // Calculate confidence based on production consistency
        const confidence = this._calculate_prior_confidence(production_data);
        
        // Store extracted prior
        await this._DB_add_row('participant_priors', {
            participant_id: participant_id,
            emotion_class: emotion_class,
            prior_vector: JSON.stringify(prior_vector),
            confidence_score: confidence,
            production_method: production_data.method
        }, {
            onConflict: {
                columns: 'participant_id, emotion_class',
                action: 'update',
                updateColumns: ['prior_vector', 'confidence_score', 'extraction_date']
            }
        });
        
        res.status(200).json({
            "prior_extracted": true,
            "confidence": confidence,
            "vector": prior_vector
        });
    } catch (error) {
        next(error);
    }
}

async _estimate_latent_from_production(production_data, emotion_class) {
    switch (production_data.method) {
        case 'webcam':
            // Use computer vision to analyze facial expressions
            return await this._analyze_facial_expression_image(production_data.image);
            
        case 'slider':
            // Use direct slider values as latent representation
            return production_data.slider_values;
            
        case 'selection':
            // Use reverse correlation from selection data
            return await this._reverse_correlate_selections(production_data.choices);
            
        default:
            // Fallback to random initialization
            return this._uniform_array_ranges(this.dim, this.range);
    }
}

_calculate_prior_confidence(production_data) {
    // Calculate confidence based on production consistency
    let confidence = 0.5; // Base confidence
    
    if (production_data.method === 'webcam') {
        // Higher confidence for actual facial expressions
        confidence = 0.8;
    } else if (production_data.method === 'slider') {
        // Confidence based on time spent adjusting
        const adjustment_time = production_data.total_time || 10000;
        confidence = Math.min(0.9, 0.4 + (adjustment_time / 30000) * 0.4);
    }
    
    return Math.max(0.1, Math.min(0.9, confidence));
}
```

### 2. Prior-Informed Chain Creation

Creates optimization chains using extracted priors:

```javascript
async set_up_optimization_phase(req, res, next) {
    const name = req.body.pid;
    
    try {
        // Mark optimization phase started
        await this._DB_update_row('participants', 
            { production_phase_complete: true, gsp_prior_attendance: true }, 
            { participant: name }
        );
        
        // Get all extracted priors for this participant
        const priors = await this._DB_get_row('participant_priors', 
            { participant_id: name });
        
        const shuffled_class_question = this._shuffle(Object.entries(this.class_question));
        
        for (let i = 1; i <= this.n_chain; i++) {
            for (let j = 0; j < this.n_class; j++) {
                const emotion = this.classes[j];
                const table_name = `${name}_gsp_prior_${emotion}_no${i}`;
                
                // Create table for this emotion chain
                const columns = [
                    { name: 'id', type: 'SERIAL PRIMARY KEY' },
                    { name: 'sample', type: 'JSON NOT NULL' },
                    { name: 'current_dim', type: 'INTEGER NOT NULL' },
                    { name: 'chain_type', type: 'TEXT NOT NULL' },        // 'prior' or 'baseline'
                    { name: 'prior_influence', type: 'REAL' },            // How much prior influenced this step
                    { name: 'adapted_range', type: 'JSON' }               // Adapted ranges for this dimension
                ];
                await this._DB_create_table(table_name, columns);
                
                // Determine starting point and chain type
                let starting_point, chain_type, adapted_ranges;
                
                if (i === 1) {
                    // First chain: Prior-informed
                    const prior_data = priors.rows.find(row => row.emotion_class === emotion);
                    
                    if (prior_data && prior_data.confidence_score > this.prior_confidence_threshold) {
                        starting_point = JSON.parse(prior_data.prior_vector);
                        chain_type = 'prior_informed';
                        adapted_ranges = this._adapt_ranges_for_prior(starting_point);
                    } else {
                        // Low confidence prior, use random start but mark as baseline
                        starting_point = this._uniform_array_ranges(this.dim, this.range);
                        chain_type = 'low_confidence_baseline';
                        adapted_ranges = this.range;
                    }
                } else {
                    // Subsequent chains: Baseline comparison
                    starting_point = this._uniform_array_ranges(this.dim, this.range);
                    chain_type = 'baseline';
                    adapted_ranges = this.range;
                }
                
                await this._DB_add_row(table_name, {
                    sample: JSON.stringify(starting_point),
                    current_dim: 0,
                    chain_type: chain_type,
                    prior_influence: i === 1 ? this.prior_weight : 0.0,
                    adapted_range: JSON.stringify(adapted_ranges)
                });
            }
        }
        
        res.status(200).json({
            "ordered_class_question": Object.fromEntries(shuffled_class_question),
            "n_rest": this.n_rest,
            "phase": "optimization",
            "prior_integration": "active"
        });
    } catch (error) {
        next(error);
    }
}

_adapt_ranges_for_prior(prior_vector) {
    const adapted_ranges = {};
    
    for (let dim = 0; dim < this.dim; dim++) {
        const original_range = this.range[dim.toString()];
        const prior_value = prior_vector[dim];
        const range_width = (original_range[1] - original_range[0]) * this.adaptive_range_factor;
        
        // Center adapted range around prior estimate
        const adapted_min = Math.max(original_range[0], prior_value - range_width/2);
        const adapted_max = Math.min(original_range[1], prior_value + range_width/2);
        
        adapted_ranges[dim.toString()] = [adapted_min, adapted_max];
    }
    
    return adapted_ranges;
}
```

### 3. Prior-Guided Stimulus Generation

Generates stimuli using prior-informed ranges:

```javascript
async get_choices(req, res, next) {
    const name = req.header('ID');
    const current_class = req.header('current_class');
    const phase = req.header('phase') || 'optimization';
    
    if (phase === 'production') {
        return this._handle_production_phase(req, res, next);
    }
    
    // Optimization phase: Use prior-informed sampling
    const table_no = Math.floor(Math.random() * this.n_chain) + 1;
    const table_name = `${name}_gsp_prior_${current_class}_no${table_no}`;
    
    try {
        const result_ = await this._DB_get_latest_row(table_name, 
            'sample, current_dim, chain_type, adapted_range');
        
        const current_state = result_.rows[0].sample;
        const current_dim = result_.rows[0].current_dim % this.dim;
        const chain_type = result_.rows[0].chain_type;
        const adapted_range = JSON.parse(result_.rows[0].adapted_range || '{}');
        
        // Use adapted ranges for prior-informed chains
        const effective_range = chain_type === 'prior_informed' ? 
            adapted_range : this.range;
        
        const { stimuli_list, proposed_values } = 
            this._generate_stimuli_along_dimension_with_prior(
                current_state, 
                current_dim, 
                effective_range,
                chain_type
            );
        
        res.status(200).json({
            "stimuli": await this.stimuli_processing(stimuli_list),
            "current_state": current_state,
            "proposed_values": proposed_values,
            "current_dim": current_dim,
            "table_no": table_no,
            "chain_type": chain_type,
            "using_prior": chain_type === 'prior_informed'
        });
    } catch (error) {
        next(error);
    }
}

_generate_stimuli_along_dimension_with_prior(current_state, current_dim, ranges, chain_type) {
    const stimuli_list = [];
    const proposed_values = [];
    const adj_key = current_dim.toString();
    
    // Use appropriate range for this chain type
    const range_to_use = ranges[adj_key] || this.range[adj_key];
    const resolution = this.resolution[adj_key];
    
    // Higher resolution for prior-informed chains
    const effective_resolution = chain_type === 'prior_informed' ? 
        Math.min(resolution * 1.5, 20) : resolution;
    
    for (let i = 0; i < effective_resolution; i++) {
        const new_point = [...current_state];
        
        new_point[current_dim] = range_to_use[0] + 
            (i / (effective_resolution - 1)) * 
            (range_to_use[1] - range_to_use[0]);
        
        stimuli_list.push(new_point);
        proposed_values.push(new_point[current_dim]);
    }
    
    return { stimuli_list, proposed_values };
}
```

### 4. Enhanced Progress Tracking

Tracks optimization with prior comparison:

```javascript
async register_choices(req, res, next) {
    const table_name = req.header('table_name');
    const n_trial = Number(req.header('n_trial'));
    const selected = req.body.choice;
    const current_dim = Number(req.header('current_dim'));
    const phase = req.header('phase') || 'optimization';
    
    if (phase === 'production') {
        return this._handle_production_choice(req, res, next);
    }
    
    try {
        // Get current chain information
        const chain_info = await this._DB_get_latest_row(table_name, 
            'chain_type, prior_influence, adapted_range');
        
        const chain_type = chain_info.rows[0].chain_type;
        const adapted_range = JSON.parse(chain_info.rows[0].adapted_range || '{}');
        
        // Calculate how much this selection was influenced by prior
        const prior_influence = chain_type === 'prior_informed' ? 
            this._calculate_step_prior_influence(selected, adapted_range) : 0.0;
        
        // Store the selection with metadata
        await this._DB_add_row(table_name, {
            sample: JSON.stringify(selected),
            current_dim: current_dim + 1,
            chain_type: chain_type,
            prior_influence: prior_influence,
            adapted_range: JSON.stringify(adapted_range)
        });
        
        console.log(`${table_name.split('_')[0]} updated dimension ${current_dim + 1} with GSP_prior (${chain_type})`);
        
        // Calculate progress with phase consideration
        const n_samples_sofar = Math.floor(n_trial / this.dim);
        
        if (n_samples_sofar < this.max_samples_per_class) {
            res.status(200).json({
                "finish": 0, 
                "progress": n_trial / (this.max_samples_per_class * this.dim),
                "chain_type": chain_type,
                "prior_influence": prior_influence
            });
        } else {
            // Check if we should move to next emotion or complete
            res.status(200).json({
                "finish": 1, 
                "progress": 1.0,
                "chain_type": chain_type
            });
        }
    } catch (error) {
        next(error);
    }
}

_calculate_step_prior_influence(selected_vector, adapted_range) {
    // Calculate how much the selection was within the prior-adapted ranges
    let within_prior_count = 0;
    
    for (let dim = 0; dim < this.dim; dim++) {
        const value = selected_vector[dim];
        const adapted = adapted_range[dim.toString()];
        const original = this.range[dim.toString()];
        
        if (adapted) {
            // Check if selection is closer to prior range than original range
            const adapted_center = (adapted[0] + adapted[1]) / 2;
            const original_center = (original[0] + original[1]) / 2;
            
            if (Math.abs(value - adapted_center) < Math.abs(value - original_center)) {
                within_prior_count++;
            }
        }
    }
    
    return within_prior_count / this.dim; // Proportion influenced by prior
}
```

---

## Configuration Parameters

### Prior Integration Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prior_weight` | Number | `0.7` | Trust level for prior vs exploration |
| `adaptive_range_factor` | Number | `0.5` | How much to shrink ranges around priors |
| `prior_confidence_threshold` | Number | `0.6` | Minimum confidence to use prior |
| `baseline_comparison` | Boolean | `true` | Run parallel naive chains |

### Production Phase Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `production_methods` | Array | `['webcam', 'slider']` | Available prior elicitation methods |
| `current_phase` | String | `'production'` | Current experimental phase |

### Extended Experiment Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_samples_per_class` | Number | `3` | More iterations for prior refinement |
| `n_chain` | Number | `2` | Prior-informed + baseline chains |

---

## API Endpoints

### `POST /api/GSP_prior/extract_priors`
Extract prior knowledge from production phase data.

**Headers:**
- `ID`: Participant identifier
- `emotion_class`: Target emotion class

**Request:**
```javascript
{
    "production_data": {
        "method": "webcam",
        "image": "base64_image_data",
        "total_time": 15000
    }
}
```

**Response:**
```javascript
{
    "prior_extracted": true,
    "confidence": 0.8,
    "vector": [2.3, -1.4, 5.7, -0.8, 3.2, -4.1, 1.9, -2.6]
}
```

### `POST /api/GSP_prior/set_up_optimization_phase`
Initialize optimization phase with prior-informed chains.

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
        "happy": "Refine the slider based on your previous experience to better match: happy",
        // ... other emotions
    },
    "n_rest": 5,
    "phase": "optimization",
    "prior_integration": "active"
}
```

### `GET /api/GSP_prior/get_choices`
Get prior-informed stimulus interface.

**Headers:**
- `ID`: Participant identifier
- `current_class`: Current emotion being optimized
- `phase`: Current phase ('production' or 'optimization')

**Response:**
```javascript
{
    "stimuli": ["base64_image_1", "base64_image_2", ...],
    "current_state": [2.3, -1.4, 5.7, -0.8, 3.2, -4.1, 1.9, -2.6],
    "proposed_values": [-5.2, -3.8, -2.4, -1.0, 0.4, 1.8, 3.2, 4.6, 6.0],
    "current_dim": 3,
    "table_no": 1,
    "chain_type": "prior_informed",
    "using_prior": true
}
```

### `POST /api/GSP_prior/register_choices`
Submit choice with prior influence tracking.

**Headers:**
- `table_name`: Target chain table
- `n_trial`: Current trial number
- `current_dim`: Dimension being optimized
- `phase`: Current phase

**Request:**
```javascript
{
    "choice": [2.3, -1.4, 3.2, -0.8, 3.2, -4.1, 1.9, -2.6]
}
```

**Response:**
```javascript
{
    "finish": 0,
    "progress": 0.4,
    "chain_type": "prior_informed",
    "prior_influence": 0.75
}
```

---

## Database Schema

### Extended Participants Table

| Column | Type | Description |
|--------|------|-------------|
| `gsp_prior_attendance` | BOOLEAN | Completed GSP_prior task |
| `production_phase_complete` | BOOLEAN | Finished production phase |

### Participant Priors Table

Table name: `participant_priors`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Unique prior identifier |
| `participant_id` | TEXT | Participant identifier |
| `emotion_class` | TEXT | Target emotion |
| `prior_vector` | JSON | Extracted latent representation |
| `confidence_score` | REAL | Confidence in prior (0.0-1.0) |
| `production_method` | TEXT | Method used for prior extraction |
| `extraction_date` | TIMESTAMP | When prior was extracted |

### Enhanced Chain Tables

Table name: `{participant_id}_gsp_prior_{emotion}_{chain_no}`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Sampling step identifier |
| `sample` | JSON | Latent vector at this step |
| `current_dim` | INTEGER | Next dimension to optimize |
| `chain_type` | TEXT | 'prior_informed' or 'baseline' |
| `prior_influence` | REAL | How much prior influenced this step |
| `adapted_range` | JSON | Ranges used for this dimension |

**Example data:**
```sql
-- Table: participant_001_gsp_prior_happy_no1
id | sample                  | current_dim | chain_type      | prior_influence | adapted_range
1  | [2.3, -1.4, 5.7, ...]  | 0          | prior_informed  | 0.7            | {"0": [-3, 7], ...}
2  | [4.1, -1.4, 5.7, ...]  | 1          | prior_informed  | 0.8            | {"0": [-3, 7], ...}
3  | [4.1, -0.2, 5.7, ...]  | 2          | prior_informed  | 0.6            | {"0": [-3, 7], ...}
```

---

## Setup Requirements

### Directory Structure

```
your_study/
├── experiments/
│   └── GSP_prior/
│       ├── controller.js              # This controller file
│       ├── public/
│       │   ├── experiment.ejs         # Two-phase interface
│       │   └── static/
│       │       ├── experiment.js      # Phase management
│       │       ├── production.js      # Production phase logic
│       │       ├── optimization.js    # Optimization phase logic
│       │       └── experiment.css     # Styling
│       └── custom_text/
│           ├── production_instructions.html
│           └── optimization_instructions.html
└── .env                              # Environment configuration
```

### Frontend Implementation

The webpage needs to handle both phases:

```javascript
// Phase management
let currentPhase = 'production';
let extractedPriors = {};

// Production phase
async function runProductionPhase() {
    currentPhase = 'production';
    
    for (const emotion of emotions) {
        // Run production task for this emotion
        const productionData = await collectProductionData(emotion);
        
        // Extract prior
        const prior = await fetch('/api/GSP_prior/extract_priors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ID': participantId,
                'emotion_class': emotion
            },
            body: JSON.stringify({
                production_data: productionData
            })
        }).then(r => r.json());
        
        extractedPriors[emotion] = prior;
    }
    
    // Move to optimization phase
    await initializeOptimizationPhase();
}

// Optimization phase
async function initializeOptimizationPhase() {
    const setup = await fetch('/api/GSP_prior/set_up_optimization_phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: participantId })
    }).then(r => r.json());
    
    currentPhase = 'optimization';
    
    // Show prior influence indicators
    updateUIForOptimizationPhase(setup);
    
    // Begin optimization
    runOptimizationPhase();
}

// Show prior influence in UI
function updateUIForOptimizationPhase(setup) {
    document.getElementById('phase-indicator').textContent = 'Optimization Phase';
    document.getElementById('prior-indicator').style.display = 'block';
    
    // Update instructions to mention prior knowledge
    document.getElementById('instructions').innerHTML = 
        'Now refine your selections based on your previous experience...';
}

// Enhanced choice handling with prior tracking
async function handleOptimizationChoice(choice) {
    const response = await fetch('/api/GSP_prior/register_choices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'table_name': currentTableName,
            'n_trial': trialNumber.toString(),
            'current_dim': currentDim.toString(),
            'phase': 'optimization'
        },
        body: JSON.stringify({ choice })
    });
    
    const result = await response.json();
    
    // Show prior influence feedback
    updatePriorInfluenceIndicator(result.prior_influence, result.chain_type);
    
    // Continue with optimization
    if (result.finish === 0) {
        trialNumber++;
        loadNextDimension();
    } else {
        moveToNextEmotion();
    }
}

function updatePriorInfluenceIndicator(influence, chainType) {
    const indicator = document.getElementById('prior-influence-meter');
    if (chainType === 'prior_informed') {
        indicator.style.width = (influence * 100) + '%';
        indicator.title = `${Math.round(influence * 100)}% influenced by your prior knowledge`;
    } else {
        indicator.style.width = '0%';
        indicator.title = 'Baseline comparison (no prior influence)';
    }
}
```

---

## Understanding the Method

### What is GSP with Prior?

GSP_prior extends traditional Gibbs sampling with human participants by:

1. **Eliciting prior knowledge**: Capture participants' existing concept representations
2. **Informed initialization**: Start optimization from meaningful points rather than random
3. **Adaptive exploration**: Focus search around prior estimates while allowing exploration
4. **Baseline comparison**: Run parallel chains to measure prior contribution

### Theoretical Foundation

```javascript
// Traditional GSP: P(x_i | x_{-i}, concept, random_start)
// GSP_prior: P(x_i | x_{-i}, concept, prior_knowledge)

// Where prior_knowledge includes:
// - Initial estimates from production phase
// - Confidence weights for different dimensions
// - Adapted search ranges
// - Individual difference parameters
```

### Research Applications

- **Prior knowledge effects**: How existing knowledge shapes optimization
- **Individual differences**: Personal variation in concept representations
- **Learning mechanisms**: How people refine their mental models
- **Transfer effects**: Cross-emotion knowledge transfer

---

## Best Practices

### 1. Prior Confidence Assessment

Implement robust confidence estimation:

```javascript
_calculate_comprehensive_prior_confidence(production_data, participant_history) {
    let confidence = 0.5;
    
    // Factor 1: Production method reliability
    const method_weights = {
        'webcam': 0.8,      // High confidence for actual expressions
        'slider': 0.6,      // Medium for direct parameter setting
        'selection': 0.4    // Lower for choice-based estimation
    };
    confidence *= method_weights[production_data.method] || 0.3;
    
    // Factor 2: Time investment (more time = higher confidence)
    const time_factor = Math.min(1.2, production_data.total_time / 20000);
    confidence *= time_factor;
    
    // Factor 3: Consistency across trials
    if (production_data.consistency_score) {
        confidence *= (0.5 + production_data.consistency_score * 0.5);
    }
    
    // Factor 4: Participant expertise/familiarity
    if (participant_history.previous_tasks > 0) {
        confidence *= 1.1; // Slight boost for experienced participants
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
}
```

### 2. Adaptive Range Management

Dynamically adjust ranges based on optimization progress:

```javascript
_update_adaptive_ranges(current_sample, original_prior, iteration) {
    const updated_ranges = {};
    
    for (let dim = 0; dim < this.dim; dim++) {
        const dim_key = dim.toString();
        const original_range = this.range[dim_key];
        const prior_value = original_prior[dim];
        const current_value = current_sample[dim];
        
        // Start with tight range around prior
        let range_width = (original_range[1] - original_range[0]) * this.adaptive_range_factor;
        
        // Expand range as optimization progresses
        if (iteration > 1) {
            const expansion_factor = 1 + (iteration - 1) * 0.2;
            range_width *= expansion_factor;
        }
        
        // Center range between prior and current estimates
        const center_value = (prior_value + current_value) / 2;
        
        const range_min = Math.max(original_range[0], center_value - range_width/2);
        const range_max = Math.min(original_range[1], center_value + range_width/2);
        
        updated_ranges[dim_key] = [range_min, range_max];
    }
    
    return updated_ranges;
}
```

### 3. Multi-Chain Analysis

Compare prior-informed and baseline chains:

```javascript
async analyze_prior_effectiveness(req, res, next) {
    const participant_id = req.query.participant_id;
    const emotion_class = req.query.emotion_class;
    
    try {
        const analysis_results = {};
        
        // Get data from all chains for this emotion
        for (let chain = 1; chain <= this.n_chain; chain++) {
            const table_name = `${participant_id}_gsp_prior_${emotion_class}_no${chain}`;
            const chain_data = await this._DB_get_row(table_name, {}, '*', 'ORDER BY id');
            
            const samples = chain_data.rows.map(row => JSON.parse(row.sample));
            const chain_type = chain_data.rows[0].chain_type;
            
            analysis_results[`chain_${chain}`] = {
                type: chain_type,
                final_sample: samples[samples.length - 1],
                convergence_speed: this._calculate_convergence_speed(samples),
                stability_metric: this._calculate_stability(samples),
                prior_usage: this._calculate_average_prior_influence(chain_data.rows)
            };
        }
        
        // Compare prior-informed vs baseline performance
        const prior_chain = Object.values(analysis_results)
            .find(chain => chain.type === 'prior_informed');
        const baseline_chain = Object.values(analysis_results)
            .find(chain => chain.type === 'baseline');
        
        if (prior_chain && baseline_chain) {
            analysis_results.comparison = {
                convergence_improvement: prior_chain.convergence_speed - baseline_chain.convergence_speed,
                stability_improvement: prior_chain.stability_metric - baseline_chain.stability_metric,
                final_distance: this._euclideanDistance(prior_chain.final_sample, baseline_chain.final_sample)
            };
        }
        
        res.status(200).json(analysis_results);
    } catch (error) {
        next(error);
    }
}

_calculate_convergence_speed(samples) {
    let total_change = 0;
    for (let i = 1; i < samples.length; i++) {
        total_change += this._euclideanDistance(samples[i], samples[i-1]);
    }
    return total_change / (samples.length - 1); // Average change per step
}

_calculate_average_prior_influence(chain_rows) {
    const influences = chain_rows
        .map(row => row.prior_influence)
        .filter(influence => influence !== null);
    
    return influences.length > 0 ? 
        influences.reduce((a, b) => a + b, 0) / influences.length : 0;
}
```

### 4. Cross-Emotion Prior Transfer

Analyze how priors from one emotion affect others:

```javascript
async analyze_cross_emotion_transfer(req, res, next) {
    const participant_id = req.query.participant_id;
    
    try {
        // Get all priors for this participant
        const all_priors = await this._DB_get_row('participant_priors', 
            { participant_id });
        
        const transfer_analysis = {};
        
        // Compare priors across emotions
        for (let i = 0; i < all_priors.rows.length; i++) {
            for (let j = i + 1; j < all_priors.rows.length; j++) {
                const prior_1 = JSON.parse(all_priors.rows[i].prior_vector);
                const prior_2 = JSON.parse(all_priors.rows[j].prior_vector);
                const emotion_1 = all_priors.rows[i].emotion_class;
                const emotion_2 = all_priors.rows[j].emotion_class;
                
                const similarity = this._calculate_vector_similarity(prior_1, prior_2);
                const pair_key = `${emotion_1}_${emotion_2}`;
                
                transfer_analysis[pair_key] = {
                    similarity: similarity,
                    euclidean_distance: this._euclideanDistance(prior_1, prior_2),
                    dimensional_correlations: this._calculate_dimensional_correlations(prior_1, prior_2)
                };
            }
        }
        
        res.status(200).json({
            participant_id,
            transfer_patterns: transfer_analysis,
            overall_coherence: this._calculate_overall_coherence(all_priors.rows)
        });
    } catch (error) {
        next(error);
    }
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create sophisticated two-phase experiments that leverage participants' prior knowledge to guide optimization processes. The method provides powerful insights into how humans use existing knowledge to navigate high-dimensional concept spaces while maintaining rigorous experimental control and comprehensive data collection.