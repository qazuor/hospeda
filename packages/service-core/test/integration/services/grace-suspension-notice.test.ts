import {
    addonInstances,
    addonProducts,
    addons,
    and,
    billingOptions,
    emailOutbox,
    eq,
    inArray,
    plans,
    planVersions,
    promoCodes,
    promoRedemptions,
    providerLinks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    createGraceExpiryCheck,
    graceExpiredOccurrenceId
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import type { ReconciliationComparisonInput } from '../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import {
    type SuspendForArrearsPorts,
    suspendForArrears
} from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    seedCoverageAddon,
    seedCoverageAddonInstance,
    seedCoverageAddonProduct
} from './support/coverage-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

afterAll(closeServiceTestPool);

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const seededUserIds: string[] = [];
const seededPromoCodeIds: string[] = [];

/**
 * Retires what each case committed: its subscriptions to CANCELLED (no live or
 * GRACE/SUSPENDED row outlives it), its addon instances to EXPIRED, its promo
 * redemptions and codes, and its outbox rows. Scoped to the case's users.
 */
afterEach(async () => {
    const db = getServiceTestDb();
    const userIds = seededUserIds.splice(0);
    const promoCodeIds = seededPromoCodeIds.splice(0);
    if (userIds.length > 0) {
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.userId, userIds));
        await db
            .update(addonInstances)
            .set({ status: 'EXPIRED' })
            .where(inArray(addonInstances.ownerId, userIds));
        await db.delete(promoRedemptions).where(inArray(promoRedemptions.userId, userIds));
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
    }
    if (promoCodeIds.length > 0)
        await db.delete(promoCodes).where(inArray(promoCodes.id, promoCodeIds));
});

async function subscriptionRow(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row) throw new Error('Subscription disappeared');
    return row;
}

/** The user's arrears suspension notices (the fixture also enqueues signup and grace mails). */
async function outboxOf(userId: string) {
    return getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, userId),
                eq(emailOutbox.template, 'billing.arrears-suspension')
            )
        );
}

/**
 * A card principal in grace by a failed cycle, its clock run out, and the
 * database-backed notice (the API adapter's mirror) as the S6 port.
 */
async function noticeFixture({
    inheritsTouristVip = false,
    deliver = true
}: {
    readonly inheritsTouristVip?: boolean;
    readonly deliver?: boolean;
} = {}) {
    const fixture = await graceWithFailedCycle({ inheritsTouristVip });
    const subscriptionId = fixture.started.subscriptionId;
    seededUserIds.push(fixture.user.id);
    const inGrace = await subscriptionRow(subscriptionId);
    if (!inGrace.graceEndsAt) throw new Error('Grace clock missing');
    const graceEndsAt = inGrace.graceEndsAt;
    fixture.clock.advance({
        ms: graceEndsAt.getTime() + HOUR_MS - fixture.clock.now().getTime()
    });
    const ports: SuspendForArrearsPorts = {
        provider: fixture.provider,
        clock: fixture.clock,
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver }),
        coverageNotices: fixture.coverageNotices
    };
    const occurrenceId = graceExpiredOccurrenceId({ subscriptionId, graceEndsAt });
    const runS6 = () =>
        suspendForArrears({ subscriptionId, event: 'GRACE_EXPIRED', occurrenceId }, ports);
    /** The sweep over this row, as `grace-suspension.test.ts` drives it. */
    const runSweep = async () => {
        const [row] = await getServiceTestDb()
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(eq(subscriptions.id, subscriptionId));
        if (!row) throw new Error('Grace notice fixture disappeared');
        const act = { kind: 'decision' as const, startedAt: fixture.clock.now() };
        const read = await fixture.provider.readAuthorization({
            authorizationId: row.providerLink.providerId
        });
        const input: ReconciliationComparisonInput = { ...row, read, act };
        return createGraceExpiryCheck(ports)(input);
    };
    return { fixture, subscriptionId, userId: fixture.user.id, runS6, runSweep };
}

/** A one-time (or periodic) addon instance of the user, with a distinct addon name. */
async function seedAddon(input: {
    readonly ownerId: string;
    readonly name: string;
    readonly endsAt: Date;
    readonly compatibleVerticals?: readonly string[];
    readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO';
}) {
    const db = getServiceTestDb();
    const periodic = input.chargeKind === 'PERIODICO';
    const { addonId, versionIds } = await seedCoverageAddon(db, {
        versions: [
            { validity: periodic ? 'WHILE_SUBSCRIPTION_ALIVE' : 'FIXED_DAYS', scopeType: 'USER' }
        ]
    });
    const versionId = versionIds[0];
    if (!versionId) throw new Error('addon version missing');
    await db.update(addons).set({ name: input.name }).where(eq(addons.id, addonId));
    const compatibleVerticals = input.compatibleVerticals ?? ['accommodation'];
    let productId: string;
    if (periodic) {
        const [product] = await db
            .insert(addonProducts)
            .values({
                addonId,
                versionId,
                price: 10000,
                currency: 'ARS',
                chargeKind: 'PERIODICO',
                cycle: 'monthly',
                compatibleVerticals: [...compatibleVerticals]
            })
            .returning({ id: addonProducts.id });
        if (!product) throw new Error('periodic addon product missing');
        productId = product.id;
    } else {
        productId = (
            await seedCoverageAddonProduct(db, { addonId, versionId, compatibleVerticals })
        ).productId;
    }
    await seedCoverageAddonInstance(db, {
        productId,
        addonVersionId: versionId,
        ownerId: input.ownerId,
        endsAt: input.endsAt
    });
}

/** A promo redemption on the subscription with the given remaining charges. */
async function seedPromo(input: {
    readonly userId: string;
    readonly subscriptionId: string;
    readonly remainingCharges: number | null;
    readonly at: Date;
}) {
    const db = getServiceTestDb();
    const [code] = await db
        .insert(promoCodes)
        .values({
            code: `B7-ARREARS-${crypto.randomUUID()}`,
            discountKind: 'PERCENTAGE',
            value: 10,
            allVerticals: true,
            verticals: null,
            totalQuota: 10,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
            stackable: false,
            usableWithAnotherActive: false,
            durationKind: 'N_CHARGES',
            durationCharges: 3
        })
        .returning({ id: promoCodes.id });
    if (!code) throw new Error('promo code missing');
    seededPromoCodeIds.push(code.id);
    await db.insert(promoRedemptions).values({
        promoCodeId: code.id,
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        redeemedAt: input.at,
        remainingCharges: input.remainingCharges
    });
}

/** Another live title of the same user, in gastronomy, whose version inherits Tourist VIP. */
async function seedInheritingVenueTitle(userId: string) {
    const db = getServiceTestDb();
    const [plan] = await db
        .insert(plans)
        .values({ vertical: 'gastronomy', slug: `b7-vip-${crypto.randomUUID()}`, name: 'Gastro' })
        .returning();
    if (!plan) throw new Error('gastronomy plan missing');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'gastronomy',
            rank: Math.floor(Math.random() * 1_000_000_000),
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: true
        })
        .returning();
    if (!version) throw new Error('gastronomy version missing');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 25000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('gastronomy option missing');
    await db.insert(subscriptions).values({
        userId,
        vertical: 'gastronomy',
        planVersionId: version.id,
        billingOptionId: option.id,
        paymentMethod: 'CARD',
        status: 'ACTIVE',
        class: 'PRINCIPAL'
    });
}

describe('TEST:B7:18 — the suspension notice names what is lost (AC:B7:30)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a plan that inherits Tourist VIP, a live one-time addon and a live promo: one notice naming all of it',
        async () => {
            // Arrange
            const s = await noticeFixture({ inheritsTouristVip: true });
            const now = s.fixture.clock.now();
            await seedAddon({
                ownerId: s.userId,
                name: 'Destacado de prueba',
                endsAt: new Date(now.getTime() + 10 * DAY_MS)
            });
            await seedPromo({
                userId: s.userId,
                subscriptionId: s.subscriptionId,
                remainingCharges: 2,
                at: now
            });

            // Act
            const result = await s.runS6();

            // Assert
            expect(result).toEqual({
                outcome: 'SUSPENDED',
                subscriptionId: s.subscriptionId,
                cancelCall: 'SENT'
            });
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            const rows = await outboxOf(s.userId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.template).toBe('billing.arrears-suspension');
            expect(rows[0]?.payload).toEqual({
                subscriptionId: s.subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: true,
                oneTimeAddons: [{ name: 'Destacado de prueba', remainingDays: 10 }],
                promoLost: true
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'a plan that does not inherit, no addons, no promo: the notice has none of those lines',
        async () => {
            // Arrange
            const s = await noticeFixture();

            // Act
            await s.runS6();

            // Assert
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            const rows = await outboxOf(s.userId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.payload).toEqual({
                subscriptionId: s.subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: false,
                oneTimeAddons: [],
                promoLost: false
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'another live title of the same user still inherits: the Tourist VIP is not lost',
        async () => {
            // Arrange
            const s = await noticeFixture({ inheritsTouristVip: true });
            await seedInheritingVenueTitle(s.userId);

            // Act
            await s.runS6();

            // Assert
            const rows = await outboxOf(s.userId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.payload).toEqual({
                subscriptionId: s.subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: false,
                oneTimeAddons: [],
                promoLost: false
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'a periodic addon, an expired one-time addon, one of another vertical and a spent promo do not count',
        async () => {
            // Arrange
            const s = await noticeFixture({ inheritsTouristVip: true });
            const now = s.fixture.clock.now();
            await seedAddon({
                ownerId: s.userId,
                name: 'Periódico',
                endsAt: new Date(now.getTime() + 5 * DAY_MS),
                chargeKind: 'PERIODICO'
            });
            await seedAddon({
                ownerId: s.userId,
                name: 'Vencido',
                endsAt: new Date(now.getTime() - DAY_MS)
            });
            await seedAddon({
                ownerId: s.userId,
                name: 'Otra vertical',
                endsAt: new Date(now.getTime() + 5 * DAY_MS),
                compatibleVerticals: ['gastronomy']
            });
            await seedAddon({
                ownerId: s.userId,
                name: 'Vigente',
                endsAt: new Date(now.getTime() + 2 * DAY_MS + HOUR_MS)
            });
            await seedPromo({
                userId: s.userId,
                subscriptionId: s.subscriptionId,
                remainingCharges: 0,
                at: now
            });

            // Act
            await s.runS6();

            // Assert
            const rows = await outboxOf(s.userId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.payload).toEqual({
                subscriptionId: s.subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: true,
                oneTimeAddons: [{ name: 'Vigente', remainingDays: 3 }],
                promoLost: false
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'the sweep over a row whose authorization the provider already cancelled: same notice once, no second cancel',
        async () => {
            // Arrange
            const s = await noticeFixture({ inheritsTouristVip: true });
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.started.authorizationId
            });
            const cancel = vi.spyOn(s.fixture.provider, 'cancel');

            // Act
            await s.runSweep();
            await s.runSweep();

            // Assert
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(cancel).not.toHaveBeenCalled();
            const rows = await outboxOf(s.userId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.template).toBe('billing.arrears-suspension');
            expect(rows[0]?.payload).toEqual({
                subscriptionId: s.subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: true,
                oneTimeAddons: [],
                promoLost: false
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'the sweep over an already-cancelled authorization does not block on a notice not yet sent',
        async () => {
            // Arrange
            const s = await noticeFixture({ deliver: false });
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.started.authorizationId
            });
            const cancel = vi.spyOn(s.fixture.provider, 'cancel');

            // Act
            await s.runSweep();

            // Assert
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(cancel).not.toHaveBeenCalled();
            const rows = await outboxOf(s.userId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).not.toBe('sent');
            expect(rows[0]?.payload).toEqual({
                subscriptionId: s.subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: false,
                oneTimeAddons: [],
                promoLost: false
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'the blocking branch is unchanged: a notice not yet sent on an authorized mandate defers without cancelling',
        async () => {
            // Arrange
            const s = await noticeFixture({ deliver: false });
            const cancel = vi.spyOn(s.fixture.provider, 'cancel');

            // Act
            const result = await s.runS6();

            // Assert
            expect(result).toEqual({
                outcome: 'DEFERRED',
                subscriptionId: s.subscriptionId,
                reason: 'NOTICE_NOT_SENT'
            });
            expect(cancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            const rows = await outboxOf(s.userId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.template).toBe('billing.arrears-suspension');
        }
    );
});
