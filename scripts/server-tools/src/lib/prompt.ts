/**
 * Small wrappers around `@clack/prompts` that the rest of the toolkit
 * uses to ask for confirmations and pick from numbered lists. Centralising
 * these here keeps the look-and-feel consistent and gives a single place
 * to swap the underlying prompt library if we ever need to.
 */

import * as p from '@clack/prompts';
import { log } from './log.ts';

/**
 * Ask a yes/no question. Returns true on yes. Cancels (Ctrl+C) abort
 * the process with status 0 — the caller does NOT need to check.
 */
export async function confirm(
    message: string,
    opts: { defaultValue?: boolean } = {}
): Promise<boolean> {
    const answer = await p.confirm({
        message,
        initialValue: opts.defaultValue ?? false
    });
    if (p.isCancel(answer)) {
        log.warn('Cancelled.');
        process.exit(0);
    }
    return answer;
}

/**
 * Pick one item from a numbered list. The list is rendered as
 * `[N] label   hint`. Cancellation aborts the process.
 *
 * `extractor` controls how each option is summarised — useful for
 * objects that aren't strings (e.g. backups with date + size).
 */
export async function pickOne<T>(
    message: string,
    options: ReadonlyArray<T>,
    extractor: (item: T, index: number) => { readonly label: string; readonly hint?: string }
): Promise<T> {
    if (options.length === 0) {
        throw new Error(`pickOne: cannot pick from an empty list (${message})`);
    }

    const choice = await p.select({
        message,
        options: options.map((item, i) => {
            const meta = extractor(item, i);
            return {
                value: i,
                label: `[${i + 1}] ${meta.label}`,
                hint: meta.hint
            };
        })
    });

    if (p.isCancel(choice)) {
        log.warn('Cancelled.');
        process.exit(0);
    }

    const picked = options[choice as number];
    if (!picked) {
        throw new Error(
            `pickOne: index ${String(choice)} is out of range (length ${options.length})`
        );
    }
    return picked;
}

/**
 * Resolve "the user typed `--N` or a number on the command line" to an
 * index into the given list. Returns `null` when no such argument was
 * supplied; callers fall through to the interactive picker. Throws when
 * the argument is present but out of range.
 */
export function resolveNumberArg<T>(
    args: ReadonlyArray<string>,
    options: ReadonlyArray<T>
): T | null {
    const numericArg = args.find((a) => /^\d+$/.test(a));
    if (!numericArg) return null;
    const index = Number.parseInt(numericArg, 10) - 1;
    if (index < 0 || index >= options.length) {
        throw new Error(
            `Index ${numericArg} is out of range. The list has ${options.length} item(s).`
        );
    }
    return options[index] ?? null;
}
