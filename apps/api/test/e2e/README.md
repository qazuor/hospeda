# E2E Testing Infrastructure

## Overview

Complete E2E testing infrastructure for Hospeda API, focusing on subscription flow scenarios.

## Setup

### Prerequisites

- PostgreSQL test database running
- Environment variables configured in `.env.test`

### Database Setup

#### Option 1: Local PostgreSQL

```bash
createdb hospeda_test
```

#### Option 2: Docker

```bash
docker run -d \
  --name hospeda_test_db \
  -e POSTGRES_DB=hospeda_test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5433:5432 \
  postgres:16
```

#### Option 3: Neon Test Database

Use a Neon branch for testing - set `TEST_DB_URL` in `.env.test`.

## Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run E2E tests in watch mode
pnpm test:e2e:watch

# Run specific scenario
pnpm test:e2e -- scenario-1
```

## Infrastructure Components

### 1. Test Database Manager (`setup/test-database.ts`)

Manages test database connection with transaction-based isolation:

```typescript
import { testDb } from './setup/test-database';

// In beforeAll
await testDb.setup();

// In beforeEach
const tx = await testDb.beginTransaction();

// In afterEach
await testDb.rollbackTransaction(tx);

// In afterAll
await testDb.teardown();
```

### 2. Seed Helpers (`setup/seed-helpers.ts`)

Utilities for creating test data:

```typescript
import { createTestClient, createTestPlan, createTestSubscription } from './setup/seed-helpers';

// Create individual entities
const client = await createTestClient({ name: 'Test Client' });
const plan = await createTestPlan({ amount: 1000 });
const subscription = await createTestSubscription(client.id, plan.id);

// Complete flow setup
const { client, plan, subscription } = await setupSubscriptionFlow();

// Batch creation
const clients = await createTestClients(5);
const plans = await createTestPlans(3);
```

### 3. API Client (`helpers/api-client.ts`)

HTTP client with authentication and assertions:

```typescript
import { E2EApiClient } from './helpers/api-client';
import { createMockAdminActor } from '../helpers/auth';

const actor = createMockAdminActor();
const apiClient = new E2EApiClient(app, actor);

// Make requests
const response = await apiClient.post('/api/v1/subscriptions', data);
const data = await apiClient.expectSuccess(response, 201);

// Error assertions
await apiClient.expectError(response, 404);
await apiClient.expectValidationErrors(response);
```

### 4. Cleanup Utilities (`setup/cleanup.ts`)

Track and clean test data:

```typescript
import { CleanupTracker } from './setup/cleanup';

const tracker = new CleanupTracker();

// Track entities
tracker.track('subscriptions', subscription.id);
tracker.trackMany('clients', clientIds);

// Clean all tracked
await tracker.cleanAll();
```

## Test Scenarios

### ✅ Scenario 1: Complete Subscription Creation Flow

**File:** `flows/subscription/scenario-1-complete-flow.test.ts`

**Tests:**

1. Full subscription creation with client + plan
2. Rejection with invalid client ID
3. Rejection with invalid plan ID

**Status:** ✅ Implemented

### ✅ Scenario 2: Subscription Upgrade Flow

**File:** `flows/subscription/scenario-2-upgrade-flow.test.ts`

**Tests:**

1. Upgrade from basic to premium plan
2. Handle upgrade to same plan (idempotent)
3. Handle downgrade from premium to basic

**Status:** ✅ Implemented

### ✅ Scenario 3: Subscription Renewal Flow

**File:** `flows/subscription/scenario-3-renewal-flow.test.ts`

**Tests:**

1. Successfully renew subscription for next period
2. Handle renewal with time remaining (early renewal)
3. Maintain subscription status during renewal

**Status:** ✅ Implemented

### ✅ Scenario 4: Subscription Cancellation Flow

**File:** `flows/subscription/scenario-4-cancellation-flow.test.ts`

**Tests:**

1. Successfully cancel active subscription
2. Handle cancellation of already cancelled subscription (idempotent)
3. Allow deletion (soft delete) of cancelled subscription
4. Prevent/handle reactivation of cancelled subscription
5. Maintain client and plan references after cancellation

**Status:** ✅ Implemented

### ✅ Scenario 5: Failed Payment Handling

**File:** `flows/subscription/scenario-5-failed-payment.test.ts`

**Tests:**

1. Handle failed payment and update subscription to PAST_DUE
2. Handle multiple failed payment attempts
3. Recover subscription after successful payment following failure
4. Handle payment rejection reasons correctly
5. Prevent subscription reactivation without successful payment

**Status:** ✅ Implemented

## Test Structure Template

```typescript
import { afterAll, beforeAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { testDb } from '../../setup/test-database.js';
import { createTestClient, createTestPlan } from '../../setup/seed-helpers.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { initApp } from '../../../../src/app.js';

describe('E2E: Test Scenario', () => {
 let app: ReturnType<typeof initApp>;
 let apiClient: E2EApiClient;
 let transactionClient: any;

 beforeAll(async () => {
  await testDb.setup();
  app = initApp();
  const actor = createMockAdminActor();
  apiClient = new E2EApiClient(app, actor);
 });

 afterAll(async () => {
  await testDb.teardown();
 });

 beforeEach(async () => {
  transactionClient = await testDb.beginTransaction();
 });

 afterEach(async () => {
  await testDb.rollbackTransaction(transactionClient);
 });

 it('should do something', async () => {
  // ARRANGE
  const client = await createTestClient();
  const plan = await createTestPlan();

  // ACT
  const response = await apiClient.post('/api/v1/subscriptions', {
   clientId: client.id,
   pricingPlanId: plan.id
  });

  // ASSERT
  const subscription = await apiClient.expectSuccess(response, 201);
  expect(subscription.status).toBe('ACTIVE');
 });
});
```

## Environment Variables

See `.env.test` for required configuration:

- `TEST_DB_URL` or individual `TEST_DB_*` variables
- `NODE_ENV=test`
- `API_VALIDATION_AUTH_ENABLED=false`

## Best Practices

1. **Always use transactions** - Ensures test isolation
2. **Clean setup/teardown** - Use beforeAll/afterAll properly
3. **Descriptive test names** - Clearly state what is being tested
4. **AAA pattern** - Arrange, Act, Assert
5. **One assertion per concept** - Keep tests focused
6. **Use seed helpers** - Don't create data manually
7. **Verify both success and failure** - Test error cases too

## Troubleshooting

### Tests fail with "Database not initialized"

Ensure `testDb.setup()` is called in `beforeAll`.

### Tests fail with "Connection refused"

Check that PostgreSQL is running and `.env.test` has correct credentials.

### Tests hang indefinitely

Check for missing `await` keywords or unclosed database connections.

### Type errors

Run `pnpm typecheck` to identify TypeScript issues before running tests.

## Implementation Status

### ✅ Completed

1. **All 5 core scenarios implemented** (scenarios 1-5)
2. **Comprehensive test coverage** including:
   - Happy path scenarios
   - Edge cases (idempotent operations, error handling)
   - State transitions
   - Data validation

### 📝 Next Steps

1. **Database Setup** - Configure test database (see Setup section above)
   - Local PostgreSQL, Docker, or Neon branch
   - Set `TEST_DB_URL` in `.env.test`

2. **Run Tests** - Once database is configured:

   ```bash
   pnpm test:e2e
   ```

3. **Future Enhancements**:
   - Add invoice and payment verification to existing scenarios
   - Add more edge cases and error scenarios
   - Add performance assertions (< 30s total for all scenarios)
   - Document discovered issues
   - Create CI/CD integration guide

## Documentation

- **Architecture:** `/.claude/sessions/planning/P-001-business-model-system/E2E-TESTING-ARCHITECTURE.md`
- **API Docs:** `/apps/api/CLAUDE.md`
- **Database Docs:** `/packages/db/CLAUDE.md`
- **Schemas Docs:** `/packages/schemas/CLAUDE.md`
