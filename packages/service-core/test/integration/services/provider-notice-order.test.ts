import {
    billingDeadlineVersions,
    eq,
    providerLinks,
    reconciliationMarks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };
const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const values = {
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

async function setup() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `notice-${crypto.randomUUID()}@example.test`,
            displayName: 'Notice',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('missing user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `notice-${crypto.randomUUID()}`, 'Plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('missing plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1_000_000_000)]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('missing version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('missing option');
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'fixture signup must succeed' }]
    });
    const started = await startSubscription(
        { userId: user.id, billingOptionId, returnUrl: 'https://example.test' },
        {
            provider,
            clock,
            beforeCancelNotice,
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    return { provider, started };
}

function delivery(resourceId: string, version: string) {
    return {
        headers: { 'content-type': 'application/json' },
        body: encodeFakeNotice({
            notice: { resourceKind: 'authorization', resourceId, version },
            format: 'json'
        }).body
    };
}

describe('provider notices, order and acknowledgements', () => {
    it('TEST:B3:18 applies only a fresh by-id state and discards older versions without a read', async () => {
        const { provider, started } = await setup();
        await provider.approve({ authorizationId: started.authorizationId });
        const spy = vi.spyOn(provider, 'readAuthorization');
        const newer = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(started.authorizationId, '8') },
            { provider, clock, beforeCancelNotice }
        );
        const older = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(started.authorizationId, '7') },
            { provider, clock, beforeCancelNotice }
        );
        expect(newer).toEqual({ ack: 'OK', outcome: 'APPLIED' });
        expect(older).toEqual({ ack: 'OK', outcome: 'DISCARDED_OLD_VERSION' });
        expect(spy).toHaveBeenCalledTimes(1);
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(link?.lastAppliedVersion).toBe('8');
        expect(link?.lastModified).toEqual(now);
    });

    it('TEST:B3:18 converges when versions arrive in ascending order and never trusts notice state', async () => {
        const first = await setup();
        await first.provider.approve({ authorizationId: first.started.authorizationId });
        const reads = vi.spyOn(first.provider, 'readAuthorization');
        await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(first.started.authorizationId, '7') },
            { provider: first.provider, clock, beforeCancelNotice }
        );
        await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(first.started.authorizationId, '8') },
            { provider: first.provider, clock, beforeCancelNotice }
        );
        const [activeRow] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, first.started.subscriptionId));
        const [activeLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, first.started.subscriptionId));
        expect(activeRow?.status).toBe('ACTIVE');
        expect(activeLink?.lastAppliedVersion).toBe('8');
        expect(activeLink?.lastModified).toEqual(now);
        expect(reads).toHaveBeenCalledTimes(2);

        const second = await setup();
        const noop = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(second.started.authorizationId, '9') },
            { provider: second.provider, clock, beforeCancelNotice }
        );
        const duplicate = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(second.started.authorizationId, '9') },
            { provider: second.provider, clock, beforeCancelNotice }
        );
        const [pendingRow] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, second.started.subscriptionId));
        const [pendingLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, second.started.subscriptionId));
        const pendingMarks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, second.started.subscriptionId));
        expect(noop.outcome).toBe('NOOP');
        expect(duplicate.outcome).toBe('DISCARDED_OLD_VERSION');
        expect(pendingRow?.status).toBe('PENDING_AUTHORIZATION');
        expect(pendingLink?.lastAppliedVersion).toBe('9');
        expect(pendingMarks).toHaveLength(0);
    });

    // H-10 (HOS-1676): an unknown Webhooks resource goes to the B11 handler, which re-reads it by
    // id once; one the provider does not have is still acknowledged. IPN is never processed.
    it('TEST:B3:18 acknowledges unknown resources after one by-id read, and IPN without provider calls', async () => {
        const { provider } = await setup();
        const decode = vi.spyOn(provider, 'decodeNotice');
        const reads = vi.spyOn(provider, 'readAuthorization');
        expect(
            await processProviderNotice(
                { channel: 'WEBHOOKS', delivery: delivery('missing', '1') },
                { provider, clock, beforeCancelNotice }
            )
        ).toEqual({ ack: 'OK', outcome: 'UNKNOWN_RESOURCE' });
        expect(
            await processProviderNotice(
                { channel: 'IPN', delivery: delivery('missing', '1') },
                { provider, clock, beforeCancelNotice }
            )
        ).toEqual({ ack: 'OK', outcome: 'IPN_NOT_PROCESSED' });
        expect(decode).toHaveBeenCalledTimes(1);
        expect(reads).toHaveBeenCalledTimes(1);
        expect(reads).toHaveBeenCalledWith({ authorizationId: 'missing' });
    });

    it('TEST:B3:18 acknowledges charge and refund notices without processing them', async () => {
        const { provider, started } = await setup();
        await provider.approve({ authorizationId: started.authorizationId });
        await subscriptionModel.activatePendingAuthorization({
            subscriptionId: started.subscriptionId,
            now: clock.now()
        });
        const { chargeId } = await provider.declineCharge({
            authorizationId: started.authorizationId,
            declineReason: 'risk'
        });
        const charge = vi.spyOn(provider, 'readCharge');
        const resultFor = (resourceKind: 'charge' | 'refund') =>
            processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: (() => {
                        const encoded = encodeFakeNotice({
                            notice: {
                                resourceKind,
                                resourceId: resourceKind === 'charge' ? chargeId : 'refund-id',
                                version: '1'
                            },
                            format: 'json'
                        });
                        return {
                            headers: { 'content-type': encoded.contentType },
                            body: encoded.body
                        };
                    })()
                },
                { provider, clock, beforeCancelNotice }
            );

        expect(await resultFor('charge')).toEqual({ ack: 'OK', outcome: 'S16' });
        expect(await resultFor('refund')).toEqual({
            ack: 'OK',
            outcome: 'RESOURCE_KIND_NOT_HANDLED'
        });
        // B5.1: the charge fact is recorded before S16 re-reads it
        expect(charge).toHaveBeenCalledTimes(3);
    });

    it('TEST:B3:18 returns ERROR and preserves the link version when the provider read fails', async () => {
        const { provider, started } = await setup();
        const [before] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        vi.spyOn(provider, 'readAuthorization').mockRejectedValue(
            new Error('temporary read failure')
        );
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(started.authorizationId, '7') },
            { provider, clock, beforeCancelNotice }
        );
        const [after] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
        expect(after?.lastAppliedVersion).toBe(before?.lastAppliedVersion);
    });

    it('TEST:B3:18 marks an undeclared pair once and leaves its subscription unchanged', async () => {
        const { provider, started } = await setup();
        await provider.approve({ authorizationId: started.authorizationId });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'GRACE_PERIOD' })
            .where(eq(subscriptions.id, started.subscriptionId));
        const invoke = (version: string) =>
            processProviderNotice(
                { channel: 'WEBHOOKS', delivery: delivery(started.authorizationId, version) },
                { provider, clock, beforeCancelNotice }
            );
        expect((await invoke('7')).outcome).toBe('DIVERGENCE_MARKED');
        expect((await invoke('8')).outcome).toBe('DIVERGENCE_MARKED');
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, started.subscriptionId));
        expect(row?.status).toBe('GRACE_PERIOD');
        expect(
            marks.filter((mark) => mark.reason === 'TRANSICION_NO_DECLARADA' && !mark.liftedAt)
        ).toHaveLength(1);
    });

    it('TEST:B3:18 fails an unregistered delegate and does not advance its version', async () => {
        const { provider, started } = await setup();
        await provider.approve({ authorizationId: started.authorizationId });
        await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery(started.authorizationId, '7') },
            { provider, clock, beforeCancelNotice }
        );
        await provider.pause({ authorizationId: started.authorizationId });
        const pauseDelivery = delivery(started.authorizationId, '8');
        const [linkBefore] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: pauseDelivery },
            { provider, clock, beforeCancelNotice }
        );
        const [linkAfter] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
        expect(linkAfter?.lastAppliedVersion).toBe(linkBefore?.lastAppliedVersion);
    });
});
