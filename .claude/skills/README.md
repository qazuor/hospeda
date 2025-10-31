# Skills - Specialized Capabilities

This directory contains skill definitions that provide specialized capabilities to agents. Skills are reusable expertise modules that can be invoked by multiple agents when needed.

## What are Skills?

**Skills** are specialized knowledge modules that:

- Provide deep expertise in specific areas
- Can be used by multiple agents
- Contain best practices and methodologies
- Are invoked when specific capabilities are needed

**Difference from Agents:**

- **Agents** are personas with responsibilities and coordination roles
- **Skills** are capabilities/knowledge that agents can use

## Directory Structure

```
.claude/skills/
├── README.md                    # This file
├── brand-guidelines.md          # Brand consistency (root)
├── documentation/
│   └── markdown-formatter.md    # Markdown formatting
├── git/
│   └── git-commit-helper.md     # Conventional commits
├── patterns/
│   ├── error-handling-patterns.md    # Error hierarchies
│   └── tdd-methodology.md            # Test-Driven Development
├── qa/
│   ├── qa-criteria-validator.md      # Acceptance criteria validation
│   └── web-app-testing.md            # E2E testing strategy
├── tech/
│   ├── mermaid-diagram-specialist.md # Diagram creation
│   ├── shadcn-specialist.md          # UI component implementation
│   └── vercel-specialist.md          # Deployment optimization
├── testing/
│   ├── api-app-testing.md            # API testing workflow
│   ├── performance-testing.md        # Performance benchmarks
│   └── security-testing.md           # Security testing
└── utils/
    ├── add-memory.md                 # Knowledge capture
    ├── json-data-auditor.md          # Data validation
    └── pdf-creator-editor.md         # PDF generation
```

## Available Skills (16)

### Testing & Quality (6 skills)

#### 1. Web App Testing

**File:** [qa/web-app-testing.md](./qa/web-app-testing.md)
**Category:** QA
**Primary Users:** qa-engineer, backend-reviewer, frontend-reviewer

**Purpose:** Comprehensive E2E testing strategy for web applications

**Capabilities:**

- Design test suites (unit, integration, E2E)
- Create test fixtures and mocks
- Implement TDD workflow
- Ensure 90%+ coverage
- Test accessibility compliance
- Test performance benchmarks
- Test security requirements

**When to Use:** Phase 2 (TDD), Phase 3 (QA validation), when test coverage is low

#### 2. QA Criteria Validator

**File:** [qa/qa-criteria-validator.md](./qa/qa-criteria-validator.md)
**Category:** QA
**Primary Users:** qa-engineer

**Purpose:** Validate implementation against acceptance criteria from PDR.md

**Capabilities:**

- Validate against PDR.md acceptance criteria
- Check UI/UX compliance with mockups
- Validate functionality against user stories
- Check accessibility (WCAG AA compliance)
- Validate performance benchmarks
- Check security requirements
- Validate error handling
- Check responsive design

**When to Use:** Phase 3 (QA validation), before `/quality-check`, before merge

#### 3. API App Testing

**File:** [testing/api-app-testing.md](./testing/api-app-testing.md)
**Category:** Testing
**Primary Users:** qa-engineer, hono-engineer, tech-lead

**Purpose:** Comprehensive testing workflow for API endpoints

**Capabilities:**

- Test planning and setup
- Happy path testing (GET, POST, PUT, DELETE)
- Error handling testing
- Request/response validation
- Integration testing
- Documentation validation
- Coverage analysis (90%+)

**When to Use:** After implementing API routes, before deploying API changes, as part of `/quality-check`

#### 4. Performance Testing

**File:** [testing/performance-testing.md](./testing/performance-testing.md)
**Category:** Testing
**Primary Users:** performance-engineer, tech-lead, qa-engineer

**Purpose:** Performance testing and optimization across database, API, and frontend layers

**Capabilities:**

- Database performance testing (query optimization, N+1 detection)
- API performance testing (load testing, throughput)
- Frontend performance testing (Core Web Vitals)
- Bottleneck identification
- Optimization implementation
- Regression testing

**When to Use:** Before production deployment, after schema changes, when users report slowness, optimizing Core Web Vitals

#### 5. Security Testing

**File:** [testing/security-testing.md](./testing/security-testing.md)
**Category:** Testing
**Primary Users:** security-engineer, qa-engineer, tech-lead

**Purpose:** Comprehensive security testing covering OWASP Top 10

**Capabilities:**

- Authentication testing
- Authorization testing (RBAC)
- Input validation testing (SQL injection, XSS)
- Data protection testing
- API security testing
- Dependency security testing
- OWASP Top 10 coverage

**When to Use:** Before production deployment, after auth/authz changes, before handling payments/PII, as part of security audits

#### 6. TDD Methodology

**File:** [patterns/tdd-methodology.md](./patterns/tdd-methodology.md)
**Category:** Patterns
**Primary Users:** All engineers

**Purpose:** Test-Driven Development approach ensuring testable, well-designed code

**Capabilities:**

- RED-GREEN-REFACTOR cycle
- Three Laws of TDD implementation
- TDD with different layers (DB, Service, API)
- Coverage goals (90%+ minimum)
- Test patterns and best practices

**When to Use:** When implementing new features, fixing bugs, refactoring code, always (TDD is default approach)

### Development Tools (5 skills)

#### 7. Git Commit Helper

**File:** [git/git-commit-helper.md](./git/git-commit-helper.md)
**Category:** Git
**Primary Users:** Main agent (invoked via `/commit`)

**Purpose:** Generate conventional commits following project standards

**Capabilities:**

- Analyze changed files
- Group changes logically by feature/type
- Generate commit messages per `commitlint.config.js`
- Format copy-paste ready commands
- Ensure semantic versioning compatibility
- Follow conventional commits standard

**When to Use:** Phase 4 (after implementation), when ready to commit, preparing for merge

#### 8. Vercel Specialist

**File:** [tech/vercel-specialist.md](./tech/vercel-specialist.md)
**Category:** Tech
**Primary Users:** deployment-engineer, tech-lead, astro-engineer, tanstack-start-engineer

**Purpose:** Vercel deployment, configuration, and optimization for both apps (web/admin)

**Capabilities:**

- Project configuration (vercel.json)
- Environment variables setup
- Build optimization
- Deployment configuration
- Performance optimization
- Monitoring & analytics
- Custom domain configuration

**When to Use:** When deploying to Vercel, configuring environments, optimizing builds, troubleshooting deployments

#### 9. Shadcn Specialist

**File:** [tech/shadcn-specialist.md](./tech/shadcn-specialist.md)
**Category:** Tech
**Primary Users:** astro-engineer, tanstack-start-engineer, react-senior-dev, ui-ux-designer

**Purpose:** Shadcn/ui component specialist for consistent UI implementation

**Capabilities:**

- Component selection and installation
- Theme customization
- Component implementation
- Custom variants creation
- Accessibility compliance (WCAG 2.1 Level AA)
- Component testing

**When to Use:** Adding UI components, customizing themes, ensuring design system consistency, implementing accessible components

#### 10. Mermaid Diagram Specialist

**File:** [tech/mermaid-diagram-specialist.md](./tech/mermaid-diagram-specialist.md)
**Category:** Tech
**Primary Users:** tech-writer, architecture-validator, product-technical, tech-lead

**Purpose:** Mermaid diagram creation for documentation and architecture visualization

**Capabilities:**

- Flowchart creation (processes, decisions)
- Sequence diagram creation (API interactions)
- ERD creation (database schemas)
- C4 architecture diagrams
- State diagram creation
- Styling and customization

**When to Use:** Creating architecture documentation, visualizing workflows, documenting data models, explaining sequence flows

#### 11. Add Memory

**File:** [utils/add-memory.md](./utils/add-memory.md)
**Category:** Utils
**Primary Users:** All agents (auto-invoked when capturing knowledge)

**Purpose:** Auto-learning skill that captures architectural decisions, patterns, and best practices

**Capabilities:**

- Capture architectural decisions
- Document coding patterns
- Record configuration gotchas
- Document performance optimizations
- Record security patterns
- Create knowledge base entries
- Update memory index
- Link related memories

**When to Use:** After making architectural decisions, discovering patterns, solving complex problems, establishing conventions, after significant features

### Design & Patterns (3 skills)

#### 12. Brand Guidelines

**File:** [brand-guidelines.md](./brand-guidelines.md)
**Category:** Design
**Primary Users:** ui-ux-designer, astro-engineer, react-senior-dev, frontend-reviewer

**Purpose:** Apply Hospeda brand guidelines consistently across all UI

**Capabilities:**

- Apply color palette automatically
- Use correct typography (fonts, sizes, weights)
- Maintain tone of voice in copy
- Use approved logo variations
- Ensure brand consistency
- Apply design system (Tailwind + Shadcn)

**When to Use:** Phase 1 (mockups), Phase 2 (UI implementation), creating new pages, styling components

#### 13. Error Handling Patterns

**File:** [patterns/error-handling-patterns.md](./patterns/error-handling-patterns.md)
**Category:** Patterns
**Primary Users:** All engineers

**Purpose:** Standardized error handling patterns ensuring consistent, informative error management

**Capabilities:**

- Error class hierarchy implementation
- Database layer error handling
- Service layer error handling
- API layer error handling
- Frontend error handling
- Best practices and patterns

**When to Use:** Implementing error handling, ensuring consistent error responses, handling database errors, handling API errors

### Documentation & Utils (2 skills)

#### 14. Markdown Formatter

**File:** [documentation/markdown-formatter.md](./documentation/markdown-formatter.md)
**Category:** Documentation
**Primary Users:** tech-writer, all agents

**Purpose:** Format markdown files according to project standards

**Capabilities:**

- Format markdown files
- Fix common formatting issues
- Ensure consistent style
- Add language to code blocks
- Fix list indentation
- Add blank lines around blocks

**When to Use:** Before committing markdown files, fixing formatting issues, ensuring documentation quality

#### 15. PDF Creator & Editor

**File:** [utils/pdf-creator-editor.md](./utils/pdf-creator-editor.md)
**Category:** Utils
**Primary Users:** hono-engineer, tech-writer, payments-specialist

**Purpose:** PDF creation for invoices, reports, documentation, and contracts

**Capabilities:**

- Generate invoices with proper formatting
- Create booking confirmations
- Generate business reports
- Create contracts
- Convert documentation to PDF
- Create printable receipts

**When to Use:** Generating booking confirmations, creating invoices, producing reports, generating contracts

#### 16. JSON Data Auditor

**File:** [utils/json-data-auditor.md](./utils/json-data-auditor.md)
**Category:** Utils
**Primary Users:** qa-engineer, tech-lead, db-engineer, hono-engineer

**Purpose:** JSON data validation, transformation, and auditing for data quality

**Capabilities:**

- Data structure analysis
- Schema validation with Zod
- Data quality audit
- Data transformation
- Anomaly detection
- Generate audit reports

**When to Use:** Validating API data, auditing database exports, transforming data formats, checking data quality, ensuring schema compliance

## Skills by Category

### Testing & Quality (6)

- `web-app-testing` - E2E testing strategy
- `qa-criteria-validator` - Acceptance criteria validation
- `api-app-testing` - API testing workflow
- `performance-testing` - Performance benchmarks
- `security-testing` - Security testing (OWASP Top 10)
- `tdd-methodology` - Test-Driven Development

### Development Tools (5)

- `git-commit-helper` - Conventional commits
- `vercel-specialist` - Deployment optimization
- `shadcn-specialist` - UI component implementation
- `mermaid-diagram-specialist` - Diagram creation
- `add-memory` - Knowledge capture

### Design & Patterns (3)

- `brand-guidelines` - Brand consistency
- `error-handling-patterns` - Error hierarchies
- `markdown-formatter` - Markdown formatting

### Documentation & Utils (2)

- `pdf-creator-editor` - PDF generation
- `json-data-auditor` - Data validation

## How Skills are Invoked

Skills are invoked by agents when they need specialized capabilities:

```
Agent → Needs specific capability → Invokes Skill → Applies expertise
```

**Example Flow:**

1. `qa-engineer` needs to validate feature
2. Invokes `qa-criteria-validator` skill
3. Skill provides validation methodology
4. Agent applies methodology to feature
5. Agent produces validation report

## Skill Usage Matrix

| Skill | Primary Agent | Secondary Agents | Phase |
|-------|---------------|------------------|-------|
| web-app-testing | qa-engineer | backend-reviewer, frontend-reviewer | 2, 3 |
| qa-criteria-validator | qa-engineer | Main agent | 3 |
| api-app-testing | qa-engineer | hono-engineer, tech-lead | 2, 3 |
| performance-testing | performance-engineer | tech-lead, qa-engineer | 3 |
| security-testing | security-engineer | qa-engineer, tech-lead | 3 |
| tdd-methodology | All engineers | - | 2 |
| git-commit-helper | Main agent | - | 4 |
| vercel-specialist | deployment-engineer | tech-lead, astro-engineer, tanstack-start-engineer | 4 |
| shadcn-specialist | astro-engineer | tanstack-start-engineer, react-senior-dev, ui-ux-designer | 2 |
| mermaid-diagram-specialist | tech-writer | architecture-validator, product-technical, tech-lead | 1, 4 |
| add-memory | All agents | - | All |
| brand-guidelines | ui-ux-designer | astro-engineer, react-senior-dev, frontend-reviewer | 1, 2 |
| error-handling-patterns | All engineers | - | 2 |
| markdown-formatter | tech-writer | All agents | 4 |
| pdf-creator-editor | hono-engineer | tech-writer, payments-specialist | 2 |
| json-data-auditor | qa-engineer | tech-lead, db-engineer, hono-engineer | 2, 3 |

## Evolution

### Initial Skills (4)

- web-app-testing
- git-commit-helper
- brand-guidelines
- qa-criteria-validator

### Added in Workflow Optimization (12)

- **Testing**: api-app-testing, performance-testing, security-testing, tdd-methodology
- **Tech**: vercel-specialist, shadcn-specialist, mermaid-diagram-specialist
- **Utils**: add-memory, pdf-creator-editor, json-data-auditor
- **Documentation**: markdown-formatter
- **Patterns**: error-handling-patterns

## Adding New Skills

When a new skill is needed:

1. Identify the specialized capability needed
2. Document in CLAUDE.md Recent Learnings
3. Discuss with user
4. Create skill definition file with YAML frontmatter
5. Update this README
6. Update relevant agent files to reference the skill

## Skill File Structure

Each skill file should contain:

### YAML Frontmatter

```yaml
---
name: skill-name
category: testing|patterns|tech|utils|qa|git|documentation|design
description: Brief description
usage: When to use this skill
input: What the skill needs
output: What the skill produces
---
```

### Content Sections

- **Overview**: Purpose, category, primary users
- **When to Use This Skill**: Specific scenarios
- **Prerequisites**: Required and optional inputs
- **Workflow**: Step-by-step process
- **Output**: Deliverables and success criteria
- **Best Practices**: Guidelines and standards
- **Related Skills**: Cross-references
- **Notes**: Important considerations

## Total: 16 Skills

**See individual skill files for detailed methodologies and best practices.**
