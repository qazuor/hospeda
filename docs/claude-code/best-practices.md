# Best Practices for AI-Assisted Development

## Overview

This guide contains battle-tested patterns and practices for effective AI-assisted development with Claude Code in the Hospeda project. These practices emerged from real-world usage and help maximize productivity while maintaining code quality.

## Effective Prompting

### Be Specific and Clear

The quality of Claude's output directly correlates with the clarity of your prompts.

#### ✅ DO: Provide Specific Details

```text
Create a BookingService in packages/service-core/src/services/booking/ that:

1. Extends BaseCrudService<Booking, BookingModel, ...>
2. Includes methods:
   - create(): Validates availability, creates booking, sends confirmation
   - cancel(): Checks cancellation policy, processes refund, updates status
   - checkAvailability(): Queries overlapping bookings for date range

3. Include comprehensive tests in test/services/booking/
4. Follow existing patterns from AccommodationService
5. Ensure 90%+ test coverage
```

#### ❌ DON'T: Be Vague

```text
Create a booking service
```

**Why it matters:**

- Specific prompts → Accurate results → Less iteration
- Vague prompts → Generic code → More revision cycles

### Provide Context

Help Claude understand your situation.

#### ✅ DO: Include Relevant Context

```text
I'm getting a type error in packages/db/src/models/booking.model.ts at line 45:

Type 'Date' is not assignable to type 'string'

The BookingModel.create() method receives dates as ISO strings from the API,
but the database schema expects Date objects. How should I handle this conversion?

Current code:
```typescript
async create(data: CreateBookingInput): Promise<Result<Booking>> {
  const result = await db.insert(bookings).values(data).returning();
  return Ok(result[0]);
}
```

Context:
- API receives ISO 8601 strings
- Drizzle schema uses timestamp columns
- Other models use parseDate() utility
```

#### ❌ DON'T: Omit Context

```text
Fix this type error
```

**What to include:**

1. **File path**: Exact location of code
2. **Error message**: Complete error text
3. **Relevant code**: Surrounding context
4. **What you tried**: Previous attempts (if any)
5. **Constraints**: Requirements or limitations

### Break Down Complex Tasks

Tackle large tasks incrementally.

#### ✅ DO: Break Into Steps

```text
I need to implement the booking system. Let's do this in phases:

Phase 1: Database Foundation
- Create Zod schema for bookings
- Create Drizzle schema with foreign keys
- Add migration
- Create BookingModel extending BaseModel

Let's start with Phase 1. After we complete it, we'll move to Phase 2 (service layer).
```

#### ❌ DON'T: Request Everything at Once

```text
Implement the complete booking system with database, service, API,
frontend components, tests, and documentation.
```

**Benefits of breaking down:**

- Easier to review and validate each step
- Can adjust approach based on results
- Reduces token usage per interaction
- Clearer progress tracking

### Use Proper Terminology

Use correct technical terms for precision.

#### ✅ DO: Use Accurate Terms

```text
Create a React Server Component that:
1. Fetches accommodations using TanStack Query
2. Implements optimistic updates for favorites
3. Uses Suspense boundaries for loading states
4. Includes error boundaries for error handling
5. Follows Shadcn UI Card component pattern
```

#### ❌ DON'T: Use Ambiguous Language

```text
Make a component that shows the accommodations with the card thing
and loading spinner when it loads
```

**Hospeda-specific terminology:**

- **RO-RO pattern**: Receive Object, Return Object
- **BaseCrudService**: Base class for services
- **BaseModel**: Base class for models
- **Result<T>**: Ok/Err wrapper type
- **ServiceContext**: Context with actor and logger
- **Atomic commits**: Single-purpose commits

### Reference Files and Line Numbers

Be precise about locations.

#### ✅ DO: Provide Exact References

```text
In packages/service-core/src/services/accommodation/accommodation.service.ts
at line 127-145, the checkAvailability() method has a bug.

It's checking:
```typescript
if (booking.checkIn >= checkIn && booking.checkOut <= checkOut)
```

But it should detect ANY overlap, not just bookings completely within the range.

Please fix the overlap detection logic.
```

#### ❌ DON'T: Be Imprecise

```text
There's a bug in the availability check somewhere in the accommodation service
```

### Use Examples

Show Claude what you want.

#### ✅ DO: Provide Examples

```text
Create a utility function formatDateRange that takes two dates and returns
a human-readable range.

Examples:
- Same day: "Jan 15, 2024"
- Same month: "Jan 15-20, 2024"
- Different months: "Jan 15 - Feb 5, 2024"
- Different years: "Dec 25, 2023 - Jan 5, 2024"

Use Spanish locale (es-AR) and follow the pattern in existing
formatDate() utility.
```

#### ❌ DON'T: Skip Examples

```text
Create a function that formats date ranges
```

## Working with Agents

### When to Invoke Agents

Use agents for specialized tasks outside general conversation.

#### Use Agents When

**✅ You need specialized expertise:**

```text
Task: Invoke db-drizzle-engineer agent to design the subscription
schema with:
- Recurring billing support
- Trial periods
- Multiple pricing tiers
- Usage tracking
```

**✅ You want consistent patterns:**

```text
Task: Invoke hono-engineer agent to create CRUD endpoints for
subscriptions following the same pattern as accommodations
```

**✅ You need thorough output:**

```text
Task: Invoke qa-engineer agent to create comprehensive test suite
for SubscriptionService including edge cases and error scenarios
```

#### Don't Use Agents When

**❌ Simple questions:**

```text
# Just ask directly:
"What's the difference between .infer() and .parse() in Zod?"

# Don't:
Task: Invoke node-typescript-engineer agent to explain Zod inference
```

**❌ Quick clarifications:**

```text
# Just ask:
"Show me the AccommodationModel implementation"

# Don't:
Task: Invoke db-drizzle-engineer agent to show AccommodationModel
```

### How to Provide Clear Requirements

Be specific about what the agent should deliver.

#### ✅ DO: Detailed Requirements

```text
Task: Invoke product-functional agent to create a PDR for the
subscription feature with:

1. User Stories:
   - As a host, I want to subscribe to premium features
   - As a host, I want to try premium for 14 days free
   - As an admin, I want to track subscription revenue

2. Acceptance Criteria:
   - Support monthly/yearly billing
   - Include 14-day trial period
   - Accept credit cards via Mercado Pago
   - Send email on subscription changes

3. Scope:
   - Initial release: Basic subscription only
   - Future: Usage-based billing, multiple tiers
```

#### ❌ DON'T: Vague Requests

```text
Task: Invoke product-functional agent to create a PDR for subscriptions
```

### Reviewing Agent Output

Always review and validate agent work.

#### Review Checklist

1. **Correctness**
   - Does it meet requirements?
   - Are there logical errors?
   - Does it handle edge cases?

2. **Consistency**
   - Follows project patterns?
   - Matches existing code style?
   - Uses correct terminology?

3. **Completeness**
   - All requirements addressed?
   - Tests included?
   - Documentation added?

4. **Quality**
   - Type-safe?
   - Proper error handling?
   - Performance considerations?

#### Example Review Process

```text
# 1. Request
Task: Invoke hono-engineer agent to create POST /bookings endpoint

# 2. Review Response
- ✓ Uses createRoute factory
- ✓ Validates with bookingSchema
- ✓ Calls BookingService.create()
- ✓ Returns 201 on success
- ⚠ Missing rate limiting
- ✗ No authentication check

# 3. Request Improvements
"Add authentication middleware and rate limiting (10 req/min per user)"

# 4. Verify Updates
- ✓ Added requireAuth() middleware
- ✓ Added rateLimit() middleware
- ✓ All requirements met

# 5. Approve
"Looks good! Please generate tests."
```

### Iterating on Agent Work

Refine incrementally.

#### ✅ DO: Iterative Refinement

```text
# Initial request
Task: Invoke ux-ui-designer agent to create booking form mockup

# Review
"Good start! Please adjust:
1. Move payment info to separate step
2. Add date availability calendar
3. Show price breakdown as user types"

# Review again
"Much better! One more change:
- Add guest count selector with +/- buttons
- Show error messages inline below fields"

# Final approval
"Perfect! This matches our design system."
```

#### ❌ DON'T: Expect Perfection First Time

```text
Task: Invoke ux-ui-designer agent to create perfect booking form

# Then complain when it's not exactly what you wanted
"This isn't what I wanted at all!"
```

## Working with Commands

### Understanding Command Purpose

Each command has a specific purpose.

#### Planning Commands

- `/start-feature-plan` - Complex multi-day features
- `/start-refactor-plan` - Major refactoring efforts
- `/sync-planning-github` - Sync planning to Linear

**When to use:** Beginning of Level 3 workflows

#### Quality Commands

- `/quality-check` - Full quality validation
- `/code-check` - Quick code quality check (no tests)
- `/run-tests` - Test execution with coverage

**When to use:** Before commits, during development

#### Development Commands

- `/add-new-entity` - Scaffold complete entity
- `/update-docs` - Update documentation

**When to use:** Creating entities, maintaining docs

#### Git Commands

- `/commit` - Generate commit messages

**When to use:** Ready to commit changes

#### Audit Commands

- `/audit:security-audit` - Security scan
- `/audit:performance-audit` - Performance analysis
- `/audit:accessibility-audit` - Accessibility check

**When to use:** Periodic audits, before releases

### Command Composition

Combine commands for workflows.

#### ✅ DO: Use Commands in Sequence

```bash
# Before committing:
/code-check           # 1. Verify code quality
/run-tests            # 2. Run tests
/commit               # 3. Generate commit message
```

```bash
# New feature workflow:
/start-feature-plan   # 1. Plan feature
# ... implement ...
/quality-check        # 2. Validate quality
/update-docs          # 3. Update documentation
/commit               # 4. Commit changes
```

#### Command Error Handling

Commands may fail - handle gracefully.

```text
# If /quality-check fails:
1. Review error messages
2. Fix issues
3. Re-run /quality-check
4. Proceed when all checks pass

# Don't:
- Skip quality checks
- Commit failing code
- Ignore warnings
```

### Custom Commands

You can request new commands for repeated workflows.

#### Example: Creating Custom Command

```text
I frequently need to create new API endpoints following the same pattern.
Can we create a /add-api-endpoint command that:

1. Asks for entity name
2. Creates route file with CRUD endpoints
3. Adds to route registry
4. Generates tests
5. Updates API documentation

Follow the pattern from /add-new-entity
```

## Working with Skills

Skills are invoked automatically by agents/commands, but you can request them explicitly.

### Requesting Skill Usage

#### ✅ DO: Request Specific Skills

```text
"Use the performance-audit skill to analyze the accommodation search
endpoint and identify bottlenecks in the query execution"
```

```text
"Apply the error-handling-patterns skill to review error handling
in the booking service and suggest improvements"
```

```text
"Use the tdd-methodology skill to guide me through implementing
the subscription cancellation feature with TDD"
```

### Understanding Skill Capabilities

Each skill has specific capabilities.

#### Audit Skills

- **accessibility-audit**: WCAG compliance, screen reader support
- **performance-audit**: Query optimization, bundle size, rendering
- **security-audit**: Vulnerabilities, auth issues, injection attacks

#### Testing Skills

- **api-app-testing**: API endpoint tests (Vitest)
- **web-app-testing**: E2E tests (Playwright)
- **performance-testing**: Load testing, benchmarks
- **security-testing**: Penetration testing

#### Documentation Skills

- **markdown-formatter**: Lint and format markdown files

#### Pattern Skills

- **error-handling-patterns**: Consistent error handling
- **tdd-methodology**: Red-Green-Refactor guidance

### Skill Outputs

Know what to expect from each skill.

**Example: performance-audit**

```text
Input: "Audit accommodation search performance"

Output:
1. Performance Report
   - Query execution time: 245ms (SLOW)
   - Number of queries: 5 (N+1 detected)
   - Bundle size: 350KB (acceptable)

2. Bottlenecks Identified
   - Missing index on accommodations.city
   - Separate queries for images (N+1)
   - No query result caching

3. Optimization Suggestions
   - Add index: CREATE INDEX idx_accommodations_city ON accommodations(city)
   - Use JOIN for images instead of separate queries
   - Implement Redis caching for search results (5min TTL)

4. Expected Improvements
   - Query time: 245ms → ~50ms (80% faster)
   - Queries: 5 → 2 (60% reduction)
```

## Code Review Practices

### Always Review Generated Code

Never blindly accept generated code.

#### Review Checklist

**1. Correctness**

```typescript
// ❌ Generated code with bug:
async function calculatePrice(nights: number, pricePerNight: number) {
  return nights + pricePerNight; // Should be multiply!
}

// ✅ After review:
async function calculatePrice(nights: number, pricePerNight: number) {
  return nights * pricePerNight;
}
```

**2. Type Safety**

```typescript
// ❌ Using any:
async function processBooking(data: any) {
  // Implementation
}

// ✅ Proper typing:
async function processBooking(data: CreateBookingInput): Promise<Result<Booking>> {
  // Implementation
}
```

**3. Error Handling**

```typescript
// ❌ Unhandled errors:
async function createBooking(data: CreateBookingInput) {
  const result = await db.insert(bookings).values(data);
  return result[0];
}

// ✅ Proper error handling:
async function createBooking(data: CreateBookingInput): Promise<Result<Booking>> {
  try {
    const result = await db.insert(bookings).values(data).returning();
    return Ok(result[0]);
  } catch (error) {
    logger.error('Failed to create booking', error);
    return Err({
      code: 'DATABASE_ERROR',
      message: 'Failed to create booking',
    });
  }
}
```

**4. Security**

```typescript
// ❌ SQL injection vulnerable:
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ Parameterized query:
const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
```

**5. Performance**

```typescript
// ❌ N+1 query:
for (const accommodation of accommodations) {
  const images = await db.select().from(imagesTable)
    .where(eq(imagesTable.accommodationId, accommodation.id));
  accommodation.images = images;
}

// ✅ Single query with JOIN:
const accommodations = await db.select()
  .from(accommodationsTable)
  .leftJoin(imagesTable, eq(accommodationsTable.id, imagesTable.accommodationId));
```

### Understand Before Accepting

Don't accept code you don't understand.

#### ✅ DO: Ask for Explanation

```text
"I don't understand this part of the code:

```typescript
const result = accommodations.reduce((acc, curr) => ({
  ...acc,
  [curr.id]: curr,
}), {} as Record<string, Accommodation>);
```

Can you explain what this does and why we're using reduce here?"
```

#### ✅ DO: Request Simplification

```text
"This code works but it's too complex. Can you simplify it and
add comments explaining the logic?"
```

### Test Thoroughly

Always test generated code.

#### Testing Checklist

1. **Run Unit Tests**

   ```bash
   pnpm test path/to/test.test.ts
   ```

2. **Check Coverage**

   ```bash
   pnpm test:coverage
   # Ensure 90%+ coverage
   ```

3. **Manual Testing**

   ```bash
   # Start dev server
   pnpm dev

   # Test in browser/Postman
   ```

4. **Edge Cases**

   ```typescript
   // Test:
   - Empty inputs
   - Invalid data
   - Boundary values
   - Error conditions
   - Concurrent operations
   ```

5. **Integration Testing**

   ```typescript
   // Test with:
   - Real database
   - Actual API calls
   - Complete user flows
   ```

## Context Management

### Keep Conversations Focused

One task per conversation thread.

#### ✅ DO: Focused Conversations

```text
# Start new conversation for each task:

# Conversation 1: Booking Service
"Create BookingService with availability checking..."
[complete implementation]

# Exit and start Conversation 2: Payment Integration
exit
claude-code
"Integrate Mercado Pago payment processing..."
```

#### ❌ DON'T: Mix Unrelated Tasks

```text
# Single conversation trying to do everything:
"Create BookingService... now add payment integration...
now create email templates... now update documentation..."
[conversation becomes unfocused, context bloated]
```

### Start New Sessions for Different Tasks

Fresh start = fresh context.

#### When to Start New Session

- ✅ New feature development
- ✅ Different area of codebase
- ✅ Unrelated bug fix
- ✅ Context budget running low
- ✅ Switching between frontend/backend

#### When to Continue Session

- ✅ Iterating on same code
- ✅ Related improvements
- ✅ Following up on previous work

### Use Memory for Persistent Knowledge

Store information that applies across sessions.

#### ✅ DO: Use Memory

```text
/add-memory "Hospeda uses RO-RO pattern for all function signatures"

/add-memory "All services extend BaseCrudService<T, M, C, U, S>"

/add-memory "Test coverage must be 90% minimum - no exceptions"

/add-memory "API routes use factory functions: createCRUDRoute, createListRoute"
```

#### What to Store in Memory

- Project-specific patterns
- Common gotchas
- Important decisions
- Frequently referenced info
- Team preferences

#### What NOT to Store

- Temporary information
- Task-specific details
- Code snippets (will become outdated)
- Debugging info

## Testing Generated Code

### Run Tests Immediately

Test as soon as code is generated.

#### ✅ DO: Immediate Testing

```text
Claude: "I've created the BookingService. Here's the implementation..."

You: "Great! Let's test it now."

```bash
cd packages/service-core && pnpm test booking
```

[Review test results]

"Tests pass! Coverage is 92%."
```

#### ❌ DON'T: Defer Testing

```text
Claude: "I've created the BookingService..."

You: "Looks good, I'll test it later."
[Continues to next task without testing]
[Finds bugs later, harder to fix]
```

### Add Tests for Edge Cases

Generated tests may miss edge cases.

#### Example: Adding Edge Case Tests

```typescript
// Claude generated basic tests:
describe('BookingService.create', () => {
  it('should create booking with valid data', async () => {
    // Test happy path
  });

  it('should reject invalid dates', async () => {
    // Test validation
  });
});

// You add edge cases:
describe('BookingService.create - Edge Cases', () => {
  it('should reject same-day check-in/check-out', async () => {
    // Edge case: zero nights
  });

  it('should handle leap year dates correctly', async () => {
    // Edge case: Feb 29
  });

  it('should prevent double booking same dates', async () => {
    // Edge case: race condition
  });

  it('should rollback on payment failure', async () => {
    // Edge case: partial failure
  });
});
```

### Verify Coverage

Always check test coverage.

```bash
# Run with coverage
pnpm test:coverage

# Check report
open coverage/index.html

# Verify 90%+ coverage for all new code
```

## Documentation

### Document as You Go

Don't leave documentation for later.

#### ✅ DO: Immediate Documentation

```text
# After creating function:
"Add JSDoc to the calculateBookingPrice function with:
- Description
- Param docs with examples
- Return value description
- @throws documentation
- Usage example"

# After creating feature:
"Update docs/api/bookings.md with the new endpoints"

# After architectural change:
"Add ADR for switching to event-driven booking confirmation"
```

#### ❌ DON'T: Defer Documentation

```text
"I'll document it all later"
[Later: Forgot details, harder to document]
```

### Documentation Types

Different docs for different audiences.

#### Code Documentation (Developers)

```typescript
/**
 * Calculate total booking cost including fees
 *
 * Computes the base cost (nights × price per night), applies
 * weekend surcharges, and adds cleaning and service fees.
 *
 * @param input - Booking calculation parameters
 * @param input.checkIn - ISO 8601 check-in date
 * @param input.checkOut - ISO 8601 check-out date
 * @param input.pricePerNight - Nightly rate in ARS
 * @param input.cleaningFee - One-time cleaning fee in ARS
 * @returns Price breakdown with total
 * @throws {ValidationError} If dates are invalid or in past
 * @example
 * ```typescript
 * const cost = calculateBookingCost({
 *   checkIn: '2024-01-15',
 *   checkOut: '2024-01-20',
 *   pricePerNight: 5000,
 *   cleaningFee: 2000,
 * });
 * // Returns: { base: 25000, cleaning: 2000, total: 27000 }
 * ```
 */
```

#### API Documentation (External Developers)

```markdown
## Create Booking

Create a new accommodation booking.

**Endpoint:** `POST /bookings`
**Authentication:** Required
**Rate Limit:** 10 requests/minute

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| accommodationId | string | Yes | Accommodation UUID |
| checkIn | string | Yes | Check-in date (ISO 8601) |
| checkOut | string | Yes | Check-out date (ISO 8601) |
| guests | number | Yes | Number of guests (1-20) |

### Response

201 Created with booking object
```

#### Architecture Documentation (Team)

```markdown
# ADR 012: Event-Driven Booking Confirmation

## Status

Accepted

## Context

Booking confirmation requires multiple operations:
- Create booking record
- Process payment
- Send confirmation email
- Update availability
- Notify host

Current synchronous approach times out on slow email/payment.

## Decision

Use event-driven architecture for booking confirmation.

## Consequences

- Faster API response
- Better reliability (retry failed operations)
- More complex debugging
```

## Git and Commits

### Atomic Commits

One commit per logical change.

#### ✅ DO: Atomic Commits

```bash
# Good: Each commit is focused
git add packages/schemas/src/booking.schema.ts
git commit -m "feat(schemas): add booking validation schema"

git add packages/db/src/schemas/booking.schema.ts packages/db/src/models/booking.model.ts
git commit -m "feat(db): add booking schema and model"

git add packages/service-core/src/services/booking/
git commit -m "feat(service): add BookingService with business logic"
```

#### ❌ DON'T: Mixed Commits

```bash
# Bad: Multiple unrelated changes
git add .
git commit -m "Add booking feature and fix accommodation bug and update docs"
```

### Conventional Commit Messages

Use conventional commit format.

**Format:**

```text
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Adding tests
- `docs`: Documentation
- `chore`: Maintenance
- `perf`: Performance improvement

**Examples:**

```bash
feat(api): add booking cancellation endpoint

Implements DELETE /bookings/:id with:
- Cancellation policy validation
- Refund processing
- Email notification

Closes #123

---

fix(service): correct weekend surcharge calculation

Weekend surcharge was being applied to all days instead of
only Friday, Saturday, Sunday. Fixed date logic in
calculateWeekendSurcharge().

Fixes #124

---

refactor(db): optimize accommodation search query

Reduced query time from 245ms to 50ms by:
- Adding index on accommodations.city
- Using JOIN instead of separate queries for images
- Implementing Redis caching (5min TTL)
```

### Review Changes Before Committing

Always review what you're committing.

```bash
# Check status
git status

# Review diff
git diff

# Review staged changes
git diff --staged

# If changes look good
git commit
```

### Use `/commit` Command

Let Claude generate commit messages.

```bash
# After making changes:
/commit

# Claude will:
1. Analyze changed files
2. Group related changes
3. Suggest commit strategy
4. Generate conventional commit messages

# Example output:
Suggested commits:

1. feat(schemas): add booking validation schema
   Files: packages/schemas/src/booking.schema.ts

2. feat(db): add booking schema and model
   Files:
   - packages/db/src/schemas/booking.schema.ts
   - packages/db/src/models/booking.model.ts
   - packages/db/test/models/booking.model.test.ts

3. feat(service): add BookingService with business logic
   Files:
   - packages/service-core/src/services/booking/booking.service.ts
   - packages/service-core/test/services/booking/booking.service.test.ts

Proceed with these commits? (y/n)
```

## Performance Considerations

### Token Budget Awareness

Be mindful of token usage.

#### ✅ DO: Efficient Token Usage

```text
# Be specific about files:
"Show me packages/db/src/models/accommodation.model.ts"

# Instead of:
"Show me all models"

# Reference line numbers:
"Check line 45-60 in accommodation.service.ts"

# Instead of:
"Read the entire service file"
```

#### Monitor Context Size

```text
# If response seems truncated:
"Continue"

# If conversation is getting long:
exit
claude-code
[start fresh conversation]
```

### Efficient Tool Usage

Minimize redundant operations.

#### ✅ DO: Efficient Operations

```text
# Read file once, then reference it:
"Read packages/db/src/models/user.model.ts"
[Claude reads file]

"Now update the findByEmail method at line 45"
[Claude uses cached content]
```

#### ❌ DON'T: Redundant Operations

```text
# Reading same file multiple times:
"Show me user.model.ts"
"Now show user.model.ts again"
"Let me see user.model.ts one more time"
```

### Minimize Redundant Reads

Cache information in memory.

```text
# Use memory for frequently referenced info:
/add-memory "AccommodationModel structure: extends BaseModel, has methods findByCity, findFeatured, updatePrice"

# Later, reference memory instead of re-reading:
"Create BookingModel following the same pattern as AccommodationModel
(check memory for structure)"
```

## Security Considerations

### Never Commit Secrets

Always validate before committing.

#### ✅ DO: Check for Secrets

```bash
# Before committing, check for:
- API keys
- Passwords
- Database URLs with credentials
- Private keys
- Tokens

# Use git diff to review:
git diff

# If found, add to .gitignore
echo "secrets.json" >> .gitignore
```

#### Use Environment Variables

```typescript
// ❌ DON'T: Hardcode secrets
const apiKey = 'sk-ant-1234567890';

// ✅ DO: Use environment variables
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY not configured');
}
```

### Validate Input Handling

Always validate user input.

```typescript
// ✅ DO: Validate with Zod
const createBookingSchema = z.object({
  accommodationId: z.string().uuid(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().int().min(1).max(20),
});

export async function createBooking(input: unknown): Promise<Result<Booking>> {
  // Validate input
  const validation = createBookingSchema.safeParse(input);
  if (!validation.success) {
    return Err({
      code: 'VALIDATION_ERROR',
      message: 'Invalid booking data',
      details: validation.error.issues,
    });
  }

  const data = validation.data;
  // Proceed with validated data
}
```

### Review Authentication Logic

Double-check auth implementation.

```typescript
// ✅ DO: Verify authentication
import { requireAuth } from '@/middleware/auth';

router.post('/bookings', requireAuth(), async (c) => {
  const user = c.get('user'); // Verified by middleware
  const body = await c.req.json();

  // Verify user can create booking
  if (!user.isHost && body.accommodationId !== user.accommodationId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // Proceed
});
```

## Common Mistakes to Avoid

### 1. Not Reading Documentation

```text
❌ "How do I create a service in Hospeda?"
[When the answer is in CLAUDE.md]

✅ Read CLAUDE.md, architecture docs, then ask specific questions
```

### 2. Accepting Code Without Understanding

```text
❌ "This code works, I'll just use it"
[Without understanding what it does]

✅ "Explain what this code does and why we're using this approach"
```

### 3. Skipping Tests

```text
❌ "I'll write tests later"
[Never writes tests]

✅ Use TDD: Test → Code → Refactor
```

### 4. Not Running Quality Checks

```text
❌ Commit without running checks
[Breaks build]

✅ Always run /quality-check before committing
```

### 5. Vague Error Reports

```text
❌ "It doesn't work"

✅ "Getting error 'Type X is not assignable to type Y' in
    packages/db/src/models/booking.model.ts at line 45.
    Here's the code and full error message..."
```

### 6. Mixing Concerns in Commits

```text
❌ git add .
    git commit -m "Various updates"

✅ Atomic commits with conventional commit messages
```

### 7. Ignoring TypeScript Errors

```text
❌ // @ts-ignore
    const result = someFunction();

✅ Fix the type error properly
```

### 8. Not Asking for Help

```text
❌ Struggle for hours without asking

✅ Ask Claude for help, explanations, alternatives
```

## Summary

### Quick Reference DO's

- ✅ Be specific and clear in prompts
- ✅ Provide context and examples
- ✅ Break down complex tasks
- ✅ Use proper terminology
- ✅ Always review generated code
- ✅ Test immediately and thoroughly
- ✅ Document as you go
- ✅ Use atomic commits
- ✅ Run quality checks before committing
- ✅ Start new sessions for new tasks
- ✅ Use memory for persistent knowledge
- ✅ Invoke agents for specialized work
- ✅ Validate security and auth logic
- ✅ Ask for explanations when unclear

### Quick Reference DON'Ts

- ❌ Be vague or ambiguous
- ❌ Accept code without understanding
- ❌ Skip testing
- ❌ Defer documentation
- ❌ Mix unrelated changes in commits
- ❌ Commit without quality checks
- ❌ Hardcode secrets
- ❌ Ignore TypeScript errors
- ❌ Use `any` type
- ❌ Continue bloated conversations
- ❌ Request everything at once
- ❌ Assume generated code is perfect

## Next Steps

Now that you know the best practices:

1. **[Workflows](./workflows.md)** - Apply these practices in project-specific workflows
2. **[Resources](./resources.md)** - Explore additional learning materials
3. **[Introduction](./introduction.md)** - Deeper understanding of Claude Code
4. **[Setup](./setup.md)** - Configuration reference

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-01-15 | Initial best practices guide | tech-writer |

---

**Master these practices** and you'll be an AI-assisted development expert!
