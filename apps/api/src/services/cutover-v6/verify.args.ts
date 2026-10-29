/** Checks `cutover-v6-verify.ts` can run. */
export type VerifyCheckName = 'journal' | 'catalog';

/** Result of parsing the verifier command line. */
export type ParseVerifyArgsResult =
    | { readonly ok: true; readonly checks: readonly VerifyCheckName[] }
    | { readonly ok: false; readonly reason: string };

const FLAG_TO_CHECK: Readonly<Record<string, VerifyCheckName>> = {
    '--journal': 'journal',
    '--catalog': 'catalog'
};

/**
 * Parses the strict verifier command line: `--journal`, `--catalog` or both.
 * No value-bearing flags, no repeats, at least one check.
 *
 * @param input - argv without the node and script entries.
 * @returns The requested checks, or the refusal reason (exit 2).
 */
export function parseVerifyArgs(input: {
    readonly argv: readonly string[];
}): ParseVerifyArgsResult {
    const seen = new Set<VerifyCheckName>();
    for (const arg of input.argv) {
        const check = FLAG_TO_CHECK[arg];
        if (check === undefined) return { ok: false, reason: `Unknown flag: ${arg}` };
        if (seen.has(check)) return { ok: false, reason: `Repeated flag: ${arg}` };
        seen.add(check);
    }
    if (seen.size === 0) {
        return { ok: false, reason: 'Refusing to run: pass --journal, --catalog or both.' };
    }
    return { ok: true, checks: [...seen] };
}
