# Phase 2: Implementation

This document describes the implementation phase workflow for the Hospeda project.

---

## Table of Contents

1. [Overview](#overview)
2. [Goals](#goals)
3. [TDD Workflow](#tdd-workflow)
4. [Implementation Process](#implementation-process)
5. [Code Quality](#code-quality)
6. [Progress Tracking](#progress-tracking)
7. [Common Issues](#common-issues)

---

## Overview

**Phase 2** is the implementation phase where we build the feature following Test-Driven Development (TDD) principles.

**Duration:** Varies by feature (10-50+ hours)

**Key Principle:** Write tests first, implement incrementally, maintain quality.

---

## Goals

### Primary Goals

1. **Implement Features**: Build according to PDR acceptance criteria
2. **Follow TDD**: Red → Green → Refactor cycle
3. **Maintain Quality**: Clean code, comprehensive tests, documentation
4. **Track Progress**: Update TODOs.md regularly
5. **Stay Consistent**: Follow existing patterns exactly

### Success Metrics

- ✅ All acceptance criteria met
- ✅ 90%+ test coverage
- ✅ All tests passing
- ✅ Lint and typecheck clean
- ✅ Code follows standards
- ✅ Documentation complete

---

## TDD Workflow

### Red → Green → Refactor

**Every task follows this cycle:**

```text

1. RED: Write failing test
   - Define expected behavior
   - Test should fail (no implementation yet)

2. GREEN: Write minimum code to pass
   - Implement just enough
   - Make test pass

3. REFACTOR: Improve code
   - Clean up implementation
   - Maintain passing tests
   - Improve design

```text

### Example Cycle

**RED:**

```typescript
describe('AccommodationService', () => {
  it('should create accommodation with valid data', async () => {
    const input = {
      name: 'Beach House',
      type: 'house' as const,
      capacity: 6,
      pricePerNight: 150,
    };

    const result = await service.create({ input, user: hostUser });

    expect(result.accommodation).toBeDefined();
    expect(result.accommodation.name).toBe('Beach House');
  });
});

// Test fails - method doesn't exist yet
```text

**GREEN:**

```typescript
async create({ input, user }) {
  const accommodation = await this.model.create(input);
  return { accommodation };
}

// Test passes!
```text

**REFACTOR:**

```typescript
async create({ input, user }) {
  // Add validation
  if (user.role !== 'host') {
    throw new ServiceError('Only hosts can create', ServiceErrorCode.FORBIDDEN);
  }

  // Add business logic
  const accommodationData = {
    ...input,
    hostId: user.id,
    status: 'pending',
  };

  const accommodation = await this.model.create(accommodationData);

  return { accommodation };
}

// Tests still pass!
```text

---

## Implementation Process

### Step 1: Review Context

**Before Starting:**

1. **Read PDR.md**
   - Understand acceptance criteria
   - Review user stories
   - Check constraints

2. **Read tech-analysis.md**
   - Understand technical approach
   - Review architecture decisions
   - Check design patterns

3. **Check TODOs.md**
   - Find current task
   - Check dependencies
   - Understand context

**Don't start coding without understanding the full context!**

---

### Step 2: Setup

**Per Task:**

1. **Navigate to Package**

   ```bash
   cd packages/db  # or packages/service-core, apps/api, etc.
   ```

2. **Create Branch** (if user wants)

   ```bash
   git checkout -b feature/{feature-name}
   ```

3. **Verify Dependencies**

   - Check if dependent tasks are complete
   - If blocked, work on parallel tasks

---

### Step 3: TDD Implementation

**Follow entity creation order:**

#### 1. Zod Schemas (packages/schemas)

**RED:**

```typescript
// schemas.test.ts
describe('createAccommodationSchema', () => {
  it('should validate valid input', () => {
    const input = {
      name: 'Beach House',
      type: 'house',
      capacity: 6,
      pricePerNight: 150,
    };

    const result = createAccommodationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid capacity', () => {
    const input = {
      name: 'Beach House',
      type: 'house',
      capacity: 0, // Invalid!
      pricePerNight: 150,
    };

    const result = createAccommodationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
```text

**GREEN:**

```typescript
export const createAccommodationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['house', 'apartment', 'room']),
  capacity: z.number().int().positive().max(50),
  pricePerNight: z.number().positive(),
});
```text

**REFACTOR:**

```typescript
// Add more validation, better error messages
export const createAccommodationSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name too long'),
  type: z.enum(['house', 'apartment', 'room'], {
    errorMap: () => ({ message: 'Invalid accommodation type' }),
  }),
  capacity: z.number()
    .int('Capacity must be integer')
    .positive('Capacity must be positive')
    .max(50, 'Maximum capacity is 50'),
  pricePerNight: z.number()
    .positive('Price must be positive')
    .max(100000, 'Price too high'),
});

// Infer types
export type CreateAccommodationInput = z.infer<typeof createAccommodationSchema>;
```text

#### 2. Drizzle Schema (packages/db/schemas)

```typescript
export const accommodations = pgTable('accommodations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  capacity: integer('capacity').notNull(),
  pricePerNight: numeric('price_per_night', { precision: 10, scale: 2 }).notNull(),
  hostId: uuid('host_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```text

#### 3. Model (packages/db/models)

**RED:**

```typescript
describe('AccommodationModel', () => {
  it('should create accommodation', async () => {
    const model = new AccommodationModel(db);
    const data = {
      name: 'Beach House',
      type: 'house',
      capacity: 6,
      pricePerNight: 150,
      hostId: testUser.id,
    };

    const result = await model.create(data);

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Beach House');
  });
});
```text

**GREEN:**

```typescript
export class AccommodationModel extends BaseModel<Accommodation> {
  protected table = accommodations;
  protected entityName = 'Accommodation';
}
```text

**Tests pass! BaseModel provides create() method**

#### 4. Service (packages/service-core)

**RED:**

```typescript
describe('AccommodationService', () => {
  it('should create accommodation for host user', async () => {
    const service = new AccommodationService(ctx);
    const input = createTestAccommodation();
    const user = createTestUser({ role: 'host' });

    const result = await service.create({ input, user });

    expect(result.accommodation).toBeDefined();
    expect(result.accommodation.hostId).toBe(user.id);
  });

  it('should reject non-host users', async () => {
    const service = new AccommodationService(ctx);
    const input = createTestAccommodation();
    const user = createTestUser({ role: 'guest' }); // Not a host!

    await expect(
      service.create({ input, user })
    ).rejects.toThrow('Only hosts');
  });
});
```text

**GREEN + REFACTOR:**

```typescript
export class AccommodationService extends BaseCrudService<...> {
  constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, model ?? new AccommodationModel(ctx.db));
  }

  async create({ input, user }: CreateParams) {
    return this.runWithLoggingAndValidation(
      'create',
      { input, user },
      async () => {
        // Business rule: Only hosts can create
        if (user.role !== 'host') {
          throw new ServiceError(
            'Only hosts can create accommodations',
            ServiceErrorCode.FORBIDDEN
          );
        }

        // Set hostId to current user
        const data = {
          ...input,
          hostId: user.id,
          status: 'pending',
        };

        const accommodation = await this.model.create(data);

        return { accommodation };
      }
    );
  }
}
```text

#### 5. API Routes (apps/api)

**RED (integration test):**

```typescript
describe('POST /api/accommodations', () => {
  it('should create accommodation', async () => {
    const input = {
      name: 'Beach House',
      type: 'house',
      capacity: 6,
      pricePerNight: 150,
    };

    const response = await app.request('/api/accommodations', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'Authorization': `Bearer ${hostToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.accommodation.name).toBe('Beach House');
  });
});
```text

**GREEN:**

```typescript
import { createCRUDRoute } from '../../factories/route-factory';
import { AccommodationService } from '@repo/service-core';
import {
  createAccommodationSchema,
  updateAccommodationSchema,
  searchAccommodationSchema,
} from '@repo/schemas';

const crudRoute = createCRUDRoute({
  service: AccommodationService,
  schemas: {
    create: createAccommodationSchema,
    update: updateAccommodationSchema,
    search: searchAccommodationSchema,
  },
  options: {
    skipAuth: false,
    permissions: ['accommodation:write'],
  },
});

export default crudRoute;
```text

#### 6. Frontend (apps/web or apps/admin)

**Component with tests:**

```typescript
// AccommodationCard.test.tsx
describe('AccommodationCard', () => {
  it('should render accommodation details', () => {
    render(<AccommodationCard accommodation={mockData} />);

    expect(screen.getByText('Beach House')).toBeInTheDocument();
    expect(screen.getByText('$150 / night')).toBeInTheDocument();
  });
});

// AccommodationCard.tsx
export const AccommodationCard = ({ accommodation }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{accommodation.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>${accommodation.pricePerNight} / night</p>
      </CardContent>
    </Card>
  );
};
```text

---

### Step 4: Continuous Verification

**After Each Task:**

1. **Run Linter**

   ```bash
   pnpm lint
   ```

   Fix any issues immediately

2. **Run Type Check**

   ```bash
   pnpm typecheck
   ```

   Fix type errors immediately

3. **Run Tests**

   ```bash
   pnpm test
   ```

   Ensure all tests pass

4. **Check Coverage**

   ```bash
   pnpm test:coverage
   ```

   Ensure 90%+ coverage

**Never move to next task with failing tests or lint errors!**

---

### Step 4.5: Task Completion with Git Commits

**After Each Task:**

When you've completed a task (tests pass, lint clean, code meets standards):

1. **Review Changed Files**

   ```bash
   git status --short
   ```

   Analyze what files changed during this task.

   **🔥 CRITICAL: Only Commit Task-Related Files**

   **Rule:** ONLY include files that were modified during THIS specific task.

   If `git status` shows unrelated modified files:
   - ❌ **DO NOT** include them in this commit
   - ❌ **DO NOT** use `git add .` or `git add -A`
   - ✅ **ONLY** use `git add <specific-file>` for task files
   - ⚠️ **WARN** user about unrelated changes

   **Example:**

   ```bash
   # Task: "Create User model"
   # git status shows:
   M packages/db/src/models/user.model.ts      ← INCLUDE (this task)
   M packages/db/test/models/user.model.test.ts ← INCLUDE (this task)
   M packages/api/routes/booking.ts            ← EXCLUDE (different task)
   M .env.local                                 ← EXCLUDE (local config)

   # Only commit task-related files:
   git add packages/db/src/models/user.model.ts
   git add packages/db/test/models/user.model.test.ts
   ```

   **If unrelated files detected:**

   ```text
   ⚠️ Warning: Unrelated modified files detected:
   - packages/api/routes/booking.ts (not part of current task)
   - .env.local (local configuration)

   I will ONLY commit files related to the current task.
   Unrelated files will remain uncommitted for their respective tasks.

   Proceeding with task-related files only. OK? (yes/no)
   ```

2. **Generate Commit Suggestions**

   Group ONLY task-related files into logical commits:
   - Schema changes
   - Model + tests
   - Service + tests
   - API routes
   - Other changes

3. **Present to User**

   ```
   🎯 Task Completed: "{task_title}"

   📝 Changed Files:
      M packages/db/src/models/user.model.ts
      A packages/schemas/src/entities/user.schema.ts
      M packages/db/test/models/user.model.test.ts

   💾 Suggested Commits:

   1. feat(schemas): add user validation schemas
      git add packages/schemas/src/entities/user.schema.ts
      git commit -m "..."

   2. feat(db): implement User model with tests
      git add packages/db/src/models/user.model.ts packages/db/test/...
      git commit -m "..."

   Would you like me to:
   1. Execute these commits and mark task as complete
   2. Modify the commits first
   3. Skip commits (NOT RECOMMENDED)
   ```

4. **Execute Based on Response**

   - **Option 1**: Execute commits → Mark complete in TODOs.md & Linear
   - **Option 2**: Ask for modifications → Regenerate → Present again
   - **Option 3**: Warn user → Mark complete only if confirmed

5. **Confirm Completion**

   ```
   ✅ Commits created:
      • abc1234 feat(schemas): add user validation schemas
      • def5678 feat(db): implement User model with tests

   ✅ Task marked as completed!
      📝 TODOs.md updated
      🔗 Linear: https://linear.app/hospeda/issue/HOSP-124

   💡 Don't forget to push: git push
   ```

**IMPORTANT**: Code MUST be committed before marking task complete.
This ensures cross-device sync works correctly.

**See**: [Task Completion Protocol](./task-completion-protocol.md) for full details

---

### Step 5: Documentation

**For Each Component/Function:**

1. **Write JSDoc**
   - Purpose
   - Parameters
   - Return value
   - Examples
   - Side effects
   - See also links

2. **Update Comments**
   - Explain WHY, not WHAT
   - Document non-obvious decisions
   - Add TODOs if needed

---

### Step 6: Update Progress

**🔥 CRITICAL: Update ALL State Files After Completing Each Task**

When you complete ANY task during Phase 2, you MUST immediately update all state tracking files:

**Required State Updates:**

1. **Mark Complete in TODOs.md**

   ```markdown
   - [x] **[1h]** Create AccommodationModel
     - Completed: 2024-01-15 by @db-engineer
     - Actual time: 1.2h
     - Notes: Added custom findAll override
   ```

2. **Update .checkpoint.json**

   ```json
   {
     "currentPhase": "phase-2-implementation",
     "tasks": {
       "T-001": {
         "id": "T-001",
         "title": "Create AccommodationModel",
         "status": "completed",
         "started": "2024-01-15T10:00:00Z",
         "completed": "2024-01-15T11:12:00Z",
         "estimated": "1h",
         "actual": "1.2h"
       }
     },
     "progress": {
       "total": 45,
       "completed": 12,
       "inProgress": 2,
       "notStarted": 31,
       "percentage": 26.7
     },
     "lastUpdated": "2024-01-15T11:12:00Z"
   }
   ```

3. **Update issues-sync.json**

   ```json
   {
     "sessionId": "P-001-accommodation-system",
     "issues": {
       "HOSP-124": {
         "id": "HOSP-124",
         "linearId": "abc-123-def-456",
         "status": "done",
         "title": "Create AccommodationModel",
         "lastSync": "2024-01-15T11:12:00Z",
         "syncStatus": "synced"
       }
     },
     "metadata": {
       "totalIssues": 45,
       "completedIssues": 12,
       "lastSync": "2024-01-15T11:12:00Z"
     }
   }
   ```

4. **Update Progress Summary in TODOs.md**

   ```markdown
   ## Progress Summary

   - Total: 45 tasks
   - Completed: 12 (27%) ⬅️ UPDATE THIS
   - In Progress: 2
   - Not Started: 31

   Last Updated: 2024-01-15 11:12:00
   ```

5. **Document Decisions**

   ```markdown
   ### YYYY-MM-DD

   - Decided to use composite index instead of separate indexes
   - Reason: Better query performance for common use case
   ```

6. **Commit State Updates**

   ```bash
   git add .claude/sessions/planning/{feature}/TODOs.md
   git add .claude/sessions/planning/{feature}/.checkpoint.json
   git add .claude/sessions/planning/{feature}/issues-sync.json
   git commit -m "docs: update progress - T-001 completed (12/45)"
   ```

**⚠️ CRITICAL RULES:**

- Update state files **IMMEDIATELY** after completing each task
- **NEVER** batch state updates for multiple tasks
- **NEVER** skip state updates "to save time"
- **ALWAYS** commit state changes separately from code changes
- **ALWAYS** keep the three files in sync (TODOs.md, .checkpoint.json, issues-sync.json)

**Why This Matters:**

- Enables cross-device workflow (switch machines and continue)
- Provides accurate progress tracking
- Maintains sync with Linear/GitHub
- Prevents lost work tracking
- Allows team visibility

**See Also:** [Task Completion Protocol](./task-completion-protocol.md) for full details

---

## Code Quality

### Before Committing

- [ ] Code follows standards
- [ ] All exports have JSDoc
- [ ] Tests written and passing
- [ ] Coverage ≥ 90%
- [ ] Lint passing
- [ ] TypeCheck passing
- [ ] No console.logs left
- [ ] No commented code
- [ ] Files under 500 lines
- [ ] Follows existing patterns

### Code Review Yourself

Before submitting, review your own code:

1. Read through all changes
2. Check for improvements
3. Verify consistency
4. Look for edge cases
5. Check error handling

---

## Progress Tracking

### Daily Updates

**At End of Day:**

1. Update TODOs.md
2. Mark completed tasks
3. Note blockers
4. Plan tomorrow

**Format:**

```markdown

### 2024-01-15

**Completed:**

- Created AccommodationModel
- Created AccommodationService base
- Wrote 15 unit tests

**In Progress:**

- Implementing availability check logic

**Blockers:**

- Need clarification on discount rules

**Next Steps:**

- Complete availability check
- Start price calculation
- Add integration tests

```text

---

## Common Issues

### Issue 1: Breaking Existing Tests

**Problem:** New code breaks unrelated tests

**Solution:**

- Run full test suite frequently
- Fix immediately
- Don't accumulate technical debt

### Issue 2: Skipping Tests

**Problem:** "I'll add tests later"

**Consequence:** Tests never added, bugs introduced

**Solution:** TDD is mandatory. No exceptions.

### Issue 3: Large Commits

**Problem:** Committing 10 tasks at once

**Solution:** Commit per task or per logical unit

### Issue 4: Deviating from Plan

**Problem:** Adding unplanned features

**Solution:**

- Stick to plan
- If changes needed, update PDR and get approval
- Don't scope creep

### Issue 5: Not Following Patterns

**Problem:** Reinventing patterns instead of reusing

**Solution:**

- Review similar code first
- Follow existing patterns exactly
- Prefer modification over reimplementation

---

## Summary Checklist

Per Task:

- [ ] Tests written first (RED)
- [ ] Code implements tests (GREEN)
- [ ] Code refactored (REFACTOR)
- [ ] Lint passing
- [ ] TypeCheck passing
- [ ] Coverage ≥ 90%
- [ ] JSDoc complete
- [ ] Progress updated
- [ ] No blockers

Per Day:

- [ ] All completed tasks marked
- [ ] Progress metrics updated
- [ ] Blockers documented
- [ ] Tomorrow planned

---

**Remember: Quality > Speed. Take time to do it right the first time.**

