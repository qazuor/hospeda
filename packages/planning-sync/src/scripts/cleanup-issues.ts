#!/usr/bin/env tsx
/**
 * Cleanup GitHub Issues
 * Closes all issues in the repository
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PlanningGitHubClient } from '../github-client.js';

async function main() {
    config({ path: resolve(process.cwd(), '../../', '.env') });
    config({ path: resolve(process.cwd(), '../../', '.env.local') });

    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;

    if (!githubToken || !githubRepo) {
        console.error('❌ Missing environment variables:');
        if (!githubToken) console.error('  - GITHUB_TOKEN');
        if (!githubRepo) console.error('  - GITHUB_REPO');
        process.exit(1);
    }

    console.info('⚠️  WARNING: This will close ALL issues in the repository!');
    console.info(`🏢 Repository: ${githubRepo}`);
    console.info('');
    console.info('Starting cleanup immediately...');

    // await new Promise((resolve) => setTimeout(resolve, 5000));

    const client = new PlanningGitHubClient({
        token: githubToken,
        repo: githubRepo
    });

    try {
        console.info('🧹 Closing all issues...');
        const deleted = await client.deleteAllIssues(true);
        console.info(`\n✅ Closed ${deleted} issues successfully!`);
    } catch (error) {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    }
}

main();
