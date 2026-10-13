/**
 * TEST:B4:2, "en otro caso" (AC:B4:2): the notice that coverage CAME BACK is
 * lost — nobody emits it, the subscription row is seeded straight into the
 * database — for an owner whose listing sits in `UNPUBLISHED_BY_BILLING`. The
 * daily coverage reconciler, reading the REAL `coverage()` through the
 * production composition, republishes the listing, writes the inactivity clock
 * (fact 2: `inactive_since` = the reconciler's instant), invalidates the owner's
 * cache and schedules the revalidation (contract §3). It does NOT run the trial
 * machine (DEC-ARCH-009 📌2): the owner's `TRIAL_EXPIRED` trial stays expired
 * although the subscription already charged and the trial consumer of the
 * notice is subscribed, as in production.
 *
 * No `vi.mock` of `listing-access/ports`. Cleans its own rows in `afterEach`;
 * the trial cannot be deleted (extras 042) and stays `TRIAL_EXPIRED`, which no
 * sweep takes, so its user stays too. Never TRUNCATE.
 */
import { randomUUID } from 'node:crypto';
import {
    accommodationMedia,
    accommodations,
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    payments,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    subscriptions,
    trials,
    users
} from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDailyCoverageReconciler } from '../../../../../packages/verticals/src/publication/coverage-reconciler';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import { getListingReconcilerPorts } from '../../../src/utils/listing-publication/reconciler-ports';
import { subscribeTrialCoverageConversion } from '../../../src/utils/trial/trial-coverage-listener';
import { testDb } from '../../e2e/setup/test-database';
import {
    createDestination,
    createListing,
    createTrial,
    ensureAccommodationCatalog
} from './publication-routes.helpers';

const state = vi.hoisted(() => ({
    invalidatedUserIds: [] as string[],
    scheduledRevalidations: [] as unknown[]
}));
vi.mock('../../../src/utils/effective-set-cache', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/effective-set-cache')>();
    return {
        ...actual,
        invalidateEffectiveSetsForUser: async (userId: string) => {
            state.invalidatedUserIds.push(userId);
            return actual.invalidateEffectiveSetsForUser(userId);
        }
    };
});
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getRevalidationService: () => ({
            scheduleRevalidation: (input: unknown) => state.scheduledRevalidations.push(input)
        })
    };
});

const vertical = VerticalEnum.ACCOMMODATION;
const now = new Date('2026-10-12T05:00:00.000Z');
const lostAt = new Date('2026-09-01T05:00:00.000Z');

/** The rows one case created, deleted in `afterEach` (children first). */
interface Created {
    userId: string;
    billingOptionId?: string;
    listingId?: string;
}

const created: Created[] = [];
let stopTrialListener: (() => void) | undefined;

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
    await ensureAccommodationCatalog();
    // The production composition: the trial consumer listens to the one registry.
    stopTrialListener = subscribeTrialCoverageConversion();
});

afterAll(() => {
    stopTrialListener?.();
});

beforeEach(() => {
    state.invalidatedUserIds = [];
    state.scheduledRevalidations = [];
});

afterEach(async () => {
    const db = getDb();
    for (const rows of created.splice(0)) {
        if (rows.listingId) {
            await db
                .delete(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, rows.listingId));
            await db.delete(accommodations).where(eq(accommodations.id, rows.listingId));
        }
        const subscriptionIds = sql`(SELECT id FROM subscription WHERE user_id = ${rows.userId})`;
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, rows.userId));
        await db.execute(sql`DELETE FROM payment WHERE subscription_id IN ${subscriptionIds}`);
        await db.delete(subscriptions).where(eq(subscriptions.userId, rows.userId));
        if (rows.billingOptionId) {
            await db.delete(billingOptions).where(eq(billingOptions.id, rows.billingOptionId));
        }
    }
});

/**
 * The coverage that came back, seeded with no notice: an `ACTIVE` PRINCIPAL
 * subscription over its own plan version (neither current nor sellable) that
 * grants publishing with one slot, and one SUCCEEDED payment, so it is
 * `charged: yes` — what T5 would convert on if the reconciler ran the trial
 * machine.
 */
async function seedReturnedCoverage(rows: Created): Promise<void> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({ vertical, slug: `b4-lost-notice-${randomUUID()}`, name: 'B4 lost notice' })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const versionId = await db.transaction(async (tx) => {
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical,
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Expected plan version');
        await tx.insert(planVersionEntitlements).values(
            ['publish_accommodations', 'edit_accommodation_info'].map((key) => ({
                planVersionId: version.id,
                key,
                planQuota: null,
                trialQuota: null
            }))
        );
        await tx
            .insert(planVersionLimits)
            .values({ planVersionId: version.id, key: 'max_accommodations', value: 1 });
        return version.id;
    });
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: versionId, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    rows.billingOptionId = option.id;
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: rows.userId,
            vertical,
            planVersionId: versionId,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected subscription');
    await db.insert(payments).values({
        subscriptionId: subscription.id,
        amount: 250000,
        currency: 'ARS',
        status: 'SUCCEEDED',
        provider: 'fake',
        providerFactId: `b4-lost-notice-${randomUUID()}`,
        factAt: new Date('2026-10-11T10:00:00.000Z')
    });
}

describe('TEST:B4:2 — a lost coverage-back notice is repaired by the daily reconciler, which never runs the trial machine', () => {
    it('republishes the listing, writes the clock, invalidates the cache and schedules the revalidation; the expired trial stays expired', async () => {
        // Arrange
        const db = getDb();
        const [user] = await db
            .insert(users)
            .values({
                email: `b4-lost-notice-${randomUUID()}@example.test`,
                displayName: 'B4 lost notice',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning({ id: users.id });
        if (!user) throw new Error('Expected user');
        const rows: Created = { userId: user.id };
        created.push(rows);
        await createTrial({ userId: user.id, status: 'TRIAL_EXPIRED' });
        const destinationId = await createDestination();
        rows.listingId = await createListing({
            ownerId: user.id,
            destinationId,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        await db
            .update(accommodations)
            .set({ inactiveSince: lostAt })
            .where(eq(accommodations.id, rows.listingId));
        await seedReturnedCoverage(rows);
        const coverage = await getListingAccessPorts().billing.coverage({
            userId: user.id,
            vertical
        });

        // Act
        await runDailyCoverageReconciler({ ports: getListingReconcilerPorts() });

        // Assert
        expect([
            coverage.covered,
            coverage.sources
                .filter((source) => source.type === 'SUBSCRIPTION')
                .map((source) => source.charged)
        ]).toEqual([true, [true]]);
        const [listing] = await db
            .select({
                status: accommodations.publicationStatus,
                inactiveSince: accommodations.inactiveSince
            })
            .from(accommodations)
            .where(eq(accommodations.id, rows.listingId));
        expect(listing).toEqual({ status: PublicationStatusEnum.PUBLISHED, inactiveSince: now });
        expect(state.invalidatedUserIds).toContain(user.id);
        expect(state.scheduledRevalidations).toContainEqual(
            expect.objectContaining({ id: rows.listingId, entityType: vertical })
        );
        const trialStatuses = await db
            .select({ status: trials.status })
            .from(trials)
            .where(eq(trials.userId, user.id));
        expect(trialStatuses).toEqual([{ status: 'TRIAL_EXPIRED' }]);
    });
});
