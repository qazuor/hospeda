#!/usr/bin/env node
/**
 * Planning sync script
 *
 * Executable script for syncing planning sessions to GitHub Issues.
 * Can be run manually or from CI/CD.
 *
 * @module scripts/planning-sync
 *
 * @example
 * ```bash
 * # Sync specific session
 * pnpm planning:sync .claude/sessions/planning/P-001-feature
 *
 * # From npm script
 * pnpm planning:sync <session-path>
 * ```
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '@repo/logger';
import { loadConfig } from '../config/index.js';
import { syncPlanningToGitHub } from '../sync/planning-sync.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { sessionPath?: string; dryRun: boolean; help: boolean } {
	const args = process.argv.slice(2);
	const result: { sessionPath?: string; dryRun: boolean; help: boolean } = {
		dryRun: false,
		help: false
	};

	for (const arg of args) {
		if (arg === '--dry-run') {
			result.dryRun = true;
		} else if (arg === '--help' || arg === '-h') {
			result.help = true;
		} else if (!arg.startsWith('-')) {
			result.sessionPath = arg;
		}
	}

	return result;
}

/**
 * Show help message
 */
function showHelp(): void {
	console.log(`
Planning Sync - Sync planning sessions to GitHub Issues

USAGE:
  pnpm planning:sync <session-path> [options]

ARGUMENTS:
  <session-path>    Path to planning session directory
                    Example: .claude/sessions/planning/P-001-feature

OPTIONS:
  --dry-run         Preview changes without creating issues
  --help, -h        Show this help message

EXAMPLES:
  # Sync specific session
  pnpm planning:sync .claude/sessions/planning/P-001-feature

  # Dry run (preview only)
  pnpm planning:sync .claude/sessions/planning/P-001-feature --dry-run

ENVIRONMENT VARIABLES:
  GITHUB_TOKEN      GitHub personal access token (required)
  GH_OWNER          GitHub repository owner (default: from config)
  GH_REPO           GitHub repository name (default: from config)

For more information, see:
  packages/github-workflow/docs/SETUP.md
`);
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

	// Validate session path provided
	if (!args.sessionPath) {
		console.error('❌ Error: Session path is required');
		console.error('');
		showHelp();
		process.exit(1);
	}

	// Resolve absolute path
	const sessionPath = resolve(process.cwd(), args.sessionPath);

	// Validate session exists
	if (!existsSync(sessionPath)) {
		console.error(`❌ Error: Session path does not exist: ${sessionPath}`);
		process.exit(1);
	}

	// Validate required files exist
	const requiredFiles = ['PDR.md', 'tech-analysis.md', 'TODOs.md'];
	const missingFiles = requiredFiles.filter((file) => !existsSync(`${sessionPath}/${file}`));

	if (missingFiles.length > 0) {
		console.error(`❌ Error: Missing required files in session:`);
		for (const file of missingFiles) {
			console.error(`  - ${file}`);
		}
		console.error('');
		console.error('A valid planning session must contain:');
		console.error('  - PDR.md (Product Design Requirements)');
		console.error('  - tech-analysis.md (Technical Analysis)');
		console.error('  - TODOs.md (Task Breakdown)');
		process.exit(1);
	}

	try {
		logger.info({ sessionPath, dryRun: args.dryRun }, 'Starting planning sync');

		// Load configuration
		const config = await loadConfig(process.cwd());

		// Check GitHub token
		if (!config.github.token) {
			console.error('❌ Error: GITHUB_TOKEN environment variable is required');
			console.error('');
			console.error('Set it in your environment:');
			console.error('  export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx');
			console.error('');
			console.error('Or create a .env file with:');
			console.error('  GITHUB_TOKEN=ghp_xxxxxxxxxxxxx');
			process.exit(1);
		}

		// Sync planning to GitHub
		const result = await syncPlanningToGitHub({
			sessionPath,
			dryRun: args.dryRun
		});

		// Log results
		if (result.success) {
			logger.info(
				{
					created: result.statistics.created,
					updated: result.statistics.updated,
					closed: result.statistics.closed,
					failed: result.statistics.failed
				},
				'Planning sync completed successfully'
			);

			console.log('');
			console.log('✅ Planning sync completed');
			console.log('');
			console.log(`📊 Statistics:`);
			console.log(`  Created: ${result.statistics.created}`);
			console.log(`  Updated: ${result.statistics.updated}`);
			console.log(`  Closed: ${result.statistics.closed}`);
			console.log(`  Failed: ${result.statistics.failed}`);

			if (result.statistics.created > 0) {
				console.log('');
				console.log('🔗 Created Issues:');
				for (const created of result.created) {
					console.log(`  #${created.issueNumber} - ${created.taskCode}`);
				}
			}
		} else {
			logger.error('Planning sync failed');

			console.error('');
			console.error('❌ Planning sync failed');

			if (result.failed.length > 0) {
				console.error('');
				console.error('Failed tasks:');
				for (const failure of result.failed) {
					console.error(`  ${failure.taskId}: ${failure.error}`);
				}
			}

			process.exit(1);
		}

		process.exit(0);
	} catch (error) {
		logger.error({ error: (error as Error).message }, 'Planning sync error');

		console.error('');
		console.error('❌ Planning sync error:', (error as Error).message);
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
