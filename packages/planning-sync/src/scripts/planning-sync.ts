#!/usr/bin/env tsx
/**
 * Planning Sync CLI
 * Syncs a planning session to GitHub or Linear
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { syncPlanning } from '../index.js';
import type { SyncConfig } from '../types.js';

async function main() {
    config({ path: resolve(process.cwd(), '../../', '.env') });
    config({ path: resolve(process.cwd(), '../../', '.env.local') });

    const args = process.argv.slice(2);

    // Parse arguments
    let sessionPath = '';
    let platform: 'github' | 'linear' | undefined;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;

        if (arg === '--platform' && args[i + 1]) {
            const platformArg = args[i + 1];
            if (platformArg === 'github' || platformArg === 'linear') {
                platform = platformArg;
            }
            i++; // Skip next arg
        } else if (!sessionPath) {
            sessionPath = arg;
        }
    }

    if (!sessionPath) {
        console.error('Usage: pnpm planning:sync <session-path> [--platform github|linear]');
        console.error(
            'Example: pnpm planning:sync .claude/sessions/planning/user-auth --platform github'
        );
        console.error('\nIf --platform is not specified, will auto-detect (GitHub is preferred).');
        process.exit(1);
    }

    const resolvedSessionPath = resolve(process.cwd(), '../../', sessionPath);

    // Check environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    const linearApiKey = process.env.LINEAR_API_KEY;
    const linearTeamId = process.env.LINEAR_TEAM_ID;

    // Auto-detect platform if not specified (GitHub is preferred)
    if (!platform) {
        if (githubToken && githubRepo) {
            platform = 'github';
        } else if (linearApiKey && linearTeamId) {
            platform = 'linear';
        } else {
            console.error(
                '❌ Could not auto-detect platform. Set environment variables or use --platform flag.'
            );
            console.error('\nRecommended (GitHub):');
            console.error('  - GITHUB_TOKEN (Personal Access Token with repo scope)');
            console.error('  - GITHUB_REPO (format: owner/repo)');
            console.error('\nAlternative (Linear):');
            console.error('  - LINEAR_API_KEY');
            console.error('  - LINEAR_TEAM_ID');
            process.exit(1);
        }
    }

    // Build configuration
    let syncConfig: SyncConfig;

    if (platform === 'github') {
        if (!githubToken || !githubRepo) {
            console.error('❌ Missing GitHub environment variables:');
            if (!githubToken) console.error('  - GITHUB_TOKEN');
            if (!githubRepo) console.error('  - GITHUB_REPO (format: owner/repo)');
            console.error('\nSet these in your .env file or environment.');
            process.exit(1);
        }

        syncConfig = {
            platform: 'github',
            token: githubToken,
            repo: githubRepo
        };

        console.info('🔄 Syncing planning to GitHub...');
        console.info(`📁 Session: ${resolvedSessionPath}`);
        console.info(`🏢 Repository: ${githubRepo}`);
    } else {
        if (!linearApiKey || !linearTeamId) {
            console.error('❌ Missing Linear environment variables:');
            if (!linearApiKey) console.error('  - LINEAR_API_KEY');
            if (!linearTeamId) console.error('  - LINEAR_TEAM_ID');
            console.error('\nSet these in your .env file or environment.');
            process.exit(1);
        }

        syncConfig = {
            platform: 'linear',
            apiKey: linearApiKey,
            teamId: linearTeamId
        };

        console.info('🔄 Syncing planning to Linear...');
        console.info(`📁 Session: ${resolvedSessionPath}`);
        console.info(`👥 Team: ${linearTeamId}`);
    }

    try {
        const result = await syncPlanning(resolvedSessionPath, syncConfig);

        console.info('\n✅ Planning synced successfully!');
        console.info(`\n📋 Parent Issue: ${result.parentIssueUrl}`);
        console.info(`   ID: ${result.parentIssueId}`);
        console.info('\n📊 Statistics:');
        console.info(`   • ${result.tasksCreated} tasks created`);
        console.info(`   • ${result.tasksUpdated} tasks updated`);
        console.info(`   • ${result.tasksUnchanged} tasks unchanged`);
        console.info(`\n💡 Don't forget to commit .linear-sync.json!`);
    } catch (error) {
        console.error('\n❌ Sync failed:', error);
        process.exit(1);
    }
}

main();
