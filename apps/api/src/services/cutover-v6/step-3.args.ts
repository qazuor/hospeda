/** Parsed step 3 command line options. */
export interface Step3Args {
    readonly dryRun: boolean;
}

/** Result of parsing the strict step 3 command line. */
export type ParseStep3ArgsResult =
    | { readonly ok: true; readonly value: Step3Args }
    | { readonly ok: false; readonly reason: string };

/** Parses supported flags without reading environment or database state. */
export function parseStep3Args(input: { readonly argv: readonly string[] }): ParseStep3ArgsResult {
    const seen = new Set<string>();
    for (const arg of input.argv) {
        const separator = arg.indexOf('=');
        const flag = separator < 0 ? arg : arg.slice(0, separator);
        if (flag !== '--dry-run' && flag !== '--confirm-write-trials')
            return { ok: false, reason: `Unknown flag: ${flag}` };
        if (separator >= 0) return { ok: false, reason: `Malformed flag: ${flag} takes no value.` };
        if (seen.has(flag)) return { ok: false, reason: `Repeated flag: ${flag}` };
        seen.add(flag);
    }
    if (seen.size !== 1)
        return {
            ok: false,
            reason: 'Refusing to run: pass exactly one of --confirm-write-trials or --dry-run.'
        };
    return { ok: true, value: { dryRun: seen.has('--dry-run') } };
}
