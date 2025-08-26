# BlockwiseMCMCP Example

This example demonstrates how to build a sophisticated behavioral experiment using AIOM's BaseController. The BlockwiseMCMCP (Blockwise Markov Chain Monte Carlo with Categorical Prior) experiment implements a two-phase paradigm for studying human perception and categorization of facial expressions.

## Overview

BlockwiseMCMCP is an advanced experiment that combines:
- **Image generation** from latent vectors using external services
- **Bayesian sampling** with optional gatekeeper mechanisms
- **Multi-chain MCMC** for robust data collection
- **Attention checks** to ensure data quality
- **Dynamic database management** for complex experimental flows

## Table of Contents

- [Experiment Design](#experiment-design)
- [Controller Implementation](#controller-implementation)
- [Key Features](#key-features)
- [Configuration Parameters](#configuration-parameters)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Best Practices](#best-practices)

---

## Experiment Design

### Two-Phase Trial Structure

The experiment alternates between two trial types:

1. **Likelihood Trials**: Participants compare two generated face images and choose which better represents a specific emotion
2. **Prior Trials**: Participants categorize a single face image into one of seven emotion categories

### Emotion Categories

```javascript
this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
this.class_questions = [
    'who looks happier?', 
    'who looks sadder?', 
    'who looks more surprised?', 
    // ... corresponding questions for each emotion
];
```

---

## Controller Implementation

### Basic Setup

```javascript
const { BaseController } = require('aiom');
const { GaussianKDE: gk } = require('./utils/gatekeeper');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this.task = task;
        
        // Core experiment parameters
        this.imageurl = 'http://localhost:8000';
        this.n_chain = 7;              // Number of parallel chains
        this.max_trial = 10;           // Trials per participant
        this.dim = 16;                 // Latent space dimensions
        this.lower_bound = -10;        // Latent space bounds
        this.upper_bound = 10;
        
        // Gatekeeper settings for quality control
        this.gatekeeper = true;
        this.temperature = 2.0;
        this.stuck_patience = 1000;
        
        this._initialize();
    }
}
```

### Initialization Method

The `_initialize()` method sets up experiment-specific configurations:

```javascript
async _initialize() {
    try {
        // Initialize gatekeeper models for each emotion category
        if (this.gatekeeper) {
            this.gatekeeper = {};
            for (const cate of this.classes) {
                const modelFilename = `${cate}.json`;
                const modelFilePath = path.join(this.expPath, this.gatekeeper_dir, modelFilename);
                const modelParamsJson = fs.readFileSync(modelFilePath, 'utf8');
                const gatekeeper_parameters = JSON.parse(modelParamsJson);
                this.gatekeeper[cate] = new gk(gatekeeper_parameters, this.proposal_bandwidth);
            }
        }
        
        // Add experiment-specific columns to participants table
        for (const colname of this.classes) {
            await this._DB_add_column('participants', `${colname}_ss`, 'INTEGER NOT NULL DEFAULT 0');
        }
    } catch (error) {
        console.error(`Error setting up ${this.task} database:`, error);
    }
}
```

---

## Key Features

### 1. Multi-Chain MCMC Implementation

Each participant gets multiple parallel sampling chains to ensure robust data collection:

```javascript
async set_up(req, res, next) {
    const name = req.body.names;
    const shuffled_classes = this._shuffle([...this.classes]);
    
    // Create separate chains for each participant
    for (let i = 1; i <= this.n_chain; i++) {
        const table_name = `${name}_blockwise_no${i}`;
        this.stuck_count[table_name] = 0;
        
        const columns = [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },
            { name: 'stimulus', type: 'JSON NOT NULL' },
            { name: 'category', type: 'TEXT NOT NULL' },
            { name: 'for_prior', type: 'BOOLEAN' },
            { name: 'gatekeeper', type: 'BOOLEAN' }
        ];
        await this._DB_create_table(table_name, columns);
        
        // Initialize each chain with a different emotion category
        const current_class = shuffled_classes[(i-1) % this.n_class];
        const current_state = this.gatekeeper 
            ? this._limit_array_in_range(this.gatekeeper[current_class].sampling(), this.lower_bound, this.upper_bound) 
            : this._uniform_array(this.dim, this.lower_bound, this.upper_bound);
            
        await this._DB_add_row(table_name, {
            stimulus: JSON.stringify(current_state),
            category: current_class,
            for_prior: true
        });
    }
}
```

### 2. Dynamic Stimulus Generation

The experiment generates stimuli based on the current chain state:

```javascript
async get_choices(req, res, next) {
    const name = req.header('ID');
    const current_chain = Math.floor(Math.random() * this.n_chain) + 1;
    const table_name = `${name}_blockwise_no${current_chain}`;
    
    // Randomly implement attention checks
    const attention_check_trial = Math.random() < this.attention_check_rate;
    
    if (attention_check_trial && this.attention_check) {
        // Return attention check stimuli
        const attention_stimuli = this._get_attention_stimuli_path(attentionDir, current_class);
        res.status(200).json({
            'trial_type': 'attention_check',
            'current_class': current_class,
            "current": this._grab_image(attention_stimuli[0]), 
            "proposal": this._grab_image(attention_stimuli[1]), 
            "attention_check": [attention_stimuli[2][0], attention_stimuli[2][1]]
        });
    } else {
        // Generate experimental stimuli
        const new_stimuli = this.gatekeeper 
            ? await this._generate_stimulus_independence_gatekeeper(table_name)
            : await this._generate_stimulus(table_name);
            
        if (new_stimuli.trial_type === 'likelihood') {
            // Process stimuli through image generation service
            const stimuli_list_processed = await this._retryAsync(
                this.stimuli_processing_batch, 
                [[new_stimuli.current_state, new_stimuli.proposal]], 
                this
            );
            
            res.status(200).json({
                'trial_type': 'likelihood',
                'current_class': new_stimuli.current_class,
                'current_chain': current_chain,
                "current": stimuli_list_processed[0], 
                "proposal": stimuli_list_processed[1]
            });
        }
    }
}
```

### 3. Gatekeeper Quality Control

The gatekeeper mechanism ensures high-quality stimulus generation by filtering proposals through learned density models:

```javascript
async _generate_stimulus_independence_gatekeeper(table_name) {
    const check_table = await this._DB_get_latest_row(table_name, 'stimulus, category, for_prior');
    let current_state = check_table.rows[0].stimulus;
    let current_class = check_table.rows[0].category;
    
    if (check_table.rows[0].for_prior) {
        // Handle stuck chains by forcing category switches
        if (this.stuck_count[table_name] > this.stuck_patience) {
            this.stuck_count[table_name] = 0;
            current_class = this._random_choice(
                this.classes.filter(cls => cls !== current_class)
            );
            console.log(`Switching stuck chain to: ${current_class}`);
        }
        
        // Sample proposal from gatekeeper distribution
        const proposal = this._limit_array_in_range(
            this.gatekeeper[current_class].sampling(), 
            this.lower_bound, 
            this.upper_bound
        );
        
        // Ensure minimum distance between current state and proposal
        const distance = this._euclideanDistance(current_state, proposal);
        if (distance <= this.min_proposal_distance) {
            const auto_accepted = Math.random() < 0.5 ? proposal : current_state;
            await this._DB_add_row(table_name, {
                stimulus: JSON.stringify(auto_accepted),
                category: current_class,
                for_prior: false,
                gatekeeper: true
            });
            return this._generate_stimulus_independence_gatekeeper(table_name);
        }
        
        return {
            current_state,
            current_class,
            proposal,
            trial_type: 'likelihood'
        };
    }
}
```

### 4. External Image Generation Service

The controller integrates with an external image generation service:

```javascript
_latent2image(array) {
    const url = new URL(this.imageurl + '/generate');
    const postData = JSON.stringify({ vector: array });
    
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (!response.image) {
                        // Fallback to noise image if service fails
                        resolve({
                            image: this._noise_image(),
                            posterior: this.classes[Math.floor(Math.random() * this.n_class)]
                        });
                    } else {
                        resolve({
                            image: `data:image/png;base64,${response.image}`,
                            posterior: response.pred_label
                        });
                    }
                } catch (err) {
                    resolve({
                        image: this._noise_image(),
                        posterior: this.classes[Math.floor(Math.random() * this.n_class)]
                    });
                }
            });
        });
        
        req.on('error', (err) => {
            resolve({
                image: this._noise_image(),
                posterior: this.classes[Math.floor(Math.random() * this.n_class)]
            });
        });
        
        req.write(postData);
        req.end();
    });
}
```

---

## Configuration Parameters

### Core Experiment Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `imageurl` | String | `'http://localhost:8000'` | Image generation service URL |
| `n_chain` | Number | `7` | Number of parallel sampling chains |
| `max_trial` | Number | `10` | Maximum trials per participant |
| `dim` | Number | `16` | Dimensionality of latent space |
| `lower_bound` | Number | `-10` | Lower bound for latent values |
| `upper_bound` | Number | `10` | Upper bound for latent values |

### Gatekeeper Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `gatekeeper` | Boolean | `true` | Enable/disable gatekeeper mechanism |
| `temperature` | Number | `2.0` | Temperature parameter for acceptance |
| `stuck_patience` | Number | `1000` | Trials before forcing chain switch |
| `min_proposal_distance` | Number | `2.0` | Minimum Euclidean distance between proposals |

### Attention Check Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `attention_check` | Boolean | `true` | Enable attention checks |
| `attention_check_rate` | Number | `0.005` | Probability of attention check per trial |
| `attention_check_dir` | String | `'stimuli/attention_check'` | Directory containing attention check stimuli |

---

## API Endpoints

### `POST /api/blockwiseMCMCP/set_up`
Initialize participant chains and return experiment configuration.

**Request:**
```javascript
{
    "names": "participant_id"
}
```

**Response:**
```javascript
{
    "classes": ["happy", "sad", "surprise", ...],
    "class_questions": ["who looks happier?", ...],
    "n_rest": 200
}
```

### `GET /api/blockwiseMCMCP/get_choices`
Get stimuli for the next trial.

**Headers:**
- `ID`: Participant identifier

**Response (Likelihood Trial):**
```javascript
{
    "trial_type": "likelihood",
    "current_class": "happy",
    "current_chain": 3,
    "current_position": [1.2, -0.5, ...],
    "proposal_position": [1.8, -0.2, ...],
    "current": "data:image/png;base64,...",
    "proposal": "data:image/png;base64,..."
}
```

**Response (Prior Trial):**
```javascript
{
    "trial_type": "prior",
    "stimulus_position": [1.5, -0.3, ...],
    "current_stimulus": "data:image/png;base64,...",
    "current_chain": 2,
    "current": "happy",
    "proposal": "sad"
}
```

### `POST /api/blockwiseMCMCP/register_choices`
Register participant response and update chain state.

**Headers:**
- `ID`: Participant identifier
- `name`: Participant name
- `n_trial`: Current trial number
- `trial_type`: Type of trial ("likelihood" or "prior")
- `current_class`: Current emotion category (for likelihood trials)

**Request:**
```javascript
{
    "choice": "selected_stimulus_or_category"
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

### Participant Chain Tables

Each participant gets multiple tables (one per chain):
- Table name: `{participant_id}_blockwise_no{chain_number}`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing ID |
| `stimulus` | JSON NOT NULL | Latent vector representation |
| `category` | TEXT NOT NULL | Emotion category |
| `for_prior` | BOOLEAN | Whether this is for a prior trial |
| `gatekeeper` | BOOLEAN | Whether gatekeeper was used |

### Extended Participants Table

Additional columns added to track per-category statistics:

| Column | Type | Description |
|--------|------|-------------|
| `happy_ss` | INTEGER | Count of happy category trials |
| `sad_ss` | INTEGER | Count of sad category trials |
| `surprise_ss` | INTEGER | Count of surprise category trials |
| ... | ... | ... (for each emotion category) |

---

## Best Practices

### 1. Error Handling and Fallbacks

Always provide fallbacks for external services:

```javascript
// Use _retryAsync for unreliable operations
const images = await this._retryAsync(this.stimuli_processing_batch, [stimuli_list], this);

// Provide noise image fallback if generation fails
if (!response.image) {
    resolve({
        image: this._noise_image(),
        posterior: this.classes[Math.floor(Math.random() * this.n_class)]
    });
}
```

### 2. Chain State Management

Keep track of chain states to prevent infinite loops:

```javascript
// Initialize stuck counters
this.stuck_count[table_name] = 0;

// Monitor and handle stuck chains
if (this.stuck_count[table_name] > this.stuck_patience) {
    // Force switch to different category
    this.stuck_count[table_name] = 0;
    current_class = this._random_choice(available_classes);
}
```

### 3. Quality Control

Implement multiple quality control mechanisms:

```javascript
// Minimum distance constraint
const distance = this._euclideanDistance(current_state, proposal);
if (distance <= this.min_proposal_distance) {
    // Handle too-close proposals
}

// Attention checks
const attention_check_trial = Math.random() < this.attention_check_rate;
if (attention_check_trial && this.attention_check) {
    // Present attention check stimuli
}
```

### 4. Modular Configuration

Keep all configuration parameters easily accessible:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // Group related parameters
    this.setupCoreParameters();
    this.setupGatekeeperParameters();
    this.setupAttentionCheckParameters();
}

setupCoreParameters() {
    this.n_chain = 7;
    this.max_trial = 10;
    this.dim = 16;
    // ... other core parameters
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create sophisticated behavioral experiments with complex sampling mechanisms, quality control, and dynamic stimulus generation. The modular design allows for easy customization while maintaining robust data collection and error handling.