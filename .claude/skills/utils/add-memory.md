---
name: add-memory
category: utils
description: Auto-learning skill that captures architectural decisions, patterns, and best practices for future reference
usage: Use to document learnings, capture decisions, record patterns, or create knowledge base entries after completing tasks
input: Learning topic, decision rationale, pattern description, best practice
output: Memory file in .claude/memory/ with structured documentation
---

# Add Memory

## Overview

**Purpose**: Capture and document learnings, architectural decisions, patterns, and best practices for future reference and knowledge continuity

**Category**: Utils
**Primary Users**: All agents (auto-invoked when capturing knowledge)

## When to Use This Skill

- After making architectural decisions
- When discovering new patterns or anti-patterns
- After solving complex problems
- When establishing new conventions
- After completing significant features
- When encountering errors and solutions
- After performance optimizations
- When documenting gotchas or edge cases

## Prerequisites

**Required:**
- Clear understanding of what to document
- Context of the decision/learning
- Rationale for the approach taken

**Optional:**
- Code examples
- Related documentation
- Alternative approaches considered

## Input

**What the skill needs:**
- **Topic**: What is being documented
- **Category**: Type of memory (decision, pattern, gotcha, etc.)
- **Context**: When/why this is relevant
- **Content**: The actual learning or decision
- **Examples**: Code or configuration examples
- **Rationale**: Why this approach was chosen
- **Alternatives**: Other options considered

## Workflow

### Step 1: Identify Memory Type

**Objective**: Categorize the memory for proper organization

**Memory Categories:**

1. **Architectural Decisions** (`arch/`)
   - System design choices
   - Technology selections
   - Integration patterns
   - Infrastructure decisions

2. **Coding Patterns** (`patterns/`)
   - Reusable code patterns
   - Anti-patterns to avoid
   - Best practices
   - Code organization

3. **Configuration** (`config/`)
   - Environment setup
   - Tool configuration
   - Build system settings
   - Deployment configuration

4. **Gotchas** (`gotchas/`)
   - Common errors and solutions
   - Edge cases
   - Platform-specific issues
   - Debugging tips

5. **Performance** (`performance/`)
   - Optimization techniques
   - Bottleneck solutions
   - Caching strategies
   - Query optimizations

6. **Security** (`security/`)
   - Security patterns
   - Vulnerability fixes
   - Authentication/authorization
   - Data protection

7. **Testing** (`testing/`)
   - Testing strategies
   - Test patterns
   - Coverage techniques
   - Mocking approaches

**Validation:**
- [ ] Category appropriate for content
- [ ] Similar memories don't already exist
- [ ] Content adds value
- [ ] Will be useful for future reference

**Output**: Selected category

### Step 2: Structure Memory Content

**Objective**: Create well-structured, searchable memory

**Memory Template:**

```markdown
---
topic: [Brief topic name]
category: [arch|patterns|config|gotchas|performance|security|testing]
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
related: [file1.md, file2.md]
---

# [Topic Title]

## Context

When this is relevant and why it matters.

## Decision/Learning

What was decided or learned.

## Rationale

Why this approach was chosen.

## Alternatives Considered

- **Option 1**: Description, pros/cons
- **Option 2**: Description, pros/cons
- **Option 3**: Description, pros/cons

## Implementation

How to implement this decision/pattern.

### Example

\`\`\`typescript
// Code example demonstrating the pattern
\`\`\`

## Implications

- Impact on other parts of the system
- Future considerations
- Trade-offs accepted

## References

- Related documentation
- External resources
- Related decisions
```

**Validation:**
- [ ] All sections filled appropriately
- [ ] Examples provided where helpful
- [ ] Rationale clearly explained
- [ ] Tags relevant for searching

**Output**: Structured memory content

### Step 3: Create Memory File

**Objective**: Save memory in appropriate location

**File Naming Convention:**
```
.claude/memory/
├── arch/
│   └── YYYY-MM-DD-decision-name.md
├── patterns/
│   └── YYYY-MM-DD-pattern-name.md
├── config/
│   └── YYYY-MM-DD-config-name.md
├── gotchas/
│   └── YYYY-MM-DD-gotcha-description.md
├── performance/
│   └── YYYY-MM-DD-optimization-name.md
├── security/
│   └── YYYY-MM-DD-security-topic.md
└── testing/
    └── YYYY-MM-DD-testing-approach.md
```

**Example - Architectural Decision:**
```markdown
---
topic: Monorepo Structure with TurboRepo
category: arch
date: 2024-01-15
tags: [monorepo, turborepo, architecture, build-system]
related: [package-organization.md, build-optimization.md]
---

# Monorepo Structure with TurboRepo

## Context

Needed to organize multiple related applications (web, admin, api) and shared packages (db, schemas, services) in a way that promotes code reuse while maintaining clear boundaries.

## Decision

Adopt TurboRepo monorepo structure with:
- Apps in `apps/` directory (web, admin, api)
- Shared code in `packages/` directory
- Internal packages using `@repo/*` namespace
- Centralized TypeScript configuration
- Shared tooling configuration

## Rationale

**Why TurboRepo:**
- Superior caching for faster builds
- Parallel task execution
- Simple configuration
- Great DX with incremental builds
- Wide adoption and active maintenance

**Why monorepo over multirepo:**
- Easier to share code between apps
- Atomic commits across related changes
- Single version of dependencies
- Simplified CI/CD pipeline
- Better refactoring experience

## Alternatives Considered

- **Nx Monorepo**: More features but steeper learning curve, overkill for our needs
- **Lerna**: Older tool, less active development
- **Separate repos**: Would require complex versioning and publishing

## Implementation

### Directory Structure

\`\`\`
hospeda/
├── apps/
│   ├── api/          # Hono backend
│   ├── web/          # Astro frontend
│   └── admin/        # TanStack Start admin
├── packages/
│   ├── db/           # Drizzle models
│   ├── schemas/      # Zod validation
│   ├── service-core/ # Business logic
│   └── utils/        # Shared utilities
└── turbo.json        # Build pipeline
\`\`\`

### Package References

\`\`\`json
{
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/schemas": "workspace:*",
    "@repo/service-core": "workspace:*"
  }
}
\`\`\`

### Build Pipeline

\`\`\`json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
\`\`\`

## Implications

- **Build Performance**: 3x faster with caching
- **Code Sharing**: Seamless sharing between apps
- **Type Safety**: End-to-end type safety maintained
- **Deployment**: Each app can be deployed independently
- **Learning Curve**: Team needs to understand workspace protocol

## References

- [TurboRepo Documentation](https://turbo.build/repo/docs)
- [Monorepo Best Practices](https://monorepo.tools)
- CLAUDE.md section on Monorepo Structure
```

**Example - Pattern:**
```markdown
---
topic: RO-RO Pattern (Receive Object, Return Object)
category: patterns
date: 2024-01-20
tags: [pattern, function-design, maintainability]
related: [service-layer-patterns.md, api-design.md]
---

# RO-RO Pattern (Receive Object, Return Object)

## Context

Functions with multiple parameters become hard to maintain and refactor. Adding new parameters breaks existing calls.

## Learning

Always use object parameters and return objects instead of primitives or tuples.

## Rationale

**Benefits:**
- Easy to add new parameters without breaking changes
- Named parameters improve readability
- Optional parameters natural with destructuring defaults
- Return values can be extended without breaking consumers
- Better TypeScript autocomplete
- Easier to mock in tests

## Implementation

### Bad - Multiple Parameters

\`\`\`typescript
// Hard to maintain, hard to extend
function createBooking(
  userId: string,
  accommodationId: string,
  checkIn: Date,
  checkOut: Date,
  guests: number,
  notes?: string
) {
  // ...
  return bookingId; // Can't easily return more data
}

// Confusing call
createBooking(
  'user-1',
  'acc-1',
  new Date(),
  new Date(),
  2,
  'Special request'
);
\`\`\`

### Good - RO-RO Pattern

\`\`\`typescript
// Easy to maintain and extend
interface CreateBookingInput {
  userId: string;
  accommodationId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  notes?: string;
  // Easy to add new fields
}

interface CreateBookingOutput {
  booking: Booking;
  // Easy to add more return data
}

function createBooking(input: CreateBookingInput): CreateBookingOutput {
  const { userId, accommodationId, checkIn, checkOut, guests, notes } = input;
  // ...
  return { booking };
}

// Clear, readable call
createBooking({
  userId: 'user-1',
  accommodationId: 'acc-1',
  checkIn: new Date(),
  checkOut: new Date(),
  guests: 2,
  notes: 'Special request'
});
\`\`\`

## Implications

- **Breaking Changes**: Minimized when adding features
- **Readability**: Improved with named parameters
- **Refactoring**: Easier to modify function signatures
- **Testing**: Easier to create test fixtures
- **Documentation**: Self-documenting with TypeScript

## Exceptions

Simple utility functions with 1-2 primitive parameters:

\`\`\`typescript
// OK for simple cases
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
\`\`\`

## References

- [RO-RO Pattern Article](https://www.freecodecamp.org/news/elegant-patterns-in-modern-javascript-roro-be01e7669cbd/)
- CLAUDE.md Code Standards section
```

**Example - Gotcha:**
```markdown
---
topic: Fish Shell For Loop Limitation
category: gotchas
date: 2024-02-01
tags: [fish-shell, bash, terminal, loops]
related: [shell-scripts.md]
---

# Fish Shell For Loop Limitation

## Context

When running terminal commands that involve for loops or certain bash syntax.

## Issue

Fish shell uses different syntax than bash and hangs on bash-style for loops.

**Error symptoms:**
- Command hangs indefinitely
- No error message
- Have to Ctrl+C to cancel

## Solution

**DON'T use bash for loops in terminal:**
\`\`\`bash
# This hangs in Fish
for file in *.md; do echo $file; done
\`\`\`

**DO use alternatives:**

1. **Find with -exec:**
\`\`\`bash
find . -name "*.md" -exec echo {} \;
\`\`\`

2. **Fish syntax (if in Fish shell):**
\`\`\`fish
for file in *.md; echo $file; end
\`\`\`

3. **Bash script file:**
\`\`\`bash
# In script.sh
for file in *.md; do
  echo "$file"
done

# Then run
bash script.sh
\`\`\`

## Prevention

- Use `find -exec` for file operations
- Create bash scripts for complex loops
- Check shell type before suggesting commands
- Use Fish-compatible alternatives

## References

- CLAUDE.md Recent Learnings section
- Fish Shell documentation
```

**Validation:**
- [ ] File created in correct directory
- [ ] Filename follows convention
- [ ] Content properly formatted
- [ ] Examples clear and helpful

**Output**: Memory file saved

### Step 4: Update Memory Index

**Objective**: Make memory searchable and discoverable

**Create/Update Index File:**

`.claude/memory/INDEX.md`:

```markdown
# Memory Index

Last updated: 2024-02-01

## Quick Links

- [Architectural Decisions](#architectural-decisions)
- [Patterns](#patterns)
- [Configuration](#configuration)
- [Gotchas](#gotchas)
- [Performance](#performance)
- [Security](#security)
- [Testing](#testing)

## Architectural Decisions

| Date | Topic | Tags |
|------|-------|------|
| 2024-01-15 | [Monorepo Structure](arch/2024-01-15-monorepo-structure.md) | monorepo, turborepo, architecture |
| 2024-01-18 | [Database Selection](arch/2024-01-18-database-selection.md) | postgresql, drizzle, database |

## Patterns

| Date | Topic | Tags |
|------|-------|------|
| 2024-01-20 | [RO-RO Pattern](patterns/2024-01-20-ro-ro-pattern.md) | pattern, function-design |
| 2024-01-22 | [Base CRUD Service](patterns/2024-01-22-base-crud-service.md) | pattern, service-layer |

## Gotchas

| Date | Topic | Tags |
|------|-------|------|
| 2024-02-01 | [Fish Shell For Loops](gotchas/2024-02-01-fish-shell-loops.md) | fish-shell, bash, terminal |
```

**Validation:**
- [ ] Index updated with new entry
- [ ] Link works correctly
- [ ] Date accurate
- [ ] Tags helpful for searching

**Output**: Updated memory index

### Step 5: Link to Related Memories

**Objective**: Create knowledge graph connections

**Actions:**
1. Identify related memories
2. Add cross-references in related files
3. Update new memory with relations
4. Create bidirectional links

**Example Linking:**

In new memory:
```markdown
## Related Memories

- [Base CRUD Service Pattern](../patterns/2024-01-22-base-crud-service.md)
- [Service Layer Testing](../testing/2024-01-25-service-testing.md)
```

In related memory, add:
```markdown
## See Also

- [RO-RO Pattern](../patterns/2024-01-20-ro-ro-pattern.md) - Related function design pattern
```

**Validation:**
- [ ] Bidirectional links created
- [ ] Links verified working
- [ ] Relationships meaningful
- [ ] Not over-linking

**Output**: Connected memory graph

## Output

**Produces:**
- Memory file in appropriate category directory
- Updated memory index
- Cross-references to related memories
- Searchable, structured knowledge

**Success Criteria:**
- Memory captures key information
- Examples clear and helpful
- Rationale well explained
- Easily discoverable
- Properly categorized and tagged

## Memory Maintenance

### Regular Reviews

- Monthly: Review and update stale memories
- Quarterly: Consolidate similar memories
- Yearly: Archive outdated memories

### Quality Checks

- [ ] Still relevant to current architecture
- [ ] Examples up to date
- [ ] Links still valid
- [ ] Tags accurate

## Best Practices

1. **Be Specific**: Capture concrete decisions, not vague thoughts
2. **Include Context**: Explain when and why this matters
3. **Provide Examples**: Code examples are invaluable
4. **Explain Rationale**: Why was this chosen over alternatives
5. **Link Related**: Create knowledge graph connections
6. **Use Tags**: Make memories searchable
7. **Update Index**: Keep index current
8. **Review Regularly**: Update or archive outdated memories
9. **Clear Titles**: Descriptive, searchable titles
10. **Date Everything**: Track when decisions were made

## Related Skills

- tech-writer - Documentation creation
- architecture-validator - Architecture review
- changelog-specialist - Change documentation

## Notes

- Memory files are in git (part of documentation)
- Use markdown for consistency
- Keep examples concise but complete
- Index is the entry point for discovery
- Cross-link related memories
- Archive, don't delete (keep history)
- Memories inform future decisions
- Auto-learning happens during task completion
