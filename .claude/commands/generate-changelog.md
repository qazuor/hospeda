---
name: generate-changelog
description: Generates changelog from git history following Keep a Changelog format, grouped by type (Added, Changed, Fixed, etc.)
---

# Generate Changelog Command

## Purpose

Generates a well-structured changelog from git commit history following the [Keep a Changelog](https://keepachangelog.com/) format. Parses conventional commits to automatically categorize changes into groups (Added, Changed, Deprecated, Removed, Fixed, Security). Supports version tagging, date ranges, and multiple output formats.

This command helps maintain accurate, human-readable changelogs that communicate changes clearly to users and team members.

## When to Use

- **Release Preparation**: Generate changelog for a new version release
- **Sprint Summary**: Summarize changes made during a development sprint
- **PR Description**: Generate summary of changes for pull request descriptions
- **Documentation Updates**: Keep changelog documentation current
- **Audit Trail**: Maintain record of all changes for compliance

## Usage

```bash
/generate-changelog [options]
```

### Options

- `--from <ref>`: Starting git reference (tag, commit, branch). Default: last tag
- `--to <ref>`: Ending git reference. Default: HEAD
- `--version <version>`: Version label for the new changelog entry (e.g., 1.2.0)
- `--format <type>`: Output format (keepachangelog, conventional, simple)
- `--output <path>`: Output file path. Default: CHANGELOG.md (append/update)
- `--stdout`: Print to stdout instead of writing to file
- `--include-breaking`: Highlight breaking changes separately
- `--include-authors`: Include commit authors in entries
- `--group-by <method>`: Grouping method (type, scope, author)

### Examples

```bash
/generate-changelog                               # Auto-detect range, update CHANGELOG.md
/generate-changelog --version 2.1.0               # Generate for specific version
/generate-changelog --from v1.0.0 --to v2.0.0     # Specific range
/generate-changelog --stdout --format simple       # Print simple format to terminal
/generate-changelog --include-breaking --include-authors
/generate-changelog --from main --to feature/auth  # Branch comparison
```

## Generation Process

### Step 1: Range Detection

**Actions:**

- If `--from` specified: use as start point
- If no `--from`: find the most recent git tag
- If no tags exist: use the first commit
- If `--to` specified: use as end point
- If no `--to`: use HEAD
- Validate both references exist

**Checks:**

- [ ] Start reference exists and is valid
- [ ] End reference exists and is valid
- [ ] Range contains commits
- [ ] Git repository is accessible

**Output:**

```
Range Detection
===================================================================

From: v1.5.0 (2024-12-15)
To:   HEAD (2025-01-28)
Commits: 47 commits found
Authors: 3 contributors
```

### Step 2: Commit Parsing

**Actions:**

- Retrieve all commits in range with full metadata
- Parse conventional commit format:
  - `feat:` -> Added
  - `fix:` -> Fixed
  - `change:` / `refactor:` -> Changed
  - `deprecate:` -> Deprecated
  - `remove:` -> Removed
  - `security:` -> Security
  - `docs:` -> Documentation (optional group)
  - `perf:` -> Performance (optional group)
  - `chore:` / `ci:` / `build:` -> Maintenance (optional group)
- Extract scope from conventional commits: `feat(auth): add login`
- Detect breaking changes from `BREAKING CHANGE:` footer or `!` suffix
- Extract PR/issue references (#123)

**Commit Type Mapping:**

| Conventional Prefix | Changelog Category | Description |
|---|---|---|
| `feat` | Added | New features |
| `fix` | Fixed | Bug fixes |
| `refactor`, `change` | Changed | Code changes that alter behavior |
| `deprecate` | Deprecated | Features marked for removal |
| `remove` | Removed | Removed features or code |
| `security` | Security | Vulnerability fixes |
| `perf` | Performance | Performance improvements |
| `docs` | Documentation | Documentation changes |
| `chore`, `ci`, `build`, `test` | Maintenance | Internal changes |

**Checks:**

- [ ] All commits parsed successfully
- [ ] Conventional commits properly categorized
- [ ] Non-conventional commits handled (placed in "Other" category)
- [ ] Breaking changes detected and flagged

### Step 3: Changelog Formatting

**Keep a Changelog Format (default):**

```markdown
## [2.0.0] - 2025-01-28

### Breaking Changes

- **auth**: Removed deprecated OAuth 1.0 support; migrate to OAuth 2.0
- **api**: Changed response format for pagination endpoints

### Added

- **auth**: Add multi-factor authentication support (#142)
- **api**: Add rate limiting middleware with configurable thresholds (#138)
- **ui**: Add dark mode toggle to settings page (#135)
- Add new /health endpoint for monitoring

### Changed

- **api**: Refactor error handling to use consistent error codes (#140)
- **db**: Optimize user query with proper indexing (#137)
- Update TypeScript to v5.7

### Fixed

- **auth**: Fix session timeout not refreshing on activity (#141)
- **api**: Fix race condition in concurrent booking creation (#139)
- **ui**: Fix layout shift on initial page load (#136)

### Security

- **deps**: Update express to 4.19.0 to fix CVE-2024-XXXXX (#143)

### Deprecated

- **api**: Deprecate /v1/users endpoint; use /v2/users instead

### Removed

- Remove legacy migration scripts from v0.x
```

**Conventional Format:**

```markdown
## 2.0.0 (2025-01-28)

### Features

* **auth:** add multi-factor authentication support (#142)
* **api:** add rate limiting middleware (#138)
* **ui:** add dark mode toggle (#135)

### Bug Fixes

* **auth:** fix session timeout not refreshing (#141)
* **api:** fix race condition in booking creation (#139)
* **ui:** fix layout shift on initial load (#136)

### BREAKING CHANGES

* **auth:** removed deprecated OAuth 1.0 support
* **api:** changed pagination response format
```

**Simple Format:**

```markdown
## v2.0.0 (2025-01-28)

- Added multi-factor authentication support
- Added rate limiting middleware
- Added dark mode toggle
- Fixed session timeout refresh
- Fixed race condition in booking creation
- Fixed layout shift on initial load
- Updated express to fix security vulnerability
- Removed legacy migration scripts
```

### Step 4: Output Generation

**Actions:**

- If `--stdout`: print formatted changelog to terminal
- If `--output` or default CHANGELOG.md:
  - Read existing CHANGELOG.md (if exists)
  - Insert new version entry at the top (below header)
  - Preserve existing entries
  - Update [Unreleased] link (if present)
  - Write updated file

**Checks:**

- [ ] Output format is valid markdown
- [ ] Existing changelog entries preserved
- [ ] New entry properly positioned
- [ ] Links and references valid

## Output Format

### Terminal Output

```
Changelog Generated
===================================================================

Version: 2.0.0
Date: 2025-01-28
Range: v1.5.0..HEAD (47 commits)

Categories:
  Added:       5 entries
  Changed:     3 entries
  Fixed:       4 entries
  Security:    1 entry
  Deprecated:  1 entry
  Removed:     1 entry
  Breaking:    2 changes

Output: CHANGELOG.md (updated)

Preview:
-------------------------------------------------------------------
## [2.0.0] - 2025-01-28

### Breaking Changes
- **auth**: Removed deprecated OAuth 1.0 support
- **api**: Changed response format for pagination endpoints

### Added
- **auth**: Add multi-factor authentication support (#142)
- **api**: Add rate limiting middleware (#138)
[... truncated for terminal ...]

Full changelog written to: CHANGELOG.md
```

### Non-Conventional Commit Handling

Commits that don't follow conventional commit format are handled as follows:

```
Non-Conventional Commits Found
===================================================================

The following 5 commits don't follow conventional format:

  abc1234  Update README with new examples
  def5678  Minor cleanup
  ghi9012  WIP: working on auth flow
  jkl3456  Merge branch 'feature/auth'
  mno7890  Bump version

These will be placed in the "Other" category.
To improve changelog quality, consider using conventional commits:
  feat: add new feature
  fix: resolve bug
  docs: update documentation
```

## Integration with Workflow

### Phase 4: Finalization

This command is typically run during the finalization phase:

1. All code changes are complete and validated
2. Generate changelog for the release
3. Review generated changelog
4. Commit changelog with release

### CI/CD Integration

Can be integrated into release pipelines:

```yaml
- name: Generate Changelog
  run: /generate-changelog --version ${{ github.ref_name }}
```

### Pre-Release Checklist

- [ ] All commits follow conventional format
- [ ] Breaking changes documented with migration guides
- [ ] Version number follows semver
- [ ] Changelog reviewed by team lead

## Best Practices

1. **Use Conventional Commits**: Ensures accurate automatic categorization
2. **Include Scope**: `feat(auth):` provides better changelog organization
3. **Document Breaking Changes**: Always include migration instructions
4. **Review Before Publishing**: Auto-generated changelogs benefit from human review
5. **Version Consistently**: Follow semantic versioning (semver)
6. **Reference Issues**: Include issue/PR numbers for traceability
7. **Keep Human-Readable**: Edit generated entries for clarity when needed
8. **Regular Updates**: Generate changelogs frequently, not just at release

## Related Commands

- `/code-review` - Review code changes before generating changelog
- `/check-deps` - Check dependency changes to include in changelog
- `/help` - Get help on available commands

## Notes

- The command parses `git log` output; commit messages determine changelog quality
- Merge commits are excluded by default to avoid duplication
- Squash commits are supported and treated as single entries
- For monorepos, the command generates a single unified changelog by default
- The `[Unreleased]` section in Keep a Changelog format is automatically managed
- If no conventional commit prefix is detected, the full commit message is used
- Empty categories are omitted from the output
