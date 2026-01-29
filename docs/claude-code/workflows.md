# Workflows

## Overview

This guide details the project-specific workflows for Hospeda development using Claude Code. We use three workflow levels based on task complexity, timeframe, and risk.

## Workflow Decision Tree

Use this decision tree to choose the right workflow:

```mermaid
graph TD
    Start[New Task] --> Q1{How long?}
    Q1 -->|< 30 min| Q2{How many files?}
    Q1 -->|30min - 3h| Level2[Level 2: Atomic Task]
    Q1 -->|Multi-day| Level3[Level 3: Feature Planning]

    Q2 -->|1-2 files| Q3{What risk?}
    Q2 -->|3+ files| Level2

    Q3 -->|Very low| Level1[Level 1: Quick Fix]
    Q3 -->|Low+| Level2

    Level1 --> L1Examples[Examples:<br/>- Typo fix<br/>- Config update<br/>- Comment addition]
    Level2 --> L2Examples[Examples:<br/>- Bug fix<br/>- New endpoint<br/>- Component creation]
    Level3 --> L3Examples[Examples:<br/>- New feature<br/>- Architecture change<br/>- Database migration]
```

## Level 1: Quick Fix Protocol

**Time**: < 30 minutes
**Files**: 1-2
**Risk**: Very low
**Examples**: Typos, formatting, simple config updates

### When to Use

Use Level 1 for:

- Fixing typos in code or documentation
- Updating configuration values
- Adding comments
- Formatting fixes
- Renaming variables (single file)
- Simple documentation updates

### Process

```text
1. Identify Issue
   ↓
2. Make Fix
   ↓
3. Verify
   ↓
4. Commit
```

### Step-by-Step Example

#### Task: Fix typo in error message

#### 1. Identify Issue

```typescript
// packages/service-core/src/services/booking/booking.service.ts
throw new Error('Accomodation not available'); // Typo: "Accomodation"
```

#### 2. Make Fix

```text
Prompt to Claude:
"Fix typo in packages/service-core/src/services/booking/booking.service.ts
line 45. Change 'Accomodation' to 'Accommodation'"
```

#### 3. Verify

```bash
# Quick check
grep -r "Accomodation" packages/service-core/src/
# Should return no results

# Run code check
/code-check
```

#### 4. Commit

```bash
/commit

# Expected commit message:
# fix(service): correct typo in booking error message
#
# Changed 'Accomodation' to 'Accommodation' in BookingService
```

### Quick Fix Checklist

- [ ] Change is obvious and safe
- [ ] Affects 1-2 files maximum
- [ ] No business logic changes
- [ ] No type changes
- [ ] No test changes needed (or trivial)
- [ ] Can be verified in < 5 minutes
- [ ] Low risk if wrong

## Level 2: Atomic Task Protocol

**Time**: 30 minutes - 3 hours
**Files**: 2-10
**Risk**: Low to medium
**Examples**: Bug fixes, small features, new endpoints

### When to Use

Use Level 2 for:

- Bug fixes (with tests)
- New API endpoints
- New React components
- Service method additions
- Database model updates
- Small feature implementations

### TDD Workflow (Red-Green-Refactor)

Level 2 ALWAYS uses Test-Driven Development:

```text
RED: Write failing test
   ↓
GREEN: Make test pass
   ↓
REFACTOR: Improve code
   ↓
COMMIT: Atomic commit
```

### Process Flow

```mermaid
graph TD
    Start[Start Task] --> Understand[Understand Requirements]
    Understand --> Red[RED: Write Failing Test]
    Red --> RunRed[Run Test - Should Fail]
    RunRed --> Green[GREEN: Implement Code]
    Green --> RunGreen[Run Test - Should Pass]
    RunGreen --> Pass{Tests Pass?}
    Pass -->|No| Green
    Pass -->|Yes| Refactor[REFACTOR: Improve Code]
    Refactor --> Quality[Run Quality Checks]
    Quality --> AllPass{All Pass?}
    AllPass -->|No| Fix[Fix Issues]
    Fix --> Quality
    AllPass -->|Yes| Commit[Commit Changes]
    Commit --> Done[Task Complete]
```

### Step-by-Step Example

#### Task: Add endpoint to cancel booking

#### 1. Understand Requirements

```text
Requirements:
- Endpoint: DELETE /bookings/:id
- Validate user owns booking
- Check cancellation policy (24h before check-in)
- Process refund if applicable
- Update booking status to 'cancelled'
- Send cancellation confirmation email
- Return 200 with updated booking
```

#### 2. RED: Write Failing Test

```text
Prompt to Claude:
"Task: Invoke qa-engineer agent to write failing tests for
booking cancellation endpoint (DELETE /bookings/:id) with these scenarios:

1. Happy path: Cancel booking 3 days before check-in
2. Error: Cancel within 24h of check-in (policy violation)
3. Error: User doesn't own booking (403)
4. Error: Booking doesn't exist (404)
5. Error: Booking already cancelled (400)
6. Edge case: Refund calculation for partial cancellation

Follow TDD methodology - tests should fail initially."
```

**Generated Tests:**

```typescript
// apps/api/test/routes/bookings/cancel.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '@/app';
import { createTestBooking, createTestUser } from '@/test/helpers';

describe('DELETE /bookings/:id', () => {
  let user: TestUser;
  let booking: TestBooking;

  beforeEach(async () => {
    user = await createTestUser();
    booking = await createTestBooking({
      userId: user.id,
      checkIn: addDays(new Date(), 7), // 7 days from now
      status: 'confirmed',
    });
  });

  it('should cancel booking 3 days before check-in', async () => {
    const response = await app.request(
      `/bookings/${booking.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.booking.status).toBe('cancelled');
    expect(data.refundAmount).toBeGreaterThan(0);
  });

  it('should reject cancellation within 24h of check-in', async () => {
    booking = await createTestBooking({
      userId: user.id,
      checkIn: addHours(new Date(), 12), // 12 hours from now
    });

    const response = await app.request(
      `/bookings/${booking.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('CANCELLATION_POLICY_VIOLATION');
  });

  it('should reject if user does not own booking', async () => {
    const otherUser = await createTestUser();

    const response = await app.request(
      `/bookings/${booking.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${otherUser.token}` },
      }
    );

    expect(response.status).toBe(403);
  });

  // More tests...
});
```

**Run Tests (Should Fail):**

```bash
cd apps/api && pnpm test cancel
# All tests fail (endpoint doesn't exist yet)
```

#### 3. GREEN: Implement Code

```text
Prompt to Claude:
"Now implement the DELETE /bookings/:id endpoint to make these tests pass.

Create:
1. Route handler in apps/api/src/routes/bookings/cancel.ts
2. Service method BookingService.cancel() in packages/service-core/
3. Update booking schema to include 'cancelled' status

Follow existing patterns from BookingService.create()"
```

**Generated Implementation:**

```typescript
// apps/api/src/routes/bookings/cancel.ts
import { createRoute } from '@/lib/route-factory';
import { BookingService } from '@repo/service-core';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const cancelBookingRoute = createRoute({
  method: 'DELETE',
  path: '/bookings/:id',
  auth: true,
  schema: { params: paramsSchema },
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const actor = c.get('actor');

    const service = new BookingService({ actor, logger: c.get('logger') });
    const result = await service.cancel({ id });

    if (!result.success) {
      return c.json({ error: result.error }, result.error.status || 400);
    }

    return c.json({
      success: true,
      booking: result.data.booking,
      refundAmount: result.data.refundAmount,
    });
  },
});

// packages/service-core/src/services/booking/booking.service.ts
export class BookingService extends BaseCrudService<...> {
  async cancel(input: { id: string }): Promise<Result<CancellationResult>> {
    // 1. Find booking
    const bookingResult = await this.findById({ id: input.id });
    if (!bookingResult.success) {
      return bookingResult;
    }

    const booking = bookingResult.data;

    // 2. Verify ownership
    if (booking.userId !== this.ctx.actor.id) {
      return Err({
        code: 'FORBIDDEN',
        message: 'You do not own this booking',
        status: 403,
      });
    }

    // 3. Check if already cancelled
    if (booking.status === 'cancelled') {
      return Err({
        code: 'ALREADY_CANCELLED',
        message: 'Booking is already cancelled',
        status: 400,
      });
    }

    // 4. Check cancellation policy (24h before check-in)
    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const hoursBefore = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursBefore < 24) {
      return Err({
        code: 'CANCELLATION_POLICY_VIOLATION',
        message: 'Cancellation must be at least 24 hours before check-in',
        status: 400,
      });
    }

    // 5. Calculate refund
    const refundAmount = this.calculateRefund(booking, hoursBefore);

    // 6. Update booking status
    const updateResult = await this.update({
      id: booking.id,
      status: 'cancelled',
      cancelledAt: now,
    });

    if (!updateResult.success) {
      return updateResult;
    }

    // 7. Process refund (if applicable)
    if (refundAmount > 0) {
      await this.paymentService.processRefund({
        bookingId: booking.id,
        amount: refundAmount,
      });
    }

    // 8. Send confirmation email
    await this.notificationService.sendCancellationConfirmation({
      booking: updateResult.data,
      refundAmount,
    });

    return Ok({
      booking: updateResult.data,
      refundAmount,
    });
  }

  private calculateRefund(booking: Booking, hoursBefore: number): number {
    // Full refund if > 7 days before
    if (hoursBefore > 24 * 7) {
      return booking.totalPrice;
    }

    // 50% refund if 24h-7days before
    return booking.totalPrice * 0.5;
  }
}
```

**Run Tests (Should Pass):**

```bash
cd apps/api && pnpm test cancel
# All tests pass
```

#### 4. REFACTOR: Improve Code

```text
Prompt to Claude:
"Review the booking cancellation code for improvements:
1. Can we extract the policy logic to a separate class?
2. Are there any edge cases we're missing?
3. Can we simplify the refund calculation?
4. Add JSDoc comments"
```

**Refactored Code:**

```typescript
// Extract policy to separate class
class CancellationPolicy {
  private static readonly FULL_REFUND_HOURS = 24 * 7; // 7 days
  private static readonly MIN_CANCELLATION_HOURS = 24; // 24 hours

  static canCancel(checkIn: Date): Result<number> {
    const hoursBefore = this.getHoursBeforeCheckIn(checkIn);

    if (hoursBefore < this.MIN_CANCELLATION_HOURS) {
      return Err({
        code: 'CANCELLATION_POLICY_VIOLATION',
        message: 'Cancellation must be at least 24 hours before check-in',
      });
    }

    return Ok(hoursBefore);
  }

  static calculateRefundPercentage(hoursBefore: number): number {
    if (hoursBefore > this.FULL_REFUND_HOURS) {
      return 1.0; // 100% refund
    }
    return 0.5; // 50% refund
  }

  private static getHoursBeforeCheckIn(checkIn: Date): number {
    const now = new Date();
    return (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);
  }
}

// Update service to use policy
export class BookingService extends BaseCrudService<...> {
  /**
   * Cancel a booking and process refund if applicable
   *
   * Validates ownership, checks cancellation policy, processes refund,
   * and sends confirmation email.
   *
   * @param input - Cancellation parameters
   * @param input.id - Booking UUID
   * @returns Cancelled booking and refund amount
   * @throws {ForbiddenError} If user doesn't own booking
   * @throws {ValidationError} If cancellation policy violated
   */
  async cancel(input: { id: string }): Promise<Result<CancellationResult>> {
    // ... (cleaner implementation using CancellationPolicy)
  }
}
```

**Run Tests Again:**

```bash
cd apps/api && pnpm test cancel
# All tests still pass after refactoring
```

#### 5. Run Quality Checks

```bash
/quality-check

# Output:
# Running quality checks...
# 1. Linting... pass
# 2. Type checking... pass
# 3. Tests... pass (92% coverage)
# 4. Format validation... pass
#
# All checks passed!
```

#### 6. Commit Changes

```bash
/commit

# Claude suggests:
# Commit 1: feat(schemas): add booking cancelled status
# Files: packages/schemas/src/booking.schema.ts
#
# Commit 2: feat(service): add booking cancellation with policy
# Files:
# - packages/service-core/src/services/booking/booking.service.ts
# - packages/service-core/src/services/booking/cancellation-policy.ts
# - packages/service-core/test/services/booking/cancel.test.ts
#
# Commit 3: feat(api): add booking cancellation endpoint
# Files:
# - apps/api/src/routes/bookings/cancel.ts
# - apps/api/test/routes/bookings/cancel.test.ts

# Execute commits
git add packages/schemas/src/booking.schema.ts
git commit -m "feat(schemas): add booking cancelled status"

# ... (remaining commits)
```

**Task Complete!**

### Atomic Task Checklist

- [ ] Understood requirements clearly
- [ ] Wrote failing tests first (RED)
- [ ] Implemented code to pass tests (GREEN)
- [ ] Refactored for quality (REFACTOR)
- [ ] Ran quality checks (all passed)
- [ ] Created atomic commits
- [ ] Updated documentation (if needed)
- [ ] Task code referenced in commits

## Level 3: Feature Planning (Task Master Plugin)

**Time**: Multi-day
**Complexity**: High
**Examples**: New features, architecture changes, major refactoring

### When to Use

Use Level 3 for:

- New features requiring multiple components
- Database schema changes
- Architecture changes
- Cross-team coordination
- Multiple atomic tasks (5+)
- Breaking changes

### Overview

Level 3 features are managed through the **Task Master plugin**, which provides specification-driven planning, automatic task generation, and progress tracking.

```mermaid
graph LR
    S1[Create Spec<br/>/spec] --> S2[Review &<br/>Approve Spec]
    S2 --> S3[Generate Tasks<br/>Automatic]
    S3 --> S4[Implement Tasks<br/>/next-task]
    S4 --> S5[Track Progress<br/>/task-status]
    S5 -->|Re-plan if needed| S6[/replan]
    S6 --> S4
```

### Task Master Commands

| Command | Purpose |
|---------|---------|
| `/spec` | Create a feature specification with requirements and acceptance criteria |
| `/tasks` | View the task dashboard showing all tasks and their status |
| `/next-task` | Get the next available task to work on |
| `/new-task` | Create a standalone task outside of a specification |
| `/task-status` | Get a detailed progress report on tasks |
| `/replan` | Re-plan remaining tasks if requirements change |

### Step-by-Step Feature Workflow

#### Step 1: Create Specification

```bash
/spec
```

Describe the feature when prompted. The specification captures:

- Feature overview and goals
- User stories and acceptance criteria
- Technical considerations
- Out-of-scope items
- Success metrics

#### Step 2: Review and Approve Specification

Review the generated specification. Request changes if needed. Once approved, tasks are automatically generated from the specification.

#### Step 3: Work Through Tasks

```bash
# See the task dashboard
/tasks

# Get the next task to work on
/next-task
```

Each task follows the TDD workflow (Red-Green-Refactor) from Level 2. Tasks are ordered by dependency so you always work on the right thing next.

#### Step 4: Track Progress

```bash
# Get a detailed progress report
/task-status
```

#### Step 5: Re-plan if Needed

If requirements change or you discover new work during implementation:

```bash
/replan
```

This re-evaluates remaining tasks and adjusts the plan accordingly.

### Example: Subscription System Feature

#### 1. Create the Specification

```bash
/spec

# Describe the feature:
# "Subscription system for hosts to access premium features:
#
# Features:
# - Multiple pricing tiers (Basic free, Pro $29/mo, Enterprise $99/mo)
# - 14-day free trial
# - Monthly/yearly billing
# - Credit card payments via Mercado Pago
# - Usage limits per tier
# - Subscription management (upgrade/downgrade/cancel)
#
# Users:
# - Hosts can subscribe
# - Admins can manage subscriptions
# - Guests see host's tier badge"
```

#### 2. Review Generated Tasks

```bash
/tasks

# Shows auto-generated tasks like:
# 1. Create subscription Zod schemas
# 2. Create subscription database schema and migration
# 3. Create SubscriptionModel
# 4. Create SubscriptionService
# 5. Create subscription API endpoints
# 6. Create frontend components
# 7. Write integration tests
# ...
```

#### 3. Implement Tasks with TDD

```bash
/next-task

# Work on each task using TDD:
# RED: Write failing test
# GREEN: Make test pass
# REFACTOR: Improve code
# Then commit and move to next task
```

#### 4. Monitor Progress

```bash
/task-status

# Shows completion percentage, blockers, and remaining work
```

### Implementation Guidelines

Each task from the Task Master follows the same TDD discipline as Level 2:

1. **Write failing tests first** (RED)
2. **Implement code to pass tests** (GREEN)
3. **Refactor for quality** (REFACTOR)
4. **Run quality checks** (`/quality-check`, `/code-check`)
5. **Commit changes** (`/commit`)

### Validation

After all tasks are complete:

1. Run full test suite: `/run-tests`
2. Verify 90%+ coverage: `pnpm test:coverage`
3. Run quality checks: `/quality-check`
4. Manual testing of key flows
5. Code review

### Finalization

1. Update documentation: `/update-docs`
2. Create atomic commits: `/commit`
3. Create PR with implementation summary, testing notes, and any breaking changes
4. Deploy through CI/CD pipeline

**Feature Checklist:**

- [ ] Specification created and approved
- [ ] All tasks completed with TDD
- [ ] All quality checks passed
- [ ] 90%+ test coverage achieved
- [ ] Documentation updated
- [ ] Atomic commits created
- [ ] PR created
- [ ] CI/CD passing
- [ ] Deployed and verified

## Common Workflows

### Creating a New Entity

Complete entity creation (DB -> Service -> API -> Frontend)

```bash
/add-new-entity

# Claude will prompt for:
Entity name: Subscription
Fields: tier, status, trialEnd, currentPeriodEnd
Relations: belongsTo User, hasMany SubscriptionItems

# Generates:
1. Zod schema (packages/schemas)
2. DB schema (packages/db/schemas)
3. Model (packages/db/models)
4. Service (packages/service-core)
5. API routes (apps/api/routes)
6. Tests (test/ folders)
```

### Fixing a Bug

Use Level 2 workflow with TDD:

```text
1. Create issue in GitHub
2. Reproduce bug with failing test (RED)
3. Fix bug (GREEN)
4. Refactor if needed (REFACTOR)
5. Run quality checks
6. Commit with issue reference
7. Close issue
```

### Adding a Feature

**Small feature** (< 1 day): Use Level 2
**Large feature** (multi-day): Use Level 3 with `/spec`

### Refactoring Code

For major refactoring, use the Task Master plugin:

```bash
# Create a specification for the refactoring work
/spec

# Describe the refactoring goals, scope, and constraints
# Tasks will be auto-generated

# Work through tasks
/next-task

# Each task uses:
# - TDD to maintain behavior
# - Quality checks at each step
# - Atomic commits
```

### Writing Tests

Use qa-engineer agent:

```text
Task: Invoke qa-engineer agent to create comprehensive test suite for
SubscriptionService including:

1. Unit tests for each method
2. Integration tests for workflows
3. Edge cases (trial expiration, payment failure, etc.)
4. Error scenarios
5. Ensure 90%+ coverage
6. Follow TDD methodology
```

### Updating Documentation

```bash
/update-docs

# Or manually invoke tech-writer:
Task: Invoke tech-writer agent to update documentation for
subscription system:

1. API documentation (OpenAPI spec)
2. Architecture docs
3. User guide for subscription management
4. JSDoc for all public methods
```

### Performance Optimization

```bash
# Run audit
/audit:performance-audit

# Review report
# Implement optimizations with Level 2 workflow
# Verify improvements with benchmarks
```

### Security Fix

```bash
# Run audit
/audit:security-audit

# For each vulnerability:
1. Create bug task
2. Fix with Level 2 workflow (TDD)
3. Verify fix with security-testing skill
4. Commit with security: prefix
```

## GitHub Integration

### Creating Issues

Use GitHub MCP server:

```text
"Create GitHub issue for bug in booking availability check:

Title: Availability check not detecting overlapping bookings
Description: [detailed description]
Labels: bug, backend, high-priority
Assignee: @username"
```

### Tracking Tasks

Link commits to task references:

```bash
git commit -m "feat(service): add subscription cancellation

Implements cancellation with prorated refund calculation.

Closes PB-105"
```

## Collaboration Patterns

### Working with Multiple Agents

Example: Complex feature requiring coordination

```text
1. product-functional -> Create specification
2. ux-ui-designer -> Create mockups
3. product-technical -> Analyze architecture
4. db-drizzle-engineer -> Design database
5. hono-engineer -> Create API
6. react-senior-dev -> Create components
7. qa-engineer -> Write tests
8. tech-writer -> Update docs
```

### Agent Coordination

Tech-lead coordinates agents:

```text
Task: Invoke tech-lead agent to coordinate subscription system
implementation across:

- db-drizzle-engineer (database)
- hono-engineer (API)
- astro-engineer (frontend)
- qa-engineer (testing)

Ensure:
- Consistent patterns
- Proper dependencies
- Quality standards
```

### Resolving Conflicts

When agents disagree:

```text
Claude: "db-drizzle-engineer suggests using JSONB for metadata,
but hono-engineer prefers separate table for type safety.

Options:

1. JSONB column (flexible but less type-safe)
   Pros: Flexible schema, single table
   Cons: Less type safety, harder to query

2. Separate table (type-safe but more complex)
   Pros: Type safety, easier validation
   Cons: More tables, more joins

Which approach do you prefer?"

You: [Make decision based on project needs]
```

## Next Steps

- **[Best Practices](./best-practices.md)** - Effective AI-assisted development patterns
- **[Resources](./resources.md)** - Additional learning materials
- **[Introduction](./introduction.md)** - Deep dive into Claude Code

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 2.0.0 | 2026-01-29 | Replace old planning system with Task Master plugin references | tech-writer |
| 1.0.0 | 2025-01-15 | Initial workflows documentation | tech-writer |

---

**Master these workflows** and you'll efficiently handle any task in Hospeda!
