/**
 * Planning Sync - Simple Linear synchronization for planning sessions
 *
 * @packageDocumentation
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PlanningLinearClient } from './linear-client.js';
import {
    parseFeatureName,
    parsePdrSummary,
    parseTodosMarkdown,
    updateTaskStatus
} from './parser.js';
import type {
    CompleteTaskResult,
    LinearSyncConfig,
    PlanningSession,
    SyncResult,
    TaskStatus
} from './types.js';

// Re-export types
export * from './types.js';
export * from './git-utils.js';

/**
 * Synchronizes a planning session to Linear
 *
 * Creates a parent issue and sub-issues for all tasks in TODOs.md
 *
 * @param sessionPath - Path to planning session directory (e.g., .claude/sessions/planning/user-auth/)
 * @param config - Linear configuration
 * @returns Sync result with URLs and statistics
 *
 * @example
 * ```typescript
 * const result = await syncPlanningToLinear(
 *   '.claude/sessions/planning/user-auth',
 *   {
 *     apiKey: process.env.LINEAR_API_KEY,
 *     teamId: process.env.LINEAR_TEAM_ID,
 *   }
 * );
 * console.log(`Parent issue: ${result.parentIssueUrl}`);
 * ```
 */
export async function syncPlanningToLinear(
    sessionPath: string,
    config: LinearSyncConfig
): Promise<SyncResult> {
    // Read planning files
    const todosPath = join(sessionPath, 'TODOs.md');
    const pdrPath = join(sessionPath, 'PDR.md');
    const syncFilePath = join(sessionPath, '.linear-sync.json');

    const [todosContent, pdrContent] = await Promise.all([
        fs.readFile(todosPath, 'utf-8'),
        fs.readFile(pdrPath, 'utf-8')
    ]);

    // Parse content
    const tasks = parseTodosMarkdown(todosContent);
    const featureName = parseFeatureName(pdrContent);
    const summary = parsePdrSummary(pdrContent);

    // Load existing sync data if exists
    let existingSession: PlanningSession | null = null;
    try {
        const syncContent = await fs.readFile(syncFilePath, 'utf-8');
        existingSession = JSON.parse(syncContent);
    } catch {
        // File doesn't exist, first sync
    }

    // Initialize Linear client
    const linearClient = new PlanningLinearClient(config);

    // Create or update parent issue
    const parentIssue = await linearClient.createOrUpdateParentIssue({
        title: `[Planning] ${featureName}`,
        description: summary || `Planning session for ${featureName}`,
        existingIssueId: existingSession?.parentIssueId
    });

    // Sync tasks
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let tasksUnchanged = 0;

    for (const task of tasks) {
        // Check if task already has Linear issue
        const existingTask = existingSession?.tasks.find((t) => t.id === task.id);

        if (existingTask?.linearIssueId) {
            // Task already synced, check if status changed
            if (existingTask.status !== task.status) {
                await linearClient.updateIssueStatus(existingTask.linearIssueId, task.status);
                task.linearIssueId = existingTask.linearIssueId;
                tasksUpdated++;
            } else {
                task.linearIssueId = existingTask.linearIssueId;
                tasksUnchanged++;
            }
        } else {
            // Create new sub-issue
            const subIssue = await linearClient.createSubIssue({
                parentId: parentIssue.id,
                title: task.title,
                description: task.description
            });
            task.linearIssueId = subIssue.id;
            tasksCreated++;
        }
    }

    // Save sync data
    const session: PlanningSession = {
        feature: featureName,
        parentIssueId: parentIssue.id,
        linearTeamId: config.teamId,
        syncedAt: new Date().toISOString(),
        tasks
    };

    await fs.writeFile(syncFilePath, JSON.stringify(session, null, 2), 'utf-8');

    return {
        parentIssueUrl: parentIssue.url,
        parentIssueId: parentIssue.id,
        tasksCreated,
        tasksUpdated,
        tasksUnchanged
    };
}

/**
 * Marks a task as completed in both TODOs.md and Linear
 *
 * @param sessionPath - Path to planning session directory
 * @param taskId - Task ID or title
 * @param config - Linear configuration
 * @returns Completion result with URLs
 *
 * @example
 * ```typescript
 * const result = await markTaskCompleted(
 *   '.claude/sessions/planning/user-auth',
 *   'abc12345',
 *   config
 * );
 * console.log(`Task completed: ${result.issueUrl}`);
 * ```
 */
export async function markTaskCompleted(
    sessionPath: string,
    taskId: string,
    config: LinearSyncConfig
): Promise<CompleteTaskResult> {
    const todosPath = join(sessionPath, 'TODOs.md');
    const syncFilePath = join(sessionPath, '.linear-sync.json');

    // Load sync data
    const syncContent = await fs.readFile(syncFilePath, 'utf-8');
    const session: PlanningSession = JSON.parse(syncContent);

    // Find task by ID or title
    const task = session.tasks.find((t) => t.id === taskId || t.title === taskId);

    if (!task) {
        throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.linearIssueId) {
        throw new Error(`Task ${taskId} has not been synced to Linear yet`);
    }

    // Update task status
    task.status = 'completed';

    // Update Linear issue
    const linearClient = new PlanningLinearClient(config);
    await linearClient.updateIssueStatus(task.linearIssueId, 'completed');

    // Update TODOs.md
    const todosContent = await fs.readFile(todosPath, 'utf-8');
    const updatedContent = updateTaskStatus(todosContent, task.title, 'completed');
    await fs.writeFile(todosPath, updatedContent, 'utf-8');

    // Save updated session
    session.syncedAt = new Date().toISOString();
    await fs.writeFile(syncFilePath, JSON.stringify(session, null, 2), 'utf-8');

    // Get issue URL
    const issueUrl = await linearClient.getIssueUrl(task.linearIssueId);

    return {
        taskId: task.id,
        linearIssueId: task.linearIssueId,
        issueUrl
    };
}

/**
 * Gets the current planning session data
 *
 * @param sessionPath - Path to planning session directory
 * @returns Planning session data or null if not synced
 */
export async function getPlanningSession(sessionPath: string): Promise<PlanningSession | null> {
    const syncFilePath = join(sessionPath, '.linear-sync.json');

    try {
        const content = await fs.readFile(syncFilePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

/**
 * Updates task status in TODOs.md and Linear
 *
 * @param sessionPath - Path to planning session directory
 * @param taskId - Task ID or title
 * @param newStatus - New status
 * @param config - Linear configuration
 */
export async function updateTaskStatusInSync(
    sessionPath: string,
    taskId: string,
    newStatus: TaskStatus,
    config: LinearSyncConfig
): Promise<void> {
    const todosPath = join(sessionPath, 'TODOs.md');
    const syncFilePath = join(sessionPath, '.linear-sync.json');

    // Load sync data
    const syncContent = await fs.readFile(syncFilePath, 'utf-8');
    const session: PlanningSession = JSON.parse(syncContent);

    // Find task
    const task = session.tasks.find((t) => t.id === taskId || t.title === taskId);

    if (!task) {
        throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.linearIssueId) {
        throw new Error(`Task ${taskId} has not been synced to Linear yet`);
    }

    // Update task status
    task.status = newStatus;

    // Update Linear issue
    const linearClient = new PlanningLinearClient(config);
    await linearClient.updateIssueStatus(task.linearIssueId, newStatus);

    // Update TODOs.md
    const todosContent = await fs.readFile(todosPath, 'utf-8');
    const updatedContent = updateTaskStatus(todosContent, task.title, newStatus);
    await fs.writeFile(todosPath, updatedContent, 'utf-8');

    // Save updated session
    session.syncedAt = new Date().toISOString();
    await fs.writeFile(syncFilePath, JSON.stringify(session, null, 2), 'utf-8');
}
