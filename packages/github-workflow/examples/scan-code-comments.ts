/**
 * Example: Scanning codebase for TODO, HACK, and DEBUG comments
 *
 * This example demonstrates how to use the code comment parser
 * to scan your codebase for special comments and extract metadata.
 */

import { scanCodeComments } from '../src/parsers/code-comment-parser.js';

async function main() {
    // Scan the entire project
    const result = await scanCodeComments({
        baseDir: process.cwd(),
        include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.test.ts'],
        commentTypes: ['TODO', 'HACK', 'DEBUG']
    });

    // Display high-priority TODOs
    const highPriorityTodos = result.byType.TODO.filter(
        (comment) =>
            comment.priority === 'high' || comment.priority === 'P1' || comment.priority === 'P2'
    );

    if (highPriorityTodos.length > 0) {
        for (const todo of highPriorityTodos) {
            if (todo.assignee) {
            }
            if (todo.labels && todo.labels.length > 0) {
            }
        }
    }

    // Display HACKs (temporary workarounds)
    if (result.byType.HACK.length > 0) {
        for (const _hack of result.byType.HACK) {
        }
    }

    // Display DEBUGs (should be removed before production)
    if (result.byType.DEBUG.length > 0) {
        for (const _debug of result.byType.DEBUG) {
        }
    }
    const sortedFiles = Object.keys(result.byFile).sort();
    for (const file of sortedFiles.slice(0, 10)) {
        // Show first 10 files
        const comments = result.byFile[file];
        if (comments) {
        }
    }
    if (sortedFiles.length > 10) {
    }
}

main().catch((error) => {
    console.error('Error scanning code comments:', error);
    process.exit(1);
});
