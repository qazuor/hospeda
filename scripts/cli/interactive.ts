import { Separator, search } from '@inquirer/prompts';
import type Fuse from 'fuse.js';
import { CATEGORY_DISPLAY_ORDER, CATEGORY_LABELS } from './categories.js';
import { formatBanner, formatDangerWarning, formatExecutionInfo, formatResult } from './format.js';
import { getRecentCommands, recordCommand } from './history.js';
import { runCommand } from './runner.js';
import { searchCommands } from './search.js';
import type { CliCommand, CliHistory } from './types.js';

type SearchChoice = { name: string; value: string; description?: string };
type SearchItem = SearchChoice | Separator;

/**
 * Builds the choice array for the interactive search prompt.
 * Groups curated commands by category with separators, and optionally
 * prepends a "Recent" section based on history.
 */
export function buildChoices({
    commands,
    recentIds,
    _categories
}: {
    commands: readonly CliCommand[];
    recentIds: readonly string[];
    _categories?: undefined;
}): SearchItem[] {
    const choices: SearchItem[] = [];
    const curatedCommands = commands.filter((c) => c.curated);

    if (recentIds.length > 0) {
        choices.push(new Separator('── Recent ──────────────────────────────────────────'));
        for (const id of recentIds) {
            const cmd = commands.find((c) => c.id === id);
            if (cmd) {
                choices.push(formatChoice({ cmd }));
            }
        }
    }

    const byCategory = new Map<string, CliCommand[]>();
    for (const cmd of curatedCommands) {
        const list = byCategory.get(cmd.category) ?? [];
        list.push(cmd);
        byCategory.set(cmd.category, list);
    }

    for (const category of CATEGORY_DISPLAY_ORDER) {
        const cmds = byCategory.get(category);
        if (!cmds || cmds.length === 0) continue;
        const label = CATEGORY_LABELS[category];
        choices.push(new Separator(`── ${label} ${'─'.repeat(Math.max(0, 48 - label.length))}`));
        for (const cmd of cmds) {
            choices.push(formatChoice({ cmd }));
        }
    }

    return choices;
}

/**
 * Runs the interactive CLI loop: shows the search prompt,
 * handles command selection, execution, and loop continuation.
 */
export async function runInteractiveLoop({
    allCommands,
    history,
    fuse
}: {
    allCommands: readonly CliCommand[];
    history: CliHistory;
    fuse: Fuse<CliCommand>;
}): Promise<void> {
    console.log(formatBanner());
    console.log('');

    const recent = getRecentCommands({ history });
    const recentIds = recent.map((e) => e.id);
    const defaultChoices = buildChoices({ commands: allCommands, recentIds });

    while (true) {
        try {
            const commandId = await search<string>({
                message: 'Select a command (type to search):',
                source: async (input) => {
                    if (!input || input.trim().length === 0) {
                        return defaultChoices;
                    }
                    const results = searchCommands({ fuse, query: input });
                    return results.map((cmd) => formatChoice({ cmd }));
                }
            });

            const cmd = allCommands.find((c) => c.id === commandId);
            if (!cmd) continue;

            if (cmd.dangerous) {
                console.log(formatDangerWarning({ cmd }));
                try {
                    const { confirm } = await import('@inquirer/prompts');
                    const confirmed = await confirm({ message: 'Are you sure?', default: false });
                    if (!confirmed) {
                        console.log('Cancelled.');
                        continue;
                    }
                } catch {
                    continue;
                }
            }

            console.log('');
            console.log(formatExecutionInfo({ cmd }));
            console.log('');

            const start = Date.now();
            const exitCode = await runCommand({ cmd });
            const durationMs = Date.now() - start;

            console.log('');
            console.log(formatResult({ exitCode, durationMs }));

            await recordCommand({ id: cmd.id }).catch(() => {
                /* non-fatal */
            });

            if (cmd.mode === 'long-running' || cmd.mode === 'interactive') {
                process.exit(exitCode);
            }

            const { input } = await import('@inquirer/prompts');
            await input({ message: 'Press Enter to return to menu...' });
            console.clear();
            console.log(formatBanner());
            console.log('');
        } catch (error: unknown) {
            if (
                error !== null &&
                typeof error === 'object' &&
                'name' in error &&
                (error as { name: string }).name === 'ExitPromptError'
            ) {
                return;
            }
            throw error;
        }
    }
}

/** Formats a CliCommand as a search prompt choice */
function formatChoice({ cmd }: { cmd: CliCommand }): SearchChoice {
    const dangerPrefix = cmd.dangerous ? '⚠ ' : '';
    const id = cmd.id.padEnd(20);
    return {
        name: `${id}${dangerPrefix}${cmd.description}`,
        value: cmd.id,
        description: `[${cmd.source}]`
    };
}
