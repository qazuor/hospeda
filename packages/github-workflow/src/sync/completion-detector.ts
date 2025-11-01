/**
 * Completion detection system
 *
 * Detects completed tasks by parsing git commit messages and automatically
 * updates TODOs.md and closes GitHub issues.
 *
 * @module sync/completion-detector
 */

import { execSync } from 'node:child_process';
import { logger } from '@repo/logger';
import { GitHubClient } from '../core/github-client.js';
import { parsePlanningSession } from '../parsers/planning-session.js';
import { updateTodosWithLinks } from '../parsers/todos-parser.js';
import type { Task } from '../parsers/types.js';
import { TrackingManager } from '../tracking/tracking-manager.js';
import type { CompletionDetectorOptions, CompletionResult, DetectedTask } from './types.js';

/**
 * Default tracking path
 */
const DEFAULT_TRACKING_PATH = '.todoLinear/tracking.json';

/**
 * Default number of commits to scan
 */
const DEFAULT_COMMIT_LIMIT = 10;

/**
 * Regex pattern for task codes
 * Matches: T-XXX-XXX, PB-XXX, TB-XXX
 */
const TASK_CODE_PATTERN = /\b([TP]B?-\d{3}(?:-\d{3})?)\b/gi;

/**
 * Detect completed tasks from git commits
 *
 * Main orchestrator that:
 * 1. Parses recent git commits for task codes
 * 2. Validates tasks exist and are not already completed
 * 3. Updates TODOs.md to mark tasks as completed
 * 4. Closes corresponding GitHub issues
 *
 * @param options - Detection options
 * @returns Detection result with statistics
 * @throws {Error} If planning session not found or critical error occurs
 *
 * @example
 * ```typescript
 * const result = await detectCompletedTasks({
 *   sessionPath: '.claude/sessions/planning/P-003-feature',
 *   githubConfig: {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'hospeda',
 *     repo: 'main'
 *   },
 *   dryRun: false,
 *   commitLimit: 10
 * });
 *
 * console.log(`Detected: ${result.statistics.totalDetected}`);
 * console.log(`Completed: ${result.statistics.totalCompleted}`);
 * console.log(`Closed: ${result.statistics.totalClosed}`);
 * ```
 */
export async function detectCompletedTasks(
    options: CompletionDetectorOptions
): Promise<CompletionResult> {
    const {
        sessionPath,
        githubConfig,
        trackingPath = DEFAULT_TRACKING_PATH,
        dryRun = false,
        commitLimit = DEFAULT_COMMIT_LIMIT
    } = options;

    logger.info({ sessionPath, dryRun, commitLimit }, 'Starting completion detection');

    // Initialize result
    const result: CompletionResult = {
        success: true,
        sessionId: '',
        detected: [],
        completed: [],
        closed: [],
        failed: [],
        statistics: {
            totalDetected: 0,
            totalCompleted: 0,
            totalClosed: 0,
            totalFailed: 0
        }
    };

    try {
        // Step 1: Parse planning session
        logger.debug({ sessionPath }, 'Parsing planning session');
        const session = await parsePlanningSession(sessionPath);
        result.sessionId = session.metadata.planningCode;

        logger.info({ sessionId: result.sessionId }, 'Planning session parsed');

        // Step 2: Load tracking database
        const trackingManager = new TrackingManager(trackingPath);
        await trackingManager.load();

        logger.debug({ trackingPath }, 'Tracking database loaded');

        // Step 3: Initialize GitHub client (only if not dry run)
        let githubClient: GitHubClient | undefined;
        if (!dryRun) {
            githubClient = new GitHubClient(githubConfig);
            logger.debug('GitHub client initialized');
        }

        // Step 4: Parse recent commits for task codes
        logger.debug({ commitLimit }, 'Parsing git commits');
        const detectedTasks = parseGitCommits({ commitLimit });
        result.detected = detectedTasks;
        result.statistics.totalDetected = detectedTasks.length;

        logger.info({ count: detectedTasks.length }, 'Tasks detected in commits');

        if (detectedTasks.length === 0) {
            logger.info('No tasks detected in recent commits');
            return result;
        }

        // Step 5: Process each detected task
        const processedTaskCodes = new Set<string>();

        for (const detected of detectedTasks) {
            // Skip if already processed (deduplicate)
            if (processedTaskCodes.has(detected.taskCode)) {
                logger.debug({ taskCode: detected.taskCode }, 'Skipping duplicate task code');
                continue;
            }

            processedTaskCodes.add(detected.taskCode);

            try {
                await processDetectedTask({
                    detected,
                    session,
                    trackingManager,
                    githubClient,
                    dryRun,
                    result
                });
            } catch (error) {
                logger.error(
                    {
                        taskCode: detected.taskCode,
                        error: (error as Error).message
                    },
                    'Failed to process detected task'
                );

                result.failed.push({
                    taskCode: detected.taskCode,
                    reason: 'Processing error',
                    error: (error as Error).message
                });
                result.statistics.totalFailed++;
            }
        }

        // Step 6: Update TODOs.md with completion status (if not dry run and has completed tasks)
        if (!dryRun && result.completed.length > 0) {
            logger.debug('Updating TODOs.md with completion status');
            await updateTodosStatus(sessionPath, session.tasks);
            await updateTodosWithLinks(sessionPath, session.tasks);
            logger.info('TODOs.md updated');
        }

        // Step 7: Save tracking database (if not dry run)
        if (!dryRun) {
            await trackingManager.save();
            logger.info('Tracking database saved');
        }

        // Determine overall success
        result.success = result.statistics.totalFailed === 0;

        logger.info(
            {
                success: result.success,
                statistics: result.statistics
            },
            'Completion detection completed'
        );

        return result;
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'Completion detection failed');
        result.success = false;
        throw error;
    }
}

/**
 * Parse git commits for task codes
 */
function parseGitCommits(input: { commitLimit: number }): DetectedTask[] {
    const { commitLimit } = input;

    try {
        // Get recent commits with format: hash|timestamp|message
        const output = execSync(`git log -${commitLimit} --format="%H|%aI|%s" --no-merges`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
        });

        if (!output || output.trim() === '') {
            return [];
        }

        return parseCommitOutput(output);
    } catch (error) {
        logger.warn({ error: (error as Error).message }, 'Failed to parse git commits');
        return [];
    }
}

/**
 * Parse git commit output into detected tasks
 */
function parseCommitOutput(output: string): DetectedTask[] {
    const detected: DetectedTask[] = [];
    const lines = output.split('\n').filter((line) => line.trim() !== '');

    for (const line of lines) {
        const parts = line.split('|');
        if (parts.length < 3) continue;

        const commitHash = parts[0] ?? '';
        const timestamp = parts[1] ?? '';
        const message = parts.slice(2).join('|');

        // Extract task codes from message
        const matches = message.matchAll(TASK_CODE_PATTERN);

        for (const match of matches) {
            const taskCode = match[1];
            if (!taskCode) continue;

            // Validate task code format
            if (!isValidTaskCode(taskCode)) {
                continue;
            }

            detected.push({
                taskCode: taskCode.toUpperCase(),
                commitHash,
                commitMessage: message,
                timestamp
            });
        }
    }

    return detected;
}

/**
 * Validate task code format
 */
function isValidTaskCode(code: string): boolean {
    // Valid formats: T-XXX-XXX, PB-XXX, TB-XXX
    const validPattern = /^(T-\d{3}-\d{3}|[PT]B-\d{3})$/i;
    return validPattern.test(code);
}

/**
 * Process a detected task
 */
async function processDetectedTask(input: {
    detected: DetectedTask;
    session: Awaited<ReturnType<typeof parsePlanningSession>>;
    trackingManager: TrackingManager;
    githubClient: GitHubClient | undefined;
    dryRun: boolean;
    result: CompletionResult;
}): Promise<void> {
    const { detected, session, trackingManager, githubClient, dryRun, result } = input;

    const { taskCode } = detected;

    logger.debug({ taskCode }, 'Processing detected task');

    // Step 1: Find task in TODOs
    const task = findTaskByCode(session.tasks, taskCode);

    if (!task) {
        logger.warn({ taskCode }, 'Task not found in TODOs.md');
        result.failed.push({
            taskCode,
            reason: 'Task not found in TODOs.md'
        });
        result.statistics.totalFailed++;
        return;
    }

    // Step 2: Check if task is already completed
    if (task.status === 'completed') {
        logger.debug({ taskCode }, 'Task already completed');
        result.failed.push({
            taskCode,
            reason: 'Task already completed'
        });
        result.statistics.totalFailed++;
        return;
    }

    // Step 3: Find tracking record
    // Search by task code since the tracking database uses task codes as task IDs
    const trackingRecord = await trackingManager.findByTaskId(taskCode);

    if (!trackingRecord) {
        logger.warn({ taskCode }, 'Task not found in tracking database');
        result.failed.push({
            taskCode,
            reason: 'Task not found in tracking database'
        });
        result.statistics.totalFailed++;
        return;
    }

    // Step 4: Update task status to completed
    task.status = 'completed';

    result.completed.push({
        taskCode,
        taskTitle: task.title,
        closedAt: new Date().toISOString()
    });
    result.statistics.totalCompleted++;

    logger.info({ taskCode, taskTitle: task.title }, 'Task marked as completed');

    // Step 5: Close GitHub issue (if not dry run)
    if (!dryRun && githubClient && trackingRecord.github) {
        try {
            const { issueNumber, issueUrl } = trackingRecord.github;

            // Add completion comment and close issue
            await githubClient.updateIssue(issueNumber, {
                state: 'closed',
                body: `Completed in commit ${detected.commitHash}\n\n${detected.commitMessage}`
            });

            await githubClient.closeIssue(issueNumber);

            result.closed.push({
                taskCode,
                issueNumber,
                issueUrl
            });
            result.statistics.totalClosed++;

            logger.info({ taskCode, issueNumber }, 'GitHub issue closed');
        } catch (error) {
            logger.error(
                {
                    taskCode,
                    error: (error as Error).message
                },
                'Failed to close GitHub issue'
            );

            result.failed.push({
                taskCode,
                reason: 'Failed to close GitHub issue',
                error: (error as Error).message
            });
            result.statistics.totalFailed++;
        }
    }
}

/**
 * Find task by code in task hierarchy
 */
function findTaskByCode(tasks: Task[], code: string): Task | undefined {
    for (const task of tasks) {
        if (task.code.toUpperCase() === code.toUpperCase()) {
            return task;
        }

        // Recursively search subtasks
        if (task.subtasks && task.subtasks.length > 0) {
            const found = findTaskByCode(task.subtasks, code);
            if (found) return found;
        }
    }

    return undefined;
}

/**
 * Update task status in TODOs.md
 */
async function updateTodosStatus(sessionPath: string, tasks: Task[]): Promise<void> {
    const { readFile, writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const todosPath = join(sessionPath, 'TODOs.md');
    let content = await readFile(todosPath, 'utf-8');

    // Flatten tasks
    const flatTasks: Task[] = [];
    function flatten(taskList: Task[]): void {
        for (const task of taskList) {
            flatTasks.push(task);
            if (task.subtasks && task.subtasks.length > 0) {
                flatten(task.subtasks);
            }
        }
    }
    flatten(tasks);

    // Update status for completed tasks
    for (const task of flatTasks) {
        if (task.status === 'completed') {
            // Replace [ ] with [x] for this task
            const pattern = new RegExp(`- \\[ \\] \\*\\*${task.code}\\*\\*`, 'g');
            content = content.replace(pattern, `- [x] **${task.code}**`);
        }
    }

    await writeFile(todosPath, content);
}
