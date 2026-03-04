# Testing Standards (Quick Reference)

> Concise rules for AI agents. Full details: [docs/testing/](../../docs/testing/)

## Core Rules

- **Test-Informed Development**: Tests are mandatory. Timing depends on context:
  - **Pure logic** (services, utils, schemas): Write tests first when practical (TDD style)
  - **Integration code** (routes, components, wiring): Write tests alongside implementation
  - **Bug fixes**: ALWAYS write a regression test reproducing the bug before fixing
- **AAA pattern**: Arrange, Act, Assert
- **Coverage**: Minimum 90%
- **No tests = Not done**: A task is NEVER complete without tests
- **Run tests before committing**: `pnpm test`

## Test Types

### Unit Tests

- Tool: Vitest
- Location: `test/` directories alongside or within `src/`
- Test isolated functions, services, utilities
- Mock external dependencies

### Component Tests (Astro)

- Read source file with `readFileSync`, verify structure/props/styling
- Check for required CSS classes, ARIA attributes, prop types
- No DOM rendering needed

### Component Tests (React)

- Tool: `@testing-library/react`
- Test user interactions, rendering, state changes
- Prefer `getByRole`, `getByText` over `getByTestId`

### Integration Tests

- Test API routes with `app.request()`
- Test auth flows, middleware chains
- Test service interactions with DB

## File Naming

- `*.test.ts` for unit/integration tests
- `*.test.tsx` for component tests
- Mirror source file structure in test directory

## Patterns

- Use `describe` blocks for grouping (by feature/method)
- Use `it` for individual test cases
- Descriptive test names: `it('should return 404 when entity not found')`
- One assertion concept per test (multiple `expect` OK if testing same concept)
- Use test factories for complex test data
- Clean up after tests (no shared mutable state)

## What to Test

- Happy path
- Error cases and edge cases
- Input validation (invalid data, missing fields)
- Auth/permission checks
- Pagination boundaries
- Empty states

## What NOT to Test

- External library internals
- TypeScript type checking (compiler does this)
- Simple getters/setters with no logic
