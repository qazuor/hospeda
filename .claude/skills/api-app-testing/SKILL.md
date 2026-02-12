---
name: api-app-testing
description: API endpoint testing methodology. Use when writing tests for REST APIs, validating error handling, schema validation, and authentication.
---

# API Application Testing

## Purpose

Provide a systematic testing methodology for API endpoints ensuring complete coverage of functionality, error handling, schema validation, authentication, authorization, and integration behavior. This skill guides the creation of comprehensive API test suites from planning through coverage analysis.

## When to Use

- When implementing or updating API routes
- When adding new endpoints or HTTP methods
- When modifying request/response schemas
- When updating authentication or authorization logic
- When verifying API behavior before deployment

## Capabilities

- Test all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Validate request and response schemas
- Test error scenarios and edge cases
- Verify authentication and authorization enforcement
- Test database integration and data integrity
- Measure and enforce test coverage targets

## Process

### 1. Test Planning

**Actions:**

- List all endpoints and their HTTP methods
- Review validation schemas for request and response
- Prepare test data fixtures
- Configure the test database or mock layer

**Checklist:**

- [ ] All endpoints documented
- [ ] Test data covers happy paths and edge cases
- [ ] Database or mocks configured and seeded

### 2. Happy Path Testing

Test successful scenarios for every HTTP method:

**GET endpoints:**

- Fetch a single resource by ID
- Fetch a collection with pagination
- Filter and sort operations

**POST endpoints:**

- Create a resource with valid data
- Verify the database record was created
- Test idempotency if applicable

**PUT/PATCH endpoints:**

- Full and partial resource updates
- Confirm database reflects the changes

**DELETE endpoints:**

- Delete a resource successfully
- Verify cascade operations
- Confirm 404 on re-fetch

**Checklist:**

- [ ] Correct status codes (200, 201, 204)
- [ ] Response bodies match schemas
- [ ] Database state reflects changes

### 3. Error Handling Testing

**Validation Errors (400):**

- Missing required fields
- Invalid field types
- Out-of-range values

**Authentication Errors (401):**

- Unauthenticated requests
- Expired tokens
- Invalid credentials

**Authorization Errors (403):**

- Insufficient permissions
- Accessing another user's resources

**Not Found Errors (404):**

- Non-existent resource IDs
- Deleted resources

**Conflict Errors (409):**

- Duplicate creation attempts
- Business logic violations

**Server Errors (500):**

- Database failures (mocked)
- Third-party service failures (mocked)

**Checklist:**

- [ ] Correct error status codes returned
- [ ] Descriptive error messages provided
- [ ] No sensitive data leaked in errors
- [ ] Consistent error response format

### 4. Schema Validation Testing

- Request body validation rejects malformed data
- Query parameter validation rejects invalid values
- Path parameter validation rejects invalid formats
- Response bodies conform to documented schemas
- Content-Type headers are enforced
- Request size limits are respected

### 5. Integration Testing

Test the full request-response cycle:

- Database transactions commit and rollback correctly
- Cascade operations propagate as expected
- Relationship loading returns associated data
- Search and filtering return correct results
- Pagination returns correct pages and totals
- Sorting orders results correctly

### 6. Coverage Analysis

1. Run tests with coverage enabled
2. Review the coverage report
3. Identify untested code paths
4. Add tests for uncovered areas
5. Verify coverage meets the target threshold

## Test Structure Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/index';
import { testDb } from '../helpers/test-db';

describe('/api/resources', () => {
  beforeAll(async () => {
    await testDb.seed();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('GET /api/resources', () => {
    it('should return paginated resources', async () => {
      const response = await app.request('/api/resources?page=1&limit=10');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('items');
      expect(data.items).toBeInstanceOf(Array);
      expect(data).toHaveProperty('total');
    });
  });

  describe('POST /api/resources', () => {
    it('should create a resource with valid data', async () => {
      const resource = { name: 'Test Resource', value: 100 };

      const response = await app.request('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resource),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
    });

    it('should reject invalid data with 400', async () => {
      const response = await app.request('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/resources/:id', () => {
    it('should delete an existing resource', async () => {
      const response = await app.request('/api/resources/res-1', {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent resource', async () => {
      const response = await app.request('/api/resources/non-existent', {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
    });
  });
});
```

## Error Response Format

Ensure all errors follow a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "fields": {
      "name": "Name is required",
      "value": "Must be a positive number"
    }
  }
}
```

## Best Practices

1. **Test isolation** -- each test is independent and can run in any order
2. **AAA pattern** -- Arrange, Act, Assert for clarity
3. **Descriptive names** -- test names explain expected behavior
4. **Mock external dependencies** -- do not test third-party services
5. **Database transactions** -- rollback after tests to keep state clean
6. **Fast execution** -- keep total test suite time under 30 seconds
7. **Realistic data** -- use production-like test data
8. **Test both success and failure** -- every endpoint needs error path coverage
9. **Verify side effects** -- check database state, not just response codes
10. **Document edge cases** -- unusual inputs, boundary values, race conditions

## Output

When applying this skill, produce:

- Integration test files covering all endpoints
- Test data fixtures for reuse
- Coverage reports meeting the target threshold
- Documentation of tested scenarios and edge cases

## Success Criteria

- All tests passing
- Coverage meets the defined target (default 90%)
- No console warnings during test execution
- Error handling is comprehensive across all endpoints
