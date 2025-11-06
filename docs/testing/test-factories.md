# Test Factories

## Overview

Test factories are **reusable test data generators** that create consistent, realistic test objects. They follow the Factory pattern to produce test data with sensible defaults while allowing customization for specific test scenarios.

**Benefits**:

- **DRY Principle**: Define test data once, reuse everywhere
- **Maintainability**: Change data structure in one place
- **Consistency**: All tests use same base data
- **Flexibility**: Easy customization per test
- **Readability**: Clear, descriptive test data creation

## Why Use Factories?

### Without Factories ❌

```typescript
describe('BookingService', () => {
  it('should create booking', async () => {
    // Duplicate setup in every test
    const accommodation = await db.insert(accommodations).values({
      id: 'acc-1',
      name: 'Hotel Paradise',
      slug: 'hotel-paradise',
      city: 'Buenos Aires',
      address: '123 Main St',
      pricePerNight: 100,
      maxGuests: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const user = await db.insert(users).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Actual test
    const booking = await bookingService.create({
      accommodationId: 'acc-1',
      userId: 'user-1',
      checkIn: '2024-01-01',
      checkOut: '2024-01-05'
    });

    expect(booking.success).toBe(true);
  });

  it('should calculate price', async () => {
    // Duplicate setup again!
    const accommodation = await db.insert(accommodations).values({
      id: 'acc-2',
      name: 'Hotel Paradise',
      slug: 'hotel-paradise-2',
      city: 'Buenos Aires',
      // ... all fields again
    });

    // ...
  });
});
```

### With Factories ✅

```typescript
describe('BookingService', () => {
  it('should create booking', async () => {
    // Clean, concise setup
    const accommodation = await createAccommodation();
    const user = await createUser();

    const booking = await bookingService.create({
      accommodationId: accommodation.id,
      userId: user.id,
      checkIn: '2024-01-01',
      checkOut: '2024-01-05'
    });

    expect(booking.success).toBe(true);
  });

  it('should calculate price', async () => {
    // Easy customization
    const accommodation = await createAccommodation({
      pricePerNight: 150
    });

    // ...
  });
});
```

## Factory Patterns

### Simple Factory Function

```typescript
// test/factories/accommodation.factory.ts
let accommodationSequence = 0;

export function buildAccommodation(
  overrides: Partial<Accommodation> = {}
): Accommodation {
  const seq = ++accommodationSequence;

  return {
    id: `acc-${seq}`,
    name: `Hotel ${seq}`,
    slug: `hotel-${seq}`,
    city: 'Buenos Aires',
    address: `${seq} Main Street`,
    description: 'A beautiful accommodation',
    pricePerNight: 100,
    maxGuests: 2,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides
  };
}

// Usage
const accommodation = buildAccommodation();
const expensiveHotel = buildAccommodation({ pricePerNight: 500 });
const cabin = buildAccommodation({ name: 'Mountain Cabin', city: 'Bariloche' });
```

### Base Factory Class

```typescript
// test/factories/base.factory.ts
export abstract class BaseFactory<T> {
  private sequence = 0;

  /**
   * Define default values for the entity
   */
  protected abstract defaults(): Partial<T>;

  /**
   * Generate next sequence number
   */
  protected nextSequence(): number {
    return ++this.sequence;
  }

  /**
   * Build a single entity
   */
  build(overrides: Partial<T> = {}): T {
    return {
      ...this.defaults(),
      ...overrides
    } as T;
  }

  /**
   * Build multiple entities
   */
  buildMany(count: number, overrides: Partial<T> = {}): T[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }

  /**
   * Build with specific index
   */
  buildAt(index: number, overrides: Partial<T> = {}): T {
    const originalSeq = this.sequence;
    this.sequence = index - 1;
    const entity = this.build(overrides);
    this.sequence = originalSeq;
    return entity;
  }

  /**
   * Reset sequence counter
   */
  reset(): void {
    this.sequence = 0;
  }
}
```

### Entity Factory Implementation

```typescript
// test/factories/accommodation.factory.ts
import { BaseFactory } from './base.factory';
import type { Accommodation } from '@repo/db/schema';

export class AccommodationFactory extends BaseFactory<Accommodation> {
  protected defaults(): Partial<Accommodation> {
    const seq = this.nextSequence();

    return {
      id: `acc-${seq}`,
      name: `Hotel ${seq}`,
      slug: `hotel-${seq}`,
      city: 'Buenos Aires',
      address: `${seq} Main Street`,
      description: 'A beautiful accommodation with great amenities',
      pricePerNight: 100,
      maxGuests: 2,
      isActive: true,
      featured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
  }

  /**
   * Create featured accommodation
   */
  featured(): this {
    return this.with({ featured: true });
  }

  /**
   * Create inactive accommodation
   */
  inactive(): this {
    return this.with({ isActive: false });
  }

  /**
   * Create soft-deleted accommodation
   */
  deleted(): this {
    return this.with({ deletedAt: new Date() });
  }

  /**
   * Set custom price
   */
  withPrice(price: number): this {
    return this.with({ pricePerNight: price });
  }

  /**
   * Set custom city
   */
  inCity(city: string): this {
    return this.with({ city });
  }

  /**
   * Add custom attributes
   */
  private with(overrides: Partial<Accommodation>): this {
    const current = this.build();
    const updated = { ...current, ...overrides };
    this.build = () => updated as Accommodation;
    return this;
  }
}

// Usage
const factory = new AccommodationFactory();

const basic = factory.build();
const featured = factory.featured().build();
const expensive = factory.withPrice(500).build();
const bariloche = factory.inCity('Bariloche').build();
const multiple = factory.buildMany(5);
```

## Builder Pattern Factory

```typescript
// test/factories/accommodation.builder.ts
export class AccommodationBuilder {
  private accommodation: Partial<Accommodation> = {};
  private static sequence = 0;

  constructor() {
    const seq = ++AccommodationBuilder.sequence;

    this.accommodation = {
      id: `acc-${seq}`,
      name: `Hotel ${seq}`,
      slug: `hotel-${seq}`,
      city: 'Buenos Aires',
      address: `${seq} Main Street`,
      description: 'A beautiful accommodation',
      pricePerNight: 100,
      maxGuests: 2,
      isActive: true,
      featured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
  }

  withName(name: string): this {
    this.accommodation.name = name;
    this.accommodation.slug = name.toLowerCase().replace(/\s+/g, '-');
    return this;
  }

  withSlug(slug: string): this {
    this.accommodation.slug = slug;
    return this;
  }

  withCity(city: string): this {
    this.accommodation.city = city;
    return this;
  }

  withPrice(price: number): this {
    this.accommodation.pricePerNight = price;
    return this;
  }

  withMaxGuests(maxGuests: number): this {
    this.accommodation.maxGuests = maxGuests;
    return this;
  }

  featured(): this {
    this.accommodation.featured = true;
    return this;
  }

  inactive(): this {
    this.accommodation.isActive = false;
    return this;
  }

  deleted(): this {
    this.accommodation.deletedAt = new Date();
    return this;
  }

  build(): Accommodation {
    return this.accommodation as Accommodation;
  }

  static reset(): void {
    AccommodationBuilder.sequence = 0;
  }
}

// Usage with fluent API
const accommodation = new AccommodationBuilder()
  .withName('Beach Hotel')
  .withCity('Mar del Plata')
  .withPrice(200)
  .featured()
  .build();
```

## Factory with Database Persistence

```typescript
// test/factories/accommodation.factory.ts
import { db } from '@repo/db';
import { accommodations } from '@repo/db/schema';
import type { Accommodation } from '@repo/db/schema';

export class AccommodationFactory extends BaseFactory<Accommodation> {
  protected defaults(): Partial<Accommodation> {
    const seq = this.nextSequence();

    return {
      id: `acc-${seq}`,
      name: `Hotel ${seq}`,
      slug: `hotel-${seq}`,
      city: 'Buenos Aires',
      pricePerNight: 100,
      maxGuests: 2,
      isActive: true
    };
  }

  /**
   * Build without saving to database
   */
  build(overrides: Partial<Accommodation> = {}): Accommodation {
    return super.build(overrides);
  }

  /**
   * Build and save to database
   */
  async create(overrides: Partial<Accommodation> = {}): Promise<Accommodation> {
    const accommodation = this.build(overrides);

    const [saved] = await db
      .insert(accommodations)
      .values(accommodation)
      .returning();

    return saved;
  }

  /**
   * Create multiple and save to database
   */
  async createMany(
    count: number,
    overrides: Partial<Accommodation> = {}
  ): Promise<Accommodation[]> {
    const items = this.buildMany(count, overrides);

    const saved = await db
      .insert(accommodations)
      .values(items)
      .returning();

    return saved;
  }
}

// Usage
const factory = new AccommodationFactory();

// In-memory only
const accommodation = factory.build();

// Saved to database
const saved = await factory.create({ name: 'Real Hotel' });

// Multiple saved to database
const multiple = await factory.createMany(10);
```

## Factory with Relationships

```typescript
// test/factories/booking.factory.ts
import { BaseFactory } from './base.factory';
import { AccommodationFactory } from './accommodation.factory';
import { UserFactory } from './user.factory';
import type { Booking } from '@repo/db/schema';

export class BookingFactory extends BaseFactory<Booking> {
  private accommodationFactory = new AccommodationFactory();
  private userFactory = new UserFactory();

  protected defaults(): Partial<Booking> {
    const seq = this.nextSequence();

    return {
      id: `booking-${seq}`,
      accommodationId: `acc-${seq}`,
      userId: `user-${seq}`,
      checkIn: new Date('2024-01-01'),
      checkOut: new Date('2024-01-05'),
      guests: 2,
      totalPrice: 400,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create booking with related entities
   */
  async createWithRelations(
    overrides: Partial<Booking> = {}
  ): Promise<{
    booking: Booking;
    accommodation: Accommodation;
    user: User;
  }> {
    // Create related entities
    const accommodation = await this.accommodationFactory.create();
    const user = await this.userFactory.create();

    // Create booking with foreign keys
    const booking = await this.create({
      accommodationId: accommodation.id,
      userId: user.id,
      ...overrides
    });

    return {
      booking,
      accommodation,
      user
    };
  }

  /**
   * Create booking with existing accommodation
   */
  async withAccommodation(
    accommodation: Accommodation,
    overrides: Partial<Booking> = {}
  ): Promise<Booking> {
    const user = await this.userFactory.create();

    return await this.create({
      accommodationId: accommodation.id,
      userId: user.id,
      ...overrides
    });
  }

  /**
   * Create confirmed booking
   */
  async createConfirmed(
    overrides: Partial<Booking> = {}
  ): Promise<Booking> {
    return await this.create({
      status: 'confirmed',
      ...overrides
    });
  }
}

// Usage
const bookingFactory = new BookingFactory();

// Create with all relations
const { booking, accommodation, user } = await bookingFactory.createWithRelations();

// Create with existing accommodation
const hotel = await new AccommodationFactory().create();
const booking = await bookingFactory.withAccommodation(hotel);

// Create confirmed booking
const confirmed = await bookingFactory.createConfirmed();
```

## Factory Traits

```typescript
// test/factories/user.factory.ts
export class UserFactory extends BaseFactory<User> {
  protected defaults(): Partial<User> {
    const seq = this.nextSequence();

    return {
      id: `user-${seq}`,
      email: `user${seq}@example.com`,
      name: `User ${seq}`,
      role: 'user',
      isActive: true,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Trait: Admin user
   */
  admin(): this {
    return this.with({ role: 'admin' });
  }

  /**
   * Trait: Verified user
   */
  verified(): this {
    return this.with({ emailVerified: true });
  }

  /**
   * Trait: Inactive user
   */
  inactive(): this {
    return this.with({ isActive: false });
  }

  /**
   * Trait: Guest user (minimal permissions)
   */
  guest(): this {
    return this.with({ role: 'guest', emailVerified: false });
  }

  /**
   * Trait: Premium user
   */
  premium(): this {
    return this.with({
      role: 'premium',
      emailVerified: true,
      isActive: true
    });
  }

  /**
   * Combine traits
   */
  private with(overrides: Partial<User>): this {
    const factory = new UserFactory();
    factory.build = () => ({ ...this.build(), ...overrides }) as User;
    return factory as this;
  }
}

// Usage
const userFactory = new UserFactory();

const regularUser = userFactory.build();
const adminUser = userFactory.admin().build();
const verifiedUser = userFactory.verified().build();
const premiumUser = userFactory.premium().build();
const inactiveAdmin = userFactory.admin().inactive().build();
```

## Factory Sequences

```typescript
// test/factories/sequences.ts
class Sequence {
  private value = 0;

  next(): number {
    return ++this.value;
  }

  reset(): void {
    this.value = 0;
  }
}

const sequences = {
  accommodation: new Sequence(),
  user: new Sequence(),
  booking: new Sequence()
};

export function nextAccommodationId(): string {
  return `acc-${sequences.accommodation.next()}`;
}

export function nextUserId(): string {
  return `user-${sequences.user.next()}`;
}

export function nextBookingId(): string {
  return `booking-${sequences.booking.next()}`;
}

export function nextEmail(): string {
  return `user${sequences.user.next()}@example.com`;
}

export function resetSequences(): void {
  Object.values(sequences).forEach(seq => seq.reset());
}

// Usage in factories
export class UserFactory extends BaseFactory<User> {
  protected defaults(): Partial<User> {
    return {
      id: nextUserId(),
      email: nextEmail(),
      name: `User ${sequences.user.next()}`,
      // ...
    };
  }
}
```

## Factory Registry

```typescript
// test/factories/registry.ts
import { AccommodationFactory } from './accommodation.factory';
import { UserFactory } from './user.factory';
import { BookingFactory } from './booking.factory';
import { DestinationFactory } from './destination.factory';

class FactoryRegistry {
  private static instance: FactoryRegistry;
  private factories = new Map<string, BaseFactory<any>>();

  private constructor() {
    this.register('accommodation', new AccommodationFactory());
    this.register('user', new UserFactory());
    this.register('booking', new BookingFactory());
    this.register('destination', new DestinationFactory());
  }

  static getInstance(): FactoryRegistry {
    if (!FactoryRegistry.instance) {
      FactoryRegistry.instance = new FactoryRegistry();
    }
    return FactoryRegistry.instance;
  }

  register<T>(name: string, factory: BaseFactory<T>): void {
    this.factories.set(name, factory);
  }

  get<T>(name: string): BaseFactory<T> {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Factory not found: ${name}`);
    }
    return factory;
  }

  resetAll(): void {
    this.factories.forEach(factory => factory.reset());
  }
}

export const factoryRegistry = FactoryRegistry.getInstance();

// Helper functions
export function factory<T>(name: string): BaseFactory<T> {
  return factoryRegistry.get<T>(name);
}

// Usage
const accommodation = factory<Accommodation>('accommodation').build();
const user = factory<User>('user').build();
```

## Advanced Factory Patterns

### Factory with Callbacks

```typescript
export class AccommodationFactory extends BaseFactory<Accommodation> {
  private afterBuildCallbacks: Array<(entity: Accommodation) => void> = [];

  protected defaults(): Partial<Accommodation> {
    // ... defaults
  }

  afterBuild(callback: (entity: Accommodation) => void): this {
    this.afterBuildCallbacks.push(callback);
    return this;
  }

  build(overrides: Partial<Accommodation> = {}): Accommodation {
    const entity = super.build(overrides);

    // Execute callbacks
    this.afterBuildCallbacks.forEach(callback => callback(entity));

    return entity;
  }
}

// Usage
const factory = new AccommodationFactory();

const accommodation = factory
  .afterBuild(entity => {
    console.log(`Created: ${entity.name}`);
  })
  .build();
```

### Factory with Associations

```typescript
export class BookingFactory extends BaseFactory<Booking> {
  private _accommodation?: Accommodation;
  private _user?: User;

  forAccommodation(accommodation: Accommodation): this {
    this._accommodation = accommodation;
    return this;
  }

  forUser(user: User): this {
    this._user = user;
    return this;
  }

  async create(overrides: Partial<Booking> = {}): Promise<Booking> {
    // Create associations if not provided
    if (!this._accommodation) {
      this._accommodation = await new AccommodationFactory().create();
    }

    if (!this._user) {
      this._user = await new UserFactory().create();
    }

    return super.create({
      accommodationId: this._accommodation.id,
      userId: this._user.id,
      ...overrides
    });
  }
}

// Usage
const hotel = await new AccommodationFactory().create();
const user = await new UserFactory().create();

const booking = await new BookingFactory()
  .forAccommodation(hotel)
  .forUser(user)
  .create();
```

## Factory Testing Utilities

```typescript
// test/factories/utils.ts
import { factoryRegistry } from './registry';

/**
 * Create test scenario with multiple entities
 */
export async function createBookingScenario() {
  const accommodation = await factory<Accommodation>('accommodation').create({
    pricePerNight: 100
  });

  const user = await factory<User>('user').create({
    emailVerified: true
  });

  const booking = await factory<Booking>('booking').create({
    accommodationId: accommodation.id,
    userId: user.id,
    checkIn: '2024-01-01',
    checkOut: '2024-01-05',
    totalPrice: 400
  });

  return { accommodation, user, booking };
}

/**
 * Clean up all test data
 */
export async function cleanupFactories() {
  await db.delete(bookings);
  await db.delete(accommodations);
  await db.delete(users);
  factoryRegistry.resetAll();
}

/**
 * Seed database with test data
 */
export async function seedTestData() {
  // Create destinations
  const destinations = await factory<Destination>('destination').createMany(5);

  // Create accommodations in each destination
  for (const destination of destinations) {
    await factory<Accommodation>('accommodation').createMany(10, {
      destinationId: destination.id
    });
  }

  // Create users
  await factory<User>('user').createMany(20);

  return { destinations };
}
```

## Using Factories in Tests

### Unit Tests

```typescript
// test/services/booking.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingService } from '../../src/services/booking.service';
import { AccommodationFactory } from '../factories/accommodation.factory';
import { UserFactory } from '../factories/user.factory';

describe('BookingService', () => {
  let service: BookingService;
  let mockModel: vi.Mocked<BookingModel>;

  beforeEach(() => {
    mockModel = {
      create: vi.fn(),
      findById: vi.fn()
    } as any;

    service = new BookingService(mockModel);
  });

  it('should calculate total price', async () => {
    // Arrange: Use factories for test data
    const accommodation = new AccommodationFactory().build({
      pricePerNight: 100
    });

    const user = new UserFactory().build();

    // Act
    const result = await service.calculatePrice({
      accommodation,
      checkIn: '2024-01-01',
      checkOut: '2024-01-05',
      guests: 2
    });

    // Assert
    expect(result).toBe(400); // 4 nights * $100
  });
});
```

### Integration Tests

```typescript
// test/services/booking.service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BookingService } from '../../src/services/booking.service';
import { setupTestDatabase, cleanupTestDatabase } from '../utils/test-db';
import { AccommodationFactory } from '../factories/accommodation.factory';
import { UserFactory } from '../factories/user.factory';

describe('BookingService Integration', () => {
  let service: BookingService;
  let accommodationFactory: AccommodationFactory;
  let userFactory: UserFactory;

  beforeAll(async () => {
    await setupTestDatabase();
    service = new BookingService();
    accommodationFactory = new AccommodationFactory();
    userFactory = new UserFactory();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await cleanupFactories();
  });

  it('should create booking with database', async () => {
    // Arrange: Create real entities in database
    const accommodation = await accommodationFactory.create({
      pricePerNight: 150
    });

    const user = await userFactory.create();

    // Act
    const result = await service.create({
      accommodationId: accommodation.id,
      userId: user.id,
      checkIn: '2024-01-01',
      checkOut: '2024-01-05',
      guests: 2
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.totalPrice).toBe(600); // 4 nights * $150
  });
});
```

### E2E Tests

```typescript
// e2e/tests/booking.spec.ts
import { test, expect } from '@playwright/test';
import { AccommodationFactory } from '../factories/accommodation.factory';
import { UserFactory } from '../factories/user.factory';

test.describe('Booking Flow', () => {
  let accommodationFactory: AccommodationFactory;
  let userFactory: UserFactory;

  test.beforeEach(async () => {
    accommodationFactory = new AccommodationFactory();
    userFactory = new UserFactory();
  });

  test('should complete booking', async ({ page }) => {
    // Arrange: Create test data
    const accommodation = await accommodationFactory.create({
      name: 'Test Hotel',
      pricePerNight: 100
    });

    const user = await userFactory.create({
      email: 'e2e@example.com',
      emailVerified: true
    });

    // Act: Perform booking flow
    await page.goto(`/accommodations/${accommodation.id}`);

    await page.fill('[data-testid="checkin"]', '2024-01-01');
    await page.fill('[data-testid="checkout"]', '2024-01-05');
    await page.click('[data-testid="book-button"]');

    // Assert
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
```

## Best Practices

### DO ✅

```typescript
// Use descriptive factory methods
const featured = new AccommodationFactory().featured().build();
const inactive = new AccommodationFactory().inactive().build();

// Chain trait methods
const premiumVerified = new UserFactory().premium().verified().build();

// Create realistic test data
const accommodation = factory.build({
  name: 'Hotel Paradise',
  city: 'Buenos Aires',
  pricePerNight: 100
});

// Use factories consistently
// Don't mix factories and manual object creation
const user = new UserFactory().build(); // ✅
const booking = { userId: user.id, ... }; // ❌ Use BookingFactory

// Reset sequences between test files
beforeEach(() => {
  factoryRegistry.resetAll();
});

// Create related entities together
const { booking, accommodation, user } = await createBookingScenario();
```

### DON'T ❌

```typescript
// Don't hardcode IDs
const user = factory.build({ id: '123' }); // ❌ Use sequences

// Don't create overly complex factories
class SuperComplexFactory extends BaseFactory<Entity> {
  // ... 50 methods
} // ❌ Keep it simple

// Don't mix factory concerns
class AccommodationFactory {
  async sendEmail() { ... } // ❌ Not factory's responsibility
}

// Don't use factories for everything
const simpleString = 'test'; // ✅
const simpleString = new StringFactory().build(); // ❌ Overkill

// Don't create dependencies in defaults
protected defaults() {
  return {
    userId: await createUser() // ❌ Async in defaults
  };
}
```

## Factory Organization

### Project Structure

```text
test/
├── factories/
│   ├── index.ts                 # Export all factories
│   ├── base.factory.ts          # Base factory class
│   ├── registry.ts              # Factory registry
│   ├── sequences.ts             # Sequence generators
│   ├── utils.ts                 # Factory utilities
│   ├── accommodation.factory.ts
│   ├── user.factory.ts
│   ├── booking.factory.ts
│   └── destination.factory.ts
└── utils/
    └── test-db.ts               # Database helpers
```

### Index File

```typescript
// test/factories/index.ts
export { AccommodationFactory } from './accommodation.factory';
export { UserFactory } from './user.factory';
export { BookingFactory } from './booking.factory';
export { DestinationFactory } from './destination.factory';
export { factoryRegistry, factory } from './registry';
export { resetSequences } from './sequences';
export {
  createBookingScenario,
  cleanupFactories,
  seedTestData
} from './utils';

// Convenience exports
export const factories = {
  accommodation: new AccommodationFactory(),
  user: new UserFactory(),
  booking: new BookingFactory(),
  destination: new DestinationFactory()
};
```

## Next Steps

- [Mocking Strategies](./mocking.md) - Advanced mocking techniques
- [Unit Testing](./unit-testing.md) - Using factories in unit tests
- [Integration Testing](./integration-testing.md) - Using factories in integration tests

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Testing Strategy](./strategy.md)
- [Test Organization](../development/test-organization.md)
