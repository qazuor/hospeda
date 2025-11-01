# Tracking System

JSON-based tracking system for managing planning tasks, code comments, and their synchronization state with GitHub Issues.

## Features

- **JSON Persistence**: Simple, file-based storage with atomic operations
- **Type-Safe**: Full TypeScript support with Zod validation
- **Automatic Backups**: Creates `.bak` files before writes
- **Query Methods**: Efficient lookups by various criteria
- **Statistics**: Track counts by status, session, and type
- **Error Recovery**: Reset failed syncs for retry

## Core Types

```typescript
type TrackingRecord = {
  id: string;                      // Unique identifier
  type: 'planning-task' | 'code-comment';

  source: {
    sessionId?: string;            // Planning session (e.g., "P-003")
    taskId?: string;               // Task within session (e.g., "T-003-001")
    commentId?: string;            // Code comment ID
    filePath?: string;             // Source file path
    lineNumber?: number;           // Line number in file
  };

  github?: {
    issueNumber: number;
    issueUrl: string;
    createdAt: string;
    updatedAt: string;
  };

  status: 'pending' | 'synced' | 'updated' | 'failed';
  lastSyncedAt?: string;
  syncAttempts: number;
  lastError?: string;

  createdAt: string;
  modifiedAt: string;
};
```

## Usage

### Basic Operations

```typescript
import { TrackingManager } from '@repo/github-workflow';

const manager = new TrackingManager('.github-workflow/tracking.json');
await manager.load();

// Add record
const record = await manager.addRecord({
  type: 'planning-task',
  source: { sessionId: 'P-003', taskId: 'T-003-001' },
  status: 'pending',
  syncAttempts: 0
});

// Mark as synced
await manager.markAsSynced(
  record.id,
  42,
  'https://github.com/org/repo/issues/42'
);

// Save to disk (creates backup)
await manager.save();
```

### Query Methods

```typescript
// Find by ID
const record = await manager.findById('track-123');

// Find by task ID
const task = await manager.findByTaskId('T-003-001');

// Find by comment ID
const comment = await manager.findByCommentId('TODO-123');

// Find by GitHub issue number
const synced = await manager.findByIssueNumber(42);

// Get all records with specific status
const pending = await manager.getRecordsByStatus('pending');

// Get all records for a session
const sessionRecords = await manager.getRecordsBySession('P-003');
```

### Statistics

```typescript
const stats = await manager.getStatistics();

console.log(stats);
// {
//   total: 10,
//   byStatus: { pending: 3, synced: 5, updated: 1, failed: 1 },
//   byType: { 'planning-task': 7, 'code-comment': 3 },
//   bySession: { 'P-003': 5, 'P-004': 2 }
// }
```

### Error Handling

```typescript
// Mark as failed
await manager.markAsFailed(record.id, 'API rate limit exceeded');

// Reset failed records to pending for retry
const resetRecords = await manager.resetPending();
console.log(`Reset ${resetRecords.length} records`);
```

### Update Records

```typescript
const updated = await manager.updateRecord(record.id, {
  status: 'updated',
  syncAttempts: 3,
  lastError: undefined
});
```

### Delete Records

```typescript
const deleted = await manager.deleteRecord(record.id);
console.log(deleted); // true if deleted, false if not found
```

## File Structure

```
src/tracking/
├── types.ts              # Type definitions
├── validation.ts         # Zod schemas
├── file-operations.ts    # Low-level file I/O
├── tracking-manager.ts   # Main manager class
└── index.ts              # Barrel export
```

## Default Storage Location

- **File**: `.github-workflow/tracking.json`
- **Backup**: `.github-workflow/tracking.json.bak`

## Error Classes

```typescript
// File operation errors
class FileOperationError extends Error {
  operation: string;
  filePath: string;
  cause?: Error;
}

// Tracking operation errors
class TrackingError extends Error {
  code: string;
  details?: unknown;
}
```

## Best Practices

1. **Always load before operations**

   ```typescript
   await manager.load(); // Required before any operation
   ```

2. **Save after batch changes**

   ```typescript
   await manager.addRecord(/* ... */);
   await manager.addRecord(/* ... */);
   await manager.save(); // Single save for multiple changes
   ```

3. **Handle errors gracefully**

   ```typescript
   try {
     await manager.markAsSynced(id, issueNumber, url);
   } catch (error) {
     await manager.markAsFailed(id, error.message);
   }
   ```

4. **Use statistics for overview**

   ```typescript
   const stats = await manager.getStatistics();
   if (stats.byStatus.failed > 0) {
     // Handle failed syncs
   }
   ```

## Testing

Run tests with coverage:

```bash
pnpm test test/tracking/
pnpm test:coverage
```

Current coverage: **92.39% statements, 90.58% branches**

## Examples

See [examples/tracking-usage.ts](../../examples/tracking-usage.ts) for complete usage examples.
