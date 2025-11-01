# Pull Request

## Summary

<!-- Brief description of what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Dependency update
- [ ] Hotfix (critical production bug)

## Changes

<!-- List the main changes introduced in this PR -->

-
-
-

## Testing

- [ ] Unit tests added/updated (90%+ coverage requirement)
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests pass locally (`pnpm test`)

## Quality Checks

- [ ] TypeScript compilation passes (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Code formatted (`pnpm format`)
- [ ] Markdown formatted (`pnpm format:md`)
- [ ] Build succeeds (`pnpm build`)

## Code Quality

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] JSDoc added for all exports
- [ ] No `any` types used (use `unknown` with type guards)
- [ ] Named exports only (no default exports)
- [ ] No console.log or debugging code left
- [ ] Committed only task-related files (no `git add .`)

## Documentation

- [ ] Documentation updated (if needed)
- [ ] CHANGELOG.md updated (if user-facing changes)
- [ ] README updated (if setup changes)
- [ ] API documentation updated (if API changes)

## Workflow Compliance

- [ ] Followed appropriate workflow level:
  - [ ] Level 1: Quick Fix Protocol (< 30min, 1-2 files)
  - [ ] Level 2: Atomic Task Protocol (30min-3h, 2-10 files)
  - [ ] Level 3: Feature Planning (multi-day, 10+ files)
- [ ] Task tracking completed (TODOs, Linear sync)
- [ ] Atomic commits (one logical change per commit)

## Architecture & Patterns

- [ ] Uses factory patterns for routes (if API changes)
- [ ] Extends base classes (`BaseModel`, `BaseCrudService`) (if DB/service changes)
- [ ] Follows RO-RO pattern (Receive Object / Return Object)
- [ ] Uses barrel files (`index.ts`) for exports
- [ ] Types inferred from Zod schemas (no separate type files)
- [ ] Validation schemas from `@repo/schemas`

## Screenshots

<!-- Add screenshots for UI changes -->
<!-- Delete section if not applicable -->

## Related Issues

<!-- Link related issues using keywords: Closes, Fixes, Resolves -->

Closes #
Fixes #
Resolves #

## Dependencies

<!-- List any new dependencies added -->

## Breaking Changes

<!-- Describe any breaking changes and migration path -->
<!-- Delete section if not applicable -->

## Deployment Notes

<!-- Special deployment steps or environment variable changes -->
<!-- Delete section if not applicable -->

## Additional Context

<!-- Any other relevant information -->

---

## For Reviewers

<!-- Help reviewers by highlighting areas that need special attention -->

**Focus Areas:**

-
-

**Questions:**

-
-

## Checklist for Reviewers

- [ ] Code quality and style
- [ ] Test coverage adequate
- [ ] Documentation complete
- [ ] No security vulnerabilities
- [ ] Performance considerations
- [ ] Accessibility (if UI changes)
- [ ] Mobile responsiveness (if UI changes)
