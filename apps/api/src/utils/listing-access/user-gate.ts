import { getCatalogKey, ServiceErrorCode, type VerticalEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { resolveEntitlementStep, resolveLimitStep, UnknownStepKeyError } from '@repo/verticals';
import { apiLogger } from '../logger';
import { getListingAccessPorts } from './ports';

/** Enforce every requested capability and then an optional limit for one user and vertical. */
export async function enforceUserGate(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly keys?: readonly string[];
    readonly limit?: () => Promise<{ readonly key: string; readonly requested: number }>;
}): Promise<void> {
    const effectiveSet = getListingAccessPorts().effectiveSet;
    for (const key of args.keys ?? []) {
        const result = await resolveEntitlementStep({
            userId: args.userId,
            vertical: args.vertical,
            keys: [key],
            effectiveSet
        });
        if (!result.allowed) {
            throw new ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED, 'Entitlement required', {
                entitlementKey: key
            });
        }
    }
    if (!args.limit) return;

    const limit = await args.limit();
    const result = await resolveLimitStep({
        userId: args.userId,
        vertical: args.vertical,
        limit,
        effectiveSet
    });
    if (!result.allowed) {
        throw new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'Limit reached', {
            limitKey: result.key,
            currentCount: result.requested - 1,
            maxAllowed: result.max
        });
    }
}

/** Read capability flags without rejecting the request; a failed set read grants nothing. */
export async function readEffectiveKeys(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly keys: readonly string[];
}): Promise<Readonly<Record<string, boolean>>> {
    for (const key of args.keys) {
        if (!getCatalogKey({ key })) throw new UnknownStepKeyError(key);
    }
    const denied = Object.fromEntries(args.keys.map((key) => [key, false]));
    try {
        const effective = await getListingAccessPorts().effectiveSet({
            userId: args.userId,
            vertical: args.vertical
        });
        return Object.fromEntries(
            args.keys.map((key) => [
                key,
                (effective.entitlements.get({
                    key,
                    userId: args.userId,
                    vertical: args.vertical
                }) ?? 0) > 0
            ])
        );
    } catch (error) {
        apiLogger.warn(
            { userId: args.userId, vertical: args.vertical, error },
            'Effective keys lookup failed'
        );
        return denied;
    }
}
