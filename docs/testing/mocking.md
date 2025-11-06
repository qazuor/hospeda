# Mocking Strategies

## Overview

Mocking is the practice of **replacing real dependencies with test doubles** to isolate code under test. Mocks simulate the behavior of real objects in controlled ways, allowing you to test components independently.

**Why Mock?**

- **Isolation**: Test units independently from dependencies
- **Speed**: Avoid slow operations (database, network, file I/O)
- **Control**: Simulate success, failure, and edge cases
- **Determinism**: Tests produce same results every time
- **Safety**: No side effects on real systems

## Types of Test Doubles

### Mock

A mock is a test double that verifies interactions (calls, arguments).

```typescript
const mockEmailService = {
  send: vi.fn()
};

await service.notifyUser('user@example.com');

// Verify interaction
expect(mockEmailService.send).toHaveBeenCalledWith({
  to: 'user@example.com',
  subject: 'Welcome'
});
```

### Stub

A stub provides predefined responses without verifying interactions.

```typescript
const stubDatabase = {
  query: () => Promise.resolve([{ id: '1', name: 'Hotel' }])
};

const results = await stubDatabase.query('SELECT * FROM hotels');
// Returns predefined data, doesn't verify call
```

### Spy

A spy wraps a real object to track calls while preserving original behavior.

```typescript
const spy = vi.spyOn(logger, 'info');

logger.info('Test message'); // Real method called

expect(spy).toHaveBeenCalledWith('Test message');
```

### Fake

A fake is a working implementation with shortcuts (e.g., in-memory database).

```typescript
class FakeDatabase {
  private data = new Map();

  async save(id: string, value: any) {
    this.data.set(id, value);
  }

  async get(id: string) {
    return this.data.get(id);
  }
}
```

## Mocking with Vitest

### Mock Functions

```typescript
import { vi } from 'vitest';

describe('Mock Functions', () => {
  it('should create basic mock', () => {
    const mockFn = vi.fn();

    mockFn('hello');
    mockFn('world');

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('hello');
    expect(mockFn).toHaveBeenCalledWith('world');
  });

  it('should mock return value', () => {
    const mockFn = vi.fn();
    mockFn.mockReturnValue(42);

    const result = mockFn();

    expect(result).toBe(42);
  });

  it('should mock resolved value', async () => {
    const mockFn = vi.fn();
    mockFn.mockResolvedValue({ data: 'success' });

    const result = await mockFn();

    expect(result.data).toBe('success');
  });

  it('should mock rejected value', async () => {
    const mockFn = vi.fn();
    mockFn.mockRejectedValue(new Error('Failed'));

    await expect(mockFn()).rejects.toThrow('Failed');
  });

  it('should mock different values per call', () => {
    const mockFn = vi.fn();
    mockFn
      .mockReturnValueOnce('first')
      .mockReturnValueOnce('second')
      .mockReturnValue('default');

    expect(mockFn()).toBe('first');
    expect(mockFn()).toBe('second');
    expect(mockFn()).toBe('default');
    expect(mockFn()).toBe('default'); // Subsequent calls
  });
});
```

### Mock Implementation

```typescript
describe('Mock Implementation', () => {
  it('should mock with custom implementation', () => {
    const mockFn = vi.fn((a: number, b: number) => a + b);

    expect(mockFn(2, 3)).toBe(5);
    expect(mockFn).toHaveBeenCalledWith(2, 3);
  });

  it('should mock async implementation', async () => {
    const mockFn = vi.fn(async (id: string) => {
      return { id, name: `User ${id}` };
    });

    const result = await mockFn('123');

    expect(result).toEqual({ id: '123', name: 'User 123' });
  });

  it('should change implementation', () => {
    const mockFn = vi.fn(() => 'original');

    expect(mockFn()).toBe('original');

    mockFn.mockImplementation(() => 'changed');

    expect(mockFn()).toBe('changed');
  });

  it('should change implementation once', () => {
    const mockFn = vi.fn(() => 'default');

    mockFn.mockImplementationOnce(() => 'once');

    expect(mockFn()).toBe('once');
    expect(mockFn()).toBe('default');
  });
});
```

### Spy on Methods

```typescript
describe('Spying', () => {
  it('should spy on object method', () => {
    const calculator = {
      add: (a: number, b: number) => a + b,
      multiply: (a: number, b: number) => a * b
    };

    const addSpy = vi.spyOn(calculator, 'add');

    const result = calculator.add(2, 3);

    expect(result).toBe(5); // Original implementation
    expect(addSpy).toHaveBeenCalledWith(2, 3);
  });

  it('should spy and mock implementation', () => {
    const obj = {
      getValue: () => 'real'
    };

    const spy = vi.spyOn(obj, 'getValue').mockReturnValue('mocked');

    expect(obj.getValue()).toBe('mocked');
    expect(spy).toHaveBeenCalled();
  });

  it('should restore original implementation', () => {
    const obj = {
      getValue: () => 'real'
    };

    const spy = vi.spyOn(obj, 'getValue').mockReturnValue('mocked');

    expect(obj.getValue()).toBe('mocked');

    spy.mockRestore();

    expect(obj.getValue()).toBe('real');
  });

  it('should spy on getter', () => {
    const obj = {
      get value() {
        return 'real';
      }
    };

    const spy = vi.spyOn(obj, 'value', 'get').mockReturnValue('mocked');

    expect(obj.value).toBe('mocked');
    expect(spy).toHaveBeenCalled();
  });

  it('should spy on setter', () => {
    const obj = {
      _value: '',
      set value(val: string) {
        this._value = val;
      }
    };

    const spy = vi.spyOn(obj, 'value', 'set');

    obj.value = 'test';

    expect(spy).toHaveBeenCalledWith('test');
  });
});
```

## Mocking Modules

### Mock Entire Module

```typescript
// logger.ts
export const logger = {
  info: (message: string) => console.log(message),
  error: (message: string) => console.error(message)
};

// service.test.ts
import { vi } from 'vitest';
import { logger } from './logger';

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('Service', () => {
  it('should log info', () => {
    service.doSomething();

    expect(logger.info).toHaveBeenCalledWith('Doing something');
  });
});
```

### Mock Specific Module Export

```typescript
// utils.ts
export function generateId(): string {
  return crypto.randomUUID();
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

// service.test.ts
import { vi } from 'vitest';
import * as utils from './utils';

vi.spyOn(utils, 'generateId').mockReturnValue('mock-id-123');

describe('Service', () => {
  it('should use mocked ID', () => {
    const id = utils.generateId();

    expect(id).toBe('mock-id-123');
  });

  it('should use real formatDate', () => {
    const date = new Date('2024-01-01');
    const formatted = utils.formatDate(date);

    expect(formatted).toContain('2024-01-01');
  });
});
```

### Partial Module Mock

```typescript
import { vi } from 'vitest';

vi.mock('./database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./database')>();

  return {
    ...actual,
    // Mock only query function
    query: vi.fn()
  };
});

describe('Service', () => {
  it('should use mocked query', () => {
    // query is mocked
    // All other exports are real
  });
});
```

### Mock with Factory

```typescript
import { vi } from 'vitest';

vi.mock('./config', () => ({
  default: {
    apiUrl: 'http://test.com',
    apiKey: 'test-key'
  }
}));

describe('API Client', () => {
  it('should use test config', () => {
    expect(config.apiUrl).toBe('http://test.com');
  });
});
```

## Mocking Dependencies

### Constructor Injection

```typescript
// service.ts
export class AccommodationService {
  constructor(
    private readonly model: AccommodationModel,
    private readonly logger: Logger
  ) {}

  async create(data: CreateAccommodationData) {
    this.logger.info('Creating accommodation');
    return await this.model.create(data);
  }
}

// service.test.ts
describe('AccommodationService', () => {
  let service: AccommodationService;
  let mockModel: vi.Mocked<AccommodationModel>;
  let mockLogger: vi.Mocked<Logger>;

  beforeEach(() => {
    mockModel = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn()
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    } as any;

    service = new AccommodationService(mockModel, mockLogger);
  });

  it('should create accommodation', async () => {
    mockModel.create.mockResolvedValue({
      id: '1',
      name: 'Hotel'
    });

    const result = await service.create({ name: 'Hotel' });

    expect(mockLogger.info).toHaveBeenCalledWith('Creating accommodation');
    expect(mockModel.create).toHaveBeenCalledWith({ name: 'Hotel' });
    expect(result.id).toBe('1');
  });
});
```

### Dependency Injection Pattern

```typescript
// service.ts
export class BookingService {
  private paymentService: PaymentService;

  constructor(paymentService?: PaymentService) {
    this.paymentService = paymentService ?? new PaymentService();
  }

  async createBookingWithPayment(data: CreateBookingData) {
    const booking = await this.createBooking(data);
    const payment = await this.paymentService.charge({
      amount: booking.totalPrice
    });

    return { booking, payment };
  }
}

// service.test.ts
describe('BookingService', () => {
  it('should create booking with payment', async () => {
    const mockPaymentService = {
      charge: vi.fn().mockResolvedValue({
        success: true,
        id: 'pay-123'
      })
    } as any;

    const service = new BookingService(mockPaymentService);

    const result = await service.createBookingWithPayment({
      accommodationId: 'acc-1',
      userId: 'user-1'
    });

    expect(mockPaymentService.charge).toHaveBeenCalled();
    expect(result.payment.id).toBe('pay-123');
  });
});
```

## Mocking External Services

### HTTP Client with MSW

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock successful API call
  http.get('https://api.example.com/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test User',
      email: 'test@example.com'
    });
  }),

  // Mock API error
  http.post('https://api.example.com/bookings', () => {
    return HttpResponse.json(
      { error: 'Booking failed' },
      { status: 400 }
    );
  }),

  // Mock with delay
  http.get('https://api.example.com/slow', async () => {
    await delay(2000);
    return HttpResponse.json({ data: 'slow response' });
  }),

  // Mock with request validation
  http.post('https://api.example.com/validate', async ({ request }) => {
    const body = await request.json();

    if (!body.email) {
      return HttpResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({ success: true });
  })
];

// test/setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Usage in tests
describe('UserService', () => {
  it('should fetch user from API', async () => {
    const service = new UserService();

    const user = await service.fetchUser('123');

    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
  });

  it('should handle API error', async () => {
    // Override handler for this test
    server.use(
      http.get('https://api.example.com/users/:id', () => {
        return HttpResponse.json(
          { error: 'Not found' },
          { status: 404 }
        );
      })
    );

    const service = new UserService();

    await expect(service.fetchUser('999')).rejects.toThrow('Not found');
  });
});
```

### Email Service

```typescript
// email.service.ts
export interface EmailService {
  send(options: SendEmailOptions): Promise<EmailResult>;
  sendTemplate(options: SendTemplateOptions): Promise<EmailResult>;
}

// test/mocks/email.mock.ts
export function createMockEmailService(): vi.Mocked<EmailService> {
  return {
    send: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'mock-message-id'
    }),
    sendTemplate: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'mock-template-id'
    })
  };
}

// service.test.ts
describe('UserService', () => {
  let service: UserService;
  let mockEmailService: vi.Mocked<EmailService>;

  beforeEach(() => {
    mockEmailService = createMockEmailService();
    service = new UserService(mockEmailService);
  });

  it('should send welcome email on registration', async () => {
    await service.register({
      email: 'user@example.com',
      name: 'Test User'
    });

    expect(mockEmailService.sendTemplate).toHaveBeenCalledWith({
      to: 'user@example.com',
      template: 'welcome',
      data: {
        name: 'Test User'
      }
    });
  });

  it('should handle email failure gracefully', async () => {
    mockEmailService.sendTemplate.mockRejectedValue(
      new Error('Email service down')
    );

    const result = await service.register({
      email: 'user@example.com',
      name: 'Test User'
    });

    // Should still create user
    expect(result.success).toBe(true);

    // But log the error
    expect(logger.error).toHaveBeenCalled();
  });
});
```

### Payment Service

```typescript
// test/mocks/payment.mock.ts
export function createMockPaymentService(): vi.Mocked<PaymentService> {
  return {
    charge: vi.fn().mockResolvedValue({
      success: true,
      transactionId: 'txn-123',
      amount: 100,
      currency: 'USD'
    }),

    refund: vi.fn().mockResolvedValue({
      success: true,
      refundId: 'ref-123',
      amount: 100
    }),

    getTransaction: vi.fn().mockResolvedValue({
      id: 'txn-123',
      status: 'completed',
      amount: 100
    })
  };
}

// service.test.ts
describe('BookingService', () => {
  it('should process payment on booking', async () => {
    const mockPaymentService = createMockPaymentService();
    const service = new BookingService(mockPaymentService);

    const result = await service.createBookingWithPayment({
      accommodationId: 'acc-1',
      userId: 'user-1',
      totalPrice: 500
    });

    expect(mockPaymentService.charge).toHaveBeenCalledWith({
      amount: 500,
      currency: 'USD',
      metadata: expect.objectContaining({
        accommodationId: 'acc-1'
      })
    });

    expect(result.payment.transactionId).toBe('txn-123');
  });

  it('should rollback booking on payment failure', async () => {
    const mockPaymentService = createMockPaymentService();
    mockPaymentService.charge.mockRejectedValue(
      new Error('Payment declined')
    );

    const service = new BookingService(mockPaymentService);

    await expect(
      service.createBookingWithPayment({
        accommodationId: 'acc-1',
        userId: 'user-1',
        totalPrice: 500
      })
    ).rejects.toThrow('Payment declined');

    // Verify booking was not created
    const bookings = await db.select().from(bookingsTable);
    expect(bookings).toHaveLength(0);
  });
});
```

## Mocking Database

### Mock Database Client

```typescript
// test/mocks/database.mock.ts
export function createMockDb() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([]))
      }))
    })),

    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: '1' }]))
      }))
    })),

    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: '1' }]))
        }))
      }))
    })),

    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve())
    }))
  };
}

// model.test.ts
describe('AccommodationModel', () => {
  it('should query database', async () => {
    const mockDb = createMockDb();
    const model = new AccommodationModel(mockDb);

    mockDb.select().from().where.mockResolvedValue([
      { id: '1', name: 'Hotel' }
    ]);

    const result = await model.findById('1');

    expect(result.name).toBe('Hotel');
  });
});
```

### Mock Query Builder

```typescript
// test/mocks/query-builder.mock.ts
export class MockQueryBuilder {
  private mockData: any[] = [];

  constructor(data: any[] = []) {
    this.mockData = data;
  }

  where(condition: any) {
    return this;
  }

  orderBy(field: string) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  async execute() {
    return this.mockData;
  }
}

// Usage
const queryBuilder = new MockQueryBuilder([
  { id: '1', name: 'Hotel 1' },
  { id: '2', name: 'Hotel 2' }
]);

const results = await queryBuilder
  .where({ city: 'Buenos Aires' })
  .orderBy('name')
  .limit(10)
  .execute();
```

## Mocking Time

### Mock Dates

```typescript
import { vi } from 'vitest';

describe('Date Mocking', () => {
  it('should mock current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01'));

    expect(new Date().toISOString()).toContain('2024-01-01');

    vi.useRealTimers();
  });

  it('should advance time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01'));

    vi.advanceTimersByTime(1000 * 60 * 60 * 24); // 1 day

    expect(new Date().toISOString()).toContain('2024-01-02');

    vi.useRealTimers();
  });

  it('should run pending timers', () => {
    vi.useFakeTimers();

    const callback = vi.fn();
    setTimeout(callback, 1000);

    expect(callback).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(callback).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
```

### Mock Timers

```typescript
describe('Timer Mocking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    throttled(); // Called
    expect(fn).toHaveBeenCalledOnce();

    throttled(); // Throttled
    expect(fn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1000);

    throttled(); // Called
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle setInterval', () => {
    const fn = vi.fn();

    setInterval(fn, 1000);

    vi.advanceTimersByTime(3000);

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
```

## Mocking Environment Variables

```typescript
describe('Environment Mocking', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use test environment', () => {
    process.env.NODE_ENV = 'test';
    process.env.API_URL = 'http://test.com';

    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.API_URL).toBe('http://test.com');
  });

  it('should load different config per environment', () => {
    process.env.NODE_ENV = 'production';

    const config = loadConfig();

    expect(config.apiUrl).toBe('https://api.hospeda.com');
  });
});
```

## Mocking File System

```typescript
import { vi } from 'vitest';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn()
}));

describe('File Service', () => {
  it('should read file', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('file content');

    const content = await fileService.read('test.txt');

    expect(content).toBe('file content');
    expect(fs.readFile).toHaveBeenCalledWith('test.txt', 'utf-8');
  });

  it('should write file', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await fileService.write('test.txt', 'content');

    expect(fs.writeFile).toHaveBeenCalledWith('test.txt', 'content', 'utf-8');
  });
});
```

## Mock Assertions

### Call Tracking

```typescript
describe('Mock Assertions', () => {
  it('should verify call count', () => {
    const mockFn = vi.fn();

    mockFn();
    mockFn();

    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should verify called with arguments', () => {
    const mockFn = vi.fn();

    mockFn('hello', 'world');

    expect(mockFn).toHaveBeenCalledWith('hello', 'world');
  });

  it('should verify nth call', () => {
    const mockFn = vi.fn();

    mockFn('first');
    mockFn('second');
    mockFn('third');

    expect(mockFn).toHaveBeenNthCalledWith(1, 'first');
    expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
    expect(mockFn).toHaveBeenNthCalledWith(3, 'third');
  });

  it('should verify last call', () => {
    const mockFn = vi.fn();

    mockFn('first');
    mockFn('second');
    mockFn('last');

    expect(mockFn).toHaveBeenLastCalledWith('last');
  });

  it('should verify return value', () => {
    const mockFn = vi.fn().mockReturnValue(42);

    mockFn();

    expect(mockFn).toHaveReturnedWith(42);
  });
});
```

### Argument Matchers

```typescript
describe('Argument Matchers', () => {
  it('should match any argument', () => {
    const mockFn = vi.fn();

    mockFn({ id: '1', name: 'Test' });

    expect(mockFn).toHaveBeenCalledWith(expect.anything());
  });

  it('should match object containing', () => {
    const mockFn = vi.fn();

    mockFn({ id: '1', name: 'Test', city: 'BA' });

    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test'
      })
    );
  });

  it('should match array containing', () => {
    const mockFn = vi.fn();

    mockFn([1, 2, 3, 4, 5]);

    expect(mockFn).toHaveBeenCalledWith(
      expect.arrayContaining([2, 4])
    );
  });

  it('should match string containing', () => {
    const mockFn = vi.fn();

    mockFn('Hotel Paradise in Buenos Aires');

    expect(mockFn).toHaveBeenCalledWith(
      expect.stringContaining('Buenos Aires')
    );
  });

  it('should match type', () => {
    const mockFn = vi.fn();

    mockFn('test');
    mockFn(123);

    expect(mockFn).toHaveBeenNthCalledWith(1, expect.any(String));
    expect(mockFn).toHaveBeenNthCalledWith(2, expect.any(Number));
  });
});
```

## Mock Cleanup

```typescript
describe('Mock Cleanup', () => {
  let mockFn: vi.MockedFunction<any>;

  beforeEach(() => {
    mockFn = vi.fn();
  });

  afterEach(() => {
    // Clear call history
    vi.clearAllMocks();

    // Or reset implementation and calls
    vi.resetAllMocks();

    // Or restore original implementation
    vi.restoreAllMocks();
  });

  it('should clear mock between tests', () => {
    mockFn('test');

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should start fresh', () => {
    // mockFn was cleared in afterEach
    expect(mockFn).not.toHaveBeenCalled();
  });
});
```

## Best Practices

### DO ✅

```typescript
// Use type-safe mocks
const mockService: vi.Mocked<AccommodationService> = {
  create: vi.fn(),
  findById: vi.fn()
} as any;

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock at appropriate level
// Unit test: Mock all dependencies
// Integration test: Mock external services only
// E2E test: No mocks

// Use meaningful return values
mockFn.mockResolvedValue({
  id: '1',
  name: 'Hotel Paradise' // Realistic data
});

// Verify important interactions
expect(mockEmailService.send).toHaveBeenCalledWith({
  to: 'user@example.com',
  subject: 'Welcome'
});

// Use constructor injection
class Service {
  constructor(private dependency: Dependency) {}
}
```

### DON'T ❌

```typescript
// Don't mock what you don't own
vi.mock('express'); // ❌ Mock your adapter, not Express

// Don't over-mock
vi.mock('./everything'); // ❌ Mock only what's needed

// Don't leak mocks between tests
// ❌ No cleanup = tests affect each other

// Don't mock in integration tests
describe('Integration', () => {
  vi.mock('@repo/db'); // ❌ Use real database
});

// Don't use any everywhere
const mock = vi.fn() as any; // ❌ Use proper typing

// Don't verify everything
expect(mockFn).toHaveBeenCalledTimes(1);
expect(mockFn).toHaveBeenCalledWith('exact', 'args');
expect(mockFn).toHaveReturnedWith('value');
// ❌ Too much! Test behavior, not implementation
```

## Common Patterns

### Partial Mock

```typescript
const mockService = {
  create: vi.fn(),
  // Other methods use real implementation
  ...new AccommodationService()
} as any;
```

### Mock Chain

```typescript
const mockQueryBuilder = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([])
};
```

### Conditional Mock

```typescript
mockFn.mockImplementation((input) => {
  if (input === 'error') {
    throw new Error('Failed');
  }
  return { success: true };
});
```

## Next Steps

- [Unit Testing](./unit-testing.md) - Using mocks in unit tests
- [Integration Testing](./integration-testing.md) - When to avoid mocks
- [Test Factories](./test-factories.md) - Generating mock data

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Testing Strategy](./strategy.md)
- [Testing Best Practices](../development/testing-best-practices.md)
