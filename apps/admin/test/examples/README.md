# Testing Patterns and Examples

This directory contains example tests that demonstrate best practices and patterns for testing in the admin application.

## Overview

The examples cover three main areas:

1. **API Mocking** (`api-mocking.test.ts`) - How to use MSW to mock API calls
2. **Hook Testing** (`hooks-testing.test.tsx`) - How to test React hooks with API dependencies
3. **Component Testing** (`component-testing.test.tsx`) - How to test React components

## Prerequisites

Before writing tests, ensure you have the following dependencies:

```bash
# Testing libraries
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event

# MSW for API mocking
pnpm add -D msw
```

## Test Setup

The test environment is configured in `test/setup.tsx`:

- MSW server starts automatically before all tests
- Handlers reset after each test for isolation
- Common mocks (Clerk, TanStack Router) are pre-configured

## API Mocking with MSW

### Using Default Handlers

Default handlers are defined in `test/mocks/handlers.ts` and cover all common API endpoints:

```tsx
// Default handlers are already active
const response = await fetch('/api/v1/public/accommodations');
// Returns mock data automatically
```

### Overriding Handlers for Specific Tests

Use `server.use()` to override handlers for specific test scenarios:

```tsx
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { mockErrorResponse } from '../mocks/handlers';

it('should handle API errors', async () => {
    server.use(
        http.get('/api/v1/public/accommodations', () => {
            return HttpResponse.json(
                mockErrorResponse('SERVER_ERROR', 'Database connection failed'),
                { status: 500 }
            );
        })
    );

    // Your test code here
});
```

### Available Mock Factories

```tsx
import {
    mockPaginatedResponse,
    mockSuccessResponse,
    mockErrorResponse,
    mockData
} from '../mocks/handlers';

// For paginated list responses
mockPaginatedResponse([item1, item2], page, pageSize);

// For single item responses
mockSuccessResponse({ id: '1', name: 'Test' });

// For error responses
mockErrorResponse('NOT_FOUND', 'Entity not found');

// Pre-defined mock data
mockData.accommodation;
mockData.destination;
mockData.event;
mockData.post;
mockData.user;
```

## Testing Hooks

### Basic Hook Test

```tsx
import { renderHook, waitFor } from '@testing-library/react';

it('should fetch data', async () => {
    const { result } = renderHook(() => useMyHook());

    // Initial state
    expect(result.current.isLoading).toBe(true);

    // Wait for async operations
    await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
    });

    // Verify final state
    expect(result.current.data).toBeDefined();
});
```

### Testing with Dependencies

```tsx
it('should refetch when ID changes', async () => {
    const { result, rerender } = renderHook(
        ({ id }) => useFetchById(id),
        { initialProps: { id: '1' } }
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    // Change the ID
    rerender({ id: '2' });

    await waitFor(() => {
        expect(result.current.data.id).toBe('2');
    });
});
```

## Testing Components

### Basic Component Test

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should render and handle interactions', async () => {
    const user = userEvent.setup();

    render(<MyComponent />);

    // Wait for loading to complete
    await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Interact with the component
    await user.click(screen.getByRole('button'));

    // Assert results
    expect(screen.getByText('Expected Result')).toBeInTheDocument();
});
```

### Testing Forms

```tsx
it('should submit form successfully', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<CreateForm onSuccess={onSuccess} />);

    // Fill form fields
    await user.type(screen.getByLabelText('Name'), 'New Entity');

    // Submit
    await user.click(screen.getByRole('button', { name: 'Create' }));

    // Verify callback was called
    await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
    });
});
```

### Testing Loading States

```tsx
it('should show loading state during API call', async () => {
    // Add delay to observe loading state
    server.use(
        http.get('/api/v1/endpoint', async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json(mockSuccessResponse(data));
        })
    );

    render(<MyComponent />);

    // Loading state should be visible
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
});
```

## Best Practices

### 1. Use `waitFor` for Async Operations

Always use `waitFor` when testing async operations:

```tsx
// Good
await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
});

// Bad - may cause flaky tests
expect(result.current.isLoading).toBe(false);
```

### 2. Use `userEvent` Instead of `fireEvent`

`userEvent` simulates real user interactions more accurately:

```tsx
// Good
const user = userEvent.setup();
await user.type(input, 'text');
await user.click(button);

// Less preferred
fireEvent.change(input, { target: { value: 'text' } });
fireEvent.click(button);
```

### 3. Test Error States

Always test how components handle errors:

```tsx
it('should display error message', async () => {
    server.use(
        http.get('/api/v1/endpoint', () => {
            return HttpResponse.json(
                mockErrorResponse('NOT_FOUND', 'Not found'),
                { status: 404 }
            );
        })
    );

    render(<MyComponent />);

    await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
});
```

### 4. Use Test IDs for Complex Queries

When `getByRole` or `getByText` aren't suitable:

```tsx
// In component
<div data-testid="entity-list">...</div>

// In test
screen.getByTestId('entity-list');
```

### 5. Reset State Between Tests

MSW handlers reset automatically via `server.resetHandlers()` in afterEach. For component state, use cleanup:

```tsx
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test test/examples/api-mocking.test.ts

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

## Troubleshooting

### Memory Issues

If you encounter memory errors, try:

1. Running tests in smaller batches
2. Using `--pool=forks` option
3. Increasing Node memory: `NODE_OPTIONS="--max-old-space-size=4096"`

### Handler Not Working

Ensure your handler matches the exact URL pattern:

```tsx
// Check that the path matches
http.get('/api/v1/public/accommodations', ...) // Correct
http.get('/api/accommodations', ...)           // Wrong path
```

### Test Isolation Issues

If tests are affecting each other, ensure:

1. `server.resetHandlers()` is called in afterEach
2. Component state is properly cleaned up
3. No global state leaks between tests
