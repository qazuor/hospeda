import { handleDirect, parseCliArgs } from './direct.js';
import { discoverCommands } from './discovery.js';
import { readHistory } from './history.js';
import { findMonorepoRoot } from './history.js';
import { runInteractiveLoop } from './interactive.js';
import { getCuratedCommands } from './registry.js';
import { createSearchIndex } from './search.js';
import type { CliCommand } from './types.js';

/**
 * Main entry point for the Hospeda CLI tool.
 * Parses arguments, loads commands, and routes to the appropriate mode.
 */
export async function main(): Promise<void> {
    try {
        const argv = process.argv.slice(2);
        const curated = getCuratedCommands();
        const rootDir = findMonorepoRoot();

        const [discovered, history] = await Promise.all([
            discoverCommands({ curatedCommands: curated, rootDir }),
            readHistory()
        ]);

        const allCommands: readonly CliCommand[] = [...curated, ...discovered];
        const fuse = createSearchIndex({ commands: allCommands });

        if (argv.length > 0) {
            const args = parseCliArgs({ argv });
            const exitCode = await handleDirect({ args, allCommands, fuse });
            process.exit(exitCode);
        }

        await runInteractiveLoop({ allCommands, history, fuse });
        process.exit(0);
    } catch (error: unknown) {
        if (
            error !== null &&
            typeof error === 'object' &&
            'name' in error &&
            (error as { name: string }).name === 'ExitPromptError'
        ) {
            process.exit(0);
        }
        console.error('Unexpected error:', error);
        process.exit(1);
    }
}
