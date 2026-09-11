import pc from 'picocolors';
import { type Target, targetStyle } from './target.ts';

/** Width used when the terminal does not report one (a pipe, a CI log). */
const FALLBACK_WIDTH = 80;

/** Widest bar we draw, so a maximised terminal does not get a ruler. */
const MAX_WIDTH = 100;

/** Longest subject kept in the badge before it is truncated. */
const MAX_SUBJECT = 34;

/** Everything the bar needs to describe the run. */
export interface BarContext {
    /** Where the command is acting. */
    readonly target: Target;
    /**
     * What is being acted on, painted INSIDE the badge.
     *
     * The worktree belongs in the badge rather than on a line below it: it is
     * half of "where does this run", and splitting that across the coloured
     * band and the plain text under it makes the reader assemble it themselves.
     */
    readonly subject?: string;
    /** Extra lines under the bar: database, container. */
    readonly lines: readonly string[];
}

/** Builds the badge text, truncating a long subject rather than wrapping. */
function badgeText({
    label,
    subject
}: {
    readonly label: string;
    readonly subject: string | undefined;
}): string {
    if (subject === undefined || subject.length === 0) return ` hops · ${label} `;
    const trimmed =
        subject.length > MAX_SUBJECT ? `${subject.slice(0, MAX_SUBJECT - 1)}…` : subject;
    return ` hops · ${label} · ${trimmed} `;
}

/** Resolves the width to draw at. */
function barWidth(columns: number | undefined): number {
    return Math.min(columns && columns > 20 ? columns : FALLBACK_WIDTH, MAX_WIDTH);
}

/**
 * Renders the opening bar.
 *
 * The target badge is the first thing on screen on every single run, coloured
 * per environment, because `hops` will eventually drive the VPS too and a
 * command aimed at production must never look like one aimed at this laptop.
 *
 * @param input.context - Target and context lines.
 * @param input.columns - Terminal width.
 * @returns The bar, ready to write.
 */
export function renderOpen({
    context,
    columns = process.stdout.columns
}: {
    readonly context: BarContext;
    readonly columns?: number;
}): string {
    const style = targetStyle({ target: context.target });
    const text = badgeText({ label: style.label, subject: context.subject });
    const badge = `${style.open}${text}${style.close}`;
    const width = barWidth(columns);
    const fill = Math.max(0, width - text.length - 2);
    const lines = [`${badge}${pc.dim('━'.repeat(fill))}`];
    for (const line of context.lines) lines.push(`  ${line}`);
    return `${lines.join('\n')}\n`;
}

/**
 * Renders the closing bar.
 *
 * It repeats the target on purpose. A command that ran for two minutes is read
 * from the bottom, and "where did this run" is exactly what you need again at
 * the moment you read the result.
 *
 * @param input.target     - Where the command acted.
 * @param input.ok         - Whether it succeeded.
 * @param input.durationMs - How long it took.
 * @param input.columns    - Terminal width.
 * @returns The bar, ready to write.
 */
export function renderClose({
    target,
    subject,
    ok,
    durationMs,
    columns = process.stdout.columns
}: {
    readonly target: Target;
    readonly subject?: string;
    readonly ok: boolean;
    readonly durationMs: number;
    readonly columns?: number;
}): string {
    const style = targetStyle({ target });
    const text = badgeText({ label: style.label, subject });
    const badge = `${style.open}${text}${style.close}`;
    const visible = text.length;
    const mark = ok ? pc.green('✓') : pc.red('✗');
    const took = formatDuration({ ms: durationMs });
    // Measured on the visible text, not the coloured string: an escape sequence
    // has length but no width, and counting it shortens every bar.
    const tailWidth = took.length + 3;
    const width = barWidth(columns);
    const fill = Math.max(1, width - visible - tailWidth - 2);
    return `${badge}${pc.dim('━'.repeat(fill))} ${pc.dim(took)} ${mark}\n`;
}

/**
 * Formats an elapsed time compactly.
 *
 * @param input.ms - Elapsed milliseconds.
 * @returns e.g. `840ms`, `3.2s`, `2m 05s`.
 */
export function formatDuration({ ms }: { readonly ms: number }): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Wraps a command run in the opening and closing bars.
 *
 * Every command goes through this, so none can ship without saying where it
 * ran — including the ones that fail early.
 *
 * @param input.context - Target and context lines.
 * @param input.run     - The work to perform.
 * @returns The exit code returned by `run`.
 */
export async function withStatusBar({
    context,
    run
}: {
    readonly context: BarContext;
    readonly run: () => Promise<number>;
}): Promise<number> {
    process.stderr.write(renderOpen({ context }));
    const started = Date.now();
    let code = 1;
    try {
        code = await run();
        return code;
    } finally {
        process.stderr.write(
            renderClose({
                target: context.target,
                subject: context.subject,
                ok: code === 0,
                durationMs: Date.now() - started
            })
        );
    }
}
