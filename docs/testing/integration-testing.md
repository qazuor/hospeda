# Integration Testing

## Overview

Integration tests verify that **multiple components work together correctly**. They test the interactions between units with real dependencies, representing **25% of our test suite**.

**Characteristics**:

- **Speed**: < 1s per test
- **Scope**: Multiple components working together
- **Mocking**: Mock external services only (payment, email, external APIs)
- **Database**: Use real test database (in-memory or isolated instance)
- **Coverage**: 90%+ for services and business workflows

## What to Integration Test

### Service Layer with Database

Test services with real models and database operations:

```typescript
// test/services/accommodation.service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AccommodationService } from '../../src/services/accommodation.service';
import { setupTestDatabase, cleanupTestDatabase } from '../utils/test-db';
import { db } from '@repo/db';
import { accommodations } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

describe('AccommodationService Integration', () => {
  let service: AccommodationService;

  beforeAll(async () => {
    await setupTestDatabase();
    service = new AccommodationService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clear database before each test
    await db.delete(accommodations);
  });

  describe('create', () => {
    it('should create accommodation with all fields', async () => {
      // Arrange
      const data = {
        name: 'Hotel Paradise',
        slug: 'hotel-paradise',
        city: 'Buenos Aires',
        address: '123 Main St',
        description: 'A beautiful hotel',
        pricePerNight: 100,
        maxGuests: 4
      };

      // Act
      const result = await service.create(data);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe('Hotel Paradise');
      expect(result.data.slug).toBe('hotel-paradise');

      // Verify in database
      const saved = await db
        .select()
        .from(accommodations)
        .where(eq(accommodations.id, result.data.id));

      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Hotel Paradise');
      expect(saved[0].createdAt).toBeInstanceOf(Date);
    });

    it('should generate slug automatically if not provided', async () => {
      const result = await service.create({
        name: 'Hotel Paradise',
        city: 'Buenos Aires'
      });

      expect(result.success).toBe(true);
      expect(result.data.slug).toBe('hotel-paradise');
    });

    it('should prevent duplicate slugs', async () => {
      // Create first accommodation
      await service.create({
        name: 'Hotel Paradise',
        slug: 'hotel-paradise',
        city: 'BA'
      });

      // Try to create with same slug
      const result = await service.create({
        name: 'Another Hotel',
        slug: 'hotel-paradise',
        city: 'BA'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DUPLICATE_SLUG');
    });

    it('should validate required fields', async () => {
      const result = await service.create({
        name: '',
        city: 'BA'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('findById', () => {
    it('should find existing accommodation', async () => {
      // Create accommodation
      const created = await service.create({
        name: 'Hotel',
        city: 'BA'
      });

      // Find it
      const result = await service.findById(created.data.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(created.data.id);
      expect(result.name).toBe('Hotel');
    });

    it('should return null for non-existent id', async () => {
      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should not return soft-deleted accommodation', async () => {
      // Create and delete
      const created = await service.create({
        name: 'Hotel',
        city: 'BA'
      });
      await service.softDelete(created.data.id);

      // Try to find
      const result = await service.findById(created.data.id);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing accommodation', async () => {
      // Create
      const created = await service.create({
        name: 'Hotel',
        city: 'BA'
      });

      // Update
      const result = await service.update(created.data.id, {
        name: 'New Name',
        description: 'Updated description'
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New Name');
      expect(result.data.description).toBe('Updated description');

      // Verify in database
      const saved = await db
        .select()
        .from(accommodations)
        .where(eq(accommodations.id, created.data.id));

      expect(saved[0].name).toBe('New Name');
      expect(saved[0].updatedAt).not.toEqual(created.data.updatedAt);
    });

    it('should reject update for non-existent accommodation', async () => {
      const result = await service.update('non-existent', {
        name: 'New Name'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should update only provided fields', async () => {
      const created = await service.create({
        name: 'Hotel',
        city: 'BA',
        description: 'Original'
      });

      // Update only name
      const result = await service.update(created.data.id, {
        name: 'New Name'
      });

      expect(result.data.name).toBe('New Name');
      expect(result.data.description).toBe('Original'); // Unchanged
    });
  });

  describe('delete', () => {
    it('should soft delete accommodation', async () => {
      const created = await service.create({
        name: 'Hotel',
        city: 'BA'
      });

      const result = await service.softDelete(created.data.id);

      expect(result.success).toBe(true);

      // Should not appear in normal queries
      const found = await service.findById(created.data.id);
      expect(found).toBeNull();

      // But should exist in database with deletedAt
      const saved = await db
        .select()
        .from(accommodations)
        .where(eq(accommodations.id, created.data.id));

      expect(saved[0].deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Create test data
      await service.create({
        name: 'Beach Hotel',
        city: 'Mar del Plata',
        pricePerNight: 100
      });
      await service.create({
        name: 'Mountain Cabin',
        city: 'Bariloche',
        pricePerNight: 80
      });
      await service.create({
        name: 'City Hotel',
        city: 'Buenos Aires',
        pricePerNight: 150
      });
    });

    it('should search by city', async () => {
      const results = await service.search({
        city: 'Buenos Aires'
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('City Hotel');
    });

    it('should search by price range', async () => {
      const results = await service.search({
        minPrice: 80,
        maxPrice: 100
      });

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('Beach Hotel');
      expect(results.map(r => r.name)).toContain('Mountain Cabin');
    });

    it('should search by name', async () => {
      const results = await service.search({
        q: 'Hotel'
      });

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('Beach Hotel');
      expect(results.map(r => r.name)).toContain('City Hotel');
    });
  });
});
```

### API Routes with Real Request/Response

```typescript
// test/api/accommodations.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { createApp } from '../../src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../utils/test-db';

describe('Accommodation API Integration', () => {
  let app: Hono;

  beforeAll(async () => {
    await setupTestDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/v1/accommodations', () => {
    it('should create accommodation', async () => {
      const response = await app.request('/api/v1/accommodations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          name: 'Hotel Paradise',
          city: 'Buenos Aires',
          pricePerNight: 100
        })
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.name).toBe('Hotel Paradise');
      expect(data.id).toBeDefined();
      expect(data.slug).toBe('hotel-paradise');
    });

    it('should validate required fields', async () => {
      const response = await app.request('/api/v1/accommodations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const response = await app.request('/api/v1/accommodations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Hotel',
          city: 'BA'
        })
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/accommodations/:id', () => {
    it('should get accommodation by id', async () => {
      // Create accommodation
      const createResponse = await app.request('/api/v1/accommodations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          name: 'Hotel',
          city: 'BA'
        })
      });

      const created = await createResponse.json();

      // Get by id
      const response = await app.request(
        `/api/v1/accommodations/${created.id}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Hotel');
    });

    it('should return 404 for non-existent id', async () => {
      const response = await app.request(
        '/api/v1/accommodations/non-existent-id'
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/accommodations', () => {
    it('should list accommodations', async () => {
      const response = await app.request('/api/v1/accommodations');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.request(
        '/api/v1/accommodations?page=1&pageSize=10'
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.pageSize).toBe(10);
    });

    it('should support filtering', async () => {
      const response = await app.request(
        '/api/v1/accommodations?city=Buenos Aires'
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.items.every(item => item.city === 'Buenos Aires')).toBe(true);
    });
  });

  describe('PUT /api/v1/accommodations/:id', () => {
    it('should update accommodation', async () => {
      // Create
      const createResponse = await app.request('/api/v1/accommodations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          name: 'Hotel',
          city: 'BA'
        })
      });

      const created = await createResponse.json();

      // Update
      const response = await app.request(
        `/api/v1/accommodations/${created.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify({
            name: 'Updated Hotel'
          })
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Hotel');
    });

    it('should require authentication', async () => {
      const response = await app.request('/api/v1/accommodations/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Updated'
        })
      });

      expect(response.status).toBe(401);
    });
  });
});
```

### Database Transactions

```typescript
describe('Transaction Integration', () => {
  it('should rollback on error', async () => {
    const service = new BookingService();

    // Mock payment service to fail
    const mockPaymentService = {
      charge: vi.fn().mockRejectedValue(new Error('Payment failed'))
    };

    service.setPaymentService(mockPaymentService);

    // Try to create booking with payment
    try {
      await service.createBookingWithPayment({
        accommodationId: 'acc-1',
        userId: 'user-1',
        checkIn: '2024-01-01',
        checkOut: '2024-01-05'
      });
    } catch (error) {
      // Expected to fail
    }

    // Verify booking was rolled back
    const bookings = await db.select().from(bookingsTable);
    expect(bookings).toHaveLength(0);
  });

  it('should commit on success', async () => {
    const service = new BookingService();

    // Mock payment service to succeed
    const mockPaymentService = {
      charge: vi.fn().mockResolvedValue({ success: true, id: 'pay-1' })
    };

    service.setPaymentService(mockPaymentService);

    // Create booking with payment
    const result = await service.createBookingWithPayment({
      accommodationId: 'acc-1',
      userId: 'user-1',
      checkIn: '2024-01-01',
      checkOut: '2024-01-05'
    });

    expect(result.success).toBe(true);

    // Verify both booking and payment were saved
    const bookings = await db.select().from(bookingsTable);
    expect(bookings).toHaveLength(1);

    const payments = await db.select().from(paymentsTable);
    expect(payments).toHaveLength(1);
  });
});
```

## Test Database Setup

### In-Memory Database

Fast integration tests with SQLite in-memory:

```typescript
// test/utils/test-db.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@repo/db/schema';

let testDb: ReturnType<typeof drizzle>;
let sqlite: Database.Database;

export async function setupTestDatabase() {
  // Create in-memory SQLite database
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });

  // Run migrations
  await migrate(testDb, {
    migrationsFolder: './drizzle/migrations'
  });

  // Set as global db
  global.db = testDb;

  return testDb;
}

export async function cleanupTestDatabase() {
  if (sqlite) {
    sqlite.close();
  }
}

export async function clearAllTables() {
  // Clear all tables in correct order (respecting foreign keys)
  await testDb.delete(bookingsTable);
  await testDb.delete(accommodationsTable);
  await testDb.delete(destinationsTable);
  await testDb.delete(usersTable);
}
```

### Test Data Isolation

Ensure each test starts with clean state:

```typescript
describe('AccommodationService', () => {
  let service: AccommodationService;

  beforeAll(async () => {
    await setupTestDatabase();
    service = new AccommodationService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  // Clear data before each test
  beforeEach(async () => {
    await clearAllTables();
  });

  it('should find accommodations', async () => {
    // This test starts with empty database
    await service.create({ name: 'Hotel 1' });
    await service.create({ name: 'Hotel 2' });

    const results = await service.findAll();
    expect(results).toHaveLength(2);
  });

  it('should handle empty database', async () => {
    // This test also starts with empty database
    const results = await service.findAll();
    expect(results).toHaveLength(0);
  });
});
```

### Database Fixtures

Create reusable test data:

```typescript
// test/fixtures/accommodations.ts
export async function createTestAccommodation(
  overrides: Partial<CreateAccommodationData> = {}
) {
  const service = new AccommodationService();

  return await service.create({
    name: 'Test Hotel',
    city: 'Test City',
    address: '123 Test St',
    pricePerNight: 100,
    maxGuests: 2,
    ...overrides
  });
}

export async function createTestUser(
  overrides: Partial<CreateUserData> = {}
) {
  const service = new UserService();

  return await service.create({
    email: 'test@example.com',
    name: 'Test User',
    ...overrides
  });
}

// Usage in tests
describe('BookingService', () => {
  it('should create booking', async () => {
    const accommodation = await createTestAccommodation({
      pricePerNight: 150
    });

    const user = await createTestUser();

    const result = await bookingService.create({
      accommodationId: accommodation.id,
      userId: user.id,
      checkIn: '2024-01-01',
      checkOut: '2024-01-05'
    });

    expect(result.success).toBe(true);
  });
});
```

## Mocking External Services

### Mock HTTP Clients with MSW

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('https://api.payment.com/charge', () => {
    return HttpResponse.json({
      success: true,
      transactionId: 'txn_123',
      amount: 100
    });
  }),

  http.post('https://api.email.com/send', () => {
    return HttpResponse.json({
      success: true,
      messageId: 'msg_123'
    });
  })
];

// test/setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// test/services/payment.integration.test.ts
describe('PaymentService Integration', () => {
  it('should process payment', async () => {
    const service = new PaymentService();

    const result = await service.charge({
      amount: 100,
      currency: 'USD',
      customerId: 'cust_123'
    });

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('txn_123');
  });

  it('should handle payment failure', async () => {
    // Override handler for this test
    server.use(
      http.post('https://api.payment.com/charge', () => {
        return HttpResponse.json(
          { error: 'Insufficient funds' },
          { status: 400 }
        );
      })
    );

    const service = new PaymentService();
    const result = await service.charge({
      amount: 100,
      currency: 'USD'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient funds');
  });
});
```

### Mock Email Service

```typescript
describe('UserService Integration', () => {
  let service: UserService;
  let mockEmailService: vi.Mocked<EmailService>;

  beforeEach(() => {
    mockEmailService = {
      send: vi.fn().mockResolvedValue({ success: true }),
      sendTemplate: vi.fn().mockResolvedValue({ success: true })
    } as any;

    service = new UserService(mockEmailService);
  });

  it('should send welcome email on registration', async () => {
    const result = await service.register({
      email: 'user@example.com',
      name: 'Test User',
      password: 'password123'
    });

    expect(result.success).toBe(true);

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
      name: 'Test User',
      password: 'password123'
    });

    // Should still create user
    expect(result.success).toBe(true);

    // But log the error
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send welcome email',
      expect.any(Error)
    );
  });
});
```

## Testing Middleware Stack

```typescript
describe('Middleware Integration', () => {
  let app: Hono;

  beforeAll(() => {
    app = createApp();
  });

  it('should apply security headers', async () => {
    const response = await app.request('/api/v1/accommodations');

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  });

  it('should apply CORS headers', async () => {
    const response = await app.request('/api/v1/accommodations', {
      headers: {
        'Origin': 'https://hospeda.com'
      }
    });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://hospeda.com'
    );
  });

  it('should apply rate limiting', async () => {
    const requests = [];

    // Make 100 requests
    for (let i = 0; i < 100; i++) {
      requests.push(app.request('/api/v1/accommodations'));
    }

    const responses = await Promise.all(requests);

    // Some should be rate limited
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should authenticate requests', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Hotel'
      })
    });

    expect(response.status).toBe(401);
  });

  it('should validate request body', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        // Missing required fields
      })
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Testing Complex Workflows

### Multi-Step Process

```typescript
describe('Booking Workflow', () => {
  it('should complete full booking process', async () => {
    // Step 1: Create accommodation
    const accommodation = await accommodationService.create({
      name: 'Hotel Paradise',
      city: 'BA',
      pricePerNight: 100
    });

    expect(accommodation.success).toBe(true);

    // Step 2: Create user
    const user = await userService.register({
      email: 'user@example.com',
      name: 'Test User',
      password: 'password123'
    });

    expect(user.success).toBe(true);

    // Step 3: Create booking
    const booking = await bookingService.create({
      accommodationId: accommodation.data.id,
      userId: user.data.id,
      checkIn: '2024-01-01',
      checkOut: '2024-01-05',
      guests: 2
    });

    expect(booking.success).toBe(true);
    expect(booking.data.status).toBe('pending');

    // Step 4: Process payment
    const payment = await paymentService.charge({
      bookingId: booking.data.id,
      amount: booking.data.totalPrice,
      currency: 'USD'
    });

    expect(payment.success).toBe(true);

    // Step 5: Confirm booking
    const confirmed = await bookingService.confirm(booking.data.id);

    expect(confirmed.success).toBe(true);
    expect(confirmed.data.status).toBe('confirmed');

    // Step 6: Verify all entities exist
    const savedBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, booking.data.id),
      with: {
        accommodation: true,
        user: true,
        payment: true
      }
    });

    expect(savedBooking).toBeDefined();
    expect(savedBooking.accommodation.id).toBe(accommodation.data.id);
    expect(savedBooking.user.id).toBe(user.data.id);
    expect(savedBooking.payment.id).toBe(payment.data.id);
  });
});
```

### Error Handling Flow

```typescript
describe('Error Recovery Workflow', () => {
  it('should handle and recover from errors', async () => {
    const service = new OrderService();

    // Create order
    const order = await service.create({
      items: [{ productId: 'prod-1', quantity: 2 }]
    });

    expect(order.success).toBe(true);

    // Simulate payment failure
    mockPaymentService.charge.mockRejectedValue(
      new Error('Payment failed')
    );

    // Try to process order
    const processed = await service.process(order.data.id);

    expect(processed.success).toBe(false);
    expect(processed.error.code).toBe('PAYMENT_FAILED');

    // Order should be marked as failed
    const savedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, order.data.id)
    });

    expect(savedOrder.status).toBe('failed');
    expect(savedOrder.failureReason).toBe('Payment failed');

    // Retry with working payment
    mockPaymentService.charge.mockResolvedValue({
      success: true,
      id: 'pay-1'
    });

    const retried = await service.retry(order.data.id);

    expect(retried.success).toBe(true);

    // Order should be confirmed
    const retriedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, order.data.id)
    });

    expect(retriedOrder.status).toBe('confirmed');
  });
});
```

## Testing Error Scenarios

### Database Errors

```typescript
describe('AccommodationService Error Handling', () => {
  it('should handle database connection error', async () => {
    // Simulate connection loss
    vi.spyOn(db, 'select').mockRejectedValue(
      new Error('Connection lost')
    );

    const service = new AccommodationService();

    await expect(service.findAll())
      .rejects
      .toThrow('Connection lost');
  });

  it('should handle constraint violation', async () => {
    const service = new AccommodationService();

    // Create with unique slug
    await service.create({
      name: 'Hotel',
      slug: 'hotel',
      city: 'BA'
    });

    // Try to create with same slug
    const result = await service.create({
      name: 'Another Hotel',
      slug: 'hotel',
      city: 'BA'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('DUPLICATE_SLUG');
  });

  it('should handle foreign key violation', async () => {
    const bookingService = new BookingService();

    // Try to create booking with non-existent accommodation
    const result = await bookingService.create({
      accommodationId: 'non-existent',
      userId: 'user-1',
      checkIn: '2024-01-01',
      checkOut: '2024-01-05'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('FOREIGN_KEY_VIOLATION');
  });
});
```

### Service Errors

```typescript
describe('External Service Errors', () => {
  it('should handle payment service timeout', async () => {
    mockPaymentService.charge.mockImplementation(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    );

    const service = new BookingService();

    const result = await service.createBookingWithPayment({
      accommodationId: 'acc-1',
      userId: 'user-1',
      checkIn: '2024-01-01',
      checkOut: '2024-01-05'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('PAYMENT_TIMEOUT');
  });

  it('should handle email service failure', async () => {
    mockEmailService.send.mockRejectedValue(
      new Error('Email service down')
    );

    const service = new UserService();

    // Should still register user
    const result = await service.register({
      email: 'user@example.com',
      name: 'User'
    });

    expect(result.success).toBe(true);

    // But should log error
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send welcome email',
      expect.any(Error)
    );
  });
});
```

## Performance Testing

```typescript
describe('Performance', () => {
  it('should handle bulk creation efficiently', async () => {
    const service = new AccommodationService();

    const items = Array.from({ length: 100 }, (_, i) => ({
      name: `Hotel ${i}`,
      city: 'Buenos Aires',
      pricePerNight: 100 + i
    }));

    const start = performance.now();

    const results = await service.createMany(items);

    const duration = performance.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(1000); // < 1 second for 100 items
  });

  it('should handle complex queries efficiently', async () => {
    const service = new AccommodationService();

    // Create test data
    for (let i = 0; i < 50; i++) {
      await service.create({
        name: `Hotel ${i}`,
        city: i % 2 === 0 ? 'BA' : 'Cordoba',
        pricePerNight: 100 + i
      });
    }

    const start = performance.now();

    const results = await service.search({
      city: 'BA',
      minPrice: 100,
      maxPrice: 150,
      orderBy: 'pricePerNight',
      page: 1,
      pageSize: 10
    });

    const duration = performance.now() - start;

    expect(results.items).toBeDefined();
    expect(duration).toBeLessThan(500); // < 500ms for complex query
  });
});
```

## Best Practices

### DO ✅

```typescript
// Use real database (test instance)
beforeAll(async () => {
  await setupTestDatabase();
});

// Mock external services only
const mockPaymentService = {
  charge: vi.fn().mockResolvedValue({ success: true })
};

// Test realistic scenarios
it('should complete booking workflow', async () => {
  // Real service + real DB + mocked payment
});

// Verify database state
const saved = await db.select().from(table);
expect(saved).toHaveLength(1);

// Clean up after each test
beforeEach(async () => {
  await clearAllTables();
});

// Test error handling
it('should handle payment failure', async () => {
  mockPaymentService.charge.mockRejectedValue(new Error('Failed'));
  // ...
});

// Test transactions
it('should rollback on error', async () => {
  // Verify rollback worked
});
```

### DON'T ❌

```typescript
// Mock database in integration tests
vi.mock('@repo/db'); // Don't do this!

// Share database state between tests
let accommodation: Accommodation; // Don't do this!

it('creates', async () => {
  accommodation = await service.create(data);
});

it('updates', async () => {
  await service.update(accommodation.id, data); // Depends on previous!
});

// Test with production data
await connectToProductionDb(); // Never!

// Skip cleanup
// No afterEach cleanup = tests interfere with each other

// Ignore performance
// Integration tests can be slow, but not > 3s

// Test implementation details
expect(service['_privateMethod']).toHaveBeenCalled(); // Don't!
```

## Common Patterns

### Service Integration Template

```typescript
describe('ServiceName Integration', () => {
  let service: ServiceName;

  beforeAll(async () => {
    await setupTestDatabase();
    service = new ServiceName();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables();
  });

  describe('method', () => {
    it('should work with database', async () => {
      // Test with real DB
    });
  });
});
```

### API Integration Template

```typescript
describe('API Endpoint Integration', () => {
  let app: Hono;

  beforeAll(async () => {
    await setupTestDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /endpoint', () => {
    it('should handle request', async () => {
      const response = await app.request('/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      expect(response.status).toBe(201);
    });
  });
});
```

## Next Steps

- [E2E Testing](./e2e-testing.md) - Full system testing
- [Test Factories](./test-factories.md) - Generating test data
- [Mocking Strategies](./mocking.md) - Advanced mocking

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Testing Strategy](./strategy.md)
- [Unit Testing](./unit-testing.md)
