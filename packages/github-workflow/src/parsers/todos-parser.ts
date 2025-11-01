/**
 * TODOs.md parser for planning sessions
 *
 * Parses task lists from TODOs.md files, supporting:
 * - Multiple task statuses (pending, in_progress, completed)
 * - Metadata extraction (assignee, estimate, phase, GitHub links)
 * - 3-level hierarchy (parent → sub → sub-sub)
 * - Task code generation
 *
 * @module parsers/todos-parser
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Task, TaskStatus } from './types';

/**
 * Regular expression patterns for parsing TODOs
 */
const PATTERNS = {
    /** Task item with checkbox and title */
    TASK_ITEM: /^(\s*)- \[([ ~x])\]\s+(.+)$/,
    /** Description line (starts with >) */
    DESCRIPTION_LINE: /^\s*>\s+/,
    /** GitHub issue link */
    GITHUB_LINK: /^\s*>\s+\*\*GitHub:\*\*/,
    /** GitHub issue number */
    GITHUB_NUMBER: /#(\d+)/,
    /** Metadata markers */
    METADATA: {
        ASSIGNEE: /^\*\*Assignee:\*\*/,
        ESTIMATE: /^\*\*Estimate:\*\*/,
        PHASE: /^\*\*Phase:\*\*/,
        GITHUB: /^\*\*GitHub:\*\*/
    }
} as const;

/**
 * Configuration constants
 */
const CONFIG = {
    /** Spaces per indentation level */
    SPACES_PER_LEVEL: 2,
    /** Maximum nesting level supported */
    MAX_LEVEL: 2
} as const;

/**
 * Parse TODOs.md file to extract tasks
 *
 * @param sessionPath - Path to planning session directory
 * @param planningCode - Planning code (e.g., P-003) for task code generation
 * @returns Array of top-level tasks with nested subtasks
 * @throws {Error} If TODOs.md not found
 *
 * @example
 * ```typescript
 * const tasks = await parseTodos('.claude/sessions/planning/P-003-feature', 'P-003');
 * console.log(tasks[0].code); // "T-003-001"
 * console.log(tasks[0].subtasks?.[0].code); // "T-003-002"
 * ```
 */
export async function parseTodos(sessionPath: string, planningCode: string): Promise<Task[]> {
    const todosPath = path.join(sessionPath, 'TODOs.md');

    try {
        const content = await fs.readFile(todosPath, 'utf-8');
        const lines = content.split('\n');

        const flatTasks = parseTaskLines(lines, planningCode);
        return buildHierarchy(flatTasks);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`TODOs.md not found in ${sessionPath}`);
        }
        throw error;
    }
}

/**
 * Parse task lines from TODOs.md content
 *
 * @param lines - Lines from TODOs.md file
 * @param planningCode - Planning code for task codes
 * @returns Flat array of tasks
 */
function parseTaskLines(lines: string[], planningCode: string): Task[] {
    const tasks: Task[] = [];
    let taskCounter = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const taskMatch = line.match(PATTERNS.TASK_ITEM);

        if (!taskMatch) continue;

        const indent = taskMatch[1] ?? '';
        const statusChar = taskMatch[2] ?? ' ';
        const title = taskMatch[3] ?? '';
        const level = Math.floor(indent.length / CONFIG.SPACES_PER_LEVEL);

        taskCounter++;
        const taskId = `task-${String(taskCounter).padStart(3, '0')}`;
        const codeNumber = planningCode.replace('P-', '');
        const taskCode = `T-${codeNumber}-${String(taskCounter).padStart(3, '0')}`;

        const task: Task = {
            id: taskId,
            code: taskCode,
            title: title.trim(),
            status: parseStatus(statusChar),
            level,
            lineNumber: i + 1,
            subtasks: level < CONFIG.MAX_LEVEL ? [] : undefined // Only parent and sub-level can have children
        };

        // Extract description and metadata from following lines
        const metadata = extractMetadata(lines, i + 1, level);
        Object.assign(task, metadata);

        tasks.push(task);
    }

    return tasks;
}

/**
 * Parse status character to TaskStatus
 *
 * @param char - Status character from checkbox
 * @returns Task status
 */
function parseStatus(char: string): TaskStatus {
    switch (char) {
        case ' ':
            return 'pending';
        case '~':
            return 'in_progress';
        case 'x':
            return 'completed';
        default:
            return 'pending';
    }
}

/**
 * Extract metadata from description lines following a task
 *
 * Looks for lines starting with `>` and extracts:
 * - Description (plain text lines)
 * - **Assignee:** metadata
 * - **Estimate:** metadata
 * - **Phase:** metadata
 * - **GitHub:** metadata
 *
 * @param lines - All lines from file
 * @param startIndex - Index to start searching from
 * @param taskLevel - Level of the task (for indentation check)
 * @returns Object with extracted metadata
 */
function extractMetadata(
    lines: string[],
    startIndex: number,
    taskLevel: number
): Partial<Pick<Task, 'description' | 'assignee' | 'estimate' | 'phase' | 'githubIssue'>> {
    const description: string[] = [];
    let assignee: string | undefined;
    let estimate: string | undefined;
    let phase: number | undefined;
    let githubIssue: Task['githubIssue'] | undefined;

    let j = startIndex;
    while (j < lines.length) {
        const nextLine = lines[j];
        if (!nextLine) {
            j++;
            continue;
        }

        // Stop if we hit another task at same or higher level
        if (nextLine.match(PATTERNS.TASK_ITEM)) {
            const nextIndent = nextLine.match(/^(\s*)/)?.[1] ?? '';
            const nextLevel = Math.floor(nextIndent.length / CONFIG.SPACES_PER_LEVEL);
            if (nextLevel <= taskLevel) break;
        }

        // Extract description lines (starting with >)
        if (nextLine.match(PATTERNS.DESCRIPTION_LINE)) {
            const descLine = nextLine.replace(PATTERNS.DESCRIPTION_LINE, '').trim();

            // Check for metadata markers
            if (PATTERNS.METADATA.ASSIGNEE.test(descLine)) {
                assignee = descLine.replace(PATTERNS.METADATA.ASSIGNEE, '').trim();
            } else if (PATTERNS.METADATA.ESTIMATE.test(descLine)) {
                estimate = descLine.replace(PATTERNS.METADATA.ESTIMATE, '').trim();
            } else if (PATTERNS.METADATA.PHASE.test(descLine)) {
                const phaseStr = descLine.replace(PATTERNS.METADATA.PHASE, '').trim();
                phase = Number.parseInt(phaseStr, 10);
            } else if (PATTERNS.METADATA.GITHUB.test(descLine)) {
                const issueMatch = descLine.match(PATTERNS.GITHUB_NUMBER);
                if (issueMatch?.[1]) {
                    githubIssue = {
                        number: Number.parseInt(issueMatch[1], 10),
                        url: `https://github.com/org/repo/issues/${issueMatch[1]}`
                    };
                }
            } else {
                description.push(descLine);
            }
        }

        j++;
    }

    return {
        description: description.length > 0 ? description.join('\n') : undefined,
        assignee,
        estimate,
        phase,
        githubIssue
    };
}

/**
 * Build task hierarchy from flat list
 *
 * Organizes tasks into parent → sub → sub-sub structure based on level.
 *
 * @param tasks - Flat array of tasks with level information
 * @returns Array of top-level tasks with nested subtasks
 */
function buildHierarchy(tasks: Task[]): Task[] {
    const result: Task[] = [];
    const stack: Task[] = [];

    for (const task of tasks) {
        // Remove tasks with higher or equal level from stack
        while (stack.length > 0) {
            const lastTask = stack[stack.length - 1];
            if (!lastTask || lastTask.level < task.level) break;
            stack.pop();
        }

        if (stack.length === 0) {
            // Top-level task
            result.push(task);
        } else {
            // Add as subtask to parent
            const parent = stack[stack.length - 1];
            if (parent) {
                if (!parent.subtasks) {
                    parent.subtasks = [];
                }
                parent.subtasks.push(task);
            }
        }

        stack.push(task);
    }

    return result;
}

/**
 * Update TODOs.md with GitHub issue links
 *
 * Inserts or updates `> **GitHub:** #XXX` lines for tasks that have
 * GitHub issues assigned.
 *
 * @param sessionPath - Path to planning session directory
 * @param tasks - Tasks with GitHub issue information
 * @throws {Error} If TODOs.md not found or write fails
 *
 * @example
 * ```typescript
 * const tasks = await parseTodos(sessionPath, 'P-003');
 * tasks[0].githubIssue = { number: 123, url: '...' };
 * await updateTodosWithLinks(sessionPath, tasks);
 * // TODOs.md now contains: > **GitHub:** #123
 * ```
 */
export async function updateTodosWithLinks(sessionPath: string, tasks: Task[]): Promise<void> {
    const todosPath = path.join(sessionPath, 'TODOs.md');
    const content = await fs.readFile(todosPath, 'utf-8');
    const lines = content.split('\n');

    // Flatten tasks for easier processing
    const flatTasks = flattenTasks(tasks);

    for (const task of flatTasks) {
        if (!task.githubIssue) continue;

        const lineIndex = task.lineNumber - 1;
        const taskLine = lines[lineIndex];
        if (!taskLine) continue;

        const indent = taskLine.match(/^(\s*)/)?.[1] ?? '';

        // Find existing GitHub link
        let githubLineIndex = lineIndex + 1;
        let foundGithubLine = false;

        while (githubLineIndex < lines.length) {
            const line = lines[githubLineIndex];
            if (!line) {
                githubLineIndex++;
                continue;
            }

            // Check if this line is a GitHub link
            if (line.match(PATTERNS.GITHUB_LINK)) {
                // Update existing link
                lines[githubLineIndex] = `${indent}  > **GitHub:** #${task.githubIssue.number}`;
                foundGithubLine = true;
                break;
            }

            // Stop if we hit next task
            if (line.match(PATTERNS.TASK_ITEM)) {
                break;
            }

            githubLineIndex++;
        }

        // Insert new GitHub line if not found
        if (!foundGithubLine) {
            lines.splice(lineIndex + 1, 0, `${indent}  > **GitHub:** #${task.githubIssue.number}`);
        }
    }

    await fs.writeFile(todosPath, lines.join('\n'), 'utf-8');
}

/**
 * Flatten task hierarchy to array
 *
 * @param tasks - Hierarchical tasks
 * @returns Flat array of all tasks
 */
function flattenTasks(tasks: Task[]): Task[] {
    const result: Task[] = [];

    for (const task of tasks) {
        result.push(task);
        if (task.subtasks) {
            result.push(...flattenTasks(task.subtasks));
        }
    }

    return result;
}
