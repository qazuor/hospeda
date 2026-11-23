import { getCatalogKey, ServiceErrorCode, type VerticalEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { RehydratedEffectiveSet } from '@repo/verticals';
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

/**
 * Read capability flags, THROWING when the effective set cannot be read.
 *
 * For callers that must tell "the plan lacks the key" from "we could not find
 * out" (the owner dashboards render the second as `unavailable`, never as an
 * upsell). {@link readEffectiveKeys} is this read with the failure swallowed.
 *
 * @throws {UnknownStepKeyError} for a key outside the catalog.
 * @throws whatever the effective-set port throws.
 */
export async function probeEffectiveKeys(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly keys: readonly string[];
    readonly effectiveSetSnapshot?: RehydratedEffectiveSet;
}): Promise<Readonly<Record<string, boolean>>> {
    for (const key of args.keys) {
        if (!getCatalogKey({ key })) throw new UnknownStepKeyError(key);
    }
    const effective =
        args.effectiveSetSnapshot ??
        (await getListingAccessPorts().effectiveSet({
            userId: args.userId,
            vertical: args.vertical
        }));
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
}

/** Read capability flags without rejecting the request; a failed set read grants nothing. */
export async function readEffectiveKeys(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly keys: readonly string[];
    readonly effectiveSetSnapshot?: RehydratedEffectiveSet;
}): Promise<Readonly<Record<string, boolean>>> {
    for (const key of args.keys) {
        if (!getCatalogKey({ key })) throw new UnknownStepKeyError(key);
    }
    try {
        return await probeEffectiveKeys(args);
    } catch {
        apiLogger.warn(
            { userId: args.userId, vertical: args.vertical },
            'Effective keys lookup failed'
        );
        return Object.fromEntries(args.keys.map((key) => [key, false]));
    }
}

/** Read one effective limit without rejecting the request; a failed lookup returns zero. */
export async function readEffectiveLimit(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly key: string;
    readonly effectiveSetSnapshot?: RehydratedEffectiveSet;
}): Promise<number> {
    if (!getCatalogKey({ key: args.key })) throw new UnknownStepKeyError(args.key);
    try {
        const effective =
            args.effectiveSetSnapshot ??
            (await getListingAccessPorts().effectiveSet({
                userId: args.userId,
                vertical: args.vertical
            }));
        return (
            effective.limits.get({
                key: args.key,
                userId: args.userId,
                vertical: args.vertical
            }) ?? 0
        );
    } catch {
        apiLogger.warn(
            { userId: args.userId, vertical: args.vertical, key: args.key },
            'Effective limit lookup failed'
        );
        return 0;
    }
}
