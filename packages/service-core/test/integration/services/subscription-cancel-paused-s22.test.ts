import {
    and,
    courtesyGrants,
    coverageLosses,
    domainEvent,
    emailOutbox,
    eq,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { resolveCourtesySources } from '../../../src/services/billing/coverage/courtesy-sources.js';
import { cancelPausedSubscription } from '../../../src/services/billing/subscription/cancel-paused-subscription.service.js';
import { classifyCancellationCrossing } from '../../../src/services/billing/subscription/cancellation-crossing-rule.js';
import { resumeSubscription } from '../../../src/services/billing/subscription/resume-subscription.service.js';
import { applyS12ToPrincipal } from '../../../src/services/billing/subscription/service-end-s12.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    pausedNow,
    retirePausedCancellationRows,
    seedPausedCancellation
} from './support/cancel-paused-fixtures.js';
import { retireComplementRows, seedCommittedComplement } from './support/complement-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const clock = { now: () => pausedNow };
const owner = (id: string): Actor => ({ id, roles: [], permissions: [] });
const orphanhood = {
    addonPolicy: async () => {
        throw new Error('unexpected addon policy read');
    },
    listing: async () => {
        throw new Error('unexpected addon listing read');
    }
};
const ports = (fake: FakePaymentProvider) => ({
    provider: fake,
    clock,
    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
    coverageNotices: { emitCoverageChanged: async () => undefined },
    orphanhood,
    complements: unusedComplementPolicy
});
const fakeProvider = () => new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
const subscription = async (id: string) => {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row) throw new Error('seeded subscription missing');
    return row;
};
const pause = async (id: string) => {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptionPauses)
        .where(eq(subscriptionPauses.subscriptionId, id));
    if (!row) throw new Error('seeded pause missing');
    return row;
};
const decisions = (id: string) =>
    getServiceTestDb()
        .select()
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, id),
                eq(domainEvent.eventType, 'subscription.provider_cancellation_decided')
            )
        );

afterEach(retirePausedCancellationRows);
afterEach(retireComplementRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:5 S22 paused cancellation', () => {
    it('(a) cancels a customer pause today with one S22 decision and direct notice', async () => {
        const fake = fakeProvider();
        const seeded = await seedPausedCancellation({ fake });
        await getServiceTestDb()
            .insert(coverageLosses)
            .values({
                userId: seeded.userId,
                vertical: 'accommodation',
                lostAt: new Date(pausedNow.getTime() - 24 * 60 * 60 * 1000)
            });
        const result = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toMatchObject({
            outcome: 'CANCELLED',
            serviceEndsAt: pausedNow,
            cancelCall: 'SENT'
        });
        expect((await subscription(seeded.subscriptionId)).status).toBe('CANCELLED');
        expect((await subscription(seeded.subscriptionId)).serviceEndsAt).toEqual(pausedNow);
        expect((await pause(seeded.subscriptionId)).actualEndAt).toEqual(pausedNow);
        const losses = await getServiceTestDb()
            .select()
            .from(coverageLosses)
            .where(
                and(
                    eq(coverageLosses.userId, seeded.userId),
                    eq(coverageLosses.vertical, 'accommodation')
                )
            );
        expect(losses).toHaveLength(1);
        expect(losses[0]?.lostAt).toEqual(pausedNow);
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                .status
        ).toBe('cancelled');
        const events = await decisions(seeded.subscriptionId);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            reason: 'S22',
            changes: [{ field: 'status', old: 'PAUSED', new: 'CANCELLED' }]
        });
        const notices = await getServiceTestDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, seeded.userId));
        expect(
            notices.filter(
                (row) =>
                    (row.payload as { subscriptionId?: string }).subscriptionId ===
                    seeded.subscriptionId
            )
        ).toMatchObject([{ template: 'billing.direct-cancellation' }]);
    });

    it('(b) ends a COURTESY source and writes one coverage loss without changing the grant', async () => {
        const fake = fakeProvider();
        const seeded = await seedPausedCancellation({ fake, reason: 'COURTESY' });
        const [grantBefore] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, seeded.subscriptionId));
        const result = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result.outcome).toBe('CANCELLED');
        const sources = await getServiceTestDb().transaction((tx) =>
            resolveCourtesySources({
                userId: seeded.userId,
                vertical: VerticalEnum.ACCOMMODATION,
                ports: { clock },
                tx
            })
        );
        expect(sources.sources).toHaveLength(0);
        const losses = await getServiceTestDb()
            .select()
            .from(coverageLosses)
            .where(
                and(
                    eq(coverageLosses.userId, seeded.userId),
                    eq(coverageLosses.vertical, 'accommodation')
                )
            );
        expect(losses).toHaveLength(1);
        expect(losses[0]?.lostAt).toEqual(pausedNow);
        const [grantAfter] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, seeded.subscriptionId));
        expect(grantAfter).toEqual(grantBefore);
    });

    it('(c) schedules unconsumed successor credit and selects only ACTIVE S11 complements', async () => {
        const fake = fakeProvider();
        const firstChargeAt = new Date('2026-12-01T00:00:00.000Z');
        const seeded = await seedPausedCancellation({
            fake,
            reason: 'COURTESY',
            credit: {
                firstChargeAt,
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z')
            }
        });
        const active = await seedCommittedComplement({
            fake,
            principalStatus: 'PAUSED',
            principal: { userId: seeded.userId, principalId: seeded.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const paused = await seedCommittedComplement({
            fake,
            principalStatus: 'PAUSED',
            principal: { userId: seeded.userId, principalId: seeded.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION',
            complementStatus: 'PAUSED',
            openPause: true
        });
        const result = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            { ...ports(fake), complements: active.policy }
        );
        expect(result).toMatchObject({
            outcome: 'SCHEDULED',
            serviceEndsAt: firstChargeAt,
            basis: 'CREDIT',
            complements: { decided: 1 }
        });
        expect((await subscription(seeded.subscriptionId)).status).toBe('CANCEL_SCHEDULED');
        expect((await subscription(seeded.subscriptionId)).serviceEndsAt).toEqual(firstChargeAt);
        expect((await subscription(active.complementId)).status).toBe('CANCEL_SCHEDULED');
        expect((await subscription(active.complementId)).serviceEndsAt).toEqual(firstChargeAt);
        expect((await subscription(paused.complementId)).status).toBe('PAUSED');
        expect((await pause(seeded.subscriptionId)).actualEndAt).toEqual(pausedNow);
        const events = await decisions(seeded.subscriptionId);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            reason: 'S11',
            changes: [{ field: 'status', old: 'PAUSED', new: 'CANCEL_SCHEDULED' }]
        });
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                .status
        ).toBe('cancelled');
        const reread = vi.spyOn(fake, 'readAuthorization');
        const second = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            { ...ports(fake), complements: active.policy }
        );
        expect(second).toEqual({ outcome: 'ALREADY_SCHEDULED', serviceEndsAt: firstChargeAt });
        expect(reread).toHaveBeenCalledTimes(0);
        expect(await decisions(seeded.subscriptionId)).toHaveLength(1);
    });

    it('(f,g) S12 ends the credited row and C2 extends a crossing charge from its real S11 decision', async () => {
        const fake = fakeProvider();
        const firstChargeAt = new Date('2026-12-01T00:00:00.000Z');
        const seeded = await seedPausedCancellation({
            fake,
            credit: {
                firstChargeAt,
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z')
            }
        });
        await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        const [decision] = await decisions(seeded.subscriptionId);
        if (!decision?.reason) throw new Error('S11 decision missing');
        expect(
            classifyCancellationCrossing({
                status: (await subscription(seeded.subscriptionId)).status,
                class: 'PRINCIPAL',
                decision: { transition: decision.reason, decidedAt: decision.occurredAt },
                factAt: new Date(pausedNow.getTime() - 1)
            })
        ).toBe('EXTEND');
        const applied = await getServiceTestDb().transaction((tx) =>
            applyS12ToPrincipal(
                { tx, subscriptionId: seeded.subscriptionId, now: firstChargeAt },
                { clock: { now: () => firstChargeAt }, orphanhood }
            )
        );
        expect(applied.outcome).toBe('CANCELLED');
        expect((await subscription(seeded.subscriptionId)).status).toBe('CANCELLED');
    });

    it('(h) rejects S10 winning first; S10 observes S22 winning as not paused', async () => {
        const fake = fakeProvider();
        const first = await seedPausedCancellation({ fake });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, first.subscriptionId));
        expect(
            await cancelPausedSubscription(
                { actor: owner(first.userId), subscriptionId: first.subscriptionId },
                ports(fake)
            )
        ).toEqual({ outcome: 'REJECTED', reason: 'NOT_PAUSED' });
        const second = await seedPausedCancellation({ fake });
        await cancelPausedSubscription(
            { actor: owner(second.userId), subscriptionId: second.subscriptionId },
            ports(fake)
        );
        expect(
            await resumeSubscription(
                { subscriptionId: second.subscriptionId, cause: 'TERM' },
                { provider: fake, clock, complements: unusedComplementPolicy }
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_PAUSED' });
    });

    it('(d) consumes expired credit and cancels today', async () => {
        const fake = fakeProvider();
        const seeded = await seedPausedCancellation({
            fake,
            credit: {
                firstChargeAt: new Date('2026-10-01T00:00:00.000Z'),
                windowEndsAt: new Date('2026-09-30T00:00:00.000Z')
            }
        });
        const result = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', serviceEndsAt: pausedNow });
        expect((await subscription(seeded.subscriptionId)).status).toBe('CANCELLED');
    });

    it('(e) returns the same terminal outcome without another provider call or decision', async () => {
        const fake = fakeProvider();
        const seeded = await seedPausedCancellation({ fake });
        await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        const read = vi.spyOn(fake, 'readAuthorization');
        const second = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(second).toEqual({ outcome: 'ALREADY_CANCELLED', serviceEndsAt: pausedNow });
        expect(read).toHaveBeenCalledTimes(0);
        expect(await decisions(seeded.subscriptionId)).toHaveLength(1);
    });

    it('(i) rejects an ACTIVE row and preserves its seeded state', async () => {
        const fake = fakeProvider();
        const seeded = await seedPausedCancellation({ fake, status: 'ACTIVE' });
        const before = await subscription(seeded.subscriptionId);
        const result = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toEqual({ outcome: 'REJECTED', reason: 'NOT_PAUSED' });
        const after = await subscription(seeded.subscriptionId);
        expect(after.status).toBe(before.status);
        expect(after.serviceEndsAt).toEqual(before.serviceEndsAt);
        expect(await decisions(seeded.subscriptionId)).toHaveLength(0);
    });

    it('(j) cancels a manual payer without a provider decision', async () => {
        const fake = fakeProvider();
        const seeded = await seedPausedCancellation({ fake, paymentMethod: 'MANUAL' });
        const read = vi.spyOn(fake, 'readAuthorization');
        const result = await cancelPausedSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', cancelCall: 'NOT_APPLICABLE' });
        expect(read).toHaveBeenCalledTimes(0);
        expect(await decisions(seeded.subscriptionId)).toHaveLength(0);
    });
});
