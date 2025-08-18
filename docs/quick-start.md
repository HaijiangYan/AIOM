# Quick Start

Get up and running with AIOM in just a few minutes.

## Prerequisites

- Node.js 16+ installed
- npm or yarn package manager

## Installation

```bash
npm install aiom
```

## Basic Setup

```javascript
const { AIOM } = require('aiom');

// Initialize with basic configuration
const aiom = new AIOM({
  apiKey: 'your-api-key',
  environment: 'development'
});
```

## Your First Operation

```javascript
async function runFirstOperation() {
  try {
    // Initialize the AIOM instance
    await aiom.initialize();
    
    // Process some data
    const result = await aiom.process({
      type: 'text-analysis',
      data: 'Hello, AIOM!',
      options: {
        language: 'en',
        sentiment: true
      }
    });
    
    console.log('Analysis result:', result);
  } catch (error) {
    console.error('Operation failed:', error);
  }
}

runFirstOperation();
```

## Next Steps

- Learn about [Configuration](configuration.md)
- Explore the [API Reference](api/index.md)
- Check out [Examples](examples/basic.md)