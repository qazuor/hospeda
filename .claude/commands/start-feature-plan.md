# Start Feature Plan Command

## Purpose

Initialize comprehensive planning for a new feature following the Four-Phase Workflow. Creates structured planning session with complete documentation and atomic task breakdown.

## Usage

```bash
/start-feature-plan {feature_name}
```text

## Description

Orchestrates the complete planning phase (Phase 1) by invoking specialized agents to create a comprehensive feature plan. Establishes planning session directory structure and generates all required documentation for successful feature implementation.

---

## Execution Flow

### Step 1: Initialize Planning Context

**Process**:

- Create planning session directory:

  ```bash
  mkdir -p .claude/sessions/planning/{feature_name}/
  cd .claude/sessions/planning/{feature_name}/
  ```

- Initialize context files from templates:
  - `PDR.md` (Product Requirements Document)
  - `tech-analysis.md` (Technical Analysis)
  - `TODOs.md` (Task Breakdown)
  - `wireframes/` (UI mockups directory)

### Step 2: Product Requirements Analysis

**Agent**: `product-functional`

**Process**:

- Analyze feature requirements
- Define acceptance criteria
- Identify user personas and journeys
- Document business rules and constraints
- Create prioritized feature scope

**Deliverable**: Complete `PDR.md` with:

- Feature overview and objectives
- Detailed acceptance criteria (AC-001, AC-002, etc.)
- User stories and personas
- Business rules and constraints
- Success metrics and KPIs

### Step 3: UI/UX Design

**Agent**: `ui-ux-designer`

**Process**:

- Create wireframes and mockups
- Design user interface components
- Define user interaction flows
- Ensure brand guideline compliance
- Plan responsive design approach

**Deliverable**:

- Wireframes in `wireframes/` directory
- UI component specifications
- Interaction flow diagrams
- Design system integration notes

### Step 4: Technical Analysis

**Agent**: `product-technical`

**Process**:

- Analyze technical requirements
- Design system architecture
- Identify dependencies and risks
- Plan database schema changes
- Design API endpoints

**Deliverable**: Complete `tech-analysis.md` with:

- Architecture overview
- Database schema changes
- API endpoint design
- Technology choices justification
- Risk assessment and mitigation

### Step 5: Task Breakdown

**Agent**: `product-technical` (with task breakdown focus)

**Process**:

- Break down feature into atomic tasks (1-2 hours each)
- Identify task dependencies
- Prioritize implementation order
- Estimate effort and complexity
- Create milestone groupings

**Iteration Process**:

1. Initial breakdown into major components
2. Refine each component into smaller tasks
3. Validate atomicity (1-2 hour rule)
4. Re-break tasks that are too large
5. Continue until all tasks are atomic

**Deliverable**: Complete `TODOs.md` with:

- Prioritized task list
- Task dependencies mapping
- Effort estimates
- Implementation phases
- Milestone definitions

### Step 6: Final Planning Review

**Agent**: `tech-lead`

**Process**:

- Review all planning artifacts
- Validate technical approach
- Ensure architectural consistency
- Approve task breakdown
- Sign off on planning phase

**Deliverable**: Planning approval and readiness confirmation

---

## Planning Session Structure

```text
.claude/sessions/planning/{feature_name}/
├── PDR.md                    # Product Requirements Document
├── tech-analysis.md          # Technical Analysis
├── TODOs.md                  # Atomic Task Breakdown
├── wireframes/               # UI/UX Design Assets
│   ├── user-flow.png
│   ├── wireframe-desktop.png
│   └── wireframe-mobile.png
└── notes/                    # Additional Planning Notes
    ├── research.md
    ├── alternatives.md
    └── decisions.md
```text

---

## Quality Standards

### PDR.md Requirements

- ✅ **Clear Objectives**: Feature purpose and value proposition
- ✅ **Specific Acceptance Criteria**: Testable, numbered criteria
- ✅ **User Stories**: Complete with persona definition
- ✅ **Business Rules**: Edge cases and constraints documented
- ✅ **Success Metrics**: Measurable outcomes defined

### Technical Analysis Requirements

- ✅ **Architecture Alignment**: Consistent with existing patterns
- ✅ **Database Design**: Proper relationships and constraints
- ✅ **API Design**: RESTful, type-safe endpoints
- ✅ **Risk Assessment**: Technical challenges identified
- ✅ **Technology Justification**: Choices explained

### Task Breakdown Requirements

- ✅ **Atomic Tasks**: Each task 1-2 hours maximum
- ✅ **Clear Dependencies**: Task order and relationships defined
- ✅ **Testable Outcomes**: Each task has verifiable completion
- ✅ **Priority Ordering**: Critical path identified
- ✅ **Effort Estimation**: Realistic time estimates

---

## Output Format

### Success Case

```text
✅ FEATURE PLANNING COMPLETE

Feature: User Authentication System
Planning Session: .claude/sessions/planning/user-auth/

📋 Documents Created:
✅ PDR.md - 12 acceptance criteria defined
✅ tech-analysis.md - Architecture and API design complete
✅ TODOs.md - 23 atomic tasks identified
✅ wireframes/ - 5 UI mockups created

📊 Planning Summary:

- Estimated Effort: 45-60 hours
- Implementation Phases: 4 phases
- Critical Dependencies: 3 identified
- Risk Level: Medium (database migration required)

🚀 Ready for Phase 2: Implementation
```text

### Planning Validation Example

```text
📋 TASK ATOMICITY VALIDATION

Phase 1: Database Layer (8 tasks)
✅ T-001: Create User schema (1h)
✅ T-002: Create UserRole schema (1h)
✅ T-003: Add authentication fields (1.5h)
❌ T-004: Implement user management service (4h) → TOO LARGE

Breaking down T-004:
✅ T-004a: Create UserService base structure (1h)
✅ T-004b: Implement user creation method (1.5h)
✅ T-004c: Implement user authentication (2h)
✅ T-004d: Add role management methods (1.5h)

Re-validation: All tasks now ≤ 2 hours ✅
```text

---

## Agent Coordination

### Sequence of Agent Invocations

1. **`product-functional`**: Requirements analysis and PDR creation
2. **`ui-ux-designer`**: Interface design and user experience
3. **`product-technical`**: Technical architecture and analysis
4. **`product-technical`**: Task breakdown and planning
5. **`tech-lead`**: Final review and approval

### Inter-Agent Dependencies

- UI/UX design depends on functional requirements
- Technical analysis depends on UI requirements
- Task breakdown depends on technical analysis
- Final review depends on all previous outputs

---

## Common Planning Patterns

### Database-Heavy Features

- Schema design comes first
- Migration strategy defined
- Data seeding requirements identified
- Performance considerations documented

### API-Heavy Features

- Endpoint design prioritized
- Authentication requirements clarified
- Rate limiting and caching planned
- Documentation strategy defined

### UI-Heavy Features

- Component hierarchy designed
- State management approach planned
- Responsive design strategy defined
- Accessibility requirements documented

---

## Related Commands

- `/start-refactor-plan` - Planning for refactoring work
- `/quality-check` - Validation before implementation
- `/add-new-entity` - Specific pattern for entity creation

---

## When to Use

- **Required**: Before implementing any new feature
- **Required**: When starting significant functionality
- **Optional**: For complex bug fixes requiring architectural changes
- **Recommended**: When multiple developers will work on the feature

---

## Prerequisites

- Feature requirements gathering complete
- Stakeholder alignment on feature scope
- Technical constraints understood
- Planning session time allocated (2-4 hours)

---

## Post-Command Actions

1. **Review Planning Artifacts**: Validate completeness and clarity
2. **Stakeholder Sign-off**: Get approval from product and technical leads
3. **Environment Setup**: Prepare development environment
4. **Begin Implementation**: Start Phase 2 with first atomic task

---

## Integration with Workflow

**Phase 1 (Planning)** → `/start-feature-plan` → Complete planning artifacts

**Phase 2 (Implementation)** → Follow TODOs.md task list

**Phase 3 (Validation)** → `/quality-check` validation

**Phase 4 (Finalization)** → Documentation and delivery


---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
