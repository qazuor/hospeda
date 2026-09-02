/**
 * The two halves of a command line, split at the first bare `--`.
 */
export interface SplitArgs {
    /** Arguments hops interprets itself. */
    readonly own: readonly string[];
    /** Arguments that belong to whatever hops is about to run. */
    readonly passthrough: readonly string[];
}

/**
 * Splits a command line at the first bare `--`.
 *
 * Everything after the separator is left completely untouched — not parsed,
 * not validated, not even looked at — because it is addressed to another
 * program. Without this boundary `hops run seed -- --help` prints hops' own
 * help instead of the seed CLI's, and `--wt` or `--target` meant for the
 * inner script would be eaten by the dispatcher.
 *
 * @param input.argv - The full argument list.
 * @returns The arguments hops owns and the ones it must forward verbatim.
 *
 * @example
 * ```ts
 * splitPassthrough({ argv: ['db:seed:migrate', '--', '--status'] });
 * // { own: ['db:seed:migrate'], passthrough: ['--status'] }
 * ```
 */
export function splitPassthrough({ argv }: { readonly argv: readonly string[] }): SplitArgs {
    const separator = argv.indexOf('--');
    if (separator === -1) return { own: argv, passthrough: [] };
    return { own: argv.slice(0, separator), passthrough: argv.slice(separator + 1) };
}
