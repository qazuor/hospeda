# Guide: Testing Seeds

Complete guide to testing seed scripts. Learn unit testing, integration testing, validation strategies, and CI/CD integration.

## Testing Approaches

### Unit Tests

Test individual seed functions in isolation.

### Integration Tests

Test complete seed flow with database.

### Validation Tests

Verify seed data integrity and relationships.

## Unit Testing

### Basic Seed Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { seedAmenities } from '../amenities.seed';
import { createSeedContext } from '../../utils/seedContext';
import { IdMapper } from '../../utils/idMapper';

describe('seedAmenities', () => {
  let context: SeedContext;

  beforeEach(() => {
    context = createSeedContext({
      continueOnError: false,
      idMapper: new IdMapper(true) // Don't load saved mappings
    });
  });

  it('should create ID mappings', async () => {
    await seedAmenities(context);

    expect(context.idMapper.hasMapping('amenities', 'amenity-wifi')).toBe(true);
    expect(context.idMapper.hasMapping('amenities', 'amenity-parking')).toBe(true);
  });

  it('should handle errors with continueOnError', async () => {
    context.continueOnError = true;
    await expect(seedAmenities(context)).resolves.not.toThrow();
  });
});
```

## Integration Testing

### Complete Seed Flow

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runSeed } from '../index';
import { db } from '@repo/db';
import { amenitiesTable, accommodationsTable } from '@repo/db/schemas';

describe('Seed Integration Tests', () => {
  beforeEach(async () => {
    // Clear database
    await db.delete(amenitiesTable);
    await db.delete(accommodationsTable);
  });

  afterEach(async () => {
    // Cleanup
    await db.delete(amenitiesTable);
    await db.delete(accommodationsTable);
  });

  it('should seed required data', async () => {
    await runSeed({ required: true });

    const amenities = await db.select().from(amenitiesTable);
    expect(amenities.length).toBeGreaterThan(0);

    const wifi = amenities.find(a => a.name === 'WiFi');
    expect(wifi).toBeDefined();
    expect(wifi?.type).toBe('CONNECTIVITY');
  });

  it('should handle relationships correctly', async () => {
    await runSeed({ required: true, example: true, reset: true });

    const accommodations = await db.query.accommodations.findMany({
      with: { amenities: true }
    });

    expect(accommodations.length).toBeGreaterThan(0);
    expect(accommodations[0].amenities.length).toBeGreaterThan(0);
  });
});
```

## See Full Documentation

For complete testing guide with all patterns and examples, see the online documentation or request the full version.

---

Last updated: 2024-11-05
