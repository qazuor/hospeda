/**
 * HOS-1883 test support: a sink spy and the expected anchored subject of one add-on instance,
 * read the way `readAddonFactSnapshot` reads it, so an assertion can compare exact payloads.
 */
import {
    addonInstances,
    addonProducts,
    addonVersions,
    type DrizzleClient,
    eq,
    subscriptions
} from '@repo/db';
import type { SinkFact } from '../../../../src/services/billing/facts/billing-fact-sink';
import { getServiceTestDb } from '../helpers';

/** A sink that records every fact, and a filter for the add-on ones. */
export function addonFactSpy() {
    const facts: SinkFact[] = [];
    return {
        facts,
        sink: { emit: (fact: SinkFact) => facts.push(fact) },
        addonFacts: () => facts.filter((fact) => fact.kind.startsWith('ADDON_'))
    };
}

/**
 * Reads one instance's anchored identity: its row, its product price, and the subject every
 * add-on fact carries. The vertical is the COMPLEMENTO's when there is one, else `fallback`.
 *
 * @param input.instanceId - The instance
 * @param input.db - The client (a test transaction, or the shared pool)
 * @param input.fallbackVertical - The vertical of an instance without a COMPLEMENTO
 */
export async function addonFactSubjectOf(input: {
    readonly instanceId: string;
    readonly db?: DrizzleClient;
    readonly fallbackVertical?: string;
}) {
    const db = input.db ?? (getServiceTestDb() as unknown as DrizzleClient);
    const [row] = await db
        .select({
            instance: addonInstances,
            addonId: addonVersions.addonId,
            scopeType: addonVersions.scopeType,
            price: addonProducts.price,
            chargeKind: addonProducts.chargeKind,
            complementVertical: subscriptions.vertical
        })
        .from(addonInstances)
        .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .leftJoin(subscriptions, eq(subscriptions.id, addonInstances.complementSubscriptionId))
        .where(eq(addonInstances.id, input.instanceId));
    if (!row) throw new Error('Instance missing');
    const vertical = row.complementVertical ?? input.fallbackVertical;
    return {
        instance: row.instance,
        price: row.price,
        subject: {
            userId: row.instance.ownerId,
            addonInstanceId: row.instance.id,
            addonId: row.addonId,
            addonVersionId: row.instance.addonVersionId,
            addonProductId: row.instance.productId,
            chargeKind: row.chargeKind,
            scopeType: row.scopeType,
            ...(vertical ? { vertical } : {}),
            ...(row.instance.complementSubscriptionId
                ? { subscriptionId: row.instance.complementSubscriptionId }
                : {})
        }
    };
}

/** Whole days from `from` to `to`, floored at 0, as `lifetime_days` is computed. */
export function lifetimeDaysBetween(from: Date, to: Date): number {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/** Whole seconds from `from` to `to`, floored at 0, as `seconds_in_pending` is computed. */
export function secondsBetween(from: Date, to: Date): number {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}
