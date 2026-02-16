# Testing Infrastructure

## Overview

This project uses Vitest as its testing framework, configured with jsdom environment for DOM testing and @testing-library/react for component testing.

## Configuration

### Vitest Config

Located at `vitest.config.ts`, the configuration includes:

- **Environment**: jsdom (simulates browser DOM)
- **Globals**: `describe`, `it`, `expect` available without imports
- **Setup Files**: `./test/setup.tsx` runs before each test file
- **Coverage**: v8 provider with text, JSON, and HTML reports
- **Test Patterns**:
  - `test/**/*.test.ts`
  - `test/**/*.test.tsx`
  - `src/**/*.test.ts`
  - `src/**/*.test.tsx`

### Setup File

`test/setup.tsx` configures:

- **jest-dom matchers**: toBeInTheDocument, toBeVisible, toHaveClass, etc.
- **Automatic cleanup**: Unmounts components after each test

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, expect, it } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = transform(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const { user } = render(<MyComponent />);
    const button = screen.getByRole('button');

    await user.click(button);

    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### Async Testing

```typescript
it('should handle async operations', async () => {
  const promise = fetchData();
  await expect(promise).resolves.toEqual({ data: 'value' });
});

it('should handle rejected promises', async () => {
  const promise = failingOperation();
  await expect(promise).rejects.toThrow('Error message');
});
```

## Available Matchers

### Vitest Matchers

- `toBe()` - Strict equality (===)
- `toEqual()` - Deep equality
- `toContain()` - Array/string contains
- `toHaveLength()` - Array length
- `toMatch()` - String regex match
- `toHaveProperty()` - Object has property
- `toBeTruthy()`, `toBeFalsy()` - Truthiness
- `toBeNull()`, `toBeUndefined()`, `toBeDefined()`

### jest-dom Matchers

- `toBeInTheDocument()` - Element is in DOM
- `toBeVisible()` - Element is visible
- `toHaveClass()` - Element has CSS class
- `toHaveTextContent()` - Element has text
- `toHaveAttribute()` - Element has attribute
- `toHaveStyle()` - Element has CSS styles
- `toBeDisabled()`, `toBeEnabled()` - Form element state
- `toHaveValue()` - Input/select value
- `toBeChecked()` - Checkbox/radio state

## Test Organization

```
test/
├── README.md           # This file
├── setup.tsx           # Test configuration
├── setup.test.ts       # Infrastructure verification
└── [feature]/          # Feature-specific tests
    └── *.test.ts
```

## Best Practices

1. **Follow AAA pattern**: Arrange, Act, Assert
2. **Test behavior, not implementation**: Focus on what the code does, not how
3. **Use descriptive test names**: "should [expected behavior] when [condition]"
4. **Keep tests isolated**: Each test should be independent
5. **Mock external dependencies**: API calls, timers, etc.
6. **Clean up after tests**: Use afterEach for cleanup (handled automatically)
7. **Test edge cases**: Empty inputs, null, undefined, boundaries
8. **Aim for 90%+ coverage**: But quality > quantity

## Troubleshooting

### Tests are slow

- Check for unnecessary async operations
- Use `vi.useFakeTimers()` for timer-based code
- Mock heavy dependencies

### Tests are flaky

- Avoid testing implementation details
- Use `waitFor` for async operations
- Ensure proper cleanup between tests

### Coverage is incomplete

- Check coverage report: `pnpm test:coverage`
- Look for untested branches and edge cases
- Add tests for error paths

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
