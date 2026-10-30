import { z } from 'zod';

/** Parsed command line values for the step 3b tool. */
export interface Step3bArgs {
    readonly actorUserId: string;
    readonly beneficiaryUserIds: readonly [string, string];
    readonly planId: string;
    readonly floorPlanVersionId: string;
    readonly includesAddons: boolean;
    readonly dryRun: boolean;
}

/** Result of parsing the strict step 3b command line. */
export type ParseStep3bArgsResult =
    | { readonly ok: true; readonly value: Step3bArgs }
    | { readonly ok: false; readonly reason: string };

const uuid = z.string().uuid();
const UUID_FLAGS = new Set([
    '--actor-user-id',
    '--beneficiary',
    '--plan-id',
    '--floor-plan-version-id'
]);
const ALLOWED_FLAGS = new Set([...UUID_FLAGS, '--includes-addons', '--dry-run', '--confirm']);

/** Parses all supported flags without reading environment or database state. */
export function parseStep3bArgs(input: {
    readonly argv: readonly string[];
}): ParseStep3bArgsResult {
    const values = new Map<string, string[]>();
    const seenSwitches = new Set<string>();
    let dryRun = false;
    let confirm = false;
    for (const arg of input.argv) {
        const separator = arg.indexOf('=');
        const flag = separator < 0 ? arg : arg.slice(0, separator);
        if (!ALLOWED_FLAGS.has(flag)) return { ok: false, reason: `Unknown flag: ${flag}` };
        if (flag === '--dry-run' || flag === '--confirm') {
            if (separator >= 0)
                return { ok: false, reason: `Malformed flag: ${flag} takes no value.` };
            if (seenSwitches.has(flag)) return { ok: false, reason: `Repeated flag: ${flag}` };
            seenSwitches.add(flag);
            if (flag === '--dry-run') dryRun = true;
            else confirm = true;
            continue;
        }
        if (separator < 0) return { ok: false, reason: `Malformed flag: ${arg}` };
        const value = arg.slice(separator + 1);
        const list = values.get(flag) ?? [];
        list.push(value);
        values.set(flag, list);
    }
    for (const flag of values.keys()) {
        if (flag === '--beneficiary') {
            if ((values.get(flag)?.length ?? 0) > 2)
                return { ok: false, reason: 'Repeated flag: --beneficiary (maximum two).' };
        } else if ((values.get(flag)?.length ?? 0) > 1) {
            return { ok: false, reason: `Repeated flag: ${flag}` };
        }
    }
    if (dryRun === confirm) {
        return {
            ok: false,
            reason: 'Refusing to run: pass exactly one of --confirm or --dry-run.'
        };
    }
    const actorUserId = values.get('--actor-user-id')?.[0];
    const beneficiaries = values.get('--beneficiary') ?? [];
    const planId = values.get('--plan-id')?.[0];
    const floorPlanVersionId = values.get('--floor-plan-version-id')?.[0];
    const includesAddonsRaw = values.get('--includes-addons')?.[0];
    const firstBeneficiary = beneficiaries[0];
    const secondBeneficiary = beneficiaries[1];
    if (
        !actorUserId ||
        !firstBeneficiary ||
        !secondBeneficiary ||
        beneficiaries.length !== 2 ||
        !planId ||
        !floorPlanVersionId ||
        includesAddonsRaw === undefined
    ) {
        return {
            ok: false,
            reason: 'Missing required flag: actor, two beneficiaries, plan, floor version, and includes-addons are required.'
        };
    }
    if (includesAddonsRaw !== 'true' && includesAddonsRaw !== 'false') {
        return { ok: false, reason: 'Malformed flag: --includes-addons must be true or false.' };
    }
    const ids = [actorUserId, ...beneficiaries, planId, floorPlanVersionId];
    if (ids.some((id) => !uuid.safeParse(id).success))
        return { ok: false, reason: 'Malformed UUID in command line arguments.' };
    if (new Set(beneficiaries).size !== 2)
        return { ok: false, reason: 'The two --beneficiary values must be distinct.' };
    return {
        ok: true,
        value: {
            actorUserId,
            beneficiaryUserIds: [firstBeneficiary, secondBeneficiary],
            planId,
            floorPlanVersionId,
            includesAddons: includesAddonsRaw === 'true',
            dryRun
        }
    };
}
