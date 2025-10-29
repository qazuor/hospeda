# Web App Testing Skill

## Purpose

Provide comprehensive testing strategy and implementation guidance for web applications using Vitest (unit/integration), React Testing Library, and Playwright (E2E), ensuring 90%+ code coverage and adherence to testing best practices.

---

## Capabilities

- Design test suites (unit, integration, E2E)
- Create test fixtures and mocks
- Implement TDD workflow
- Ensure 90%+ coverage
- Test accessibility compliance
- Test performance benchmarks
- Test security requirements
- Write maintainable, readable tests

---

## Testing Philosophy

### Test Pyramid

```text
        /\
       /E2E\        5-10%  - Critical user journeys
      /------\
     /  Int   \     15-20% - Component interactions
    /----------\
   /    Unit    \   70-80% - Business logic, utilities
  /--------------\
```text

**Distribution:**

- **Unit Tests**: 70-80% - Fast, isolated, focused
- **Integration Tests**: 15-20% - Component interactions, API calls
- **E2E Tests**: 5-10% - Critical user flows

---

## Test Structure: AAA Pattern

Every test should follow **Arrange-Act-Assert**:

```typescript
describe('Feature', () => {
  it('should do something specific', () => {
    // Arrange: Set up test data and conditions
    const input = { value: 42 };
    const expected = 84;

    // Act: Execute the behavior being tested
    const actual = multiplyByTwo(input.value);

    // Assert: Verify the outcome
    expect(actual).toBe(expected);
  });
});
```text

---

## Unit Testing

### Testing Pure Functions

```typescript
// src/utils/price-calculator.ts
export function calculateTotalPrice(input: {
  basePrice: number;
  nights: number;
  cleaningFee: number;
  serviceFeePercent: number;
}): number {
  const subtotal = input.basePrice * input.nights + input.cleaningFee;
  const serviceFee = subtotal * (input.serviceFeePercent / 100);
  return subtotal + serviceFee;
}

// src/utils/price-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateTotalPrice } from './price-calculator';

describe('calculateTotalPrice', () => {
  it('should calculate total with all fees', () => {
    // Arrange
    const input = {
      basePrice: 100,
      nights: 3,
      cleaningFee: 50,
      serviceFeePercent: 10,
    };
    const expected = 385; // (100*3 + 50) * 1.1

    // Act
    const actual = calculateTotalPrice(input);

    // Assert
    expect(actual).toBe(expected);
  });

  it('should handle zero service fee', () => {
    // Arrange
    const input = {
      basePrice: 100,
      nights: 2,
      cleaningFee: 25,
      serviceFeePercent: 0,
    };
    const expected = 225;

    // Act
    const actual = calculateTotalPrice(input);

    // Assert
    expect(actual).toBe(expected);
  });

  it('should handle single night booking', () => {
    // Arrange
    const input = {
      basePrice: 150,
      nights: 1,
      cleaningFee: 30,
      serviceFeePercent: 5,
    };
    const expected = 189; // (150 + 30) * 1.05

    // Act
    const actual = calculateTotalPrice(input);

    // Assert
    expect(actual).toBe(expected);
  });
});
```text

### Testing Services with Mocks

```typescript
// packages/service-core/src/services/accommodation/accommodation.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccommodationService } from './accommodation.service';
import { AccommodationModel } from '@repo/db';
import type { ServiceContext } from '@repo/types';

// Mock the model
vi.mock('@repo/db', () => ({
  AccommodationModel: vi.fn(),
}));

describe('AccommodationService', () => {
  let service: AccommodationService;
  let mockModel: any;
  let mockContext: ServiceContext;

  beforeEach(() => {
    // Arrange: Create mock model
    mockModel = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };

    // Arrange: Create mock context
    mockContext = {
      actor: {
        id: 'user-123',
        role: 'owner',
        permissions: ['accommodation:create'],
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    };

    // Arrange: Create service instance
    service = new AccommodationService(mockContext, mockModel);
  });

  describe('findById', () => {
    it('should return accommodation when found', async () => {
      // Arrange
      const mockAccommodation = {
        id: 'acc-123',
        title: 'Beach House',
        ownerId: 'user-123',
      };
      mockModel.findById.mockResolvedValue(mockAccommodation);
      const input = { id: 'acc-123' };

      // Act
      const result = await service.findById(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAccommodation);
      expect(mockModel.findById).toHaveBeenCalledWith(input);
    });

    it('should return error when not found', async () => {
      // Arrange
      mockModel.findById.mockResolvedValue(null);
      const input = { id: 'nonexistent' };

      // Act
      const result = await service.findById(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle database errors', async () => {
      // Arrange
      mockModel.findById.mockRejectedValue(new Error('DB connection failed'));
      const input = { id: 'acc-123' };

      // Act
      const result = await service.findById(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('create', () => {
    it('should create accommodation when authorized', async () => {
      // Arrange
      const input = {
        title: 'New Beach House',
        description: 'Beautiful house',
        pricePerNight: 150,
        ownerId: 'user-123',
      };
      const mockCreated = { id: 'acc-456', ...input };
      mockModel.create.mockResolvedValue(mockCreated);

      // Act
      const result = await service.create(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreated);
      expect(mockModel.create).toHaveBeenCalledWith(input);
    });

    it('should reject when user lacks permission', async () => {
      // Arrange
      mockContext.actor.permissions = []; // No create permission
      service = new AccommodationService(mockContext, mockModel);
      const input = { title: 'House', ownerId: 'user-123' };

      // Act
      const result = await service.create(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(mockModel.create).not.toHaveBeenCalled();
    });
  });
});
```text

### Testing React Components

```typescript
// components/AccommodationCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  const mockAccommodation = {
    id: 'acc-123',
    title: 'Beach House with Ocean View',
    description: 'Beautiful beach house',
    city: 'Concepción del Uruguay',
    pricePerNight: 150,
    maxGuests: 6,
    images: ['https://example.com/image1.jpg'],
  };

  it('should render accommodation details', () => {
    // Arrange & Act
    render(<AccommodationCard accommodation={mockAccommodation} />);

    // Assert
    expect(screen.getByText('Beach House with Ocean View')).toBeInTheDocument();
    expect(screen.getByText('Concepción del Uruguay')).toBeInTheDocument();
    expect(screen.getByText('$150/noche')).toBeInTheDocument();
    expect(screen.getByText('6 guests')).toBeInTheDocument();
  });

  it('should render image with alt text', () => {
    // Arrange & Act
    render(<AccommodationCard accommodation={mockAccommodation} />);

    // Assert
    const image = screen.getByAltText('Beach House with Ocean View');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', mockAccommodation.images[0]);
  });

  it('should have accessible link', () => {
    // Arrange & Act
    render(<AccommodationCard accommodation={mockAccommodation} />);

    // Assert
    const link = screen.getByRole('link', { name: /ver detalles/i });
    expect(link).toHaveAttribute('href', '/accommodations/acc-123');
  });

  it('should handle missing image gracefully', () => {
    // Arrange
    const noImageAccommodation = {
      ...mockAccommodation,
      images: [],
    };

    // Act
    render(<AccommodationCard accommodation={noImageAccommodation} />);

    // Assert
    const image = screen.getByAltText('Beach House with Ocean View');
    expect(image).toHaveAttribute('src', '/placeholder-accommodation.jpg');
  });
});
```text

---

## Integration Testing

### Testing API Routes

```typescript
// apps/api/src/routes/accommodations/index.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testClient } from 'hono/testing';
import { app } from '../../index';
import { db } from '@repo/db';
import { accommodationTable } from '@repo/db/schemas';

describe('Accommodation API Routes', () => {
  beforeAll(async () => {
    // Setup test database
    await db.execute('BEGIN');
  });

  afterAll(async () => {
    // Cleanup
    await db.execute('ROLLBACK');
  });

  describe('GET /accommodations', () => {
    it('should return list of accommodations', async () => {
      // Arrange: Insert test data
      await db.insert(accommodationTable).values([
        {
          id: 'acc-1',
          title: 'Beach House',
          city: 'Concepción',
          pricePerNight: 150,
        },
        {
          id: 'acc-2',
          title: 'Mountain Cabin',
          city: 'Paraná',
          pricePerNight: 100,
        },
      ]);

      // Act
      const res = await testClient(app).accommodations.$get();

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].title).toBe('Beach House');
    });

    it('should filter by city', async () => {
      // Arrange
      // (data from previous test)

      // Act
      const res = await testClient(app).accommodations.$get({
        query: { city: 'Concepción' },
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].city).toBe('Concepción');
    });

    it('should return 400 for invalid query params', async () => {
      // Act
      const res = await testClient(app).accommodations.$get({
        query: { minPrice: 'invalid' },
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /accommodations', () => {
    it('should create accommodation when authenticated', async () => {
      // Arrange
      const newAccommodation = {
        title: 'New House',
        description: 'Beautiful house',
        city: 'Concepción',
        pricePerNight: 200,
        maxGuests: 4,
      };

      // Act
      const res = await testClient(app).accommodations.$post({
        json: newAccommodation,
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      // Assert
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('New House');
      expect(data.data.id).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const res = await testClient(app).accommodations.$post({
        json: { title: 'House' },
      });

      // Assert
      expect(res.status).toBe(401);
    });

    it('should validate required fields', async () => {
      // Act
      const res = await testClient(app).accommodations.$post({
        json: { title: 'House' }, // Missing required fields
        headers: { Authorization: 'Bearer valid-token' },
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```text

---

## E2E Testing with Playwright

### Critical User Journeys

```typescript
// tests/e2e/booking-flow.test.ts
import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('user can complete full booking', async ({ page }) => {
    // Arrange: Navigate to homepage
    await page.goto('/');

    // Act 1: Search for accommodations
    await page.fill('[aria-label="Search accommodations"]', 'Concepción');
    await page.click('button:has-text("Buscar")');

    // Assert: Search results displayed
    await expect(page.locator('h2')).toContainText('Resultados');
    await expect(page.locator('[data-testid="accommodation-card"]').first()).toBeVisible();

    // Act 2: Select first accommodation
    await page.locator('[data-testid="accommodation-card"]').first().click();

    // Assert: Details page loaded
    await expect(page).toHaveURL(/\/accommodations\/acc-/);
    await expect(page.locator('h1')).toBeVisible();

    // Act 3: Select dates and guests
    await page.fill('[name="check-in"]', '2024-06-01');
    await page.fill('[name="check-out"]', '2024-06-05');
    await page.selectOption('[name="guests"]', '2');

    // Assert: Price calculated
    await expect(page.locator('[data-testid="total-price"]')).toContainText('$');

    // Act 4: Click book button
    await page.click('button:has-text("Reservar")');

    // Assert: Redirected to login (if not authenticated)
    await expect(page).toHaveURL(/\/login/);

    // Act 5: Login
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Assert: Redirected back to booking
    await expect(page).toHaveURL(/\/booking/);

    // Act 6: Confirm booking
    await page.click('button:has-text("Confirmar")');

    // Assert: Success page
    await expect(page.locator('h1')).toContainText('¡Reserva confirmada!');
    await expect(page.locator('[data-testid="booking-id"]')).toBeVisible();
  });

  test('should handle invalid dates', async ({ page }) => {
    // Arrange
    await page.goto('/accommodations/acc-123');

    // Act: Select check-out before check-in
    await page.fill('[name="check-in"]', '2024-06-05');
    await page.fill('[name="check-out"]', '2024-06-01');

    // Assert: Error message displayed
    await expect(page.locator('[role="alert"]')).toContainText(
      'La fecha de salida debe ser posterior'
    );
  });
});
```text

### Accessibility Testing

```typescript
// tests/e2e/accessibility.test.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('homepage is accessible', async ({ page }) => {
    // Arrange
    await page.goto('/');
    await injectAxe(page);

    // Act & Assert
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });

  test('keyboard navigation works', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act: Tab through interactive elements
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Logo
    await page.keyboard.press('Tab'); // Search input
    await page.keyboard.press('Tab'); // Search button

    // Assert: Focus visible
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('BUTTON');
  });
});
```text

---

## Coverage Requirements

### Minimum Coverage: 90%

```bash

# Run tests with coverage

pnpm test:coverage

# View coverage report

open coverage/index.html

# Check coverage thresholds

pnpm test:coverage --reporter=json-summary
```text

**Coverage Configuration:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/test/**',
        '**/dist/**',
      ],
    },
  },
});
```text

---

## TDD Workflow

### Red-Green-Refactor

```typescript
// 1. RED: Write failing test first
describe('formatPrice', () => {
  it('should format price with currency', () => {
    expect(formatPrice(150)).toBe('$150');
  });
});
// Run: FAIL - formatPrice is not defined

// 2. GREEN: Write minimal code to pass
export function formatPrice(price: number): string {
  return `$${price}`;
}
// Run: PASS

// 3. REFACTOR: Improve implementation
export function formatPrice(price: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
  }).format(price);
}
// Run: PASS - update test if needed
```text

---

## Best Practices

###  DO

- Write tests before code (TDD)
- Use descriptive test names
- Follow AAA pattern
- Test edge cases
- Mock external dependencies
- Keep tests isolated
- Use meaningful assertions
- Test user behavior, not implementation

### L DON'T

- Test implementation details
- Share state between tests
- Write flaky tests
- Skip error cases
- Over-mock (mock only what's necessary)
- Write tests that depend on test order
- Ignore accessibility in tests

---

## Deliverables

When this skill is applied, produce:

1. **Test Suite** with 90%+ coverage
2. **Test Fixtures** for reusable test data
3. **Test Helpers** for common operations
4. **E2E Tests** for critical user journeys
5. **Accessibility Tests** with axe-core
6. **Coverage Report** showing threshold compliance

---

**This skill ensures high-quality, well-tested code that is maintainable, reliable, and meets project standards.**

