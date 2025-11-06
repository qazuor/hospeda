# End-to-End Testing

## Overview

End-to-end (E2E) tests verify **complete user flows through the entire system**. They test the application from the user's perspective, ensuring all components work together correctly from frontend to database. E2E tests represent **5% of our test suite**.

**Characteristics**:

- **Speed**: 3-10s per test (30s maximum)
- **Scope**: Full application stack (frontend + API + database)
- **Mocking**: None (real everything)
- **Coverage**: Critical user paths only
- **Tool**: Playwright for browser automation

## What to E2E Test

### Critical User Flows

Test the most important paths through your application:

**Good Candidates** ✅:

- User registration and login
- Accommodation search and booking
- Payment processing
- Account management
- Critical business workflows

**Poor Candidates** ❌:

- Edge cases (use unit tests)
- Error handling (use integration tests)
- UI component variations (use component tests)
- Performance testing (use dedicated tools)

### The 5% Rule

E2E tests are expensive to write and maintain. Focus on:

1. **Happy paths**: Main user journeys
2. **Revenue-critical**: Booking, payment, checkout
3. **High-risk**: Authentication, authorization
4. **Integration points**: Frontend + API + database

## Playwright Setup

### Installation

```bash
# Install Playwright
pnpm add -D @playwright/test

# Install browsers
pnpm exec playwright install

# Install with dependencies
pnpm exec playwright install --with-deps
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] }
    }
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
```

### Project Structure

```text
e2e/
├── fixtures/
│   ├── auth.setup.ts       # Authentication helpers
│   └── db.setup.ts         # Database helpers
├── pages/
│   ├── accommodation.page.ts
│   ├── booking.page.ts
│   └── login.page.ts
├── tests/
│   ├── auth.spec.ts
│   ├── booking.spec.ts
│   └── search.spec.ts
└── utils/
    └── test-data.ts
```

## Page Object Model

### Why Page Objects?

Page Object Model (POM) encapsulates page interactions:

**Benefits**:

- **Maintainability**: Change locators in one place
- **Reusability**: Share page logic across tests
- **Readability**: Tests describe user intent, not implementation
- **Type Safety**: TypeScript ensures correct usage

### Creating Page Objects

```typescript
// e2e/pages/accommodation.page.ts
import { Page, Locator } from '@playwright/test';

export class AccommodationPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly resultCards: Locator;
  readonly filterCity: Locator;
  readonly filterPriceMin: Locator;
  readonly filterPriceMax: Locator;
  readonly sortDropdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.searchButton = page.locator('[data-testid="search-button"]');
    this.resultCards = page.locator('[data-testid="accommodation-card"]');
    this.filterCity = page.locator('[data-testid="filter-city"]');
    this.filterPriceMin = page.locator('[data-testid="filter-price-min"]');
    this.filterPriceMax = page.locator('[data-testid="filter-price-max"]');
    this.sortDropdown = page.locator('[data-testid="sort-dropdown"]');
  }

  async goto() {
    await this.page.goto('/accommodations');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async filterByCity(city: string) {
    await this.filterCity.selectOption(city);
    await this.page.waitForLoadState('networkidle');
  }

  async filterByPriceRange(min: number, max: number) {
    await this.filterPriceMin.fill(String(min));
    await this.filterPriceMax.fill(String(max));
    await this.page.waitForLoadState('networkidle');
  }

  async sortBy(option: 'price-asc' | 'price-desc' | 'name') {
    await this.sortDropdown.selectOption(option);
    await this.page.waitForLoadState('networkidle');
  }

  async getResultCount(): Promise<number> {
    return await this.resultCards.count();
  }

  async getResultByIndex(index: number) {
    const card = this.resultCards.nth(index);
    return {
      name: await card.locator('[data-testid="card-name"]').textContent(),
      price: await card.locator('[data-testid="card-price"]').textContent(),
      city: await card.locator('[data-testid="card-city"]').textContent()
    };
  }

  async clickResult(index: number) {
    await this.resultCards.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }
}
```

```typescript
// e2e/pages/booking.page.ts
import { Page, Locator } from '@playwright/test';

export class BookingPage {
  readonly page: Page;
  readonly checkInInput: Locator;
  readonly checkOutInput: Locator;
  readonly guestsInput: Locator;
  readonly bookButton: Locator;
  readonly totalPrice: Locator;
  readonly confirmButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkInInput = page.locator('[data-testid="checkin-input"]');
    this.checkOutInput = page.locator('[data-testid="checkout-input"]');
    this.guestsInput = page.locator('[data-testid="guests-input"]');
    this.bookButton = page.locator('[data-testid="book-button"]');
    this.totalPrice = page.locator('[data-testid="total-price"]');
    this.confirmButton = page.locator('[data-testid="confirm-button"]');
    this.successMessage = page.locator('[data-testid="success-message"]');
  }

  async goto(accommodationId: string) {
    await this.page.goto(`/accommodations/${accommodationId}`);
  }

  async fillBookingDetails(input: {
    checkIn: string;
    checkOut: string;
    guests: number;
  }) {
    await this.checkInInput.fill(input.checkIn);
    await this.checkOutInput.fill(input.checkOut);
    await this.guestsInput.fill(String(input.guests));
  }

  async getTotalPrice(): Promise<string> {
    return await this.totalPrice.textContent() || '';
  }

  async clickBook() {
    await this.bookButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async confirmBooking() {
    await this.confirmButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getSuccessMessage(): Promise<string> {
    return await this.successMessage.textContent() || '';
  }

  async isSuccessMessageVisible(): Promise<boolean> {
    return await this.successMessage.isVisible();
  }
}
```

```typescript
// e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  async isErrorMessageVisible(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }
}
```

## Writing E2E Tests

### Basic Test Structure

```typescript
// e2e/tests/search.spec.ts
import { test, expect } from '@playwright/test';
import { AccommodationPage } from '../pages/accommodation.page';

test.describe('Accommodation Search', () => {
  let accommodationPage: AccommodationPage;

  test.beforeEach(async ({ page }) => {
    accommodationPage = new AccommodationPage(page);
    await accommodationPage.goto();
  });

  test('should display search results for city', async () => {
    // Arrange: Page is loaded

    // Act: Search for accommodations in Buenos Aires
    await accommodationPage.search('Buenos Aires');

    // Assert: Results are displayed
    const resultCount = await accommodationPage.getResultCount();
    expect(resultCount).toBeGreaterThan(0);

    // Verify first result contains search term
    const firstResult = await accommodationPage.getResultByIndex(0);
    expect(firstResult.city).toContain('Buenos Aires');
  });

  test('should filter results by price range', async ({ page }) => {
    // Arrange: Load page with results
    await accommodationPage.search('Hotel');

    // Act: Apply price filter
    await accommodationPage.filterByPriceRange(100, 200);

    // Assert: All results within range
    const resultCount = await accommodationPage.getResultCount();
    expect(resultCount).toBeGreaterThan(0);

    for (let i = 0; i < resultCount; i++) {
      const result = await accommodationPage.getResultByIndex(i);
      const price = parseInt(result.price?.replace(/[^0-9]/g, '') || '0');
      expect(price).toBeGreaterThanOrEqual(100);
      expect(price).toBeLessThanOrEqual(200);
    }
  });

  test('should sort results by price', async () => {
    // Arrange: Search for hotels
    await accommodationPage.search('Hotel');

    // Act: Sort by price ascending
    await accommodationPage.sortBy('price-asc');

    // Assert: Results sorted correctly
    const result1 = await accommodationPage.getResultByIndex(0);
    const result2 = await accommodationPage.getResultByIndex(1);

    const price1 = parseInt(result1.price?.replace(/[^0-9]/g, '') || '0');
    const price2 = parseInt(result2.price?.replace(/[^0-9]/g, '') || '0');

    expect(price1).toBeLessThanOrEqual(price2);
  });
});
```

### Complete User Flow

```typescript
// e2e/tests/booking.spec.ts
import { test, expect } from '@playwright/test';
import { AccommodationPage } from '../pages/accommodation.page';
import { BookingPage } from '../pages/booking.page';
import { LoginPage } from '../pages/login.page';

test.describe('Booking Flow', () => {
  test('should complete full booking process', async ({ page }) => {
    // Step 1: Login
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');

    // Verify logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Step 2: Search for accommodations
    const accommodationPage = new AccommodationPage(page);
    await accommodationPage.goto();
    await accommodationPage.search('Buenos Aires');

    // Verify results
    const resultCount = await accommodationPage.getResultCount();
    expect(resultCount).toBeGreaterThan(0);

    // Step 3: Select first result
    await accommodationPage.clickResult(0);

    // Step 4: Fill booking details
    const bookingPage = new BookingPage(page);
    await bookingPage.fillBookingDetails({
      checkIn: '2024-12-01',
      checkOut: '2024-12-05',
      guests: 2
    });

    // Verify price calculation
    const totalPrice = await bookingPage.getTotalPrice();
    expect(totalPrice).toBeTruthy();
    expect(totalPrice).toMatch(/\$\d+/);

    // Step 5: Create booking
    await bookingPage.clickBook();

    // Verify booking confirmation page
    await expect(page).toHaveURL(/\/bookings\/confirm/);

    // Step 6: Confirm booking
    await bookingPage.confirmBooking();

    // Step 7: Verify success
    const isSuccess = await bookingPage.isSuccessMessageVisible();
    expect(isSuccess).toBe(true);

    const message = await bookingPage.getSuccessMessage();
    expect(message).toContain('successfully');

    // Verify redirected to bookings list
    await expect(page).toHaveURL(/\/bookings/);
  });

  test('should show error for invalid dates', async ({ page }) => {
    // Login first
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');

    // Go to accommodation
    const bookingPage = new BookingPage(page);
    await bookingPage.goto('acc-123');

    // Fill invalid dates (check-out before check-in)
    await bookingPage.fillBookingDetails({
      checkIn: '2024-12-05',
      checkOut: '2024-12-01',
      guests: 2
    });

    await bookingPage.clickBook();

    // Verify error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Check-out must be after check-in');
  });

  test('should require login for booking', async ({ page }) => {
    // Go directly to accommodation (not logged in)
    const bookingPage = new BookingPage(page);
    await bookingPage.goto('acc-123');

    await bookingPage.fillBookingDetails({
      checkIn: '2024-12-01',
      checkOut: '2024-12-05',
      guests: 2
    });

    await bookingPage.clickBook();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
```

### Authentication Tests

```typescript
// e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login('test@example.com', 'password123');

    // Verify redirected to dashboard
    await expect(page).toHaveURL('/dashboard');

    // Verify user menu visible
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login('test@example.com', 'wrongpassword');

    // Verify error message
    const isErrorVisible = await loginPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(true);

    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Invalid credentials');

    // Verify still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');

    // Click user menu
    const userMenu = page.locator('[data-testid="user-menu"]');
    await userMenu.click();

    // Click logout
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await logoutButton.click();

    // Verify redirected to home
    await expect(page).toHaveURL('/');

    // Verify user menu not visible
    await expect(userMenu).not.toBeVisible();
  });
});
```

## Test Fixtures

### Authenticated User Fixture

```typescript
// e2e/fixtures/auth.setup.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

type AuthFixture = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    // Login before each test
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');

    // Wait for authentication
    await page.waitForURL('/dashboard');

    // Use authenticated page
    await use(page);

    // Logout after test
    const userMenu = page.locator('[data-testid="user-menu"]');
    await userMenu.click();
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await logoutButton.click();
  }
});

export { expect } from '@playwright/test';
```

**Usage**:

```typescript
import { test, expect } from '../fixtures/auth.setup';

test('should access protected page', async ({ authenticatedPage }) => {
  // User is already logged in
  await authenticatedPage.goto('/profile');
  await expect(authenticatedPage).toHaveURL('/profile');
});
```

### Database Fixture

```typescript
// e2e/fixtures/db.setup.ts
import { test as base } from '@playwright/test';
import { db } from '@repo/db';
import { accommodations, users } from '@repo/db/schema';

type DbFixture = {
  cleanDb: void;
};

export const test = base.extend<DbFixture>({
  cleanDb: async ({}, use) => {
    // Clean database before test
    await db.delete(accommodations);
    await db.delete(users);

    await use();

    // Clean database after test
    await db.delete(accommodations);
    await db.delete(users);
  }
});
```

## Locator Strategies

### Best Practices

**Priority Order**:

1. **data-testid**: Most reliable
2. **role**: Semantic HTML
3. **text**: User-visible text
4. **CSS**: Last resort

```typescript
// ✅ GOOD: data-testid
page.locator('[data-testid="search-button"]')

// ✅ GOOD: role
page.getByRole('button', { name: 'Search' })

// ✅ GOOD: text
page.getByText('Book Now')

// ❌ AVOID: CSS classes (can change)
page.locator('.btn-primary')

// ❌ AVOID: XPath (brittle)
page.locator('//div[@class="card"]/button[1]')
```

### Adding data-testid to Components

```tsx
// components/SearchButton.tsx
export function SearchButton({ onClick }: Props) {
  return (
    <button
      data-testid="search-button"
      onClick={onClick}
      className="btn-primary"
    >
      Search
    </button>
  );
}

// components/AccommodationCard.tsx
export function AccommodationCard({ accommodation }: Props) {
  return (
    <div data-testid="accommodation-card">
      <h3 data-testid="card-name">{accommodation.name}</h3>
      <p data-testid="card-price">${accommodation.pricePerNight}</p>
      <p data-testid="card-city">{accommodation.city}</p>
    </div>
  );
}
```

## Waiting Strategies

### Network Idle

```typescript
// Wait for network to be idle
await page.goto('/accommodations');
await page.waitForLoadState('networkidle');

// Wait for specific request
await page.waitForResponse(resp =>
  resp.url().includes('/api/accommodations') && resp.status() === 200
);
```

### Element Visibility

```typescript
// Wait for element to be visible
await page.waitForSelector('[data-testid="results"]', { state: 'visible' });

// Or use expect (auto-waits)
await expect(page.locator('[data-testid="results"]')).toBeVisible();
```

### Custom Timeouts

```typescript
// Set timeout for specific action
await page.locator('[data-testid="slow-button"]').click({
  timeout: 10000 // 10 seconds
});

// Set timeout for test
test('slow operation', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds

  // ... slow operations
});
```

## Testing Across Browsers

### Browser Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
```

### Run Specific Browser

```bash
# Run all browsers
pnpm exec playwright test

# Run specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit

# Run mobile
pnpm exec playwright test --project=mobile-chrome
```

### Browser-Specific Tests

```typescript
test('chromium-specific feature', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium only');

  // Test chromium-specific feature
});

test('should work across all browsers', async ({ page }) => {
  // This runs on all browsers
});
```

## Visual Regression Testing

### Screenshot Comparison

```typescript
test('should match homepage screenshot', async ({ page }) => {
  await page.goto('/');

  // Take screenshot and compare with baseline
  await expect(page).toHaveScreenshot('homepage.png');
});

test('should match accommodation card', async ({ page }) => {
  await page.goto('/accommodations');

  const card = page.locator('[data-testid="accommodation-card"]').first();

  // Screenshot specific element
  await expect(card).toHaveScreenshot('accommodation-card.png');
});
```

### Updating Baselines

```bash
# Update all screenshots
pnpm exec playwright test --update-snapshots

# Update specific test
pnpm exec playwright test homepage.spec.ts --update-snapshots
```

### Ignore Dynamic Content

```typescript
test('should match page ignoring dynamic content', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveScreenshot({
    mask: [
      page.locator('[data-testid="timestamp"]'),
      page.locator('[data-testid="user-count"]')
    ]
  });
});
```

## Accessibility Testing

### Basic Accessibility Checks

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/');

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});

test('should have accessible form', async ({ page }) => {
  await page.goto('/booking');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .include('[data-testid="booking-form"]')
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

### Keyboard Navigation

```typescript
test('should navigate with keyboard', async ({ page }) => {
  await page.goto('/');

  // Tab through interactive elements
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute(
    'data-testid',
    'search-input'
  );

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute(
    'data-testid',
    'search-button'
  );

  // Activate with Enter
  await page.keyboard.press('Enter');

  // Verify action occurred
  await expect(page.locator('[data-testid="results"]')).toBeVisible();
});
```

### Screen Reader Testing

```typescript
test('should have proper ARIA labels', async ({ page }) => {
  await page.goto('/');

  // Verify ARIA labels
  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toHaveAttribute('aria-label', 'Search accommodations');

  const searchButton = page.locator('[data-testid="search-button"]');
  await expect(searchButton).toHaveAttribute('aria-label', 'Submit search');
});
```

## Performance Testing

### Measure Load Time

```typescript
test('should load homepage quickly', async ({ page }) => {
  const startTime = Date.now();

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const loadTime = Date.now() - startTime;

  // Should load in less than 3 seconds
  expect(loadTime).toBeLessThan(3000);
});
```

### Monitor Network Requests

```typescript
test('should minimize API calls', async ({ page }) => {
  const apiCalls: string[] = [];

  page.on('request', request => {
    if (request.url().includes('/api/')) {
      apiCalls.push(request.url());
    }
  });

  await page.goto('/accommodations');
  await page.waitForLoadState('networkidle');

  // Should not make excessive API calls
  expect(apiCalls.length).toBeLessThan(5);
});
```

### Core Web Vitals

```typescript
test('should have good Core Web Vitals', async ({ page }) => {
  await page.goto('/');

  // Get performance metrics
  const metrics = await page.evaluate(() => {
    return JSON.parse(
      JSON.stringify(performance.getEntriesByType('navigation')[0])
    );
  });

  // LCP (Largest Contentful Paint) should be < 2.5s
  const lcp = await page.evaluate(() => {
    return new Promise(resolve => {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.renderTime || lastEntry.loadTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    });
  });

  expect(lcp).toBeLessThan(2500);
});
```

## Test Data Management

### Using Test Data

```typescript
// e2e/utils/test-data.ts
export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'password123'
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'admin123'
  }
};

export const testAccommodations = {
  hotel: {
    name: 'Test Hotel',
    city: 'Buenos Aires',
    pricePerNight: 100
  },
  cabin: {
    name: 'Test Cabin',
    city: 'Bariloche',
    pricePerNight: 80
  }
};

// Usage in tests
import { testUsers } from '../utils/test-data';

test('should login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(testUsers.validUser.email, testUsers.validUser.password);
});
```

### Seeding Test Database

```typescript
// e2e/fixtures/seed.ts
import { db } from '@repo/db';
import { accommodations, users } from '@repo/db/schema';

export async function seedTestData() {
  // Clear existing data
  await db.delete(accommodations);
  await db.delete(users);

  // Create test users
  await db.insert(users).values([
    {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User'
    },
    {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin'
    }
  ]);

  // Create test accommodations
  await db.insert(accommodations).values([
    {
      id: 'acc-1',
      name: 'Hotel Paradise',
      city: 'Buenos Aires',
      pricePerNight: 100
    },
    {
      id: 'acc-2',
      name: 'Mountain Cabin',
      city: 'Bariloche',
      pricePerNight: 80
    }
  ]);
}

// Usage
test.beforeEach(async () => {
  await seedTestData();
});
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Setup test database
        run: pnpm db:setup:test

      - name: Run E2E tests
        run: pnpm exec playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### Parallel Execution

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 1 : undefined, // Serial in CI, parallel locally

  // Or configure per project
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0
});
```

## Debugging E2E Tests

### Debug Mode

```bash
# Run in headed mode (see browser)
pnpm exec playwright test --headed

# Run in debug mode
pnpm exec playwright test --debug

# Run specific test in debug mode
pnpm exec playwright test booking.spec.ts --debug
```

### Playwright Inspector

```typescript
test('debug this test', async ({ page }) => {
  await page.goto('/');

  // Pause execution - opens Playwright Inspector
  await page.pause();

  await page.locator('[data-testid="search-button"]').click();
});
```

### Screenshots and Videos

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry'
  }
});
```

```typescript
// Take manual screenshot
test('should display results', async ({ page }) => {
  await page.goto('/accommodations');

  await page.screenshot({ path: 'screenshots/accommodations.png' });
});
```

### Trace Viewer

```bash
# Show trace viewer
pnpm exec playwright show-trace trace.zip
```

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry' // Capture trace on retry
  }
});
```

## Best Practices

### DO ✅

```typescript
// Use Page Object Model
const loginPage = new LoginPage(page);
await loginPage.login('user@example.com', 'password');

// Use data-testid for selectors
page.locator('[data-testid="search-button"]')

// Wait for network idle
await page.waitForLoadState('networkidle');

// Test complete user flows
test('complete booking flow', async ({ page }) => {
  // Login → Search → Select → Book → Confirm
});

// Use fixtures for common setups
const { authenticatedPage } = await use({ page });

// Clean up test data
test.afterEach(async () => {
  await cleanupTestData();
});

// Test critical paths only
test('user can complete payment', async ({ page }) => {
  // Revenue-critical flow
});
```

### DON'T ❌

```typescript
// Test every edge case with E2E
test('handles empty string in search', async ({ page }) => {
  // Use unit test instead!
});

// Use fragile selectors
page.locator('.btn-primary.large.blue') // Brittle!
page.locator('div > div > button:nth-child(2)') // Will break!

// Ignore waits
await page.click('[data-testid="button"]');
await expect(page.locator('[data-testid="result"]')).toBeVisible(); // Race condition!

// Test implementation details
expect(await page.evaluate(() => window.__store__.state)).toBe(...) // Don't!

// Have too many E2E tests
// Remember: 5% of total tests

// Share state between tests
let booking: Booking; // Don't share!
test('creates booking', () => { booking = ... });
test('updates booking', () => { update(booking) }); // Dependent!
```

## Common Patterns

### Login and Navigate

```typescript
test('should access protected page', async ({ page }) => {
  // Login
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');

  // Navigate to protected page
  await page.goto('/profile');

  // Verify access
  await expect(page).toHaveURL('/profile');
});
```

### Form Submission

```typescript
test('should submit booking form', async ({ page }) => {
  const bookingPage = new BookingPage(page);
  await bookingPage.goto('acc-123');

  // Fill form
  await bookingPage.fillBookingDetails({
    checkIn: '2024-12-01',
    checkOut: '2024-12-05',
    guests: 2
  });

  // Submit
  await bookingPage.clickBook();

  // Verify redirect
  await expect(page).toHaveURL(/\/bookings\/confirm/);
});
```

### API Mocking

```typescript
test('should handle API error gracefully', async ({ page }) => {
  // Mock API to return error
  await page.route('**/api/accommodations', route => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Server error' })
    });
  });

  await page.goto('/accommodations');

  // Verify error message shown
  const errorMessage = page.locator('[data-testid="error-message"]');
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContainText('Unable to load accommodations');
});
```

## Performance Optimization

### Reduce Test Time

```typescript
// Run tests in parallel
export default defineConfig({
  fullyParallel: true,
  workers: 4
});

// Reuse authentication state
test.use({ storageState: 'auth.json' });

// Skip unnecessary waits
await page.goto('/', { waitUntil: 'domcontentloaded' }); // Faster than 'networkidle'
```

### Efficient Selectors

```typescript
// ✅ Fast
page.locator('[data-testid="button"]')

// ❌ Slow
page.locator('div > div > div > button.primary')
```

## Next Steps

- [Test Factories](./test-factories.md) - Generating test data
- [Mocking Strategies](./mocking.md) - Advanced mocking
- [Coverage Requirements](./coverage.md) - Coverage enforcement

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Testing Strategy](./strategy.md)
- [Unit Testing](./unit-testing.md)
- [Integration Testing](./integration-testing.md)
