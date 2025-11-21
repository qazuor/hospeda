#!/usr/bin/env node
/**
 * Planning cleanup script
 *
 * Executable script for archiving completed planning sessions.
 * Can be run manually (interactive), automatically (--auto), or in dry-run mode.
 *
 * @module scripts/planning-cleanup
 *
 * @example
 * ```bash
 * # Interactive mode (prompts for each session)
 * pnpm planning:cleanup
 *
 * # Automatic mode (archives all completed sessions)
 * pnpm planning:cleanup:auto
 *
 * # Dry run (preview only)
 * pnpm planning:cleanup --dry-run
 * ```
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { logger } from '@repo/logger';

/**
 * Parse command line arguments
 */
function parseArgs(): { auto: boolean; dryRun: boolean; help: boolean } {
    const args = process.argv.slice(2);
    const result: { auto: boolean; dryRun: boolean; help: boolean } = {
        auto: false,
        dryRun: false,
        help: false
    };

    for (const arg of args) {
        if (arg === '--auto') {
            result.auto = true;
        } else if (arg === '--dry-run') {
            result.dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            result.help = true;
        }
    }

    return result;
}

/**
 * Show help message
 */
function showHelp(): void {}

/**
 * Planning session interface
 */
interface PlanningSession {
    id: string;
    path: string;
    title: string;
    isCompleted: boolean;
    completedTasks: number;
    totalTasks: number;
}

/**
 * Discover planning sessions
 */
function discoverSessions(baseDir: string): PlanningSession[] {
    const sessionsDir = resolve(baseDir, '.claude/sessions/planning');

    if (!existsSync(sessionsDir)) {
        return [];
    }

    const sessions: PlanningSession[] = [];

    // Read all directories starting with P-
    const entries = require('node:fs').readdirSync(sessionsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('P-')) {
            continue;
        }

        const sessionPath = join(sessionsDir, entry.name);
        const checkpointPath = join(sessionPath, '.checkpoint.json');
        const todosPath = join(sessionPath, 'TODOs.md');

        // Skip if no checkpoint file
        if (!existsSync(checkpointPath)) {
            continue;
        }

        try {
            // Read checkpoint
            const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8'));

            // Count tasks from TODOs.md if exists
            let completedTasks = 0;
            let totalTasks = 0;

            if (existsSync(todosPath)) {
                const todosContent = readFileSync(todosPath, 'utf-8');
                const taskLines = todosContent
                    .split('\n')
                    .filter((line) => line.match(/^-\s+\[.\]\s+/));

                totalTasks = taskLines.length;
                completedTasks = taskLines.filter((line) => line.match(/^-\s+\[x\]\s+/i)).length;
            }

            sessions.push({
                id: entry.name,
                path: sessionPath,
                title: checkpoint.session?.title || entry.name,
                isCompleted: checkpoint.status === 'completed',
                completedTasks,
                totalTasks
            });
        } catch (error) {
            logger.warn(
                { sessionId: entry.name, error: (error as Error).message },
                'Failed to parse session'
            );
        }
    }

    return sessions;
}

/**
 * Generate completion report
 */
function generateCompletionReport(session: PlanningSession): string {
    const now = new Date();

    return `# Planning Session Completion Report

**Session ID:** ${session.id}
**Title:** ${session.title}
**Completed:** ${now.toISOString().split('T')[0]}

## Summary

- **Total Tasks:** ${session.totalTasks}
- **Completed Tasks:** ${session.completedTasks}
- **Completion Rate:** ${session.totalTasks > 0 ? Math.round((session.completedTasks / session.totalTasks) * 100) : 0}%

## Archived Structure

This session has been archived to maintain a clean active planning directory.

Original location: \`.claude/sessions/planning/${session.id}\`
Archive location: \`.claude/sessions/planning/archived/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${session.id}\`

## Next Steps

If you need to reference this planning session:
1. Check the archived location above
2. Review the original PDR.md, tech-analysis.md, and TODOs.md
3. Check GitHub Issues linked in issues-sync.json

---

*Generated automatically by planning-cleanup script on ${now.toISOString()}*
`;
}

/**
 * Archive a session
 */
function archiveSession(session: PlanningSession, baseDir: string, dryRun: boolean): boolean {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const archiveDir = resolve(baseDir, '.claude/sessions/planning/archived', String(year), month);
    const archivePath = join(archiveDir, session.id);

    if (dryRun) {
        return true;
    }

    try {
        // Create archive directory
        mkdirSync(archiveDir, { recursive: true });

        // Move session
        renameSync(session.path, archivePath);

        // Generate completion report
        const report = generateCompletionReport(session);
        const reportPath = join(archivePath, 'COMPLETION-REPORT.md');
        writeFileSync(reportPath, report, 'utf-8');

        logger.info({ sessionId: session.id, archivePath }, 'Session archived successfully');
        return true;
    } catch (error) {
        logger.error(
            { sessionId: session.id, error: (error as Error).message },
            'Failed to archive session'
        );
        return false;
    }
}

/**
 * Prompt user for confirmation (simplified for now)
 */
function promptUser(_message: string): boolean {
    return true;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    const args = parseArgs();

    // Show help if requested
    if (args.help) {
        showHelp();
        process.exit(0);
    }

    const baseDir = process.cwd();

    try {
        logger.info({ auto: args.auto, dryRun: args.dryRun }, 'Starting planning cleanup');

        // Discover sessions
        const allSessions = discoverSessions(baseDir);
        const completedSessions = allSessions.filter((s) => s.isCompleted);

        if (completedSessions.length === 0) {
            process.exit(0);
        }

        for (const _session of completedSessions) {
        }

        // Process based on mode
        let _archivedCount = 0;
        let _skippedCount = 0;

        if (args.auto) {
            for (const session of completedSessions) {
                const success = archiveSession(session, baseDir, args.dryRun);
                if (success) {
                    _archivedCount++;
                    if (!args.dryRun) {
                    }
                } else {
                    _skippedCount++;
                    console.error(`❌ Failed: ${session.id}`);
                }
            }
        } else {
            for (const session of completedSessions) {
                const shouldArchive = promptUser('\n   Archive this session? (y/n): ');

                if (shouldArchive) {
                    const success = archiveSession(session, baseDir, args.dryRun);
                    if (success) {
                        _archivedCount++;
                        if (!args.dryRun) {
                        }
                    } else {
                        _skippedCount++;
                        console.error('   ❌ Failed to archive');
                    }
                } else {
                    _skippedCount++;
                }
            }
        }

        if (args.dryRun) {
        }

        process.exit(0);
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'Planning cleanup error');

        console.error('');
        console.error('❌ Planning cleanup error:', (error as Error).message);
        console.error('');
        console.error('Stack trace:');
        console.error((error as Error).stack);

        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
