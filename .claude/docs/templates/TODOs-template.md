# TODO List: {Feature Name}

**Related Documents:**

- [PDR (Product Design Requirements)](./PDR.md)
- [Technical Analysis](./tech-analysis.md)

**Feature Status**: Not Started | In Progress | In Review | Completed
**Start Date**: YYYY-MM-DD
**Target Date**: YYYY-MM-DD
**Actual Completion**: YYYY-MM-DD

---

## Progress Summary

**Overall Progress**: {X}% complete

| Priority | Total | Completed | In Progress | Not Started |
|----------|-------|-----------|-------------|-------------|
| P0 | {n} | {n} | {n} | {n} |
| P1 | {n} | {n} | {n} | {n} |
| P2 | {n} | {n} | {n} | {n} |
| P3 | {n} | {n} | {n} | {n} |
| **Total** | **{n}** | **{n}** | **{n}** | **{n}** |

**Velocity**: {X} tasks per day (average)

---

## Phase 1: Planning ✅ Completed

### ✅ Planning Tasks

- [x] **[2h]** Create PDR.md with user stories and acceptance criteria
  - Completed: YYYY-MM-DD by {Name}
  - Notes: {Any relevant notes}

- [x] **[1.5h]** Create mockups and wireframes
  - Completed: YYYY-MM-DD by {Name}
  - Notes: {Any relevant notes}

- [x] **[3h]** Create technical analysis document
  - Completed: YYYY-MM-DD by {Name}
  - Notes: {Any relevant notes}

- [x] **[2h]** Break down into atomic tasks
  - Completed: YYYY-MM-DD by {Name}
  - Notes: {Any relevant notes}

---

## Phase 2: Implementation 🔄 In Progress

### P0 - Critical (Must Have)

#### Database Layer

- [ ] **[0.5h]** Define Zod schemas for {entity}
  - **Dependencies**: None
  - **Assignee**: @db-engineer
  - **Status**: Not Started | In Progress | Blocked | Complete
  - **Blockers**: {Any blockers}
  - **Notes**: {Notes}

- [ ] **[0.5h]** Infer types from Zod schemas using `z.infer`
  - **Dependencies**: Task above
  - **Assignee**: @db-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Create Drizzle schema for {entity}
  - **Dependencies**: Zod schemas complete
  - **Assignee**: @db-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Create {Entity}Model extending BaseModel
  - **Dependencies**: Drizzle schema complete
  - **Assignee**: @db-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Override findAll() for custom search (if needed)
  - **Dependencies**: Model created
  - **Assignee**: @db-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[1h]** Write unit tests for model
  - **Dependencies**: Model complete
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Notes**: Target 90%+ coverage

- [ ] **[0.5h]** Generate and apply database migration
  - **Dependencies**: Schema complete, tests passing
  - **Assignee**: @db-engineer
  - **Status**: Not Started
  - **Notes**: Test rollback script

#### Service Layer

- [ ] **[1h]** Create {Entity}Service extending BaseCrudService
  - **Dependencies**: Model complete
  - **Assignee**: @backend-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[1h]** Implement custom business logic methods
  - **Dependencies**: Service structure created
  - **Assignee**: @backend-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Add business validation rules
  - **Dependencies**: Methods implemented
  - **Assignee**: @backend-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[1.5h]** Write unit tests for service
  - **Dependencies**: Service complete
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Notes**: Test all business logic paths

#### API Layer

- [ ] **[0.5h]** Create route file structure
  - **Dependencies**: Service complete
  - **Assignee**: @hono-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Implement routes using factory pattern
  - **Dependencies**: Route structure
  - **Assignee**: @hono-engineer
  - **Status**: Not Started
  - **Notes**: Use createCRUDRoute or createListRoute

- [ ] **[0.5h]** Add authentication middleware
  - **Dependencies**: Routes created
  - **Assignee**: @hono-engineer
  - **Status**: Not Started
  - **Notes**: Check permissions: {list permissions}

- [ ] **[0.5h]** Add custom route handlers (if needed)
  - **Dependencies**: Factory routes complete
  - **Assignee**: @hono-engineer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[1h]** Write integration tests for API
  - **Dependencies**: API routes complete
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Notes**: Test auth, validation, error handling

#### Frontend Layer (Web App)

- [ ] **[1h]** Create {Feature}Form component
  - **Dependencies**: API ready
  - **Assignee**: @react-dev
  - **Status**: Not Started
  - **Notes**: Use TanStack Form

- [ ] **[0.5h]** Implement client-side validation
  - **Dependencies**: Form component
  - **Assignee**: @react-dev
  - **Status**: Not Started
  - **Notes**: Use Zod schemas

- [ ] **[1h]** Create {Feature}List component
  - **Dependencies**: API ready
  - **Assignee**: @react-dev
  - **Status**: Not Started
  - **Notes**: Pagination, sorting

- [ ] **[0.5h]** Create {Feature}Card component
  - **Dependencies**: None
  - **Assignee**: @react-dev
  - **Status**: Not Started
  - **Notes**: Reusable display component

- [ ] **[1h]** Create {Feature}Detail component
  - **Dependencies**: API ready
  - **Assignee**: @react-dev
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[1h]** Setup TanStack Query hooks
  - **Dependencies**: Components created
  - **Assignee**: @tanstack-engineer
  - **Status**: Not Started
  - **Notes**: Queries, mutations, cache keys

- [ ] **[0.5h]** Implement error handling and loading states
  - **Dependencies**: Query hooks
  - **Assignee**: @react-dev
  - **Status**: Not Started
  - **Notes**: User-friendly errors

- [ ] **[1h]** Create Astro pages
  - **Dependencies**: Components ready
  - **Assignee**: @astro-engineer
  - **Status**: Not Started
  - **Notes**: index.astro, [id].astro, new.astro

- [ ] **[0.5h]** Setup routing and islands
  - **Dependencies**: Pages created
  - **Assignee**: @astro-engineer
  - **Status**: Not Started
  - **Notes**: Hydrate only interactive components

- [ ] **[1h]** Write component tests
  - **Dependencies**: Components complete
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Notes**: Test user interactions

#### Frontend Layer (Admin App) - if applicable

- [ ] **[1h]** Create admin {Feature} pages
  - **Dependencies**: API ready
  - **Assignee**: @tanstack-engineer
  - **Status**: Not Started
  - **Notes**: TanStack Start routes

- [ ] **[1h]** Implement admin components
  - **Dependencies**: Routes created
  - **Assignee**: @react-dev
  - **Status**: Not Started
  - **Notes**: {Notes}

---

### P1 - High (Should Have)

- [ ] **[1h]** Implement {additional feature}
  - **Dependencies**: {list dependencies}
  - **Assignee**: @{agent}
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Add {optimization}
  - **Dependencies**: {list dependencies}
  - **Assignee**: @{agent}
  - **Status**: Not Started
  - **Notes**: {Notes}

---

### P2 - Medium (Nice to Have)

- [ ] **[1h]** Implement {enhancement}
  - **Dependencies**: {list dependencies}
  - **Assignee**: @{agent}
  - **Status**: Not Started
  - **Notes**: {Notes}

---

### P3 - Low (Could Have)

- [ ] **[0.5h]** Add {minor feature}
  - **Dependencies**: {list dependencies}
  - **Assignee**: @{agent}
  - **Status**: Not Started
  - **Notes**: Can be deferred

---

## Phase 3: Validation 🔲 Not Started

### Quality Assurance

- [ ] **[1h]** Run QA validation with `qa-criteria-validator`
  - **Dependencies**: Implementation complete
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Notes**: Validate against PDR acceptance criteria

- [ ] **[0.5h]** Fix issues from QA feedback
  - **Dependencies**: QA validation complete
  - **Assignee**: @{responsible-agent}
  - **Status**: Not Started
  - **Notes**: {Notes}

### Code Quality

- [ ] **[0.5h]** Run `/code-check` (lint + typecheck)
  - **Dependencies**: Implementation complete
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Notes**: Must pass before proceeding

- [ ] **[0.5h]** Run `/run-tests` with coverage
  - **Dependencies**: Code check passing
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Notes**: Ensure 90%+ coverage

### Code Review

- [ ] **[1h]** Backend code review
  - **Dependencies**: Tests passing
  - **Assignee**: @backend-reviewer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[1h]** Frontend code review
  - **Dependencies**: Tests passing
  - **Assignee**: @frontend-reviewer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Architecture consistency validation
  - **Dependencies**: Code reviews complete
  - **Assignee**: @architecture-validator
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Tech lead global review
  - **Dependencies**: All reviews complete
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Notes**: Integration and consistency check

### Security & Performance

- [ ] **[1h]** Security review
  - **Dependencies**: Code reviews complete
  - **Assignee**: @security-engineer
  - **Status**: Not Started
  - **Notes**: Check auth, validation, XSS, SQL injection

- [ ] **[1h]** Performance review
  - **Dependencies**: Implementation complete
  - **Assignee**: @performance-engineer
  - **Status**: Not Started
  - **Notes**: Bundle size, query performance, Core Web Vitals

- [ ] **[0.5h]** Accessibility validation (WCAG AA)
  - **Dependencies**: UI complete
  - **Assignee**: @accessibility-engineer
  - **Status**: Not Started
  - **Notes**: Keyboard nav, screen readers, contrast

### Final Quality Check

- [ ] **[0.5h]** Run `/quality-check` command
  - **Dependencies**: All previous checks complete
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Notes**: Consolidated report of all quality checks

---

## Phase 4: Finalization 🔲 Not Started

### Documentation

- [ ] **[1h]** Update API documentation (OpenAPI)
  - **Dependencies**: API complete
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Create component usage guide
  - **Dependencies**: Components complete
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Document architecture decisions
  - **Dependencies**: Implementation complete
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Notes**: If significant architectural changes

- [ ] **[0.5h]** Update README files
  - **Dependencies**: Documentation complete
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Notes**: {Notes}

- [ ] **[0.5h]** Generate diagrams
  - **Dependencies**: Documentation written
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Notes**: Architecture, flows, ERD

### Git & Deployment

- [ ] **[0.5h]** Generate commit messages with `/commit`
  - **Dependencies**: All work complete
  - **Assignee**: @main-agent
  - **Status**: Not Started
  - **Notes**: Follow conventional commits

- [ ] **[Manual]** User reviews and approves commits
  - **Dependencies**: Commits generated
  - **Assignee**: User
  - **Status**: Not Started
  - **Notes**: User stages and commits manually

- [ ] **[Manual]** User creates PR
  - **Dependencies**: Commits pushed
  - **Assignee**: User
  - **Status**: Not Started
  - **Notes**: {Notes}

---

## Blockers & Issues

### Active Blockers

| Task | Blocker | Impact | Resolution | Owner |
|------|---------|--------|------------|-------|
| {Task} | {What's blocking} | High/Med/Low | {How to resolve} | {Who} |

### Resolved Blockers

| Task | Was Blocked By | Resolution | Resolved Date |
|------|----------------|------------|---------------|
| {Task} | {What blocked it} | {How resolved} | YYYY-MM-DD |

---

## Notes & Decisions

### Implementation Notes

**YYYY-MM-DD**:

- {Note about implementation decision}
- {Note about approach taken}

**YYYY-MM-DD**:

- {Note about issue encountered}
- {Note about solution}

### Technical Decisions

**Decision 1**: {Decision made}

- **Rationale**: {Why}
- **Alternatives**: {What else was considered}
- **Date**: YYYY-MM-DD

**Decision 2**: {Decision made}

- **Rationale**: {Why}
- **Date**: YYYY-MM-DD

---

## Daily Progress Log

### YYYY-MM-DD

**Completed**:

- {Task completed}
- {Task completed}

**In Progress**:

- {Task being worked on}

**Blockers**:

- {Any blockers encountered}

**Next Steps**:

- {What's next}

---

### YYYY-MM-DD (Next Day)

{Continue with daily logs}

---

## Lessons Learned

**What Went Well**:

- {Positive point 1}
- {Positive point 2}

**What Could Be Improved**:

- {Improvement area 1}
- {Improvement area 2}

**Process Improvements**:

- {Process change to consider}
- {Tool or approach to adopt}

---

## Metrics

**Estimated Total Time**: {X} hours
**Actual Total Time**: {Y} hours
**Variance**: {Z} hours ({percentage}%)

**Estimated vs Actual by Phase**:

| Phase | Estimated | Actual | Variance |
|-------|-----------|--------|----------|
| Planning | {X}h | {Y}h | {Z}h |
| Implementation | {X}h | {Y}h | {Z}h |
| Validation | {X}h | {Y}h | {Z}h |
| Finalization | {X}h | {Y}h | {Z}h |

**Task Completion Rate**:

- Average time per task: {X} hours
- Tasks per day: {Y}
- Total days: {Z}

---

**Last Updated**: YYYY-MM-DD
**Status**: {In Progress | Completed}
**Next Review**: YYYY-MM-DD
