/**
 * /planning:generate-todos command handler
 *
 * Provides command-line interface for generating TODOs from planning sessions.
 * Supports auto-detection of session from current directory.
 *
 * @module commands/generate-command
 */

import { detectSessionFromPath, loadSessionContext } from '../enrichment/session-context.js';
import { updateTodosWithLinks } from '../parsers/todos-parser.js';
import type { CommandResult } from './types.js';

/**
 * Options for generate command
 */
export type GenerateCommandOptions = {
    /** Explicit session path (optional if currentPath provided) */
    sessionPath?: string;

    /** Current file path for auto-detection */
    currentPath?: string;

    /** Output directory for generated TODOs */
    outputDir?: string;
};

/**
 * Execute /planning:generate-todos command
 *
 * Generates TODO markdown from a planning session. Can auto-detect
 * session from current file path or use explicit session path.
 *
 * @param options - Command options
 * @returns Command result
 *
 * @example
 * ```typescript
 * // Explicit session path
 * const result = await executeGenerateCommand({
 *   sessionPath: '.claude/sessions/planning/P-001-feature'
 * });
 *
 * // Auto-detect from current file
 * const result = await executeGenerateCommand({
 *   currentPath: process.cwd() + '/PDR.md'
 * });
 * ```
 */
export async function executeGenerateCommand(
    options: GenerateCommandOptions
): Promise<CommandResult> {
    const { sessionPath, currentPath, outputDir } = options;

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

        // Load session context
        const contextResult = await loadSessionContext({ sessionPath: finalSessionPath });

        if (!contextResult.success || !contextResult.context) {
            return {
                success: false,
                message: `Failed to load session: ${contextResult.error}`,
                details: {
                    sessionPath: finalSessionPath,
                    error: contextResult.error
                }
            };
        }

        const { context } = contextResult;

        // Update TODOs.md with current task structure
        // This ensures TODOs.md is in sync with parsed tasks
        await updateTodosWithLinks(finalSessionPath, context.tasks);

        // Format response
        return {
            success: true,
            message: `Generated TODOs for session ${context.sessionId}`,
            details: {
                sessionId: context.sessionId,
                sessionPath: finalSessionPath,
                totalTasks: context.tasks.length,
                outputDir: outputDir ?? finalSessionPath
            }
        };
    } catch (error) {
        return {
            success: false,
            message: `Generate failed: ${(error as Error).message}`,
            details: {
                error: (error as Error).message,
                stack: (error as Error).stack
            }
        };
    }
}
