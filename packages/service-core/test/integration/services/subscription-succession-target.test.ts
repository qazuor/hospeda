import {
    billingDeadlineVersions,
    providerLinks,
    reconciliationMarkModel,
    subscriptionModel,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import { checkSuccessionTarget } from '../../../src/services/billing/subscription/succession-target-guard';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

afterAll(closeServiceTestPool);
const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };
const deadlines = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;
async function fixture(status = 'ACTIVE', paymentMethod = 'CARD') {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `succ-${crypto.randomUUID()}@example.test`,
            displayName: 'Succession test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    await db
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `succ-${crypto.randomUUID()}`, 'Succession plan']
        )
    ).rows[0]?.id;
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1e8) + 1]
        )
    ).rows[0]?.id;
    const optionId = (
        await getServiceTestPool().query(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id as string;
    if (!versionId || !optionId) throw new Error('No plan anchors');
    const row = await subscriptionModel.createPendingAuthorization({
        userId: user.id,
        vertical: 'accommodation',
        planVersionId: versionId,
        billingOptionId: optionId,
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date('2027-01-01T00:00:00Z')
    });
    await getServiceTestPool().query(
        'UPDATE subscription SET status=$2, payment_method=$3 WHERE id=$1',
        [row.subscription.id, status, paymentMethod]
    );
    return { id: row.subscription.id, userId: user.id };
}
const admin = (id: string) => ({ type: 'admin' as const, id });
async function mark(id: string, userId: string) {
    await openReconciliationMark({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: id },
        reason: 'DIVERGENCIA_DE_MONTO',
        actor: admin(userId),
        correlationId: crypto.randomUUID()
    });
}
async function linkedProvider(id: string, status?: 'cancelled') {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'succession guard provider read' }]
    });
    const created = await fake.authorize({
        reference: id,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Plan',
        returnUrl: 'https://hospeda.example'
    });
    if (status === 'cancelled') await fake.cancel({ authorizationId: created.authorizationId });
    await getServiceTestDb().insert(providerLinks).values({
        subscriptionId: id,
        provider: 'MERCADO_PAGO',
        providerId: created.authorizationId
    });
    return fake;
}

describe('TEST:B3:14 succession target guard', () => {
    it('allows an unmarked row without calling the provider', async () => {
        const row = await fixture();
        const fake = await linkedProvider(row.id);
        const read = vi.spyOn(fake, 'readAuthorization');
        await expect(
            checkSuccessionTarget({ targetSubscriptionId: row.id }, { provider: fake, clock })
        ).resolves.toEqual({ allowed: true, basis: 'NO_OPEN_MARK' });
        expect(read).not.toHaveBeenCalled();
    });
    it('refuses a marked ACTIVE row without a provider read', async () => {
        const row = await fixture();
        await mark(row.id, row.userId);
        const fake = await linkedProvider(row.id);
        const read = vi.spyOn(fake, 'readAuthorization');
        await expect(
            checkSuccessionTarget({ targetSubscriptionId: row.id }, { provider: fake, clock })
        ).resolves.toEqual({ allowed: false, reason: 'MARKED_NOT_SUCCEEDABLE' });
        expect(read).not.toHaveBeenCalled();
    });
    it('confirms cancellation by id for CANCEL_SCHEDULED and rejects a live authorization', async () => {
        const stopped = await fixture('CANCEL_SCHEDULED');
        await mark(stopped.id, stopped.userId);
        const cancelled = await linkedProvider(stopped.id, 'cancelled');
        await expect(
            checkSuccessionTarget(
                { targetSubscriptionId: stopped.id },
                { provider: cancelled, clock }
            )
        ).resolves.toEqual({ allowed: true, basis: 'CANCEL_SCHEDULED_CONFIRMED_CANCELLED' });
        const live = await fixture('CANCEL_SCHEDULED');
        await mark(live.id, live.userId);
        const provider = await linkedProvider(live.id);
        await expect(
            checkSuccessionTarget({ targetSubscriptionId: live.id }, { provider, clock })
        ).resolves.toEqual({ allowed: false, reason: 'MARKED_PREAPPROVAL_STILL_LIVE' });
    });
    it('only permits marked CARD SUSPENDED rows after confirmed cancellation', async () => {
        const card = await fixture('SUSPENDED', 'CARD');
        await mark(card.id, card.userId);
        const fake = await linkedProvider(card.id, 'cancelled');
        await expect(
            checkSuccessionTarget({ targetSubscriptionId: card.id }, { provider: fake, clock })
        ).resolves.toEqual({ allowed: true, basis: 'CARD_SUSPENDED_CONFIRMED_CANCELLED' });
        const manual = await fixture('SUSPENDED', 'MANUAL');
        await mark(manual.id, manual.userId);
        const readFake = await linkedProvider(manual.id);
        const read = vi.spyOn(readFake, 'readAuthorization');
        await expect(
            checkSuccessionTarget(
                { targetSubscriptionId: manual.id },
                { provider: readFake, clock }
            )
        ).resolves.toEqual({ allowed: false, reason: 'MARKED_NOT_SUCCEEDABLE' });
        expect(read).not.toHaveBeenCalled();
        const cardStillLive = await fixture('SUSPENDED', 'CARD');
        await mark(cardStillLive.id, cardStillLive.userId);
        const liveProvider = await linkedProvider(cardStillLive.id);
        await expect(
            checkSuccessionTarget(
                { targetSubscriptionId: cardStillLive.id },
                { provider: liveProvider, clock }
            )
        ).resolves.toEqual({ allowed: false, reason: 'MARKED_PREAPPROVAL_STILL_LIVE' });
    });
    it('fails closed without link, ignores lifted marks and reports missing targets', async () => {
        const row = await fixture('CANCEL_SCHEDULED');
        await mark(row.id, row.userId);
        const noCalls = { readAuthorization: vi.fn() } as never;
        await expect(
            checkSuccessionTarget({ targetSubscriptionId: row.id }, { provider: noCalls, clock })
        ).resolves.toEqual({ allowed: false, reason: 'MARKED_NO_PROVIDER_LINK' });
        const marks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.id }
        });
        const fake = await linkedProvider(row.id);
        if (!marks[0]) throw new Error('No mark');
        await reconciliationMarkModel.lift({
            markId: marks[0].id,
            expectedVersion: marks[0].version,
            liftedBy: row.userId,
            now: clock.now()
        });
        await expect(
            checkSuccessionTarget({ targetSubscriptionId: row.id }, { provider: fake, clock })
        ).resolves.toEqual({ allowed: true, basis: 'NO_OPEN_MARK' });
        await expect(
            checkSuccessionTarget(
                { targetSubscriptionId: crypto.randomUUID() },
                { provider: fake, clock }
            )
        ).resolves.toEqual({ allowed: false, reason: 'TARGET_NOT_FOUND' });
    });
});
