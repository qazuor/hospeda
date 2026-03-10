import { confirm, input } from '@inquirer/prompts';
import type Fuse from 'fuse.js';
import {
    formatDangerWarning,
    formatExecutionInfo,
    formatHelp,
    formatList,
    formatResult
} from './format.js';
import { recordCommand } from './history.js';
import { runCommand } from './runner.js';
import { searchCommands } from './search.js';
import type { CliCommand } from './types.js';

/** Parsed CLI arguments from direct mode invocation */
export interface ParsedArgs {
    readonly commandId: string | undefined;
    readonly help: boolean;
    readonly list: boolean;
    readonly listAll: boolean;
    readonly yes: boolean;
    readonly extraArgs: readonly string[];
}

/**
 * Parses CLI arguments for direct mode.
 * Extracts command ID, flags, and extra args (after --).
 */
export function parseCliArgs({ argv }: { argv: readonly string[] }): ParsedArgs {
    let help = false;
    let list = false;
    let listAll = false;
    let yes = false;
    let commandId: string | undefined;
    const extraArgs: string[] = [];

    const dashDashIndex = argv.indexOf('--');
    const mainArgs = dashDashIndex === -1 ? argv : argv.slice(0, dashDashIndex);
    const afterDash = dashDashIndex === -1 ? [] : argv.slice(dashDashIndex + 1);
    extraArgs.push(...afterDash);

    for (const arg of mainArgs) {
        switch (arg) {
            case '--help':
            case '-h':
                help = true;
                break;
            case '--list':
            case '-l':
                list = true;
                break;
            case '--list-all':
            case '-la':
                listAll = true;
                break;
            case '--yes':
            case '-y':
                yes = true;
                break;
            case '--all':
                listAll = true;
                break;
            default:
                if (arg.startsWith('-')) {
                    console.warn(`Warning: unknown flag '${arg}' ignored.`);
                } else if (commandId === undefined) {
                    commandId = arg;
                }
                break;
        }
    }

    if (listAll) {
        list = true;
    }

    return { commandId, help, list, listAll, yes, extraArgs };
}

/**
 * Handles direct mode CLI invocation with the parsed arguments.
 * Returns the process exit code.
 */
export async function handleDirect({
    args,
    allCommands,
    fuse
}: {
    args: ParsedArgs;
    allCommands: readonly CliCommand[];
    fuse: Fuse<CliCommand>;
}): Promise<number> {
    if (args.help) {
        const curatedCommands = allCommands.filter((c) => c.curated);
        console.log(formatHelp({ commands: curatedCommands }));
        return 0;
    }

    if (args.list) {
        const commands = args.listAll ? allCommands : allCommands.filter((c) => c.curated);
        console.log(formatList({ commands, showAll: args.listAll }));
        return 0;
    }

    if (!args.commandId) {
        console.log('No command specified. Use --help for usage info.');
        return 1;
    }

    // Strip ANSI escape sequences from user-provided command ID to prevent terminal injection
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching ANSI escape sequences
    const sanitizedId = args.commandId.replace(/\x1b\[[0-9;]*m/g, '');

    const exactMatch = allCommands.find((c) => c.id === sanitizedId);

    if (exactMatch) {
        return executeCommand({
            cmd: exactMatch,
            extraArgs: args.extraArgs,
            skipConfirm: args.yes
        });
    }

    const matches = searchCommands({ fuse, query: sanitizedId });
    if (matches.length === 0) {
        console.log(`Command '${sanitizedId}' not found. No similar commands found.`);
        return 1;
    }

    console.log(`Command '${sanitizedId}' not found. Did you mean:`);
    const top5 = matches.slice(0, 5);
    for (let i = 0; i < top5.length; i++) {
        const cmd = top5[i];
        if (cmd) {
            console.log(`  ${i + 1}. ${cmd.id} - ${cmd.description}`);
        }
    }

    try {
        const answer = await input({ message: 'Enter number to run (or press Enter to cancel):' });
        const choice = Number.parseInt(answer, 10);
        if (Number.isNaN(choice) || choice < 1 || choice > top5.length) {
            return 0;
        }
        const selectedCmd = top5[choice - 1];
        if (!selectedCmd) return 0;
        return executeCommand({
            cmd: selectedCmd,
            extraArgs: args.extraArgs,
            skipConfirm: args.yes
        });
    } catch {
        return 0;
    }
}

/**
 * Executes a single command with optional danger confirmation.
 */
async function executeCommand({
    cmd,
    extraArgs,
    skipConfirm
}: {
    cmd: CliCommand;
    extraArgs: readonly string[];
    skipConfirm: boolean;
}): Promise<number> {
    if (cmd.dangerous && !skipConfirm) {
        console.log(formatDangerWarning({ cmd }));
        try {
            const confirmed = await confirm({ message: 'Are you sure?', default: false });
            if (!confirmed) {
                console.log('Cancelled.');
                return 0;
            }
        } catch {
            return 0;
        }
    }

    console.log(formatExecutionInfo({ cmd }));
    console.log('');

    const start = Date.now();
    const exitCode = await runCommand({ cmd, extraArgs });
    const durationMs = Date.now() - start;

    console.log('');
    console.log(formatResult({ exitCode, durationMs }));

    await recordCommand({ id: cmd.id }).catch(() => {
        /* history write failures are non-fatal */
    });

    return exitCode;
}
