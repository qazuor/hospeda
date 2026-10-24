import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    plans,
    planVersions,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

afterAll(closeServiceTestPool);

const now = new Date('2026-10-09T02:00:00.000Z');
const clock = { now: () => now };
const vipTemplate = 'billing.tourist-vip-inherited-cancel';

beforeAll(() => getServiceTestDb());

async function fixture() {
    const db = getServiceTestDb();
    const provider = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const [user] = await db
        .insert(users)
        .values({
            email: `hos1741-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1741 owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Could not seed user');
    const [ownerPlan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `hos1741-owner-${crypto.randomUUID()}`,
            name: 'Owner'
        })
        .returning();
    if (!ownerPlan) throw new Error('Could not seed owner plan');
    const [ownerVersion] = await db
        .insert(planVersions)
        .values({
            planId: ownerPlan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100_000_000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: true
        })
        .returning();
    if (!ownerVersion) throw new Error('Could not seed owner version');
    const [ownerOption] = await db
        .insert(billingOptions)
        .values({
            planVersionId: ownerVersion.id,
            cycle: 'monthly',
            amount: 250000,
            currency: 'ARS'
        })
        .returning();
    if (!ownerOption) throw new Error('Could not seed owner option');
    const [vipPlan] = await db
        .insert(plans)
        .values({
            vertical: 'tourist',
            slug: `hos1741-vip-${crypto.randomUUID()}`,
            name: 'Tourist VIP'
        })
        .returning();
    if (!vipPlan) throw new Error('Could not seed VIP plan');
    const [vipVersion] = await db
        .insert(planVersions)
        .values({
            planId: vipPlan.id,
            vertical: 'tourist',
            rank: Math.floor(Math.random() * 100_000_000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!vipVersion) throw new Error('Could not seed VIP version');
    const [vipOption] = await db
        .insert(billingOptions)
        .values({
            planVersionId: vipVersion.id,
            cycle: 'monthly',
            amount: 25000,
            currency: 'ARS'
        })
        .returning();
    if (!vipOption) throw new Error('Could not seed VIP option');
    const ownerAuthorization = await provider.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Owner',
        returnUrl: 'https://hospeda.example/account'
    });
    const vipAuthorization = await provider.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 25000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Tourist VIP',
        returnUrl: 'https://hospeda.example/account'
    });
    await provider.approve({ authorizationId: ownerAuthorization.authorizationId });
    await provider.approve({ authorizationId: vipAuthorization.authorizationId });
    const [owner] = await db
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: ownerVersion.id,
            billingOptionId: ownerOption.id,
            paymentMethod: 'CARD',
            status: 'PENDING_AUTHORIZATION',
            class: 'PRINCIPAL'
        })
        .returning();
    const [vip] = await db
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'tourist',
            planVersionId: vipVersion.id,
            billingOptionId: vipOption.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning();
    if (!owner || !vip) throw new Error('Could not seed subscriptions');
    await db.insert(providerLinks).values([
        {
            subscriptionId: owner.id,
            provider: 'MERCADO_PAGO',
            providerId: ownerAuthorization.authorizationId
        },
        {
            subscriptionId: vip.id,
            provider: 'MERCADO_PAGO',
            providerId: vipAuthorization.authorizationId
        }
    ]);
    const encoded = encodeFakeNotice({
        notice: {
            resourceKind: 'authorization',
            resourceId: ownerAuthorization.authorizationId,
            version: '1'
        },
        format: 'json'
    });
    const delivery: NoticeDelivery = {
        headers: { 'content-type': encoded.contentType },
        body: encoded.body
    };
    const readStatus = async (id: string) => {
        const [row] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, id));
        return row?.status;
    };
    const vipNotices = () =>
        db
            .select()
            .from(emailOutbox)
            .where(
                and(eq(emailOutbox.recipientUserId, user.id), eq(emailOutbox.template, vipTemplate))
            );
    return { db, provider, user, owner, vip, vipAuthorization, delivery, readStatus, vipNotices };
}

const inheritance = { inherits: async () => true };

describe('TEST:1741 webhook S2 inherited Tourist VIP', () => {
    it('cancels the VIP and delivers the notice in the same webhook delivery', async () => {
        const f = await fixture();
        const cancel = vi.spyOn(f.provider, 'cancel');
        const result = await receiveProviderDelivery(
            {
                url: `https://api.example.test/webhook?source_news=webhooks&t=${crypto.randomUUID()}`,
                delivery: f.delivery
            },
            {
                provider: f.provider,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                touristVipInheritance: inheritance
            }
        );
        expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
        expect(await f.readStatus(f.vip.id)).toBe('CANCELLED');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({
            authorizationId: f.vipAuthorization.authorizationId
        });
        const notices = await f.vipNotices();
        expect(notices).toHaveLength(1);
        expect(notices[0]?.template).toBe(vipTemplate);
    });

    it('queues the notice before cancellation and lets the sweep retry', async () => {
        const f = await fixture();
        const cancel = vi.spyOn(f.provider, 'cancel');
        const result = await receiveProviderDelivery(
            {
                url: `https://api.example.test/webhook?source_news=webhooks&t=${crypto.randomUUID()}`,
                delivery: f.delivery
            },
            {
                provider: f.provider,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice(),
                touristVipInheritance: inheritance
            }
        );
        expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
        expect(await f.readStatus(f.vip.id)).toBe('ACTIVE');
        expect(cancel).not.toHaveBeenCalled();
        const notices = await f.vipNotices();
        expect(notices).toHaveLength(1);
        expect(notices[0]?.template).toBe(vipTemplate);
    });

    it('acknowledges a committed activation when the VIP clause fails and ignores redelivery', async () => {
        const successful = await fixture();
        const successfulCancel = vi.spyOn(successful.provider, 'cancel');
        const successfulPorts = {
            provider: successful.provider,
            clock,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
            touristVipInheritance: inheritance
        };
        const successfulInput = {
            url: `https://api.example.test/webhook?source_news=webhooks&t=${crypto.randomUUID()}`,
            delivery: successful.delivery
        };
        const applied = await receiveProviderDelivery(successfulInput, successfulPorts);
        expect(applied).toEqual({ ack: 'OK', outcome: 'APPLIED' });
        const duplicate = await receiveProviderDelivery(successfulInput, successfulPorts);
        expect(duplicate.ack).toBe('OK');
        expect(successfulCancel).toHaveBeenCalledTimes(1);
        expect(await successful.readStatus(successful.vip.id)).toBe('CANCELLED');
        expect(await successful.vipNotices()).toHaveLength(1);

        const f = await fixture();
        const originalRead = f.provider.readAuthorization.bind(f.provider);
        vi.spyOn(f.provider, 'readAuthorization').mockImplementation(async (input) => {
            if (input.authorizationId === f.vipAuthorization.authorizationId) {
                throw new Error('simulated VIP authorization read failure');
            }
            return originalRead(input);
        });
        const ports = {
            provider: f.provider,
            clock,
            beforeCancelNotice: outboxBeforeCancelNotice(),
            touristVipInheritance: inheritance
        };
        const input = {
            url: `https://api.example.test/webhook?source_news=webhooks&t=${crypto.randomUUID()}`,
            delivery: f.delivery
        };
        const first = await receiveProviderDelivery(input, ports);
        expect(first).toEqual({ ack: 'OK', outcome: 'APPLIED' });
        expect(await f.readStatus(f.owner.id)).toBe('ACTIVE');
        const second = await receiveProviderDelivery(input, ports);
        expect(second.ack).toBe('OK');
        expect(await f.vipNotices()).toHaveLength(0);
    });
});
