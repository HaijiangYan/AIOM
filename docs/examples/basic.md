# Basic Usage Examples

Simple examples to get you started with AIOM.

## Text Analysis

Analyze text for sentiment, entities, and other insights.

```javascript
const { AIOM } = require('aiom');

const aiom = new AIOM({
  apiKey: 'your-api-key'
});

async function analyzeText() {
  await aiom.initialize();
  
  const result = await aiom.process({
    type: 'text-analysis',
    data: 'I love this new AI tool!',
    options: {
      sentiment: true,
      entities: true,
      language: 'en'
    }
  });
  
  console.log('Sentiment:', result.sentiment);
  console.log('Entities:', result.entities);
}

analyzeText();
```

## Image Classification

Classify images using AI models.

```javascript
const fs = require('fs');

async function classifyImage() {
  const imageBuffer = fs.readFileSync('image.jpg');
  
  const result = await aiom.process({
    type: 'image-classification',
    data: imageBuffer,
    options: {
      model: 'resnet50',
      topK: 5
    }
  });
  
  console.log('Classifications:', result.predictions);
}
```

## Batch Processing

Process multiple items in a single request.

```javascript
async function batchProcess() {
  const texts = [
    'Great product!',
    'Not satisfied with the service.',
    'Amazing experience, highly recommended!'
  ];
  
  const results = await aiom.process({
    type: 'batch-text-analysis',
    data: texts,
    options: {
      sentiment: true,
      parallel: true
    }
  });
  
  results.forEach((result, index) => {
    console.log(`Text ${index + 1}: ${result.sentiment}`);
  });
}
```

## Error Handling

Handle errors gracefully in your applications.

```javascript
async function robustProcessing() {
  try {
    const result = await aiom.process({
      type: 'text-analysis',
      data: 'Sample text'
    });
    
    console.log('Success:', result);
  } catch (error) {
    if (error.code === 'QUOTA_EXCEEDED') {
      console.log('API quota exceeded, try again later');
    } else if (error.code === 'INVALID_INPUT') {
      console.log('Invalid input provided');
    } else {
      console.error('Unexpected error:', error.message);
    }
  }
}
```