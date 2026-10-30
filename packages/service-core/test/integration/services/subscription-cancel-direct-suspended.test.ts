import { type DrizzleClient, domainEventModel, emailOutbox, eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { cancelActiveNow, seedCancelActive } from './support/cancel-active-fixtures.js';
import {
    retireCancelDirectRows,
    seedDirectCancellation
} from './support/cancel-direct-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const owner = (id: string): Actor => ({ id, roles: [], permissions: [] });
const clock = { now: () => cancelActiveNow };
const orphanhood = {
    addonPolicy: async () => {
        throw new Error('unexpected addon policy read');
    },
    listing: async () => {
        throw new Error('unexpected listing read');
    }
};
const extraRows: string[] = [];
const ports = (fake: FakePaymentProvider, coverage = vi.fn(async () => undefined)) => ({
    provider: fake,
    clock,
    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
    coverageNotices: { emitCoverageChanged: coverage },
    orphanhood
});
afterEach(async () => {
    if (extraRows.length)
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', serviceEndsAt: cancelActiveNow })
            .where(eq(subscriptions.id, extraRows.pop()!));
    await retireCancelDirectRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8a:8 S23 from SUSPENDED', () => {
    it('TEST:B8a:8 (a), TEST:1570:1 (a,e): cancels after commit and repeats idempotently', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'SUSPENDED',
            preapproval: 'LIVE'
        });
        const originalCancel = fake.cancel.bind(fake);
        const cancel = vi.spyOn(fake, 'cancel').mockImplementation(async (args) => {
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row?.status).toBe('CANCELLED');
            return originalCancel(args);
        });
        const coverage = vi.fn(async () => undefined);
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake, coverage)
        );
        expect(result).toMatchObject({
            outcome: 'CANCELLED',
            origin: 'SUSPENDED',
            transition: 'S23',
            serviceEndedAt: cancelActiveNow,
            cancelCall: 'SENT'
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(coverage).toHaveBeenCalledWith({
            userId: seeded.userId,
            vertical: 'accommodation',
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: seeded.subscriptionId
        });
        expect(
            events.find((event) => event.eventType === 'subscription.provider_cancellation_decided')
                ?.reason
        ).toBe('S23');
        const outboxBeforeRepeat = await getServiceTestDb()
            .select({ id: emailOutbox.id })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, seeded.userId));
        const repeated = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake, coverage)
        );
        expect(repeated).toMatchObject({
            outcome: 'ALREADY_CANCELLED',
            serviceEndedAt: cancelActiveNow
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(coverage).toHaveBeenCalledTimes(1);
        expect(
            await getServiceTestDb()
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, seeded.userId))
        ).toHaveLength(outboxBeforeRepeat.length);
        expect(
            (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: seeded.subscriptionId
                })
            ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided')
        ).toHaveLength(1);
    });

    it('TEST:B8a:8 (c): manual payer is local only', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'SUSPENDED',
            paymentMethod: 'MANUAL'
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', cancelCall: 'NOT_APPLICABLE' });
        expect(cancel).not.toHaveBeenCalled();
        expect(
            (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: seeded.subscriptionId
                })
            ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided')
        ).toHaveLength(0);
    });

    it('TEST:B8a:8 (b): an already cancelled preapproval is decided but not called again', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'SUSPENDED',
            preapproval: 'CANCELLED'
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', cancelCall: 'NOT_NEEDED' });
        expect(cancel).not.toHaveBeenCalled();
        expect(
            (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: seeded.subscriptionId
                })
            ).filter(
                (event) =>
                    event.eventType === 'subscription.provider_cancellation_decided' &&
                    event.reason === 'S23'
            )
        ).toHaveLength(1);
    });

    it('TEST:B8a:8 (f): closes a live succession through the injected S18 port', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'SUSPENDED',
            paymentMethod: 'MANUAL',
            liveSuccessor: true
        });
        const closeSuccession = vi.fn(
            async (_input: { predecessorSubscriptionId: string; tx: DrizzleClient }) => undefined
        );
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            { ...ports(fake), successionCloser: { closeSuccession } }
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', successionClosed: true });
        expect(closeSuccession).toHaveBeenCalledTimes(1);
        expect(closeSuccession.mock.calls[0]?.[0].predecessorSubscriptionId).toBe(
            seeded.subscriptionId
        );
    });

    it('TEST:1570:1 calls no S18 when there is no live successor', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'SUSPENDED',
            paymentMethod: 'MANUAL'
        });
        const closeSuccession = vi.fn(
            async (_input: { predecessorSubscriptionId: string; tx: DrizzleClient }) => undefined
        );
        await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            { ...ports(fake), successionCloser: { closeSuccession } }
        );
        expect(closeSuccession).not.toHaveBeenCalled();
    });

    it('TEST:B8a:8 (g): missing S18 implementation rolls back the whole direct cancellation', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'SUSPENDED',
            liveSuccessor: true
        });
        const cancel = vi.spyOn(fake, 'cancel');
        await expect(
            cancelDirectSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                ports(fake)
            )
        ).rejects.toMatchObject({ reason: 'SUCCESSION_CLOSER_NOT_REGISTERED' });
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('SUSPENDED');
        expect(cancel).not.toHaveBeenCalled();
        expect(
            (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: seeded.subscriptionId
                })
            ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided')
        ).toHaveLength(0);
    });

    it.each([
        'CARD',
        'MANUAL'
    ] as const)('TEST:B8a:8 (d): releases commitment lock A for %s', async (paymentMethod) => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({ fake, status: 'SUSPENDED', paymentMethod });
        const insert = async () => {
            const [source] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId))
                .limit(1);
            if (!source) throw new Error('direct cancellation row missing');
            const [row] = await getServiceTestDb()
                .insert(subscriptions)
                .values({
                    userId: source.userId,
                    vertical: source.vertical,
                    planVersionId: source.planVersionId,
                    billingOptionId: source.billingOptionId,
                    paymentMethod,
                    status: 'PENDING_AUTHORIZATION',
                    class: 'PRINCIPAL'
                })
                .returning({ id: subscriptions.id });
            if (!row) throw new Error('pending commitment row missing');
            extraRows.push(row.id);
        };
        let failure: unknown;
        try {
            await insert();
        } catch (error) {
            failure = error;
        }
        const codes = (error: unknown): string[] =>
            error && typeof error === 'object'
                ? [
                      String((error as { code?: unknown }).code ?? ''),
                      ...codes((error as { cause?: unknown }).cause)
                  ]
                : [];
        expect(codes(failure)).toContain('23505');
        await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        await insert();
    });

    it('TEST:1570:1 rejects an unrelated owner without writing', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({ fake, status: 'SUSPENDED' });
        await expect(
            cancelDirectSubscription(
                { actor: owner(crypto.randomUUID()), subscriptionId: seeded.subscriptionId },
                ports(fake)
            )
        ).rejects.toMatchObject({
            reason: 'SUBSCRIPTION_NOT_FOUND',
            code: ServiceErrorCode.NOT_FOUND
        });
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('SUSPENDED');
    });

    it('TEST:1570:1 hides an invalid subscription id as not found', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        await expect(
            cancelDirectSubscription(
                { actor: owner(crypto.randomUUID()), subscriptionId: 'invalid' },
                ports(fake)
            )
        ).rejects.toMatchObject({
            reason: 'SUBSCRIPTION_NOT_FOUND',
            code: ServiceErrorCode.NOT_FOUND
        });
    });

    it('TEST:1570:1 (h): ACC_8 admin may cancel another owner row; system actor is forbidden', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({ fake, status: 'SUSPENDED' });
        const admin: Actor = {
            id: crypto.randomUUID(),
            roles: [],
            permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
        };
        await expect(
            cancelDirectSubscription(
                { actor: admin, subscriptionId: seeded.subscriptionId },
                ports(fake)
            )
        ).resolves.toMatchObject({ outcome: 'CANCELLED' });
        expect(
            (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: seeded.subscriptionId
                })
            ).find((event) => event.eventType === 'subscription.provider_cancellation_decided')
                ?.actorType
        ).toBe('admin');
        const another = await seedDirectCancellation({
            fake: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
            status: 'SUSPENDED'
        });
        const system: Actor = {
            id: crypto.randomUUID(),
            roles: [],
            permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
            _isSystemActor: true
        };
        await expect(
            cancelDirectSubscription(
                { actor: system, subscriptionId: another.subscriptionId },
                ports(fake)
            )
        ).rejects.toMatchObject({
            reason: 'CANCELLATION_FORBIDDEN',
            code: ServiceErrorCode.FORBIDDEN
        });
    });

    it.each([
        'ACTIVE',
        'CANCEL_SCHEDULED',
        'PAUSED',
        'PENDING_AUTHORIZATION',
        'ABANDONED',
        'CHARGE_DECLINED'
    ] as const)('TEST:1570:1 (i): rejects %s as an unsupported origin', async (status) => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedCancelActive({ fake, status });
        await expect(
            cancelDirectSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                ports(fake)
            )
        ).rejects.toMatchObject({
            reason: 'CANCELLATION_STATE_NOT_ALLOWED',
            code: ServiceErrorCode.ALREADY_EXISTS
        });
    });

    it('TEST:1570:1 (i): rejects a SUSPENDED complement', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedCancelActive({ fake, status: 'SUSPENDED', class: 'COMPLEMENTO' });
        await expect(
            cancelDirectSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                ports(fake)
            )
        ).rejects.toMatchObject({
            reason: 'CANCELLATION_NOT_PRINCIPAL',
            code: ServiceErrorCode.ALREADY_EXISTS
        });
    });
});
