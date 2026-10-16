import {
    type DrizzleClient,
    domainEventModel,
    eq,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { runPauseGiftDetection } from '../../../src/services/billing/reconciliation/sweep/pause-gift-check.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import { seedRenewalSubscription } from './support/renewal-notice-fixtures.js';

afterAll(closeServiceTestPool);
const clock = { now: () => new Date('2026-12-03T12:00:00Z') };

async function pause(tx: DrizzleClient, subscriptionId: string, startsAt: string, endedAt: string) {
    const [row] = await tx
        .insert(subscriptionPauses)
        .values({
            subscriptionId,
            reason: 'CUSTOMER_REQUEST',
            startsAt: new Date(startsAt),
            actualEndAt: new Date(endedAt)
        })
        .returning();
    if (!row) throw new Error('pause fixture failed');
    return row.id;
}

describe('TEST:B11:17 pause gift detection', () => {
    it('writes one event with the skipped and next dates for Juan, and does not duplicate it', async () => {
        await withServiceTestTransaction(async (tx) => {
            const sub = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const pauseId = await pause(
                tx,
                sub.subscriptionId,
                '2026-10-31T12:00:00Z',
                '2026-12-02T12:00:00Z'
            );
            const input = { correlationId: crypto.randomUUID(), pageSize: 100 };
            const [subscriptionBefore] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, sub.subscriptionId));
            const first = await runPauseGiftDetection(input, { clock, tx });
            expect(first.detected).toBe(1);
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription_pause',
                entityId: pauseId,
                tx
            });
            const event = events.find(
                (item) => item.eventType === 'reconciliation.pause_gift_detected'
            );
            expect(event?.changes).toEqual([
                { field: 'subscription.id', new: sub.subscriptionId },
                { field: 'pause.starts_at', new: '2026-10-31T12:00:00.000Z' },
                { field: 'pause.ended_at', new: '2026-12-02T12:00:00.000Z' },
                { field: 'charge.first_skipped_at', new: '2026-11-01T12:00:00.000Z' },
                { field: 'charge.next_after_return_at', new: '2027-01-01T12:00:00.000Z' },
                { field: 'gift.days', new: 29 },
                { field: 'gift.cycle_months', new: 1 }
            ]);
            expect((await runPauseGiftDetection(input, { clock, tx })).detected).toBe(0);
            expect(
                (
                    await domainEventModel.findByEntity({
                        entityType: 'subscription_pause',
                        entityId: pauseId,
                        tx
                    })
                ).filter((item) => item.eventType === 'reconciliation.pause_gift_detected')
            ).toHaveLength(1);
            expect(
                await tx
                    .select()
                    .from(reconciliationMarks)
                    .where(eq(reconciliationMarks.subscriptionId, sub.subscriptionId))
            ).toHaveLength(0);
            expect(
                (
                    await tx
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, sub.subscriptionId))
                )[0]
            ).toEqual(subscriptionBefore);
        });
    });

    it('detects a multi-cycle pause with positive net gift', async () => {
        await withServiceTestTransaction(async (tx) => {
            const sub = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const pauseId = await pause(
                tx,
                sub.subscriptionId,
                '2026-06-30T12:00:00Z',
                '2026-12-02T12:00:00Z'
            );
            const result = await runPauseGiftDetection(
                { correlationId: crypto.randomUUID(), pageSize: 100 },
                { clock, tx }
            );
            expect(result.detected).toBe(1);
            expect(
                (
                    await domainEventModel.findByEntity({
                        entityType: 'subscription_pause',
                        entityId: pauseId,
                        tx
                    })
                ).some((event) => event.eventType === 'reconciliation.pause_gift_detected')
            ).toBe(true);
        });
    });

    it('records a per-pause insert failure and continues the page', async () => {
        await withServiceTestTransaction(async (tx) => {
            const first = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const second = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const failingId = await pause(
                tx,
                first.subscriptionId,
                '2026-10-31T12:00:00Z',
                '2026-12-02T12:00:00Z'
            );
            await pause(tx, second.subscriptionId, '2026-10-31T12:00:00Z', '2026-12-02T12:00:00Z');
            const insert = domainEventModel.insert.bind(domainEventModel);
            const spy = vi.spyOn(domainEventModel, 'insert').mockImplementation(async (input) => {
                if (input.entityId === failingId) throw new Error('forced insert failure');
                return insert(input);
            });
            try {
                const result = await runPauseGiftDetection(
                    { correlationId: crypto.randomUUID(), pageSize: 100 },
                    { clock, tx }
                );
                expect(result.detected).toBe(1);
                expect(result.failures).toEqual([
                    { pauseId: failingId, message: 'forced insert failure' }
                ]);
            } finally {
                spy.mockRestore();
            }
        });
    });

    it('omits anniversary returns and pauses that cross no charge date', async () => {
        await withServiceTestTransaction(async (tx) => {
            const anniversary = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const ordinary = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const a = await pause(
                tx,
                anniversary.subscriptionId,
                '2026-10-31T12:00:00Z',
                '2026-12-01T12:00:00Z'
            );
            const b = await pause(
                tx,
                ordinary.subscriptionId,
                '2026-10-02T12:00:00Z',
                '2026-10-30T12:00:00Z'
            );
            const result = await runPauseGiftDetection(
                { correlationId: crypto.randomUUID(), pageSize: 100 },
                { clock, tx }
            );
            expect(result.detected).toBe(0);
            for (const id of [a, b])
                expect(
                    (
                        await domainEventModel.findByEntity({
                            entityType: 'subscription_pause',
                            entityId: id,
                            tx
                        })
                    ).filter((event) => event.eventType === 'reconciliation.pause_gift_detected')
                ).toHaveLength(0);
        });
    });
});
