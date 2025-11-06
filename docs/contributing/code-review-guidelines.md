# Code Review Guidelines

This guide explains how to conduct effective code reviews at Hospeda, what to look for, and how to provide constructive feedback.

## Table of Contents

- [Overview](#overview)
- [Why Code Reviews](#why-code-reviews)
- [Reviewer Responsibilities](#reviewer-responsibilities)
- [What to Review](#what-to-review)
- [Review Checklist](#review-checklist)
- [How to Give Feedback](#how-to-give-feedback)
- [Common Review Comments](#common-review-comments)
- [Handling Disagreements](#handling-disagreements)
- [Auto-Merge Conditions](#auto-merge-conditions)
- [Blocking vs Non-Blocking](#blocking-vs-non-blocking)

## Overview

**Current Status**: We don't use formal code reviews yet (all work on `main` branch).

**Future Process**: As the team grows, code reviews will be mandatory for:

- All pull requests
- Breaking changes (always)
- Architecture changes
- Security-sensitive code
- Performance-critical code

**Goals of Code Review**:

- Catch bugs before production
- Maintain code quality
- Share knowledge across team
- Enforce standards
- Improve team skills

## Why Code Reviews?

### Benefits for the Project

**Quality Assurance**:

- Catch bugs early (cheaper to fix)
- Ensure tests cover edge cases
- Verify error handling
- Check security vulnerabilities
- Validate performance

**Consistency**:

- Enforce code standards
- Maintain architectural patterns
- Ensure naming conventions
- Verify documentation completeness

**Knowledge Sharing**:

- Team learns from each other
- Domain knowledge spreads
- Best practices propagate
- New patterns discovered

### Benefits for Contributors

**Learning**:

- Learn from reviewer feedback
- Discover new approaches
- Understand team conventions
- Improve coding skills

**Confidence**:

- Second pair of eyes reduces anxiety
- Validation from experienced developers
- Catch mistakes before production
- Learn what to focus on

**Collaboration**:

- Discussion improves solutions
- Team bonding through feedback
- Shared ownership of code
- Build trust and respect

## Reviewer Responsibilities

### 1. Review Promptly

**Target**: Within 24 hours (business days)

**Why it matters**:

- Contributor is waiting
- Context is fresh
- Momentum maintained
- Faster delivery

**If you can't review soon**:

```markdown
Thanks for the PR! I'm tied up until tomorrow, but I'll review by EOD Tuesday.
```

### 2. Be Respectful and Constructive

**Remember**:

- You're reviewing code, not the person
- Everyone makes mistakes
- Different approaches can be valid
- Learning opportunity for both sides

**Good tone**:

```markdown
✅ "Consider extracting this to a helper function for better testability."
✅ "I'm curious why you chose approach X over Y. Could you explain?"
✅ "Great use of type guards here!"
```

**Poor tone**:

```markdown
❌ "This code is terrible."
❌ "Why would you do it this way?"
❌ "Obviously this is wrong."
```

### 3. Explain Your Reasoning

**Don't just say WHAT is wrong, explain WHY.**

**Good**:

```markdown
✅ "This should use `unknown` instead of `any` because:
   1. `any` disables type checking
   2. We lose TypeScript's safety guarantees
   3. Bugs can slip through undetected"
```

**Poor**:

```markdown
❌ "Don't use `any`."
```

### 4. Approve When Satisfied

**Don't block if**:

- All critical issues addressed
- Standards are followed
- Tests pass and cover changes
- Documentation is adequate

**It's okay if**:

- Minor nitpicks remain
- Different style preferences
- Small optimizations possible

**Perfection isn't required** - good enough is good enough.

## What to Review

### 1. Correctness

**Does the code do what it's supposed to?**

- [ ] Logic is correct
- [ ] Edge cases handled
- [ ] Error conditions covered
- [ ] Business requirements met
- [ ] No obvious bugs

**Example review**:

```typescript
// Code being reviewed
function calculateDiscount(price: number, discountPercent: number): number {
  return price - (price * discountPercent);
}

// Review comment:
```

```markdown
**MUST**: Discount calculation is incorrect.

`discountPercent` appears to be a whole number (e.g., 20 for 20%),
but your calculation treats it as a decimal.

Should be:
```typescript
return price - (price * (discountPercent / 100));
```

Or update function signature to clarify:
```typescript
function calculateDiscount(price: number, discountRate: number): number {
  // discountRate is decimal (0.20 for 20%)
  return price - (price * discountRate);
}
```
```

### 2. Testing

**Are there adequate tests?**

- [ ] Tests exist for new code
- [ ] Tests cover happy path
- [ ] Tests cover edge cases
- [ ] Tests cover error conditions
- [ ] Coverage ≥ 90%
- [ ] Tests are clear and readable
- [ ] Test names describe what they test

**Example review**:

```markdown
**MUST**: Add tests for error cases.

Current tests only cover successful booking creation.
Please add tests for:

1. Invalid date range (check-out before check-in)
2. Accommodation not available
3. User not verified
4. Payment processing failure

Example:
```typescript
it('should throw ValidationError when check-out is before check-in', async () => {
  await expect(
    bookingService.create({
      checkIn: '2024-01-20',
      checkOut: '2024-01-15', // Before check-in!
      accommodationId: 'acc-123',
    })
  ).rejects.toThrow(ValidationError);
});
```
```

### 3. Code Quality

**Does the code follow our standards?**

- [ ] English only (code, comments, docs)
- [ ] No `any` types
- [ ] Named exports only
- [ ] RO-RO pattern (3+ params)
- [ ] Files under 500 lines
- [ ] Proper naming conventions
- [ ] JSDoc on exports
- [ ] No magic numbers
- [ ] No commented code
- [ ] No `console.log`

**Example review**:

```markdown
**MUST**: This function violates the RO-RO pattern.

Function has 5 parameters - should receive an object instead:

Current:
```typescript
function createBooking(
  userId: string,
  accommodationId: string,
  checkIn: string,
  checkOut: string,
  guests: number
): Promise<Booking>
```

Should be:
```typescript
function createBooking(input: {
  userId: string;
  accommodationId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}): Promise<Booking>
```

Benefits:
- Named parameters (self-documenting)
- Order independent
- Easy to add optional parameters
```

### 4. Performance

**Are there performance concerns?**

- [ ] No N+1 queries
- [ ] Appropriate indexing
- [ ] Efficient algorithms
- [ ] No unnecessary loops
- [ ] Caching where appropriate
- [ ] Pagination for large datasets

**Example review**:

```markdown
**SHOULD**: This creates an N+1 query problem.

Current code:
```typescript
const users = await userModel.findAll();
for (const user of users) {
  user.bookings = await bookingModel.findByUserId({ userId: user.id });
  // 1 query for users + N queries for bookings = N+1
}
```

Better approach:
```typescript
const users = await userModel.findAll();
const userIds = users.map(u => u.id);
const allBookings = await bookingModel.findByUserIds({ userIds });

// Group bookings by userId
const bookingsByUserId = groupBy(allBookings, 'userId');
users.forEach(user => {
  user.bookings = bookingsByUserId[user.id] || [];
});
// Only 2 queries total
```

Or use a join:
```typescript
const users = await db
  .select()
  .from(usersTable)
  .leftJoin(bookingsTable, eq(usersTable.id, bookingsTable.userId));
// 1 query total
```
```

### 5. Security

**Are there security vulnerabilities?**

- [ ] Input validation present
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (sanitized output)
- [ ] Authentication checked
- [ ] Authorization verified
- [ ] Sensitive data not logged
- [ ] Rate limiting on public endpoints

**Example review**:

```markdown
**MUST**: This is vulnerable to SQL injection.

Current code:
```typescript
const query = `SELECT * FROM users WHERE email = '${email}'`;
const users = await db.execute(query);
```

An attacker could input:
```
email = "'; DROP TABLE users; --"
```

Use parameterized queries:
```typescript
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, email));
```

Drizzle automatically escapes parameters.
```

### 6. Documentation

**Is the code well-documented?**

- [ ] JSDoc on all exports
- [ ] Complex logic explained
- [ ] WHY documented (not just WHAT)
- [ ] Examples provided
- [ ] API docs updated
- [ ] README updated

**Example review**:

```markdown
**MUST**: Add JSDoc to this export.

```typescript
/**
 * Calculate dynamic pricing based on demand and seasonality
 *
 * Applies seasonal multipliers and demand-based pricing to base rate.
 * Weekend nights incur a 20% surcharge.
 *
 * @param input - Pricing calculation parameters
 * @param input.accommodationId - Accommodation identifier
 * @param input.checkIn - Check-in date (ISO 8601)
 * @param input.checkOut - Check-out date (ISO 8601)
 * @returns Price breakdown including base, surcharges, and total
 *
 * @example
 * ```typescript
 * const pricing = calculateDynamicPrice({
 *   accommodationId: 'acc-123',
 *   checkIn: '2024-01-15',
 *   checkOut: '2024-01-20',
 * });
 * console.log(pricing.total); // 650.00
 * ```
 */
export function calculateDynamicPrice(input: {
  accommodationId: string;
  checkIn: string;
  checkOut: string;
}): PriceBreakdown {
  // Implementation
}
```
```

### 7. Naming

**Are names clear and descriptive?**

- [ ] Variables: `camelCase`, descriptive
- [ ] Functions: verb + noun
- [ ] Classes: `PascalCase`, noun
- [ ] Constants: `SCREAMING_SNAKE_CASE`
- [ ] Booleans: `is/has/should` prefix
- [ ] No abbreviations (unless common)

**Example review**:

```markdown
**NITS**: These names could be more descriptive.

Current:
```typescript
const data = await fetch(url);
const result = process(data);
const flag = check(result);
```

Suggested:
```typescript
const userProfile = await fetchUserProfile(userId);
const validationResult = validateUserProfile(userProfile);
const isProfileComplete = checkProfileCompleteness(validationResult);
```

More specific names make code self-documenting.
```

### 8. Error Handling

**Are errors handled properly?**

- [ ] Try/catch blocks present
- [ ] Errors not swallowed
- [ ] Meaningful error messages
- [ ] Custom error classes used
- [ ] Error logging present
- [ ] Errors re-thrown appropriately

**Example review**:

```markdown
**MUST**: Don't swallow errors.

Current code:
```typescript
try {
  await sendEmail(user.email, 'Welcome');
} catch (error) {
  // Silently ignored - bad!
}
```

Should either:

1. Log and re-throw (if critical):
```typescript
try {
  await sendEmail(user.email, 'Welcome');
} catch (error) {
  logger.error('Failed to send welcome email', { error, userId: user.id });
  throw new EmailDeliveryError('Welcome email failed', { cause: error });
}
```

2. Log and continue (if non-critical):
```typescript
try {
  await sendEmail(user.email, 'Welcome');
} catch (error) {
  logger.error('Failed to send welcome email', { error, userId: user.id });
  // Continue - user was created successfully, email can be retried
}
```

Never silently ignore errors.
```

### 9. Edge Cases

**Are edge cases considered?**

- [ ] Empty arrays/strings
- [ ] Null/undefined values
- [ ] Very large numbers
- [ ] Negative numbers
- [ ] Boundary conditions
- [ ] Race conditions

**Example review**:

```markdown
**SHOULD**: Consider edge case for empty array.

Current code:
```typescript
function calculateAverage(numbers: number[]): number {
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return sum / numbers.length;
}
```

Edge case: What if `numbers` is empty?
`sum / 0 = Infinity`

Suggested:
```typescript
function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new ValidationError('Cannot calculate average of empty array', 'numbers');
  }

  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return sum / numbers.length;
}
```

Or return `null`:
```typescript
function calculateAverage(numbers: number[]): number | null {
  if (numbers.length === 0) {
    return null;
  }

  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return sum / numbers.length;
}
```
```

### 10. Type Safety

**Is the code type-safe?**

- [ ] No `any` types
- [ ] Type guards used for `unknown`
- [ ] Proper return types
- [ ] No type assertions without reason
- [ ] Types inferred from Zod schemas

**Example review**:

```markdown
**MUST**: Don't use type assertion here.

Current code:
```typescript
const user = await fetchUser(userId) as User;
```

Problem: What if `fetchUser` returns `null`?
Type assertion bypasses type checking.

Better:
```typescript
const user = await fetchUser(userId);
if (!user) {
  throw new NotFoundError('User not found', 'User', userId);
}
// TypeScript now knows user is not null
```

Or if API returns unknown data:
```typescript
const rawData = await fetchUser(userId);
const user = userSchema.parse(rawData); // Validates and types
```
```

## Review Checklist

**Copy this checklist for each review:**

### Correctness

- [ ] Logic is correct
- [ ] Edge cases handled
- [ ] Error conditions covered
- [ ] Business requirements met
- [ ] No obvious bugs

### Testing

- [ ] Tests exist for new code
- [ ] Tests cover edge cases
- [ ] Tests cover error conditions
- [ ] Coverage ≥ 90%
- [ ] Tests are clear

### Code Standards

- [ ] English only (code/comments)
- [ ] No `any` types
- [ ] Named exports only
- [ ] RO-RO pattern (3+ params)
- [ ] Files under 500 lines
- [ ] Proper naming conventions
- [ ] JSDoc on exports
- [ ] No magic numbers
- [ ] No commented code
- [ ] No `console.log`

### Performance

- [ ] No N+1 queries
- [ ] Efficient algorithms
- [ ] Appropriate caching
- [ ] Pagination for large datasets

### Security

- [ ] Input validation present
- [ ] SQL injection prevented
- [ ] Authentication checked
- [ ] Authorization verified
- [ ] Sensitive data not logged

### Documentation

- [ ] JSDoc on exports
- [ ] Complex logic explained
- [ ] WHY documented
- [ ] Examples provided
- [ ] API docs updated

### Error Handling

- [ ] Try/catch blocks present
- [ ] Errors not swallowed
- [ ] Meaningful error messages
- [ ] Custom error classes used
- [ ] Error logging present

### Atomic Commits

- [ ] Only task-related files committed
- [ ] Conventional commit messages
- [ ] Commits are logically separate
- [ ] Commit messages descriptive

## How to Give Feedback

### Use Prefixes for Clarity

**MUST**: Required change (blocking)

```markdown
**MUST**: Fix this SQL injection vulnerability.
```

**SHOULD**: Strong suggestion (consider carefully)

```markdown
**SHOULD**: Extract this to a helper function for reusability.
```

**NITS**: Minor nitpick (optional)

```markdown
**NITS**: This variable could be renamed to `isUserActive` for clarity.
```

**QUESTION**: Seeking clarification

```markdown
**QUESTION**: Why did you choose approach X over Y?
```

**PRAISE**: Positive feedback

```markdown
**PRAISE**: Great use of type guards here! Very readable.
```

### Be Specific

**Reference line numbers:**

```markdown
Line 45: **MUST**: Use parameterized query to prevent SQL injection.
```

**Quote code:**

```markdown
```typescript
const query = `SELECT * FROM users WHERE email = '${email}'`;
```

**MUST**: This is vulnerable to SQL injection.
```

### Explain WHY

**Don't just say WHAT is wrong:**

```markdown
❌ "Don't use `any`."
```

**Explain the reasoning:**

```markdown
✅ "Use `unknown` with type guards instead of `any` because:
   1. `any` disables TypeScript's type checking
   2. We lose compile-time safety
   3. Runtime bugs can slip through undetected

   Example:
   ```typescript
   function processData(data: unknown): string {
     if (typeof data === 'string') {
       return data;
     }
     throw new Error('Expected string');
   }
   ```"
```

### Suggest Alternatives

**Don't just point out problems:**

```markdown
❌ "This function is too complex."
```

**Provide solutions:**

```markdown
✅ "This function has high cyclomatic complexity (15).

   Consider extracting validation logic:

   ```typescript
   function validateBooking(input: BookingInput): void {
     validateDates(input.checkIn, input.checkOut);
     validateGuests(input.guests);
     validateAccommodation(input.accommodationId);
   }

   function createBooking(input: BookingInput): Booking {
     validateBooking(input); // Extracted
     // ... rest of logic
   }
   ```

   Benefits:
   - Each function has single responsibility
   - Easier to test
   - More reusable"
```

### Praise Good Work

**Don't only point out problems:**

```markdown
**PRAISE**: Excellent test coverage here! I especially like how you tested
the edge case for empty arrays. The descriptive test names make it very
clear what's being tested.
```

**Positive feedback**:

- Motivates contributors
- Reinforces good practices
- Builds team morale
- Shows what to repeat

### Ask Questions

**Instead of demanding:**

```markdown
❌ "This is wrong. Do it this way instead."
```

**Ask and discuss:**

```markdown
✅ "I'm curious about this approach. Have you considered using X instead of Y?

I think X might be better here because:
- Reason 1
- Reason 2

But maybe there's a reason for Y that I'm missing?
What do you think?"
```

### Provide Resources

**Link to documentation:**

```markdown
This violates our RO-RO pattern. See:
- [Code Standards](./code-standards.md#ro-ro-pattern)
- [Why RO-RO?](https://www.example.com/ro-ro-pattern)
```

**Share examples:**

```markdown
Here's how we handle this pattern in `UserService`:
[Link to UserService](../packages/service-core/src/services/user.service.ts#L45-L67)
```

## Common Review Comments

### Code Quality

```markdown
**MUST**: Remove `any` type.

Use `unknown` with type guards:
```typescript
function processData(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  throw new Error('Expected string');
}
```

See: [Code Standards - No Any](./code-standards.md#no-any-type)
```

```markdown
**MUST**: Use named export instead of default export.

Current:
```typescript
export default class UserService { }
```

Should be:
```typescript
export class UserService { }
```

See: [Code Standards - Named Exports](./code-standards.md#named-exports-only)
```

```markdown
**SHOULD**: Extract magic number to constant.

Current:
```typescript
if (age < 18) { ... }
```

Better:
```typescript
const MINIMUM_AGE = 18;
if (age < MINIMUM_AGE) { ... }
```
```

### Testing

```markdown
**MUST**: Add tests for this new function.

Please add:
1. Happy path test
2. Edge case tests (empty input, null, etc.)
3. Error condition tests

Example:
```typescript
describe('calculateDiscount', () => {
  it('should calculate discount correctly', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });

  it('should handle 0 discount', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });

  it('should throw for negative discount', () => {
    expect(() => calculateDiscount(100, -10)).toThrow();
  });
});
```
```

```markdown
**SHOULD**: Improve test name for clarity.

Current:
```typescript
it('should work', () => { ... });
```

Better:
```typescript
it('should return 404 when user does not exist', () => { ... });
```

Test names should describe:
- What is being tested
- Under what conditions
- What the expected outcome is
```

### Performance

```markdown
**MUST**: Fix N+1 query problem.

See my comment on line 45 for suggested fix using joins.

This will reduce queries from 1 + N to just 1.
```

```markdown
**SHOULD**: Add pagination here.

Loading all bookings could cause memory issues with large datasets.

Suggested:
```typescript
async function getBookings(input: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Booking>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;

  const bookings = await db
    .select()
    .from(bookingsTable)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const total = await db
    .select({ count: count() })
    .from(bookingsTable);

  return {
    data: bookings,
    pagination: {
      page,
      pageSize,
      total: total[0].count,
      totalPages: Math.ceil(total[0].count / pageSize),
    },
  };
}
```
```

### Security

```markdown
**MUST**: Add input validation.

User-provided data should be validated before use.

Use Zod schema:
```typescript
const createBookingSchema = z.object({
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().int().positive().max(20),
});

const input = createBookingSchema.parse(req.body);
```
```

```markdown
**MUST**: Don't log sensitive data.

Current:
```typescript
logger.info('User login', { email, password });
```

Remove `password` from logs:
```typescript
logger.info('User login', { email });
```

Never log:
- Passwords
- Credit card numbers
- API keys
- Personal data (unless necessary)
```

### Documentation

```markdown
**MUST**: Add JSDoc to this export.

See: [Code Standards - JSDoc](./code-standards.md#jsdoc-requirements)

Example:
```typescript
/**
 * Create a new booking for accommodation
 *
 * Validates availability, processes payment, and sends confirmation email.
 *
 * @param input - Booking creation parameters
 * @returns Created booking with payment details
 * @throws {ValidationError} If dates or availability invalid
 * @throws {PaymentError} If payment processing fails
 */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  // Implementation
}
```
```

## Handling Disagreements

### When You Disagree with Feedback

**Stay Professional:**

```markdown
I appreciate the feedback! I have a different perspective on this.

I chose approach X because:
1. Reason 1
2. Reason 2

However, I'm open to approach Y if there are benefits I'm not seeing.
Could you explain more about why Y would be better?
```

### When Contributor Disagrees with You

**Be Open:**

```markdown
That's a good point! I hadn't considered [aspect].

You're right that approach Y has [benefits]. Let's go with your approach.
```

**Or if you still disagree:**

```markdown
I understand your reasoning. However, I still think approach X is better
because [reasons].

Since this is an architectural decision, let's get input from @tech-lead.

@tech-lead What do you think about approach X vs Y for this use case?
```

### Escalation

**When to involve tech lead:**

- Architectural decisions
- Breaking changes
- Significant performance implications
- Security concerns
- Can't reach agreement

**How to escalate:**

```markdown
@tech-lead We have a disagreement about [topic] that we'd like your input on.

**Option A** (current PR):
- Pros: X, Y
- Cons: A, B

**Option B** (suggested):
- Pros: M, N
- Cons: P, Q

Context: [Explanation]

What's your recommendation?
```

## Auto-Merge Conditions

**Small changes can be auto-merged without review:**

### Safe to Auto-Merge

- [ ] Documentation-only changes
- [ ] Typo fixes in comments
- [ ] Formatting changes (Biome)
- [ ] Dependency updates (non-breaking)
- [ ] Configuration updates (low-risk)
- [ ] All CI/CD checks passing

**Example:**

```markdown
Merging without review:
- Documentation update only
- All checks passing
- No code changes
```

### Require Review

- [ ] Code changes
- [ ] API changes
- [ ] Database changes
- [ ] Configuration changes (high-risk)
- [ ] Breaking changes
- [ ] Security-related changes

## Blocking vs Non-Blocking

### Blocking Issues (Must Fix)

**Security vulnerabilities:**

- SQL injection
- XSS vulnerabilities
- Authentication bypass
- Authorization issues
- Sensitive data exposure

**Critical bugs:**

- Data corruption
- System crashes
- Incorrect business logic
- Breaking changes

**Standard violations:**

- `any` types
- Default exports
- Missing tests (< 90% coverage)
- No JSDoc on exports

**Action**: Request changes, don't approve until fixed.

### Non-Blocking Issues (Nice to Have)

**Minor optimizations:**

- Could be slightly faster
- Could use less memory
- Alternative approach possible

**Style preferences:**

- Variable naming (if not violating standards)
- Code organization (if reasonable)
- Comment phrasing

**Optional improvements:**

- Additional tests (if already at 90%+)
- Extra documentation
- Refactoring opportunities

**Action**: Approve PR, create follow-up issue if important.

---

## Summary

**Great code reviews**:

- Are prompt (within 24 hours)
- Are respectful and constructive
- Explain reasoning
- Provide specific feedback
- Suggest alternatives
- Praise good work
- Focus on important issues
- Don't block unnecessarily

**Remember**:

- Review code, not people
- Everyone makes mistakes
- Different approaches can be valid
- Learning opportunity for everyone
- Goal is better code, not perfect code

---

## Further Reading

- [Code Standards](./code-standards.md)
- [Git Workflow](./git-workflow.md)
- [Pull Request Process](./pull-request-process.md)
- [How to Do Code Reviews Like a Human](https://mtlynch.io/human-code-reviews-1/)
- [Google's Code Review Guidelines](https://google.github.io/eng-practices/review/)

---

*Last updated: 2025-01-15*
