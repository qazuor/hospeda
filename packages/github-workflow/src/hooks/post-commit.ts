/**
 * Post-commit hook for detecting completed tasks
 *
 * Automatically detects completed tasks from commit messages and:
 * - Updates TODOs.md to mark tasks as completed
 * - Closes corresponding GitHub issues
 *
 * @module hooks/post-commit
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '@repo/logger';
import { loadConfig } from '../config/index.js';
import type { GitHubConfig } from '../config/schemas.js';
import { detectCompletedTasks } from '../sync/completion-detector.js';

/**
 * Post-commit hook options
 */
export type PostCommitOptions = {
    /** Path to project root (defaults to current working directory) */
    projectRoot?: string;
    /** Number of commits to scan (defaults to 1 - only last commit) */
    commitLimit?: number;
    /** Dry run mode (don't make actual changes) */
    dryRun?: boolean;
    /** Whether to fail silently on errors */
    silent?: boolean;
};

/**
 * Execute post-commit hook
 *
 * Detects completed tasks from the most recent commit and updates
 * TODOs.md and GitHub issues accordingly.
 *
 * @param options - Hook options
 * @returns Promise that resolves when hook completes
 *
 * @example
 * ```typescript
 * // In .husky/post-commit:
 * import { runPostCommitHook } from '@repo/github-workflow/hooks';
 *
 * await runPostCommitHook({
 *   projectRoot: process.cwd(),
 *   commitLimit: 1,
 *   silent: true
 * });
 * ```
 */
export async function runPostCommitHook(options: PostCommitOptions = {}): Promise<void> {
    const {
        projectRoot = process.cwd(),
        commitLimit = 1,
        dryRun = false,
        silent = false
    } = options;

    try {
        // Load configuration
        const config = await loadConfig(projectRoot);

        // Check if detection is enabled
        if (config.detection && !config.detection.autoComplete) {
            if (!silent) {
                logger.info('Completion detection is disabled in config');
            }
            return;
        }

        // Find planning sessions to check
        const planningSessions = findPlanningSessions(projectRoot);

        if (planningSessions.length === 0) {
            if (!silent) {
                logger.info('No planning sessions found');
            }
            return;
        }

        // Get GitHub config
        const githubConfig: GitHubConfig = {
            token: config.github.token,
            owner: config.github.owner,
            repo: config.github.repo
        };

        // Process each planning session
        let totalDetected = 0;
        let totalCompleted = 0;
        let totalClosed = 0;

        for (const sessionPath of planningSessions) {
            try {
                const result = await detectCompletedTasks({
                    sessionPath,
                    githubConfig,
                    trackingPath: undefined, // Tracking path not yet implemented in config
                    dryRun,
                    commitLimit
                });

                totalDetected += result.statistics.totalDetected;
                totalCompleted += result.statistics.totalCompleted;
                totalClosed += result.statistics.totalClosed;

                if (!silent && result.statistics.totalCompleted > 0) {
                    logger.info(
                        {
                            sessionId: result.sessionId,
                            detected: result.statistics.totalDetected,
                            completed: result.statistics.totalCompleted,
                            closed: result.statistics.totalClosed
                        },
                        'Tasks completed in commit'
                    );
                }
            } catch (error) {
                if (!silent) {
                    logger.warn(
                        {
                            sessionPath,
                            error: (error as Error).message
                        },
                        'Failed to detect completed tasks for session'
                    );
                }
            }
        }

        // Log summary
        if (!silent && totalCompleted > 0) {
            logger.info(
                {
                    detected: totalDetected,
                    completed: totalCompleted,
                    closed: totalClosed
                },
                'Post-commit completion detection summary'
            );
        }
    } catch (error) {
        if (!silent) {
            logger.error({ error: (error as Error).message }, 'Post-commit hook failed');
        }

        // Don't throw error to avoid blocking git operations
        if (!silent) {
            console.error('⚠️  Post-commit hook failed (non-blocking):', (error as Error).message);
        }
    }
}

/**
 * Find all planning sessions in project
 */
function findPlanningSessions(projectRoot: string): string[] {
    const sessionsDir = join(projectRoot, '.claude', 'sessions', 'planning');

    if (!existsSync(sessionsDir)) {
        return [];
    }

    const sessions: string[] = [];

    try {
        // Find all directories with TODOs.md
        const entries = readdirSync(sessionsDir);

        for (const entry of entries) {
            const sessionPath = join(sessionsDir, entry);

            if (!statSync(sessionPath).isDirectory()) {
                continue;
            }

            // Check if TODOs.md exists
            const todosPath = join(sessionPath, 'TODOs.md');
            if (existsSync(todosPath)) {
                sessions.push(sessionPath);
            }
        }
    } catch (error) {
        logger.warn({ error: (error as Error).message }, 'Failed to scan planning sessions');
    }

    return sessions;
}
