// TEST:B5:11 (AC:B5:20): «en un solo acto». A rejection of RF1 (the last step of the
// transaction) rolls back everything written before it: the state, the closed pause, the
// coverage loss (AC:B4:4, written in the same transaction) and the S36 decision. Nothing is
// cancelled at the provider without its refund. TEST:1878:26 adds that no committed REVOKED
// fact escapes that rollback. `requestRefund` is replaced only for this file, and only while
// a test asks it to fail; otherwise it is the real one.
import { coverageLosses, domainEventModel, eq, subscriptions } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { BillingFact } from '../../../src/services/billing/facts/billing-fact-sink.js';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import { ServiceError } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireRevocationRows,
    revocationFixture,
    seedRevocationActor,
    untouchedState
} from './support/revocation-fixtures.js';

const failing = vi.hoisted(() => ({ on: false }));

vi.mock('../../../src/services/billing/refund/request-refund.service.js', async (original) => {
    const real =
        await original<
            typeof import('../../../src/services/billing/refund/request-refund.service.js')
        >();
    return {
        ...real,
        requestRefund: vi.fn(async (...args: Parameters<typeof real.requestRefund>) => {
            if (failing.on)
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Payment is not in a refundable state',
                    undefined,
                    'PAYMENT_NOT_REFUNDABLE'
                );
            return real.requestRefund(...args);
        })
    };
});

afterEach(async () => {
    failing.on = false;
    await retireRevocationRows();
});
afterAll(closeServiceTestPool);

describe('TEST:B5:11 AC:B5:20 a rejected RF1 rolls back the whole act', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(f2)(f3) from PAUSED: no state change, no closed pause, no coverage_loss, no decision, no call',
        async () => {
            // Arrange
            const f = await revocationFixture({ origin: 'PAUSED' });
            f.at(f.day(5));
            const before = await untouchedState(f);
            failing.on = true;

            // Act
            await expect(
                revokeSubscription(
                    { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                    f.ports
                )
            ).rejects.toMatchObject({ reason: 'PAYMENT_NOT_REFUNDABLE' });

            // Assert
            expect(await untouchedState(f)).toEqual(before);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coverageLosses)
                    .where(eq(coverageLosses.userId, f.userId))
            ).toEqual([]);
            const decided = (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: f.subscriptionId
                })
            ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided');
            expect(decided).toEqual([]);
            expect(f.sequence).toEqual([]);
            expect(f.coverageSeen).toEqual([]);
            expect(await f.authorizationStatus()).toBe('paused');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'control: with the real RF1 the same fixture is revoked and coverage_loss is written',
        async () => {
            // Arrange
            const f = await revocationFixture({ origin: 'PAUSED' });
            const now = f.day(5);
            f.at(now);

            // Act
            await revokeSubscription(
                { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                f.ports
            );

            // Assert
            expect(
                await getServiceTestDb()
                    .select({ lostAt: coverageLosses.lostAt })
                    .from(coverageLosses)
                    .where(eq(coverageLosses.userId, f.userId))
            ).toEqual([{ lostAt: now }]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1878:26 emits no REVOKED fact when the transaction fails after the UPDATE',
        async () => {
            // Arrange: the RF1 of the last step fails after the state was already written.
            const f = await revocationFixture({ origin: 'ACTIVE' });
            f.at(f.day(5));
            const facts: BillingFact[] = [];
            failing.on = true;

            // Act
            await expect(
                revokeSubscription(
                    { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                    { ...f.ports, billingFacts: { emit: (fact) => facts.push(fact) } }
                )
            ).rejects.toMatchObject({ reason: 'PAYMENT_NOT_REFUNDABLE' });

            // Assert: the UPDATE was rolled back and no committed fact escaped the act.
            expect(facts).toHaveLength(0);
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, f.subscriptionId));
            expect(row?.status).toBe('ACTIVE');
        }
    );
});
