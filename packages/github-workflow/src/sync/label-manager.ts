/**
 * Label management for GitHub issues
 *
 * Generates and manages labels for GitHub issues based on task metadata.
 *
 * @module sync/label-manager
 */

import type { Task, TaskStatus } from '../parsers/types.js';

/**
 * Input for generating labels
 */
export type GenerateLabelsInput = {
    /** Task to generate labels for */
    task: Task;

    /** Planning code (e.g., P-003) */
    planningCode: string;
};

/**
 * Convert task status to label format
 *
 * @param status - Task status
 * @returns Status label
 */
function statusToLabel(status: TaskStatus): string {
    switch (status) {
        case 'pending':
            return 'status:pending';
        case 'in_progress':
            return 'status:in-progress';
        case 'completed':
            return 'status:completed';
    }
}

/**
 * Generate labels for a task based on metadata
 *
 * Generates labels according to strategy:
 * - Universal: `from:claude-code` (always)
 * - Status: `status:pending`, `status:in-progress`, `status:completed`
 * - Phase: `phase:1`, `phase:2`, etc. (if specified)
 * - Planning: `planning:P-003`
 * - Type: `type:task` (level 0), `type:subtask` (level > 0)
 *
 * @param input - Label generation input
 * @returns Array of label names
 *
 * @example
 * ```typescript
 * const labels = generateLabelsForTask({
 *   task: {
 *     code: 'T-003-001',
 *     status: 'pending',
 *     phase: 2,
 *     level: 0,
 *     ...
 *   },
 *   planningCode: 'P-003'
 * });
 * // Returns: ['from:claude-code', 'status:pending', 'phase:2', 'planning:P-003', 'type:task']
 * ```
 */
export function generateLabelsForTask(input: GenerateLabelsInput): string[] {
    const { task, planningCode } = input;
    const labels: string[] = [];

    // Universal label
    labels.push('from:claude-code');

    // Status label
    labels.push(statusToLabel(task.status));

    // Phase label (if specified)
    if (task.phase !== undefined) {
        labels.push(`phase:${task.phase}`);
    }

    // Planning label
    labels.push(`planning:${planningCode}`);

    // Type label based on level
    if (task.level === 0) {
        labels.push('type:task');
    } else {
        labels.push('type:subtask');
    }

    return labels;
}
