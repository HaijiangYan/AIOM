# Core Classes

## AIOM Class

The primary interface for AI operations management.

### Class Definition

```typescript
class AIOM extends EventEmitter {
  constructor(options: AiomOptions)
  initialize(): Promise<void>
  process(operation: Operation): Promise<OperationResult>
  configure(options: Partial<AiomOptions>): void
  destroy(): Promise<void>
}
```

### Properties

#### version

```javascript
aiom.version // "1.0.0"
```

Current AIOM version.

#### isInitialized

```javascript
aiom.isInitialized // boolean
```

Whether the instance has been initialized.

#### config

```javascript
aiom.config // AiomConfig
```

Current configuration object.

### Methods

#### initialize()

Initializes the AIOM instance with the provided configuration.

```javascript
const aiom = new AIOM({ apiKey: 'key' });
await aiom.initialize();
```

**Throws:**
- `InitializationError` - When initialization fails

#### process(operation)

Processes an AI operation with the specified parameters.

```javascript
const result = await aiom.process({
  type: 'text-analysis',
  data: 'Sample text',
  options: { language: 'en' }
});
```

**Parameters:**
- `operation.type` (string) - Operation type
- `operation.data` (any) - Input data
- `operation.options` (Object) - Operation-specific options

**Returns:** `Promise<OperationResult>`

**Throws:**
- `ValidationError` - Invalid operation parameters
- `ProcessingError` - Operation processing failed

## OperationManager Class

Manages individual operations and their lifecycle.

```typescript
class OperationManager {
  constructor(config: OperationConfig)
  execute(operation: Operation): Promise<OperationResult>
  cancel(operationId: string): void
  getStatus(operationId: string): OperationStatus
}
```

### Methods

#### execute(operation)

Executes a single operation.

#### cancel(operationId)

Cancels a running operation.

#### getStatus(operationId)

Gets the current status of an operation.