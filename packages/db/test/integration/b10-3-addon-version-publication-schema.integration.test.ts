/** TEST:B10:9 schema defenses for action 20 and the A1-bis free choice identity. */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { DomainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import type { DomainEventType } from '../../src/schemas/domain-event/domain_event.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { addons, addonVersions } from '../../src/schemas/vertical/addon-catalog.dbschema.ts';
import {
    addonInstances,
    addonProducts
} from '../../src/schemas/vertical/addon-product.dbschema.ts';
import {
    permanentGrants,
    permanentGrantVerticals
} from '../../src/schemas/vertical/permanent-grant.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);
const events = new DomainEventModel();

async function fixture(tx: DrizzleClient) {
    const [user] = await tx
        .insert(users)
        .values({
            email: `publish-${randomUUID()}@example.test`,
            displayName: 'Publisher',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('User fixture missing');
    const [plan] = await tx
        .insert(plans)
        .values({ vertical: 'accommodation', slug: `publish-${randomUUID()}`, name: 'Plan' })
        .returning();
    if (!plan) throw new Error('Plan fixture missing');
    const [planVersion] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: 100000000 + Math.floor(Math.random() * 1000000),
            sellable: false,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!planVersion) throw new Error('Plan version fixture missing');
    const [grant] = await tx
        .insert(permanentGrants)
        .values({
            beneficiaryUserId: user.id,
            grantedBy: user.id,
            includesAddons: true,
            reason: 'Test'
        })
        .returning();
    if (!grant) throw new Error('Grant fixture missing');
    const [anchor] = await tx
        .insert(permanentGrantVerticals)
        .values({
            permanentGrantId: grant.id,
            vertical: 'accommodation',
            planId: plan.id,
            floorPlanVersionId: planVersion.id
        })
        .returning();
    if (!anchor) throw new Error('Anchor fixture missing');
    const [addon] = await tx
        .insert(addons)
        .values({ slug: `publish-${randomUUID()}`, name: 'Addon' })
        .returning();
    if (!addon) throw new Error('Addon fixture missing');
    // A new immutable addon_version is seeded by INSERT, as specified by D-3.
    const [version] = await tx
        .insert(addonVersions)
        .values({ addonId: addon.id, validity: 'FIXED_DAYS', validityDays: 30, scopeType: 'USER' })
        .returning();
    if (!version) throw new Error('Version fixture missing');
    const [product] = await tx
        .insert(addonProducts)
        .values({
            addonId: addon.id,
            versionId: version.id,
            price: 2500,
            currency: 'ARS',
            chargeKind: 'UNA_VEZ',
            cycle: null,
            compatibleVerticals: ['accommodation']
        })
        .returning();
    if (!product) throw new Error('Product fixture missing');
    const [complement] = await tx
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            paymentMethod: 'CARD',
            class: 'COMPLEMENTO',
            status: 'ACTIVE'
        })
        .returning();
    if (!complement) throw new Error('Complement fixture missing');
    return {
        userId: user.id,
        versionId: version.id,
        productId: product.id,
        anchorId: anchor.id,
        complementId: complement.id
    };
}

function event(tx: DrizzleClient, eventType: string) {
    return {
        tx,
        eventType: eventType as DomainEventType,
        entityType: 'addon_product',
        entityId: randomUUID(),
        actorId: randomUUID(),
        actorType: 'admin' as const,
        correlationId: randomUUID(),
        changes: [{ field: 'price', old: 2500, new: 3000 }]
    };
}

describe('TEST:B10:9 AC:B10:8 action 20 schema contract', () => {
    it('adds billing.publishAddonVersion to permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(
                sql`SELECT enum_range(NULL::permission_enum) AS values`
            );
            const values = String((result.rows[0] as { values?: unknown } | undefined)?.values);
            expect(values.split(',')).toContain('billing.publishAddonVersion');
        });
    });

    it('accepts addon_product.version_published and rejects a neighboring typo', async () => {
        await withTestTransaction(async (tx) => {
            expect(
                (await events.insert(event(tx, 'addon_product.version_published'))).eventType
            ).toBe('addon_product.version_published');
            await expect(
                tx.transaction(async (sp) =>
                    events.insert(event(sp, 'addon_product.version_publishd'))
                )
            ).rejects.toBeDefined();
        });
    });

    it('rejects a second active free choice but accepts a complement and paid one-time row', async () => {
        await withTestTransaction(async (tx) => {
            const f = await fixture(tx);
            const base = {
                productId: f.productId,
                addonVersionId: f.versionId,
                ownerId: f.userId,
                status: 'ACTIVE'
            };
            await tx.insert(addonInstances).values({ ...base, titleAnchorId: f.anchorId });
            await expect(
                tx.transaction(async (sp) => {
                    await sp.insert(addonInstances).values({ ...base, titleAnchorId: f.anchorId });
                })
            ).rejects.toBeDefined();
            const [complemented] = await tx
                .insert(addonInstances)
                .values({
                    ...base,
                    titleAnchorId: f.anchorId,
                    complementSubscriptionId: f.complementId
                })
                .returning();
            const [paid] = await tx
                .insert(addonInstances)
                .values({ ...base, titleAnchorId: null })
                .returning();
            expect(complemented?.complementSubscriptionId).toBe(f.complementId);
            expect(paid?.titleAnchorId).toBeNull();
        });
    });
});
