# Quick Start Guide

This guide will help you create and deploy your first experiment with AIOM in just a few minutes.

## Prerequisites

- AIOM installed globally (`npm install -g aiom`)
- Basic knowledge of JavaScript (optional but helpful)
- A text editor or IDE

## Step 1: Create Your First Experiment

### Initialize a New Project

```bash
aiom init my-first-experiment
cd my-first-experiment
```

This creates the following project structure:
```
my-first-experiment/
├── aiom.config.js          # Project configuration
├── experiment/             # Experiment files
│   ├── index.html         # Main experiment page
│   ├── experiment.js      # Experiment logic
│   └── styles.css         # Custom styles
├── data/                  # Data storage
├── assets/               # Images, videos, audio
└── package.json          # Node.js project file
```

### Basic Experiment Structure

AIOM generates a simple reaction time experiment. Let's examine the key files:

**experiment/experiment.js:**
```javascript
const { ExperimentBuilder, Timeline } = require('aiom');

const experiment = new ExperimentBuilder()
  .setInfo({
    title: 'Simple Reaction Time',
    description: 'Press SPACE when you see a red circle',
    version: '1.0.0'
  })
  .setTimeline([
    {
      type: 'html-keyboard-response',
      stimulus: '<h2>Welcome to the experiment!</h2><p>Press SPACE to continue.</p>',
      choices: [' ']
    },
    {
      type: 'html-keyboard-response',
      stimulus: '<div class="red-circle"></div>',
      choices: [' '],
      data: { task: 'reaction-time' }
    },
    {
      type: 'html-keyboard-response',
      stimulus: '<h2>Thank you!</h2><p>The experiment is complete.</p>',
      choices: ['NO_KEYS'],
      trial_duration: 2000
    }
  ])
  .build();

module.exports = experiment;
```

## Step 2: Test Locally

Start the development server:

```bash
aiom serve
```

This starts a local server at `http://localhost:3000`. Open your browser and test the experiment.

### Development Features

- **Hot Reload**: Changes automatically refresh the browser
- **Debug Mode**: Console logging for troubleshooting
- **Data Preview**: View collected data in real-time

```bash
# Enable debug mode
aiom serve --debug

# Use custom port
aiom serve --port 8080

# Enable HTTPS for testing
aiom serve --ssl
```

## Step 3: Customize Your Experiment

### Add Instructions

Edit `experiment/experiment.js` to add detailed instructions:

```javascript
const instructions = {
  type: 'html-keyboard-response',
  stimulus: `
    <div class="instructions">
      <h2>Instructions</h2>
      <p>In this experiment, you will see a red circle appear on the screen.</p>
      <p>Your task is to press the <strong>SPACEBAR</strong> as quickly as possible when you see it.</p>
      <p>Press SPACE to begin the practice round.</p>
    </div>
  `,
  choices: [' ']
};
```

### Add Multiple Trials

Create repeated trials with randomization:

```javascript
const createTrials = () => {
  const delays = [500, 1000, 1500, 2000]; // Random delays
  return delays.map(delay => ({
    type: 'html-keyboard-response',
    stimulus: '<div class="fixation">+</div>',
    choices: ['NO_KEYS'],
    trial_duration: delay,
    data: { phase: 'fixation' }
  })).concat(delays.map((delay, index) => ({
    type: 'html-keyboard-response',
    stimulus: '<div class="red-circle"></div>',
    choices: [' '],
    data: { 
      task: 'reaction-time', 
      trial: index + 1,
      expected_delay: delay 
    }
  })));
};
```

### Add Custom CSS

Edit `experiment/styles.css`:

```css
body {
  font-family: 'Arial', sans-serif;
  background-color: #f0f0f0;
  margin: 0;
  padding: 20px;
}

.red-circle {
  width: 100px;
  height: 100px;
  background-color: #e74c3c;
  border-radius: 50%;
  margin: 50px auto;
  display: block;
}

.fixation {
  font-size: 48px;
  text-align: center;
  margin: 100px auto;
}

.instructions {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
```

## Step 4: Add Data Collection

Configure data collection in `aiom.config.js`:

```javascript
module.exports = {
  experiment: {
    title: "Reaction Time Experiment",
    version: "1.0.0",
    description: "Measuring simple reaction times"
  },
  data: {
    format: "csv",                    // csv, json, both
    includeMetadata: true,            // Browser info, timestamps
    backup: true,                     // Automatic backups
    realtime: true,                   // Live data streaming
    fields: [                         // Custom data fields
      'participant_id',
      'trial_type',
      'stimulus',
      'response',
      'rt',
      'timestamp'
    ]
  },
  participants: {
    requireId: true,                  // Require participant ID
    screening: false,                 // Enable screening questions
    consent: true                     // Require consent form
  }
};
```

## Step 5: Deploy Your Experiment

### Option 1: Deploy to Heroku (Recommended)

```bash
# Login to Heroku (first time only)
heroku login

# Deploy experiment
aiom deploy heroku
```

AIOM will:
1. Create a new Heroku app
2. Configure the database
3. Set up SSL certificates
4. Deploy your experiment
5. Provide the live URL

### Option 2: Deploy to Your Own Server

```bash
# Build for production
aiom build

# Upload to your server
aiom deploy custom --server your-server.com --user username
```

### Option 3: Deploy to GitHub Pages (Static Only)

```bash
aiom deploy github-pages
```

## Step 6: Monitor Your Experiment

### Real-time Dashboard

Access your experiment dashboard:

```bash
aiom dashboard
```

Or visit: `https://your-experiment-url.com/admin`

Dashboard features:
- **Live Participant Count**: See active participants
- **Data Preview**: Real-time data collection
- **Performance Metrics**: Response times, completion rates
- **System Status**: Server health, error logs

### Data Export

Export collected data:

```bash
# Export to CSV
aiom export csv

# Export to JSON
aiom export json

# Export to SPSS
aiom export spss

# Export with date range
aiom export csv --from 2025-01-01 --to 2025-01-31
```

## Common Experiment Types

### Survey/Questionnaire

```javascript
const survey = new ExperimentBuilder()
  .addPage({
    type: 'survey-html-form',
    html: `
      <p>Please answer the following questions:</p>
      <p>Age: <input type="number" name="age" min="18" max="100" required></p>
      <p>Gender: 
        <input type="radio" name="gender" value="male" required> Male
        <input type="radio" name="gender" value="female" required> Female
        <input type="radio" name="gender" value="other" required> Other
      </p>
    `
  });
```

### Image Rating Task

```javascript
const imageRating = {
  type: 'image-slider-response',
  stimulus: 'assets/images/image1.jpg',
  labels: ['Very Negative', 'Neutral', 'Very Positive'],
  min: 1,
  max: 7,
  start: 4,
  prompt: 'How do you feel about this image?'
};
```

### Stroop Task

```javascript
const stroopTrial = {
  type: 'html-keyboard-response',
  stimulus: '<p style="color: red;">BLUE</p>',
  choices: ['r', 'g', 'b'],
  data: { 
    word: 'BLUE', 
    color: 'red', 
    congruent: false 
  }
};
```

## Next Steps

Now that you have a working experiment:

1. **Explore Examples**: Check out [more complex examples](examples/advanced.md)
2. **Learn About Plugins**: Extend functionality with [custom plugins](api/plugins.md)
3. **Data Analysis**: Set up [analysis pipelines](guides/data-analysis.md)
4. **Participant Recruitment**: Connect with [recruitment platforms](guides/recruitment.md)
5. **Scale Your Research**: Learn about [advanced deployment](guides/deployment.md)

## Getting Help

- **Documentation**: [Complete API Reference](api/index.md)
- **Community**: [Discord Server](https://discord.gg/aiom)
- **Examples**: [GitHub Repository](https://github.com/HaijiangYan/AIOM/tree/main/examples)
- **Support**: [support@aiom.dev](mailto:support@aiom.dev)