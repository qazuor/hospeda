/**
 * Pre-commit hook for syncing TODO comments
 *
 * Automatically syncs TODO/HACK/DEBUG comments from staged files to GitHub Issues:
 * - Scans only staged files for comments
 * - Creates/updates GitHub issues
 * - Maintains synchronization tracking
 *
 * @module hooks/pre-commit
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { logger } from '@repo/logger';
import { loadConfig } from '../config/index.js';
import type { GitHubConfig } from '../config/schemas.js';
import { syncTodosToGitHub } from '../sync/todo-sync.js';

/**
 * Pre-commit hook options
 */
export type PreCommitOptions = {
    /** Path to project root (defaults to current working directory) */
    projectRoot?: string;
    /** Dry run mode (don't make actual changes) */
    dryRun?: boolean;
    /** Whether to fail silently on errors */
    silent?: boolean;
    /** Update existing issues if comment changed */
    updateExisting?: boolean;
};

/**
 * Get list of staged files from git
 */
function getStagedFiles(projectRoot: string): string[] {
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
            cwd: projectRoot,
            encoding: 'utf-8'
        });

        return output
            .split('\n')
            .filter(Boolean)
            .filter(
                (file) =>
                    file.endsWith('.ts') ||
                    file.endsWith('.tsx') ||
                    file.endsWith('.js') ||
                    file.endsWith('.jsx')
            )
            .map((file) => join(projectRoot, file));
    } catch (error) {
        logger.warn({ error: (error as Error).message }, 'Failed to get staged files');
        return [];
    }
}

/**
 * Execute pre-commit hook
 *
 * Syncs TODO/HACK/DEBUG comments from staged files to GitHub Issues.
 * Only processes files that are about to be committed.
 *
 * @param options - Hook options
 * @returns Promise that resolves when hook completes
 *
 * @example
 * ```typescript
 * // In .husky/pre-commit:
 * import { runPreCommitHook } from '@repo/github-workflow/hooks';
 *
 * await runPreCommitHook({
 *   projectRoot: process.cwd(),
 *   updateExisting: true,
 *   silent: true
 * });
 * ```
 */
export async function runPreCommitHook(options: PreCommitOptions = {}): Promise<void> {
    const {
        projectRoot = process.cwd(),
        dryRun = false,
        silent = false,
        updateExisting = true
    } = options;

    try {
        // Load configuration
        const config = await loadConfig(projectRoot);

        // Check if TODO sync is enabled
        if (config.sync?.todos && !config.sync.todos.enabled) {
            if (!silent) {
                logger.info('TODO sync is disabled in config');
            }
            return;
        }

        // Get staged files
        const stagedFiles = getStagedFiles(projectRoot);

        if (stagedFiles.length === 0) {
            if (!silent) {
                logger.info('No staged source files found');
            }
            return;
        }

        if (!silent) {
            logger.info({ count: stagedFiles.length }, 'Scanning staged files for TODO comments');
        }

        // Get GitHub config
        const githubConfig: GitHubConfig = {
            token: config.github.token,
            owner: config.github.owner,
            repo: config.github.repo
        };

        // Sync TODOs from staged files
        const result = await syncTodosToGitHub({
            baseDir: projectRoot,
            include: stagedFiles,
            commentTypes: ['TODO', 'HACK', 'DEBUG'],
            githubConfig,
            trackingPath: undefined, // Tracking path not yet implemented in config
            dryRun,
            updateExisting,
            closeRemoved: false // Don't close on pre-commit, only on explicit removal
        });

        // Log results
        if (!silent && result.statistics.created > 0) {
            logger.info(
                {
                    created: result.statistics.created,
                    updated: result.statistics.updated,
                    skipped: result.statistics.skipped
                },
                'TODO sync completed'
            );
        }

        if (!silent && result.statistics.failed > 0) {
            logger.warn(
                {
                    failed: result.statistics.failed
                },
                'Some TODOs failed to sync'
            );
        }
    } catch (error) {
        if (!silent) {
            logger.error({ error: (error as Error).message }, 'Pre-commit hook failed');
        }

        // Don't throw error to avoid blocking git operations
        if (!silent) {
            console.error('⚠️  Pre-commit hook failed (non-blocking):', (error as Error).message);
        }
    }
}
