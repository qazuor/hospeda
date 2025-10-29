#!/usr/bin/env tsx
/**
 * Create Planning Session
 * Creates a new planning session with auto-generated P-XXX code
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';
import { getPlanningCode } from '../code-generator.js';

/**
 * Template for PDR.md
 */
const PDR_TEMPLATE = `# Product Design Requirements (PDR)

## Feature Overview

### Problem Statement

[Describe the problem this feature solves]

### Objectives

- [Objective 1]
- [Objective 2]
- [Objective 3]

### Success Metrics

- [Metric 1]
- [Metric 2]

---

## User Stories

### Story 1: [Title]

**As a** [persona]
**I want** [functionality]
**So that** [benefit]

#### Acceptance Criteria

- **AC-001**: [Specific, testable criterion]
- **AC-002**: [Specific, testable criterion]
- **AC-003**: [Specific, testable criterion]

---

## Business Rules

### Rule 1: [Title]

[Description of business rule]

### Rule 2: [Title]

[Description of business rule]

---

## Constraints

### Technical Constraints

- [Constraint 1]
- [Constraint 2]

### Business Constraints

- [Constraint 1]
- [Constraint 2]

---

## Dependencies

### External Dependencies

- [Dependency 1]
- [Dependency 2]

### Internal Dependencies

- [Dependency 1]
- [Dependency 2]

---

## Risks and Mitigations

### Risk 1: [Title]

**Risk**: [Description]
**Impact**: [High/Medium/Low]
**Mitigation**: [Strategy]

### Risk 2: [Title]

**Risk**: [Description]
**Impact**: [High/Medium/Low]
**Mitigation**: [Strategy]

---

## Related Documents

- [Link to tech-analysis.md](./tech-analysis.md)
- [Link to TODOs.md](./TODOs.md)

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| [YYYY-MM-DD] | [Name] | Initial version |
`;

/**
 * Template for tech-analysis.md
 */
const TECH_ANALYSIS_TEMPLATE = `# Technical Analysis

## Architecture Overview

### High-Level Design

[Describe the overall architecture approach]

### Component Diagram

\`\`\`
[Add ASCII diagram or link to external diagram]
\`\`\`

---

## Technology Stack

### Backend

- **Framework**: Hono
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **Additional**: [List any additional technologies]

### Frontend

- **Web**: Astro + React 19
- **Admin**: TanStack Start + React 19
- **Styling**: Tailwind CSS + Shadcn UI
- **State**: TanStack Query

---

## Database Design

### Schema Changes

#### New Tables

\`\`\`sql
-- Example table
CREATE TABLE example (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

#### Modified Tables

- **Table**: [table_name]
  - **Changes**: [Description]

### Relationships

- [Relationship description]

### Indexes

- [Index description and justification]

---

## API Design

### New Endpoints

#### POST /api/example

**Purpose**: [Description]

**Request**:
\`\`\`typescript
{
  field: string;
}
\`\`\`

**Response**:
\`\`\`typescript
{
  id: number;
  field: string;
}
\`\`\`

**Validation**: [Zod schema reference]

---

## Service Design

### New Services

#### ExampleService

**Purpose**: [Description]

**Methods**:
- \`create()\`: [Description]
- \`findById()\`: [Description]
- \`update()\`: [Description]
- \`delete()\`: [Description]

**Dependencies**: [List dependencies]

---

## Frontend Design

### Component Structure

\`\`\`
ExampleFeature/
├── ExampleList.tsx
├── ExampleDetail.tsx
├── ExampleForm.tsx
└── hooks/
    ├── useExample.ts
    └── useExampleMutation.ts
\`\`\`

### State Management

- **Query Keys**: [List query keys]
- **Mutations**: [List mutations]
- **Optimistic Updates**: [Strategy]

---

## Security Considerations

### Authentication

[Authentication approach]

### Authorization

[Authorization rules]

### Data Validation

[Validation strategy]

### Rate Limiting

[Rate limiting approach]

---

## Performance Considerations

### Database

- [Optimization 1]
- [Optimization 2]

### API

- [Caching strategy]
- [Pagination approach]

### Frontend

- [Loading strategy]
- [Code splitting]

---

## Testing Strategy

### Unit Tests

- [What to test]

### Integration Tests

- [What to test]

### E2E Tests

- [Critical paths]

---

## Technical Risks

### Risk 1: [Title]

**Description**: [Description]
**Impact**: [High/Medium/Low]
**Mitigation**: [Strategy]

### Risk 2: [Title]

**Description**: [Description]
**Impact**: [High/Medium/Low]
**Mitigation**: [Strategy]

---

## Implementation Phases

### Phase 1: Database Layer

[Description]

### Phase 2: Service Layer

[Description]

### Phase 3: API Layer

[Description]

### Phase 4: Frontend Layer

[Description]

---

## Related Documents

- [Link to PDR.md](./PDR.md)
- [Link to TODOs.md](./TODOs.md)

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| [YYYY-MM-DD] | [Name] | Initial version |
`;

/**
 * Template for TODOs.md
 */
const TODOS_TEMPLATE = `# Task Breakdown

## Summary

- **Total Tasks**: [X]
- **Estimated Effort**: [X-Y hours]
- **Implementation Phases**: [X]

---

## Phase 1: [Phase Name]

### Task Group: [Group Name]

- [ ] **[T-XXX-XXX]** [Task title]
  > [Task description]
  > **Estimate**: [X]h
  > **Dependencies**: [Task codes or "None"]

- [ ] **[T-XXX-XXX]** [Task title]
  > [Task description]
  > **Estimate**: [X]h
  > **Dependencies**: [Task codes or "None"]

---

## Phase 2: [Phase Name]

### Task Group: [Group Name]

- [ ] **[T-XXX-XXX]** [Task title]
  > [Task description]
  > **Estimate**: [X]h
  > **Dependencies**: [Task codes or "None"]

---

## Phase 3: [Phase Name]

### Task Group: [Group Name]

- [ ] **[T-XXX-XXX]** [Task title]
  > [Task description]
  > **Estimate**: [X]h
  > **Dependencies**: [Task codes or "None"]

---

## Notes

### Task Status Markers

- \`[ ]\` = Pending
- \`[~]\` = In Progress
- \`[x]\` = Completed

### Atomicity Rule

Each task should be **1-2 hours maximum**. If a task is larger, break it down further.

### Dependencies

List task codes that must be completed before this task can start.

---

## Related Documents

- [Link to PDR.md](./PDR.md)
- [Link to tech-analysis.md](./tech-analysis.md)
`;

/**
 * Converts feature name to kebab-case
 */
function toKebabCase(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Main function
 */
async function main() {
    // Load environment variables
    config({ path: resolve(process.cwd(), '../../', '.env') });
    config({ path: resolve(process.cwd(), '../../', '.env.local') });

    // Get feature name from arguments
    const featureName = process.argv[2];

    if (!featureName) {
        console.error('❌ Usage: pnpm planning:create <feature-name>');
        console.error('');
        console.error('Example:');
        console.error('  pnpm planning:create "User Authentication"');
        console.error('  pnpm planning:create "Payment Integration"');
        process.exit(1);
    }

    try {
        console.log('🚀 Creating new planning session...');
        console.log(`📝 Feature: ${featureName}`);
        console.log('');

        // Convert feature name to kebab-case
        const featureSlug = toKebabCase(featureName);

        // Get planning root directory
        const projectRoot = resolve(process.cwd(), '../../');
        const planningRoot = join(projectRoot, '.claude/sessions/planning');

        // Ensure planning root exists
        await fs.mkdir(planningRoot, { recursive: true });

        // Create temporary session path for code generation
        const tempSessionPath = join(planningRoot, featureSlug);

        // Generate planning code
        const planningCode = await getPlanningCode(tempSessionPath, featureName);

        console.log(`📊 Planning Code: ${planningCode}`);

        // Create final session directory with planning code prefix
        const sessionDir = join(planningRoot, `${planningCode}-${featureSlug}`);

        // Check if session already exists
        try {
            await fs.access(sessionDir);
            console.error(`❌ Planning session already exists: ${sessionDir}`);
            process.exit(1);
        } catch {
            // Directory doesn't exist, proceed
        }

        // Create session directory structure
        await fs.mkdir(sessionDir, { recursive: true });
        await fs.mkdir(join(sessionDir, 'wireframes'), { recursive: true });
        await fs.mkdir(join(sessionDir, 'notes'), { recursive: true });

        // Create template files
        await Promise.all([
            fs.writeFile(join(sessionDir, 'PDR.md'), PDR_TEMPLATE, 'utf-8'),
            fs.writeFile(join(sessionDir, 'tech-analysis.md'), TECH_ANALYSIS_TEMPLATE, 'utf-8'),
            fs.writeFile(join(sessionDir, 'TODOs.md'), TODOS_TEMPLATE, 'utf-8'),
            fs.writeFile(
                join(sessionDir, 'notes/research.md'),
                '# Research Notes\n\n[Add research findings here]\n',
                'utf-8'
            ),
            fs.writeFile(
                join(sessionDir, 'notes/alternatives.md'),
                '# Alternative Approaches\n\n[Document alternative solutions considered]\n',
                'utf-8'
            ),
            fs.writeFile(
                join(sessionDir, 'notes/decisions.md'),
                '# Technical Decisions\n\n[Record key technical decisions and rationale]\n',
                'utf-8'
            )
        ]);

        console.log('✅ Planning session created successfully!');
        console.log('');
        console.log('📁 Session Directory:');
        console.log(`   ${sessionDir}`);
        console.log('');
        console.log('📋 Created Files:');
        console.log('   ✓ PDR.md                  (Product Requirements)');
        console.log('   ✓ tech-analysis.md        (Technical Analysis)');
        console.log('   ✓ TODOs.md                (Task Breakdown)');
        console.log('   ✓ wireframes/             (UI/UX Assets)');
        console.log('   ✓ notes/research.md       (Research Notes)');
        console.log('   ✓ notes/alternatives.md   (Alternative Approaches)');
        console.log('   ✓ notes/decisions.md      (Technical Decisions)');
        console.log('');
        console.log('🎯 Next Steps:');
        console.log('   1. Fill out PDR.md with feature requirements');
        console.log('   2. Complete tech-analysis.md with technical design');
        console.log('   3. Break down tasks in TODOs.md');
        console.log('   4. Add wireframes to wireframes/ directory');
        console.log('   5. Run /sync-planning to sync with GitHub/Linear');
        console.log('');
        console.log(`💡 Session Path: .claude/sessions/planning/${planningCode}-${featureSlug}`);
    } catch (error) {
        console.error('❌ Failed to create planning session:', error);
        process.exit(1);
    }
}

main();
