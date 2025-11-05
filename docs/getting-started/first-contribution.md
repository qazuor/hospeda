# First Contribution

This guide will walk you through making your first contribution to Hospeda. You'll learn the complete development workflow by completing a simple, beginner-friendly task.

---

## Prerequisites

Before starting, ensure you've completed:

- [Prerequisites](prerequisites.md) - Tools installed
- [Installation](installation.md) - Project running
- [Development Environment](development-environment.md) - VSCode configured

---

## Time Estimate

**Total time:** 30-60 minutes

- Understanding the task: 5-10 minutes
- Writing code: 10-20 minutes
- Writing tests: 10-15 minutes
- Quality checks: 5-10 minutes
- Creating commit: 5 minutes

---

## Example Task: Add Email Validation

We'll add proper email validation to an existing field. This task teaches:

- Finding code in the monorepo
- Writing Zod schemas
- Following TDD workflow
- Running quality checks
- Creating atomic commits

---

## Step 1: Understand the Task

### Locate the Code

The user schema in `@repo/schemas` has a basic email field. We'll add comprehensive validation.

**Files to modify:**

```text
packages/schemas/src/user/user.schema.ts
packages/schemas/test/user/user.schema.test.ts (create if needed)
```

### Review Current Code

```bash
# Open the schema file
code packages/schemas/src/user/user.schema.ts
```

**Current implementation:**

```typescript
export const userSchema = z.object({
  email: z.string(),
  // ... other fields
});
```

**Problem:** Email accepts any string, including invalid emails

**Solution:** Add proper email validation with helpful error messages

---

## Step 2: Write Tests First (TDD - Red)

Following TDD, we write tests BEFORE implementation.

### Create Test File

```bash
# Create test directory if it doesn't exist
mkdir -p packages/schemas/test/user

# Create test file
touch packages/schemas/test/user/user.schema.test.ts
```

### Write Failing Tests

**File:** `packages/schemas/test/user/user.schema.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { userSchema } from '../../src/user/user.schema';

describe('userSchema', () => {
  describe('email validation', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'john.doe@company.co.uk',
        'admin+test@domain.com',
      ];

      for (const email of validEmails) {
        const result = userSchema.safeParse({
          email,
          // ... other required fields
        });

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        '',
      ];

      for (const email of invalidEmails) {
        const result = userSchema.safeParse({
          email,
          // ... other required fields
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('email');
        }
      }
    });

    it('should provide helpful error messages', () => {
      const result = userSchema.safeParse({
        email: 'invalid-email',
        // ... other required fields
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Please provide a valid email address'
        );
      }
    });
  });
});
```

### Run Tests (Should Fail)

```bash
cd packages/schemas
pnpm test user.schema.test.ts
```

**Expected output:** Tests fail ❌ (RED phase)

---

## Step 3: Implement Solution (TDD - Green)

Now we write the MINIMUM code to make tests pass.

### Update Schema

**File:** `packages/schemas/src/user/user.schema.ts`

```typescript
import { z } from 'zod';

export const userSchema = z.object({
  email: z
    .string()
    .email({ message: 'Please provide a valid email address' })
    .toLowerCase()
    .trim(),
  // ... other fields
});

export type User = z.infer<typeof userSchema>;
```

**Changes:**

- `.email()` - Built-in Zod email validation
- Custom error message
- `.toLowerCase()` - Normalize to lowercase
- `.trim()` - Remove whitespace

### Run Tests Again

```bash
cd packages/schemas
pnpm test user.schema.test.ts
```

**Expected output:** Tests pass ✅ (GREEN phase)

---

## Step 4: Refactor (TDD - Refactor)

Tests pass, but can we improve the code?

### Extract Reusable Schema

**File:** `packages/schemas/src/common/email.schema.ts` (create new)

```typescript
import { z } from 'zod';

/**
 * Reusable email validation schema
 * Validates email format, normalizes to lowercase, and trims whitespace
 */
export const emailSchema = z
  .string()
  .email({ message: 'Please provide a valid email address' })
  .toLowerCase()
  .trim();
```

### Update User Schema

**File:** `packages/schemas/src/user/user.schema.ts`

```typescript
import { z } from 'zod';
import { emailSchema } from '../common/email.schema';

export const userSchema = z.object({
  email: emailSchema,
  // ... other fields
});

export type User = z.infer<typeof userSchema>;
```

### Export from Barrel File

**File:** `packages/schemas/src/common/index.ts`

```typescript
export * from './email.schema';
// ... other exports
```

### Verify Refactoring

Run tests to ensure refactoring didn't break anything:

```bash
cd packages/schemas
pnpm test
```

**Expected:** All tests still pass ✅ (REFACTOR phase complete)

---

## Step 5: Run Quality Checks

Before committing, ensure code meets all standards.

### Type Check

```bash
cd packages/schemas
pnpm typecheck
```

**Expected:** No TypeScript errors

---

### Lint

```bash
cd packages/schemas
pnpm lint
```

**Expected:** No linting errors

---

### Test Coverage

```bash
cd packages/schemas
pnpm test:coverage
```

**Expected:** Coverage ≥90% for modified files

**If below 90%:** Add more test cases

---

### Format

```bash
# From project root
pnpm check
```

**Expected:** All files formatted correctly

---

## Step 6: Verify Changes

### Test in Running App

```bash
# Start API
pnpm dev --filter=api

# In another terminal, test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "Test123!"
  }'
```

**Expected:** Error response with our custom message

```json
{
  "error": {
    "email": "Please provide a valid email address"
  }
}
```

---

## Step 7: Create Commit

### Check Git Status

```bash
git status
```

**Modified files:**

```text
packages/schemas/src/user/user.schema.ts
packages/schemas/src/common/email.schema.ts
packages/schemas/src/common/index.ts
packages/schemas/test/user/user.schema.test.ts
```

### Stage Files

```bash
git add packages/schemas/src/user/user.schema.ts
git add packages/schemas/src/common/email.schema.ts
git add packages/schemas/src/common/index.ts
git add packages/schemas/test/user/user.schema.test.ts
```

### Create Commit

```bash
git commit -m "feat(schemas): add email validation with custom error messages

- Add reusable emailSchema with validation and normalization
- Update userSchema to use emailSchema
- Add comprehensive tests for valid/invalid emails
- Extract common email validation for reuse across schemas

Validates email format, normalizes to lowercase, and trims whitespace.
Provides user-friendly error message for invalid emails."
```

**Commit message structure:**

```text
<type>(<scope>): <subject>

<body>
```

**Types:** feat, fix, docs, refactor, test, chore

---

## Step 8: Verify Commit

### Check Commit

```bash
git log -1
git show HEAD
```

**Verify:**

- Commit message follows convention
- Only relevant files included
- Changes are focused and atomic

### Run Pre-commit Hooks

Hooks ran automatically, but you can test manually:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

---

## What You Learned

Congratulations! You've completed your first contribution. You learned:

### Development Workflow

- ✅ TDD cycle: Red → Green → Refactor
- ✅ Writing tests first
- ✅ Implementing minimal solution
- ✅ Refactoring for code quality

### Code Standards

- ✅ Zod schema validation
- ✅ Type inference from schemas
- ✅ Reusable schema patterns
- ✅ Comprehensive JSDoc comments

### Quality Assurance

- ✅ Running type checks
- ✅ Running linters
- ✅ Ensuring test coverage
- ✅ Manual testing in app

### Git Workflow

- ✅ Atomic commits
- ✅ Conventional commit messages
- ✅ Pre-commit hooks

---

## Next Steps

### Find More Tasks

**Beginner-friendly tasks:**

1. Search GitHub issues with label `good-first-issue`
2. Look for `TODO` comments in codebase
3. Ask in [Discussions](https://github.com/qazuor/hospeda/discussions)

### Level Up

**After 2-3 contributions:**

- Read [Adding a New Entity](../guides/adding-new-entity.md)
- Explore [Architecture Overview](../architecture/overview.md)
- Review [Testing Strategy](../testing/strategy.md)

### Join the Community

- Star the repo ⭐
- Follow project updates
- Help other contributors
- Share your learnings

---

## Common Issues

### Tests Failing

**Problem:** Tests fail unexpectedly

**Solution:**

```bash
# Clean and reinstall
rm -rf node_modules
pnpm install

# Rebuild packages
pnpm build

# Run tests again
pnpm test
```

---

### Type Errors

**Problem:** TypeScript errors in editor

**Solution:**

```bash
# Restart TypeScript server
# VSCode: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Rebuild packages
pnpm build
```

---

### Coverage Too Low

**Problem:** Test coverage below 90%

**Solution:**

Add more test cases:

- Edge cases (empty strings, null, undefined)
- Error cases (invalid input)
- Different valid inputs
- Integration scenarios

---

### Commit Rejected

**Problem:** Pre-commit hook fails

**Solution:**

Check what failed:

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Test
pnpm test

# Format
pnpm check
```

Fix errors, then commit again.

---

## Getting Help

**Stuck on the task?**

- Review [Development Environment](development-environment.md)
- Check [Common Tasks](common-tasks.md)
- Ask in [GitHub Discussions](https://github.com/qazuor/hospeda/discussions)

**Found a bug?**

- [Report an issue](https://github.com/qazuor/hospeda/issues/new)

---

**Completed your first contribution?** 🎉

Next, explore:

- [Common Tasks](common-tasks.md) - Frequent commands
- [Adding a New Entity](../guides/adding-new-entity.md) - End-to-end tutorial
- [Architecture Overview](../architecture/overview.md) - System design
