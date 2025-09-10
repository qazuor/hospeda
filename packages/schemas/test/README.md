# Schema Testing Suite

Comprehensive testing suite for all Zod schemas in the `@repo/schemas` package.

## 🎯 Overview

This testing suite validates:
- **Schema Correctness**: All schemas parse valid data correctly
- **Validation Logic**: Invalid data is properly rejected
- **Edge Cases**: Boundary conditions and special cases
- **Type Safety**: TypeScript type inference works correctly
- **Performance**: Schemas perform efficiently at scale
- **Consistency**: Cross-schema compatibility and consistency

## 📁 Structure

```
test/
├── setup.ts                    # Global test configuration
├── fixtures/                   # Mock data generators
│   ├── common.fixtures.ts      # Base field fixtures
│   ├── accommodation.fixtures.ts
│   ├── user.fixtures.ts
│   ├── destination.fixtures.ts
│   └── post.fixtures.ts
├── entities/                   # Entity-specific tests
│   ├── accommodation/
│   │   ├── accommodation.schema.test.ts
│   │   └── accommodation.operations.test.ts
│   └── user/
│       └── user.schema.test.ts
├── common/                     # Common schema tests
│   └── base-field-objects.test.ts
├── integration/                # Cross-schema tests
│   └── cross-schema.test.ts
└── run-all-tests.ts           # Test suite summary
```

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run specific test file
pnpm test accommodation.schema.test.ts

# Run with coverage
pnpm test:coverage
```

### Test Categories

```bash
# Run entity tests only
pnpm test entities/

# Run common schema tests
pnpm test common/

# Run integration tests
pnpm test integration/

# Run specific entity tests
pnpm test entities/accommodation/
```

## 🧪 Test Types

### 1. **Happy Path Tests**
Validate that correct data passes validation:
```typescript
it('should validate complete valid accommodation', () => {
    const validData = createValidAccommodation();
    expect(() => AccommodationSchema.parse(validData)).not.toThrow();
});
```

### 2. **Error Case Tests**
Ensure invalid data is rejected:
```typescript
it('should reject accommodation with invalid data', () => {
    const invalidData = createInvalidAccommodation();
    expect(() => AccommodationSchema.parse(invalidData)).toThrow(ZodError);
});
```

### 3. **Edge Case Tests**
Test boundary conditions:
```typescript
it('should handle edge case values', () => {
    const edgeCaseData = createAccommodationEdgeCases();
    // Test specific edge case behavior
});
```

### 4. **Field Validation Tests**
Test individual field constraints:
```typescript
describe('name field', () => {
    it('should accept valid names', () => {
        // Test various valid name formats
    });
    
    it('should reject invalid names', () => {
        // Test invalid name formats
    });
});
```

### 5. **Integration Tests**
Test cross-schema consistency:
```typescript
it('should have consistent ID field types across all schemas', () => {
    // Validate ID consistency across entities
});
```

## 📊 Fixtures

### Using Fixtures

Fixtures provide realistic mock data for testing:

```typescript
import { createValidAccommodation } from '../fixtures/accommodation.fixtures.js';

const accommodation = createValidAccommodation();
const result = AccommodationSchema.parse(accommodation);
```

### Available Fixtures

- `createValidAccommodation()` - Complete valid accommodation
- `createMinimalAccommodation()` - Minimal required fields
- `createInvalidAccommodation()` - Invalid data for error testing
- `createComplexAccommodation()` - Complex nested structures
- `createAccommodationEdgeCases()` - Edge case scenarios

### Common Fixtures

Base field fixtures for consistent testing:
- `createBaseIdFields()`
- `createBaseAuditFields()`
- `createBaseContactFields()`
- `createBaseLocationFields()`
- And more...

## 🎭 Custom Matchers

Custom Vitest matchers for schema testing:

```typescript
// Check if data passes schema validation
expect(data).toBeValidZodSchema(schema);

// Check if data fails schema validation
expect(invalidData).toFailZodValidation(schema);
```

## 📈 Coverage Goals

Target coverage metrics:
- **Line Coverage**: > 95%
- **Branch Coverage**: > 90%
- **Function Coverage**: 100%
- **Statement Coverage**: > 95%

## 🔧 Adding New Tests

### For New Entity Schemas

1. Create fixtures in `fixtures/entity.fixtures.ts`
2. Create test file in `entities/entity/entity.schema.test.ts`
3. Add operations tests in `entities/entity/entity.operations.test.ts`
4. Update integration tests if needed

### Test Template

```typescript
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EntitySchema } from '../../src/entities/entity/entity.schema.js';
import { createValidEntity, createInvalidEntity } from '../fixtures/entity.fixtures.js';

describe('EntitySchema', () => {
    describe('Valid Data', () => {
        it('should validate complete valid entity', () => {
            const validData = createValidEntity();
            expect(() => EntitySchema.parse(validData)).not.toThrow();
        });
    });

    describe('Invalid Data', () => {
        it('should reject entity with invalid data', () => {
            const invalidData = createInvalidEntity();
            expect(() => EntitySchema.parse(invalidData)).toThrow(ZodError);
        });
    });

    describe('Field Validations', () => {
        // Test individual fields
    });
});
```

## 🐛 Debugging Tests

### Common Issues

1. **Fixture Data Issues**
   - Ensure fixtures generate valid data
   - Check for required fields
   - Validate enum values

2. **Schema Import Issues**
   - Use `.js` extensions in imports
   - Check file paths
   - Ensure schemas are exported

3. **Type Issues**
   - Verify TypeScript types match Zod schemas
   - Check for type inference problems

### Debug Commands

```bash
# Run single test with verbose output
pnpm test --reporter=verbose accommodation.schema.test.ts

# Debug specific test
pnpm test --reporter=verbose --grep "should validate complete valid accommodation"
```

## 📝 Best Practices

1. **Comprehensive Coverage**: Test happy path, error cases, and edge cases
2. **Realistic Data**: Use faker.js for realistic test data
3. **Consistent Patterns**: Follow established test patterns
4. **Clear Descriptions**: Use descriptive test names
5. **Fast Tests**: Keep tests fast and focused
6. **Isolated Tests**: Each test should be independent

## 🚀 Performance Considerations

- Fixtures are generated fresh for each test (isolated)
- Large dataset tests verify performance at scale
- Coverage reports help identify untested code paths
- Watch mode for rapid development feedback
