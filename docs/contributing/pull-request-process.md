# Pull Request Process

This guide explains how to create, review, and merge pull requests (PRs) at Hospeda. While we currently work on `main` branch, this process will be used as the team grows.

## Table of Contents

- [Overview](#overview)
- [Before Creating a PR](#before-creating-a-pr)
- [Creating a Pull Request](#creating-a-pull-request)
- [PR Title Format](#pr-title-format)
- [PR Description Template](#pr-description-template)
- [PR Size Guidelines](#pr-size-guidelines)
- [CI/CD Checks](#cicd-checks)
- [Responding to Feedback](#responding-to-feedback)
- [Merging](#merging)
- [After Merge](#after-merge)
- [Draft PRs](#draft-prs)

## Overview

**Current Status**: We don't use pull requests yet (all work on `main` branch).

**Future Process**: As the team grows, we'll introduce feature branches and pull requests for:

- Code review before merge
- CI/CD automated checks
- Discussion and collaboration
- Quality assurance
- Knowledge sharing

**When to Create a PR**:

- New features
- Bug fixes
- Refactoring
- Performance improvements
- Breaking changes (always)

**When to Skip PRs** (future):

- Documentation-only changes (optional)
- Typo fixes in comments
- Minor formatting changes
- Emergency hotfixes (with post-merge review)

## Before Creating a PR

**Complete this checklist before opening a PR:**

### 1. Complete All Tasks

- [ ] All features/fixes from issue are implemented
- [ ] All edge cases considered and handled
- [ ] No TODOs left (or documented in separate issues)
- [ ] No debug code (`console.log`, debugger statements)
- [ ] No commented-out code

### 2. Tests

- [ ] All tests passing (`pnpm test`)
- [ ] New tests added for new functionality
- [ ] Edge cases tested
- [ ] Error conditions tested
- [ ] Coverage ≥ 90% for changed files

```bash
# Run tests
pnpm test

# Check coverage
pnpm test:coverage

# Verify specific package
cd packages/db && pnpm test
```

### 3. Quality Checks

- [ ] Type checking passing (`pnpm typecheck`)
- [ ] Linting passing (`pnpm lint`)
- [ ] No type errors
- [ ] No linting warnings

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix
```

### 4. Documentation

- [ ] JSDoc added to all new exports
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Architecture docs updated (if architecture changed)
- [ ] Migration guide written (if breaking changes)

### 5. Code Quality

- [ ] Follows code standards
- [ ] No `any` types
- [ ] Named exports only
- [ ] RO-RO pattern for functions with 3+ params
- [ ] Files under 500 lines
- [ ] Meaningful variable/function names
- [ ] Complex logic has comments explaining WHY

### 6. Atomic Commits

- [ ] Only task-related files committed
- [ ] Conventional commit messages
- [ ] Each commit is logically separate
- [ ] Commit messages are descriptive

### 7. CHANGELOG

- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] Entry in appropriate section (Added/Changed/Fixed/etc.)
- [ ] Breaking changes clearly documented

## Creating a Pull Request

### Step 1: Push Branch to Remote

```bash
# Push your feature branch
git push origin feature/user-authentication

# If branch doesn't exist remotely
git push -u origin feature/user-authentication
```

### Step 2: Open PR on GitHub

1. Go to repository on GitHub
2. Click "Pull requests" tab
3. Click "New pull request"
4. Select base: `main`, compare: `feature/your-branch`
5. Click "Create pull request"

### Step 3: Fill Out PR Template

Use the template provided (see [PR Description Template](#pr-description-template)).

### Step 4: Link to Issue

Use GitHub keywords to auto-close issues:

```markdown
Closes #123
Fixes #456
Resolves #789
```

**Multiple issues**:

```markdown
Closes #123, #124
Fixes #456
```

### Step 5: Request Reviewers

1. Click "Reviewers" on right sidebar
2. Select 1-2 reviewers
3. Request review

**Who to request**:

- Tech lead (for architectural changes)
- Package maintainer (for package-specific changes)
- Domain expert (for complex business logic)

### Step 6: Wait for CI/CD Checks

Monitor automated checks:

- ✅ Tests passing
- ✅ Type checking passing
- ✅ Linting passing
- ✅ Coverage ≥ 90%
- ✅ Build successful

If checks fail, fix issues and push new commits.

### Step 7: Address Feedback

Respond to reviewer comments:

- Answer questions
- Make requested changes
- Discuss alternatives
- Push new commits with fixes

## PR Title Format

**Use conventional commit format:**

```text
<type>(<scope>): <description>
```

### Examples

**Good**:

```text
✅ feat(api): add user authentication endpoints
✅ fix(db): correct timezone handling in bookings
✅ refactor(service): extract price calculation logic
✅ docs(api): update endpoint documentation
✅ test(user): add edge cases for email validation
```

**Bad**:

```text
❌ Add new feature
❌ Fixed bug
❌ Updates
❌ WIP
```

### Title Guidelines

- Max 50 characters
- Imperative mood ("add" not "added")
- Lowercase (except proper nouns)
- No period at end
- Descriptive but concise

## PR Description Template

**Copy and fill out this template:**

```markdown
## Summary

[Brief description of what this PR does]

## Changes

- [Change 1]
- [Change 2]
- [Change 3]

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Test coverage improvement

## Testing

[Describe how you tested these changes]

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Manual testing

**Test Coverage**: [X]% (minimum 90% required)

## Screenshots

[If applicable, add screenshots to demonstrate changes]

## Breaking Changes

[If this introduces breaking changes, describe them and provide migration guide]

**Migration Guide**:

1. [Step 1]
2. [Step 2]

## Related Issues

Closes #[issue number]
Fixes #[issue number]

## Checklist

- [ ] My code follows the code standards
- [ ] I have performed a self-review
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Additional Context

[Any additional information that reviewers should know]
```

### Example: Complete PR Description

```markdown
## Summary

Implements user authentication using Clerk, including login, signup, and JWT validation middleware.

## Changes

- Add Clerk integration to API
- Implement authentication middleware
- Add protected route decorator
- Add user session management
- Update API documentation with authentication examples

## Type of Change

- [x] New feature (non-breaking change which adds functionality)

## Testing

Tested authentication flow end-to-end:

- [x] Unit tests for middleware (95% coverage)
- [x] Integration tests for protected routes
- [x] E2E tests for login/signup flow
- [x] Manual testing in development environment

**Test Coverage**: 94%

## Screenshots

### Login Flow
![Login](./docs/images/login-flow.png)

### Protected Route Response
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

## Breaking Changes

None - this is a new feature that doesn't affect existing functionality.

## Related Issues

Closes #123
Implements authentication requirements from #45

## Checklist

- [x] My code follows the code standards
- [x] I have performed a self-review
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have made corresponding changes to the documentation
- [x] My changes generate no new warnings
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] New and existing unit tests pass locally with my changes
- [x] Any dependent changes have been merged and published

## Additional Context

Used Clerk for authentication as decided in ADR-003. Middleware validates JWT on each request to protected routes.

## PR Size Guidelines

#### Keep PRs small for faster reviews and easier understanding

### Size Categories

**Small (Preferred)**: < 200 lines changed

- ✅ Quick to review (< 30 minutes)
- ✅ Easy to understand
- ✅ Low risk
- ✅ Fast to merge

**Medium (Acceptable)**: 200-500 lines changed

- ⚠️ Takes 30-60 minutes to review
- ⚠️ Moderate complexity
- ⚠️ Moderate risk

**Large (Avoid)**: > 500 lines changed

- ❌ Takes > 1 hour to review
- ❌ High complexity
- ❌ High risk
- ❌ Likely to have issues

### How to Keep PRs Small

**Split large features into smaller PRs:**

#### Example: User Authentication Feature

Instead of one large PR (1000+ lines):

```text
❌ feat(api): implement complete user authentication system
   - Adds Clerk integration
   - Adds middleware
   - Adds protected routes
   - Updates all endpoints
   - Adds documentation
   (1000+ lines, hard to review)
```

Split into multiple PRs:

```text
✅ PR 1: feat(api): add Clerk SDK integration (100 lines)
✅ PR 2: feat(api): add authentication middleware (150 lines)
✅ PR 3: feat(api): protect user endpoints (120 lines)
✅ PR 4: feat(api): protect booking endpoints (130 lines)
✅ PR 5: docs(api): add authentication documentation (80 lines)
```

**Benefits of small PRs**:

- Reviewers can focus on one aspect at a time
- Easier to spot issues
- Faster feedback cycle
- Lower merge conflict risk
- Can merge parts even if others need work

### When Large PRs are Acceptable

**Exceptions** (still try to minimize):

- Database migrations (generated code)
- Dependency updates (package-lock changes)
- Code generation (OpenAPI, GraphQL schemas)
- Moving files (git sees as large change)
- Initial project setup

**Even then, consider**:

- Splitting into logical commits
- Adding detailed description
- Highlighting key changes

## CI/CD Checks

**Automated checks run on every PR:**

### 1. Type Checking

```yaml
✅ pnpm typecheck
```

**Must pass** - No type errors allowed.

**Common failures**:

- `any` type used
- Missing type annotations
- Type mismatches

**Fix**:

```bash
pnpm typecheck
# Fix reported errors
git add fixed-files.ts
git commit -m "fix(types): correct type annotations"
git push
```

### 2. Linting

```yaml
✅ pnpm lint
```

**Must pass** - No linting errors allowed.

**Common failures**:

- Formatting issues
- Unused variables
- Import organization

**Fix**:

```bash
pnpm lint --fix
git add fixed-files.ts
git commit -m "style: apply biome formatting"
git push
```

### 3. Tests

```yaml
✅ pnpm test
```

**Must pass** - All tests must pass.

**Common failures**:

- New code not tested
- Existing tests broken
- Flaky tests

**Fix**:

```bash
# Run locally to debug
pnpm test

# Fix issues
# Add/update tests
git add test-files.test.ts
git commit -m "test: fix failing tests"
git push
```

### 4. Coverage

```yaml
✅ pnpm test:coverage
Coverage: >= 90%
```

**Must pass** - Coverage must be ≥ 90%.

**Common failures**:

- New code not covered
- Edge cases not tested
- Error paths not tested

**Fix**:

```bash
# Check coverage report
pnpm test:coverage

# Add missing tests
# Focus on uncovered lines
git add test-files.test.ts
git commit -m "test: improve coverage to 92%"
git push
```

### 5. Build

```yaml
✅ pnpm build
```

**Must pass** - Code must compile.

**Common failures**:

- Import errors
- TypeScript errors
- Configuration issues

## Responding to Feedback

### Types of Feedback

**MUST**: Required change (blocking)

```markdown
**MUST**: Use `unknown` instead of `any` here.
```

**Action**: Make the change, it's non-negotiable.

**SHOULD**: Strong suggestion (consider carefully)

```markdown
**SHOULD**: Consider extracting this to a helper function for reusability.
```

**Action**: Make the change unless you have good reason not to. If not changing, explain why.

**NITS**: Minor nitpick (optional)

```markdown
**NITS**: This could be renamed to `isUserActive` for clarity.
```

**Action**: Consider making the change, but it's optional.

**QUESTION**: Seeking clarification

```markdown
**QUESTION**: Why did you choose to use Map instead of Object here?
```

**Action**: Answer the question, provide context.

### How to Respond

#### 1. Acknowledge Feedback

```markdown
Thanks for the review! I'll address these points.
```

#### 2. Make Changes

```bash
# Make requested changes
# ... edit files ...

# Commit changes
git add changed-files.ts
git commit -m "refactor: extract helper function per review"

# Push
git push origin feature/my-feature
```

#### 3. Respond to Comments

**If you made the change**:

```markdown
✅ Done! Extracted to `calculateTotalPrice` helper function.
```

**If you disagree**:

```markdown
I kept the `any` here because:
1. This is external API data with unknown shape
2. We validate it immediately with Zod
3. The `unknown` type would require type guards that Zod already provides

However, I'm open to other approaches if you have suggestions.
```

**If you have a question**:

```markdown
Could you clarify what you mean by "extract to helper"?
Do you want a separate file or just a function in the same file?
```

#### 4. Re-request Review

After addressing all feedback:

1. Click "Re-request review" button
2. Or leave comment: "@reviewer ready for another look!"

### Resolving Conversations

**Reviewer's responsibility** to resolve conversations after:

- Change is made satisfactorily
- Discussion is concluded
- Agreement is reached

**Don't** resolve conversations yourself (unless you opened them).

## Merging

### Merge Requirements

**Before merging, verify**:

- [ ] All CI/CD checks passing
- [ ] At least 1 approval from reviewer
- [ ] All conversations resolved
- [ ] No merge conflicts
- [ ] Branch is up to date with base

### Merge Strategy

#### Squash and Merge (Preferred)

```text
All commits in PR → Single commit on main
```

**Benefits**:

- Clean linear history
- One commit per feature/fix
- Easy to revert if needed

#### Merge Commit (For Large Features)

```text
All commits preserved + merge commit
```

**Use when**:

- Want to preserve commit history
- Multiple logical changes in PR
- Collaborators want credit for individual commits

#### Rebase and Merge (Rare)

```text
All commits added to base without merge commit
```

**Use when**:

- Very small PRs (1-2 commits)
- Want linear history without squashing

### Merging Process

#### Option 1: GitHub UI (Recommended)

1. Click "Squash and merge" button
2. Edit commit message if needed
3. Confirm merge
4. Delete branch

#### Option 2: Command Line

```bash
# Update main
git checkout main
git pull origin main

# Merge feature branch (squash)
git merge --squash feature/user-authentication

# Commit
git commit -m "feat(api): add user authentication

Implements complete authentication flow with Clerk.

Closes #123"

# Push
git push origin main

# Delete feature branch
git branch -d feature/user-authentication
git push origin --delete feature/user-authentication
```

### Squash Commit Message

**Format**:

```text
<type>(<scope>): <description>

<detailed description>

Closes #<issue>
```

**Example**:

```text
feat(api): add user authentication

Implements user authentication using Clerk:
- Add Clerk SDK integration
- Add authentication middleware
- Add protected route decorator
- Add user session management

Includes comprehensive tests with 94% coverage.

Closes #123
```

## After Merge

### 1. Verify Deployment

**If auto-deployed**:

- Check deployment status
- Verify feature in staging/production
- Monitor error tracking (Sentry)

### 2. Close Related Issues

**If issue didn't auto-close**:

- Manually close issue
- Add comment with PR link
- Update issue labels

### 3. Update Documentation

**If needed**:

- Update project README
- Update CHANGELOG.md
- Announce in team chat/Discord
- Write blog post (for major features)

### 4. Delete Branch

**Local**:

```bash
git branch -d feature/user-authentication
```

**Remote** (if not auto-deleted):

```bash
git push origin --delete feature/user-authentication
```

### 5. Update Local Main

```bash
git checkout main
git pull origin main
```

### 6. Celebrate! 🎉

You've successfully contributed to Hospeda!

## Draft PRs

### Use draft PRs for work in progress

#### When to Use Draft PRs

- Want early feedback on approach
- Exploring implementation options
- Large feature being developed over time
- Want to show progress
- Need help/suggestions

### Creating Draft PR

**GitHub UI**:

1. Create PR normally
2. Click dropdown on "Create pull request"
3. Select "Create draft pull request"

**Or mark existing PR as draft**:

1. Open PR
2. Click "Still in progress? Convert to draft" link

### Draft PR Guidelines

**What to include**:

- [ ] Clear "WIP" or "Draft" in title
- [ ] Explanation of what's being worked on
- [ ] List of completed items
- [ ] List of TODO items
- [ ] Specific questions for reviewers

**Example**:

```markdown
## Draft: User Authentication Implementation

**Status**: 60% complete

**Completed**:
- [x] Clerk SDK integration
- [x] Authentication middleware
- [x] Basic tests

**TODO**:
- [ ] Protect all endpoints
- [ ] Add E2E tests
- [ ] Update documentation
- [ ] Performance testing

**Questions for Reviewers**:
1. Is the middleware approach correct?
2. Should we cache JWT validation results?
3. Any concerns about the error handling?
```

### Converting to Ready for Review

**When ready**:

1. Complete all TODOs
2. Ensure all checks passing
3. Click "Ready for review" button
4. Request reviewers

---

## Summary Checklist

Before opening PR:

- [ ] All tasks completed
- [ ] All tests passing (coverage ≥ 90%)
- [ ] Quality checks passing (typecheck, lint)
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Atomic commits with conventional messages
- [ ] PR description filled out
- [ ] Linked to issues
- [ ] Requested reviewers

Before merging:

- [ ] All CI/CD checks passing
- [ ] At least 1 approval
- [ ] All conversations resolved
- [ ] No merge conflicts
- [ ] Branch up to date with base

After merging:

- [ ] Verified deployment
- [ ] Closed related issues
- [ ] Deleted branch
- [ ] Updated local main

---

## Further Reading

- [Code Standards](./code-standards.md)
- [Git Workflow](./git-workflow.md)
- [Code Review Guidelines](./code-review-guidelines.md)
- [GitHub Pull Request Documentation](https://docs.github.com/en/pull-requests)

---

###### Last Updated: 2025-01-15
