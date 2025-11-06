# Unit Testing

## Overview

Unit tests verify **individual functions or methods** in complete isolation. They are the foundation of our testing strategy, comprising **70% of all tests**.

**Characteristics**:

- **Fast**: < 100ms per test
- **Focused**: One behavior per test
- **Isolated**: All dependencies mocked
- **Numerous**: Majority of test suite
- **Coverage**: 95%+ for business logic

## What to Unit Test

### Pure Functions

Functions without side effects are ideal for unit testing:

```typescript
// utils/slug.ts
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// test/utils/slug.test.ts
describe('generateSlug', () => {
  it('should convert to lowercase', () => {
    expect(generateSlug('Hotel Paradise')).toBe('hotel-paradise');
  });

  it('should replace spaces with hyphens', () => {
    expect(generateSlug('My Great Hotel')).toBe('my-great-hotel');
  });

  it('should remove special characters', () => {
    expect(generateSlug('Café "Le Bon"!')).toBe('cafe-le-bon');
  });

  it('should remove diacritics', () => {
    expect(generateSlug('Ñoño Café')).toBe('nono-cafe');
  });

  it('should trim leading hyphens', () => {
    expect(generateSlug('---Hotel')).toBe('hotel');
  });

  it('should trim trailing hyphens', () => {
    expect(generateSlug('Hotel---')).toBe('hotel');
  });

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should handle only special characters', () => {
    expect(generateSlug('!@#$%^&*()')).toBe('');
  });

  it('should collapse multiple hyphens', () => {
    expect(generateSlug('Hotel   Paradise')).toBe('hotel-paradise');
  });
});
```

### Business Logic

```typescript
// services/pricing.ts
export function calculateBookingPrice(input: {
  pricePerNight: number;
  nights: number;
  guests: number;
  discountRate?: number;
}): number {
  const { pricePerNight, nights, guests, discountRate = 0 } = input;

  // Base price
  const basePrice = pricePerNight * nights;

  // Guest surcharge (10% per guest above 2)
  const extraGuests = Math.max(0, guests - 2);
  const guestSurcharge = basePrice * (extraGuests * 0.1);

  // Calculate subtotal
  const subtotal = basePrice + guestSurcharge;

  // Apply discount
  const discount = subtotal * discountRate;

  return subtotal - discount;
}

// test/services/pricing.test.ts
describe('calculateBookingPrice', () => {
  describe('base price calculation', () => {
    it('should calculate price for 1 night', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 2
      });

      expect(price).toBe(100);
    });

    it('should calculate price for multiple nights', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 5,
        guests: 2
      });

      expect(price).toBe(500);
    });
  });

  describe('guest surcharge', () => {
    it('should not charge extra for 2 guests', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 2
      });

      expect(price).toBe(100);
    });

    it('should charge 10% per guest above 2', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 3 // 1 extra guest = 10% surcharge
      });

      expect(price).toBe(110);
    });

    it('should calculate correctly for 4 guests', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 4 // 2 extra guests = 20% surcharge
      });

      expect(price).toBe(120);
    });
  });

  describe('discount application', () => {
    it('should apply 10% discount', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 2,
        discountRate: 0.1
      });

      expect(price).toBe(90);
    });

    it('should apply discount after surcharge', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 3, // 110 with surcharge
        discountRate: 0.1 // 10% off 110
      });

      expect(price).toBe(99); // 110 - 11
    });

    it('should default to 0% discount', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 2
      });

      expect(price).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle 0 nights', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 0,
        guests: 2
      });

      expect(price).toBe(0);
    });

    it('should handle 1 guest (no surcharge)', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 1
      });

      expect(price).toBe(100);
    });

    it('should handle 100% discount', () => {
      const price = calculateBookingPrice({
        pricePerNight: 100,
        nights: 1,
        guests: 2,
        discountRate: 1
      });

      expect(price).toBe(0);
    });
  });
});
```

### Class Methods

```typescript
// models/accommodation/validator.ts
export class AccommodationValidator {
  validate(data: CreateAccommodationData): ValidationResult {
    const errors: string[] = [];

    // Name validation
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    } else if (data.name.length < 3) {
      errors.push('Name must be at least 3 characters');
    } else if (data.name.length > 255) {
      errors.push('Name must not exceed 255 characters');
    }

    // City validation
    if (!data.city || data.city.trim().length === 0) {
      errors.push('City is required');
    }

    // Price validation
    if (data.pricePerNight !== undefined) {
      if (data.pricePerNight <= 0) {
        errors.push('Price must be positive');
      }
      if (data.pricePerNight > 1000000) {
        errors.push('Price must not exceed 1,000,000');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// test/models/accommodation/validator.test.ts
describe('AccommodationValidator', () => {
  let validator: AccommodationValidator;

  beforeEach(() => {
    validator = new AccommodationValidator();
  });

  describe('validate', () => {
    describe('name validation', () => {
      it('should pass with valid name', () => {
        const result = validator.validate({
          name: 'Hotel Paradise',
          city: 'Buenos Aires'
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject empty name', () => {
        const result = validator.validate({
          name: '',
          city: 'Buenos Aires'
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Name is required');
      });

      it('should reject whitespace-only name', () => {
        const result = validator.validate({
          name: '   ',
          city: 'Buenos Aires'
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Name is required');
      });

      it('should reject short name', () => {
        const result = validator.validate({
          name: 'AB',
          city: 'Buenos Aires'
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Name must be at least 3 characters');
      });

      it('should reject long name', () => {
        const result = validator.validate({
          name: 'a'.repeat(256),
          city: 'Buenos Aires'
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Name must not exceed 255 characters');
      });

      it('should accept name at minimum length', () => {
        const result = validator.validate({
          name: 'ABC',
          city: 'Buenos Aires'
        });

        expect(result.isValid).toBe(true);
      });

      it('should accept name at maximum length', () => {
        const result = validator.validate({
          name: 'a'.repeat(255),
          city: 'Buenos Aires'
        });

        expect(result.isValid).toBe(true);
      });
    });

    describe('city validation', () => {
      it('should reject missing city', () => {
        const result = validator.validate({
          name: 'Hotel Paradise',
          city: ''
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('City is required');
      });

      it('should reject whitespace-only city', () => {
        const result = validator.validate({
          name: 'Hotel Paradise',
          city: '   '
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('City is required');
      });
    });

    describe('price validation', () => {
      it('should accept valid price', () => {
        const result = validator.validate({
          name: 'Hotel',
          city: 'BA',
          pricePerNight: 100
        });

        expect(result.isValid).toBe(true);
      });

      it('should reject negative price', () => {
        const result = validator.validate({
          name: 'Hotel',
          city: 'BA',
          pricePerNight: -1
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Price must be positive');
      });

      it('should reject zero price', () => {
        const result = validator.validate({
          name: 'Hotel',
          city: 'BA',
          pricePerNight: 0
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Price must be positive');
      });

      it('should reject excessive price', () => {
        const result = validator.validate({
          name: 'Hotel',
          city: 'BA',
          pricePerNight: 1000001
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Price must not exceed 1,000,000');
      });

      it('should accept minimum valid price', () => {
        const result = validator.validate({
          name: 'Hotel',
          city: 'BA',
          pricePerNight: 0.01
        });

        expect(result.isValid).toBe(true);
      });

      it('should accept maximum valid price', () => {
        const result = validator.validate({
          name: 'Hotel',
          city: 'BA',
          pricePerNight: 1000000
        });

        expect(result.isValid).toBe(true);
      });

      it('should pass when price is not provided', () => {
        const result = validator.validate({
          name: 'Hotel',
          city: 'BA'
        });

        expect(result.isValid).toBe(true);
      });
    });

    describe('multiple errors', () => {
      it('should accumulate all errors', () => {
        const result = validator.validate({
          name: '',
          city: '',
          pricePerNight: -100
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(3);
        expect(result.errors).toContain('Name is required');
        expect(result.errors).toContain('City is required');
        expect(result.errors).toContain('Price must be positive');
      });
    });
  });
});
```

## Mocking Dependencies

### Why Mock?

Unit tests must be **completely isolated**:

- **Speed**: No real I/O operations (DB, network, file system)
- **Control**: Simulate any scenario (success, failure, edge cases)
- **Reliability**: No external dependencies or race conditions
- **Focus**: Test only the unit, not its dependencies

### Mocking with Vitest

#### Mock Module

```typescript
// Mock entire module
import { vi } from 'vitest';
import { AccommodationModel } from './accommodation.model';

vi.mock('./accommodation.model', () => ({
  AccommodationModel: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }))
}));

describe('AccommodationService', () => {
  it('should call model.findById', async () => {
    const mockModel = new AccommodationModel();
    mockModel.findById.mockResolvedValue({
      id: '1',
      name: 'Hotel'
    });

    const service = new AccommodationService(mockModel);
    const result = await service.getById('1');

    expect(mockModel.findById).toHaveBeenCalledWith('1');
    expect(result.name).toBe('Hotel');
  });
});
```

#### Mock Function

```typescript
import { vi } from 'vitest';

describe('Function Mocking', () => {
  it('should mock return value', () => {
    const mockFn = vi.fn();
    mockFn.mockReturnValue(42);

    expect(mockFn()).toBe(42);
  });

  it('should mock async return', async () => {
    const mockFn = vi.fn();
    mockFn.mockResolvedValue({ data: 'test' });

    const result = await mockFn();
    expect(result.data).toBe('test');
  });

  it('should mock rejection', async () => {
    const mockFn = vi.fn();
    mockFn.mockRejectedValue(new Error('Failed'));

    await expect(mockFn()).rejects.toThrow('Failed');
  });

  it('should mock multiple calls', () => {
    const mockFn = vi.fn();
    mockFn
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValue(3);

    expect(mockFn()).toBe(1);
    expect(mockFn()).toBe(2);
    expect(mockFn()).toBe(3);
    expect(mockFn()).toBe(3); // Default for subsequent calls
  });
});
```

#### Spy on Method

```typescript
import { vi } from 'vitest';

describe('Method Spying', () => {
  it('should spy on object method', () => {
    const calculator = {
      add: (a: number, b: number) => a + b,
      multiply: (a: number, b: number) => a * b
    };

    const addSpy = vi.spyOn(calculator, 'add');

    const result = calculator.add(2, 3);

    expect(addSpy).toHaveBeenCalledWith(2, 3);
    expect(addSpy).toHaveReturnedWith(5);
    expect(result).toBe(5);
  });

  it('should spy and mock implementation', () => {
    const obj = {
      fetchData: async () => ({ data: 'real' })
    };

    const spy = vi.spyOn(obj, 'fetchData').mockResolvedValue({
      data: 'mocked'
    });

    const result = await obj.fetchData();

    expect(spy).toHaveBeenCalled();
    expect(result.data).toBe('mocked');
  });
});
```

### Mock Patterns

#### Constructor Injection

```typescript
// service.ts
export class AccommodationService {
  constructor(
    private readonly model: AccommodationModel,
    private readonly logger: Logger
  ) {}

  async findById(id: string) {
    this.logger.info(`Finding accommodation ${id}`);
    return await this.model.findById(id);
  }
}

// service.test.ts
describe('AccommodationService', () => {
  let service: AccommodationService;
  let mockModel: vi.Mocked<AccommodationModel>;
  let mockLogger: vi.Mocked<Logger>;

  beforeEach(() => {
    mockModel = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    } as any;

    service = new AccommodationService(mockModel, mockLogger);
  });

  it('should log and find accommodation', async () => {
    mockModel.findById.mockResolvedValue({
      id: '1',
      name: 'Hotel'
    });

    const result = await service.findById('1');

    expect(mockLogger.info).toHaveBeenCalledWith('Finding accommodation 1');
    expect(mockModel.findById).toHaveBeenCalledWith('1');
    expect(result.name).toBe('Hotel');
  });
});
```

#### Module Mocking

```typescript
// database.ts
import { getDb } from '@repo/db';

export async function findAccommodation(id: string) {
  const db = getDb();
  return await db.query.accommodations.findFirst({
    where: (accommodations, { eq }) => eq(accommodations.id, id)
  });
}

// database.test.ts
import { vi } from 'vitest';
import { getDb } from '@repo/db';

vi.mock('@repo/db', () => ({
  getDb: vi.fn()
}));

describe('findAccommodation', () => {
  it('should query database', async () => {
    const mockDb = {
      query: {
        accommodations: {
          findFirst: vi.fn().mockResolvedValue({
            id: '1',
            name: 'Hotel'
          })
        }
      }
    };

    (getDb as vi.Mock).mockReturnValue(mockDb);

    const result = await findAccommodation('1');

    expect(getDb).toHaveBeenCalled();
    expect(mockDb.query.accommodations.findFirst).toHaveBeenCalled();
    expect(result.name).toBe('Hotel');
  });
});
```

## Testing Async Code

### Promises

```typescript
describe('Async Functions', () => {
  it('should resolve with data', async () => {
    const data = await fetchAccommodation('1');
    expect(data).toBeDefined();
    expect(data.id).toBe('1');
  });

  it('should reject with error', async () => {
    await expect(fetchAccommodation('invalid'))
      .rejects
      .toThrow('Not found');
  });

  it('should handle successful promise', async () => {
    const promise = Promise.resolve({ data: 'test' });
    const result = await promise;
    expect(result.data).toBe('test');
  });

  it('should handle rejected promise', async () => {
    const promise = Promise.reject(new Error('Failed'));
    await expect(promise).rejects.toThrow('Failed');
  });
});
```

### Callbacks

```typescript
describe('Callback Functions', () => {
  it('should call callback with result', (done) => {
    processData((error, result) => {
      expect(error).toBeNull();
      expect(result).toBe('success');
      done(); // Signal test completion
    });
  });

  it('should call callback with error', (done) => {
    processData((error, result) => {
      expect(error).toBeInstanceOf(Error);
      expect(result).toBeNull();
      done();
    });
  });
});
```

### Timers

```typescript
import { vi } from 'vitest';

describe('Timer Functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce function calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(fn).toHaveBeenCalledOnce();
  });

  it('should throttle function calls', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled();
    expect(fn).toHaveBeenCalledOnce();

    throttled();
    expect(fn).toHaveBeenCalledOnce(); // Still only once

    vi.advanceTimersByTime(1000);

    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should delay execution', () => {
    const fn = vi.fn();

    setTimeout(fn, 1000);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });
});
```

## Testing Error Handling

### Throwing Errors

```typescript
describe('Error Throwing', () => {
  it('should throw for negative age', () => {
    expect(() => validateAge(-1))
      .toThrow('Age must be positive');
  });

  it('should throw specific error type', () => {
    expect(() => validateAge(-1))
      .toThrow(ValidationError);
  });

  it('should throw with error message', () => {
    expect(() => validateAge(-1))
      .toThrow(/positive/);
  });

  it('should not throw for valid age', () => {
    expect(() => validateAge(25)).not.toThrow();
  });
});
```

### Error Results

```typescript
describe('AccommodationService', () => {
  describe('create', () => {
    it('should return error for duplicate name', async () => {
      const service = new AccommodationService();

      // Setup mock to simulate duplicate
      mockModel.findOne.mockResolvedValue({ id: '1', name: 'Hotel' });

      const result = await service.create({ name: 'Hotel' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('DUPLICATE_NAME');
      expect(result.error.message).toBe('Name already exists');
    });

    it('should return error for validation failure', async () => {
      const result = await service.create({ name: '' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### Try-Catch Patterns

```typescript
describe('Error Handling', () => {
  it('should catch and handle error', async () => {
    try {
      await riskyOperation();
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Operation failed');
    }
  });

  it('should use expect().rejects', async () => {
    await expect(riskyOperation())
      .rejects
      .toThrow('Operation failed');
  });
});
```

## Testing Edge Cases

### Boundary Values

```typescript
describe('validatePrice', () => {
  describe('minimum boundary', () => {
    it('should reject negative price', () => {
      expect(validatePrice(-1)).toBe(false);
    });

    it('should reject zero price', () => {
      expect(validatePrice(0)).toBe(false);
    });

    it('should accept minimum valid price', () => {
      expect(validatePrice(0.01)).toBe(true);
    });
  });

  describe('maximum boundary', () => {
    it('should accept maximum price', () => {
      expect(validatePrice(999999.99)).toBe(true);
    });

    it('should reject exceeding maximum', () => {
      expect(validatePrice(1000000)).toBe(false);
    });
  });

  describe('edge values', () => {
    it('should handle very small decimals', () => {
      expect(validatePrice(0.001)).toBe(true);
    });

    it('should handle large decimals', () => {
      expect(validatePrice(123456.789)).toBe(true);
    });
  });
});
```

### Null and Undefined

```typescript
describe('formatName', () => {
  it('should handle null', () => {
    expect(formatName(null)).toBe('');
  });

  it('should handle undefined', () => {
    expect(formatName(undefined)).toBe('');
  });

  it('should handle empty string', () => {
    expect(formatName('')).toBe('');
  });

  it('should handle whitespace', () => {
    expect(formatName('   ')).toBe('');
  });

  it('should format valid name', () => {
    expect(formatName('john doe')).toBe('John Doe');
  });
});
```

### Empty Collections

```typescript
describe('calculateAverage', () => {
  it('should return 0 for empty array', () => {
    expect(calculateAverage([])).toBe(0);
  });

  it('should handle array with one item', () => {
    expect(calculateAverage([5])).toBe(5);
  });

  it('should calculate average of multiple items', () => {
    expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(calculateAverage([-1, -2, -3])).toBe(-2);
  });
});
```

### Special Characters

```typescript
describe('generateSlug', () => {
  it('should handle special characters', () => {
    expect(generateSlug('Hotel & Spa!')).toBe('hotel-spa');
  });

  it('should handle unicode', () => {
    expect(generateSlug('Café ñoño')).toBe('cafe-nono');
  });

  it('should handle emojis', () => {
    expect(generateSlug('Hotel 🏨')).toBe('hotel');
  });

  it('should handle quotes', () => {
    expect(generateSlug(`Hotel "Paradise"`)).toBe('hotel-paradise');
  });
});
```

## Test Organization

### Setup and Teardown

```typescript
describe('AccommodationService', () => {
  let service: AccommodationService;
  let mockModel: vi.Mocked<AccommodationModel>;
  let mockLogger: vi.Mocked<Logger>;

  // Runs once before all tests
  beforeAll(() => {
    console.log('Suite starting');
  });

  // Runs once after all tests
  afterAll(() => {
    console.log('Suite finished');
  });

  // Runs before each test
  beforeEach(() => {
    mockModel = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    } as any;

    service = new AccommodationService(mockModel, mockLogger);
  });

  // Runs after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should work', () => {
    // Test with fresh mocks
  });
});
```

### Nested Describes

```typescript
describe('AccommodationService', () => {
  describe('create', () => {
    describe('with valid data', () => {
      it('should create accommodation', () => {});
      it('should generate slug', () => {});
      it('should set timestamps', () => {});
    });

    describe('with invalid data', () => {
      it('should reject empty name', () => {});
      it('should reject invalid email', () => {});
      it('should reject negative price', () => {});
    });

    describe('with duplicate name', () => {
      it('should detect duplicate', () => {});
      it('should return error code', () => {});
    });
  });

  describe('update', () => {
    // Similar structure
  });
});
```

## Assertions

### Basic Matchers

```typescript
describe('Matchers', () => {
  it('should test equality', () => {
    expect(2 + 2).toBe(4); // Strict equality (===)
    expect({ name: 'Test' }).toEqual({ name: 'Test' }); // Deep equality
  });

  it('should test truthiness', () => {
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect(undefined).toBeUndefined();
    expect(null).toBeNull();
    expect(42).toBeDefined();
  });

  it('should test numbers', () => {
    expect(10).toBeGreaterThan(5);
    expect(10).toBeGreaterThanOrEqual(10);
    expect(5).toBeLessThan(10);
    expect(5).toBeLessThanOrEqual(5);
    expect(0.1 + 0.2).toBeCloseTo(0.3); // Floating point
  });

  it('should test strings', () => {
    expect('Hotel Paradise').toMatch(/Paradise/);
    expect('Hotel Paradise').toContain('Paradise');
    expect('hello').toBe('hello');
  });

  it('should test arrays', () => {
    expect([1, 2, 3]).toContain(2);
    expect([1, 2, 3]).toHaveLength(3);
    expect(['a', 'b']).toEqual(['a', 'b']);
  });

  it('should test objects', () => {
    expect({ name: 'Hotel', city: 'BA' }).toHaveProperty('name');
    expect({ name: 'Hotel' }).toMatchObject({ name: 'Hotel' });
  });
});
```

### Negation

```typescript
describe('Negation', () => {
  it('should negate matchers', () => {
    expect(5).not.toBe(4);
    expect('hello').not.toContain('goodbye');
    expect([1, 2, 3]).not.toContain(4);
    expect(() => validFunction()).not.toThrow();
  });
});
```

### Custom Matchers

```typescript
import { expect } from 'vitest';

expect.extend({
  toBeValidEmail(received: string) {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(received);

    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email`
    };
  }
});

describe('Custom Matchers', () => {
  it('should validate email', () => {
    expect('test@example.com').toBeValidEmail();
    expect('invalid').not.toBeValidEmail();
  });
});
```

## Snapshot Testing

```typescript
describe('formatAccommodation', () => {
  it('should match snapshot', () => {
    const accommodation = {
      id: '1',
      name: 'Hotel Paradise',
      city: 'Buenos Aires',
      pricePerNight: 100
    };

    const formatted = formatAccommodation(accommodation);

    expect(formatted).toMatchSnapshot();
  });

  it('should match inline snapshot', () => {
    const result = generateSlug('Hotel Paradise');

    expect(result).toMatchInlineSnapshot(`"hotel-paradise"`);
  });
});
```

## Performance Testing

```typescript
describe('Performance', () => {
  it('should complete in under 10ms', () => {
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      generateSlug('Hotel Paradise');
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it('should handle large datasets efficiently', () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => ({
      id: String(i),
      name: `Hotel ${i}`
    }));

    const start = performance.now();
    const result = processAccommodations(largeArray);
    const duration = performance.now() - start;

    expect(result).toHaveLength(10000);
    expect(duration).toBeLessThan(100);
  });
});
```

## Best Practices

### DO ✅

```typescript
// Test one behavior per test
it('should create accommodation', async () => {
  const result = await service.create({ name: 'Hotel' });
  expect(result.success).toBe(true);
});

// Use descriptive names
it('should reject duplicate name', async () => {});

// Follow AAA pattern
it('should calculate price', () => {
  // Arrange
  const data = { price: 100, nights: 3 };

  // Act
  const result = calculate(data);

  // Assert
  expect(result).toBe(300);
});

// Mock all dependencies
beforeEach(() => {
  mockModel = { findById: vi.fn() };
  service = new Service(mockModel);
});

// Test edge cases
it('should handle empty array', () => {
  expect(process([])).toEqual([]);
});

// Clean up after tests
afterEach(() => {
  vi.clearAllMocks();
});
```

### DON'T ❌

```typescript
// Multiple behaviors
it('should create and update', async () => {
  await service.create(data);
  await service.update(data); // Split into 2 tests!
});

// Unclear names
it('test 1', () => {}); // What does this test?
it('works', () => {}); // Too vague

// No AAA structure
it('should work', () => {
  const result = service.method({ data: 'test' });expect(result).toBe('test');
  // Hard to read!
});

// Shared state
let user; // Don't share between tests!
it('creates user', () => { user = create(); });
it('updates user', () => { update(user); });

// Skipping cleanup
afterEach(() => {
  // Forgot vi.clearAllMocks()!
});
```

## Common Patterns

### Testing Private Methods

**Don't test private methods directly**. Test through public API:

```typescript
// ❌ DON'T
class Service {
  private _validate(data) { /* ... */ }
}

it('should validate', () => {
  const result = service['_validate'](data); // Accessing private!
});

// ✅ DO
it('should reject invalid data', () => {
  // Test public method that uses private validation
  const result = service.create(invalidData);
  expect(result.success).toBe(false);
});
```

### Testing Static Methods

```typescript
class MathUtils {
  static add(a: number, b: number): number {
    return a + b;
  }

  static multiply(a: number, b: number): number {
    return a * b;
  }
}

describe('MathUtils', () => {
  describe('add', () => {
    it('should add two numbers', () => {
      expect(MathUtils.add(2, 3)).toBe(5);
    });

    it('should handle negative numbers', () => {
      expect(MathUtils.add(-2, -3)).toBe(-5);
    });
  });

  describe('multiply', () => {
    it('should multiply two numbers', () => {
      expect(MathUtils.multiply(2, 3)).toBe(6);
    });

    it('should handle zero', () => {
      expect(MathUtils.multiply(5, 0)).toBe(0);
    });
  });
});
```

## Next Steps

- [Integration Testing](./integration-testing.md) - Testing multiple components
- [Test Factories](./test-factories.md) - Generating test data
- [Mocking Strategies](./mocking.md) - Advanced mocking techniques
- [Coverage Requirements](./coverage.md) - 90% coverage enforcement

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Testing Strategy](./strategy.md)
- [TDD Workflow](.claude/docs/workflows/phase-2-implementation.md)
