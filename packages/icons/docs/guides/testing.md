# Icon Testing Guide

Comprehensive guide for testing icon components in the `@repo/icons` package.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Unit Testing](#unit-testing)
- [Snapshot Testing](#snapshot-testing)
- [Visual Regression Testing](#visual-regression-testing)
- [Accessibility Testing](#accessibility-testing)
- [Integration Testing](#integration-testing)
- [Testing with Testing Library](#testing-with-testing-library)
- [Performance Testing](#performance-testing)
- [Test Organization](#test-organization)
- [Mock Strategies](#mock-strategies)
- [CI/CD Integration](#cicd-integration)
- [Coverage Requirements](#coverage-requirements)
- [Complete Test Examples](#complete-test-examples)
- [Testing Patterns](#testing-patterns)
- [Troubleshooting](#troubleshooting)

---

## Testing Strategy

### Why Test Icons?

**Testing ensures:**

- ✅ Icons render correctly
- ✅ Props work as expected
- ✅ Accessibility maintained
- ✅ Visual consistency
- ✅ No regressions
- ✅ Documentation accuracy

### Testing Pyramid for Icons

```
       /\
      /  \    E2E Tests
     /    \   (Few)
    /------\
   /        \  Integration Tests
  /          \ (Some)
 /            \
/--------------\
   Unit Tests
   (Many)
```

**For icon package:**

- **70% Unit tests:** Component rendering, props, ARIA
- **20% Integration tests:** Icon usage in components
- **10% Visual/E2E tests:** Visual consistency, accessibility

### Test Types

**1. Unit Tests:**

- Component renders without crashing
- Props applied correctly
- ARIA attributes correct
- Size/color customization

**2. Snapshot Tests:**

- SVG structure unchanged
- Path data consistent
- Attributes match expected

**3. Accessibility Tests:**

- Screen reader announcements
- Keyboard navigation
- Focus indicators
- Color contrast

**4. Visual Regression Tests:**

- Icon appearance consistent
- No visual regressions
- Cross-browser consistency

**5. Performance Tests:**

- Render speed
- Bundle size
- Memory usage

---

## Unit Testing

### Basic Test Structure

**Test file naming:**

```
SearchIcon.tsx          → SearchIcon.test.tsx
UserIcon.tsx            → UserIcon.test.tsx
AccommodationIcon.tsx   → AccommodationIcon.test.tsx
```

### Essential Unit Tests

**Every icon must have these tests:**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SearchIcon } from './SearchIcon';

describe('SearchIcon', () => {
  it('renders without crashing', () => {
    const { container } = render(<SearchIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies size prop correctly', () => {
    const { container } = render(<SearchIcon size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('applies className correctly', () => {
    const { container } = render(<SearchIcon className="custom-class" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('custom-class');
  });

  it('uses currentColor for stroke', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });

  it('has correct viewBox', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('is decorative by default', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
```

### Props Validation Tests

**Test all prop variations:**

```typescript
describe('SearchIcon props', () => {
  it('defaults to size 24', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('accepts custom size', () => {
    const sizes = [16, 20, 24, 32, 48];

    sizes.forEach((size) => {
      const { container } = render(<SearchIcon size={size} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', String(size));
      expect(svg).toHaveAttribute('height', String(size));
    });
  });

  it('combines multiple classNames', () => {
    const { container } = render(
      <SearchIcon className="text-blue-500 hover:text-blue-600" />
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-blue-500');
    expect(svg).toHaveClass('hover:text-blue-600');
  });

  it('forwards additional props', () => {
    const { container } = render(
      <SearchIcon data-testid="search-icon" onClick={() => {}} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-testid', 'search-icon');
    expect(svg).toHaveProperty('onclick');
  });
});
```

### SVG Structure Tests

**Verify SVG elements:**

```typescript
describe('SearchIcon structure', () => {
  it('contains expected SVG elements', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');

    // Should have circle for search lens
    const circle = svg?.querySelector('circle');
    expect(circle).toBeInTheDocument();

    // Should have path for search handle
    const paths = svg?.querySelectorAll('path');
    expect(paths?.length).toBeGreaterThan(0);
  });

  it('has no fill by default', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('fill', 'none');
  });

  it('has correct stroke properties', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('strokeWidth', '2');
    expect(svg).toHaveAttribute('strokeLinecap', 'round');
    expect(svg).toHaveAttribute('strokeLinejoin', 'round');
  });
});
```

---

## Snapshot Testing

### What is Snapshot Testing?

**Snapshot testing:** Captures component output and compares on future runs

**Use for:**

- ✅ Detect unintended changes
- ✅ Document expected output
- ✅ Catch SVG path modifications

### Creating Snapshots

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SearchIcon } from './SearchIcon';

describe('SearchIcon snapshots', () => {
  it('matches snapshot with default props', () => {
    const { container } = render(<SearchIcon />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with custom size', () => {
    const { container } = render(<SearchIcon size={32} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with className', () => {
    const { container } = render(<SearchIcon className="text-blue-500" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

### Snapshot File

**Generated snapshot (SearchIcon.test.tsx.snap):**

```
// Vitest Snapshot v1

exports[`SearchIcon snapshots > matches snapshot with default props 1`] = `
<svg
  aria-hidden="true"
  fill="none"
  height="24"
  stroke="currentColor"
  stroke-linecap="round"
  stroke-linejoin="round"
  stroke-width="2"
  viewBox="0 0 24 24"
  width="24"
>
  <circle
    cx="11"
    cy="11"
    r="8"
  />
  <path
    d="M21 21l-4.35-4.35"
  />
</svg>
`;
```

### Updating Snapshots

```bash
# Update all snapshots
pnpm test -- -u

# Update specific snapshot
pnpm test SearchIcon.test.tsx -- -u
```

### Snapshot Best Practices

**✅ Good practices:**

- Small, focused snapshots
- Clear test descriptions
- Review snapshot changes carefully
- Update only when intentional

**❌ Avoid:**

- Large snapshots (hard to review)
- Dynamic data in snapshots
- Ignoring snapshot failures
- Auto-updating without review

---

## Visual Regression Testing

### What is Visual Regression Testing?

**Visual regression testing:** Compare screenshots to detect visual changes

**Tools:**

- **Playwright:** Built-in screenshot testing
- **Percy:** Visual testing platform
- **Chromatic:** Storybook-based visual testing

### Playwright Visual Tests

**Setup:**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100, // Allow minor differences
    },
  },
});
```

**Test:**

```typescript
// icons.visual.test.ts
import { test, expect } from '@playwright/test';

test('SearchIcon visual consistency', async ({ page }) => {
  await page.goto('/icons/search');

  // Take screenshot
  await expect(page.locator('[data-testid="search-icon"]')).toHaveScreenshot();
});

test('All icons gallery', async ({ page }) => {
  await page.goto('/icons/gallery');

  // Screenshot entire gallery
  await expect(page).toHaveScreenshot('icons-gallery.png', {
    fullPage: true,
  });
});
```

### Storybook with Chromatic

**Icon story:**

```typescript
// SearchIcon.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { SearchIcon } from './SearchIcon';

const meta: Meta<typeof SearchIcon> = {
  title: 'Icons/UI/SearchIcon',
  component: SearchIcon,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SearchIcon>;

export const Default: Story = {
  args: {},
};

export const Large: Story = {
  args: {
    size: 48,
  },
};

export const CustomColor: Story = {
  args: {
    className: 'text-blue-500',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <SearchIcon size={16} />
      <SearchIcon size={20} />
      <SearchIcon size={24} />
      <SearchIcon size={32} />
      <SearchIcon size={48} />
    </div>
  ),
};
```

**Run Chromatic:**

```bash
npx chromatic --project-token=<token>
```

---

## Accessibility Testing

### Accessibility Test Suite

**Every icon component needs accessibility tests:**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SearchIcon } from './SearchIcon';

expect.extend(toHaveNoViolations);

describe('SearchIcon accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<SearchIcon />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('is hidden from screen readers by default', () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('can be made accessible with aria-label', async () => {
    const { container } = render(<SearchIcon aria-label="Search" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-label', 'Search');
    expect(svg).not.toHaveAttribute('aria-hidden');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('works in icon-only button', async () => {
    const { container } = render(
      <button aria-label="Search accommodations">
        <SearchIcon />
      </button>
    );

    const button = container.querySelector('button');
    expect(button).toHaveAttribute('aria-label', 'Search accommodations');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('is decorative when text label present', async () => {
    const { container } = render(
      <button>
        <SearchIcon aria-hidden="true" />
        <span>Search</span>
      </button>
    );

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Color Contrast Tests

```typescript
describe('SearchIcon color contrast', () => {
  it('has sufficient contrast on light background', () => {
    const { container } = render(
      <div style={{ backgroundColor: '#FFFFFF' }}>
        <SearchIcon className="text-gray-700" />
      </div>
    );

    // Manual check or use contrast checker tool
    // gray-700 (#374151) on white = 10.9:1 ✅
  });

  it('has sufficient contrast on dark background', () => {
    const { container } = render(
      <div style={{ backgroundColor: '#1F2937' }}>
        <SearchIcon className="text-gray-100" />
      </div>
    );

    // gray-100 (#F3F4F6) on gray-900 = 14.4:1 ✅
  });
});
```

### Keyboard Navigation Tests

```typescript
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('SearchIcon keyboard navigation', () => {
  it('icon button is keyboard accessible', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    const { getByRole } = render(
      <button aria-label="Search" onClick={handleClick}>
        <SearchIcon />
      </button>
    );

    const button = getByRole('button', { name: 'Search' });

    // Tab to button
    await user.tab();
    expect(button).toHaveFocus();

    // Activate with Enter
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Activate with Space
    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('shows focus indicator', async () => {
    const user = userEvent.setup();

    const { getByRole } = render(
      <button
        aria-label="Search"
        className="focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <SearchIcon />
      </button>
    );

    const button = getByRole('button');

    // Tab to button (keyboard focus)
    await user.tab();

    // Check for focus-visible class
    expect(button).toHaveClass('focus-visible:ring-2');
  });
});
```

---

## Integration Testing

### Icons in Components

**Test icon usage in real components:**

```typescript
// AccommodationCard.test.tsx
import { render, screen } from '@testing-library/react';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  it('displays amenity icons correctly', () => {
    const accommodation = {
      name: 'Beach House',
      amenities: ['wifi', 'pool', 'parking'],
    };

    const { container } = render(<AccommodationCard data={accommodation} />);

    // Check that icons are rendered
    const wifiIcon = container.querySelector('[data-icon="wifi"]');
    const poolIcon = container.querySelector('[data-icon="pool"]');
    const parkingIcon = container.querySelector('[data-icon="parking"]');

    expect(wifiIcon).toBeInTheDocument();
    expect(poolIcon).toBeInTheDocument();
    expect(parkingIcon).toBeInTheDocument();
  });

  it('favorite button works correctly', async () => {
    const user = userEvent.setup();
    const onFavorite = vi.fn();

    render(<AccommodationCard onFavorite={onFavorite} />);

    const favoriteButton = screen.getByRole('button', {
      name: /add to favorites/i,
    });

    await user.click(favoriteButton);
    expect(onFavorite).toHaveBeenCalled();
  });

  it('status icons convey correct information', () => {
    const { container } = render(
      <AccommodationCard status="verified" />
    );

    // Verified icon should be present
    const verifiedIcon = screen.getByLabelText(/verified/i);
    expect(verifiedIcon).toBeInTheDocument();
  });
});
```

### Icons in Forms

```typescript
// SearchForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchForm } from './SearchForm';

describe('SearchForm', () => {
  it('search button with icon is accessible', async () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(searchButton);
    expect(onSearch).toHaveBeenCalled();
  });

  it('clear button removes input', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);

    const input = screen.getByRole('textbox');
    const clearButton = screen.getByRole('button', { name: /clear/i });

    // Type something
    await user.type(input, 'test query');
    expect(input).toHaveValue('test query');

    // Click clear
    await user.click(clearButton);
    expect(input).toHaveValue('');
  });
});
```

---

## Testing with Testing Library

### Query Priorities

**Prefer accessible queries:**

```typescript
// ✅ Best - By accessible name
screen.getByRole('button', { name: 'Search' });

// ✅ Good - By label text
screen.getByLabelText('Search accommodations');

// ⚠️ Acceptable - By test ID
screen.getByTestId('search-icon');

// ❌ Avoid - By implementation details
container.querySelector('.search-icon');
```

### User Interactions

```typescript
import userEvent from '@testing-library/user-event';

test('icon button click', async () => {
  const user = userEvent.setup();
  const handleClick = vi.fn();

  render(
    <button aria-label="Search" onClick={handleClick}>
      <SearchIcon />
    </button>
  );

  // Click button
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(handleClick).toHaveBeenCalledTimes(1);
});

test('icon button hover', async () => {
  const user = userEvent.setup();
  const handleHover = vi.fn();

  render(
    <button aria-label="Search" onMouseEnter={handleHover}>
      <SearchIcon />
    </button>
  );

  // Hover button
  await user.hover(screen.getByRole('button'));
  expect(handleHover).toHaveBeenCalled();
});
```

### Assertions

```typescript
// Presence
expect(screen.getByRole('button')).toBeInTheDocument();

// Accessibility
expect(screen.getByRole('button')).toHaveAccessibleName('Search');

// Attributes
expect(svg).toHaveAttribute('viewBox', '0 0 24 24');

// Classes
expect(svg).toHaveClass('text-blue-500');

// Styles
expect(svg).toHaveStyle({ width: '24px', height: '24px' });
```

---

## Performance Testing

### Render Performance

**Measure render time:**

```typescript
import { performance } from 'perf_hooks';
import { renderToString } from 'react-dom/server';
import { SearchIcon } from './SearchIcon';

describe('SearchIcon performance', () => {
  it('renders quickly', () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      renderToString(<SearchIcon />);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    // Should render in < 0.5ms on average
    expect(avgTime).toBeLessThan(0.5);
  });

  it('handles size prop efficiently', () => {
    const start = performance.now();

    for (let i = 16; i <= 48; i += 4) {
      renderToString(<SearchIcon size={i} />);
    }

    const end = performance.now();

    // Should complete in < 10ms total
    expect(end - start).toBeLessThan(10);
  });
});
```

### Bundle Size Testing

```typescript
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';

describe('SearchIcon bundle size', () => {
  it('has reasonable bundle size', () => {
    const code = readFileSync('dist/SearchIcon.js', 'utf8');
    const gzipped = gzipSync(code);

    // Should be < 500 bytes gzipped
    expect(gzipped.length).toBeLessThan(500);
  });
});
```

---

## Test Organization

### File Structure

```
packages/icons/
├── src/
│   ├── ui/
│   │   ├── SearchIcon.tsx
│   │   ├── SearchIcon.test.tsx      # Unit tests
│   │   └── SearchIcon.stories.tsx    # Storybook
│   ├── actions/
│   │   ├── AddIcon.tsx
│   │   └── AddIcon.test.tsx
│   └── index.ts
└── test/
    ├── integration/
    │   ├── icon-usage.test.tsx       # Integration tests
    │   └── accessibility.test.tsx     # Accessibility tests
    ├── visual/
    │   └── icons.visual.test.ts      # Visual tests
    └── setup.ts                       # Test setup
```

### Test Setup File

```typescript
// test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.test.{ts,tsx}',
        '**/*.stories.{ts,tsx}',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

---

## Mock Strategies

### Mocking Icon Components

**For testing components that use icons:**

```typescript
// __mocks__/@repo/icons.tsx
import { vi } from 'vitest';

export const SearchIcon = vi.fn(() => (
  <svg data-testid="search-icon">
    <title>Search Icon</title>
  </svg>
));

export const UserIcon = vi.fn(() => (
  <svg data-testid="user-icon">
    <title>User Icon</title>
  </svg>
));

// Mock all icons
vi.mock('@repo/icons', () => ({
  SearchIcon: vi.fn(() => <svg data-testid="search-icon" />),
  UserIcon: vi.fn(() => <svg data-testid="user-icon" />),
  AddIcon: vi.fn(() => <svg data-testid="add-icon" />),
  // ... other icons
}));
```

**Usage in tests:**

```typescript
import { render, screen } from '@testing-library/react';
import { SearchIcon } from '@repo/icons';
import { SearchButton } from './SearchButton';

vi.mock('@repo/icons');

describe('SearchButton', () => {
  it('renders SearchIcon', () => {
    render(<SearchButton />);

    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    expect(SearchIcon).toHaveBeenCalled();
  });
});
```

### Partial Mocking

**Mock some icons, use real for others:**

```typescript
vi.mock('@repo/icons', async () => {
  const actual = await vi.importActual('@repo/icons');
  return {
    ...actual,
    // Mock only expensive icons
    ComplexChartIcon: vi.fn(() => <svg data-testid="chart-icon" />),
  };
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/icons-tests.yml
name: Icons Tests

on:
  push:
    branches: [main]
    paths:
      - 'packages/icons/**'
  pull_request:
    paths:
      - 'packages/icons/**'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm --filter=@repo/icons test

      - name: Run accessibility tests
        run: pnpm --filter=@repo/icons test:a11y

      - name: Check coverage
        run: pnpm --filter=@repo/icons test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/icons/coverage/coverage-final.json

  visual:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run visual regression tests
        run: pnpm --filter=@repo/icons test:visual

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: visual-diffs
          path: packages/icons/test-results/
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tests for changed icon files
pnpm --filter=@repo/icons test --changed
```

---

## Coverage Requirements

### Coverage Thresholds

**Hospeda standard: 90% minimum**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

### Running Coverage Reports

```bash
# Generate coverage report
pnpm test:coverage

# View HTML report
open coverage/index.html

# Check if thresholds met
pnpm test:coverage --reporter=text
```

### Coverage Report Example

```
File                | % Stmts | % Branch | % Funcs | % Lines
--------------------|---------|----------|---------|--------
SearchIcon.tsx      |   100   |   100    |   100   |   100
UserIcon.tsx        |   100   |   100    |   100   |   100
AccommodationIcon.tsx |  95   |   90     |   100   |   95
--------------------|---------|----------|---------|--------
All files           |   98    |   96     |   100   |   98
```

### Excluding from Coverage

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'test/',
        '**/*.test.{ts,tsx}',
        '**/*.stories.{ts,tsx}',
        '**/index.ts',  // Barrel files
        'dist/',
      ],
    },
  },
});
```

---

## Complete Test Examples

### Example 1: Simple Icon (SearchIcon)

```typescript
// SearchIcon.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { SearchIcon } from './SearchIcon';

describe('SearchIcon', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<SearchIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('matches snapshot', () => {
      const { container } = render(<SearchIcon />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Props', () => {
    it('defaults to size 24', () => {
      const { container } = render(<SearchIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '24');
      expect(svg).toHaveAttribute('height', '24');
    });

    it('accepts custom size', () => {
      const { container } = render(<SearchIcon size={32} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '32');
      expect(svg).toHaveAttribute('height', '32');
    });

    it('applies className', () => {
      const { container } = render(<SearchIcon className="text-blue-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-blue-500');
    });

    it('forwards additional props', () => {
      const { container } = render(
        <SearchIcon data-testid="icon" onClick={() => {}} />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('data-testid', 'icon');
    });
  });

  describe('SVG Structure', () => {
    it('has correct viewBox', () => {
      const { container } = render(<SearchIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('uses currentColor', () => {
      const { container } = render(<SearchIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    });

    it('has no fill', () => {
      const { container } = render(<SearchIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('has correct stroke properties', () => {
      const { container } = render(<SearchIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('strokeWidth', '2');
      expect(svg).toHaveAttribute('strokeLinecap', 'round');
      expect(svg).toHaveAttribute('strokeLinejoin', 'round');
    });
  });

  describe('Accessibility', () => {
    it('is decorative by default', () => {
      const { container } = render(<SearchIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('has no accessibility violations', async () => {
      const { container } = render(<SearchIcon />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('can be made semantic with aria-label', async () => {
      const { container } = render(<SearchIcon aria-label="Search" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-label', 'Search');
      expect(svg).not.toHaveAttribute('aria-hidden');
    });
  });
});
```

### Example 2: Complex Icon (AccommodationIcon)

```typescript
// AccommodationIcon.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { AccommodationIcon } from './AccommodationIcon';

describe('AccommodationIcon', () => {
  describe('Rendering', () => {
    it('renders correctly', () => {
      const { container } = render(<AccommodationIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('contains multiple SVG paths', () => {
      const { container } = render(<AccommodationIcon />);
      const paths = container.querySelectorAll('path, rect');
      expect(paths.length).toBeGreaterThan(1);
    });
  });

  describe('Interactive Usage', () => {
    it('works as clickable element', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <button aria-label="View accommodation" onClick={handleClick}>
          <AccommodationIcon />
        </button>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('shows focus indicator on keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <button
          aria-label="View accommodation"
          className="focus-visible:ring-2"
        >
          <AccommodationIcon />
        </button>
      );

      await user.tab();

      const button = screen.getByRole('button');
      expect(button).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('passes axe accessibility tests', async () => {
      const { container } = render(
        <button aria-label="View accommodation details">
          <AccommodationIcon />
        </button>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('is properly labeled in context', () => {
      render(
        <div>
          <AccommodationIcon aria-hidden="true" />
          <span>Beach House Villa</span>
        </div>
      );

      expect(screen.getByText('Beach House Villa')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders efficiently', () => {
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        render(<AccommodationIcon />);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(5); // < 5ms per render
    });
  });
});
```

---

## Testing Patterns

### Pattern 1: Parameterized Tests

**Test multiple scenarios efficiently:**

```typescript
describe('Icon sizes', () => {
  const sizes = [16, 20, 24, 32, 48];

  sizes.forEach((size) => {
    it(`renders correctly at size ${size}`, () => {
      const { container } = render(<SearchIcon size={size} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', String(size));
      expect(svg).toHaveAttribute('height', String(size));
    });
  });
});

describe('Icon variants', () => {
  const variants = [
    { className: 'text-blue-500', expected: 'text-blue-500' },
    { className: 'text-red-500', expected: 'text-red-500' },
    { className: 'text-green-500', expected: 'text-green-500' },
  ];

  variants.forEach(({ className, expected }) => {
    it(`applies ${className} correctly`, () => {
      const { container } = render(<SearchIcon className={className} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass(expected);
    });
  });
});
```

### Pattern 2: Test Fixtures

**Reusable test data:**

```typescript
// test/fixtures/icons.ts
export const iconTestCases = [
  {
    name: 'SearchIcon',
    component: SearchIcon,
    expectedPaths: 2,
    hasCircle: true,
  },
  {
    name: 'UserIcon',
    component: UserIcon,
    expectedPaths: 1,
    hasCircle: true,
  },
  {
    name: 'AccommodationIcon',
    component: AccommodationIcon,
    expectedPaths: 3,
    hasCircle: false,
  },
];

// Use in tests
import { iconTestCases } from './fixtures/icons';

describe('All icons', () => {
  iconTestCases.forEach(({ name, component: Icon, expectedPaths }) => {
    describe(name, () => {
      it('renders correct number of paths', () => {
        const { container } = render(<Icon />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(expectedPaths);
      });
    });
  });
});
```

### Pattern 3: Test Utilities

**Reusable test helpers:**

```typescript
// test/utils/icon-test-utils.ts
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

export async function testIconAccessibility(IconComponent: any) {
  const { container } = render(<IconComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

export function testIconProps(IconComponent: any) {
  it('accepts size prop', () => {
    const { container } = render(<IconComponent size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
  });

  it('accepts className prop', () => {
    const { container } = render(<IconComponent className="test" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('test');
  });
}

// Use in tests
import { testIconAccessibility, testIconProps } from './utils';

describe('SearchIcon', () => {
  testIconProps(SearchIcon);

  it('passes accessibility tests', async () => {
    await testIconAccessibility(SearchIcon);
  });
});
```

---

## Troubleshooting

### Common Test Issues

#### Issue 1: SVG Not Found

**Problem:**

```typescript
expect(container.querySelector('svg')).toBeInTheDocument();
// Error: Expected element to be in document
```

**Solution:**

```typescript
// Check rendering
const { container, debug } = render(<SearchIcon />);
debug(); // Print rendered output

// Check correct import
import { SearchIcon } from './SearchIcon';  // ✅
import { SearchIcon } from '@repo/icons';   // ✅
```

#### Issue 2: Snapshot Mismatch

**Problem:**

```
Snapshot mismatch
Expected: width="24"
Received: width="32"
```

**Solution:**

```bash
# Review changes
git diff packages/icons/src/**/__snapshots__

# If intentional, update snapshot
pnpm test -- -u

# If not intentional, fix code
```

#### Issue 3: Accessibility Violations

**Problem:**

```
axe-core: icon-button-label
Button has no accessible name
```

**Solution:**

```typescript
// ❌ Problem
<button>
  <SearchIcon />
</button>

// ✅ Solution
<button aria-label="Search">
  <SearchIcon />
</button>
```

#### Issue 4: Coverage Not Met

**Problem:**

```
Coverage threshold for lines (90%) not met: 85%
```

**Solution:**

```typescript
// Add missing test cases
it('handles edge case', () => {
  // Test uncovered branch
});

// Or exclude file (if justified)
// vitest.config.ts
coverage: {
  exclude: ['src/legacy/*.tsx']
}
```

### Debugging Tests

**Enable verbose output:**

```bash
pnpm test --reporter=verbose
```

**Run single test:**

```bash
pnpm test SearchIcon.test.tsx
```

**Debug in VS Code:**

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal"
}
```

---

## Summary

### Testing Checklist

```
□ Unit tests for all props
□ Snapshot tests for structure
□ Accessibility tests (jest-axe)
□ Integration tests in components
□ Visual regression tests
□ Performance tests
□ 90%+ coverage achieved
□ CI/CD pipeline configured
```

### Key Principles

1. **Test behavior, not implementation**
2. **Use accessible queries**
3. **Test user interactions**
4. **Maintain high coverage**
5. **Automate everything**

### Resources

- **Testing Library:** [testing-library.com](https://testing-library.com)
- **Vitest:** [vitest.dev](https://vitest.dev)
- **jest-axe:** [github.com/nickcolley/jest-axe](https://github.com/nickcolley/jest-axe)
- **Adding icons:** [Adding Icons Guide](./adding-icons.md)
- **Accessibility:** [Accessibility Guide](./accessibility.md)

---

*Last updated: 2025-01-05*
