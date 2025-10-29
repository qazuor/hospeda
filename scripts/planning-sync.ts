#!/usr/bin/env tsx
/**
 * Planning Sync CLI
 * Syncs a planning session to Linear
 */

import { syncPlanningToLinear } from '../packages/planning-sync/src/index.js';
import { resolve } from 'node:path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: pnpm planning:sync <session-path>');
    console.error('Example: pnpm planning:sync .claude/sessions/planning/user-auth');
    process.exit(1);
  }

  const sessionPath = resolve(process.cwd(), args[0]);

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

  console.log('🔄 Syncing planning to Linear...');
  console.log(`📁 Session: ${sessionPath}`);

  try {
    const result = await syncPlanningToLinear(sessionPath, {
      apiKey,
      teamId,
    });

    console.log('\n✅ Planning synced successfully!');
    console.log(`\n📋 Parent Issue: ${result.parentIssueUrl}`);
    console.log(`   ID: ${result.parentIssueId}`);
    console.log(`\n📊 Statistics:`);
    console.log(`   • ${result.tasksCreated} tasks created`);
    console.log(`   • ${result.tasksUpdated} tasks updated`);
    console.log(`   • ${result.tasksUnchanged} tasks unchanged`);
    console.log(`\n💡 Don't forget to commit .linear-sync.json!`);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
