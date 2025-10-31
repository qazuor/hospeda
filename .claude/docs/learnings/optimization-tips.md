# Optimization Tips

**Date:** 2024-10-28

**Category:** Performance / Best Practices

## Problem

Inefficient development practices lead to:
- Wasted time searching for documentation
- Redundant work analyzing dependencies
- Slow development cycles
- Lost context between sessions

## Solution

**Development Optimization Strategies:**

### 1. Use Context7 for Library Docs

Saves tokens and gets up-to-date documentation:

```typescript
// Instead of searching Google, use MCP tools:
mcp__context7__resolve-library-id("hono")
mcp__context7__get-library-docs("/honojs/hono")
```

**Benefits:**
- Always current documentation
- Saves Claude context tokens
- Faster than web search
- Integrated into workflow

**Works for:** Hono, Drizzle, React, TanStack, Zod, Vitest, Astro, etc.

### 2. Use Dependency Mapper

Track dependencies automatically instead of manual analysis:

```bash
# Analyze dependencies
pnpm run dependency-map

# Generate dependency graph
# Shows: version conflicts, security issues, outdated packages
```

**Benefits:**
- Automatic security scanning
- Version conflict detection
- Dependency tree visualization
- Update recommendations

### 3. Batch Related Changes

Group related changes in single commits:

```bash
# ✅ GOOD - Logical grouping
git commit -m "feat(db): add booking model, schema, and tests"
# Files: booking.schema.ts, booking.model.ts, booking.model.test.ts

# ❌ BAD - Separate commits for related changes
git commit -m "add booking schema"
git commit -m "add booking model"
git commit -m "add booking tests"
```

**Benefits:**
- Clearer git history
- Easier code review
- Atomic changes
- Simpler rollbacks

### 4. Group Tests by Feature

Organize tests by feature instead of by type:

```
test/
├── booking/              # Feature-based
│   ├── create.test.ts
│   ├── update.test.ts
│   └── validation.test.ts
└── user/                 # Feature-based
    ├── auth.test.ts
    └── profile.test.ts

# Instead of type-based:
test/
├── unit/
├── integration/
└── e2e/
```

**Benefits:**
- Easier to find related tests
- Better feature coverage visibility
- Simpler test maintenance
- Clear test organization

### 5. Use MCP Servers Effectively

Leverage integrated MCP servers:

- **Context7**: Library documentation
- **Neon**: Database operations
- **GitHub**: Issue tracking, PRs
- **Vercel**: Deployment management
- **Linear**: Project management

**Example workflow:**
```bash
# Check database schema
mcp__neon__describe_branch

# Create GitHub issue
mcp__github__create_issue

# Deploy to Vercel
mcp__vercel__deploy
```

## Impact

- **Severity:** Medium - Improves efficiency, not critical
- **Frequency:** Daily development
- **Scope:** All developers
- **Prevention:** Integrate optimization practices into daily workflow

## Related

- **MCP Servers:** [.claude/docs/mcp-servers.md](../mcp-servers.md)
- **Development Workflow:** [CLAUDE.md](../../../CLAUDE.md#development-workflow)
- **Related Learnings:** None yet

---

*Last updated: 2024-10-28*
