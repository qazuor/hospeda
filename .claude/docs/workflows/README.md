# Workflow System Documentation

Complete workflow system for the Hospeda project, from quick fixes to complex feature planning.

---

## Overview

The Hospeda workflow system provides **3 levels of workflows** to handle tasks of varying complexity:

- **Level 1: Quick Fix** - Trivial changes (< 30min, 1-2 files)
- **Level 2: Atomic Task** - Bugfixes and small features (30min-3h, 2-10 files)
- **Level 3: Feature Planning** - Complex features (Multi-day, architecture changes)

---

## Quick Start

### 1. Choose Your Workflow Level

**Start here:** [decision-tree.md](decision-tree.md)

Use the decision tree to determine which workflow level fits your task:

```mermaid
# See decision-tree.md for interactive diagram
```

**Visual guide:** [../diagrams/workflow-decision-tree.mmd](../diagrams/workflow-decision-tree.mmd)

### 2. Follow the Appropriate Protocol

**Level 1?** → [quick-fix-protocol.md](quick-fix-protocol.md)  
**Level 2?** → [atomic-task-protocol.md](atomic-task-protocol.md)  
**Level 3?** → Phase guides (see below)

---

## Level 1: Quick Fix Protocol

**File:** [quick-fix-protocol.md](quick-fix-protocol.md)

### When to Use

- Estimated time: **< 30 minutes**
- Files affected: **1-2 files**
- Risk level: **Very low**
- No architecture changes
- No database changes

### Examples

- Fix typo in code comment
- Format markdown file
- Update environment variable
- Organize imports
- Fix linting error

### 6-Step Workflow

1. ✓ Verify Quick Fix Criteria
2. 🔧 Make the Change
3. ✅ Quick Validation (typecheck, lint)
4. 📝 Commit with Conventional Message
5. 🚀 Push or Create PR
6. ✓ Done

**Estimated time:** 5-30 minutes

---

## Level 2: Atomic Task Protocol

**File:** [atomic-task-protocol.md](atomic-task-protocol.md)

### When to Use

- Estimated time: **30 minutes to 3 hours**
- Files affected: **2-10 files**
- Risk level: **Low to medium**
- Bugfixes or small features
- No major architecture changes

### Examples

- Fix booking validation bug
- Add new API endpoint
- Implement form validation
- Update database query
- Add new UI component

### 11-Step TDD Workflow

1. 📁 Create Atomic Task Session (PB-XXX)
2. 📋 Create Simplified Tech Analysis
3. 👀 Review & Approve Plan
4. 🔴 Write Tests First (TDD RED)
5. 🟢 Implement Solution (GREEN)
6. ♻️ Refactor (keep tests green)
7. 📚 Add Documentation
8. 📊 Test Coverage Check (>= 90%)
9. ✅ Quality Checks
10. 📝 Commit with Conventional Message
11. 🗂️ Update Registry & Close Task

**Includes:**

- **PB-XXX code system** - Atomic task tracking
- **Task registry** - REGISTRY.md in atomic-tasks/
- **Tech analysis template** - Simplified planning
- **3 detailed examples** - Real-world scenarios

**Estimated time:** 0.5-3 hours

---

## Level 3: Feature Planning

### When to Use

- Estimated time: **Multi-day** (1-40 hours)
- Complexity: **High**
- Architecture changes required
- Database schema changes
- Multiple team members involved
- High risk or complexity

### Examples

- Implement booking system
- Add payment processing
- Build admin dashboard
- Create user authentication
- Redesign database schema

### 4-Phase Workflow

Each phase has a dedicated guide with detailed steps:

#### Phase 1: Planning

**File:** [phase-1-planning.md](phase-1-planning.md)

**Goal:** Create comprehensive, atomic plan

**Key outputs:**

- PDR.md (Product Design Requirements)
- tech-analysis.md (Technical Analysis)
- TODOs.md (Atomic task breakdown)

**Process:**

1. Initialize planning session
2. Invoke product-functional → Create PDR
3. Invoke product-technical → Create tech-analysis
4. Break down into atomic tasks (0.5-4h each)
5. Get user approval

**Estimated time:** 2-8 hours

#### Phase 2: Implementation

**File:** [phase-2-implementation.md](phase-2-implementation.md)

**Goal:** Implement feature following TDD

**Process:**

1. Review PDR and tech-analysis
2. For each task:
   - 🔴 RED: Write failing test
   - 🟢 GREEN: Implement minimum code
   - ♻️ REFACTOR: Improve while tests green
3. Continuous validation
4. Update TODOs.md progress

**Key principles:**

- Files max 500 lines
- Comprehensive JSDoc
- Follow existing patterns exactly
- Strict code style consistency

**Estimated time:** Varies by feature (4-30 hours)

#### Phase 3: Validation

**File:** [phase-3-validation.md](phase-3-validation.md)

**Goal:** Ensure quality standards

**Process:**

1. Invoke qa-engineer with qa-criteria-validator
2. Validate against acceptance criteria
3. Run /quality-check:
   - Lint (stop on error)
   - TypeCheck (stop on error)
   - Tests (stop on error)
   - Code Review
   - Security Review
   - Performance Review
4. Invoke tech-lead for global review
5. Get user approval

**Estimated time:** 1-4 hours

#### Phase 4: Finalization

**File:** [phase-4-finalization.md](phase-4-finalization.md)

**Goal:** Document and prepare commits

**Process:**

1. Invoke tech-writer → Update /docs
2. Run /commit → Generate conventional commits
3. Present commits to user
4. Final checklist verification

**Estimated time:** 0.5-2 hours

---

## Supporting Documentation

### Task Atomization

**File:** [task-atomization.md](task-atomization.md)

**Purpose:** Guidelines for breaking down complex features into atomic tasks

**Key concepts:**

- **0.5-4 hour rule** - Ideal task size
- **Dependency mapping** - Task relationships
- **Granularity guidelines** - When to split/merge

**Use when:** Planning Phase 1 or complex Level 2 tasks

### Task Completion Protocol

**File:** [task-completion-protocol.md](task-completion-protocol.md)

**Purpose:** Standardized process for completing and tracking tasks

**Covers:**

- Commit requirements
- GitHub issue synchronization
- Registry updates
- Planning session updates

**Use when:** Completing any tracked task (Level 2 or 3)

---

## Workflow Selection Decision Factors

| Factor | Level 1 | Level 2 | Level 3 |
|--------|---------|---------|---------|
| **Time** | < 30min | 30min - 3h | Multi-day |
| **Files** | 1-2 | 2-10 | 10+ |
| **Risk** | Very low | Low-Medium | Medium-High |
| **Planning** | None | Simplified | Comprehensive |
| **Documentation** | Commit msg | Tech analysis | PDR + Tech analysis |
| **Tests** | Optional | Required (TDD) | Required (TDD) |
| **Review** | Quick check | Quality checks | Full validation |
| **Examples** | Typos, format | Bugfix, endpoint | Feature, system |

---

## Workflow Comparison

### Level 1: Quick Fix

✅ **Pros:**

- Very fast (5-30 minutes)
- Minimal overhead
- Immediate impact
- No planning required

⚠️ **Cons:**

- Only for trivial changes
- No formal validation
- Limited scope

🎯 **Best for:** Typos, formatting, config tweaks, minor fixes

### Level 2: Atomic Task

✅ **Pros:**

- Structured but lightweight
- Full TDD coverage
- Quality validation
- Tracked in registry

⚠️ **Cons:**

- Requires planning (15-30 min)
- Must stay within scope
- Not for complex features

🎯 **Best for:** Bugfixes, small features, most daily work

### Level 3: Feature Planning

✅ **Pros:**

- Comprehensive planning
- Cross-team coordination
- Full documentation
- Validated at every phase

⚠️ **Cons:**

- Significant planning overhead
- Multi-day commitment
- Requires stakeholder alignment

🎯 **Best for:** Major features, architecture changes, complex systems

---

## Common Scenarios

### "I found a typo in a comment"

→ **Level 1: Quick Fix**  
📄 [quick-fix-protocol.md](quick-fix-protocol.md)

### "Authentication endpoint returns 500 on invalid input"

→ **Level 2: Atomic Task**  
📄 [atomic-task-protocol.md](atomic-task-protocol.md)

### "We need to add payment processing with Mercado Pago"

→ **Level 3: Feature Planning**  
📄 Start with [phase-1-planning.md](phase-1-planning.md)

### "Need to refactor service layer to use new pattern"

→ **Level 3: Feature Planning** (if complex) or **Level 2** (if simple)  
📄 Use [decision-tree.md](decision-tree.md) to decide

### "User reported form validation not working"

→ **Level 2: Atomic Task**  
📄 [atomic-task-protocol.md](atomic-task-protocol.md)

---

## Visual Guides

### Diagrams

All workflow diagrams are available in [../diagrams/](../diagrams/):

1. **[workflow-decision-tree.mmd](../diagrams/workflow-decision-tree.mmd)** - Which workflow to use?
2. **[agent-hierarchy.mmd](../diagrams/agent-hierarchy.mmd)** - Who does what?
3. **[tools-relationship.mmd](../diagrams/tools-relationship.mmd)** - How do tools interact?
4. **[documentation-map.mmd](../diagrams/documentation-map.mmd)** - Where is everything?

### How to View

- **GitHub:** Click on `.mmd` file (auto-rendered)
- **VSCode:** Install "Mermaid Preview" extension
- **Interactive:** Copy to [mermaid.live](https://mermaid.live)

---

## Best Practices

### For All Workflows

1. ✅ **Always start with decision tree** - Choose the right level
2. 📋 **Follow the protocol exactly** - Don't skip steps
3. ✅ **Quality first** - Run validations early and often
4. 📝 **Document as you go** - Don't leave it for the end
5. 🔍 **Review before committing** - Double-check everything

### For Level 1

- ⚡ Keep it simple - If it gets complex, upgrade to Level 2
- ⏱️ Set a timer - If > 30min, stop and reassess
- ✅ Quick validation - At minimum: typecheck + lint

### For Level 2

- 🔴 **TDD is mandatory** - Red → Green → Refactor
- 📊 **90% coverage minimum** - No exceptions
- 🗂️ **Update registry** - Keep REGISTRY.md current
- ⚖️ **Stay atomic** - If task grows, split it

### For Level 3

- 📋 **Plan thoroughly** - Saves time in implementation
- 👥 **Get stakeholder buy-in** - Before implementation
- 🔄 **Regular checkpoints** - Update .checkpoint.json
- 🔗 **Sync with GitHub** - Keep issues updated

---

## Tools & Commands

### Quality Checks

```bash
# Quick validation (Level 1)
pnpm typecheck
pnpm lint

# Full quality check (Level 2, 3)
/quality-check

# Individual checks
/code-check
/run-tests
```

### Commits

```bash
# Generate conventional commits
/commit

# Never stage files yourself - let /commit handle it
```

### Planning

```bash
# Start feature planning
/start-feature-plan

# Sync to GitHub
pnpm planning:sync <session-path>
```

---

## FAQ

### Q: How do I know if I should use Level 2 or Level 3?

**A:** Ask yourself:

- Will this take > 3 hours? → Level 3
- Does this change architecture? → Level 3
- Does this affect database schema? → Level 3
- Does this require stakeholder approval? → Level 3
- Otherwise → Level 2

### Q: Can I skip TDD for simple changes?

**A:** No. TDD is required for Level 2 and Level 3. For truly trivial changes, use Level 1 instead.

### Q: What if my Level 2 task is taking longer than expected?

**A:**

1. Stop implementation
2. Assess remaining work
3. If > 1h remaining, split into new PB-XXX tasks
4. Complete what you can in current task
5. Create new tasks for remainder

### Q: Do I need to create a PDR for every feature?

**A:** Only for Level 3 (Feature Planning). Level 2 uses simplified tech-analysis.md instead.

### Q: Can I use multiple workflow levels in one PR?

**A:** Yes, but group logically:

- Multiple Level 1 fixes → One commit
- Level 2 task → One commit
- Level 3 feature → Multiple commits (one per phase/task)

---

## Related Documentation

- **[../INDEX.md](../INDEX.md)** - Master documentation index
- **[../standards/code-standards.md](../standards/code-standards.md)** - Code quality guidelines
- **[../standards/architecture-patterns.md](../standards/architecture-patterns.md)** - Design patterns
- **[../standards/testing-standards.md](../standards/testing-standards.md)** - Testing requirements
- **[../diagrams/README.md](../diagrams/README.md)** - Visual guide to diagrams

---

## Changelog

### 2025-10-31

- ✨ Added Quick Fix Protocol (Level 1)
- ✨ Added Atomic Task Protocol (Level 2)
- ✨ Created workflow decision tree diagram
- 📝 Reorganized workflow documentation
- 🔄 Updated decision criteria
- 📊 Added comparison tables

### 2025-10-28

- 📝 Created initial workflow documentation
- ✨ Added 4-phase guides (Planning, Implementation, Validation, Finalization)
- ✨ Added task atomization guide
- ✨ Added task completion protocol

---

*Last updated: 2025-10-31*
