# Skills - Specialized Capabilities

This directory contains skill definitions that provide specialized capabilities to agents. Skills are reusable expertise modules that can be invoked by multiple agents when needed.

---

## What are Skills?

**Skills** are specialized knowledge modules that:

- Provide deep expertise in specific areas
- Can be used by multiple agents
- Contain best practices and methodologies
- Are invoked when specific capabilities are needed

**Difference from Agents:**

- **Agents** are personas with responsibilities and coordination roles
- **Skills** are capabilities/knowledge that agents can use

---

## Available Skills (4)

### 1. Web App Testing

**File:** [web-app-testing.md](./web-app-testing.md)

**Purpose:** Comprehensive testing strategy for web applications

**Capabilities:**

- Design test suites (unit, integration, E2E)
- Create test fixtures and mocks
- Implement TDD workflow
- Ensure 90%+ coverage
- Test accessibility compliance
- Test performance benchmarks
- Test security requirements

**Used By:**

- `qa-engineer` - Primary user
- `backend-reviewer` - Test validation
- `frontend-reviewer` - Test validation

**When to Use:**

- Phase 2: During TDD implementation
- Phase 3: QA validation
- When test coverage is low
- When designing test strategy

**Deliverables:**

- Test suites with comprehensive coverage
- Test fixtures and mocks
- Testing best practices applied

---

### 2. Git Commit Helper

**File:** [git-commit-helper.md](./git-commit-helper.md)

**Purpose:** Generate conventional commits following project standards

**Capabilities:**

- Analyze changed files
- Group changes logically by feature/type
- Generate commit messages per `commitlint.config.js`
- Format copy-paste ready commands
- Ensure semantic versioning compatibility
- Follow conventional commits standard

**Used By:**

- Main agent (Principal Architect)
- Invoked via `/commit` command

**When to Use:**

- Phase 4: After implementation complete
- When ready to commit changes
- When preparing for merge

**Commit Message Format:**

```text
{type}({scope}): {subject}

- {bullet point 1}
- {bullet point 2}
- {bullet point 3}

```text

**Types Supported:**

- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test changes
- `build` - Build system changes
- `ci` - CI/CD changes
- `chore` - Other changes

**Deliverables:**

- Formatted git commands ready to copy-paste
- Grouped commits by feature/type
- Conventional commit messages

---

### 3. Brand Guidelines

**File:** [brand-guidelines.md](./brand-guidelines.md)

**Purpose:** Apply Hospeda brand guidelines consistently across all UI

**Capabilities:**

- Apply color palette automatically
- Use correct typography (fonts, sizes, weights)
- Maintain tone of voice in copy
- Use approved logo variations
- Ensure brand consistency
- Apply design system (Tailwind + Shadcn)

**Brand Elements:**

- **Color Palette**: Primary, secondary, accent colors
- **Typography**: Font families, sizes, weights, line heights
- **Tone of Voice**: Friendly, welcoming, professional
- **Logo Usage**: When and how to use logos
- **Spacing**: Consistent padding and margins
- **Components**: Branded component variants

**Applies To:**

- `apps/web` - Public frontend (primary)
- `apps/admin` - Admin dashboard (secondary)

**Used By:**

- `ui-ux-designer` - Primary user
- `astro-engineer` - Web app implementation
- `react-dev` - Component implementation
- `frontend-reviewer` - Brand compliance check

**When to Use:**

- Phase 1: During mockup creation
- Phase 2: When implementing UI components
- When creating new pages
- When styling components

**Deliverables:**

- Brand-compliant UI components
- Consistent visual design
- Proper typography and colors
- Approved tone of voice in copy

---

### 4. QA Criteria Validator

**File:** [qa-criteria-validator.md](./qa-criteria-validator.md)

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

**Validation Checklist:**

**Functional:**

- [ ] All acceptance criteria met
- [ ] All user stories implemented
- [ ] Edge cases handled
- [ ] Error states implemented

**UI/UX:**

- [ ] Matches mockups/wireframes
- [ ] Brand guidelines applied
- [ ] Responsive on all breakpoints
- [ ] Loading states present
- [ ] Error messages clear

**Accessibility:**

- [ ] WCAG AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Focus states visible
- [ ] ARIA labels correct

**Performance:**

- [ ] Meets performance benchmarks
- [ ] No unnecessary re-renders
- [ ] Optimized images
- [ ] Bundle size acceptable

**Security:**

- [ ] Input validation present
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Auth/authz correct

**Used By:**

- `qa-engineer` - Primary user
- Main agent - Phase 3 validation

**When to Use:**

- Phase 3: QA validation
- Before running `/quality-check`
- When validating feature completion
- Before merge request

**Deliverables:**

- Validation report with pass/fail status
- List of issues found
- Suggestions for fixes
- Acceptance criteria checklist

---

## Total: 4 Skills

## Skills by Category

### Testing & Quality

- `web-app-testing` - Comprehensive testing strategy
- `qa-criteria-validator` - Acceptance criteria validation

### Development Tools

- `git-commit-helper` - Conventional commits

### Design & Branding

- `brand-guidelines` - Brand consistency

---

## How Skills are Invoked

Skills are invoked by agents when they need specialized capabilities:

```text
Agent → Needs specific capability → Invokes Skill → Applies expertise
```text

**Example Flow:**

1. `qa-engineer` needs to validate feature
2. Invokes `qa-criteria-validator` skill
3. Skill provides validation methodology
4. Agent applies methodology to feature
5. Agent produces validation report

---

## Skill Usage Matrix

| Skill | Primary Agent | Secondary Agents | Phase |
|-------|---------------|------------------|-------|
| web-app-testing | qa-engineer | backend-reviewer, frontend-reviewer | 2, 3 |
| git-commit-helper | Main agent | - | 4 |
| brand-guidelines | ui-ux-designer | astro-engineer, react-dev, frontend-reviewer | 1, 2 |
| qa-criteria-validator | qa-engineer | Main agent | 3 |

---

## Adding New Skills

When a new skill is needed:

1. Identify the specialized capability needed
2. Document in CLAUDE.md Recent Learnings
3. Discuss with user
4. Create skill definition file
5. Update this README
6. Update relevant agent files to reference the skill

---

## Skill Files Structure

Each skill file should contain:

- **Purpose**: What the skill does
- **Capabilities**: Specific things it can do
- **Methodology**: How to apply the skill
- **Best Practices**: Guidelines and standards
- **Examples**: Concrete examples of usage
- **Deliverables**: What is produced

---

**See individual skill files for detailed methodologies and best practices.**

