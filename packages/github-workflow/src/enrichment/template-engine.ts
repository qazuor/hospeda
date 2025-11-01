/**
 * Template engine for GitHub issue generation
 *
 * Generates markdown templates for GitHub issues based on planning context.
 * Supports different issue types (feature, task, bug) with appropriate formatting.
 *
 * @module enrichment/template-engine
 */

export type { PlanningContext, UserStory, TaskInfo } from './context-extractor.js';

import type { PlanningContext, TaskInfo } from './context-extractor.js';

/**
 * Template generation options
 */
export type TemplateOptions = {
    /** Issue type */
    type: 'feature' | 'task' | 'bug';
    /** Planning context */
    context: PlanningContext;
    /** Task code for task-type issues */
    taskCode?: string;
    /** Path to planning session */
    sessionPath?: string;
};

/**
 * Generated template with metadata
 */
export type GeneratedTemplate = {
    /** Issue title */
    title: string;
    /** Issue body (markdown) */
    body: string;
    /** Suggested labels */
    labels: string[];
};

/**
 * Template generation result
 */
export type GenerateTemplateResult = {
    /** Whether generation was successful */
    success: boolean;
    /** Generated template if successful */
    template?: GeneratedTemplate;
    /** Error message if failed */
    error?: string;
};

/**
 * Generate GitHub issue template from planning context
 *
 * Creates formatted markdown template suitable for GitHub issues,
 * including planning context, requirements, and technical details.
 *
 * @param input - Template generation options
 * @returns Generation result with template or error
 *
 * @example
 * ```typescript
 * const result = generateIssueTemplate({
 *   type: 'feature',
 *   context: planningContext,
 *   sessionPath: '.claude/sessions/planning/P-001-feature'
 * });
 *
 * if (result.success && result.template) {
 *   console.log('Title:', result.template.title);
 *   console.log('Body:', result.template.body);
 * }
 * ```
 */
export function generateIssueTemplate(input: TemplateOptions): GenerateTemplateResult {
    const { type, context, taskCode, sessionPath } = input;

    try {
        if (type === 'task') {
            if (!taskCode) {
                return {
                    success: false,
                    error: 'Task code is required for task-type issues'
                };
            }

            const task = findTask(context.tasks ?? [], taskCode);
            if (!task) {
                return {
                    success: false,
                    error: `Task ${taskCode} not found in planning context`
                };
            }

            return {
                success: true,
                template: generateTaskTemplate(context, task, sessionPath)
            };
        }

        return {
            success: true,
            template: generateFeatureTemplate(context, sessionPath)
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to generate template: ${(error as Error).message}`
        };
    }
}

/**
 * Generate feature-type template
 */
function generateFeatureTemplate(
    context: PlanningContext,
    sessionPath?: string
): GeneratedTemplate {
    const sections: string[] = [];

    // Header with session link
    sections.push(
        `**Planning Session**: [${context.sessionId}: ${context.title}](${sessionPath || '#'})`
    );
    sections.push('');

    // Goals section
    if (context.goals && context.goals.length > 0) {
        sections.push('## Goals');
        sections.push('');
        for (const goal of context.goals) {
            sections.push(`- ${goal}`);
        }
        sections.push('');
    }

    // User Stories section
    if (context.userStories && context.userStories.length > 0) {
        sections.push('## User Stories');
        sections.push('');
        for (const story of context.userStories) {
            sections.push(`### As a ${story.role}`);
            sections.push('');
            sections.push(`**I want** ${story.action}`);
            sections.push(`**So that** ${story.benefit}`);
            sections.push('');
        }
    }

    // Acceptance Criteria
    if (context.acceptanceCriteria && context.acceptanceCriteria.length > 0) {
        sections.push('## Acceptance Criteria');
        sections.push('');
        for (const criteria of context.acceptanceCriteria) {
            sections.push(`- [ ] ${criteria}`);
        }
        sections.push('');
    }

    // Technical Details
    if (context.architecture || context.dependencies) {
        sections.push('## Technical Details');
        sections.push('');

        if (context.architecture) {
            sections.push(context.architecture);
            sections.push('');
        }

        if (context.dependencies && context.dependencies.length > 0) {
            sections.push('**Dependencies:**');
            for (const dep of context.dependencies) {
                sections.push(`- ${dep}`);
            }
            sections.push('');
        }
    }

    // Risks
    if (context.risks && context.risks.length > 0) {
        sections.push('## Risks');
        sections.push('');
        for (const risk of context.risks) {
            sections.push(`- ${risk}`);
        }
        sections.push('');
    }

    return {
        title: context.title,
        body: sections.join('\n'),
        labels: ['feature', 'planning']
    };
}

/**
 * Generate task-type template
 */
function generateTaskTemplate(
    context: PlanningContext,
    task: TaskInfo,
    sessionPath?: string
): GeneratedTemplate {
    const sections: string[] = [];

    // Header
    sections.push(`**Planning Session**: [${context.sessionId}](${sessionPath || '#'})`);
    sections.push(`**Task Code**: ${task.id}`);
    if (task.estimate) {
        sections.push(`**Estimate**: ${task.estimate}`);
    }
    sections.push('');

    // Description
    if (task.description) {
        sections.push('## Description');
        sections.push('');
        sections.push(task.description);
        sections.push('');
    }

    // Dependencies
    if (task.dependencies && task.dependencies.length > 0) {
        sections.push('## Dependencies');
        sections.push('');
        for (const dep of task.dependencies) {
            sections.push(`- ${dep}`);
        }
        sections.push('');
    }

    return {
        title: task.title,
        body: sections.join('\n'),
        labels: ['task', ...(task.labels ?? [])]
    };
}

/**
 * Find task by code in task list
 */
function findTask(tasks: TaskInfo[], taskCode: string): TaskInfo | undefined {
    return tasks.find((t) => t.id === taskCode);
}
