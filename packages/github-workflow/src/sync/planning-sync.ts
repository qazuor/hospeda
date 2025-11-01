/**
 * Planning synchronization orchestrator
 *
 * Integrates all sync modules to synchronize planning sessions to GitHub Issues.
 *
 * @module sync/planning-sync
 */

import { logger } from '@repo/logger';
import { GitHubClient } from '../core/github-client.js';
import { parsePlanningSession } from '../parsers/planning-session.js';
import { updateTodosWithLinks } from '../parsers/todos-parser.js';
import type { Task } from '../parsers/types.js';
import { TrackingManager } from '../tracking/tracking-manager.js';
import type { TrackingRecord } from '../tracking/types.js';
import { createTaskSnapshot, detectTaskChanges } from './change-detector.js';
import { buildIssueBody, buildIssueTitle } from './issue-builder.js';
import { generateLabelsForTask } from './label-manager.js';
import type {
    CreatedIssue,
    FailedTask,
    SkippedTask,
    SyncOptions,
    SyncResult,
    UpdatedIssue
} from './types.js';

/**
 * Default tracking path
 */
const DEFAULT_TRACKING_PATH = '.todoLinear/tracking.json';

/**
 * Synchronize planning session to GitHub Issues
 *
 * Main orchestrator that coordinates:
 * 1. Planning session parsing
 * 2. Tracking database management
 * 3. Issue creation/update
 * 4. TODOs.md link updates
 *
 * @param options - Synchronization options
 * @returns Synchronization result
 * @throws {Error} If planning session not found or critical error occurs
 *
 * @example
 * ```typescript
 * const result = await syncPlanningToGitHub({
 *   sessionPath: '.claude/sessions/planning/P-003-feature',
 *   githubConfig: {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'hospeda',
 *     repo: 'main'
 *   },
 *   dryRun: false,
 *   updateExisting: true
 * });
 *
 * console.log(`Created: ${result.statistics.created}`);
 * console.log(`Updated: ${result.statistics.updated}`);
 * ```
 */
export async function syncPlanningToGitHub(options: SyncOptions): Promise<SyncResult> {
    const {
        sessionPath,
        githubConfig,
        trackingPath = DEFAULT_TRACKING_PATH,
        dryRun = false,
        updateExisting = false
    } = options;

    logger.info({ sessionPath, dryRun, updateExisting }, 'Starting planning sync');

    // Initialize result
    const result: SyncResult = {
        success: true,
        sessionId: '',
        created: [],
        updated: [],
        skipped: [],
        failed: [],
        statistics: {
            totalTasks: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0
        }
    };

    try {
        // Step 1: Parse planning session
        logger.debug({ sessionPath }, 'Parsing planning session');
        const session = await parsePlanningSession(sessionPath);
        result.sessionId = session.metadata.planningCode;

        logger.info(
            {
                sessionId: result.sessionId,
                totalTasks: session.tasks.length
            },
            'Planning session parsed'
        );

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

        // Step 4: Process all tasks (including subtasks)
        const allTasks = flattenTasks(session.tasks);
        result.statistics.totalTasks = allTasks.length;

        logger.info({ count: allTasks.length }, 'Processing tasks');

        // Store parent issue numbers for linking
        const taskToIssueMap = new Map<string, number>();

        for (const task of allTasks) {
            try {
                await processTask({
                    task,
                    session,
                    trackingManager,
                    githubClient,
                    githubConfig,
                    dryRun,
                    updateExisting,
                    result,
                    taskToIssueMap
                });
            } catch (error) {
                logger.error(
                    {
                        taskId: task.id,
                        error: (error as Error).message
                    },
                    'Failed to process task'
                );

                result.failed.push({
                    taskId: task.id,
                    error: (error as Error).message
                });
                result.statistics.failed++;
            }
        }

        // Step 5: Update TODOs.md with GitHub links (if not dry run and has created issues)
        if (!dryRun && result.created.length > 0) {
            logger.debug('Updating TODOs.md with GitHub links');

            // Update tasks with GitHub issue info
            for (const created of result.created) {
                const task = allTasks.find((t) => t.id === created.taskId);
                if (task) {
                    task.githubIssue = {
                        number: created.issueNumber,
                        url: created.issueUrl
                    };
                }
            }

            await updateTodosWithLinks(sessionPath, session.tasks);
            logger.info('TODOs.md updated with GitHub links');
        }

        // Step 6: Save tracking database (if not dry run)
        if (!dryRun) {
            await trackingManager.save();
            logger.info('Tracking database saved');
        }

        // Determine overall success
        result.success = result.statistics.failed === 0;

        logger.info(
            {
                success: result.success,
                statistics: result.statistics
            },
            'Planning sync completed'
        );

        return result;
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'Planning sync failed');
        result.success = false;
        throw error;
    }
}

/**
 * Process a single task
 */
async function processTask(input: {
    task: Task;
    session: Awaited<ReturnType<typeof parsePlanningSession>>;
    trackingManager: TrackingManager;
    githubClient: GitHubClient | undefined;
    githubConfig: SyncOptions['githubConfig'];
    dryRun: boolean;
    updateExisting: boolean;
    result: SyncResult;
    taskToIssueMap: Map<string, number>;
}): Promise<void> {
    const { task, session, trackingManager, githubClient, githubConfig, dryRun, updateExisting, result, taskToIssueMap } =
        input;

    // Check if task already synced
    const existingRecord = await trackingManager.findByTaskId(task.id);

    if (existingRecord && !updateExisting) {
        // Skip already synced task
        logger.debug({ taskId: task.id }, 'Skipping already synced task');
        result.skipped.push({
            taskId: task.id,
            reason: 'Already synced'
        });
        result.statistics.skipped++;

        // Remember issue number for linking
        if (existingRecord.github?.issueNumber) {
            taskToIssueMap.set(task.id, existingRecord.github.issueNumber);
        }

        return;
    }

    if (existingRecord && updateExisting) {
        // Check for changes
        const changes = detectTaskChanges({ task, trackingRecord: existingRecord });

        if (changes.changedFields.length === 0) {
            // No changes, skip
            logger.debug({ taskId: task.id }, 'No changes detected for task');
            result.skipped.push({
                taskId: task.id,
                reason: 'No changes'
            });
            result.statistics.skipped++;

            // Remember issue number for linking
            if (existingRecord.github?.issueNumber) {
                taskToIssueMap.set(task.id, existingRecord.github.issueNumber);
            }

            return;
        }

        // Update existing issue
        if (!dryRun && githubClient && existingRecord.github) {
            logger.info(
                {
                    taskId: task.id,
                    issueNumber: existingRecord.github.issueNumber,
                    changes: changes.changedFields
                },
                'Updating existing issue'
            );

            const title = buildIssueTitle({ task });
            const body = buildIssueBody({
                task,
                metadata: session.metadata,
                sessionPath: session.sessionPath
            });

            await githubClient.updateIssue(existingRecord.github.issueNumber, {
                title,
                body
            });

            // Update tracking record
            (existingRecord as unknown as { taskSnapshot?: unknown }).taskSnapshot =
                createTaskSnapshot(task);
            await trackingManager.updateRecord(existingRecord.id, {
                status: 'updated',
                github: {
                    ...existingRecord.github,
                    updatedAt: new Date().toISOString()
                }
            });

            result.updated.push({
                taskId: task.id,
                taskCode: task.code,
                issueNumber: existingRecord.github.issueNumber,
                changes: changes.changedFields
            });
            result.statistics.updated++;

            // Remember issue number for linking
            taskToIssueMap.set(task.id, existingRecord.github.issueNumber);
        }

        return;
    }

    // Create new issue
    if (dryRun) {
        logger.debug({ taskId: task.id }, 'Dry run: would create issue');
        result.created.push({
            taskId: task.id,
            taskCode: task.code,
            issueNumber: 0,
            issueUrl: 'dry-run'
        });
        result.statistics.created++;
        return;
    }

    if (!githubClient) {
        throw new Error('GitHub client required for creating issues');
    }

    logger.info({ taskId: task.id, taskCode: task.code }, 'Creating new issue');

    // Build issue
    const title = buildIssueTitle({ task });
    const body = buildIssueBody({
        task,
        metadata: session.metadata,
        sessionPath: session.sessionPath
    });
    const labels = generateLabelsForTask({
        task,
        planningCode: session.metadata.planningCode
    });

    // Create issue
    const issueNumber = await githubClient.createIssue({
        title,
        body,
        labels
    });

    const issueUrl = `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${issueNumber}`;

    logger.info(
        {
            taskId: task.id,
            issueNumber,
            issueUrl
        },
        'Issue created'
    );

    // Remember issue number for linking
    taskToIssueMap.set(task.id, issueNumber);

    // Link to parent task if this is a subtask
    if (task.level > 0) {
        const parentTask = findParentTask(session.tasks, task);
        if (parentTask) {
            const parentIssueNumber = taskToIssueMap.get(parentTask.id);
            if (parentIssueNumber) {
                logger.debug(
                    {
                        subtask: issueNumber,
                        parent: parentIssueNumber
                    },
                    'Linking subtask to parent'
                );
                await githubClient.linkIssues(parentIssueNumber, issueNumber);
            }
        }
    }

    // Create tracking record
    const trackingRecord = await trackingManager.addRecord({
        type: 'planning-task',
        source: {
            sessionId: session.metadata.planningCode,
            taskId: task.id
        },
        status: 'pending',
        syncAttempts: 0
    });

    // Mark as synced with snapshot
    (trackingRecord as unknown as { taskSnapshot?: unknown }).taskSnapshot =
        createTaskSnapshot(task);
    await trackingManager.markAsSynced(trackingRecord.id, issueNumber, issueUrl);

    result.created.push({
        taskId: task.id,
        taskCode: task.code,
        issueNumber,
        issueUrl
    });
    result.statistics.created++;
}

/**
 * Flatten task hierarchy to array
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

/**
 * Find parent task for a subtask
 */
function findParentTask(tasks: Task[], subtask: Task): Task | undefined {
    for (const task of tasks) {
        // Check if this task has the subtask
        if (task.subtasks?.some((sub) => sub.id === subtask.id)) {
            return task;
        }

        // Recursively check subtasks
        if (task.subtasks) {
            const parent = findParentTask(task.subtasks, subtask);
            if (parent) return parent;
        }
    }

    return undefined;
}
