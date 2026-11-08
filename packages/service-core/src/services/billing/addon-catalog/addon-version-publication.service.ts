/** Administrative action 20: preview and publish one addon product version. */
import { randomUUID } from 'node:crypto';
import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { DrizzleClient, SelectAddonProduct } from '@repo/db';
import {
    addonInstances,
    addonProducts,
    and,
    domainEventModel,
    eq,
    getDb,
    inArray,
    sql
} from '@repo/db';
import { CatalogVersionNotFoundError } from '@repo/verticals';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import {
    PROVIDER_AMOUNT_CEILING_MINOR,
    PROVIDER_AMOUNT_FLOOR_MINOR
} from '../promo/provider-amount-floor.js';
import {
    addonVersionPublicationRejection,
    assertAddonVersionPublicationPermitted,
    mapAddonVersionPublicationWriteError
} from './addon-version-publication-authorization.js';

const previewInputSchema = z.strictObject({
    productId: z.uuid(),
    addonVersionId: z.uuid(),
    price: z.int().positive()
});
const publishInputSchema = previewInputSchema.extend({
    expectedCurrentVersionId: z.uuid(),
    expectedCurrentPrice: z.int().positive()
});

/** Only the inverse contract may read addon version policy for billing. */
export type AddonVersionPublicationPorts = Pick<VerticalsForBilling, 'addonPolicy'>;

type Policy = Awaited<ReturnType<AddonVersionPublicationPorts['addonPolicy']>>;

/** Billing-only confirmation; existing purchases retain their version anchor. */
export interface AddonVersionPublicationPreview {
    readonly current: {
        readonly versionId: string;
        readonly price: number;
        readonly policy: Policy;
    };
    readonly proposed: {
        readonly versionId: string;
        readonly price: number;
        readonly policy: Policy;
    };
    readonly changes: readonly ('VERSION' | 'PRICE')[];
    readonly liveInstancesOnCurrentVersion: number;
    readonly alreadyPurchasedStaysAnchored: true;
}

function reject(reason: Parameters<typeof addonVersionPublicationRejection>[0]['reason']): never {
    throw addonVersionPublicationRejection({ reason, message: reason });
}

function assertPrice(price: number): void {
    if (price < PROVIDER_AMOUNT_FLOOR_MINOR) reject('ADDON_PRICE_BELOW_PROVIDER_MINIMUM');
    if (price > PROVIDER_AMOUNT_CEILING_MINOR) reject('ADDON_PRICE_ABOVE_PROVIDER_MAXIMUM');
}

async function policyOf(args: {
    readonly versionId: string;
    readonly ports: AddonVersionPublicationPorts;
}): Promise<Policy> {
    try {
        return await args.ports.addonPolicy({ addonVersionId: args.versionId });
    } catch (error) {
        if (error instanceof CatalogVersionNotFoundError && error.kind === 'addon_version')
            reject('ADDON_VERSION_NOT_FOUND');
        throw error;
    }
}

async function countLiveInstances(args: {
    readonly tx: DrizzleClient;
    readonly productId: string;
    readonly versionId?: string;
}): Promise<number> {
    const predicate = [
        eq(addonInstances.productId, args.productId),
        inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE'])
    ];
    if (args.versionId) predicate.push(eq(addonInstances.addonVersionId, args.versionId));
    const [row] = await args.tx
        .select({ total: sql<number>`count(*)::int` })
        .from(addonInstances)
        .where(and(...predicate));
    return row?.total ?? 0;
}

function assertVersionOfProduct(args: {
    readonly product: SelectAddonProduct;
    readonly policy: Policy;
}): void {
    if (args.policy.addonId !== args.product.addonId) reject('ADDON_VERSION_OF_ANOTHER_ADDON');
    if (args.product.chargeKind === 'PERIODICO' && args.policy.validity === 'FIXED_DAYS')
        reject('ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND');
}

/** Preview action 20 against current product state without a write or lock. */
export async function previewAddonVersionPublication(
    args: { readonly actor?: Actor; readonly input: unknown; readonly correlationId?: string },
    ports: AddonVersionPublicationPorts
): Promise<AddonVersionPublicationPreview> {
    assertAddonVersionPublicationPermitted({ actor: args.actor });
    const parsed = previewInputSchema.safeParse(args.input);
    if (!parsed.success) reject('INVALID_ADDON_VERSION_PUBLICATION_INPUT');
    const input = parsed.data;
    const db = getDb();
    const [product] = await db
        .select()
        .from(addonProducts)
        .where(eq(addonProducts.id, input.productId))
        .limit(1);
    if (!product) reject('ADDON_PRODUCT_NOT_FOUND');
    const proposedPolicy = await policyOf({ versionId: input.addonVersionId, ports });
    assertVersionOfProduct({ product, policy: proposedPolicy });
    assertPrice(input.price);
    const changes: ('VERSION' | 'PRICE')[] = [];
    if (product.versionId !== input.addonVersionId) changes.push('VERSION');
    if (product.price !== input.price) changes.push('PRICE');
    if (changes.length === 0) reject('ADDON_PRODUCT_UNCHANGED');
    const currentPolicy = await policyOf({ versionId: product.versionId, ports });
    return {
        current: { versionId: product.versionId, price: product.price, policy: currentPolicy },
        proposed: { versionId: input.addonVersionId, price: input.price, policy: proposedPolicy },
        changes,
        liveInstancesOnCurrentVersion: await countLiveInstances({
            tx: db,
            productId: product.id,
            versionId: product.versionId
        }),
        alreadyPurchasedStaysAnchored: true
    };
}

/** Publish the new version and price atomically with its domain event. */
export async function publishAddonVersion(
    args: { readonly actor?: Actor; readonly input: unknown; readonly correlationId?: string },
    ports: AddonVersionPublicationPorts
): Promise<{ readonly product: SelectAddonProduct; readonly domainEventId: string }> {
    assertAddonVersionPublicationPermitted({ actor: args.actor });
    const parsed = publishInputSchema.safeParse(args.input);
    if (!parsed.success) reject('INVALID_ADDON_VERSION_PUBLICATION_INPUT');
    const input = parsed.data;
    const actor = args.actor;
    if (!actor) reject('ADMINISTRATIVE_ACTION_FORBIDDEN');
    try {
        const db = getDb();
        const [candidate] = await db
            .select()
            .from(addonProducts)
            .where(eq(addonProducts.id, input.productId))
            .limit(1);
        if (!candidate) reject('ADDON_PRODUCT_NOT_FOUND');
        const policy = await policyOf({ versionId: input.addonVersionId, ports });
        assertVersionOfProduct({ product: candidate, policy });
        assertPrice(input.price);
        if (candidate.versionId === input.addonVersionId && candidate.price === input.price)
            reject('ADDON_PRODUCT_UNCHANGED');
        return await db.transaction(async (tx) => {
            const [product] = await tx
                .select()
                .from(addonProducts)
                .where(eq(addonProducts.id, input.productId))
                .limit(1)
                .for('update');
            if (!product) reject('ADDON_PRODUCT_NOT_FOUND');
            if (
                input.price !== product.price &&
                (await countLiveInstances({ tx, productId: product.id })) > 0
            )
                reject('ADDON_PRODUCT_HAS_LIVE_INSTANCES');
            if (product.versionId === input.addonVersionId && product.price === input.price)
                reject('ADDON_PRODUCT_UNCHANGED');
            const [written] = await tx
                .update(addonProducts)
                .set({ versionId: input.addonVersionId, price: input.price, updatedAt: new Date() })
                .where(
                    and(
                        eq(addonProducts.id, input.productId),
                        eq(addonProducts.versionId, input.expectedCurrentVersionId),
                        eq(addonProducts.price, input.expectedCurrentPrice)
                    )
                )
                .returning();
            if (!written) reject('ADDON_PRODUCT_CHANGED_SINCE_PREVIEW');
            const event = await domainEventModel.insert({
                eventType: 'addon_product.version_published',
                entityType: 'addon_product',
                entityId: product.id,
                actorType: 'admin',
                actorId: actor.id,
                correlationId: args.correlationId ?? randomUUID(),
                changes: [
                    { field: 'version_id', old: product.versionId, new: input.addonVersionId },
                    { field: 'price', old: product.price, new: input.price }
                ],
                occurredAt: new Date(),
                tx
            });
            return { product: written, domainEventId: event.id };
        });
    } catch (error) {
        mapAddonVersionPublicationWriteError({ error });
    }
}
