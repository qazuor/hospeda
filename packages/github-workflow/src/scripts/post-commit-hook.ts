#!/usr/bin/env node
/**
 * Post-commit hook script
 *
 * Executable script for detecting completed tasks after commits.
 * Called by .husky/post-commit hook.
 *
 * @module scripts/post-commit-hook
 */

import { runPostCommitHook } from '../hooks/post-commit.js';

/**
 * Main execution
 */
async function main(): Promise<void> {
	try {
		await runPostCommitHook({
			projectRoot: process.cwd(),
			commitLimit: 1, // Only check the most recent commit
			dryRun: false,
			silent: true // Silent mode to avoid cluttering git output
		});

		process.exit(0);
	} catch (error) {
		// Don't fail the commit even if hook fails
		console.error('Post-commit hook failed (non-blocking):', (error as Error).message);
		process.exit(0); // Exit with success to not block git
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
