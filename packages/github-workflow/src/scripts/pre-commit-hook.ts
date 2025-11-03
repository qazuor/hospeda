#!/usr/bin/env node
/**
 * Pre-commit hook script
 *
 * Executable script for syncing TODO comments before commits.
 * Called by .husky/pre-commit hook.
 *
 * @module scripts/pre-commit-hook
 */

import { runPreCommitHook } from '../hooks/pre-commit.js';

/**
 * Main execution
 */
async function main(): Promise<void> {
    try {
        await runPreCommitHook({
            projectRoot: process.cwd(),
            updateExisting: true, // Update existing issues if comment changed
            dryRun: false,
            silent: true // Silent mode to avoid cluttering git output
        });

        process.exit(0);
    } catch (error) {
        // Don't fail the commit even if hook fails
        console.error('Pre-commit hook failed (non-blocking):', (error as Error).message);
        process.exit(0); // Exit with success to not block git
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
