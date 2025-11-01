/**
 * Example: Scanning codebase for TODO, HACK, and DEBUG comments
 *
 * This example demonstrates how to use the code comment parser
 * to scan your codebase for special comments and extract metadata.
 */

import { scanCodeComments } from '../src/parsers/code-comment-parser.js';

async function main() {
    console.log('🔍 Scanning codebase for code comments...\n');

    // Scan the entire project
    const result = await scanCodeComments({
        baseDir: process.cwd(),
        include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/*.test.ts',
        ],
        commentTypes: ['TODO', 'HACK', 'DEBUG'],
    });

    // Display summary
    console.log('📊 Summary:');
    console.log(`  Files scanned: ${result.filesScanned}`);
    console.log(`  Comments found: ${result.commentsFound}`);
    console.log(`  - TODOs: ${result.byType.TODO.length}`);
    console.log(`  - HACKs: ${result.byType.HACK.length}`);
    console.log(`  - DEBUGs: ${result.byType.DEBUG.length}`);
    console.log();

    // Display high-priority TODOs
    const highPriorityTodos = result.byType.TODO.filter(
        (comment) =>
            comment.priority === 'high' ||
            comment.priority === 'P1' ||
            comment.priority === 'P2'
    );

    if (highPriorityTodos.length > 0) {
        console.log('🔴 High Priority TODOs:');
        for (const todo of highPriorityTodos) {
            console.log(`  - ${todo.filePath}:${todo.lineNumber}`);
            console.log(`    ${todo.content}`);
            if (todo.assignee) {
                console.log(`    Assignee: @${todo.assignee}`);
            }
            if (todo.labels && todo.labels.length > 0) {
                console.log(`    Labels: ${todo.labels.join(', ')}`);
            }
            console.log();
        }
    }

    // Display HACKs (temporary workarounds)
    if (result.byType.HACK.length > 0) {
        console.log('⚠️  HACKs (Temporary Workarounds):');
        for (const hack of result.byType.HACK) {
            console.log(`  - ${hack.filePath}:${hack.lineNumber}`);
            console.log(`    ${hack.content}`);
            console.log();
        }
    }

    // Display DEBUGs (should be removed before production)
    if (result.byType.DEBUG.length > 0) {
        console.log('🐛 DEBUG Comments:');
        for (const debug of result.byType.DEBUG) {
            console.log(`  - ${debug.filePath}:${debug.lineNumber}`);
            console.log(`    ${debug.content}`);
            console.log();
        }
    }

    // Group by file
    console.log('📁 Comments by File:');
    const sortedFiles = Object.keys(result.byFile).sort();
    for (const file of sortedFiles.slice(0, 10)) {
        // Show first 10 files
        const comments = result.byFile[file];
        if (comments) {
            console.log(`  ${file} (${comments.length} comments)`);
        }
    }
    if (sortedFiles.length > 10) {
        console.log(`  ... and ${sortedFiles.length - 10} more files`);
    }
}

main().catch((error) => {
    console.error('Error scanning code comments:', error);
    process.exit(1);
});
