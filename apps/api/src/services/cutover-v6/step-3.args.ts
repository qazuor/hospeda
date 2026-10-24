import { z } from 'zod';

/** Parsed step 3 command line options. */
export interface Step3Args {
    readonly dryRun: boolean;
    readonly ownerIds?: readonly string[];
}

/** Result of parsing the strict step 3 command line. */
export type ParseStep3ArgsResult =
    | { readonly ok: true; readonly value: Step3Args }
    | { readonly ok: false; readonly reason: string };

/** Parses supported flags without reading environment or database state. */
export function parseStep3Args(input: { readonly argv: readonly string[] }): ParseStep3ArgsResult {
    const seen = new Set<string>();
    let ownerIds: readonly string[] | undefined;
    for (const arg of input.argv) {
        const separator = arg.indexOf('=');
        const flag = separator < 0 ? arg : arg.slice(0, separator);
        if (flag !== '--dry-run' && flag !== '--confirm-write-trials' && flag !== '--owner-ids')
            return { ok: false, reason: `Unknown flag: ${flag}` };
        if (flag === '--owner-ids') {
            if (separator < 0 || arg.slice(separator + 1).length === 0)
                return {
                    ok: false,
                    reason: 'Malformed flag: --owner-ids requires a non-empty CSV value.'
                };
            const ids = arg.slice(separator + 1).split(',');
            if (ids.some((id) => !z.uuid().safeParse(id).success))
                return { ok: false, reason: 'Malformed flag: --owner-ids must contain UUIDs.' };
            if (new Set(ids).size !== ids.length)
                return {
                    ok: false,
                    reason: 'Malformed flag: --owner-ids must not contain duplicate UUIDs.'
                };
            ownerIds = ids;
        } else if (separator >= 0) {
            return { ok: false, reason: `Malformed flag: ${flag} takes no value.` };
        }
        if (seen.has(flag)) return { ok: false, reason: `Repeated flag: ${flag}` };
        seen.add(flag);
    }
    const modeCount = Number(seen.has('--dry-run')) + Number(seen.has('--confirm-write-trials'));
    if (modeCount !== 1)
        return {
            ok: false,
            reason: 'Refusing to run: pass exactly one of --confirm-write-trials or --dry-run.'
        };
    return {
        ok: true,
        value: { dryRun: seen.has('--dry-run'), ...(ownerIds === undefined ? {} : { ownerIds }) }
    };
}
