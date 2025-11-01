/**
 * Claude Code integration module
 *
 * Main entry point for Claude Code command execution.
 * Routes commands to appropriate handlers and formats responses.
 *
 * @module enrichment/claude-integration
 */

import { executeGenerateCommand } from '../commands/generate-command.js';
import { executeSyncCommand } from '../commands/sync-command.js';
import type { CommandResult } from '../commands/types.js';
import type { GitHubClientConfig } from '../types/github.js';

/**
 * Supported Claude Code commands
 */
export type ClaudeCommand = 'planning:sync' | 'planning:generate-todos';

/**
 * Command execution options
 */
export type CommandOptions = {
    /** Explicit session path */
    sessionPath?: string;

    /** Current file path for auto-detection */
    currentPath?: string;

    /** Dry run mode (preview only) */
    dryRun?: boolean;

    /** Update existing issues (sync only) */
    updateExisting?: boolean;

    /** Output directory (generate only) */
    outputDir?: string;

    /** Tracking file path */
    trackingPath?: string;
};

/**
 * Input for Claude Code command execution
 */
export type ClaudeCommandInput = {
    /** Command to execute */
    command: ClaudeCommand;

    /** Command options */
    options: CommandOptions;

    /** GitHub configuration (required for sync) */
    githubConfig?: GitHubClientConfig;
};

/**
 * Execute Claude Code command
 *
 * Routes command to appropriate handler and returns formatted result.
 * Supports both /planning:sync and /planning:generate-todos commands.
 *
 * @param input - Command input
 * @returns Command result
 *
 * @example
 * ```typescript
 * // Execute sync command
 * const result = await executeClaudeCommand({
 *   command: 'planning:sync',
 *   options: {
 *     sessionPath: '.claude/sessions/planning/P-001-feature'
 *   },
 *   githubConfig: {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'hospeda',
 *     repo: 'main'
 *   }
 * });
 *
 * if (result.success) {
 *   console.log(result.message);
 * }
 * ```
 */
export async function executeClaudeCommand(input: ClaudeCommandInput): Promise<CommandResult> {
    const { command, options, githubConfig } = input;

    try {
        switch (command) {
            case 'planning:sync': {
                if (!githubConfig) {
                    return {
                        success: false,
                        message: 'GitHub configuration required for sync command'
                    };
                }

                return await executeSyncCommand({
                    sessionPath: options.sessionPath,
                    currentPath: options.currentPath,
                    githubConfig,
                    trackingPath: options.trackingPath,
                    dryRun: options.dryRun,
                    updateExisting: options.updateExisting
                });
            }

            case 'planning:generate-todos': {
                return await executeGenerateCommand({
                    sessionPath: options.sessionPath,
                    currentPath: options.currentPath,
                    outputDir: options.outputDir
                });
            }

            default: {
                return {
                    success: false,
                    message: `Unknown command: ${command}`
                };
            }
        }
    } catch (error) {
        return {
            success: false,
            message: `Command execution failed: ${(error as Error).message}`,
            details: {
                error: (error as Error).message,
                stack: (error as Error).stack
            }
        };
    }
}
