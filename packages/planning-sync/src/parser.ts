/**
 * TODOs.md Parser
 * Parses planning session TODOs.md files into structured tasks
 */

import { createHash } from 'node:crypto';
import type { PlanningTask, TaskStatus } from './types.js';

/**
 * Parses a TODOs.md file and extracts tasks
 *
 * @param content - Raw markdown content from TODOs.md
 * @returns Array of parsed tasks
 *
 * @example
 * const content = await fs.readFile('TODOs.md', 'utf-8');
 * const tasks = parseTodosMarkdown(content);
 */
export function parseTodosMarkdown(content: string): PlanningTask[] {
    const tasks: PlanningTask[] = [];
    const lines = content.split('\n');

    let currentTask: Partial<PlanningTask> | null = null;
    let inDescriptionBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Match task items: - [ ] Task or - [x] Task or - [~] Task
        const taskMatch = line.match(/^-\s+\[([ x~])\]\s+(.+)$/);

        if (taskMatch?.[1] && taskMatch[2]) {
            // Save previous task if exists
            if (currentTask?.title) {
                tasks.push(finalizeTask(currentTask));
            }

            // Start new task
            const statusChar = taskMatch[1];
            const title = taskMatch[2].trim();

            currentTask = {
                title,
                status: parseStatus(statusChar),
                description: ''
            };
            inDescriptionBlock = false;
        } else if (currentTask && line.trim().startsWith('>')) {
            // Description line (blockquote)
            inDescriptionBlock = true;
            const descLine = line.trim().substring(1).trim();
            if (currentTask.description) {
                currentTask.description += `\n${descLine}`;
            } else {
                currentTask.description = descLine;
            }
        } else if (currentTask && inDescriptionBlock && line.trim() === '') {
            // Empty line ends description block
            inDescriptionBlock = false;
        }
    }

    // Don't forget the last task
    if (currentTask?.title) {
        tasks.push(finalizeTask(currentTask));
    }

    return tasks;
}

/**
 * Parses feature name from PDR.md content
 *
 * @param content - Raw markdown content from PDR.md
 * @returns Feature name extracted from first heading
 */
export function parseFeatureName(content: string): string {
    // Try to find first # heading
    const match = content.match(/^#\s+(.+)$/m);
    if (match?.[1]) {
        return match[1].trim();
    }

    // Fallback to "Unknown Feature"
    return 'Unknown Feature';
}

/**
 * Extracts summary from PDR.md (first paragraph after heading)
 *
 * @param content - Raw markdown content from PDR.md
 * @returns Summary text or empty string
 */
export function parsePdrSummary(content: string): string {
    const lines = content.split('\n');
    let foundHeading = false;
    let summary = '';

    for (const line of lines) {
        if (line.match(/^#\s+/)) {
            foundHeading = true;
            continue;
        }

        if (foundHeading && line.trim() !== '') {
            // Skip if this line is another heading
            if (line.match(/^#{1,6}\s+/)) {
                break; // Stop looking when we hit another heading
            }

            // First non-empty, non-heading line after main heading
            summary = line.trim();
            break;
        }
    }

    return summary;
}

/**
 * Converts status character to TaskStatus
 */
function parseStatus(char: string): TaskStatus {
    switch (char) {
        case 'x':
            return 'completed';
        case '~':
            return 'in_progress';
        default:
            return 'pending';
    }
}

/**
 * Finalizes a task by generating its ID
 *
 * Note: code will be assigned later by the sync process
 */
function finalizeTask(partial: Partial<PlanningTask>): PlanningTask {
    const title = partial.title || '';
    const id = generateTaskId(title);

    return {
        id,
        code: partial.code || '', // Will be assigned during sync
        title,
        status: partial.status || 'pending',
        description: partial.description?.trim() || undefined,
        linearIssueId: partial.linearIssueId,
        githubIssueNumber: partial.githubIssueNumber
    };
}

/**
 * Generates a stable ID for a task based on its title
 *
 * @param title - Task title
 * @returns Short hash ID
 */
function generateTaskId(title: string): string {
    const hash = createHash('sha256').update(title).digest('hex');
    return hash.substring(0, 8);
}

/**
 * Converts TaskStatus back to markdown checkbox format
 *
 * @param status - Task status
 * @returns Checkbox character
 */
export function statusToCheckbox(status: TaskStatus): string {
    switch (status) {
        case 'completed':
            return 'x';
        case 'in_progress':
            return '~';
        default:
            return ' ';
    }
}

/**
 * Updates a task status in TODOs.md content
 *
 * @param content - Original TODOs.md content
 * @param taskTitle - Title of task to update
 * @param newStatus - New status
 * @returns Updated content
 */
export function updateTaskStatus(
    content: string,
    taskTitle: string,
    newStatus: TaskStatus
): string {
    const checkbox = statusToCheckbox(newStatus);
    const escapedTitle = taskTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^(-\\s+\\[)[ x~](\\]\\s+${escapedTitle})$`, 'gm');

    return content.replace(regex, `$1${checkbox}$2`);
}
