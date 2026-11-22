/**
 * The post-commit half of every add-on analytics fact (HOS-1883 §5). A producer decides, inside
 * its own guarded transition, WHETHER a fact is due and with which transition-specific values; it
 * then hands the instance id here after commit. This module reads the instance's anchored
 * identity (product, version, owner, complement) and emits through the same `BillingFactSink`
 * as HOS-1878 (P-1'). It never throws: a failed read or sink is a log line, and the committed
 * transition stays committed (P-9, AC-16).
 */
import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    ADDON_CYCLES,
    addonInstances,
    addonProducts,
    addonVersions,
    type DrizzleClient,
    eq,
    getDb,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import type { AddonFact, AddonFactCycle, AddonFactSubject } from '../facts/addon-fact';
import { type BillingFactSink, emitBillingFact } from '../facts/billing-fact-sink';

const logger = createLogger('addon-fact-emit');

/** The listing reader, used only to derive a `LISTING` instance's vertical (P-4'). */
export type AddonFactListing = VerticalsForBilling['listing'];

/** What a producer needs to emit an add-on fact after its commit. */
export interface AddonFactPorts {
    readonly billingFacts: BillingFactSink | undefined;
    readonly listing?: AddonFactListing;
    /** The client the producer committed through; defaults to `getDb()`. */
    readonly db?: DrizzleClient;
}

/** Which instance a fact is about: by id, or by the COMPLEMENTO it hangs from. */
export type AddonFactSource =
    | { readonly instanceId: string }
    | { readonly complementSubscriptionId: string };

/** The anchored identity and price of one add-on instance, read after commit. */
export interface AddonFactSnapshot {
    readonly subject: AddonFactSubject;
    /** The anchored product's price (an instance's product is frozen while it is live). */
    readonly amountMinor: number;
    readonly currency: 'ARS';
    readonly cycle?: AddonFactCycle;
    readonly createdAt: Date;
    readonly startsAt: Date | null;
}

async function verticalOf(input: {
    readonly complementVertical: string | null;
    readonly scopeType: AddonFactSubject['scopeType'];
    readonly targetId: string | null;
    readonly compatibleVerticals: readonly string[];
    readonly listing?: AddonFactListing;
    readonly db: DrizzleClient;
}): Promise<string | undefined> {
    if (input.complementVertical) return input.complementVertical;
    switch (input.scopeType) {
        case 'USER':
        case 'GLOBAL':
            return input.compatibleVerticals.length === 1
                ? input.compatibleVerticals[0]
                : undefined;
        case 'VERTICAL_SUBSCRIPTION': {
            if (!input.targetId) return undefined;
            const [target] = await input.db
                .select({ vertical: subscriptions.vertical })
                .from(subscriptions)
                .where(eq(subscriptions.id, input.targetId))
                .limit(1);
            return target?.vertical ?? undefined;
        }
        case 'LISTING': {
            if (!input.targetId || !input.listing) return undefined;
            try {
                return (await input.listing({ listingId: input.targetId })).vertical;
            } catch {
                return undefined;
            }
        }
        default: {
            const exhaustive: never = input.scopeType;
            return exhaustive;
        }
    }
}

/**
 * Reads the anchored identity of one add-on instance.
 *
 * @param input.source - The instance id, or the COMPLEMENTO it hangs from
 * @param input.listing - Optional listing reader for a `LISTING` instance's vertical
 * @param input.db - The client to read through; defaults to `getDb()`
 * @returns The anchored identity, or `null` when the instance or its catalog rows are missing or invalid
 */
export async function readAddonFactSnapshot(input: {
    readonly source: AddonFactSource;
    readonly listing?: AddonFactListing;
    readonly db?: DrizzleClient;
}): Promise<AddonFactSnapshot | null> {
    const db = input.db ?? getDb();
    const [row] = await db
        .select({
            instance: addonInstances,
            price: addonProducts.price,
            currency: addonProducts.currency,
            chargeKind: addonProducts.chargeKind,
            cycle: addonProducts.cycle,
            addonId: addonProducts.addonId,
            compatibleVerticals: addonProducts.compatibleVerticals,
            scopeType: addonVersions.scopeType,
            complementVertical: subscriptions.vertical
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
        .leftJoin(subscriptions, eq(subscriptions.id, addonInstances.complementSubscriptionId))
        .where(
            'instanceId' in input.source
                ? eq(addonInstances.id, input.source.instanceId)
                : eq(addonInstances.complementSubscriptionId, input.source.complementSubscriptionId)
        )
        .limit(1);
    if (row?.currency !== 'ARS') return null;
    if (row.chargeKind !== 'UNA_VEZ' && row.chargeKind !== 'PERIODICO') return null;
    const rawVertical = await verticalOf({
        complementVertical: row.complementVertical,
        scopeType: row.scopeType,
        targetId: row.instance.targetId,
        compatibleVerticals: row.compatibleVerticals,
        listing: input.listing,
        db
    });
    const vertical = rawVertical ? VerticalEnumSchema.safeParse(rawVertical) : undefined;
    const cycle =
        row.cycle && (ADDON_CYCLES as readonly string[]).includes(row.cycle)
            ? (row.cycle as AddonFactCycle)
            : undefined;
    return {
        subject: {
            userId: row.instance.ownerId,
            addonInstanceId: row.instance.id,
            addonId: row.addonId,
            addonVersionId: row.instance.addonVersionId,
            addonProductId: row.instance.productId,
            chargeKind: row.chargeKind,
            scopeType: row.scopeType,
            ...(vertical?.success ? { vertical: vertical.data } : {}),
            ...(row.instance.complementSubscriptionId
                ? { subscriptionId: row.instance.complementSubscriptionId }
                : {})
        },
        amountMinor: row.price,
        currency: 'ARS',
        ...(cycle ? { cycle } : {}),
        createdAt: row.instance.createdAt,
        startsAt: row.instance.startsAt
    };
}

/**
 * Whole seconds from one instant to another, never negative.
 *
 * @param input.from - The earlier instant
 * @param input.to - The later instant
 * @returns The elapsed whole seconds
 */
export function wholeSecondsBetween(input: { readonly from: Date; readonly to: Date }): number {
    return Math.max(0, Math.floor((input.to.getTime() - input.from.getTime()) / 1000));
}

/**
 * Emits one add-on fact after the producer's commit. The identity read and the sink are both
 * guarded: nothing here can throw into the producer (P-9).
 *
 * @param input.billingFacts - The sink; unwired falls back to the logging sink
 * @param input.source - Which instance the fact is about
 * @param input.listing - Optional listing reader for a `LISTING` instance's vertical
 * @param input.db - The client the producer committed through; defaults to `getDb()`
 * @param input.build - Builds the fact from the anchored identity, or returns `null` to emit nothing
 */
export async function emitAddonFact(input: {
    readonly billingFacts: BillingFactSink | undefined;
    readonly source: AddonFactSource;
    readonly listing?: AddonFactListing;
    readonly db?: DrizzleClient;
    readonly build: (anchored: AddonFactSnapshot) => AddonFact | null;
}): Promise<void> {
    try {
        const anchored = await readAddonFactSnapshot({
            source: input.source,
            listing: input.listing,
            db: input.db
        });
        if (!anchored) {
            logger.error({ source: input.source }, 'Add-on fact source not found; not emitted');
            return;
        }
        const fact = input.build(anchored);
        if (fact) emitBillingFact({ sink: input.billingFacts, fact });
    } catch (error) {
        logger.error({ source: input.source, error }, 'Add-on fact could not be emitted');
    }
}
