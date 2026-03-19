/**
 * Terminal formatting utilities for env management scripts.
 *
 * Provides ANSI color helpers and structured diff/summary formatters
 * used by pull.ts, push.ts, and check.ts output.
 *
 * @module scripts/env/utils/formatters
 */

/**
 * ANSI color and style helpers for terminal output.
 * Each function wraps a string with the appropriate escape codes.
 *
 * @example
 * ```ts
 * console.log(colors.green('Success!'));
 * console.log(colors.bold(colors.red('Error!')));
 * ```
 */
export const colors = {
    /** Wraps text in green (success). */
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    /** Wraps text in red (error / removal). */
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    /** Wraps text in yellow (warning / changed). */
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    /** Wraps text in cyan (info / key names). */
    cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
    /** Wraps text in dim style (secondary information). */
    dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
    /** Wraps text in bold style (emphasis). */
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`
} as const;

/**
 * Parameters for formatting a single variable diff line.
 */
interface FormatDiffParams {
    /** Variable name. */
    readonly key: string;
    /** Current local value (undefined if not set locally). */
    readonly local: string | undefined;
    /** Current remote (Vercel) value (undefined if not set remotely). */
    readonly remote: string | undefined;
    /** Optional human-readable description from the registry. */
    readonly description?: string;
    /** When true, all values are masked (for secret/sensitive variables). */
    readonly secret?: boolean;
}

/**
 * Masks a secret value for display by showing only the first 4 characters.
 * Returns `(not set)` for undefined values.
 *
 * @param value - The value to mask.
 * @returns Masked display string.
 */
function maskValue(value: string | undefined): string {
    if (value === undefined) return colors.dim('(not set)');
    if (value.length === 0) return colors.dim('(empty)');
    if (value.length <= 4) return '*'.repeat(value.length);
    return `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 4, 8))}`;
}

/**
 * Truncates a value for safe display, without masking.
 * Long values are truncated with ellipsis.
 *
 * @param value - The value to display.
 * @returns Display-safe string.
 */
function displayValue(value: string | undefined): string {
    if (value === undefined) return colors.dim('(not set)');
    if (value.length === 0) return colors.dim('(empty)');
    const maxLen = 60;
    return value.length > maxLen ? `${value.slice(0, maxLen)}...` : value;
}

/**
 * Formats a diff line for a single environment variable, showing
 * the local and remote values side by side.
 *
 * - New (only in remote): shown in green
 * - Changed (both exist but differ): shown in yellow
 * - Missing (only in local): shown in red
 * - Same (values equal): shown in dim
 *
 * @param params - Key, local value, remote value, and optional description.
 * @returns Formatted multi-line string for terminal output.
 *
 * @example
 * ```ts
 * console.log(formatDiff({
 *   key: 'HOSPEDA_API_URL',
 *   local: 'http://localhost:3001',
 *   remote: 'https://api.example.com',
 * }));
 * ```
 */
export function formatDiff(params: FormatDiffParams): string {
    const { key, local, remote, description, secret } = params;
    const lines: string[] = [];
    const show = secret ? maskValue : displayValue;

    const label = colors.cyan(colors.bold(key));
    const desc = description ? colors.dim(` # ${description}`) : '';
    lines.push(`  ${label}${desc}`);

    const isNew = remote !== undefined && local === undefined;
    const isMissing = local !== undefined && remote === undefined;
    const isChanged = local !== undefined && remote !== undefined && local !== remote;
    const isSame = local !== undefined && remote !== undefined && local === remote;

    if (isNew) {
        lines.push(`    ${colors.dim('local :')} ${colors.dim('(not set)')}`);
        lines.push(`    ${colors.dim('remote:')} ${colors.green(show(remote))}`);
        lines.push(`    ${colors.green('+ New variable')}`);
    } else if (isMissing) {
        lines.push(`    ${colors.dim('local :')} ${show(local)}`);
        lines.push(`    ${colors.dim('remote:')} ${colors.dim('(not set)')}`);
        lines.push(`    ${colors.red('- Not in remote')}`);
    } else if (isChanged) {
        lines.push(`    ${colors.dim('local :')} ${colors.yellow(show(local))}`);
        lines.push(`    ${colors.dim('remote:')} ${colors.yellow(show(remote))}`);
        lines.push(`    ${colors.yellow('~ Values differ')}`);
    } else if (isSame) {
        lines.push(`    ${colors.dim('local :')} ${colors.dim(show(local))}`);
        lines.push(`    ${colors.dim('remote:')} ${colors.dim(show(remote))}`);
        lines.push(`    ${colors.dim('= Identical')}`);
    } else {
        lines.push(`    ${colors.dim('(both undefined)')}`);
    }

    return lines.join('\n');
}

/**
 * Parameters for formatting an operation summary.
 */
interface FormatSummaryParams {
    /** Number of variables added or written. */
    readonly added: number;
    /** Number of variables updated. */
    readonly updated: number;
    /** Number of variables skipped (no change or user declined). */
    readonly skipped: number;
}

/**
 * Formats a concise operation summary line for display after a pull or push.
 *
 * @param params - Counts of added, updated, and skipped operations.
 * @returns A formatted summary string.
 *
 * @example
 * ```ts
 * console.log(formatSummary({ added: 2, updated: 1, skipped: 5 }));
 * // "Summary: +2 added  ~1 updated  .5 skipped"
 * ```
 */
export function formatSummary(params: FormatSummaryParams): string {
    const { added, updated, skipped } = params;
    const parts: string[] = [];
    parts.push(colors.green(`+${added} added`));
    parts.push(colors.yellow(`~${updated} updated`));
    parts.push(colors.dim(`.${skipped} skipped`));
    return `${colors.bold('Summary:')} ${parts.join('  ')}`;
}

/**
 * Formats a section header for grouping output by app or environment.
 *
 * @param title - Header title text.
 * @returns Formatted header string with decorative borders.
 *
 * @example
 * ```ts
 * console.log(formatHeader('API - production'));
 * ```
 */
export function formatHeader(title: string): string {
    const border = '─'.repeat(title.length + 4);
    return [
        '',
        colors.cyan(`┌${border}┐`),
        colors.cyan(`│  ${colors.bold(title)}  │`),
        colors.cyan(`└${border}┘`),
        ''
    ].join('\n');
}

/**
 * Formats a check result row for the audit output in check.ts.
 *
 * @param key - Variable name.
 * @param status - `'ok'`, `'missing'`, or `'extra'`.
 * @param detail - Optional detail string appended after the status.
 * @returns Formatted single-line string.
 */
export function formatCheckRow(
    key: string,
    status: 'ok' | 'missing' | 'extra',
    detail?: string
): string {
    const icon =
        status === 'ok'
            ? colors.green('✓')
            : status === 'missing'
              ? colors.red('✗')
              : colors.yellow('?');
    const keyStr = colors.cyan(key.padEnd(50));
    const detailStr = detail ? colors.dim(` ${detail}`) : '';
    return `  ${icon} ${keyStr}${detailStr}`;
}
