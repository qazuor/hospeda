/**
 * Planning Sync - GitHub/Linear synchronization for planning sessions
 *
 * @packageDocumentation
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { generateTaskCodes, getPlanningCode } from './code-generator.js';
import { PlanningGitHubClient } from './github-client.js';
import { PlanningLinearClient } from './linear-client.js';
import {
    parseFeatureName,
    parsePdrSummary,
    parseTodosMarkdown,
    updateTaskStatus
} from './parser.js';
import type {
    CompleteTaskResult,
    GitHubSyncConfig,
    LinearSyncConfig,
    PlanningSession,
    PlanningTask,
    SyncConfig,
    SyncResult,
    TaskStatus
} from './types.js';

// Re-export types
export * from './types.js';
export * from './git-utils.js';
export * from './code-generator.js';

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

    // Get or generate planning code for backward compatibility
    const planningCode =
        existingSession?.planningCode || (await getPlanningCode(sessionPath, featureName));

    // Save sync data
    const session: PlanningSession = {
        feature: featureName,
        planningCode,
        platform: 'linear',
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
        issueId: task.linearIssueId,
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

/**
 * Unified planning sync function supporting both GitHub and Linear
 *
 * Creates a parent issue and sub-issues for all tasks in TODOs.md
 * Generates planning codes (P-XXX) and task codes (T-XXX-XXX) automatically
 *
 * @param sessionPath - Path to planning session directory
 * @param config - Sync configuration (GitHub or Linear)
 * @returns Sync result with URLs and statistics
 *
 * @example
 * ```typescript
 * // GitHub sync
 * const result = await syncPlanning(
 *   '.claude/sessions/planning/user-auth',
 *   {
 *     platform: 'github',
 *     token: process.env.GITHUB_TOKEN,
 *     repo: 'owner/repo',
 *   }
 * );
 *
 * // Linear sync (backward compatible)
 * const result = await syncPlanning(
 *   '.claude/sessions/planning/user-auth',
 *   {
 *     platform: 'linear',
 *     apiKey: process.env.LINEAR_API_KEY,
 *     teamId: process.env.LINEAR_TEAM_ID,
 *   }
 * );
 * ```
 */
export async function syncPlanning(sessionPath: string, config: SyncConfig): Promise<SyncResult> {
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

    // Get or generate planning code
    const planningCode =
        existingSession?.planningCode || (await getPlanningCode(sessionPath, featureName));

    // Generate task codes for tasks that don't have them
    const tasksNeedingCodes = tasks.filter((t) => !t.code || t.code === '');
    if (tasksNeedingCodes.length > 0) {
        const newCodes = await generateTaskCodes(
            sessionPath,
            planningCode,
            tasksNeedingCodes.length
        );
        let codeIndex = 0;
        for (const task of tasks) {
            if (!task.code || task.code === '') {
                const newCode = newCodes[codeIndex++];
                if (!newCode) {
                    throw new Error(`Failed to generate code for task: ${task.title}`);
                }
                task.code = newCode;
            }
        }
    }

    // Delegate to platform-specific sync
    if (config.platform === 'github') {
        return await syncToGitHub(sessionPath, config, {
            tasks,
            featureName,
            summary,
            planningCode,
            existingSession,
            syncFilePath
        });
    }
    return await syncToLinear(sessionPath, config, {
        tasks,
        featureName,
        summary,
        planningCode,
        existingSession,
        syncFilePath
    });
}

/**
 * Internal: Syncs planning to GitHub
 */
async function syncToGitHub(
    _sessionPath: string,
    config: GitHubSyncConfig,
    data: {
        tasks: PlanningTask[];
        featureName: string;
        summary: string;
        planningCode: string;
        existingSession: PlanningSession | null;
        syncFilePath: string;
    }
): Promise<SyncResult> {
    const githubClient = new PlanningGitHubClient(config);

    // Extract planning name (kebab-case from feature name)
    const planningName = data.featureName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Create or update parent issue
    const parentIssue = await githubClient.createOrUpdateParentIssue({
        title: data.featureName,
        body: data.summary || `Planning session for ${data.featureName}`,
        planningCode: data.planningCode,
        existingIssueNumber: data.existingSession?.parentGithubIssueNumber,
        projectName: `Planning: ${data.featureName}`,
        tasksCount: data.tasks.length
    });

    // Sync tasks
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let tasksUnchanged = 0;

    for (const task of data.tasks) {
        // Check if task already has GitHub issue
        const existingTask = data.existingSession?.tasks.find((t) => t.id === task.id);

        if (existingTask?.githubIssueNumber) {
            // Task already synced, check if status changed
            if (existingTask.status !== task.status) {
                await githubClient.updateIssueStatus(existingTask.githubIssueNumber, task.status);
                task.githubIssueNumber = existingTask.githubIssueNumber;
                tasksUpdated++;
            } else {
                task.githubIssueNumber = existingTask.githubIssueNumber;
                tasksUnchanged++;
            }
        } else {
            // Extract phase from task title if it starts with "Phase X:"
            const phaseMatch = task.title.match(/^Phase\s+(\d+):/i);
            const phase = phaseMatch ? `Phase ${phaseMatch[1]}` : undefined;

            // Create new sub-issue
            const subIssue = await githubClient.createSubIssue({
                parentNumber: parentIssue.number,
                title: task.title,
                body: task.description,
                taskCode: task.code,
                planningName,
                planningCode: data.planningCode,
                status: task.status,
                phase,
                projectNumber: parentIssue.projectNumber
            });
            task.githubIssueNumber = subIssue.number;
            tasksCreated++;
        }
    }

    // Update parent issue with tasklist of all sub-issues
    await githubClient.updateParentWithTasklist({
        parentNumber: parentIssue.number,
        subIssues: data.tasks.map((task) => ({
            number: task.githubIssueNumber!,
            title: task.title,
            status: task.status
        }))
    });

    // Save sync data
    const session: PlanningSession = {
        feature: data.featureName,
        planningCode: data.planningCode,
        platform: 'github',
        parentGithubIssueNumber: parentIssue.number,
        githubRepo: config.repo,
        syncedAt: new Date().toISOString(),
        tasks: data.tasks
    };

    await fs.writeFile(data.syncFilePath, JSON.stringify(session, null, 2), 'utf-8');

    return {
        parentIssueUrl: parentIssue.url,
        parentIssueId: parentIssue.number,
        tasksCreated,
        tasksUpdated,
        tasksUnchanged
    };
}

/**
 * Internal: Syncs planning to Linear (with code support)
 */
async function syncToLinear(
    _sessionPath: string,
    config: LinearSyncConfig,
    data: {
        tasks: PlanningTask[];
        featureName: string;
        summary: string;
        planningCode: string;
        existingSession: PlanningSession | null;
        syncFilePath: string;
    }
): Promise<SyncResult> {
    const linearClient = new PlanningLinearClient(config);

    // Create or update parent issue
    const parentIssue = await linearClient.createOrUpdateParentIssue({
        title: `[${data.planningCode}] ${data.featureName}`,
        description: data.summary || `Planning session for ${data.featureName}`,
        existingIssueId: data.existingSession?.parentIssueId
    });

    // Sync tasks
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let tasksUnchanged = 0;

    for (const task of data.tasks) {
        // Check if task already has Linear issue
        const existingTask = data.existingSession?.tasks.find((t) => t.id === task.id);

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
                title: `[${task.code}] ${task.title}`,
                description: task.description
            });
            task.linearIssueId = subIssue.id;
            tasksCreated++;
        }
    }

    // Save sync data
    const session: PlanningSession = {
        feature: data.featureName,
        planningCode: data.planningCode,
        platform: 'linear',
        parentIssueId: parentIssue.id,
        linearTeamId: config.teamId,
        syncedAt: new Date().toISOString(),
        tasks: data.tasks
    };

    await fs.writeFile(data.syncFilePath, JSON.stringify(session, null, 2), 'utf-8');

    return {
        parentIssueUrl: parentIssue.url,
        parentIssueId: parentIssue.id,
        tasksCreated,
        tasksUpdated,
        tasksUnchanged
    };
}
