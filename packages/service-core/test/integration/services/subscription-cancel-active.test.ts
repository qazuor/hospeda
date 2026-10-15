import { domainEventModel, eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cancelActiveNow,
    retireCancelActiveRows,
    seedCancelActive
} from './support/cancel-active-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const owner = (id: string): Actor => ({ id, roles: [], permissions: [] });
const fakeProvider = (fake: FakePaymentProvider) => fake;
const clock = { now: () => cancelActiveNow };
afterEach(retireCancelActiveRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8a:1 / TEST:1568:3 S11 active subscription',
    () => {
        it('TEST:B8a:1 (a,e): uses the anchored annual cycle even when provider cadence is monthly', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({
                fake,
                cycle: 'annual',
                payment: 'payment',
                nextChargeAt: new Date('2028-10-01T00:00:00.000Z')
            });
            const originalCancel = fake.cancel.bind(fake);
            const cancel = vi
                .spyOn(fake, 'cancel')
                .mockImplementation(async ({ authorizationId }) => {
                    const [row] = await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, seeded.subscriptionId));
                    expect(row?.status).toBe('CANCEL_SCHEDULED');
                    return originalCancel({ authorizationId });
                });
            const coverage = vi.fn(async () => undefined);
            const result = await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fakeProvider(fake),
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: coverage }
                }
            );
            expect(result).toMatchObject({
                outcome: 'SCHEDULED',
                serviceEndsAt: new Date('2027-10-01T00:00:00.000Z'),
                cancelCall: 'SENT'
            });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(coverage).toHaveBeenCalledWith({
                userId: seeded.userId,
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            });
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.subscriptionId
            });
            expect(
                events
                    .filter(
                        (event) => event.eventType === 'subscription.provider_cancellation_decided'
                    )
                    .map((event) => event.reason)
            ).toContain('S11');
        });
        it('TEST:B8a:1 (c,d): ignores retry next charge and the newer released period', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({
                fake,
                payment: 'payment',
                cycle: 'monthly',
                periodStart: new Date('2026-09-01T00:00:00.000Z'),
                additionalOpenPeriodStart: new Date('2026-10-01T00:00:00.000Z'),
                releasedPeriodStart: new Date('2026-12-01T00:00:00.000Z'),
                nextChargeAt: new Date('2026-12-01T00:00:00.000Z')
            });
            const result = await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            expect(result).toMatchObject({
                serviceEndsAt: new Date('2026-11-01T00:00:00.000Z'),
                basis: 'PAID_PERIOD'
            });
        });
        it('TEST:B8a:1 (b): manual payment on a card principal uses the same formula', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({ fake, payment: 'manual' });
            const cancel = vi.spyOn(fake, 'cancel');
            const result = await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            expect(result).toMatchObject({
                outcome: 'SCHEDULED',
                serviceEndsAt: new Date('2026-11-01T00:00:00.000Z'),
                cancelCall: 'SENT'
            });
            expect(cancel).toHaveBeenCalledTimes(1);
        });
        it('TEST:B8a:1 (f): manual payer keeps formula and records no provider decision', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({
                fake,
                payment: 'payment',
                paymentMethod: 'MANUAL'
            });
            const cancel = vi.spyOn(fake, 'cancel');
            const result = await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            expect(result).toMatchObject({
                serviceEndsAt: new Date('2026-11-01T00:00:00.000Z'),
                cancelCall: 'NOT_APPLICABLE'
            });
            expect(cancel).not.toHaveBeenCalled();
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row?.status).toBe('CANCEL_SCHEDULED');
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.subscriptionId
            });
            expect(
                events.filter(
                    (event) => event.eventType === 'subscription.provider_cancellation_decided'
                )
            ).toHaveLength(0);
        });
        it('I-4: card without a provider link schedules locally without a decision or provider call', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({ fake, payment: 'payment', withLink: false });
            const cancel = vi.spyOn(fake, 'cancel');
            const result = await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            expect(result).toMatchObject({
                outcome: 'SCHEDULED',
                serviceEndsAt: new Date('2026-11-01T00:00:00.000Z'),
                cancelCall: 'NOT_APPLICABLE'
            });
            expect(cancel).not.toHaveBeenCalled();
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.subscriptionId
            });
            expect(
                events.filter(
                    (event) => event.eventType === 'subscription.provider_cancellation_decided'
                )
            ).toHaveLength(0);
        });
        it('TEST:1568:3 keeps the committed decision and defers when the notice is pending; repeat is idempotent', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({ fake, payment: 'payment' });
            const cancel = vi.spyOn(fake, 'cancel');
            const ports = {
                provider: fake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice(),
                coverageNotices: { emitCoverageChanged: async () => undefined }
            };
            const first = await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                ports
            );
            const second = await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                ports
            );
            expect(first).toMatchObject({ outcome: 'SCHEDULED', cancelCall: 'NOTICE_PENDING' });
            expect(second).toMatchObject({
                outcome: 'ALREADY_SCHEDULED',
                serviceEndsAt: first.serviceEndsAt
            });
            expect(cancel).not.toHaveBeenCalled();
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.subscriptionId
            });
            expect(
                events.filter(
                    (event) =>
                        event.eventType === 'subscription.provider_cancellation_decided' &&
                        event.reason === 'S11'
                )
            ).toHaveLength(1);
        });
        it('TEST:1568:3 hides a stranger row from an unauthorized actor', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({ fake, payment: 'payment' });
            await expect(
                cancelActiveSubscription(
                    { actor: owner(seeded.userId), subscriptionId: 'not-a-uuid' },
                    {
                        provider: fake,
                        clock,
                        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                        coverageNotices: { emitCoverageChanged: async () => undefined }
                    }
                )
            ).rejects.toMatchObject({
                reason: 'SUBSCRIPTION_NOT_FOUND',
                code: ServiceErrorCode.NOT_FOUND
            });
            await expect(
                cancelActiveSubscription(
                    { actor: owner(crypto.randomUUID()), subscriptionId: seeded.subscriptionId },
                    {
                        provider: fake,
                        clock,
                        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                        coverageNotices: { emitCoverageChanged: async () => undefined }
                    }
                )
            ).rejects.toMatchObject({
                reason: 'SUBSCRIPTION_NOT_FOUND',
                code: ServiceErrorCode.NOT_FOUND
            });
        });
        it('TEST:1568:3 permits ACC_8 admins but refuses a system actor', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({ fake, payment: 'payment' });
            const admin: Actor = {
                id: crypto.randomUUID(),
                roles: [],
                permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
            };
            const result = await cancelActiveSubscription(
                { actor: admin, subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            expect(result.outcome).toBe('SCHEDULED');
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.subscriptionId
            });
            expect(
                events.find(
                    (event) => event.eventType === 'subscription.provider_cancellation_decided'
                )?.actorType
            ).toBe('admin');

            const secondFake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const second = await seedCancelActive({ fake: secondFake, payment: 'payment' });
            const system: Actor = {
                id: crypto.randomUUID(),
                roles: [],
                permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
                _isSystemActor: true
            };
            await expect(
                cancelActiveSubscription(
                    { actor: system, subscriptionId: second.subscriptionId },
                    {
                        provider: secondFake,
                        clock,
                        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                        coverageNotices: { emitCoverageChanged: async () => undefined }
                    }
                )
            ).rejects.toMatchObject({
                reason: 'CANCELLATION_FORBIDDEN',
                code: ServiceErrorCode.FORBIDDEN
            });
        });
        it('TEST:1568:3 rejects other states and non-principals without writing', async () => {
            for (const status of [
                'GRACE_PERIOD',
                'SUSPENDED',
                'PAUSED',
                'CANCELLED',
                'PENDING_AUTHORIZATION'
            ]) {
                const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
                const seeded = await seedCancelActive({ fake, payment: 'payment', status });
                await expect(
                    cancelActiveSubscription(
                        { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                        {
                            provider: fake,
                            clock,
                            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                            coverageNotices: { emitCoverageChanged: async () => undefined }
                        }
                    )
                ).rejects.toMatchObject({
                    reason: 'CANCELLATION_STATE_NOT_ALLOWED',
                    code: ServiceErrorCode.ALREADY_EXISTS
                });
            }
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const seeded = await seedCancelActive({
                fake,
                payment: 'payment',
                class: 'COMPLEMENTO'
            });
            await expect(
                cancelActiveSubscription(
                    { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                    {
                        provider: fake,
                        clock,
                        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                        coverageNotices: { emitCoverageChanged: async () => undefined }
                    }
                )
            ).rejects.toMatchObject({
                reason: 'CANCELLATION_NOT_PRINCIPAL',
                code: ServiceErrorCode.ALREADY_EXISTS
            });
        });
    }
);
