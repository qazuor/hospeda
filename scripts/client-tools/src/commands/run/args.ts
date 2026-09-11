import type { RepoScript } from './scripts.ts';

/** What `hops run` understands on its own half of the command line. */
export interface ParsedRunArgs {
    /** Script id or search text, when one was given. */
    readonly query: string | undefined;
    /** Whether the full listing was asked for. */
    readonly list: boolean;
    /** Anything hops does not recognise, which must stop the run. */
    readonly unrecognized: readonly string[];
}

/**
 * Parses the arguments `hops run` owns, collecting whatever it cannot explain.
 *
 * Unknown arguments are COLLECTED rather than ignored, and the caller refuses
 * to run on any. That is not pedantry: the CLI this replaces used to warn and
 * then run the command without the flag, and on 2026-08-15 `db:seed:migrate
 * --status` therefore applied every pending data-migration — `seed_migrations`
 * went from 44 rows to 54, exit 0, the warning scrolled off the top of two
 * hundred lines of migration output. A warning is not a control.
 *
 * A second positional is unrecognised for the same reason: `hops run seed prod`
 * cannot be told from a typo, and guessing turns one into an execution. Both
 * belong after `--`, where the script validates its own surface.
 *
 * @param input.argv - Arguments before the `--` separator, with `--wt` and
 *                     `--target` already removed.
 * @returns The query, the list flag, and everything left over.
 *
 * @example
 * ```ts
 * parseRunArgs({ argv: ['db:seed:migrate', '--status'] });
 * // { query: 'db:seed:migrate', list: false, unrecognized: ['--status'] }
 * ```
 */
export function parseRunArgs({ argv }: { readonly argv: readonly string[] }): ParsedRunArgs {
    let query: string | undefined;
    const unrecognized: string[] = [];

    for (const arg of argv) {
        if (arg === '--list') continue;
        if (arg.startsWith('-') || query !== undefined) {
            unrecognized.push(arg);
            continue;
        }
        query = arg;
    }

    return { query, list: argv.includes('--list'), unrecognized };
}

/**
 * Builds the pnpm invocation for one script.
 *
 * The forwarded arguments go after a `--` of their own: without it pnpm reads
 * them as its own flags instead of handing them to the script.
 *
 * @param input.script      - The script to run.
 * @param input.passthrough - Arguments addressed to that script.
 * @returns The argument list for `pnpm`.
 *
 * @example
 * ```ts
 * buildPnpmArgs({ script: rootScript, passthrough: ['--status'] });
 * // ['run', 'db:seed:migrate', '--', '--status']
 * ```
 */
export function buildPnpmArgs({
    script,
    passthrough
}: {
    readonly script: RepoScript;
    readonly passthrough: readonly string[];
}): readonly string[] {
    const forwarded = passthrough.length > 0 ? ['--', ...passthrough] : [];
    return script.dir === '.'
        ? ['run', script.script, ...forwarded]
        : ['--filter', script.packageName, 'run', script.script, ...forwarded];
}
