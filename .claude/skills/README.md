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
├── audit/                       # Formal audit skills
│   ├── accessibility-audit.md        # WCAG 2.1 compliance audit
│   ├── performance-audit.md          # Performance & Core Web Vitals audit
│   └── security-audit.md             # OWASP Top 10 security audit
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
│   ├── api-app-testing.md            # API testing workflow (development)
│   ├── performance-testing.md        # Performance testing (development)
│   └── security-testing.md           # Security testing (development)
└── utils/
    ├── add-memory.md                 # Knowledge capture
    ├── json-data-auditor.md          # Data validation
    └── pdf-creator-editor.md         # PDF generation
```

## Available Skills (19)

## 🔍 Testing vs Audit Skills - When to Use Which?

**IMPORTANT:** We have TWO types of quality skills with different purposes:

### Testing Skills (Development - Phase 2)

**Purpose:** Validate code during development using TDD workflow

**Characteristics:**

- Run **frequently** during development
- Part of **TDD cycle** (Red-Green-Refactor)
- Focus on **unit/integration/E2E tests**
- **Quick feedback** (seconds to minutes)
- Executed by **engineers** during coding
- Output: **Test results** (pass/fail, coverage %)

**When to Use:**

- ✅ Writing new code (TDD)
- ✅ Fixing bugs
- ✅ Refactoring
- ✅ CI/CD pipeline
- ✅ Before committing code

**Examples:**

- `security-testing` → Test authentication logic, input validation
- `performance-testing` → Benchmark query performance, check response times
- `api-app-testing` → Test API endpoints work correctly

---

### Audit Skills (Formal Review - Phase 3-4)

**Purpose:** Comprehensive formal review before deployment with detailed reports

**Characteristics:**

- Run **periodically** (quarterly, pre-deployment)
- **Comprehensive** multi-area analysis
- Focus on **compliance, standards, best practices**
- **Thorough analysis** (60-90 minutes)
- Coordinated by **tech-lead**
- Output: **Audit reports** with findings, remediation, scores

**When to Use:**

- ✅ Before production deployment
- ✅ Quarterly compliance reviews
- ✅ After major feature launches
- ✅ Before handling sensitive data (PII, payments)
- ✅ When compliance mandates formal audits

**Examples:**

- `security-audit` → OWASP Top 10 compliance, penetration testing simulation, formal report
- `performance-audit` → Core Web Vitals, bundle analysis, bottleneck identification, optimization roadmap
- `accessibility-audit` → WCAG 2.1 Level AA compliance, screen reader testing, formal compliance report

---

### Quick Decision Matrix

| Question | Testing Skill | Audit Skill |
|----------|---------------|-------------|
| **When?** | During development (Phase 2) | Before deployment (Phase 3-4) |
| **Who?** | Engineer (TDD workflow) | tech-lead (coordinates review) |
| **Frequency?** | Continuous (every commit) | Periodic (quarterly, pre-deploy) |
| **Duration?** | Minutes | 60-90 minutes |
| **Output?** | Pass/Fail + Coverage % | Comprehensive report with findings |
| **Focus?** | Does the code work correctly? | Does it meet standards/compliance? |

**Rule of Thumb:**

- Building a feature? → Use **testing** skills
- Preparing for deployment? → Use **audit** skills

---

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

**When to Use:** During development (Phase 2), testing query performance, benchmarking API endpoints, checking Core Web Vitals during TDD

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

**When to Use:** During development (Phase 2), testing authentication logic, validating input sanitization, checking OWASP Top 10 coverage during TDD

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

### Audit & Compliance (3 skills)

#### 7. Security Audit

**File:** [audit/security-audit.md](./audit/security-audit.md)
**Category:** Audit
**Primary Users:** tech-lead

**Purpose:** Comprehensive security audit with OWASP Top 10 compliance validation and penetration testing simulation

**Capabilities:**

- OWASP Top 10 (2021) compliance validation
- Authentication & Authorization review
- Input validation & sanitization audit
- Data protection & privacy compliance
- API security review
- Infrastructure security audit
- Code security patterns review
- Penetration testing simulation
- Formal security audit report with severity-categorized findings

**When to Use:** Before production deployment, quarterly security reviews, after security-critical changes, before handling PII/payments

**Difference from security-testing:**

- ✅ Formal comprehensive review (not TDD)
- ✅ Multi-area analysis (8 areas)
- ✅ Generates compliance report
- ✅ Coordinated by tech-lead
- ✅ 60+ minute thorough analysis

#### 8. Performance Audit

**File:** [audit/performance-audit.md](./audit/performance-audit.md)
**Category:** Audit
**Primary Users:** tech-lead

**Purpose:** Comprehensive performance audit analyzing database, API, frontend, and Core Web Vitals with optimization roadmap

**Capabilities:**

- Database performance analysis (N+1, indexes, query time)
- API performance review (response time, throughput, payload)
- Frontend performance audit (Core Web Vitals: LCP, FID, CLS)
- Bundle size & assets analysis
- Rendering performance review
- Network performance audit
- Memory & resource usage analysis
- Third-party performance impact
- Formal performance audit report with bottleneck analysis

**When to Use:** Before production deployment, quarterly performance reviews, after major features, when Core Web Vitals degrade

**Difference from performance-testing:**

- ✅ Formal comprehensive review (not TDD)
- ✅ Multi-layer analysis (DB, API, Frontend)
- ✅ Generates optimization roadmap
- ✅ Coordinated by tech-lead
- ✅ 60+ minute thorough analysis

#### 9. Accessibility Audit

**File:** [audit/accessibility-audit.md](./audit/accessibility-audit.md)
**Category:** Audit
**Primary Users:** tech-lead

**Purpose:** Comprehensive accessibility audit validating WCAG 2.1 Level AA compliance with assistive technology testing

**Capabilities:**

- WCAG 2.1 compliance validation (Level A, AA, AAA)
- Semantic HTML & ARIA review
- Keyboard navigation testing
- Screen reader compatibility (NVDA, JAWS, VoiceOver, TalkBack)
- Visual accessibility audit (contrast, text size, color)
- Forms & input accessibility validation
- Mobile accessibility testing
- Content accessibility review
- Formal accessibility audit report with WCAG compliance status

**When to Use:** Before production deployment, quarterly accessibility reviews, after UI/UX changes, when compliance mandates accessibility audits

**Output:** Accessibility audit report with WCAG compliance status, violations by severity, remediation steps, and testing results

### Development Tools (5 skills)

#### 10. Git Commit Helper

#### 11. Git Commit Helper

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

#### 12. Vercel Specialist

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

#### 13. Shadcn Specialist

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

#### 14. Mermaid Diagram Specialist

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

#### 15. Add Memory

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

#### 16. Brand Guidelines

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

#### 17. Error Handling Patterns

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

### Documentation & Utils (3 skills)

#### 18. Markdown Formatter

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

#### 19. PDF Creator & Editor

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

#### 20. JSON Data Auditor

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

### Testing & Quality (6 - Development/TDD)

- `web-app-testing` - E2E testing strategy (development)
- `qa-criteria-validator` - Acceptance criteria validation
- `api-app-testing` - API testing workflow (development)
- `performance-testing` - Performance benchmarks (development)
- `security-testing` - Security testing (development/TDD)
- `tdd-methodology` - Test-Driven Development

### Audit & Compliance (3 - Formal Reviews)

- `security-audit` - OWASP Top 10 compliance audit (pre-deployment)
- `performance-audit` - Core Web Vitals & optimization audit (pre-deployment)
- `accessibility-audit` - WCAG 2.1 Level AA compliance audit (pre-deployment)

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

### Documentation & Utils (3)

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

| Skill | Primary Agent | Secondary Agents | Phase | Type |
|-------|---------------|------------------|-------|------|
| web-app-testing | qa-engineer | backend-reviewer, frontend-reviewer | 2, 3 | Testing |
| qa-criteria-validator | qa-engineer | Main agent | 3 | Testing |
| api-app-testing | qa-engineer | hono-engineer, tech-lead | 2, 3 | Testing |
| performance-testing | qa-engineer | tech-lead | 2 | Testing |
| security-testing | qa-engineer | tech-lead | 2 | Testing |
| tdd-methodology | All engineers | - | 2 | Testing |
| security-audit | tech-lead | - | 3, 4 | Audit |
| performance-audit | tech-lead | - | 3, 4 | Audit |
| accessibility-audit | tech-lead | - | 3, 4 | Audit |
| git-commit-helper | Main agent | - | 4 | Dev Tools |
| vercel-specialist | tech-lead | astro-engineer, tanstack-engineer | 4 | Dev Tools |
| shadcn-specialist | astro-engineer | tanstack-engineer, react-dev, ux-ui-designer | 2 | Dev Tools |
| mermaid-diagram-specialist | tech-writer | product-technical, tech-lead | 1, 4 | Dev Tools |
| add-memory | All agents | - | All | Dev Tools |
| brand-guidelines | ux-ui-designer | astro-engineer, react-dev | 1, 2 | Design |
| error-handling-patterns | All engineers | - | 2 | Patterns |
| markdown-formatter | tech-writer | All agents | 4 | Documentation |
| pdf-creator-editor | hono-engineer | tech-writer | 2 | Utils |
| json-data-auditor | qa-engineer | tech-lead, db-engineer, hono-engineer | 2, 3 | Utils |

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

### Added in CI/CD Lite Implementation (3)

- **Audit**: security-audit, performance-audit, accessibility-audit

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

## Total: 19 Skills

**See individual skill files for detailed methodologies and best practices.**
