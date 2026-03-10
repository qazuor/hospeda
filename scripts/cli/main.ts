import { handleDirect, parseCliArgs } from './direct.js';
import { discoverCommands } from './discovery.js';
import { runInteractiveLoop } from './interactive.js';
import { getCuratedCommands } from './registry.js';
import { createSearchIndex } from './search.js';
import type { CliCommand } from './types.js';
import { findMonorepoRoot, isExitPromptError } from './utils.js';

/**
 * Main entry point for the Hospeda CLI tool.
 * Parses arguments, loads commands, and routes to the appropriate mode.
 *
 * @returns Exit code: 0 for success, 1 for unexpected error.
 */
export async function main(): Promise<number> {
    try {
        const argv = process.argv.slice(2);
        const curated = getCuratedCommands();
        const rootDir = findMonorepoRoot();

        const discovered = await discoverCommands({ curatedCommands: curated, rootDir });
        const allCommands: readonly CliCommand[] = [...curated, ...discovered];
        const fuse = createSearchIndex({ commands: allCommands });

        if (argv.length > 0) {
            const args = parseCliArgs({ argv });
            return await handleDirect({ args, allCommands, fuse });
        }

        await runInteractiveLoop({ allCommands, fuse });
        return 0;
    } catch (error: unknown) {
        if (isExitPromptError(error)) {
            return 0;
        }
        console.error('Unexpected error:', error);
        return 1;
    }
}
