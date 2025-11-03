#!/usr/bin/env node
/**
 * TODOs sync script
 *
 * Executable script for syncing TODO/HACK/DEBUG comments from code to GitHub Issues.
 * Can be run manually or from CI/CD.
 *
 * @module scripts/todos-sync
 *
 * @example
 * ```bash
 * # Sync all code comments
 * pnpm todos:sync

 * # Sync specific directory
 * pnpm todos:sync ./packages/db

 * # Dry run (preview only)
 * pnpm todos:sync --dry-run
 * ```
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '@repo/logger';
import { loadConfig } from '../config/index.js';
import { syncTodosToGitHub } from '../sync/todo-sync.js';

/**
 * Parse command line arguments
 */
function parseArgs(): {
	baseDir?: string;
	dryRun: boolean;
	updateExisting: boolean;
	closeRemoved: boolean;
	help: boolean;
} {
	const args = process.argv.slice(2);
	const result: {
		baseDir?: string;
		dryRun: boolean;
		updateExisting: boolean;
		closeRemoved: boolean;
		help: boolean;
	} = {
		dryRun: false,
		updateExisting: false,
		closeRemoved: false,
		help: false
	};

	for (const arg of args) {
		if (arg === '--dry-run') {
			result.dryRun = true;
		} else if (arg === '--update') {
			result.updateExisting = true;
		} else if (arg === '--close-removed') {
			result.closeRemoved = true;
		} else if (arg === '--help' || arg === '-h') {
			result.help = true;
		} else if (!arg.startsWith('-')) {
			result.baseDir = arg;
		}
	}

	return result;
}

/**
 * Show help message
 */
function showHelp(): void {
	console.log(`
TODOs Sync - Sync code comments (TODO/HACK/DEBUG) to GitHub Issues

USAGE:
  pnpm todos:sync [base-dir] [options]

ARGUMENTS:
  [base-dir]        Base directory to scan (default: current directory)
                    Example: ./packages/db

OPTIONS:
  --dry-run         Preview changes without creating issues
  --update          Update existing issues if comment changed
  --close-removed   Close issues for comments removed from code
  --help, -h        Show this help message

EXAMPLES:
  # Sync all code comments in current directory
  pnpm todos:sync

  # Sync specific package
  pnpm todos:sync ./packages/db

  # Update existing issues and close removed ones
  pnpm todos:sync --update --close-removed

  # Dry run (preview only)
  pnpm todos:sync --dry-run

COMMENT FORMATS:
  // TODO: Simple todo comment
  // TODO(P1): High priority todo
  // TODO(@username): Assigned todo
  // TODO[label]: Labeled todo
  // TODO(P1)[@security](@john): Complex todo

  // HACK: Temporary workaround
  // DEBUG: Debug code to remove

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

	// Resolve base directory
	const baseDir = args.baseDir ? resolve(process.cwd(), args.baseDir) : process.cwd();

	// Validate base directory exists
	if (!existsSync(baseDir)) {
		console.error(`❌ Error: Directory does not exist: ${baseDir}`);
		process.exit(1);
	}

	try {
		logger.info({ baseDir, ...args }, 'Starting TODOs sync');

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

		console.log('🔍 Scanning codebase for TODO/HACK/DEBUG comments...');
		console.log('');

		// Sync TODOs to GitHub
		const result = await syncTodosToGitHub({
			baseDir,
			commentTypes: ['TODO', 'HACK', 'DEBUG'],
			githubConfig: {
				token: config.github.token,
				owner: config.github.owner,
				repo: config.github.repo
			},
			dryRun: args.dryRun,
			updateExisting: args.updateExisting,
			closeRemoved: args.closeRemoved
		});

		// Log results
		if (result.success) {
			logger.info(
				{
					filesScanned: result.scanned.filesScanned,
					commentsFound: result.scanned.commentsFound,
					created: result.statistics.created,
					updated: result.statistics.updated,
					closed: result.statistics.closed,
					skipped: result.statistics.skipped,
					failed: result.statistics.failed
				},
				'TODOs sync completed successfully'
			);

			console.log('✅ TODOs sync completed');
			console.log('');
			console.log(`📊 Scan Results:`);
			console.log(`  Files scanned: ${result.scanned.filesScanned}`);
			console.log(`  Comments found: ${result.scanned.commentsFound}`);
			console.log('');
			console.log(`📝 Sync Statistics:`);
			console.log(`  Created: ${result.statistics.created}`);
			console.log(`  Updated: ${result.statistics.updated}`);
			console.log(`  Closed: ${result.statistics.closed}`);
			console.log(`  Skipped: ${result.statistics.skipped}`);
			console.log(`  Failed: ${result.statistics.failed}`);

			if (result.created.length > 0) {
				console.log('');
				console.log('🔗 Created Issues:');
				for (const created of result.created) {
					console.log(`  #${created.issueNumber} - ${created.type} in ${created.filePath}:${created.lineNumber}`);
				}
			}

			if (args.dryRun) {
				console.log('');
				console.log('ℹ️  Dry run mode - no actual changes were made');
				console.log('   Run without --dry-run to create issues');
			}
		} else {
			logger.error('TODOs sync failed');

			console.error('');
			console.error('❌ TODOs sync completed with errors');
			console.error('');
			console.error(`Failed: ${result.statistics.failed}`);

			if (result.failed.length > 0) {
				console.error('');
				console.error('Failed comments:');
				for (const failure of result.failed) {
					console.error(`  ${failure.commentId}: ${failure.error}`);
				}
			}

			process.exit(1);
		}

		process.exit(0);
	} catch (error) {
		logger.error({ error: (error as Error).message }, 'TODOs sync error');

		console.error('');
		console.error('❌ TODOs sync error:', (error as Error).message);
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
