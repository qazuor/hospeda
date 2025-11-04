# Workflow Edge Cases & Exception Handling

This document covers non-standard scenarios, exceptions, and edge cases that may occur during any workflow level.

## Table of Contents

- [During Planning](#during-planning)
- [During Implementation](#during-implementation)
- [During Validation](#during-validation)
- [During Finalization](#during-finalization)
- [Cross-Phase Issues](#cross-phase-issues)

---

## During Planning

### Edge Case 1: Unclear or Conflicting Requirements

**Scenario:** User provides vague or contradictory requirements

**Example:**

> "Add search functionality but keep it simple... oh and also make it support advanced filters, autocomplete, and AI-powered suggestions"

**Resolution:**

1. **Do NOT** make assumptions or proceed with implementation
2. **Use** AskUserQuestion tool to clarify
3. **Present** multiple options with trade-offs
4. **Document** clarified requirements in PDR

**Template:**

```text
I see potential conflicts in the requirements:

Option 1: Simple Search
- Basic text search only
- Effort: 1 day
- Trade-off: Limited functionality

Option 2: Advanced Search
- Filters + autocomplete
- Effort: 3 days
- Trade-off: More complex

Option 3: Full-Featured
- All features including AI
- Effort: 2 weeks
- Trade-off: Significant effort, external dependencies

Which aligns best with current priorities?
```

### Edge Case 2: Technical Feasibility Concerns

**Scenario:** Product requirements may not be technically feasible

**Example:** "Load 1 million records in under 100ms with no backend pagination"

**Resolution:**

1. **Analyze** technical constraints
2. **Escalate** to tech-lead for validation
3. **Present** alternatives with feasibility analysis
4. **Recommend** best approach

**Template:**

```text
⚠️ Feasibility Concern

Requirement: [exact requirement]
Issue: [technical limitation]

Analysis:
- Current approach would take ~[X]ms (exceeds target)
- Database/API constraints: [explain]

Alternatives:
1. [Alternative 1] - Meets [X] but not [Y]
2. [Alternative 2] - Different approach, achieves [Z]
3. [Compromise] - Partial solution, realistic timeline

Recommendation: [Which alternative and why]

Needs your decision to proceed.
```

### Edge Case 3: Missing Information or Access

**Scenario:** Cannot proceed with planning due to missing dependencies

**Examples:**

- Need API credentials not yet provisioned
- Design mockups not ready
- Third-party service documentation unavailable

**Resolution:**

1. **Document** blocking dependency in TODOs.md
2. **Create** dependency task: `PB-000: Obtain [resource]`
3. **Notify** user of blocker
4. **Proceed** with non-dependent tasks if possible
5. **Pause** planning if critical blocker

**Template:**

```markdown
## Blockers

### PB-000: Obtain Stripe API Credentials

- **Status**: Blocked
- **Dependency**: Stripe account setup
- **Impact**: Cannot implement payment processing (PB-005, PB-006)
- **Action Required**: User must create Stripe account and provide keys
- **ETA**: Waiting on user

**Tasks that can proceed in parallel:**

- PB-001: Database schema
- PB-002: Models
- PB-003: Mock payment service (for development)
```

### Edge Case 4: Scope Creep During Planning

**Scenario:** Requirements keep growing during planning session

**Resolution:**

1. **Stop** adding to current scope
2. **Document** new requirements as "Future Enhancements"
3. **Propose** phased approach
4. **Get** user confirmation on Phase 1 scope

**Template:**

```text
I notice the scope has expanded significantly:

Original Scope (1 week):
- [Feature A]
- [Feature B]

Current Scope (3+ weeks):
- [Feature A]
- [Feature B]
- [Feature C - new]
- [Feature D - new]
- [Feature E - new]

Recommendation - Phased Approach:

Phase 1 (MVP - 1 week):
- [Feature A]
- [Feature B]

Phase 2 (Enhancements - 2 weeks):
- [Feature C]
- [Feature D]

Future:
- [Feature E]

This ensures we deliver value quickly while managing complexity.

Should we proceed with Phase 1 as the current session scope?
```

---

## During Implementation

### Edge Case 5: Test Failures Block Progress

**Scenario:** Existing tests fail after changes, unrelated to current task

**Example:** Changed a util function, now 15 unrelated tests fail

**Resolution:**

1. **Do NOT** commit broken tests
2. **Assess** if failures are:
   - **Related**: Fix as part of current task
   - **Unrelated**: Create separate bug task
3. **If related**: Fix and include in task
4. **If unrelated**: Document as `PB-XXX-BUG: Fix broken tests`

**Template:**

```text
⚠️ Test Failures Detected

Current Task: PB-005 (Add booking service)

Failing Tests (15):
- 12 tests in payment.service.test.ts
- 3 tests in user.service.test.ts

Analysis:
- ALL failures related to util function change in date-helpers.ts
- NOT directly related to booking service

Action:
1. Create task: PB-005-BUG: Fix date-helpers breaking changes
2. Revert date-helpers changes
3. Complete PB-005 with stable utils
4. Address date-helpers in separate task

Proceed this way?
```

### Edge Case 6: Estimation Significantly Wrong

**Scenario:** Task estimated at 2 hours, already at 6 hours and 50% done

**Resolution:**

1. **Stop** and assess why
2. **Document** actual complexity
3. **Update** TODOs.md with revised estimate
4. **Inform** user if impacts timeline significantly
5. **Continue** or **pause** for re-planning

**Template:**

```text
⚠️ Estimation Mismatch

Task: PB-007 - Frontend components
Estimated: 4 hours
Actual: 8 hours (and counting)
Completion: ~50%

Root Cause:
- Underestimated complexity of [X]
- Did not account for [Y]
- Discovered need for [Z]

Impact:
- This task needs ~16 hours total (12 more)
- Phase 2 timeline extended by 1.5 days
- Overall feature: 5 days → 6.5 days

Options:
1. Continue with revised timeline
2. Reduce scope (remove [feature])
3. Pause for re-planning

Recommendation: [Your recommendation]

How should we proceed?
```

### Edge Case 7: Discovered Legacy Code Issues

**Scenario:** Current task exposes technical debt or bugs in existing code

**Example:** Implementing new feature reveals old code doesn't handle edge cases

**Resolution:**

1. **Assess** severity:
   - **Critical**: Blocks current task → Fix now
   - **High**: Doesn't block → Separate task
   - **Low**: Document for later
2. **Create** bug task if needed
3. **Continue** with current task if non-blocking

**Template:**

```text
🔍 Discovered Issue in Existing Code

Current Task: PB-004 (Implement search service)

Issue Found:
- File: packages/db/models/accommodation.model.ts
- Problem: findById() doesn't handle soft deletes
- Impact: Search results may include deleted accommodations

Severity: HIGH (doesn't block search, but data integrity issue)

Action:
- Create task: PB-004-BUG: Fix soft delete handling in AccommodationModel
- Continue PB-004 with workaround (filter deleted in service layer)
- Address PB-004-BUG after PB-004 complete

Documented in TODOs.md.
```

### Edge Case 8: Merge Conflicts

**Scenario:** Pull/merge from main introduces conflicts

**Resolution:**

1. **Assess** conflict complexity
2. **If simple**: Resolve immediately
3. **If complex**: Ask for guidance
4. **Never** auto-resolve without understanding

**Template:**

```text
⚠️ Merge Conflict Detected

Files in conflict:
- packages/db/src/models/user.model.ts (5 conflicts)
- packages/service-core/src/auth.service.ts (2 conflicts)

Analysis:
- user.model.ts: Conflicting changes to findByEmail() method
  - main branch: Added pagination
  - my branch: Added soft delete check
- auth.service.ts: Both added new methods (no overlap)

Resolution Strategy:
1. user.model.ts: Keep both changes (combine pagination + soft delete)
2. auth.service.ts: Keep both methods

Will resolve and test. Is this approach correct?
```

### Edge Case 9: Breaking Changes in Dependencies

**Scenario:** Dependency update breaks existing code

**Example:** `@tanstack/query` v6 has breaking API changes

**Resolution:**

1. **Do NOT** update mid-task unless critical security fix
2. **Document** as future task
3. **Pin** version in package.json
4. **Complete** current task with stable dependency

**Template:**

```text
⚠️ Dependency Breaking Change Detected

Dependency: @tanstack/query v5 → v6
Issue: API changes break 15 files

Current Task: PB-006 (Add favorites UI)

Decision:
- Pin @tanstack/query to v5.x in package.json
- Complete PB-006 with stable version
- Create separate task: PB-100: Upgrade TanStack Query to v6

This avoids scope creep and maintains stability.

Documented in TODOs.md under "Future Tasks".
```

### Edge Case 10: API Changes During Implementation

**Scenario:** Backend API changes after frontend work started

**Resolution:**

1. **Coordinate** with backend team
2. **Use** API versioning if available
3. **Update** contracts in real-time
4. **Adjust** timeline if significant

**Template:**

```text
🔄 API Change Detected

Endpoint: POST /api/bookings
Change: Added required field `guestCount`

Current Task: PB-007 (Booking form)
Impact: Form validation needs update

Action:
1. Update Zod schema to include guestCount
2. Add field to form UI
3. Update tests
4. Estimate: +1 hour

No major timeline impact. Proceeding with changes.
```

---

## During Validation

### Edge Case 11: E2E Tests Flaky

**Scenario:** E2E tests pass locally, fail in CI

**Resolution:**

1. **Identify** flakiness cause (timing, state, env)
2. **Fix** root cause (don't just retry)
3. **Add** explicit waits if timing issue
4. **Document** if environment-specific

**Template:**

```text
🔄 Flaky E2E Test

Test: "should complete booking flow"
Status: Passes locally (10/10), fails in CI (3/10)

Root Cause Analysis:
- CI environment slower than local
- Test doesn't wait for payment confirmation toast
- Race condition: clicking "confirm" before data loads

Fix:
```typescript
// Before (flaky):
await page.click('[data-testid="confirm-button"]');

// After (stable):
await page.waitForSelector('[data-testid="confirm-button"]:not([disabled])');
await page.click('[data-testid="confirm-button"]');
await page.waitForSelector('text=Booking confirmed');
```

Applying fix to PB-009.

```

### Edge Case 12: Coverage Below 90% Threshold

**Scenario:** Test coverage reports 87%, target is 90%

**Resolution:**

1. **Identify** untested paths with coverage report
2. **Add** missing tests
3. **Do NOT** lower threshold without user approval

**Template:**

```text
⚠️ Coverage Below Threshold

Current: 87%
Target: 90%
Gap: 3%

Untested Areas (from coverage report):
- packages/service-core/src/booking.service.ts:
  - Lines 145-156: Error handling for double booking
  - Lines 201-210: Refund calculation edge case

Action:
- Adding 2 test cases to booking.service.test.ts
- Estimated: 1 hour

ETA: Coverage will reach ~92% after tests added.
```

### Edge Case 13: Performance Regression Detected

**Scenario:** New code causes performance degradation

**Example:** API response time increased from 150ms to 800ms

**Resolution:**

1. **Profile** to find bottleneck
2. **Fix** if simple (missing index, N+1 query)
3. **Escalate** if complex architectural issue

**Template:**

```text
⚠️ Performance Regression

Endpoint: GET /api/accommodations
Before: 150ms (p95)
After: 800ms (p95)
Threshold: < 200ms

Root Cause:
- New filter joins 3 additional tables
- Missing index on `amenities.accommodation_id`

Fix:
```sql
CREATE INDEX idx_amenities_accommodation
  ON amenities(accommodation_id);
```

After fix: 120ms (p95) ✅

Creating migration: PB-010-PERF.

```

### Edge Case 14: Security Vulnerability Found

**Scenario:** Security audit reveals SQL injection risk

**Resolution:**

1. **STOP** validation immediately
2. **Fix** security issue (highest priority)
3. **Re-run** security audit
4. **Document** in security log

**Template:**

```text
🚨 SECURITY ISSUE DETECTED

Severity: HIGH
Type: SQL Injection
Location: packages/db/models/search.model.ts:45

Code:
```typescript
// VULNERABLE:
const query = `SELECT * FROM accommodations WHERE title LIKE '%${input}%'`;
```

Fix:

```typescript
// SECURE:
const query = this.db
  .select()
  .from(accommodations)
  .where(like(accommodations.title, `%${input}%`));
```

Status: FIXED
Verification: Re-running security audit...

MUST fix before proceeding with deployment.

```

---

## During Finalization

### Edge Case 15: Documentation Out of Sync

**Scenario:** Code changed during implementation, docs don't reflect

**Resolution:**

1. **Review** all docs against actual implementation
2. **Update** any discrepancies
3. **Verify** code examples actually work

**Template:**

```text
📝 Documentation Sync Required

Discrepancies Found:
1. API docs show POST /api/bookings requires `roomType`
   - Actual: Field is `accommodationType`
   - Fix: Update OpenAPI spec

2. User guide shows 3-step flow
   - Actual: Now 4 steps (added confirmation)
   - Fix: Update screenshots + text

3. Code example in README outdated
   - Uses old API (v1)
   - Fix: Update to current API (v2)

Applying fixes to docs (PB-012).
```

### Edge Case 16: CHANGELOG Merge Conflict

**Scenario:** Multiple features updating CHANGELOG.md simultaneously

**Resolution:**

1. **Fetch** latest from main
2. **Merge** CHANGELOG entries chronologically
3. **Preserve** both feature entries
4. **Follow** Keep a Changelog format

**Template:**

```text
🔀 CHANGELOG Conflict

My feature: User Favorites
Other feature: Payment Integration (already merged)

Resolution:
```markdown
## [Unreleased]

### Added

- **Payment Integration** - Process payments via Stripe
  - Multiple payment methods
  - Automatic receipt generation
  - [Details](docs/payment-integration.md)

- **User Favorites** - Save favorite accommodations
  - Add/remove favorites
  - Dedicated favorites page
  - [Details](docs/favorites.md)
```

Both entries preserved, alphabetically sorted within "Added" section.

```

---

## Cross-Phase Issues

### Edge Case 17: Critical Bug in Production

**Scenario:** Production bug requires immediate fix during ongoing feature work

**Resolution:**

1. **Assess** severity:
   - **Critical**: Stop feature, fix bug immediately
   - **High**: Complete current atomic task, then fix
   - **Medium/Low**: Continue feature, bug task later
2. **Use** `hotfix/*` branch for critical fixes
3. **Return** to feature after fix deployed

**Template:**

```text
🚨 PRODUCTION BUG

Severity: CRITICAL
Impact: Users cannot complete bookings
Affected: 100% of booking attempts

Current Work: Feature - User Favorites (50% complete)

Decision: PAUSE FEATURE
1. Commit current work to main (atomic commits)
2. Fix critical bug immediately
3. Test and deploy hotfix
4. Resume favorites feature

Current task (PB-006) will be delayed by ~4 hours.

Pausing feature work, switching to hotfix...
```

### Edge Case 18: Requirements Change Mid-Implementation

**Scenario:** User changes requirements after Phase 2 started

**Resolution:**

1. **Assess** impact:
   - **Small**: Adjust current task
   - **Medium**: Add new tasks to Phase 2
   - **Large**: Stop and re-plan
2. **Update** PDR and TODOs if accepting change
3. **Inform** of timeline impact

**Template:**

```text
🔄 Requirements Change

Original: "Users can favorite up to 50 accommodations"
New: "Users can organize favorites into lists (unlimited)"

Current Progress: 60% (8/13 tasks complete)
Impact: SIGNIFICANT

Analysis:
- Requires new table: `favorite_lists`
- New API endpoints for list management
- UI changes for list organization
- +10-15 hours additional work

Options:
1. STOP and re-plan (recommended for large changes)
   - Pro: Proper planning, better architecture
   - Con: Delay current feature

2. Continue with Phase 2 approach
   - Complete current "simple favorites"
   - Plan "favorite lists" as Phase 2
   - Pro: Deliver value incrementally

3. Hybrid: Add minimal lists support
   - Single "default" list now
   - Multiple lists later
   - Pro: Some benefit, manageable scope

Recommendation: Option 2 (phased approach)

Your decision?
```

### Edge Case 19: Team Member Unavailable

**Scenario:** Agent or specialist needed but not available

**Example:** Database engineer needed for complex migration but unavailable

**Resolution:**

1. **Check** if task can be done by another agent with guidance
2. **Consult** tech-lead for architecture decisions
3. **Pause** task if requires specific expertise
4. **Document** blocker and adjust timeline

**Template:**

```text
⚠️ Resource Unavailable

Task: PB-003 (Complex database migration with triggers)
Requires: @db-engineer
Status: Not available (on leave)

Options:
1. PAUSE task until db-engineer returns (ETA: 3 days)
2. Have @hono-engineer tackle with tech-lead guidance
3. Simplify migration to avoid triggers (defer complexity)

Current Impact:
- 3 tasks blocked (PB-004, PB-005, PB-006 depend on PB-003)
- Can work on independent tasks: PB-007, PB-008

Recommendation: Option 3 + adjust timeline
- Simplify migration for now
- Create future task for optimization

Proceed?
```

### Edge Case 20: Disagreement Between Agents

**Scenario:** Tech-lead and architect disagree on approach

**Resolution:**

1. **Present** both viewpoints to user
2. **List** pros/cons of each approach
3. **User decides** final direction
4. **Document** decision and rationale

**Template:**

```text
🤔 Architecture Decision Needed

Disagreement: Caching strategy for search results

**tech-lead's View:**
Use Redis for caching
- Pros: Fast, proven, separate concern
- Cons: Additional infrastructure, cost
- Complexity: Medium

**product-technical's View:**
Use in-memory caching (Node.js)
- Pros: Simple, no extra infra, free
- Cons: Lost on restart, limited by memory
- Complexity: Low

**Context:**
- Expected: 1000 searches/day
- Cache TTL: 5 minutes
- Data size: ~5MB total

**My Analysis:**
For current scale, in-memory sufficient.
Redis when > 10K searches/day.

**Recommendation:** Start with in-memory, plan Redis migration

Both approaches are valid. Your preference?
```

---

## General Principles for Edge Cases

### 1. Always Communicate

- **Never** silently work around issues
- **Always** inform user of blockers or changes
- **Document** all decisions and rationale

### 2. Prefer Explicit Over Implicit

- **Ask** when uncertain
- **Present** options with analysis
- **Get** confirmation before deviating from plan

### 3. Maintain Quality Standards

- **Never** skip tests to save time
- **Never** commit broken code
- **Never** lower quality bars without approval

### 4. Document Everything

- **Update** PDR, tech-analysis, TODOs when things change
- **Track** decisions in docs
- **Note** edge cases for future reference

### 5. Escalate When Appropriate

- **Technical**: Escalate to tech-lead
- **Product**: Escalate to user
- **Blocking**: Escalate immediately
- **Non-blocking**: Document and continue

---

## Quick Reference

| Situation | Severity | Action |
|-----------|----------|--------|
| Unclear requirements | Medium | AskUserQuestion, present options |
| Missing credentials | High | Document blocker, pause if critical |
| Test failures (related) | Medium | Fix as part of current task |
| Test failures (unrelated) | Low | Create separate bug task |
| Wrong estimate | Medium | Update timeline, inform user |
| Merge conflict | Medium | Resolve carefully, ask if complex |
| Dependency breaking change | Low | Pin version, defer upgrade |
| Performance regression | High | Fix before merging |
| Security vulnerability | CRITICAL | Stop everything, fix immediately |
| Production bug | CRITICAL | Pause feature, hotfix |
| Requirements change | Varies | Assess impact, present options |

---

*This document covers common edge cases. For scenarios not listed, follow general principles: communicate, document, and escalate when needed.*

---

*Last updated: 2025-11-03*
