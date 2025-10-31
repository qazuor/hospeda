---
name: create-command
type: meta
category: system
description: Interactive wizard to create a new slash command following project standards and integration patterns
---

# Create Command

 Command

## Purpose

Guides you through creating a new slash command for the Hospeda project. This interactive wizard ensures commands follow project standards, integrate properly with the workflow, and include comprehensive documentation with clear usage examples.

## When to Use

- **New Workflow Action**: When a repeated task needs automation
- **System Integration**: When integrating new tools or processes
- **Developer Productivity**: When creating shortcuts for common operations
- **Quality Gates**: When adding validation or checking mechanisms

## Usage

```bash
/create-command [options]
```

### Options

- `--name <name>`: Command name (without slash)
- `--type <type>`: Command type (development, planning, quality, audit, meta, git)
- `--interactive`: Full interactive mode (default)
- `--template <type>`: Use template (workflow, audit, utility)

### Examples

```bash
/create-command                                  # Interactive mode
/create-command --name deploy-preview --type development
/create-command --template audit --interactive
```

## Command Creation Process

### Step 1: Command Discovery & Planning

**Questions Asked:**

1. **Command Name** (without slash):
   - Examples: `deploy-preview`, `quality-check`, `add-feature`
   - Must be unique, descriptive, kebab-case
   - Validation: lowercase, hyphens only, no spaces or special chars

2. **Command Type**:
   - `development` - Development workflow commands
   - `planning` - Feature planning and project management
   - `quality` - Quality checks and validation
   - `audit` - Comprehensive audits (security, performance, accessibility)
   - `meta` - System management commands
   - `git` - Git operations and version control

3. **Category** (for organization):
   - Determines subdirectory placement
   - Examples: workflow, validation, tools, audit, git, planning

4. **One-Line Description**:
   - Clear, concise explanation of command purpose
   - Used in command listings and help text
   - Should explain WHAT and WHEN

5. **Purpose Statement** (2-3 paragraphs):
   - Detailed explanation of command functionality
   - Problem it solves
   - Benefits to developers

6. **When to Use** (3-5 scenarios):
   - Specific situations for command invocation
   - Timing in workflow
   - Prerequisites or conditions

### Step 2: Command Specification

**Usage Definition:**

1. **Options/Parameters**:
   - Required parameters
   - Optional flags
   - Default values
   - Validation rules

2. **Examples**:
   - Basic usage
   - Advanced usage with options
   - Common scenarios

3. **Process Steps**:
   - Sequential workflow
   - Decision points
   - Error handling

4. **Output Format**:
   - Terminal output structure
   - Report files (if generated)
   - Success/failure indicators

### Step 3: Command File Generation

**File Created**: `.claude/commands/{category}/{command-name}.md`

**YAML Frontmatter Template**:

```yaml
---
name: {command-name}
type: {type}
category: {category}
description: {one-line description}
---
```

**Markdown Structure**:

```markdown
# {Command Name} Command

## Purpose

{detailed purpose statement}

## When to Use

- **{Scenario 1}**: {explanation}
- **{Scenario 2}**: {explanation}
- **{Scenario 3}**: {explanation}

## Usage

```bash
/{command-name} [options]
```

### Options

- `--option1 <value>`: {description}
- `--flag`: {description}

### Examples

```bash
/{command-name}                           # {description}
/{command-name} --option value            # {description}
```

## Process

### Step 1: {Step Name}

**Actions:**

- {action-1}
- {action-2}

**Checks:**

- [ ] {check-1}
- [ ] {check-2}

### Step 2: {Step Name}

[Similar structure...]

## Output Format

### Terminal Output

```
{example terminal output}
```

### Report Files

{description of generated files}

## Integration with Workflow

{how command fits into workflow}

## Best Practices

{usage best practices}

## Related Commands

{related commands}

## Notes

{additional notes}

```

### Step 4: Integration & Documentation

**Updates Required:**

1. **`.claude/commands/README.md`**:
   - Add command to appropriate category
   - Update command count
   - Add to quick reference if applicable

2. **`CLAUDE.md`** (if major command):
   - Add to commands quick reference
   - Update workflow documentation if needed

3. **`.claude/docs/quick-start.md`** (if user-facing):
   - Add to common commands section

### Step 5: Validation & Testing

**Validation Checks**:

- [ ] Command name follows conventions (kebab-case, no slash)
- [ ] YAML frontmatter valid
- [ ] All sections complete
- [ ] Examples are clear and tested
- [ ] Process steps are actionable
- [ ] Output format is documented
- [ ] File in correct directory
- [ ] Documentation updated

**Test Execution**:

```bash
/{command-name} [options]
```

Verify:

- Command loads correctly
- Options work as expected
- Output matches documentation
- Error handling works

### Step 6: Commit & Documentation

**Commit Message Format**:

```bash
feat(commands): add /{command-name} command

- Add {command-name} in {category} category
- {Brief description of functionality}
- {Key features or benefits}

Usage:
  /{command-name} [options]

Examples:
  - {example-1}
  - {example-2}

Updates:
- .claude/commands/{category}/{command-name}.md (new)
- .claude/commands/README.md (updated)

PF004-XX (if during P-004 workflow)
```

## Interactive Wizard Flow

```
⚙️ Create New Command Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Step 1: Command Identity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Command Name (without slash): deploy-preview
Command Type:
  1. development - Development workflow ✓
  2. planning - Planning & project management
  3. quality - Quality checks
  4. audit - Comprehensive audits
  5. meta - System management
  6. git - Git operations

Select type (1-6): 1

Category (subdirectory): workflow

One-line description:
> Deploys a preview environment to Vercel and generates shareable URL
> for testing and review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 2: Purpose & Usage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detailed Purpose (2-3 paragraphs):
> Deploys the current branch to a Vercel preview environment, allowing
> developers and stakeholders to test changes before merging to main.
> Creates a unique URL for each deployment, integrates with GitHub PRs,
> and provides deployment logs.

When to Use (scenarios, one per line, empty to finish):

1. Before creating pull request for visual review
2. Testing changes in production-like environment
3. Sharing work-in-progress with stakeholders
4. Debugging deployment-specific issues
5.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 Step 3: Options & Parameters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add options/flags (leave empty when done):

Option name: app
  Type: required|optional: optional
  Has value: y/n: y
  Description: Specific app to deploy (web, admin, api)
  Default: all

Option name: wait
  Type: required|optional: optional
  Has value: y/n: n
  Description: Wait for deployment to complete
  Default: (none)

Option name:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Step 4: Process Definition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define process steps (title + actions):

Step 1 Title: Validate Environment
  Actions (one per line, empty when done):
  - Check Vercel credentials configured
  - Verify current branch is not main/master
  - Ensure working directory is clean
  -

Step 2 Title: Build and Deploy
  Actions:
  - Run build command for specified app(s)
  - Deploy to Vercel preview environment
  - Capture deployment URL
  -

Step 3 Title: Post-Deployment
  Actions:
  - Display deployment URL
  - Update PR with preview link (if applicable)
  - Run basic smoke tests
  -

Step 4 Title:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Step 5: Review & Confirm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Command Summary:
  Name: deploy-preview
  Type: development
  Category: workflow
  Description: Deploys a preview environment to Vercel...

  Options:
    --app <name>     Deploy specific app (default: all)
    --wait           Wait for deployment to complete

  Process Steps: 3 defined

File will be created at:
  .claude/commands/workflow/deploy-preview.md

Documentation updates:
  - .claude/commands/README.md

Proceed with creation? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Creating Command
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Generated command file
✓ Updated commands README
✓ Validation passed

📄 Command created successfully!

File: .claude/commands/workflow/deploy-preview.md

Next steps:
1. Review and customize the generated content
2. Add detailed output format examples
3. Test command execution
4. Commit changes

Usage:
  /deploy-preview
  /deploy-preview --app web --wait

Suggested commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
feat(commands): add /deploy-preview command

- Add deploy-preview in workflow category
- Deploy current branch to Vercel preview environment
- Generate shareable preview URLs for testing
- Support per-app deployment with --app flag

Usage:
  /deploy-preview [--app <name>] [--wait]

Examples:
  - /deploy-preview
  - /deploy-preview --app web
  - /deploy-preview --wait

Updates:
- .claude/commands/workflow/deploy-preview.md (new)
- .claude/commands/README.md (updated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Command Templates

### Workflow Command Template

```markdown
---
name: {command-name}
type: development
category: workflow
description: {description}
---

# {Command Name} Command

## Purpose

{Detailed explanation of command functionality and benefits}

## When to Use

- **{Scenario 1}**: {explanation}
- **{Scenario 2}**: {explanation}
- **{Scenario 3}**: {explanation}

## Usage

```bash
/{command-name} [options]
```

### Options

- `--option <value>`: {description}
- `--flag`: {description}

### Examples

```bash
/{command-name}                    # {description}
/{command-name} --option value     # {description}
```

## Process

### Step 1: {Step Name}

**Actions:**

- {action}

**Checks:**

- [ ] {check}

## Output Format

### Terminal Output

```
{example output}
```

## Integration with Workflow

{integration details}

## Best Practices

{best practices}

## Related Commands

- `/{related-command}` - {description}

## Notes

{notes}

```

### Audit Command Template

```markdown
---
name: {audit-name}
type: audit
category: quality
description: {description}
---

# {Audit Name} Command

## Purpose

{Audit purpose and scope}

## When to Use

{When to run this audit}

## Usage

```bash
/{audit-name} [options]
```

### Options

- `--scope <area>`: {description}
- `--report`: Generate detailed report

### Examples

```bash
/{audit-name}
/{audit-name} --scope <area> --report
```

## Audit Process

### 1. {Audit Area}

**Checks:**

- [ ] {check-1}
- [ ] {check-2}

**Tools:**

- {tool-1}

**Benchmarks:**

- {benchmark-1}

## Output Format

### Terminal Output

```
{audit output example}
```

### Report File Structure

```markdown
{report structure}
```

## Integration with Workflow

{when to run in workflow}

## Best Practices

{audit best practices}

## Related Commands

{related commands}

## Notes

{notes}

```

### Utility Command Template

```markdown
---
name: {command-name}
type: development
category: tools
description: {description}
---

# {Command Name} Command

## Purpose

{Utility purpose}

## When to Use

{Use cases}

## Usage

```bash
/{command-name} [args]
```

### Arguments

- `<arg>`: {description}

### Examples

```bash
/{command-name} <arg>
```

## Process

{How it works}

## Output

{What it produces}

## Notes

{notes}

```

## Validation Rules

### Command Name

- **Format**: kebab-case only
- **Length**: 3-30 characters
- **Pattern**: `^[a-z][a-z0-9-]*[a-z0-9]$`
- **Uniqueness**: Must not conflict with existing commands
- **No Slash**: Never include / in the name (added automatically)

### YAML Frontmatter

- **Required Fields**: name, type, category, description
- **Valid Types**: development, planning, quality, audit, meta, git
- **Description**: One-line summary (under 120 chars)

### Directory Structure

```

.claude/commands/
├── workflow/         # Development workflow commands
├── planning/         # Planning and project commands
├── quality/          # Quality validation commands
├── audit/            # Comprehensive audit commands
├── meta/             # System management commands
└── git/              # Git operations

```

### File Naming

- **Pattern**: `{command-name}.md`
- **Location**: `.claude/commands/{category}/{command-name}.md`
- **Case**: All lowercase
- **Extension**: `.md` only

## Best Practices for Command Design

### Clarity

- **Clear Purpose**: Single, well-defined responsibility
- **Descriptive Name**: Name should indicate function
- **Comprehensive Docs**: Include all usage scenarios

### Usability

- **Sensible Defaults**: Minimize required options
- **Progressive Disclosure**: Simple usage, advanced options
- **Clear Feedback**: Informative output and error messages

### Integration

- **Workflow Aware**: Fit into existing workflow
- **Composable**: Work well with other commands
- **Idempotent**: Safe to run multiple times

### Documentation

- **Examples**: Include realistic examples
- **Error Cases**: Document error scenarios
- **Related Commands**: Link to related functionality

## Common Command Patterns

### Quality Check Pattern

```bash
/{check-name} [--scope <area>] [--fix] [--report]
```

- Run checks
- Optional auto-fix
- Generate report

### Workflow Automation Pattern

```bash
/{action-name} [--options]
```

- Validate preconditions
- Execute actions
- Provide feedback

### Audit Pattern

```bash
/{audit-name} [--scope <area>] [--depth <level>] [--report]
```

- Comprehensive checks
- Multiple audit areas
- Detailed reporting

## Related Commands

- `/create-agent` - Create new agent
- `/create-skill` - Create new skill
- `/help` - Get system help

## Notes

- **Command Naming**: Use verb-noun pattern (e.g., `deploy-preview`, `run-tests`)
- **Option Naming**: Use full words, avoid abbreviations
- **Documentation**: Keep examples up-to-date with actual usage
- **Testing**: Always test command before committing
- **README Updates**: Always update commands/README.md
- **Deprecation**: If replacing command, document migration path

This command streamlines command creation while ensuring consistency, usability, and proper integration with the workflow system.
