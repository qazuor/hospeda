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

    // Access metadata
    console.log('Planning Code:', session.metadata.planningCode);
    console.log('Feature Name:', session.metadata.featureName);
    console.log('Summary:', session.metadata.summary);

    // Access tasks
    console.log('\nTasks:');
    for (const task of session.tasks) {
        console.log(`- [${task.code}] ${task.title}`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Level: ${task.level}`);

        if (task.subtasks) {
            for (const subtask of task.subtasks) {
                console.log(`  - [${subtask.code}] ${subtask.title}`);
            }
        }
    }
}

main().catch(console.error);
