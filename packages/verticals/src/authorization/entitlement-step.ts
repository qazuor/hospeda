import { getCatalogKey, type VerticalEnum } from '@repo/schemas';
import type { RehydratedEffectiveSet } from '../effective-set-cache/snapshot';
import type { StepOutcome } from './resource-step';

/** Port that reads the scoped effective set for one account and vertical. */
export type EffectiveSetPort = (args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
}) => Promise<RehydratedEffectiveSet>;

/** A caller requested a key absent from the catalog. */
export class UnknownStepKeyError extends Error {
    constructor(readonly key: string) {
        super(`Unknown step key: ${key}`);
        this.name = 'UnknownStepKeyError';
    }
}

/** Step 6 allows any requested entitlement with a positive effective value. */
export async function resolveEntitlementStep(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly keys: readonly string[];
    readonly effectiveSet: EffectiveSetPort;
}): Promise<StepOutcome<'NO_CAPABILITY'> & { readonly key?: string }> {
    for (const key of args.keys) {
        if (!getCatalogKey({ key })) throw new UnknownStepKeyError(key);
    }
    const effective = await args.effectiveSet({ userId: args.userId, vertical: args.vertical });
    for (const key of args.keys) {
        const value = effective.entitlements.get({
            key,
            userId: args.userId,
            vertical: args.vertical
        });
        if (value !== undefined && value > 0) return { allowed: true };
    }
    return { allowed: false, reason: 'NO_CAPABILITY', key: args.keys[0] };
}
