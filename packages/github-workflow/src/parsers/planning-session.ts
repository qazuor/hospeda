/**
 * Planning session orchestrator
 *
 * Combines PDR and TODOs parsers to parse complete planning sessions.
 *
 * @module parsers/planning-session
 */

import { parsePDR } from './pdr-parser.js';
import { parseTodos } from './todos-parser.js';
import type { ParsedPlanningSession } from './types.js';

/**
 * Parse complete planning session (PDR + TODOs)
 *
 * Orchestrates parsing of both PDR.md and TODOs.md to extract
 * all planning metadata and tasks.
 *
 * @param sessionPath - Path to planning session directory
 * @returns Complete planning session with metadata and tasks
 * @throws {Error} If PDR.md or TODOs.md not found
 *
 * @example
 * ```typescript
 * const session = await parsePlanningSession(
 *   '.claude/sessions/planning/P-003-feature'
 * );
 *
 * console.log(session.metadata.planningCode); // "P-003"
 * console.log(session.tasks.length); // Number of top-level tasks
 * console.log(session.sessionPath); // Original path
 * ```
 */
export async function parsePlanningSession(
    sessionPath: string
): Promise<ParsedPlanningSession> {
    const metadata = await parsePDR(sessionPath);
    const tasks = await parseTodos(sessionPath, metadata.planningCode);

    return {
        metadata,
        tasks,
        sessionPath
    };
}
