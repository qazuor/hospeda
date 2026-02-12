---
name: web-app-testing
description: Web application testing strategy covering unit, integration, component, E2E, and accessibility tests. Use when building test suites for web apps.
---

# Web Application Testing

## Purpose

Provide a comprehensive testing strategy for web applications covering unit tests, integration tests, component tests, E2E tests, and accessibility tests. This skill ensures 90%+ code coverage, adherence to the test pyramid, and consistent quality across all frontend and full-stack web layers.

## When to Use

- When building or updating web application features
- When creating new UI components
- When implementing user flows
- When verifying accessibility compliance
- When ensuring cross-browser and responsive behavior

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
```

- **Unit Tests**: 70-80% -- fast, isolated, focused on logic
- **Integration Tests**: 15-20% -- component interactions, API calls
- **E2E Tests**: 5-10% -- critical end-to-end user flows

## Process

### Step 1: Unit Testing

Test pure functions, utilities, and business logic in isolation.

**Example:**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateTotal } from './price-calculator';

describe('calculateTotal', () => {
  it('should calculate total with all fees', () => {
    const input = {
      basePrice: 100,
      quantity: 3,
      taxPercent: 10,
    };

    const result = calculateTotal(input);

    expect(result).toBe(330); // (100 * 3) * 1.1
  });

  it('should handle zero tax', () => {
    const input = { basePrice: 50, quantity: 2, taxPercent: 0 };

    expect(calculateTotal(input)).toBe(100);
  });
});
```

### Step 2: Component Testing

Test UI components in isolation using a testing library.

**Example:**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  const mockProduct = {
    id: 'prod-1',
    title: 'Sample Product',
    price: 29.99,
    image: 'https://example.com/image.jpg',
  };

  it('should render product details', () => {
    render(<ProductCard product={mockProduct} />);

    expect(screen.getByText('Sample Product')).toBeInTheDocument();
    expect(screen.getByText('$29.99')).toBeInTheDocument();
  });

  it('should render image with alt text', () => {
    render(<ProductCard product={mockProduct} />);

    const image = screen.getByAltText('Sample Product');
    expect(image).toHaveAttribute('src', mockProduct.image);
  });

  it('should handle missing image gracefully', () => {
    const noImageProduct = { ...mockProduct, image: '' };
    render(<ProductCard product={noImageProduct} />);

    const image = screen.getByAltText('Sample Product');
    expect(image).toHaveAttribute('src', '/placeholder.jpg');
  });
});
```

### Step 3: Service and Hook Testing

Test services and custom hooks with mocked dependencies.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceService } from './resource.service';

describe('ResourceService', () => {
  let service: ResourceService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      create: vi.fn(),
    };
    service = new ResourceService(mockRepository);
  });

  it('should return resource when found', async () => {
    const mockResource = { id: 'res-1', name: 'Test' };
    mockRepository.findById.mockResolvedValue(mockResource);

    const result = await service.findById('res-1');

    expect(result).toEqual(mockResource);
    expect(mockRepository.findById).toHaveBeenCalledWith('res-1');
  });

  it('should throw NotFoundError when resource missing', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow('NOT_FOUND');
  });
});
```

### Step 4: Integration Testing

Test API routes and component interactions with real or simulated backends.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../index';
import { testDb } from '../helpers/test-db';

describe('Resource API Routes', () => {
  beforeAll(async () => {
    await testDb.seed();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  it('should return a list of resources', async () => {
    const response = await app.request('/api/resources');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toBeInstanceOf(Array);
  });

  it('should reject invalid query parameters', async () => {
    const response = await app.request('/api/resources?page=invalid');

    expect(response.status).toBe(400);
  });
});
```

### Step 5: E2E Testing

Test critical user journeys from start to finish.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('user can complete a purchase', async ({ page }) => {
    await page.goto('/');

    // Search for a product
    await page.fill('[aria-label="Search products"]', 'headphones');
    await page.click('button:has-text("Search")');

    // Select the first result
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
    await page.locator('[data-testid="product-card"]').first().click();

    // Add to cart
    await page.click('button:has-text("Add to Cart")');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    // Proceed to checkout
    await page.click('button:has-text("Checkout")');
    await expect(page).toHaveURL(/\/checkout/);
  });

  test('should handle empty cart gracefully', async ({ page }) => {
    await page.goto('/checkout');

    await expect(page.locator('text=Your cart is empty')).toBeVisible();
  });
});
```

### Step 6: Accessibility Testing

Validate WCAG compliance as part of the test suite.

```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('homepage passes accessibility checks', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    await checkA11y(page, undefined, {
      detailedReport: true,
    });
  });

  test('keyboard navigation works correctly', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeDefined();
  });
});
```

## Test Structure: AAA Pattern

Every test should follow Arrange-Act-Assert:

```typescript
it('should do something specific', () => {
  // Arrange: Set up test data and conditions
  const input = { value: 42 };
  const expected = 84;

  // Act: Execute the behavior under test
  const actual = multiplyByTwo(input.value);

  // Assert: Verify the outcome
  expect(actual).toBe(expected);
});
```

## Coverage Configuration

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
```

## Best Practices

1. **Write tests before code** -- follow TDD where possible
2. **Use descriptive test names** -- names explain expected behavior
3. **Follow the AAA pattern** -- Arrange, Act, Assert
4. **Test edge cases** -- empty inputs, boundary values, error states
5. **Mock external dependencies** -- isolate the unit under test
6. **Keep tests isolated** -- no shared mutable state between tests
7. **Test user behavior, not implementation** -- avoid testing internal details
8. **Do not share state between tests** -- each test sets up its own context
9. **Do not write flaky tests** -- deterministic results every run
10. **Do not skip error cases** -- error paths need coverage too
11. **Include accessibility tests** -- integrate a11y checks into CI
12. **Maintain test data fixtures** -- reusable, realistic test data

## Deliverables

When applying this skill, produce:

1. **Unit test suite** with 90%+ coverage
2. **Component tests** for all UI components
3. **Integration tests** for API and service interactions
4. **E2E tests** for critical user journeys
5. **Accessibility tests** using axe-core or similar
6. **Coverage report** showing threshold compliance
