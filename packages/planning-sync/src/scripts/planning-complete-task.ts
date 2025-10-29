#!/usr/bin/env tsx
/**
 * Planning Complete Task CLI
 * Marks a task as completed in TODOs.md and Linear
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { markTaskCompleted } from '../index.js';

async function main() {
    config({ path: resolve(process.cwd(), '.env') });
    config({ path: resolve(process.cwd(), '.env.local') });

    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: pnpm planning:complete <session-path> <task-id-or-title>');
        console.error(
            'Example: pnpm planning:complete .claude/sessions/planning/user-auth "Create User model"'
        );
        process.exit(1);
    }

    const sessionPath = resolve(process.cwd(), args[0] ?? '');
    const taskId = args[1];

    // Check environment variables
    const apiKey = process.env.LINEAR_API_KEY;
    const teamId = process.env.LINEAR_TEAM_ID;

    if (!apiKey || !teamId) {
        console.error('❌ Missing environment variables:');
        if (!apiKey) console.error('  - LINEAR_API_KEY');
        if (!teamId) console.error('  - LINEAR_TEAM_ID');
        console.error('\nSet these in your .env file or environment.');
        process.exit(1);
    }

    if (!taskId) {
        console.error('❌ Missing task Id');
        process.exit(1);
    }

    console.info('🎯 Marking task as completed...');
    console.info(`📁 Session: ${sessionPath}`);
    console.info(`📝 Task: ${taskId}`);

    try {
        const result = await markTaskCompleted(sessionPath, taskId, {
            apiKey,
            teamId
        });

        console.info('\n✅ Task marked as completed!');
        console.info('\n📝 Updated: TODOs.md');
        console.info(`🔗 Linear: ${result.issueUrl}`);
        console.info(`   ID: ${result.issueId}`);
    } catch (error) {
        console.error('\n❌ Failed to mark as completed:', error);
        process.exit(1);
    }
}

main();
