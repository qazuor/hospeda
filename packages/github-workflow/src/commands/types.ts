/**
 * Types for command handlers
 *
 * @module commands/types
 */

/**
 * Result of command execution
 */
export type CommandResult = {
    /** Whether command was successful */
    success: boolean;

    /** Human-readable message */
    message: string;

    /** Additional details (optional) */
    details?: unknown;
};
