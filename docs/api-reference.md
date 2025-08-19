# API Reference

Complete reference for all AIOM classes, methods, and utilities.

## Core Classes

### ExperimentBuilder

The main class for creating and configuring experiments.

```javascript
const { ExperimentBuilder } = require('aiom');
const experiment = new ExperimentBuilder();
```

#### Constructor

```javascript
new ExperimentBuilder(options?)
```

**Parameters:**
- `options` (Object, optional): Initial configuration options

#### Methods

##### setInfo(info)

Set experiment metadata.

```javascript
experiment.setInfo({
  title: 'My Experiment',
  description: 'A behavioral study',
  version: '1.0.0',
  author: 'Researcher Name'
});
```

##### setTimeline(timeline)

Define the experimental timeline.

```javascript
experiment.setTimeline([
  {
    type: 'html-keyboard-response',
    stimulus: '<p>Welcome!</p>',
    choices: [' ']
  }
]);
```

##### addBlock(name, block)

Add a named block to the experiment.

```javascript
experiment.addBlock('instructions', {
  type: 'html-keyboard-response',
  stimulus: '<p>Press SPACE to continue</p>',
  choices: [' ']
});
```

##### addPlugin(plugin)

Add a custom plugin.

```javascript
experiment.addPlugin({
  name: 'custom-logger',
  initialize: (context) => { /* init code */ },
  process: (data) => { /* process data */ }
});
```

##### build()

Build and return the complete experiment object.

```javascript
const builtExperiment = experiment.build();
```

### Timeline

Manage experimental sequences and randomization.

```javascript
const { Timeline } = require('aiom');
```

#### Static Methods

##### randomize(trials)

Randomize trial order.

```javascript
const randomized = Timeline.randomize(trials);
```

##### counterbalance(conditions)

Create counterbalanced conditions.

```javascript
const balanced = Timeline.counterbalance(['A', 'B', 'C']);
```

##### repeat(trial, n)

Repeat a trial n times.

```javascript
const repeated = Timeline.repeat(trial, 10);
```

### DataManager

Handle data collection, storage, and export.

```javascript
const { DataManager } = require('aiom');
```

#### Constructor

```javascript
new DataManager(options)
```

#### Methods

##### collect(data)

Collect experimental data.

```javascript
dataManager.collect({
  participant_id: 'P001',
  trial: 1,
  response: 'correct',
  rt: 543
});
```

##### export(format, options)

Export collected data.

```javascript
const csvData = await dataManager.export('csv');
const jsonData = await dataManager.export('json', {
  includeMetadata: true
});
```

##### backup()

Create data backup.

```javascript
await dataManager.backup();
```

### Deployment

Deploy experiments to various platforms.

```javascript
const { Deploy } = require('aiom');
```

#### Static Methods

##### toHeroku(experiment, options)

Deploy to Heroku.

```javascript
await Deploy.toHeroku(experiment, {
  appName: 'my-experiment',
  region: 'us',
  ssl: true
});
```

##### toAWS(experiment, options)

Deploy to Amazon Web Services.

```javascript
await Deploy.toAWS(experiment, {
  region: 'us-east-1',
  instanceType: 't2.micro'
});
```

##### toLocal(experiment, options)

Run locally for development.

```javascript
await Deploy.toLocal(experiment, {
  port: 3000,
  debug: true
});
```

## Trial Types

### html-keyboard-response

Display HTML content and collect keyboard responses.

```javascript
{
  type: 'html-keyboard-response',
  stimulus: '<p>Press Y for yes, N for no</p>',
  choices: ['y', 'n'],
  prompt: '<p>Make your choice</p>',
  trial_duration: 5000,
  response_ends_trial: true
}
```

**Parameters:**
- `stimulus` (string): HTML content to display
- `choices` (array): Valid response keys
- `prompt` (string, optional): Additional prompt text
- `trial_duration` (number, optional): Maximum trial duration in ms
- `response_ends_trial` (boolean): Whether response ends the trial

### image-keyboard-response

Display images and collect keyboard responses.

```javascript
{
  type: 'image-keyboard-response',
  stimulus: 'assets/images/face1.jpg',
  choices: ['f', 'j'],
  prompt: '<p>Press F for female, J for male</p>',
  stimulus_width: 400,
  stimulus_height: 300
}
```

### survey-html-form

Collect survey responses using HTML forms.

```javascript
{
  type: 'survey-html-form',
  html: `
    <p>Please provide your information:</p>
    <p>Name: <input type="text" name="name" required></p>
    <p>Age: <input type="number" name="age" min="18" required></p>
  `,
  autofocus: 'name'
}
```

### image-slider-response

Collect responses using a visual slider.

```javascript
{
  type: 'image-slider-response',
  stimulus: 'assets/images/painting.jpg',
  min: 1,
  max: 9,
  start: 5,
  step: 1,
  labels: ['Very Ugly', 'Neutral', 'Very Beautiful'],
  prompt: 'Rate the beauty of this painting'
}
```

## Plugins

### Built-in Plugins

#### Analytics Plugin

Track experiment usage and performance.

```javascript
experiment.addPlugin({
  name: 'analytics',
  options: {
    provider: 'google-analytics',
    trackingId: 'GA_TRACKING_ID',
    events: ['trial_start', 'trial_end', 'experiment_complete']
  }
});
```

#### Validation Plugin

Validate participant responses.

```javascript
experiment.addPlugin({
  name: 'validation',
  options: {
    rules: {
      rt_min: 100,        // Minimum reaction time
      rt_max: 5000,       // Maximum reaction time
      accuracy_min: 0.7   // Minimum accuracy
    }
  }
});
```

#### Attention Check Plugin

Add attention check trials.

```javascript
experiment.addPlugin({
  name: 'attention-checks',
  options: {
    frequency: 0.1,     // 10% of trials
    type: 'math',       // math, reading, visual
    threshold: 0.8      // Required accuracy
  }
});
```

### Custom Plugins

Create your own plugins:

```javascript
const customPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  
  initialize: function(experiment, options) {
    // Plugin initialization
    this.options = options;
    this.data = [];
  },
  
  onTrialStart: function(trial) {
    // Called before each trial
    console.log('Starting trial:', trial.type);
  },
  
  onTrialEnd: function(data) {
    // Called after each trial
    this.data.push(data);
  },
  
  onExperimentEnd: function() {
    // Called when experiment completes
    console.log('Experiment completed');
    return this.data;
  }
};

experiment.addPlugin(customPlugin);
```

## Configuration Options

### Experiment Configuration

```javascript
// aiom.config.js
module.exports = {
  experiment: {
    title: "My Experiment",
    version: "1.0.0",
    description: "A behavioral study",
    author: "Researcher Name",
    institution: "University Name",
    ethics: "IRB-2025-001"
  },
  
  server: {
    port: 3000,
    host: "localhost",
    ssl: false
  },
  
  data: {
    format: "csv",              // csv, json, both
    includeMetadata: true,      // Browser info, timestamps
    backup: true,               // Automatic backups
    encryption: true,           // Encrypt sensitive data
    retention: 365              // Days to retain data
  },
  
  participants: {
    requireId: true,            // Require participant ID
    allowReturning: false,      // Allow return visits
    screening: {
      enabled: true,
      questions: [
        {
          type: 'number',
          name: 'age',
          prompt: 'What is your age?',
          min: 18,
          max: 100,
          required: true
        }
      ]
    },
    consent: {
      enabled: true,
      template: 'default',      // default, custom
      required: true
    }
  },
  
  deployment: {
    platform: "heroku",         // heroku, aws, custom
    region: "us-east-1",
    ssl: true,
    domain: null                // Custom domain
  }
};
```

## Event System

AIOM uses an event-driven architecture:

```javascript
const experiment = new ExperimentBuilder();

// Listen to experiment events
experiment.on('start', () => {
  console.log('Experiment started');
});

experiment.on('trial:start', (trial) => {
  console.log('Trial started:', trial.type);
});

experiment.on('trial:end', (data) => {
  console.log('Trial completed:', data);
});

experiment.on('complete', (allData) => {
  console.log('Experiment completed');
});

experiment.on('error', (error) => {
  console.error('Experiment error:', error);
});
```

## Error Handling

```javascript
try {
  const experiment = new ExperimentBuilder()
    .setTimeline(timeline)
    .build();
    
  await Deploy.toHeroku(experiment);
} catch (error) {
  if (error.code === 'INVALID_TIMELINE') {
    console.error('Timeline configuration error:', error.message);
  } else if (error.code === 'DEPLOYMENT_FAILED') {
    console.error('Deployment failed:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Type Definitions

For TypeScript users, AIOM includes complete type definitions:

```typescript
import { ExperimentBuilder, Timeline, DataManager } from 'aiom';

interface TrialData {
  participant_id: string;
  trial_type: string;
  stimulus: string;
  response?: string;
  rt?: number;
  correct?: boolean;
  timestamp: Date;
}

const experiment: ExperimentBuilder = new ExperimentBuilder();
```