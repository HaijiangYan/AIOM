# API Reference

Complete reference for all AIOM classes, methods, and utilities.

## Core Classes

### AIOM

The main AIOM class for managing AI operations.

#### Constructor

```javascript
new AIOM(options)
```

**Parameters:**
- `options` (Object): Configuration options

**Example:**
```javascript
const aiom = new AIOM({
  apiKey: 'your-key',
  environment: 'production'
});
```

#### Methods

##### initialize()

Initialize the AIOM instance.

```javascript
await aiom.initialize()
```

**Returns:** `Promise<void>`

##### process(operation)

Process an AI operation.

```javascript
await aiom.process(operation)
```

**Parameters:**
- `operation` (Object): Operation configuration

**Returns:** `Promise<OperationResult>`

##### configure(options)

Update configuration at runtime.

```javascript
aiom.configure(options)
```

**Parameters:**
- `options` (Object): New configuration options

## Events

AIOM emits events for monitoring and debugging:

```javascript
aiom.on('operation:start', (operation) => {
  console.log('Operation started:', operation.id);
});

aiom.on('operation:complete', (result) => {
  console.log('Operation completed:', result);
});

aiom.on('error', (error) => {
  console.error('AIOM error:', error);
});
```

## Type Definitions

See individual API sections for detailed type information:

- [Core Classes](core.md) - Main AIOM classes
- [Operations](operations.md) - Operation types and methods
- [Utilities](utils.md) - Helper functions and utilities