---
name: api-app-testing
category: testing
description: Comprehensive testing workflow for API endpoints with integration, error handling, and documentation validation
usage: Use when implementing or updating API routes to ensure complete test coverage and proper error handling
input: API route file path, service layer, Drizzle models, Zod schemas
output: Integration test files, coverage reports, test documentation
---

# API Application Testing

## Overview

**Purpose**: Systematic testing approach for API endpoints ensuring functionality, error handling, validation, and documentation accuracy

**Category**: Testing
**Primary Users**: qa-engineer, hono-engineer, tech-lead

## When to Use This Skill

- After implementing new API routes
- When modifying existing API endpoints
- Before deploying API changes to production
- As part of `/quality-check` validation
- When debugging API issues

## Prerequisites

**Required:**

- API routes implemented with Hono
- Service layer methods available
- Drizzle models and schemas defined
- Zod validation schemas present
- Vitest configured

**Optional:**

- OpenAPI documentation
- Existing test utilities
- Mock data generators

## Input

**What the skill needs:**

- API route file path (e.g., `apps/api/routes/bookings.ts`)
- Service layer module
- Database models involved
- Zod schemas for validation
- Expected endpoints and methods

## Workflow

### Step 1: Test Planning & Setup

**Objective**: Identify all API endpoints and prepare test structure

**Actions:**

1. List all endpoints in the route file
2. Identify HTTP methods (GET, POST, PUT, PATCH, DELETE)
3. Review Zod schemas for request/response validation
4. Prepare test data fixtures
5. Set up test database (or mocks)

**Validation:**

- [ ] All endpoints documented
- [ ] Test data covers happy path and edge cases
- [ ] Mock services configured if needed
- [ ] Database seeded with test data

**Output**: Test plan with endpoint list, test scenarios, and test data

### Step 2: Happy Path Testing

**Objective**: Test successful scenarios for all endpoints

**Actions:**

1. **GET endpoints**:
   - Test fetching single resource
   - Test fetching collection with pagination
   - Test filtering and sorting
   - Verify response schema matches Zod

2. **POST endpoints**:
   - Test creating resource with valid data
   - Verify response includes created resource
   - Confirm database record created
   - Test idempotency if applicable

3. **PUT/PATCH endpoints**:
   - Test updating resource
   - Verify partial updates (PATCH)
   - Confirm database update
   - Test optimistic locking if used

4. **DELETE endpoints**:
   - Test soft delete (if applicable)
   - Test hard delete
   - Verify cascade deletions
   - Confirm 404 on re-fetch

**Validation:**

- [ ] All successful responses have correct status codes
- [ ] Response bodies match Zod schemas
- [ ] Database state reflects changes
- [ ] No console errors or warnings

**Output**: Happy path test suite with 100% success

### Step 3: Error Handling Testing

**Objective**: Test all error scenarios and edge cases

**Actions:**

1. **Validation Errors**:
   - Test missing required fields
   - Test invalid field types
   - Test out-of-range values
   - Test malformed data

2. **Authentication Errors**:
   - Test unauthenticated requests (if protected)
   - Test expired tokens
   - Test invalid credentials

3. **Authorization Errors**:
   - Test insufficient permissions
   - Test accessing other users' resources
   - Test role-based access control

4. **Not Found Errors**:
   - Test non-existent resource IDs
   - Test deleted resources
   - Test malformed IDs

5. **Conflict Errors**:
   - Test duplicate creation (unique constraints)
   - Test concurrent modification
   - Test business logic violations

6. **Server Errors**:
   - Test database connection failures (mocked)
   - Test third-party service failures
   - Test unexpected errors

**Validation:**

- [ ] All error responses have correct status codes
- [ ] Error messages are descriptive and safe
- [ ] No sensitive data leaked in errors
- [ ] Errors follow consistent format

**Output**: Complete error handling test suite

### Step 4: Request/Response Validation

**Objective**: Ensure Zod schemas are properly enforced

**Actions:**

1. Test request body validation
2. Test query parameter validation
3. Test path parameter validation
4. Test response body matches schema
5. Verify content-type headers
6. Test request size limits

**Validation:**

- [ ] Invalid requests rejected with 400
- [ ] Validation errors are descriptive
- [ ] All fields validated
- [ ] Response schemas enforced

**Output**: Validation test suite

### Step 5: Integration Testing

**Objective**: Test full request-response cycle with database

**Actions:**

1. Test database transactions
2. Test cascade operations
3. Test relationship loading
4. Test search and filtering
5. Test pagination
6. Test sorting

**Validation:**

- [ ] Database state correct after operations
- [ ] Transactions rolled back on errors
- [ ] Relationships loaded correctly
- [ ] Performance acceptable (< 200ms)

**Output**: Integration test suite

### Step 6: Documentation Validation

**Objective**: Ensure API documentation matches implementation

**Actions:**

1. Compare OpenAPI spec with actual routes
2. Verify request/response examples
3. Test documented endpoints exist
4. Validate status codes documented
5. Check authentication documented

**Validation:**

- [ ] All endpoints documented
- [ ] Schemas match implementation
- [ ] Examples are accurate
- [ ] Authentication requirements clear

**Output**: Documentation validation report

### Step 7: Coverage Analysis

**Objective**: Ensure comprehensive test coverage

**Actions:**

1. Run tests with coverage: `pnpm test:coverage`
2. Review coverage report
3. Identify untested code paths
4. Add tests for uncovered lines
5. Aim for 90%+ coverage

**Validation:**

- [ ] Coverage >= 90%
- [ ] All endpoints tested
- [ ] All error paths tested
- [ ] Edge cases covered

**Output**: Coverage report with >= 90%

## Output

**Produces:**

- Integration test files in `apps/api/test/routes/`
- Test coverage reports
- Documentation validation results
- Test data fixtures

**Success Criteria:**

- All tests passing
- Coverage >= 90%
- No console warnings
- Documentation matches implementation
- Error handling comprehensive

## Test File Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../../src/index';
import { testDb } from '../../helpers/test-db';
import { createTestUser } from '../../helpers/test-data';

describe('/api/bookings', () => {
  beforeAll(async () => {
    await testDb.seed();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('GET /api/bookings', () => {
    it('should return paginated bookings', async () => {
      const response = await app.request('/api/bookings?page=1&limit=10');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBeLessThanOrEqual(10);
    });

    it('should filter bookings by status', async () => {
      const response = await app.request('/api/bookings?status=confirmed');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.items.every(b => b.status === 'confirmed')).toBe(true);
    });
  });

  describe('POST /api/bookings', () => {
    it('should create booking with valid data', async () => {
      const booking = {
        userId: 'test-user-id',
        accommodationId: 'test-acc-id',
        checkIn: '2024-02-01',
        checkOut: '2024-02-05',
        guests: 2
      };

      const response = await app.request('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty('id');
      expect(data.userId).toBe(booking.userId);
    });

    it('should reject booking with invalid dates', async () => {
      const booking = {
        userId: 'test-user-id',
        accommodationId: 'test-acc-id',
        checkIn: '2024-02-05',
        checkOut: '2024-02-01', // Invalid: checkout before checkin
        guests: 2
      };

      const response = await app.request('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should delete booking', async () => {
      const bookingId = 'test-booking-id';
      const response = await app.request(`/api/bookings/${bookingId}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await app.request(`/api/bookings/${bookingId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await app.request('/api/bookings/non-existent-id', {
        method: 'DELETE'
      });

      expect(response.status).toBe(404);
    });
  });
});
```

## Error Handling

### Error: Tests Failing Intermittently

**Cause**: Race conditions, shared test data, or database state issues
**Resolution**:

- Use `beforeEach` for test isolation
- Clear database between tests
- Use unique test data per test
- Avoid parallel test execution if database conflicts

### Error: Low Coverage Despite Tests

**Cause**: Not testing all code paths, especially error paths
**Resolution**:

- Review coverage report for untested lines
- Add tests for error scenarios
- Test edge cases and boundary conditions
- Mock external dependencies to test failures

### Error: Slow Tests

**Cause**: Real database operations, no connection pooling
**Resolution**:

- Use in-memory database for tests
- Use transactions with rollback
- Mock external services
- Parallelize independent tests

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **AAA Pattern**: Arrange, Act, Assert
3. **Descriptive Names**: Test names explain what's being tested
4. **One Assertion Focus**: Each test focuses on one behavior
5. **Mock External Deps**: Don't test third-party services
6. **Test Data Builders**: Use factories for test data
7. **Database Transactions**: Rollback after each test
8. **Coverage Goals**: Aim for 90%+ line coverage
9. **Test Pyramid**: More unit tests, fewer integration tests
10. **Documentation**: Tests serve as documentation

## Related Skills

- `web-app-testing` - Frontend E2E testing
- `performance-testing` - API performance testing
- `security-testing` - API security testing
- `tdd-methodology` - Test-Driven Development approach

## Notes

- Always test error scenarios, not just happy paths
- Use realistic test data that matches production
- Keep tests fast (< 5s total) for quick feedback
- Update tests when changing API contracts
- Tests are living documentation of API behavior
- Consider contract testing for API consumers

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
