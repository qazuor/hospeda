# Phase 1: Planning

This document describes the planning phase workflow for the Hospeda project.

---

## Table of Contents

1. [Overview](#overview)
2. [Goals](#goals)
3. [Process](#process)
4. [Deliverables](#deliverables)
5. [Quality Criteria](#quality-criteria)
6. [Common Pitfalls](#common-pitfalls)

---

## Overview

**Phase 1** is the planning and design phase where we create a comprehensive, atomic plan ready for implementation.

**Duration:** 2-6 hours (depending on feature complexity)

**Key Principle:** Plan thoroughly before coding. Good planning saves time in implementation.

---

## Goals

### Primary Goals

1. **Define Requirements**: Clear user stories with acceptance criteria
2. **Design Solution**: Technical approach and architecture
3. **Break Down Work**: Atomic tasks with estimates
4. **Identify Risks**: Technical and business risks with mitigations
5. **Get Approval**: User approval before implementation begins

### Success Metrics

- ✅ All acceptance criteria defined and testable
- ✅ All tasks are atomic (1-2 hours each)
- ✅ Dependencies identified and documented
- ✅ Technical approach validated
- ✅ User approves plan

---

## Process

### Step 1: Initialize Context

**Duration:** 5 minutes

**Action:**

```bash
mkdir -p .claude/sessions/planning/{feature_name}
cd .claude/sessions/planning/{feature_name}
```text

**Files to Create:**

- `PDR.md` (from template)
- `tech-analysis.md` (from template)
- `TODOs.md` (from template)

**Command:**

```text
/start-feature-plan
```text

---

### Step 2: Functional Specification

**Duration:** 1-2 hours

**Agent:** `product-functional`

**Activities:**

1. **Understand the Problem**
   - What problem are we solving?
   - Who is affected?
   - Why does this matter?

2. **Create User Stories**

   ```

   As a [user type]
   I want to [action]
   So that [benefit]

   ```

3. **Define Acceptance Criteria**

   ```

   Given [precondition]
   When [action]
   Then [expected result]

   ```

   **Rules:**

   - Each criterion must be testable
   - Use specific, measurable language
   - Cover happy path AND edge cases

4. **Create Mockups/Wireframes**
   - Low fidelity for simple features
   - High fidelity for complex UI
   - Show all states (default, loading, error, success)
   - Mobile + Desktop views

5. **Define Constraints**
   - Performance requirements
   - Security requirements
   - Accessibility requirements (WCAG AA)
   - Browser support

**Deliverable:** Complete `PDR.md` sections 1-4

**Review:**

- Present to user
- Get feedback
- Iterate until approved
- **DO NOT proceed without approval**

---

### Step 3: Technical Analysis

**Duration:** 1-2 hours

**Agent:** `product-technical`

**Activities:**

1. **Architecture Design**
   - Which layers are affected?
   - New entities needed?
   - Existing entities to modify?
   - Integration points?

2. **Technology Stack**
   - New dependencies needed?
   - Why chosen over alternatives?
   - Bundle size impact?

3. **Database Design**

   ```mermaid
   erDiagram
       ENTITY_A ||--o{ ENTITY_B : relationship
   ```

- Schema changes
- Relationships
- Indexes needed
- Migration strategy

4. **API Design**

   - Endpoints needed
   - Request/response formats
   - Authentication required?
   - Rate limiting?

5. **Service Design**

   - Business logic flow
   - Validation rules
   - Transaction boundaries
   - Error handling

6. **Frontend Design**

   - Components needed
   - State management approach
   - Routing changes
   - Performance considerations

7. **Risk Analysis**

   | Risk | Impact | Probability | Mitigation |
   |------|--------|-------------|------------|
   | {Risk} | High/Med/Low | High/Med/Low | {How to handle} |

**Deliverable:** Complete `tech-analysis.md`

**Review:**

- Technical approach sound?
- All layers considered?
- Risks identified?
- Get user approval

---

### Step 4: Task Breakdown

**Duration:** 1-2 hours

**Agent:** `product-technical`

**Activities:**

1. **Identify Phases**
   - Phase 1: Planning (already done)
   - Phase 2: Implementation
   - Phase 3: Validation
   - Phase 4: Finalization

2. **Break Down Phase 2 by Layer**

   ```
   Phase 2: Implementation
   ├── Database Layer
   ├── Service Layer
   ├── API Layer
   └── Frontend Layer
   ```

3. **Create Tasks per Layer**

   Follow **entity creation order**:

   - Zod schemas
   - Types (z.infer)
   - Drizzle schema
   - Model
   - Service
   - API routes
   - Frontend

4. **Subdivide into Atomic Tasks**

   Each task should be:

   - 1-2 hours duration
   - Single responsibility
   - Independently testable
   - Clear definition of done

5. **Estimate Each Task**

   Consider:

   - Complexity
   - Similar past work
   - Testing time
   - Buffer (20%)

6. **Identify Dependencies**

   ```
   Task A (no dependencies)
   Task B (depends on Task A)
   Task C (depends on Task B)
   ```

7. **Assign Priorities**
   - P0: Critical (must have)
   - P1: High (should have)
   - P2: Medium (nice to have)
   - P3: Low (could have)

**Deliverable:** Initial `TODOs.md` with task breakdown

---

### Step 5: Iterative Refinement

**Duration:** 30 minutes - 1 hour

**Thinking Modes:**

1. **System 2 Thinking** (Deep Analysis)
   - Review each task carefully
   - Is it truly atomic (1-2 hours)?
   - Does it have clear acceptance criteria?
   - Can it be tested independently?

2. **Tree of Thoughts** (Multiple Approaches)
   - Consider alternative breakdowns
   - Evaluate tradeoffs
   - Choose optimal approach
   - Document why chosen

3. **Iterative Refinement** (Polish)
   - Look for edge cases
   - Check for missed tasks
   - Verify dependencies
   - Ensure consistency

**Process:**

1. **Review All Tasks**
   - Are any > 2 hours? → Break down further
   - Are any < 30 minutes? → Consider combining
   - Missing tests? → Add test tasks
   - Clear descriptions? → Improve wording

2. **Check Dependencies**
   - All dependencies identified?
   - Any circular dependencies? → Fix
   - Can tasks be parallelized? → Mark as parallel

3. **Verify Completeness**
   - All layers covered?
   - All entity creation steps?
   - Documentation tasks?
   - Testing tasks?
   - QA tasks?

4. **Validate Estimates**
   - Sum of tasks = reasonable total?
   - Matches complexity estimate?
   - Buffer included?

5. **Re-analyze Entire Plan**
   - Read through from start
   - Look for gaps
   - Check for problems
   - Repeat until 100% confident

**Goal:** Be completely confident that the plan is:

- Complete
- Accurate
- Actionable
- Realistic

---

### Step 6: Create TODO List

**Duration:** 30 minutes

**Agent:** `product-technical`

**Format:**

```markdown

# TODO List: {Feature Name}

## Progress Summary

- Total: {n} tasks
- Completed: 0
- In Progress: 0

## Phase 2: Implementation

### P0 - Critical

#### Database Layer

- [ ] **[30m]** Create Zod schemas
  - Dependencies: None
  - Assignee: @db-engineer

- [ ] **[30m]** Create Drizzle schema
  - Dependencies: Zod schemas
  - Assignee: @db-engineer

#### Service Layer

...

### P1 - High

...

## Phase 3: Validation

...
```text

**Include:**

- Progress tracking
- Time estimates
- Dependencies
- Assignees (agents)
- Priority levels
- Status tracking

**Deliverable:** Complete `TODOs.md`

---

### Step 7: Update PDR

**Duration:** 15 minutes

**Activities:**

1. **Add Links**

   ```markdown
   ## Related Documents

   - [Technical Analysis](./tech-analysis.md)
   - [TODOs & Progress](./TODOs.md)
   ```

2. **Document Changes**

   - Any changes from initial requirements?
   - Why were changes made?
   - Update changelog

3. **Final Review**
   - All sections complete?
   - Acceptance criteria clear?
   - Constraints documented?

**Deliverable:** Final `PDR.md` with all links

---

### Step 8: User Approval

**Duration:** Variable (wait for user)

**Present to User:**

```text
Planning complete for {Feature Name}!

I've created a comprehensive plan:

📄 PDR.md (Product Design Requirements)

- {n} user stories
- {n} acceptance criteria
- Mockups and wireframes
- Technical constraints

🔧 tech-analysis.md (Technical Analysis)

- Architecture decisions
- Database design
- API design
- Risk analysis

✅ TODOs.md (Task Breakdown)

- {n} total tasks
- All tasks 1-2 hours (atomic)
- Dependencies mapped
- Estimated total: {n} hours

Key decisions:

1. {Decision 1}
2. {Decision 2}
3. {Decision 3}

Do you approve this plan?
```text

**Wait for Approval:**

- If approved → Proceed to Phase 2
- If changes needed → Iterate on plan
- If rejected → Re-analyze approach

**Never proceed without explicit user approval**

---

### Step 9: Sync to Linear (Optional)

**Duration:** 2-5 minutes

**After user approves the plan**, offer to sync with Linear:

```text
Great! The plan is approved.

Would you like me to sync this planning to Linear?

This will:
✅ Create a parent issue: [Planning] {Feature Name}
✅ Create sub-issues for all {n} tasks
✅ Allow you to track progress from any device
✅ Update status automatically as you complete tasks

Sync to Linear? (yes/no)
```

**If User Says Yes:**

1. Run `/sync-planning` command
2. Present sync results with URLs
3. Remind user to commit `issues-sync.json`

**If User Says No:**

1. Skip sync
2. Continue to Phase 2

**Note:** User can always run `/sync-planning` manually later.

**See**: [Sync Planning Command](./../commands/sync-planning.md) for details

---

## Deliverables

### Required Files

1. **PDR.md**
   - Problem statement
   - User stories with acceptance criteria
   - Mockups/wireframes
   - Technical constraints
   - Dependencies and integrations
   - Risks and mitigations
   - Links to other documents

2. **tech-analysis.md**
   - Architecture overview
   - Technology stack
   - Database design
   - API design
   - Service design
   - Frontend design
   - Security considerations
   - Performance considerations
   - Technical risks

3. **TODOs.md**
   - All tasks broken down (atomic)
   - Time estimates
   - Dependencies
   - Priorities
   - Assignees
   - Progress tracking structure

### File Location

All files in: `.claude/sessions/planning/{feature_name}/`

---

## Quality Criteria

### Plan is Ready When

- [ ] All user stories have acceptance criteria
- [ ] All acceptance criteria are testable
- [ ] All mockups/wireframes complete
- [ ] Technical approach documented
- [ ] All tasks are atomic (1-2 hours)
- [ ] All dependencies identified
- [ ] All estimates include buffer
- [ ] Risks identified and mitigated
- [ ] User approved plan

### Red Flags (Plan NOT Ready)

- ❌ Vague acceptance criteria ("should work well")
- ❌ Tasks larger than 2 hours
- ❌ Missing test tasks
- ❌ No mockups for UI features
- ❌ Unclear technical approach
- ❌ Missing dependencies
- ❌ No risk analysis
- ❌ User approval not obtained

---

## Common Pitfalls

### Pitfall 1: Rushing Planning

**Problem:** Skipping planning to "start coding faster"

**Consequence:** Rework, missed requirements, technical debt

**Solution:** Invest time in thorough planning

---

### Pitfall 2: Vague Requirements

**Problem:**

```text
User Story: User should be able to book accommodation
Acceptance Criteria: It should work
```text

**Solution:**

```text
User Story: As a guest, I want to book an accommodation
for specific dates so that I can plan my trip

Acceptance Criteria:

- Given accommodation is available for selected dates

  When I select check-in and check-out dates
  Then I can proceed to booking

- Given accommodation is NOT available

  When I try to book
  Then I see "Not available" message with alternative dates
```text

---

### Pitfall 3: Large Tasks

**Problem:**

```text
Task: Build frontend [8h]
```text

**Solution:**

```text
Task: Create AccommodationList component [1h]
Task: Create AccommodationCard component [1h]
Task: Create AccommodationForm component [1.5h]
Task: Setup TanStack Query [1h]
Task: Integrate with API [1h]
Task: Write component tests [1.5h]
```text

---

### Pitfall 4: Missing Dependencies

**Problem:** Starting Task B before Task A is done

**Solution:** Map all dependencies explicitly

```text
Task A: Create model [1h]
  Dependencies: None

Task B: Create service [1h]
  Dependencies: Task A complete

Task C: Create API route [1h]
  Dependencies: Task B complete
```text

---

### Pitfall 5: No User Approval

**Problem:** Starting implementation without user approval

**Consequence:** Building wrong thing, wasted effort

**Solution:** Always get explicit approval before Phase 2

---

## Summary Checklist

Before moving to Phase 2:

- [ ] PDR.md complete and approved
- [ ] tech-analysis.md complete and reviewed
- [ ] TODOs.md with atomic tasks
- [ ] All tasks 1-2 hours
- [ ] Dependencies mapped
- [ ] Estimates realistic
- [ ] Risks identified
- [ ] User explicitly approved plan
- [ ] 100% confident plan is complete

---

**Remember: Time spent planning is NOT wasted. It prevents wasted time in implementation.**

