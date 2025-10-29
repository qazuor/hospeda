# MCP Servers - Model Context Protocol Integrations

This document lists all MCP (Model Context Protocol) servers integrated into the Hospeda project and how to use them.

---

## What are MCP Servers?

**MCP Servers** provide extended capabilities to Claude Code by connecting to external services and tools through a standardized protocol.

**Benefits:**

- Access to external documentation
- Integration with development tools
- Database operations
- Deployment management
- Project tracking
- Error monitoring

---

## Available MCP Servers (15)

### 1. Context7

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

### 2. Docker

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

- `db-engineer` (primary)
- `deployment-engineer`
- Main agent (for setup)

**Common Commands:**

```text
docker ps                    # List running containers
docker logs postgres-dev     # View database logs
docker restart postgres-dev  # Restart database
```text

---

### 3. File System

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

### 4. Git

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

### 5. GitHub

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

### 6. Linear

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

### 7. PostgreSQL

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

- `db-engineer` (primary)
- `performance-engineer` (query optimization)
- `debugger` (data analysis)

**Environment:**

- **Development**: Local PostgreSQL in Docker
- **Production**: Neon (via Neon MCP server)

---

### 8. Mercado Pago

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

### 9. Sentry

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

### 10. Vercel

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

### 11. Persistent Memory

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

### 12. Chrome

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

### 13. Serena

**Purpose:** (Custom MCP Server - Please provide details)

**Status:** Configuration needed

**Please provide:**

- What does this MCP server do?
- What capabilities does it provide?
- When should it be used?
- Which agents use it?

---

### 14. Sequential Thinking

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

### 15. Neon

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

- `db-engineer` (primary)
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

### Phase 3: Validation

- `Chrome` - E2E testing
- `Sentry` - Error checking
- `PostgreSQL` - Query validation

### Phase 4: Finalization

- `GitHub` - Issue linking
- `Vercel` - Deployment
- `Neon` - Production database

### Ongoing

- `Persistent Memory` - Cross-session learning
- `Sequential Thinking` - Problem solving

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

- `Chrome` (testing)
- `Sentry` (error monitoring)

### Product/Planning

- `Linear` (issue tracking)
- `Sequential Thinking` (planning)

### Main Agent

- `Persistent Memory` (learning)
- `Sequential Thinking` (decisions)
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

**Note:** MCP server availability and configuration is managed in Claude Code settings. If a server is unavailable, inform the user and suggest enabling it in the tools menu.

