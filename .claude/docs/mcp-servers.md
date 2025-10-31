# MCP Servers - Model Context Protocol Integrations

This document lists all MCP (Model Context Protocol) servers integrated into
the Hospeda project and how to use them.

---

## What are MCP Servers?

**MCP Servers** provide extended capabilities to Claude Code by connecting to
external services and tools through a standardized protocol.

**Benefits:**

- Access to external documentation
- Integration with development tools
- Database operations
- Deployment management
- Project tracking
- Error monitoring

---

## Installation Status

**✅ Active:** 19/21 servers installed and configured
**⏸️ Pending:** 2 servers (DeepL, Semgrep)

## Available MCP Servers (21)

### 1. Context7 ✅

**Status:** Active
**Type:** HTTP
**Purpose:** Library documentation access and intelligent caching

**Capabilities:**

- Resolve library IDs for any npm package
- Get comprehensive documentation and examples
- Reduce token consumption via smart caching
- Access up-to-date API documentation

**Tools:**

```text
mcp__context7__resolve-library-id

- Input: Package name (e.g., "hono", "drizzle-orm")
- Output: Library ID for documentation lookup

mcp__context7__get-library-docs

- Input: Library ID
- Output: Comprehensive docs with examples

```text

**Use Cases:**

- Working with Hono framework
- Drizzle ORM queries
- React 19 features
- TanStack Router/Query/Form
- Zod validation
- Vitest testing
- Any npm package documentation

**Used By:**

- All development agents
- `dependency-mapper` agent (primary)

**Example:**

```text

1. Resolve: "drizzle-orm" → library_id: "drizzle-orm-latest"
2. Get docs: library_id → Full Drizzle ORM documentation

```text

---

### 2. Docker ✅

**Status:** Active
**Type:** STDIO
**Purpose:** Container management for local development

**Capabilities:**

- Start/stop/restart containers
- View container logs
- Execute commands in containers
- Inspect container status
- Manage volumes and networks

**Use Cases:**

- Start PostgreSQL database container
- View database logs
- Troubleshoot container issues
- Development environment setup

**Used By:**

- `db-drizzle-engineer` (primary)
- `deployment-engineer`
- Main agent (for setup)

**Common Commands:**

```text
docker ps                    # List running containers
docker logs postgres-dev     # View database logs
docker restart postgres-dev  # Restart database
```text

---

### 3. File System ✅

**Status:** Active
**Type:** STDIO
**Configuration:** `/home/qazuor/projects/WEBS/hospeda`
**Purpose:** File operations across the project

**Capabilities:**

- Read files
- Write files
- Delete files
- Create directories
- Search files
- List directory contents

**Use Cases:**

- Read configuration files
- Create new files
- Update existing files
- Search for patterns in code
- General file operations

**Used By:**

- All agents (universal)

---

### 4. Git ✅

**Status:** Active
**Type:** STDIO
**Purpose:** Version control operations

**Capabilities:**

- View status
- View diffs
- View commit history
- View branches
- Create branches
- Stage changes (for review only)

**Use Cases:**

- Check current changes
- Review diffs before committing
- View commit history
- Branch management
- Code analysis

**Used By:**

- Main agent
- `debugger` (for history analysis)
- All reviewers

**Important:**

- **DO NOT suggest `git add` commands** - User stages manually
- Use for review and analysis only

---

### 5. GitHub ✅

**Status:** Active
**Type:** HTTP
**Purpose:** GitHub API integration

**Capabilities:**

- Manage issues and PRs
- View workflow runs
- Manage repository settings
- Create/update issues
- Review PR status

**Use Cases:**

- Track issues in GitHub
- Monitor CI/CD workflows
- Create issues from bugs
- Link commits to issues

**Used By:**

- `cicd-engineer` (primary)
- Main agent (for issue tracking)

---

### 6. Linear ✅

**Status:** Active
**Type:** HTTP
**Purpose:** Issue tracking and project management

**Capabilities:**

- Create and update issues
- Track project progress
- Manage sprints
- View issue status
- Assign issues

**Use Cases:**

- Project task tracking
- Sprint planning
- Issue management
- Progress monitoring

**Used By:**

- `product-technical` (primary)
- Main agent (for planning)

---

### 7. PostgreSQL ✅

**Status:** Active
**Type:** STDIO
**Configuration:** `postgresql://hospeda_user:***@localhost:5432/hospeda_dev`
**Purpose:** Direct database access and operations

**Capabilities:**

- Execute queries
- View schema
- Analyze query performance
- View table data
- Database debugging

**Use Cases:**

- Query optimization
- Schema inspection
- Data analysis
- Debugging database issues
- Performance profiling

**Used By:**

- `db-drizzle-engineer` (primary)
- `performance-engineer` (query optimization)
- `debugger` (data analysis)

**Environment:**

- **Development**: Local PostgreSQL in Docker
- **Production**: Neon (via Neon MCP server)

---

### 8. Mercado Pago ✅

**Status:** Active
**Type:** HTTP
**Configuration:** Configured with test credentials
**Purpose:** Payment processing integration (Argentina)

**Capabilities:**

- Process payments
- Handle webhooks
- Manage subscriptions
- Refund transactions
- Get payment status

**Use Cases:**

- Payment implementation
- Webhook handling
- Subscription management
- Payment debugging

**Used By:**

- Payment service developers
- `backend-reviewer` (payment code review)

**Package:**

- Implemented in `packages/payments`

---

### 9. Sentry ✅

**Status:** Active
**Type:** HTTP
**Purpose:** Error monitoring and tracking

**Capabilities:**

- View errors
- Track error trends
- Analyze stack traces
- View error context
- Monitor performance

**Use Cases:**

- Production error monitoring
- Error debugging
- Performance monitoring
- User impact analysis

**Used By:**

- `debugger` (primary)
- `performance-engineer`
- Main agent (production issues)

---

### 10. Vercel ✅

**Status:** Active
**Type:** HTTP
**Purpose:** Deployment management

**Capabilities:**

- Manage deployments
- View build logs
- Configure environment variables
- Monitor deployment status
- Rollback deployments

**Use Cases:**

- Production deployments
- Build debugging
- Environment configuration
- Deployment monitoring

**Used By:**

- `deployment-engineer` (primary)
- `cicd-engineer` (deployment pipeline)

---

### 11. Persistent Memory ✅

**Status:** Active
**Type:** STDIO
**Configuration:** `~/.claude/memory.jsonl`
**Purpose:** Cross-session knowledge retention

**Capabilities:**

- Remember architectural decisions
- Store learned patterns
- Retain project context
- Store user preferences
- Keep historical knowledge

**What to Remember:**

- Architectural decisions and rationale
- Recurring bugs and their solutions
- Preferred patterns and approaches
- User-specific preferences
- Project-specific conventions

**Used By:**

- Main agent (primary)
- All agents (context retention)

**Examples:**

- "We decided to use Drizzle over Prisma because..."
- "The accommodation search uses PostgreSQL text search"
- "User prefers TypeScript strict mode always enabled"

---

### 12. Chrome DevTools ✅

**Status:** Active
**Type:** STDIO
**Requirement:** Chrome with `--remote-debugging-port=9222`
**Purpose:** Browser automation and testing

**Capabilities:**

- Run E2E tests
- Take screenshots
- Validate UI rendering
- Test user interactions
- Visual regression testing

**Use Cases:**

- E2E testing
- Visual regression testing
- UI validation
- Screenshot capture for docs

**Used By:**

- `qa-engineer` (primary)
- `accessibility-engineer` (compliance testing)
- `ui-ux-designer` (visual validation)

---

### 13. Serena ✅

**Status:** Active
**Type:** STDIO
**Repository:** https://github.com/oraios/serena
**Configuration:** Context: `ide-assistant`, Project: `/home/qazuor/projects/WEBS/hospeda`
**Purpose:** Semantic code analysis and intelligent context understanding

**Capabilities:**

- Semantic code search and navigation
- Context-aware code understanding
- Intelligent code suggestions
- Project structure analysis
- Cross-file relationship mapping

**Use Cases:**

- Finding related code across the codebase
- Understanding code dependencies
- Refactoring with context awareness
- Code navigation and exploration
- Architectural analysis

**Used By:**

- All development agents (enhanced context)
- `architecture-validator` (structure analysis)
- `debugger` (relationship tracing)
- Main agent (codebase understanding)

---

### 14. Sequential Thinking ✅

**Status:** Active
**Type:** STDIO
**Purpose:** Complex problem solving with step-by-step reasoning

**Capabilities:**

- Break down complex problems
- Reason through multi-step solutions
- Analyze dependencies
- Chain of thought reasoning
- Decision tree analysis

**Use Cases:**

- Complex debugging
- Architectural decisions
- Planning complex features
- Root cause analysis
- Multi-step problem solving

**Used By:**

- Main agent (complex decisions)
- `debugger` (complex bugs)
- `architecture-validator` (design decisions)
- `product-technical` (complex planning)

**When to Use:**

- Problems with multiple interdependencies
- Architectural decisions with many tradeoffs
- Complex debugging scenarios
- Multi-step refactoring
- Planning complex features

---

### 15. Neon ✅

**Status:** Active
**Type:** HTTP
**Configuration:** Configured with Neon API key
**Purpose:** Production database management (Neon.tech)

**Capabilities:**

- Manage production database
- View metrics
- Execute queries safely
- Monitor performance
- Backup management

**Use Cases:**

- Production database operations
- Performance monitoring
- Production debugging (read-only)
- Backup verification

**Used By:**

- `db-drizzle-engineer` (primary)
- `performance-engineer` (query optimization)
- `deployment-engineer` (production setup)

**Environment:**

- **Production only** (not for development)
- Development uses local PostgreSQL

**Important:**

- Always be cautious with production database
- Prefer read-only operations
- Coordinate with user before writes

---

### 16. Socket ✅

**Status:** Active
**Type:** HTTP
**Purpose:** Dependency security analysis and vulnerability detection

**Capabilities:**

- Scan package.json for vulnerabilities
- Detect malicious packages
- Analyze dependency security
- Track supply chain risks
- Monitor open source security

**Use Cases:**

- Security audits
- Dependency updates
- Vulnerability detection
- Supply chain analysis
- Security compliance

**Used By:**

- `security-engineer` (primary)
- `backend-reviewer` (dependency review)
- Main agent (security checks)

---

### 17. Cloudflare Docs ✅

**Status:** Active
**Type:** HTTP
**Purpose:** Cloudflare integration and documentation

**Capabilities:**

- Access Cloudflare API documentation
- Manage Cloudflare resources
- Configure CDN and DNS
- Access Workers documentation
- R2 storage integration

**Use Cases:**

- CDN configuration
- Edge computing setup
- DNS management
- Static asset optimization
- Workers deployment

**Used By:**

- `deployment-engineer` (primary)
- `performance-engineer` (CDN optimization)

---

### 18. BrowserStack ✅

**Status:** Active
**Type:** STDIO
**Configuration:** Configured with BrowserStack credentials
**Purpose:** Real browser testing and automation

**Capabilities:**

- Run E2E tests on real browsers
- Cross-browser compatibility testing
- Mobile device testing
- Screenshot capture
- Automated testing workflows

**Use Cases:**

- Cross-browser testing
- Mobile responsiveness testing
- Visual regression testing
- Browser compatibility verification
- Real device testing

**Used By:**

- `qa-engineer` (primary)
- `accessibility-engineer` (browser compliance)
- `ui-ux-designer` (cross-browser validation)

**Requirements:**

- BrowserStack account
- Internet access for test execution
- View test logs at https://www.browserstack.com/automate

---

### 19. DeepL ⏸️

**Status:** Pending installation
**Type:** HTTP
**Purpose:** Translation and internationalization workflows

**Capabilities:**

- High-quality text translation
- Batch translation support
- Multiple language support
- Context-aware translations
- i18n file processing

**Use Cases:**

- Translating UI strings
- i18n file localization
- Content translation
- Multi-language support
- Documentation translation

**Used By:**

- `i18n-specialist` (primary)
- `tech-writer` (documentation translation)

**Installation Required:**

```bash
# Get API key from: https://www.deepl.com/pro-api
claude mcp add --transport http deepl https://mcp.deepl.com/mcp --header "Authorization: Bearer <YOUR_DEEPL_API_KEY>"
```

**Free Tier:** 500,000 characters/month

---

### 20. Semgrep ⏸️

**Status:** Pending installation
**Type:** STDIO
**Purpose:** Static code security analysis

**Capabilities:**

- Scan code for vulnerabilities
- Detect security anti-patterns
- Find secrets in code
- Custom rule creation
- Multi-language support

**Use Cases:**

- Security audits
- Vulnerability scanning
- Secret detection
- Code quality checks
- Security compliance

**Used By:**

- `security-engineer` (primary)
- `backend-reviewer` (security review)
- `code-check` command

**Installation Required:**

```bash
# Option 1: Install with pipx
sudo apt install pipx
pipx install semgrep
semgrep login

# Option 2: Use virtual environment
python3 -m venv ~/.venvs/semgrep
~/.venvs/semgrep/bin/pip install semgrep
~/.venvs/semgrep/bin/semgrep login

# Then install MCP server
claude mcp add-json semgrep '{"type":"stdio","command":"semgrep","args":["mcp"]}'
```

---

## MCP Server Usage by Phase

### Phase 1: Planning

- `Linear` - Issue tracking
- `Sequential Thinking` - Complex planning
- `Persistent Memory` - Remember decisions

### Phase 2: Implementation

- `Context7` - Library documentation
- `File System` - File operations
- `Git` - Version control
- `Docker` - Database containers
- `PostgreSQL` - Database operations
- `Serena` - Semantic code analysis
- `Mercado Pago` - Payment integration

### Phase 3: Validation

- `Chrome DevTools` - E2E testing
- `BrowserStack` - Cross-browser testing
- `Sentry` - Error checking
- `PostgreSQL` - Query validation
- `Socket` - Security scanning
- `Semgrep` - Code security analysis (when installed)

### Phase 4: Finalization

- `GitHub` - Issue linking
- `Vercel` - Deployment
- `Cloudflare Docs` - CDN configuration
- `Neon` - Production database

### Ongoing

- `Persistent Memory` - Cross-session learning
- `Sequential Thinking` - Problem solving
- `Serena` - Code understanding

---

## MCP Server Usage by Agent

### Development Agents

- `Context7` - All dev agents
- `File System` - All dev agents
- `Git` - All dev agents

### Database Engineers

- `PostgreSQL` (dev)
- `Neon` (production)
- `Docker` (containers)

### DevOps Engineers

- `Docker` (containers)
- `Vercel` (deployment)
- `GitHub` (CI/CD)

### QA Engineers

- `Chrome DevTools` (testing)
- `BrowserStack` (cross-browser testing)
- `Sentry` (error monitoring)

### Security Engineers

- `Socket` (dependency security)
- `Semgrep` (code security - when installed)
- `Sentry` (security monitoring)

### Product/Planning

- `Linear` (issue tracking)
- `Sequential Thinking` (planning)

### Payment & i18n Specialists

- `Mercado Pago` (payment processing)
- `DeepL` (translation - when installed)

### Main Agent

- `Persistent Memory` (learning)
- `Sequential Thinking` (decisions)
- `Serena` (code understanding)
- All servers (coordination)

---

## Best Practices

### Context7 Usage

- Always use for library documentation
- Saves tokens vs searching web
- More accurate than training data
- Use for any npm package

### Database Access

- Development: Use `PostgreSQL` MCP
- Production: Use `Neon` MCP
- Always be cautious with production
- Prefer read-only queries in production

### Git Operations

- Use for review and analysis
- **Never suggest `git add`** commands
- User stages files manually

### Persistent Memory

- Store important decisions
- Remember user preferences
- Keep architectural rationale
- Update regularly

### Sequential Thinking

- Use for complex problems
- Break down multi-step issues
- Document reasoning chain
- Present clear conclusions

### Serena

- Use for semantic code search
- Leverage for architectural analysis
- Helpful for refactoring decisions
- Great for understanding code relationships

### Socket & Semgrep

- Run security scans regularly
- Review dependencies before updates
- Check for vulnerabilities in new packages
- Integrate into quality checks

### BrowserStack

- Test on real browsers before deployment
- Verify cross-browser compatibility
- Check mobile responsiveness
- Document browser-specific issues

### Chrome DevTools

- Start Chrome with debugging flag first
- Use for local E2E testing
- Combine with automated test suites
- Capture screenshots for bug reports

### Mercado Pago

- Use test credentials in development
- Test webhooks thoroughly
- Handle errors gracefully
- Document payment flows

---

## Quick Installation Guide

### Active Servers (19)

All currently installed and ready to use:

- ✅ Context7, Linear, GitHub, Sentry, Vercel, Neon, Socket, Cloudflare Docs,
  Mercado Pago (HTTP)
- ✅ Docker, FileSystem, Git, PostgreSQL, Memory, Serena, Sequential Thinking,
  Chrome DevTools, BrowserStack (STDIO)

### Pending Installation (2)

**DeepL** - Translation service

```bash
# Get free API key: https://www.deepl.com/pro-api
claude mcp add --transport http deepl https://mcp.deepl.com/mcp \
  --header "Authorization: Bearer <YOUR_API_KEY>"
```

**Semgrep** - Security scanning

```bash
# Install semgrep first
sudo apt install pipx && pipx install semgrep && semgrep login
# Then add MCP server
claude mcp add-json semgrep '{"type":"stdio","command":"semgrep","args":["mcp"]}'
```

---

## Troubleshooting MCP Servers

### Server Not Available

- Check if server is enabled in settings
- Verify network connectivity
- Check server configuration

### Authentication Errors

- Verify API keys/tokens
- Check environment variables
- Ensure proper permissions

### Rate Limiting

- Context7: Intelligent caching helps
- GitHub: Be mindful of API limits
- Neon: Monitor query frequency

---

## Server Status Summary

**Total Servers:** 20 configured (19 active + 2 pending)

**Active HTTP Servers (9):**

1. Context7 ✅
2. Linear ✅
3. GitHub ✅
4. Mercado Pago ✅
5. Sentry ✅
6. Vercel ✅
7. Neon ✅
8. Socket ✅
9. Cloudflare Docs ✅

**Active STDIO Servers (10):**

1. Docker ✅
2. FileSystem ✅
3. Git ✅
4. PostgreSQL ✅
5. Memory ✅
6. Serena ✅
7. Sequential Thinking ✅
8. Chrome DevTools ✅
9. BrowserStack ✅

**Pending (2):**

1. DeepL ⏸️ (requires API key)
2. Semgrep ⏸️ (requires installation)

---

**Note:** MCP server availability and configuration is managed in Claude Code
settings. If a server is unavailable, inform the user and suggest enabling it in
the tools menu.

**Last Updated:** 2025-10-28 (19/21 servers active)
