# Task Atomization System

This document defines how to break down features into atomic tasks for the Hospeda project.

---

## Table of Contents

1. [Overview](#overview)
2. [Atomization Framework](#atomization-framework)
3. [Task Sizing Guidelines](#task-sizing-guidelines)
4. [Estimation Process](#estimation-process)
5. [Dependency Management](#dependency-management)
6. [Examples](#examples)

---

## Overview

### What is Task Atomization?

**Task atomization** is the process of breaking down a feature into small, manageable, independent tasks that can be completed in 1-2 hours.

### Why Atomic Tasks?

**Benefits:**

- Easier to estimate
- Faster to complete
- Clear definition of "done"
- Better progress tracking
- Easier to parallelize
- Reduced cognitive load
- Better for TDD workflow

**Ideal Task Size:** 1-2 hours

---

## Atomization Framework

### Combined System (Levels + Layers)

We use a **hybrid approach** combining:

1. **Hierarchical levels** (Feature → Phase → Story → Task → Subtask)
2. **Technical layers** (Database → Service → API → Frontend)

```text
Feature (Epic)
├── Phase: Planning & Design [2-3h]
│   └── Story: Requirements & Design
│       ├── Task: Define requirements [30m-1h]
│       └── Task: Create designs [1-2h]
│
├── Phase: Database Layer [2-3h]
│   └── Story: Data Model
│       ├── Task: Create schemas [30m]
│       ├── Task: Create model [30m]
│       └── Task: Write tests [1h]
│
├── Phase: Service Layer [2-3h]
│   └── Story: Business Logic
│       ├── Task: Create service [1h]
│       ├── Task: Add validations [40m]
│       └── Task: Write tests [1h]
│
├── Phase: API Layer [2-3h]
│   └── Story: API Endpoints
│       ├── Task: Create routes [1h]
│       ├── Task: Add middleware [30m]
│       └── Task: Write tests [1h]
│
└── Phase: Frontend Layer [3-4h]
    └── Story: UI Components
        ├── Task: Create components [1-2h]
        ├── Task: Add state management [1h]
        └── Task: Write tests [1h]
```text

---

## Task Sizing Guidelines

### Task Hierarchy

```text
Feature (Epic): Complete user-facing functionality
  ├── Phase: Major development stage (2-4 hours)
  │   ├── Story: User-visible capability (4-8 hours)
  │   │   ├── Task: Technical implementation (1-2 hours) ⭐ ATOMIC
  │   │   │   └── Subtask: Specific step (15-30 min)
```text

### Size by Level

| Level | Duration | Description | Example |
|-------|----------|-------------|---------|
| **Feature** | Days-Weeks | Complete functionality | Accommodation Listing System |
| **Phase** | 2-4 hours | Development stage | Database Layer Implementation |
| **Story** | 4-8 hours | User capability | Create Accommodation Listing |
| **Task** | 1-2 hours | Technical unit | Create AccommodationModel ⭐ |
| **Subtask** | 15-30 min | Specific step | Define table schema |

### Atomic Task Characteristics

An **atomic task** must be:

✅ **Completable in 1-2 hours**

- If longer, break it down further
- If shorter (<30m), consider combining

✅ **Independently testable**

- Can write tests for it
- Tests verify completion

✅ **Single responsibility**

- Does one thing well
- Clear purpose

✅ **Clear definition of done**

- No ambiguity about completion
- Specific acceptance criteria

✅ **Minimal dependencies**

- Depends on few other tasks
- Can be parallelized when possible

---

## Estimation Process

### How to Estimate

1. **Understand the Requirement**
   - Read PDR.md acceptance criteria
   - Review technical analysis
   - Clarify any ambiguity

2. **Identify Layers**
   - Database (schemas, models)
   - Service (business logic)
   - API (routes, validation)
   - Frontend (components, state)

3. **Break Down by Layer**
   - List tasks for each layer
   - Follow entity creation order
   - Consider testing for each

4. **Estimate Each Task**
   - Use past experience
   - Consider complexity
   - Add buffer for unknowns (20%)

5. **Sum Up**
   - Phase total = sum of tasks
   - Feature total = sum of phases

### Estimation Template

```text
Task: Create AccommodationModel
├── Define Zod schemas [30m]
├── Infer types [15m]
├── Create Drizzle schema [30m]
├── Implement model class [30m]
├── Override findAll (if needed) [30m]
├── Write unit tests [45m]
└── Total: ~3h (estimate 3.5h with buffer)
```text

### Common Estimation Mistakes

❌ **Too Optimistic**

```text
Task: Build entire frontend [2h]
```text

This is WAY too big. Should be 10+ tasks.

❌ **No Testing Time**

```text
Task: Create UserService [1h]
```text

Missing test time. Should be:

- Implement service [1h]
- Write tests [1h]

❌ **Vague Description**

```text
Task: Fix stuff [1h]
```text

What stuff? Not specific enough.

✅ **Good Estimation**

```text
Task: Implement UserService.create() method [1h]
├── Setup method structure [15m]
├── Add business validation [20m]
├── Call model.create [10m]
├── Handle errors [15m]
Subtasks total: 60m
```text

---

## Dependency Management

### Types of Dependencies

**Sequential (Must Wait):**

```text
Task A → Task B → Task C
```text

Example:

```text
Create Schema → Create Model → Create Service
```text

**Parallel (Can Work Simultaneously):**

```text
Task A ─┐
Task B ─┼→ Next Phase
Task C ─┘
```text

Example:

```text
Frontend Component A ─┐
Frontend Component B ─┼→ Integration
Frontend Component C ─┘
```text

**Optional (Nice to Have):**

```text
Task A (required)
Task B (optional, can defer)
```text

### Dependency Notation in TODOs

```markdown

- [ ] **[1h]** Create AccommodationService
  - **Dependencies**: AccommodationModel complete
  - **Blocks**: API routes
  - **Can Parallel**: Frontend mockups

```text

### Managing Blockers

When a task is blocked:

1. **Identify Blocker**

   ```

   Task: Create booking form
   Blocker: API endpoint not ready

   ```

2. **Find Workaround**

   ```

   Workaround: Use mock API, implement real API later

   ```

3. **Track in TODOs.md**

   ```markdown
   ## Blockers
   | Task | Blocker | Resolution |
   |------|---------|------------|
   | Booking form | API not ready | Using mock data |
   ```

4. **Update When Unblocked**

   ```
   Blocker resolved: API ready, integrate real endpoint
   ```

---

## Examples

### Example 1: Simple CRUD Entity (Amenity)

```text
Feature: Amenity Management
Estimated: 12 hours

Phase 1: Planning [1h]
└── Story: Define amenity requirements
    └── Task: Create PDR section for amenities [1h]

Phase 2: Database Layer [2h]
└── Story: Amenity data model
    ├── Task: Create Zod schemas [30m]
    │   ├── Subtask: Base schema [15m]
    │   └── Subtask: CRUD schemas [15m]
    ├── Task: Create Drizzle schema [30m]
    │   ├── Subtask: Define table [15m]
    │   └── Subtask: Add relationships [15m]
    └── Task: Create AmenityModel [1h]
        ├── Subtask: Extend BaseModel [20m]
        ├── Subtask: Add findAll override [20m]
        └── Subtask: Write model tests [20m]

Phase 3: Service Layer [2h]
└── Story: Amenity business logic
    ├── Task: Create AmenityService [1h]
    │   ├── Subtask: Extend BaseCrudService [20m]
    │   └── Subtask: Add custom methods [40m]
    └── Task: Write service tests [1h]

Phase 4: API Layer [2h]
└── Story: Amenity API endpoints
    ├── Task: Create amenity routes [1h]
    │   ├── Subtask: Setup route file [15m]
    │   ├── Subtask: Use CRUD factory [30m]
    │   └── Subtask: Add custom routes [15m]
    └── Task: Write integration tests [1h]

Phase 5: Frontend Layer [3h]
└── Story: Amenity UI components
    ├── Task: Create AmenityList component [1h]
    ├── Task: Create AmenityBadge component [30m]
    ├── Task: Add to accommodation form [1h]
    └── Task: Write component tests [30m]

Phase 6: Validation [1.5h]
└── Story: Quality assurance
    ├── Task: QA validation [30m]
    ├── Task: Code review [30m]
    └── Task: Fix issues [30m]

Phase 7: Documentation [0.5h]
└── Story: Document amenity feature
    └── Task: Update API docs [30m]

Total: ~12 hours
```text

### Example 2: Complex Feature (Booking System)

```text
Feature: Accommodation Booking System
Estimated: 40+ hours

Phase 1: Planning & Design [4h]
└── Story: Define booking requirements
    ├── Task: Create user stories [1h]
    ├── Task: Design booking flow [1h]
    ├── Task: Create wireframes [1h]
    └── Task: Define business rules [1h]

Phase 2: Database Layer [6h]
└── Story: Booking data model
    ├── Task: Design database schema [1h]
    ├── Task: Create Zod schemas (booking, booking item) [1h]
    ├── Task: Create Drizzle schemas [1h]
    ├── Task: Create BookingModel [1.5h]
    ├── Task: Create BookingItemModel [1h]
    └── Task: Write model tests [1.5h]

Phase 3: Service Layer [8h]
└── Story: Booking business logic
    ├── Task: Create BookingService structure [1h]
    ├── Task: Implement availability check [2h]
    │   ├── Subtask: Query overlapping bookings [1h]
    │   ├── Subtask: Business rule validation [30m]
    │   └── Subtask: Write tests [30m]
    ├── Task: Implement price calculation [2h]
    │   ├── Subtask: Base price logic [30m]
    │   ├── Subtask: Discount rules [1h]
    │   └── Subtask: Write tests [30m]
    ├── Task: Implement booking creation [2h]
    │   ├── Subtask: Create booking record [30m]
    │   ├── Subtask: Handle transaction [30m]
    │   ├── Subtask: Send notifications [30m]
    │   └── Subtask: Write tests [30m]
    └── Task: Implement cancellation logic [1h]

Phase 4: API Layer [6h]
└── Story: Booking API endpoints
    ├── Task: Create booking routes [2h]
    ├── Task: Add availability endpoint [1.5h]
    ├── Task: Add price calculation endpoint [1h]
    ├── Task: Add auth middleware [30m]
    └── Task: Write integration tests [2h]

Phase 5: Frontend - Web App [8h]
└── Story: Booking UI
    ├── Task: Create BookingForm component [2h]
    │   ├── Subtask: Date picker setup [30m]
    │   ├── Subtask: Availability check UI [1h]
    │   └── Subtask: Form validation [30m]
    ├── Task: Create BookingConfirmation component [1h]
    ├── Task: Create BookingList component [1.5h]
    ├── Task: Setup TanStack Query [1.5h]
    ├── Task: Implement booking flow [1.5h]
    └── Task: Write component tests [1.5h]

Phase 6: Frontend - Admin [4h]
└── Story: Admin booking management
    ├── Task: Create admin booking list [1.5h]
    ├── Task: Create booking detail view [1h]
    ├── Task: Add cancellation UI [1h]
    └── Task: Write tests [30m]

Phase 7: Integration [3h]
└── Story: End-to-end integration
    ├── Task: Payment integration [1.5h]
    ├── Task: Email notifications [1h]
    └── Task: Write E2E tests [30m]

Phase 8: Validation [3h]
└── Story: QA and review
    ├── Task: QA validation [1h]
    ├── Task: Security review [1h]
    ├── Task: Performance review [30m]
    └── Task: Fix critical issues [30m]

Phase 9: Documentation [1h]
└── Story: Documentation
    ├── Task: API documentation [30m]
    └── Task: User guide [30m]

Total: ~43 hours
```text

### Example 3: Refactoring Task

```text
Feature: Optimize Accommodation Search Performance
Estimated: 8 hours

Phase 1: Analysis [2h]
└── Story: Identify bottlenecks
    ├── Task: Profile current queries [1h]
    ├── Task: Analyze slow queries [30m]
    └── Task: Design optimization plan [30m]

Phase 2: Database Optimization [3h]
└── Story: Improve query performance
    ├── Task: Add composite indexes [1h]
    │   ├── Subtask: Create migration [30m]
    │   └── Subtask: Test index usage [30m]
    ├── Task: Optimize text search [1h]
    │   ├── Subtask: Add tsvector column [30m]
    │   └── Subtask: Create trigger [30m]
    └── Task: Update model queries [1h]

Phase 3: Service Layer [1.5h]
└── Story: Optimize service logic
    ├── Task: Add caching layer [1h]
    └── Task: Update tests [30m]

Phase 4: Validation [1.5h]
└── Story: Verify improvements
    ├── Task: Performance testing [1h]
    └── Task: Update documentation [30m]

Total: ~8 hours
```text

---

## Task Breakdown Checklist

Before finalizing task breakdown:

- [ ] All tasks are 1-2 hours (atomic)
- [ ] Each task has clear acceptance criteria
- [ ] Dependencies identified
- [ ] Tests included for each task
- [ ] Estimation includes buffer (20%)
- [ ] Tasks follow entity creation order
- [ ] Phases organized by layer
- [ ] Total matches PDR complexity estimate
- [ ] Can track progress clearly
- [ ] Tasks are independently completable

---

## Tips for Good Atomization

### DO:

✅ Break tasks by technical layer first
✅ Include test writing as separate tasks
✅ Add 20% buffer to estimates
✅ Make dependencies explicit
✅ Use consistent task naming
✅ Follow entity creation order

### DON'T:

❌ Create tasks larger than 2 hours
❌ Forget to include testing time
❌ Mix multiple layers in one task
❌ Skip dependency identification
❌ Make vague task descriptions
❌ Forget about refactoring time

---

**Remember: If a task feels too big, break it down further. When in doubt, make it smaller.**

