/**
 * Issue template builder for GitHub issues
 *
 * Generates rich issue descriptions from planning tasks with metadata.
 *
 * @module sync/issue-builder
 */

import type { PlanningMetadata, Task } from '../parsers/types.js';

/**
 * Input for building issue title
 */
export type BuildIssueTitleInput = {
    /** Task to build title for */
    task: Task;
};

/**
 * Input for building issue body
 */
export type BuildIssueBodyInput = {
    /** Task to build body for */
    task: Task;

    /** Planning session metadata */
    metadata: PlanningMetadata;

    /** Path to planning session */
    sessionPath: string;
};

/**
 * Build GitHub issue title from task
 *
 * Format: `[TASK-CODE] Task Title`
 *
 * @param input - Title building input
 * @returns Formatted issue title
 *
 * @example
 * ```typescript
 * const title = buildIssueTitle({
 *   task: { code: 'T-003-001', title: 'Create auth', ... }
 * });
 * // Returns: "[T-003-001] Create auth"
 * ```
 */
export function buildIssueTitle(input: BuildIssueTitleInput): string {
    const { task } = input;
    return `[${task.code}] ${task.title}`;
}

/**
 * Build GitHub issue body from task and metadata
 *
 * Generates a rich markdown description with:
 * - Task overview
 * - Description
 * - Metadata (status, estimate, phase, assignee)
 * - Planning session context
 *
 * @param input - Body building input
 * @returns Formatted issue body in markdown
 *
 * @example
 * ```typescript
 * const body = buildIssueBody({
 *   task: { code: 'T-003-001', title: 'Create auth', ... },
 *   metadata: { planningCode: 'P-003', ... },
 *   sessionPath: '.claude/sessions/planning/P-003'
 * });
 * ```
 */
export function buildIssueBody(input: BuildIssueBodyInput): string {
    const { task, metadata, sessionPath } = input;

    const sections: string[] = [];

    // Task header
    sections.push(`## Task: ${task.title}\n`);

    // Overview section
    sections.push('**Planning Code:** ' + metadata.planningCode);
    sections.push('**Task Code:** ' + task.code);
    sections.push('**Feature:** ' + metadata.featureName + '\n');

    // Description section (if available)
    if (task.description) {
        sections.push('### Description');
        sections.push(task.description + '\n');
    }

    // Details section
    sections.push('### Details');
    sections.push('- **Status:** ' + task.status);
    sections.push('- **Estimate:** ' + (task.estimate || 'Not estimated'));
    sections.push('- **Phase:** ' + (task.phase ? String(task.phase) : 'Not specified'));
    sections.push(
        '- **Assignee:** ' + (task.assignee ? `@${task.assignee}` : 'Unassigned') + '\n'
    );

    // Planning session section
    sections.push('### Planning Session');
    sections.push('- **Summary:** ' + metadata.summary);
    sections.push('- **Session Path:** `' + sessionPath + '`\n');

    // Footer
    sections.push('---');
    sections.push('*Auto-generated from planning session by @repo/github-workflow*');

    return sections.join('\n');
}
