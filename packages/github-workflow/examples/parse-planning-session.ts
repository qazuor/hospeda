/**
 * Example: Parse a complete planning session
 *
 * This example demonstrates how to parse both PDR.md and TODOs.md
 * from a planning session directory.
 */

import { parsePlanningSession } from '../src/parsers';

async function main() {
    // Parse a planning session
    const sessionPath = '.claude/sessions/planning/P-003-planning-workflow-automation';

    const session = await parsePlanningSession(sessionPath);
    for (const task of session.tasks) {
        if (task.subtasks) {
            for (const _subtask of task.subtasks) {
            }
        }
    }
}

main().catch(console.error);
