# API Reference

The AIOM Controller class provides a comprehensive set of methods for building behavioral experiments. All custom task controllers inherit from this base class.

## Table of Contents

- [Getting Started](#getting-started)
- [Core Methods](#core-methods)
- [Data Processing](#data-processing)
- [Image & File Utilities](#image--file-utilities)
- [Mathematical Utilities](#mathematical-utilities)
- [Database Operations](#database-operations)

---

## Getting Started

### Basic Controller Setup

```javascript
const { Controller } = require('aiom');

class MyTaskController extends Controller {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this._initialize();
    }
    
    _initialize() {
        // Setup your task-specific database tables
        this._DB_create_table('my_task_data', [
            { name: 'participant', type: 'TEXT' },
            { name: 'response', type: 'TEXT' },
            { name: 'reaction_time', type: 'INTEGER' }
        ]);
    }
    
    // API endpoints (automatically exposed as /api/task_name/method_name)
    get_stimuli(req, res, next) {
        // GET /api/my_task/get_stimuli
        try {
            const stimuli = this._grab_image('./stimuli/image1.png');
            res.json({ stimuli });
        } catch (error) {
            next(error);
        }
    }
    
    post_response(req, res, next) {
        // POST /api/my_task/post_response
        const { participant, response, rt } = req.body;
        try {
            this._DB_add_row('my_task_data', {
                participant,
                response,
                reaction_time: rt
            });
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}
```

---

## Core Methods

### `set_up(req, res, next)`
Default setup method for initializing tasks. Automatically exposed as `POST /api/{task}/set_up`.

```javascript
set_up(req, res, next) {
    const name = req.body.names;
    res.json({ pid: name });
}
```

### `_initialize()`
Override this method to set up your task-specific configurations and database tables.

```javascript
_initialize() {
    // Create your database tables here
    this._DB_create_table('responses', [
        { name: 'participant', type: 'TEXT' },
        { name: 'data', type: 'JSONB' }
    ]);
}
```

### `_retryAsync(fn, args, context)`
Retry an async function up to 3 times with 500ms delays between attempts.

```javascript
const result = await this._retryAsync(this.someAsyncFunction, [param1, param2]);
```

---

## Data Processing

### Array Utilities

#### `_raw(array)`
Returns the array as-is (useful for consistent data processing pipelines).

```javascript
const data = this._raw([1, 2, 3, 4]); // Returns [1, 2, 3, 4]
```

#### `_shuffle(array)`
Randomly shuffles array elements.

```javascript
const shuffled = this._shuffle([1, 2, 3, 4]); // e.g., [3, 1, 4, 2]
```

#### `_random_choice(array)`
Returns a random element from the array.

```javascript
const choice = this._random_choice(['A', 'B', 'C']); // e.g., 'B'
```

### Statistical Functions

#### `_uniform_array(length, min=0, max=1)`
Generates array of random numbers between min and max.

```javascript
const random_nums = this._uniform_array(5, 0, 10); // e.g., [3.42, 7.89, 1.23, 9.45, 5.67]
```

#### `_uniform_array_ranges(dim, ranges)`
Generates array with different ranges for each dimension.

```javascript
const ranges = [[0, 5], [10, 20], [-1, 1]];
const values = this._uniform_array_ranges(3, ranges); // e.g., [2.1, 15.7, -0.3]
```

#### `_euclideanDistance(a, b)`
Calculates Euclidean distance between two arrays.

```javascript
const distance = this._euclideanDistance([1, 2], [4, 6]); // 5
```

#### `_calculateMean(arrays)`
Calculates element-wise mean across multiple arrays.

```javascript
const mean = this._calculateMean([[1, 2], [3, 4], [5, 6]]); // [3, 4]
```

#### `_sampleFromDistribution(probabilities)`
Sample index based on probability distribution.

```javascript
const index = this._sampleFromDistribution([0.2, 0.5, 0.3]); // 0, 1, or 2
```

---

## Image & File Utilities

### File Operations

#### `_grab_image(path)`
Loads image file and returns base64 data URI.

```javascript
const imageData = this._grab_image('./stimuli/face1.jpg');
// Returns: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
```

#### `_grab_text(path)`
Reads text file content.

```javascript
const instructions = this._grab_text('./instructions.txt');
```

#### `_txt2list(path)`
Reads text file and converts to array (one line per element).

```javascript
// words.txt contains:
// apple
// banana
// cherry

const words = this._txt2list('./words.txt'); // ['apple', 'banana', 'cherry']
```

### Image Generation

#### `_noise_image(width=64, height=64)`
Generates random noise image as base64 data URI.

```javascript
const noiseImg = this._noise_image(100, 100); // 100x100 noise image
```

#### `_latent2image_batch(vectors)`
Converts latent vectors to images using external generation service.

```javascript
const vectors = [[0.1, 0.5, -0.2], [0.8, -0.3, 0.7]];
const images = await this._latent2image_batch(vectors);
// Returns array of base64 image data URIs
```

---

## Mathematical Utilities

### Array Manipulation

#### `_limit_array_in_range(array, min, max)`
Constrains array values within specified range using wrapping.

```javascript
const constrained = this._limit_array_in_range([15, -5, 8], 0, 10);
// Handles out-of-bounds values by wrapping
```

#### `_createShiftedArray(length, start)`
Creates array with shifted indices.

```javascript
const shifted = this._createShiftedArray(5, 2); // [2, 3, 4, 0, 1]
```

---

## Database Operations

### Table Management

#### `_DB_create_table(tableName, columns)`
Creates a new database table.

```javascript
await this._DB_create_table('experiment_data', [
    { name: 'id', type: 'SERIAL PRIMARY KEY' },
    { name: 'participant', type: 'TEXT NOT NULL' },
    { name: 'trial_number', type: 'INTEGER' },
    { name: 'response_data', type: 'JSONB' },
    { name: 'timestamp', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
]);
```

#### `_DB_add_column(tableName, columnName, columnType)`
Adds a single column to existing table.

```javascript
await this._DB_add_column('experiment_data', 'reaction_time', 'INTEGER');
```

#### `_DB_add_columns(tableName, columns)`
Adds multiple columns to existing table.

```javascript
await this._DB_add_columns('experiment_data', [
    { name: 'accuracy', type: 'BOOLEAN' },
    { name: 'condition', type: 'TEXT' }
]);
```

### Data Operations

#### `_DB_add_row(tableName, row, options)`
Inserts a single row with optional conflict handling.

```javascript
// Basic insert
await this._DB_add_row('responses', {
    participant: 'P001',
    response: 'correct',
    trial: 1
});

// With conflict resolution
await this._DB_add_row('participants', {
    id: 'P001',
    condition: 'A'
}, {
    onConflict: {
        columns: 'id',
        action: 'update' // or 'nothing'
    }
});
```

#### `_DB_add_rows(tableName, rows)`
Inserts multiple rows in a single transaction.

```javascript
const responses = [
    { participant: 'P001', trial: 1, response: 'A' },
    { participant: 'P001', trial: 2, response: 'B' },
    { participant: 'P001', trial: 3, response: 'A' }
];
await this._DB_add_rows('trial_data', responses);
```

### Data Retrieval

#### `_DB_get_row(tableName, selectors, columns)`
Retrieves rows matching criteria.

```javascript
// Get all columns
const result = await this._DB_get_row('responses', { participant: 'P001' });

// Get specific columns
const result = await this._DB_get_row('responses', 
    { participant: 'P001', trial: 5 }, 
    'response, reaction_time'
);
```

#### `_DB_get_latest_row(tableName, columns)` / `_DB_get_first_row(tableName, columns)`
Get the most recent or first row.

```javascript
const latest = await this._DB_get_latest_row('responses', 'response, timestamp');
const first = await this._DB_get_first_row('responses');
```

### Data Updates

#### `_DB_update_row(tableName, values, selectors)`
Updates specific rows.

```javascript
await this._DB_update_row('participants', 
    { completion_status: 'finished', bonus: 2.50 },
    { participant: 'P001' }
);
```

#### `_DB_update_row_plusone(tableName, column, selectors)`
Increments a numeric column by 1.

```javascript
// Increment error count for participant
await this._DB_update_row_plusone('participants', 'error_count', 
    { participant: 'P001' }
);
```

#### `_DB_update_last_row(tableName, values)`
Updates the most recently inserted row.

```javascript
await this._DB_update_last_row('trial_data', {
    accuracy: true,
    completion_time: Date.now()
});
```

---

## Best Practices

### 1. Method Naming Convention
- **Public methods** (API endpoints): Use descriptive names like `get_stimuli`, `post_response`
- **Private methods**: Start with underscore `_helper_function`

### 2. Error Handling
Always use try-catch blocks in API methods:

```javascript
get_data(req, res, next) {
    try {
        const data = this._process_data();
        res.json({ data });
    } catch (error) {
        next(error); // Let middleware handle the error
    }
}
```

### 3. Database Best Practices
- Create tables in `_initialize()`
- Use parameterized queries (handled automatically by helper methods)
- Handle conflicts explicitly with `onConflict` options
- Use transactions for related operations by calling `_DB_add_rows()`

### 4. Async Operations
Use `_retryAsync()` for unreliable external services:

```javascript
const images = await this._retryAsync(this._latent2image_batch, [vectors], this);
```

---

## Example: Complete Task Implementation

```javascript
class CategorizationController extends Controller {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this._initialize();
    }
    
    _initialize() {
        this._DB_create_table('categorization_data', [
            { name: 'participant', type: 'TEXT' },
            { name: 'trial', type: 'INTEGER' },
            { name: 'stimulus', type: 'TEXT' },
            { name: 'response', type: 'TEXT' },
            { name: 'reaction_time', type: 'INTEGER' },
            { name: 'correct', type: 'BOOLEAN' }
        ]);
    }
    
    get_trial_data(req, res, next) {
        try {
            const trial = parseInt(req.query.trial) || 1;
            const stimuli = this._txt2list('./stimuli/words.txt');
            const stimulus = this._random_choice(stimuli);
            
            res.json({
                trial,
                stimulus,
                options: ['Category A', 'Category B']
            });
        } catch (error) {
            next(error);
        }
    }
    
    post_response(req, res, next) {
        try {
            const { participant, trial, stimulus, response, reaction_time } = req.body;
            const correct = this._determine_correctness(stimulus, response);
            
            this._DB_add_row('categorization_data', {
                participant,
                trial,
                stimulus,
                response,
                reaction_time,
                correct
            });
            
            res.json({ success: true, correct });
        } catch (error) {
            next(error);
        }
    }
    
    _determine_correctness(stimulus, response) {
        // Your logic here
        return stimulus.startsWith('a') && response === 'Category A';
    }
}

module.exports = { Controller: CategorizationController };
```