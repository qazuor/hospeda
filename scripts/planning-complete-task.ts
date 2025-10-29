#!/usr/bin/env tsx
/**
 * Planning Complete Task CLI
 * Marks a task as completed in TODOs.md and Linear
 */

import { markTaskCompleted } from '../packages/planning-sync/src/index.js';
import { resolve } from 'node:path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: pnpm planning:complete <session-path> <task-id-or-title>');
    console.error('Example: pnpm planning:complete .claude/sessions/planning/user-auth "Create User model"');
    process.exit(1);
  }

  const sessionPath = resolve(process.cwd(), args[0]);
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

  console.log('🎯 Marking task as completed...');
  console.log(`📁 Session: ${sessionPath}`);
  console.log(`📝 Task: ${taskId}`);

  try {
    const result = await markTaskCompleted(sessionPath, taskId, {
      apiKey,
      teamId,
    });

    console.log('\n✅ Task marked as completed!');
    console.log(`\n📝 Updated: TODOs.md`);
    console.log(`🔗 Linear: ${result.issueUrl}`);
    console.log(`   ID: ${result.linearIssueId}`);
  } catch (error) {
    console.error('\n❌ Failed to mark as completed:', error);
    process.exit(1);
  }
}

main();
