/**
 * Coord-99 (HOS-1533): the trial consumer of the coverage notice, end to end
 * through the production composition root. The first credited payment (P1)
 * emits after its commit into the process-wide registry, and the trial
 * listener runs T2 (`TRIAL_ACTIVE`), T5 (`TRIAL_EXPIRED`) or T8 (no trial
 * row, activation event exercised). An `ACTIVE` subscription WITHOUT payments
 * does not convert (`charged: no`, DEC-TRIAL-010).
 *
 * No `vi.mock` of `listing-access/ports`; `@repo/verticals` is only wrapped to
 * count `convertTrialOnTitle` calls. Cleans its own rows in `afterEach`; trial
 * rows cannot be deleted (extras 042), so every case leaves its trial
 * `TRIAL_CONVERTED` (or `TRIAL_EXPIRED`, which no sweep takes) and keeps its
 * user. Never TRUNCATE.
 */
import { randomUUID } from 'node:crypto';
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    accommodationMedia,
    accommodations,
    billingOptions,
    destinations,
    domainEventModel,
    emailOutbox,
    eq,
    getDb,
    payments,
    plans,
    planVersions,
    subscriptions,
    trials,
    users
} from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { creditPayment } from '@repo/service-core';
import * as verticals from '@repo/verticals';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getClock, injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';
import { TRIAL_CAMPAIGN_TEMPLATES } from '../../../src/utils/trial/trial-campaign-outbox';
import { subscribeTrialCoverageConversion } from '../../../src/utils/trial/trial-coverage-listener';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createTrial,
    createVerticalDestination,
    ensureAccommodationCatalog
} from '../listing-publication/publication-routes.helpers';

vi.mock('@repo/verticals', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/verticals')>();
    return { ...actual, convertTrialOnTitle: vi.fn(actual.convertTrialOnTitle) };
});

const vertical = VerticalEnum.ACCOMMODATION;
const now = new Date('2026-10-12T12:00:00.000Z');

/** The rows one case created, deleted in `afterEach` (children first). */
interface Created {
    userId: string;
    billingOptionId?: string;
    listingId?: string;
    destinationId?: string;
}

const created: Created[] = [];
let stopTrialListener: (() => void) | undefined;

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
    await ensureAccommodationCatalog();
    stopTrialListener = subscribeTrialCoverageConversion();
});

afterAll(() => {
    stopTrialListener?.();
});

beforeEach(() => {
    vi.mocked(verticals.convertTrialOnTitle).mockClear();
});

afterEach(async () => {
    const db = getDb();
    for (const rows of created.splice(0)) {
        const subscriptionIds = sql`(SELECT id FROM subscription WHERE user_id = ${rows.userId})`;
        await db.execute(
            sql`DELETE FROM covered_period WHERE subscription_id IN ${subscriptionIds}`
        );
        await db.execute(
            sql`DELETE FROM receipt WHERE payment_id IN (SELECT id FROM payment WHERE subscription_id IN ${subscriptionIds})`
        );
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, rows.userId));
        await db.execute(sql`DELETE FROM payment WHERE subscription_id IN ${subscriptionIds}`);
        await db.delete(subscriptions).where(eq(subscriptions.userId, rows.userId));
        if (rows.billingOptionId) {
            await db.delete(billingOptions).where(eq(billingOptions.id, rows.billingOptionId));
        }
        if (rows.listingId) {
            await db
                .delete(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, rows.listingId));
            await db.delete(accommodations).where(eq(accommodations.id, rows.listingId));
        }
        if (rows.destinationId) {
            await db.delete(destinations).where(eq(destinations.id, rows.destinationId));
        }
    }
});

/** A fresh owner, registered for cleanup. */
async function seedOwner(): Promise<Created & { readonly email: string }> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b4-notice-trial-${randomUUID()}@example.test`,
            displayName: 'B4 notice trial',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id, email: users.email });
    if (!user) throw new Error('Expected user');
    const rows: Created = { userId: user.id };
    created.push(rows);
    return Object.assign(rows, { email: user.email });
}

/**
 * An `ACTIVE` PRINCIPAL subscription of the owner in accommodation, over its
 * own plan version (neither current nor sellable), with one `PENDING` provider
 * payment. Returns the payment to credit.
 */
async function seedActiveWithPendingPayment(
    rows: Created
): Promise<{ readonly paymentId: string }> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({ vertical, slug: `b4-notice-trial-${randomUUID()}`, name: 'B4 notice trial' })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
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
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    rows.billingOptionId = option.id;
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: rows.userId,
            vertical,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected subscription');
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: subscription.id,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: 'fake',
            providerFactId: `b4-notice-trial-${randomUUID()}`,
            factAt: new Date('2026-10-12T11:00:00.000Z')
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Expected payment');
    return { paymentId: payment.id };
}

/** P1 through the process-wide registry, as the receiver wires it. */
async function creditFirstPayment(paymentId: string): Promise<string> {
    const result = await creditPayment(
        { paymentId, chargeCreatedAt: new Date('2026-10-12T11:00:00.000Z') },
        { clock: getClock().clock, coverageNotices: getCoverageNotices() }
    );
    return result.outcome;
}

/** The trial rows of the owner in accommodation. */
async function trialRows(userId: string) {
    return getDb()
        .select({ status: trials.status, emailPseudonym: trials.emailPseudonym })
        .from(trials)
        .where(eq(trials.userId, userId));
}

/** One pending PRE_EXPIRY campaign mail for the owner, scheduled far away. */
async function seedPreExpiryCampaignMail(owner: {
    readonly userId: string;
    readonly email: string;
}) {
    const [row] = await getDb()
        .insert(emailOutbox)
        .values({
            recipientUserId: owner.userId,
            recipientEmail: owner.email,
            template: TRIAL_CAMPAIGN_TEMPLATES.PRE_EXPIRY[10] as string,
            payload: { verticals: [vertical] },
            sendAfter: new Date('2099-01-01T03:00:00.000Z'),
            dedupKey: `b4-notice-trial-${randomUUID()}`
        })
        .returning({ id: emailOutbox.id });
    if (!row) throw new Error('Expected campaign mail');
    return row.id;
}

describe('Coord-99 — the coverage notice drives T2, T5 and T8 through the composition root', () => {
    it('(a) T2: an ACTIVE subscription without payments does not convert; its first credited payment does', async () => {
        // Arrange
        const owner = await seedOwner();
        await createTrial({ userId: owner.userId, status: 'TRIAL_ACTIVE' });
        const { paymentId } = await seedActiveWithPendingPayment(owner);
        const campaignMailId = await seedPreExpiryCampaignMail(owner);

        // Act: the S2 notice (ADDED) of a subscription that has not charged yet
        await getCoverageNotices().emitCoverageChanged({
            userId: owner.userId,
            vertical,
            sourceType: 'SUBSCRIPTION',
            change: 'ADDED'
        });
        const afterAdded = (await trialRows(owner.userId)).map((row) => row.status);
        const outcome = await creditFirstPayment(paymentId);

        // Assert
        expect(afterAdded).toEqual(['TRIAL_ACTIVE']);
        expect(outcome).toBe('CREDITED');
        expect((await trialRows(owner.userId)).map((row) => row.status)).toEqual([
            'TRIAL_CONVERTED'
        ]);
        const [campaignMail] = await getDb()
            .select({ status: emailOutbox.status, lastError: emailOutbox.lastError })
            .from(emailOutbox)
            .where(eq(emailOutbox.id, campaignMailId));
        expect(campaignMail).toEqual({ status: 'failed', lastError: 'cancelled:trial-converted' });
    });

    it('(b) T5: an expired trial converts with the first credited payment', async () => {
        // Arrange
        const owner = await seedOwner();
        await createTrial({ userId: owner.userId, status: 'TRIAL_EXPIRED' });
        const { paymentId } = await seedActiveWithPendingPayment(owner);

        // Act
        const outcome = await creditFirstPayment(paymentId);

        // Assert
        expect(outcome).toBe('CREDITED');
        expect((await trialRows(owner.userId)).map((row) => row.status)).toEqual([
            'TRIAL_CONVERTED'
        ]);
    });

    it('(c) T8: without a trial row and with the activation event exercised, the first payment consumes the trial', async () => {
        // Arrange
        const owner = await seedOwner();
        const destinationId = await createVerticalDestination();
        owner.destinationId = destinationId;
        owner.listingId = await createListing({
            ownerId: owner.userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT,
            complete: false
        });
        // The exercised activation event is the owner's first publication record.
        await domainEventModel.insert({
            eventType: 'listing.status_changed',
            entityType: vertical,
            entityId: owner.listingId,
            actorId: owner.userId,
            actorType: 'owner',
            correlationId: randomUUID(),
            changes: [{ field: 'publicationStatus', old: 'DRAFT', new: 'PUBLISHED' }]
        });
        const { paymentId } = await seedActiveWithPendingPayment(owner);
        const expectedPseudonym = (await import('@repo/service-core')).computeTrialEmailPseudonym({
            email: owner.email
        });
        if (!expectedPseudonym.ok) throw new Error('Expected a valid fixture email');

        // Act
        const outcome = await creditFirstPayment(paymentId);

        // Assert
        expect(outcome).toBe('CREDITED');
        expect(await trialRows(owner.userId)).toEqual([
            { status: 'TRIAL_CONVERTED', emailPseudonym: expectedPseudonym.pseudonym }
        ]);
    });

    it('(d) no loop: convertTrialOnTitle runs once per billing notice although the conversion emits its own TRIAL notice', async () => {
        // Arrange
        const owner = await seedOwner();
        await createTrial({ userId: owner.userId, status: 'TRIAL_ACTIVE' });
        const { paymentId } = await seedActiveWithPendingPayment(owner);
        const received: CoverageChangedEvent[] = [];
        const stop = getCoverageNotices().onCoverageChanged((event) => {
            if (event.userId === owner.userId) received.push(event);
        });

        // Act
        await creditFirstPayment(paymentId);
        stop();

        // Assert
        expect(received).toEqual([
            { userId: owner.userId, vertical, sourceType: 'SUBSCRIPTION', change: 'CHANGED' },
            { userId: owner.userId, vertical, sourceType: 'TRIAL', change: 'REMOVED' }
        ]);
        expect(
            vi
                .mocked(verticals.convertTrialOnTitle)
                .mock.calls.map(([args]) => [args.event.userId, args.event.sourceType])
        ).toEqual([[owner.userId, 'SUBSCRIPTION']]);
        expect((await trialRows(owner.userId)).map((row) => row.status)).toEqual([
            'TRIAL_CONVERTED'
        ]);
    });
});
