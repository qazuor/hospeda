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

## ⚠️ CRITICAL: Agent Delegation Policy

**🚫 NEVER DO THE WORK YOURSELF**

Before starting ANY planning work, the coordinating agent MUST:

1. **Analyze Requirements**: Understand what the feature needs
2. **Identify Required Agents**: Determine which specialized agents are needed
3. **Use Task Tool**: ALWAYS delegate to specialized agents using Task tool
4. **Never Assume**: NEVER assume you (Claude/coordinating agent) can do it directly

**Required Agents for Planning:**

- **`product-functional`** - MUST create PDR.md (user stories, acceptance criteria)
- **`ui-ux-designer`** - MAY create mockups/wireframes (if UI-heavy feature)
- **`product-technical`** - MUST create tech-analysis.md (architecture, DB, APIs)
- **`product-technical`** - MUST create TODOs.md (task breakdown)
- **`tech-lead`** - MUST do final review and approval

**Example Agent Selection:**

```text
Feature: User Authentication System

Required Agents:
✅ product-functional (PDR with auth requirements)
✅ ui-ux-designer (Login/signup mockups)
✅ product-technical (Auth architecture, JWT, DB schema)
✅ product-technical (Task breakdown)
✅ tech-lead (Final review)

Starting with Step 1: Initialize Context...
```

**❌ ANTI-PATTERN - DO NOT DO THIS:**

```text
"I'll create the PDR myself since I understand the requirements..."
"Let me write the tech-analysis directly..."
"I can break down the tasks without the product-technical agent..."
```

**✅ CORRECT PATTERN:**

```text
"I will use Task tool to invoke product-functional agent to create PDR.md"
"I will use Task tool to invoke product-technical agent to create tech-analysis.md"
"I will use Task tool to invoke product-technical agent to create TODOs.md"
```

---

## Execution Flow

### Step 0: Analyze & Delegate

**Duration:** 2-3 minutes

**Objective:** Identify which specialized agents are needed for this feature

**Process:**

1. **Read Feature Request**: Understand what the user wants
2. **Analyze Complexity**: Assess scope and requirements
3. **List Required Agents**: Identify which agents will be invoked
4. **Present to User**: Show which agents will be used

**Output Example:**

```text
Feature Analysis: Multi-language Support

I will coordinate the following specialized agents for this planning session:

1. 🤖 product-functional - Create PDR with i18n requirements
2. 🎨 ui-ux-designer - Design language selector and locale-specific layouts
3. 🔧 product-technical - Design i18n architecture and translation system
4. 🔧 product-technical - Break down into atomic tasks
5. 👨‍💼 tech-lead - Final review and approval

Starting planning process...
```

**⚠️ IMPORTANT:** You (coordinating agent) will NOT create any documentation directly. You will ONLY orchestrate the specialized agents using the Task tool.

---

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

---

### Step 2: Product Requirements Analysis (PDR)

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

**🔴 MANDATORY USER INTERACTION CHECKPOINT 🔴**

**After PDR Generation:**

1. **Present PDR to user** with clear explanation of all sections
2. **Iterate with user** on any requested changes
3. **Refine and improve** based on feedback
4. **DO NOT proceed to next step** until user explicitly approves

**User Approval Required:**

```text
PDR Generation Complete!

I've created the Product Design Requirements document with:
- {n} user stories
- {n} acceptance criteria
- Mockups/wireframes
- Business rules and constraints

Please review the PDR.md file. I'm ready to:
- Clarify any section
- Add more details
- Modify requirements
- Answer questions

Once you approve this PDR, I'll proceed to technical analysis.

Do you approve this PDR or need changes? (approve/changes needed)
```

**Wait for User Response** - Do not generate tech-analysis.md until approved

---

### Step 3: UI/UX Design (Optional - during PDR phase)

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

**Note:** UI/UX work happens during PDR iteration phase, included in PDR approval

---

### Step 4: Technical Analysis

**Agent**: `product-technical`

**Process** (Only after PDR approval):

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

**🔴 MANDATORY USER INTERACTION CHECKPOINT 🔴**

**After Technical Analysis Generation:**

1. **Present tech-analysis.md to user** with clear explanations
2. **Discuss technical decisions** and alternatives
3. **Iterate based on feedback** and concerns
4. **DO NOT proceed to TODOs** until user explicitly approves

**User Approval Required:**

```text
Technical Analysis Complete!

I've documented the technical approach:
- Architecture design
- Database schema changes
- API endpoint design
- Technology stack decisions
- Risk analysis and mitigations

Please review the tech-analysis.md file. I'm ready to:
- Explain any technical decision
- Discuss alternative approaches
- Refine the architecture
- Address concerns

Once you approve this technical approach, I'll proceed to task breakdown.

Do you approve this technical analysis or need changes? (approve/changes needed)
```

**Wait for User Response** - Do not generate TODOs.md until approved

---

### Step 5: Task Breakdown

**Agent**: `product-technical` (Only after tech-analysis approval)

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

**User Review Recommended:**

```text
Task Breakdown Complete!

I've created {n} atomic tasks:
- All tasks are 1-2 hours each
- Dependencies mapped
- Priorities assigned
- Estimated total: {n} hours

Would you like to review the task breakdown before we proceed to Phase 2?
```

---

### Step 6: Final Planning Review

**Agent**: `tech-lead`

**Process** (Only after all approvals):

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

### Sequence of Agent Invocations (With User Checkpoints)

1. **`product-functional`**: Requirements analysis and PDR creation
   - **→ USER CHECKPOINT**: PDR review and approval required
   - **🛑 STOP HERE** until user approves

2. **`ui-ux-designer`**: Interface design and user experience (optional, during PDR phase)
   - Integrated into PDR approval process

3. **`product-technical`**: Technical architecture and analysis
   - **→ USER CHECKPOINT**: Tech analysis review and approval required
   - **🛑 STOP HERE** until user approves

4. **`product-technical`**: Task breakdown and planning
   - User review recommended (optional checkpoint)

5. **`tech-lead`**: Final review and approval

### Inter-Agent Dependencies

- UI/UX design depends on functional requirements (during PDR phase)
- **🔴 Technical analysis BLOCKED until PDR approval**
- **🔴 Task breakdown BLOCKED until tech-analysis approval**
- Final review depends on all previous outputs

### User Interaction Points

**Critical Interaction Point 1: After PDR**

- Agent presents PDR
- User reviews and provides feedback
- Agent iterates on changes
- User explicitly approves
- **Only then** proceed to technical analysis

**Critical Interaction Point 2: After Tech Analysis**

- Agent presents tech-analysis.md
- User reviews technical approach
- Agent discusses alternatives if needed
- User explicitly approves
- **Only then** proceed to task breakdown

**Optional Interaction Point 3: After TODOs**

- Agent presents task breakdown
- User can review if desired
- Proceed to Phase 2

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

### After PDR Generation (Step 2)

1. **Present PDR to user** with summary of key points
2. **Wait for user feedback** - do NOT proceed automatically
3. **Iterate on PDR** based on user requests
4. **Obtain explicit user approval** before continuing
5. **Only then generate tech-analysis.md**

### After Tech Analysis Generation (Step 4)

1. **Present tech-analysis.md to user** with architectural explanations
2. **Wait for user feedback** - do NOT proceed automatically
3. **Discuss and refine technical approach** based on feedback
4. **Obtain explicit user approval** before continuing
5. **Only then generate TODOs.md**

### After TODO Generation (Step 5)

1. **Present task breakdown** with estimates and priorities
2. **Offer user review** (optional)
3. **Address any concerns** about task scope or estimates
4. **Get final approval to proceed to Phase 2**
5. **Begin implementation**

### Key Principles

- **Never skip user checkpoints**
- **Always wait for explicit approval** at each gate
- **Iterate as many times as needed** until user is satisfied
- **User controls the pace** of planning progression

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
