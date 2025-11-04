# Cost Tracker

## Overview

The `CostTracker` utility monitors AI image generation usage and costs to prevent overspending on Replicate API calls.

## Features

- **Monthly Tracking**: Tracks mockup generation per calendar month (YYYY-MM format)
- **Automatic Reset**: Auto-resets count and cost on month change
- **Cost Calculation**: $0.003 per image (FLUX.1 schnell model)
- **Usage Alerts**: Warns at 80% threshold (40/50 mockups)
- **Graceful Degradation**: Failures don't block mockup generation

## Usage

### Basic Usage

```typescript
import { CostTracker } from '@repo/ai-image-generation';

const tracker = new CostTracker();
const sessionPath = '.claude/sessions/planning/P-005';

// Increment usage after generating mockup
const usage = await tracker.incrementUsage(sessionPath);
console.log(`Used ${usage.mockupCount} mockups this month ($${usage.totalCost.toFixed(3)})`);

// Check if threshold reached
const check = tracker.checkThreshold(usage);
if (check.shouldAlert) {
  console.warn(check.message);
}
```

### Integration with MockupGenerator

The `CostTracker` is automatically integrated into `MockupGenerator`:

```typescript
import { MockupGenerator } from '@repo/ai-image-generation';

const generator = new MockupGenerator({
  replicateApiToken: process.env.REPLICATE_API_TOKEN!,
  outputPath: '.claude/sessions/planning'
});

// Cost tracking happens automatically after generation
const result = await generator.generate({
  prompt: 'Login screen',
  filename: 'login.png',
  sessionPath: '.claude/sessions/planning/P-005'
});

// If threshold reached, warning is logged automatically
```

## Storage

Usage data is stored in `.usage-tracking.json` at the session root:

```json
{
  "currentMonth": "2025-11",
  "mockupCount": 12,
  "totalCost": 0.036,
  "lastReset": "2025-11-01T00:00:00.000Z"
}
```

## Thresholds

- **Monthly Limit**: 50 mockups
- **Alert Threshold**: 40 mockups (80%)
- **Cost per Image**: $0.003 (FLUX.1 schnell model)

## Methods

### `load(sessionPath: string): Promise<UsageData>`

Loads usage data from registry file. Creates new file if doesn't exist.

```typescript
const usage = await tracker.load(sessionPath);
console.log(`Current month: ${usage.currentMonth}`);
```

### `save(usageData: UsageData, sessionPath: string): Promise<void>`

Saves usage data to registry file.

```typescript
await tracker.save(usageData, sessionPath);
```

### `incrementUsage(sessionPath: string): Promise<UsageData>`

Increments mockup count and updates cost. Auto-resets if new month.

```typescript
const usage = await tracker.incrementUsage(sessionPath);
```

### `checkThreshold(usageData: UsageData): ThresholdResult`

Checks if usage threshold has been reached.

```typescript
const check = tracker.checkThreshold(usageData);
if (check.shouldAlert) {
  console.warn(check.message);
}
```

### `resetIfNewMonth(sessionPath: string): Promise<UsageData>`

Resets usage data if new month detected.

```typescript
const usage = await tracker.resetIfNewMonth(sessionPath);
```

## Error Handling

Cost tracking failures are handled gracefully:

- Errors are logged but don't throw exceptions
- Mockup generation continues even if tracking fails
- Returns default data on errors

```typescript
try {
  await tracker.incrementUsage('/invalid/path');
} catch (error) {
  // Won't throw - errors are logged internally
}
```

## Types

### UsageData

```typescript
interface UsageData {
  currentMonth: string;    // YYYY-MM format
  mockupCount: number;      // Number of mockups generated
  totalCost: number;        // Total cost in USD
  lastReset: string;        // ISO timestamp
}
```

### ThresholdResult

```typescript
interface ThresholdResult {
  shouldAlert: boolean;     // Whether alert should be shown
  message?: string;         // Alert message if threshold exceeded
}
```

## Example

See [examples/cost-tracker-usage.ts](../examples/cost-tracker-usage.ts) for a complete working example.

## Testing

The `CostTracker` has 97.93% test coverage with comprehensive tests for:

- File operations (load, save)
- Usage increment and cost calculation
- Threshold checking and alerts
- Month transitions and resets
- Error handling and edge cases

Run tests:

```bash
pnpm test test/utils/cost-tracker.test.ts
```

## Best Practices

1. **Always check threshold after incrementing**: Display warnings to users
2. **Don't block on failures**: Cost tracking should never stop mockup generation
3. **Reset at start of operations**: Call `resetIfNewMonth()` at the beginning of workflows
4. **Monitor usage regularly**: Check `.usage-tracking.json` periodically

## Cost Calculation

| Model | Cost per Image |
|-------|---------------|
| FLUX.1 schnell | $0.003 |
| FLUX.1 dev | $0.055 |
| FLUX.1 pro | $0.055 |

**Monthly estimate at 50 mockups**: $0.15 (schnell model)

## License

Part of the Hospeda AI Image Generation package.
