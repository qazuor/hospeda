/**
 * /planning:sync command handler
 *
 * Provides command-line interface for syncing planning sessions to GitHub Issues.
 * Supports auto-detection of session from current directory.
 *
 * @module commands/sync-command
 */

import { detectSessionFromPath } from '../enrichment/session-context.js';
import { syncPlanningToGitHub } from '../sync/planning-sync.js';
import type { GitHubClientConfig } from '../types/github.js';
import type { CommandResult } from './types.js';

/**
 * Options for sync command
 */
export type SyncCommandOptions = {
    /** Explicit session path (optional if currentPath provided) */
    sessionPath?: string;

    /** Current file path for auto-detection */
    currentPath?: string;

    /** GitHub configuration */
    githubConfig: GitHubClientConfig;

    /** Tracking file path */
    trackingPath?: string;

    /** Dry run mode (preview only) */
    dryRun?: boolean;

    /** Update existing issues */
    updateExisting?: boolean;
};

/**
 * Execute /planning:sync command
 *
 * Synchronizes a planning session to GitHub Issues. Can auto-detect
 * session from current file path or use explicit session path.
 *
 * @param options - Command options
 * @returns Command result
 *
 * @example
 * ```typescript
 * // Explicit session path
 * const result = await executeSyncCommand({
 *   sessionPath: '.claude/sessions/planning/P-001-feature',
 *   githubConfig: {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'hospeda',
 *     repo: 'main'
 *   }
 * });
 *
 * // Auto-detect from current file
 * const result = await executeSyncCommand({
 *   currentPath: process.cwd() + '/PDR.md',
 *   githubConfig: { ... }
 * });
 * ```
 */
export async function executeSyncCommand(options: SyncCommandOptions): Promise<CommandResult> {
    const { sessionPath, currentPath, githubConfig, trackingPath, dryRun, updateExisting } =
        options;

    try {
        // Determine session path
        let finalSessionPath: string | undefined = sessionPath;

        if (!finalSessionPath && currentPath) {
            // Try to auto-detect from current path
            const detection = detectSessionFromPath({ filePath: currentPath });

            if (detection.detected) {
                finalSessionPath = detection.sessionPath;
            } else {
                return {
                    success: false,
                    message:
                        'Could not detect session from current path. Please provide explicit session path.'
                };
            }
        }

        if (!finalSessionPath) {
            return {
                success: false,
                message:
                    'No session path provided or detected. Use --session-path or run from within a planning session.'
            };
        }

        // Execute sync
        const result = await syncPlanningToGitHub({
            sessionPath: finalSessionPath,
            githubConfig,
            trackingPath,
            dryRun: dryRun ?? false,
            updateExisting: updateExisting ?? false
        });

        // Format response
        if (result.success) {
            const mode = dryRun ? '[DRY RUN] ' : '';
            const message = `${mode}Successfully synced session ${result.sessionId}`;

            return {
                success: true,
                message,
                details: {
                    sessionId: result.sessionId,
                    sessionPath: finalSessionPath,
                    statistics: result.statistics,
                    created: result.created.map((c) => ({
                        taskCode: c.taskCode,
                        issueNumber: c.issueNumber,
                        issueUrl: c.issueUrl
                    })),
                    updated: result.updated.map((u) => ({
                        taskCode: u.taskCode,
                        issueNumber: u.issueNumber,
                        changes: u.changes
                    }))
                }
            };
        }

        // Sync completed but with failures
        return {
            success: false,
            message: `Sync completed with ${result.statistics.failed} failures`,
            details: {
                sessionId: result.sessionId,
                statistics: result.statistics,
                failed: result.failed
            }
        };
    } catch (error) {
        return {
            success: false,
            message: `Sync failed: ${(error as Error).message}`,
            details: {
                error: (error as Error).message,
                stack: (error as Error).stack
            }
        };
    }
}
