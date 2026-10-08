import type { PlanPublicationChange, PlanPublicationConfirmation } from '@repo/schemas';
import type { DrizzleClient } from '../../types';
import { loadEffects } from './plan-publication.reader.js';
import { CONFIRMATION_MESSAGE } from './plan-publication.rejections.js';
import type { CountAnchoredCustomersPort, PublicationContext } from './plan-publication.types.js';

/**
 * The key-by-key confirmation of action 18 (HOS-1436, piece V2, AC:V2:6). It
 * writes nothing: it reads the current version's effects and reports every
 * difference — settings, entitlements and limits — plus the reach.
 */

/** Deep-equality for the confirmation's from/to values. */
function sameValue(input: { a: unknown; b: unknown }): boolean {
    return JSON.stringify(input.a ?? null) === JSON.stringify(input.b ?? null);
}

/** Builds the settings share of the key-by-key confirmation. */
function buildChanges(input: { context: PublicationContext }): PlanPublicationChange[] {
    const { content, previous } = input.context;
    const changes: PlanPublicationChange[] = [];
    const settings: readonly [string, unknown, unknown][] = [
        ['rank', previous?.rank ?? null, content.rank],
        ['sellable', previous?.sellable ?? null, content.sellable],
        ['trialDays', previous?.trialDays ?? null, content.trialDays],
        ['graceDays', previous?.graceDays ?? null, content.graceDays],
        ['allowsPause', previous?.allowsPause ?? null, content.allowsPause],
        ['inheritsTouristVip', previous?.inheritsTouristVip ?? null, content.inheritsTouristVip]
    ];
    for (const [key, from, to] of settings) {
        if (!sameValue({ a: from, b: to })) changes.push({ key, kind: 'setting', from, to });
    }
    return changes;
}

/** Builds the confirmation, including the entitlements and limits deltas. */
export async function buildConfirmation(input: {
    client: DrizzleClient;
    context: PublicationContext;
    countAnchoredCustomers: CountAnchoredCustomersPort;
}): Promise<PlanPublicationConfirmation> {
    const { client, context, countAnchoredCustomers } = input;
    const changes = buildChanges({ context });
    const previousEffects = context.previous
        ? await loadEffects({ client, versionId: context.previous.id })
        : { entitlements: [], limits: [] };
    const previousEntitlements = new Map(previousEffects.entitlements.map((e) => [e.key, e]));
    const previousLimits = new Map(previousEffects.limits.map((l) => [l.key, l.value]));

    for (const entitlement of context.content.entitlements) {
        const from = previousEntitlements.get(entitlement.key) ?? null;
        const to = {
            planQuota: entitlement.planQuota ?? null,
            trialQuota: entitlement.trialQuota ?? null
        };
        const fromValue = from ? { planQuota: from.planQuota, trialQuota: from.trialQuota } : null;
        if (!sameValue({ a: fromValue, b: to })) {
            changes.push({ key: entitlement.key, kind: 'entitlement', from: fromValue, to });
        }
    }
    for (const [key, effect] of previousEntitlements) {
        if (!context.content.entitlements.some((item) => item.key === key)) {
            changes.push({
                key,
                kind: 'entitlement',
                from: { planQuota: effect.planQuota, trialQuota: effect.trialQuota },
                to: null
            });
        }
    }
    for (const limit of context.content.limits) {
        const from = previousLimits.get(limit.key) ?? null;
        if (!sameValue({ a: from, b: limit.value })) {
            changes.push({ key: limit.key, kind: 'limit', from, to: limit.value });
        }
    }
    for (const [key, value] of previousLimits) {
        if (!context.content.limits.some((item) => item.key === key)) {
            changes.push({ key, kind: 'limit', from: value, to: null });
        }
    }

    const anchoredCustomers = await countAnchoredCustomers({
        planVersionId: context.previous?.id ?? null
    });
    return {
        planId: context.planId,
        vertical: context.vertical,
        role: context.role,
        sellable: context.content.sellable,
        currentVersionId: context.previous?.id ?? null,
        anchoredCustomers,
        changes,
        message: CONFIRMATION_MESSAGE
    };
}
