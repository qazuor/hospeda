/**
 * Session context manager
 *
 * Detects and loads planning session context from file paths.
 * Provides utilities for session validation and metadata loading.
 *
 * @module enrichment/session-context
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlanningSession } from '../parsers/planning-session.js';
import type { ParsedPlanningSession } from '../parsers/types.js';

/**
 * Session context with metadata and path information
 */
export type SessionContext = {
    /** Planning session ID (e.g., P-001) */
    sessionId: string;

    /** Full path to session directory */
    sessionPath: string;

    /** Parsed session metadata */
    metadata: ParsedPlanningSession['metadata'];

    /** All tasks from session */
    tasks: ParsedPlanningSession['tasks'];
};

/**
 * Result of session detection
 */
export type SessionDetectionResult = {
    /** Whether session was detected */
    detected: boolean;

    /** Path to session directory if detected */
    sessionPath?: string;

    /** Session ID if detected */
    sessionId?: string;
};

/**
 * Result of session structure validation
 */
export type SessionValidationResult = {
    /** Whether session structure is valid */
    valid: boolean;

    /** List of missing required files */
    missingFiles: string[];
};

/**
 * Result of session context loading
 */
export type SessionContextResult = {
    /** Whether loading was successful */
    success: boolean;

    /** Loaded session context if successful */
    context?: SessionContext;

    /** Error message if failed */
    error?: string;
};

/**
 * In-memory cache for loaded sessions
 */
const sessionCache = new Map<string, SessionContext>();

/**
 * Detect planning session from file path
 *
 * Analyzes a file path to determine if it belongs to a planning session.
 * Extracts session ID and path if detected.
 *
 * @param input - Input parameters
 * @param input.filePath - File path to analyze
 * @returns Detection result with session info
 *
 * @example
 * ```typescript
 * const result = detectSessionFromPath({
 *   filePath: '/project/.claude/sessions/planning/P-001-feature/PDR.md'
 * });
 *
 * if (result.detected) {
 *   console.log(result.sessionId); // "P-001"
 *   console.log(result.sessionPath); // "/project/.claude/sessions/planning/P-001-feature"
 * }
 * ```
 */
export function detectSessionFromPath(input: {
    filePath: string;
}): SessionDetectionResult {
    const { filePath } = input;

    // Check if path contains planning sessions directory
    const planningSessionsPattern = /\.claude\/sessions\/planning\/(P-\d+[^/]*)/;
    const match = filePath.match(planningSessionsPattern);

    if (!match) {
        return { detected: false };
    }

    // Extract session directory name
    const sessionDirName = match[1];
    if (!sessionDirName) {
        return { detected: false };
    }

    // Extract session ID (P-XXX)
    const sessionIdMatch = sessionDirName.match(/^(P-\d+)/);
    if (!sessionIdMatch) {
        return { detected: false };
    }

    const sessionId = sessionIdMatch[1];

    // Build session path
    const sessionPath = filePath.substring(
        0,
        filePath.indexOf(sessionDirName) + sessionDirName.length
    );

    return {
        detected: true,
        sessionPath,
        sessionId
    };
}

/**
 * Validate session directory structure
 *
 * Checks if all required files exist in the session directory.
 * Required files: PDR.md, tech-analysis.md, TODOs.md
 *
 * @param input - Input parameters
 * @param input.sessionPath - Path to session directory
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateSessionStructure({
 *   sessionPath: '/project/.claude/sessions/planning/P-001-feature'
 * });
 *
 * if (!result.valid) {
 *   console.error('Missing files:', result.missingFiles);
 * }
 * ```
 */
export function validateSessionStructure(input: {
    sessionPath: string;
}): SessionValidationResult {
    const { sessionPath } = input;

    const requiredFiles = ['PDR.md', 'tech-analysis.md', 'TODOs.md'];
    const missingFiles: string[] = [];

    for (const file of requiredFiles) {
        const filePath = join(sessionPath, file);
        if (!existsSync(filePath)) {
            missingFiles.push(file);
        }
    }

    return {
        valid: missingFiles.length === 0,
        missingFiles
    };
}

/**
 * Load session context
 *
 * Loads and parses a planning session, including all metadata and tasks.
 * Results are cached for performance.
 *
 * @param input - Input parameters
 * @param input.sessionPath - Path to session directory
 * @returns Session context result
 *
 * @example
 * ```typescript
 * const result = await loadSessionContext({
 *   sessionPath: '/project/.claude/sessions/planning/P-001-feature'
 * });
 *
 * if (result.success && result.context) {
 *   console.log('Session:', result.context.metadata.title);
 *   console.log('Tasks:', result.context.tasks.length);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function loadSessionContext(input: {
    sessionPath: string;
}): Promise<SessionContextResult> {
    const { sessionPath } = input;

    // Check cache first
    const cached = sessionCache.get(sessionPath);
    if (cached) {
        return {
            success: true,
            context: cached
        };
    }

    // Validate session structure
    const validation = validateSessionStructure({ sessionPath });
    if (!validation.valid) {
        return {
            success: false,
            error: `Invalid session structure. Missing files: ${validation.missingFiles.join(', ')}`
        };
    }

    try {
        // Parse planning session
        const session = await parsePlanningSession(sessionPath);

        // Create context
        const context: SessionContext = {
            sessionId: session.metadata.planningCode,
            sessionPath: session.sessionPath,
            metadata: session.metadata,
            tasks: session.tasks
        };

        // Cache for future use
        sessionCache.set(sessionPath, context);

        return {
            success: true,
            context
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to parse session: ${(error as Error).message}`
        };
    }
}

/**
 * Clear session cache
 *
 * Utility function to clear cached session contexts.
 * Useful for testing or when sessions are updated.
 *
 * @example
 * ```typescript
 * clearSessionCache();
 * // All cached sessions are cleared
 * ```
 */
export function clearSessionCache(): void {
    sessionCache.clear();
}
