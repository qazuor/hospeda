import { Separator, confirm, input, search } from '@inquirer/prompts';
import type Fuse from 'fuse.js';
import { CATEGORY_DISPLAY_ORDER, CATEGORY_LABELS } from './categories.js';
import {
    MIN_ID_PAD,
    formatBanner,
    formatDangerWarning,
    formatExecutionInfo,
    formatResult
} from './format.js';
import { getRecentCommands, readHistory, recordCommand } from './history.js';
import { runCommand } from './runner.js';
import { searchCommands } from './search.js';
import type { CliCommand } from './types.js';
import { isExitPromptError } from './utils.js';

type SearchChoice = { name: string; value: string; description?: string };
type SearchItem = SearchChoice | Separator;

/** Width used to pad the separator fill after the category label */
const SEPARATOR_FILL_WIDTH = 48;

/**
 * Builds the choice array for the interactive search prompt.
 * Groups curated commands by category with separators, and optionally
 * prepends a "Recent" section based on history.
 */
export function buildChoices({
    commands,
    recentIds
}: {
    commands: readonly CliCommand[];
    recentIds: readonly string[];
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
        choices.push(
            new Separator(
                `── ${label} ${'─'.repeat(Math.max(0, SEPARATOR_FILL_WIDTH - label.length))}`
            )
        );
        for (const cmd of cmds) {
            choices.push(formatChoice({ cmd }));
        }
    }

    return choices;
}

/**
 * Runs the interactive CLI loop: shows the search prompt,
 * handles command selection, execution, and loop continuation.
 * History is re-read at the start of each iteration so the
 * "Recent" section reflects commands run during the current session.
 */
export async function runInteractiveLoop({
    allCommands,
    fuse
}: {
    allCommands: readonly CliCommand[];
    fuse: Fuse<CliCommand>;
}): Promise<void> {
    console.log(formatBanner());
    console.log('');

    while (true) {
        try {
            const currentHistory = await readHistory();
            const recent = getRecentCommands({ history: currentHistory });
            const recentIds = recent.map((e) => e.id);
            const currentChoices = buildChoices({ commands: allCommands, recentIds });

            const commandId = await search<string>({
                message: 'Select a command (type to search):',
                source: async (searchInput) => {
                    if (!searchInput || searchInput.trim().length === 0) {
                        return currentChoices;
                    }
                    const results = searchCommands({ fuse, query: searchInput });
                    return results.map((cmd) => formatChoice({ cmd }));
                }
            });

            const cmd = allCommands.find((c) => c.id === commandId);
            if (!cmd) continue;

            if (cmd.dangerous) {
                console.log(formatDangerWarning({ cmd }));
                try {
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

            await input({ message: 'Press Enter to return to menu...' });
            console.clear();
            console.log(formatBanner());
            console.log('');
        } catch (error: unknown) {
            if (isExitPromptError(error)) {
                return;
            }
            throw error;
        }
    }
}

/** Formats a CliCommand as a search prompt choice */
function formatChoice({ cmd }: { cmd: CliCommand }): SearchChoice {
    const dangerPrefix = cmd.dangerous ? '⚠ ' : '';
    const id = cmd.id.padEnd(MIN_ID_PAD);
    return {
        name: `${id}${dangerPrefix}${cmd.description}`,
        value: cmd.id,
        description: `[${cmd.source}]`
    };
}
