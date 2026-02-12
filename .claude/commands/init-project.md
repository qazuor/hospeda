---
name: init-project
description: Initializes a new project with Claude Code configuration, directory structure, CLAUDE.md, and optional brand config
---

# Init Project Command

## Purpose

Initializes a new project with a complete Claude Code configuration. Creates the `.claude/` directory structure, generates a `CLAUDE.md` file from templates, optionally sets up `brand-config.json` interactively, and scaffolds agent, command, and skill directories. This is the first command to run when setting up Claude Code workflow on a new or existing project.

## When to Use

- **New Project Setup**: When starting a fresh project that will use Claude Code
- **Existing Project Onboarding**: When adding Claude Code workflow to an existing codebase
- **Team Standardization**: When establishing consistent Claude Code configuration across projects
- **Configuration Reset**: When rebuilding project configuration from scratch

## Usage

```bash
/init-project [options]
```

### Options

- `--name <project-name>`: Project name (defaults to directory name)
- `--template <type>`: Configuration template (minimal, standard, full)
- `--brand`: Enable interactive brand configuration setup
- `--no-agents`: Skip agent directory scaffolding
- `--no-commands`: Skip command directory scaffolding
- `--no-skills`: Skip skill directory scaffolding
- `--force`: Overwrite existing configuration (prompts for confirmation)

### Examples

```bash
/init-project                                    # Interactive setup
/init-project --name my-app --template standard
/init-project --template full --brand
/init-project --template minimal --no-skills
/init-project --force                            # Reset existing config
```

## Initialization Process

### Step 1: Project Discovery

**Actions:**

- Detect project root directory
- Check for existing `.claude/` configuration
- Identify project type (Node.js, Python, Rust, Go, etc.)
- Detect package manager (npm, pnpm, yarn, bun, pip, cargo, etc.)
- Read existing `package.json`, `pyproject.toml`, `Cargo.toml`, or equivalent
- Identify existing tooling (linters, formatters, test frameworks)

**Checks:**

- [ ] Project root identified
- [ ] No conflicting configuration (or --force flag used)
- [ ] Project type detected
- [ ] Package manager detected

**Output:**

```
Project Discovery
===================================================================

Project Root: /path/to/project
Project Name: my-app
Project Type: Node.js (TypeScript)
Package Manager: pnpm
Existing Config: None detected

Detected Tooling:
  Linter: ESLint / Biome
  Formatter: Prettier / Biome
  Test Framework: Vitest / Jest
  Build Tool: Vite / Webpack / TurboRepo

Proceed with initialization? (y/n):
```

### Step 2: Template Selection

**Templates Available:**

1. **Minimal**: Basic `.claude/` structure with `CLAUDE.md` only
   - `.claude/` directory
   - `CLAUDE.md` with project overview
   - Suitable for small projects or quick setup

2. **Standard** (default): Full directory structure with basic agents
   - `.claude/` directory with subdirectories
   - `CLAUDE.md` with comprehensive configuration
   - Agent, command, and skill directory scaffolding
   - Basic README files for each directory
   - Suitable for most projects

3. **Full**: Complete setup with all scaffolding and brand config
   - Everything in Standard, plus:
   - `brand-config.json` (interactive setup)
   - Example agents, commands, and skills
   - Documentation templates
   - Suitable for large projects or teams

**Output:**

```
Template Selection
===================================================================

Select configuration template:

  1. minimal   - Basic CLAUDE.md and .claude/ directory
  2. standard  - Full directory structure with scaffolding (recommended)
  3. full      - Complete setup with brand config and examples

Select template (1-3): 2
```

### Step 3: CLAUDE.md Generation

**Actions:**

- Generate `CLAUDE.md` based on detected project information
- Include project-specific context (language, framework, tools)
- Add development guidelines section
- Add coding standards section
- Add workflow reference section

**Generated CLAUDE.md Sections:**

1. **Project Overview**
   - Project name and description
   - Technology stack
   - Architecture overview

2. **Development Guidelines**
   - Code style and conventions
   - Naming conventions
   - File organization patterns

3. **Coding Standards**
   - Language-specific standards
   - Framework-specific patterns
   - Testing requirements

4. **Workflow**
   - Available commands reference
   - Agent usage guide
   - Development process

5. **Context**
   - Project-specific context for Claude
   - Important architectural decisions
   - Known limitations or constraints

**Output:**

```
CLAUDE.md Generation
===================================================================

Generating CLAUDE.md with the following sections:

  [x] Project Overview
  [x] Development Guidelines
  [x] Coding Standards
  [x] Workflow Reference
  [x] Context

File: CLAUDE.md
```

### Step 4: Directory Structure Creation

**Standard Structure:**

```
.claude/
  agents/
    README.md
    product/
    engineering/
    quality/
    design/
    specialized/
  commands/
    README.md
  skills/
    README.md
  docs/
    README.md
  reports/
    .gitkeep
```

**Actions:**

- Create `.claude/` root directory
- Create subdirectories based on template and options
- Generate README.md files for each directory
- Create `.gitkeep` files for empty directories

**Output:**

```
Directory Structure
===================================================================

Creating .claude/ directory structure...

  Created: .claude/
  Created: .claude/agents/
  Created: .claude/agents/README.md
  Created: .claude/agents/product/
  Created: .claude/agents/engineering/
  Created: .claude/agents/quality/
  Created: .claude/agents/design/
  Created: .claude/agents/specialized/
  Created: .claude/commands/
  Created: .claude/commands/README.md
  Created: .claude/skills/
  Created: .claude/skills/README.md
  Created: .claude/docs/
  Created: .claude/docs/README.md
  Created: .claude/reports/
  Created: .claude/reports/.gitkeep
```

### Step 5: Brand Configuration (Optional)

**Triggered by**: `--brand` flag or Full template

**Interactive Setup:**

```
Brand Configuration
===================================================================

Configure brand settings for consistent output:

Project Display Name: My Application
Primary Color (hex): #3B82F6
Secondary Color (hex): #10B981
Tone of Voice (formal/casual/technical): technical
Logo Path (optional):
Tagline (optional): Build faster with AI assistance

Brand config saved to: .claude/brand-config.json
```

**Generated `brand-config.json`:**

```json
{
  "projectName": "My Application",
  "colors": {
    "primary": "#3B82F6",
    "secondary": "#10B981"
  },
  "tone": "technical",
  "tagline": "Build faster with AI assistance"
}
```

### Step 6: Final Summary

**Output:**

```
Initialization Complete
===================================================================

Project: my-app
Template: standard
Location: /path/to/project

Files Created:
  - CLAUDE.md
  - .claude/agents/README.md
  - .claude/commands/README.md
  - .claude/skills/README.md
  - .claude/docs/README.md
  - .claude/reports/.gitkeep

Directories Created: 10
Files Created: 6

Next Steps:
===================================================================

1. Review and customize CLAUDE.md
   - Add project-specific context
   - Update coding standards
   - Add architectural decisions

2. Create your first agent:
   /create-agent

3. Create custom commands:
   /create-command

4. Explore available commands:
   /help

5. Commit the configuration:
   git add .claude/ CLAUDE.md
   git commit -m "feat: initialize Claude Code configuration"
```

## Output Format

### Success Case

```
INIT PROJECT COMPLETE
===================================================================

Project: my-app
Template: standard
Config: .claude/ (10 directories, 6 files)
CLAUDE.md: Generated with 5 sections

Ready to use! Run /help to get started.
```

### Already Initialized

```
PROJECT ALREADY INITIALIZED
===================================================================

Existing .claude/ configuration found at:
  /path/to/project/.claude/

Options:
  1. Use --force to overwrite (will prompt for confirmation)
  2. Manually update existing configuration
  3. Cancel initialization

To overwrite: /init-project --force
```

## Integration with Workflow

This is the foundational command that sets up the entire Claude Code workflow:

- **First Step**: Always run before any other commands
- **One-Time Setup**: Typically run once per project
- **Team Onboarding**: Provides consistent starting point for all team members
- **Configuration Foundation**: All other commands depend on the structure created

## Best Practices

1. **Run Early**: Initialize before starting development with Claude Code
2. **Choose Appropriate Template**: Start with standard; upgrade to full if needed
3. **Customize CLAUDE.md**: Add project-specific context after generation
4. **Commit Configuration**: Version control the `.claude/` directory
5. **Share with Team**: Ensure all team members have the same configuration
6. **Update Over Time**: Keep CLAUDE.md current as the project evolves

## Related Commands

- `/help` - Get help after initialization
- `/create-agent` - Create agents in the scaffolded directories
- `/create-command` - Create commands in the scaffolded directories
- `/create-skill` - Create skills in the scaffolded directories

## Notes

- The command is idempotent with `--force` flag; without it, it will not overwrite existing configuration
- `CLAUDE.md` generation uses detected project information for smart defaults
- Brand configuration is optional and only generated when explicitly requested
- The `.claude/reports/` directory is gitignored by default (except `.gitkeep`) since reports are typically generated dynamically
- Works with any project type; language detection is best-effort and falls back to generic templates
