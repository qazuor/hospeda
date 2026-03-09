import { CATEGORY_DISPLAY_ORDER, CATEGORY_LABELS } from './categories.js';
import type { CliCommand, CommandCategory } from './types.js';

const CLI_VERSION = '1.0.0';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

const ID_PAD = 22;
const DESC_PAD = 50;

/**
 * Formats the CLI banner with version string.
 */
export function formatBanner(): string {
    const title = `Hospeda CLI v${CLI_VERSION}`;
    const line = '─'.repeat(title.length + 4);
    return [
        `  ${CYAN}╭${line}╮${RESET}`,
        `  ${CYAN}│${RESET}  ${BOLD}${title}${RESET}  ${CYAN}│${RESET}`,
        `  ${CYAN}╰${line}╯${RESET}`
    ].join('\n');
}

/**
 * Formats a single command line with aligned columns.
 * Dangerous commands get a warning prefix.
 */
export function formatCommandLine({ cmd }: { cmd: CliCommand }): string {
    const prefix = cmd.dangerous ? `${YELLOW}⚠${RESET} ` : '  ';
    const id = cmd.id.padEnd(ID_PAD);
    const desc = cmd.description.padEnd(DESC_PAD);
    const source = `${DIM}[${cmd.source}]${RESET}`;
    return `${prefix}${id}${desc}${source}`;
}

/**
 * Formats the full help output grouped by category.
 */
export function formatHelp({ commands }: { commands: readonly CliCommand[] }): string {
    const lines: string[] = [
        formatBanner(),
        '',
        `  Usage: ${BOLD}pnpm cli${RESET} [command] [options] [-- extra-args]`,
        '',
        '  Options:',
        `    ${BOLD}-h, --help${RESET}       Show this help message`,
        `    ${BOLD}-l, --list${RESET}       List all curated commands`,
        `    ${BOLD}-la, --list-all${RESET}  List all discovered commands`,
        `    ${BOLD}-y, --yes${RESET}        Skip confirmation for dangerous commands`,
        ''
    ];

    const byCategory = groupByCategory({ commands });

    for (const category of CATEGORY_DISPLAY_ORDER) {
        const cmds = byCategory.get(category);
        if (!cmds || cmds.length === 0) continue;

        lines.push(`  ${BOLD}${CATEGORY_LABELS[category]}:${RESET}`);
        for (const cmd of cmds) {
            lines.push(`  ${formatCommandLine({ cmd })}`);
        }
        lines.push('');
    }

    lines.push(`  Run '${BOLD}pnpm cli <command>${RESET}' to execute directly.`);
    lines.push(`  Run '${BOLD}pnpm cli${RESET}' with no arguments for interactive mode.`);

    return lines.join('\n');
}

/**
 * Formats commands as a plain-text list (for piping).
 * When showAll is true, includes the source tag.
 */
export function formatList({
    commands,
    showAll = false
}: {
    commands: readonly CliCommand[];
    showAll?: boolean;
}): string {
    const lines: string[] = [];

    for (const cmd of commands) {
        const id = cmd.id.padEnd(ID_PAD);
        const desc = cmd.description;
        if (showAll) {
            lines.push(`${id}${desc.padEnd(DESC_PAD)}[${cmd.source}]`);
        } else {
            lines.push(`${id}${desc}`);
        }
    }

    return lines.join('\n');
}

/**
 * Formats the execution info shown before a command runs.
 */
export function formatExecutionInfo({ cmd }: { cmd: CliCommand }): string {
    const lines: string[] = [`  ${CYAN}▶${RESET} Running: ${BOLD}${cmd.id}${RESET}`];

    const shellCmd = buildDisplayCommand({ cmd });
    lines.push(`  ${CYAN}▶${RESET} Command: ${shellCmd}`);
    lines.push(`  ${CYAN}▶${RESET} Directory: ${process.cwd()}`);

    if (cmd.argHint) {
        lines.push(`  ${DIM}Tip: supports ${cmd.argHint}${RESET}`);
    }

    return lines.join('\n');
}

/**
 * Formats the result line shown after a command completes.
 */
export function formatResult({
    exitCode,
    durationMs
}: {
    exitCode: number;
    durationMs: number;
}): string {
    const duration = formatDuration({ ms: durationMs });
    if (exitCode === 0) {
        return `  ${GREEN}✓${RESET} Completed in ${duration} (exit code: 0)`;
    }
    return `  ${RED}✗${RESET} Failed in ${duration} (exit code: ${exitCode})`;
}

/**
 * Formats the danger confirmation message for dangerous commands.
 */
export function formatDangerWarning({ cmd }: { cmd: CliCommand }): string {
    return [`  ${YELLOW}⚠ Dangerous command: ${cmd.id}${RESET}`, `  ${cmd.dangerMessage}`, ''].join(
        '\n'
    );
}

/** Groups commands by their category */
function groupByCategory({
    commands
}: {
    commands: readonly CliCommand[];
}): Map<CommandCategory, CliCommand[]> {
    const map = new Map<CommandCategory, CliCommand[]>();
    for (const cmd of commands) {
        const list = map.get(cmd.category) ?? [];
        list.push(cmd);
        map.set(cmd.category, list);
    }
    return map;
}

/** Builds the display string for the actual shell command */
function buildDisplayCommand({ cmd }: { cmd: CliCommand }): string {
    switch (cmd.execution.type) {
        case 'pnpm-root':
            return `pnpm run ${cmd.execution.script}`;
        case 'pnpm-filter':
            return `pnpm --filter ${cmd.execution.filter} ${cmd.execution.script}`;
        case 'shell':
            return cmd.execution.command;
    }
}

/** Formats milliseconds as a human-readable duration */
function formatDuration({ ms }: { ms: number }): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
