# Configuration

AIOM provides flexible configuration options to suit your needs.

## Configuration Methods

### Environment Variables

Set environment variables for global configuration:

```bash
export AIOM_API_KEY="your-api-key"
export AIOM_ENVIRONMENT="production"
export AIOM_LOG_LEVEL="info"
```

### Configuration File

Create `aiom.config.js` in your project root:

```javascript
module.exports = {
  apiKey: process.env.AIOM_API_KEY,
  environment: process.env.NODE_ENV || 'development',
  timeout: 30000,
  retries: 3,
  logLevel: 'info',
  endpoints: {
    primary: 'https://api.aiom.dev',
    fallback: 'https://backup-api.aiom.dev'
  },
  features: {
    analytics: true,
    caching: true,
    monitoring: false
  }
};
```

### Programmatic Configuration

```javascript
const aiom = new AIOM({
  apiKey: 'your-api-key',
  environment: 'production',
  timeout: 45000,
  retries: 5,
  logLevel: 'debug',
  customHeaders: {
    'User-Agent': 'MyApp/1.0.0'
  }
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Your AIOM API key |
| `environment` | string | 'development' | Environment mode |
| `timeout` | number | 30000 | Request timeout in ms |
| `retries` | number | 3 | Number of retry attempts |
| `logLevel` | string | 'info' | Logging level |
| `caching` | boolean | true | Enable response caching |

## Advanced Configuration

### Custom Plugins

```javascript
const aiom = new AIOM({
  plugins: [
    {
      name: 'custom-analytics',
      initialize: (context) => {
        // Plugin initialization
      },
      process: (data, context) => {
        // Custom processing logic
      }
    }
  ]
});
```

### Error Handling

```javascript
const aiom = new AIOM({
  errorHandling: {
    retryOn: ['NETWORK_ERROR', 'TIMEOUT'],
    fallbackStrategy: 'cache',
    onError: (error, context) => {
      console.error('AIOM Error:', error);
      // Custom error handling
    }
  }
});
```