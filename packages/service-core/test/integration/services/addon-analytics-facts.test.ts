/**
 * HOS-1883: the A1/A2/A3/A5 producers of the add-on facts emit after commit through the same
 * sink, with exact payloads, once per instance (AC-1, AC-2, AC-3, AC-7, AC-9).
 */
import { addonInstances, addonProducts, addonVersions, eq, providerLinks } from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { applyA2Recurring } from '../../../src/services/billing/addon/addon-instance-a2';
import { expireAddonAuthorizationWindows } from '../../../src/services/billing/addon/expire-addon-authorization-windows.service';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { withdrawAddon } from '../../../src/services/billing/addon/withdraw-addon.service';
import type { SinkFact } from '../../../src/services/billing/facts/billing-fact-sink';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { retireWithdrawalFixtures, withdrawalFixture } from './support/addon-withdrawal-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';

const HOUR = 3_600_000;

afterEach(async () => {
    vi.restoreAllMocks();
    await retireWithdrawalFixtures();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/**
 * Whole seconds between two instants, floored at 0: `created_at` is the database's clock while
 * the fixture's clock is fixed in the past, so an unclamped value would be negative.
 */
function wholeSeconds(from: Date, to: Date): number {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}

function spySink() {
    const facts: SinkFact[] = [];
    return {
        facts,
        sink: { emit: (fact: SinkFact) => facts.push(fact) },
        addonFacts: () => facts.filter((fact) => fact.kind.startsWith('ADDON_'))
    };
}

/** The anchored identity of one instance, read the way the facts read it. */
async function subjectOf(instanceId: string) {
    const [row] = await getServiceTestDb()
        .select({
            instance: addonInstances,
            addonId: addonVersions.addonId,
            scopeType: addonVersions.scopeType,
            price: addonProducts.price,
            chargeKind: addonProducts.chargeKind
        })
        .from(addonInstances)
        .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .where(eq(addonInstances.id, instanceId));
    if (!row) throw new Error('Instance missing');
    return {
        instance: row.instance,
        price: row.price,
        subject: {
            userId: row.instance.ownerId,
            addonInstanceId: row.instance.id,
            addonId: row.addonId,
            addonVersionId: row.instance.addonVersionId,
            addonProductId: row.instance.productId,
            chargeKind: row.chargeKind,
            scopeType: row.scopeType,
            vertical: 'accommodation',
            ...(row.instance.complementSubscriptionId
                ? { subscriptionId: row.instance.complementSubscriptionId }
                : {})
        }
    };
}

async function approveComplement(input: {
    readonly f: Awaited<ReturnType<typeof purchaseFixture>>;
    readonly complementId: string;
    readonly sink: { emit(fact: SinkFact): void };
}) {
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, input.complementId));
    if (!link) throw new Error('Addon preapproval missing');
    await input.f.fake.approve({ authorizationId: link.providerId });
    const notice = encodeFakeNotice({
        notice: { resourceKind: 'authorization', resourceId: link.providerId, version: '1' },
        format: 'json'
    });
    return processProviderNotice(
        {
            channel: 'WEBHOOKS',
            delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
        },
        {
            provider: input.f.fake,
            clock: input.f.ports.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            complements: input.f.ports,
            coverageNotices: { emitCoverageChanged: async () => {} },
            billingFacts: input.sink
        }
    );
}

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: A1, A2 and A3', () => {
    it('A1 returns addon_checkout_started for a created recurring purchase (AC-1)', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        await payingPrincipal(f);

        // Act
        const bought = await purchaseAddon(f.input(), f.ports);

        // Assert
        if (bought.outcome !== 'CREATED') throw new Error(`Purchase returned ${bought.outcome}`);
        const { subject, price } = await subjectOf(bought.instanceId);
        expect(bought.startedFact).toEqual({
            kind: 'ADDON_CHECKOUT_STARTED',
            ...subject,
            actorKind: 'USER',
            occurredAt: f.ports.clock.now(),
            amountMinor: price,
            currency: 'ARS',
            cycle: 'monthly'
        });
    });

    it('A1 replay of the same order returns no started fact (AC-2)', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        await payingPrincipal(f);
        const request = f.input();
        await purchaseAddon(request, f.ports);

        // Act
        const replay = await purchaseAddon(request, f.ports);

        // Assert
        expect(replay.outcome).toBe('EXISTING');
        expect('startedFact' in replay ? replay.startedFact : undefined).toBeUndefined();
    });

    it('A2 recurring emits addon_activated once, after commit (AC-3)', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        await payingPrincipal(f);
        const bought = await purchaseAddon(f.input(), f.ports);
        if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
        const { instance } = await subjectOf(bought.instanceId);
        if (!instance.complementSubscriptionId) throw new Error('Complement missing');
        const spy = spySink();

        // Act
        const answer = await approveComplement({
            f,
            complementId: instance.complementSubscriptionId,
            sink: spy.sink
        });
        const replay = await getServiceTestDb().transaction((tx) =>
            applyA2Recurring(
                {
                    tx,
                    complementSubscriptionId: instance.complementSubscriptionId ?? '',
                    now: f.ports.clock.now()
                },
                f.ports
            )
        );

        // Assert
        expect(answer).toMatchObject({ ack: 'OK', outcome: 'APPLIED' });
        expect(replay).toEqual({ outcome: 'NOT_APPLICABLE' });
        const after = await subjectOf(bought.instanceId);
        if (!after.instance.startsAt) throw new Error('startsAt missing');
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_ACTIVATED',
                ...after.subject,
                actorKind: 'SYSTEM',
                occurredAt: after.instance.startsAt,
                amountMinor: after.price,
                currency: 'ARS',
                cycle: 'monthly',
                secondsInPending: wholeSeconds(after.instance.createdAt, after.instance.startsAt)
            }
        ]);
    });

    it('A3 abandons an expired recurring purchase as WINDOW_EXPIRED (AC-7)', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        await payingPrincipal(f);
        const bought = await purchaseAddon(f.input(), f.ports);
        if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
        const before = await subjectOf(bought.instanceId);
        const abandonedAt = new Date(before.instance.createdAt.getTime() + 73 * HOUR);
        f.advanceTo(abandonedAt);
        const spy = spySink();

        // Act
        await expireAddonAuthorizationWindows(100, {
            ...f.ports,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
            coverageNotices: { emitCoverageChanged: async () => {} },
            billingFacts: spy.sink
        });

        // Assert
        const after = await subjectOf(bought.instanceId);
        expect(after.instance.status).toBe('ABANDONED');
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CHECKOUT_ABANDONED',
                ...before.subject,
                actorKind: 'SYSTEM',
                occurredAt: abandonedAt,
                reason: 'WINDOW_EXPIRED',
                secondsInPending: 73 * 3600
            }
        ]);
    });
});

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: owner withdrawal (A5)', () => {
    it('a paid ACTIVE withdrawal emits addon_cancelled OWNER_WITHDREW by the USER (AC-9)', async () => {
        // Arrange
        const s = await withdrawalFixture({ withCharge: true });
        const before = await subjectOf(s.instanceId);
        if (!before.instance.startsAt) throw new Error('startsAt missing');
        const spy = spySink();

        const emit = vi.fn(spy.sink.emit);

        // Act
        await withdrawAddon(
            { actor: s.actor, instanceId: s.instanceId },
            { ...s.ports, billingFacts: { emit } }
        );

        // Assert: the provider call happened before the analytics fact (I4).
        expect(s.cancel).toHaveBeenCalledTimes(1);
        expect(s.cancel.mock.invocationCallOrder[0]).toBeLessThan(
            emit.mock.invocationCallOrder[0] ?? 0
        );
        const now = s.f.ports.clock.now();
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CANCELLED',
                ...before.subject,
                actorKind: 'USER',
                occurredAt: now,
                path: 'OWNER_WITHDREW',
                wasScheduled: false,
                lifetimeDays: Math.floor(
                    (now.getTime() - before.instance.startsAt.getTime()) / 86_400_000
                )
            }
        ]);
    });

    it('a pending withdrawal is an abandoned checkout, never a cancellation (AC-9)', async () => {
        // Arrange
        const s = await withdrawalFixture({ state: 'PENDING_AUTHORIZATION' });
        const before = await subjectOf(s.instanceId);
        const spy = spySink();

        // Act
        await withdrawAddon(
            { actor: s.actor, instanceId: s.instanceId },
            { ...s.ports, billingFacts: spy.sink }
        );

        // Assert
        const now = s.f.ports.clock.now();
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CHECKOUT_ABANDONED',
                ...before.subject,
                actorKind: 'USER',
                occurredAt: now,
                reason: 'OWNER_WITHDREW',
                secondsInPending: wholeSeconds(before.instance.createdAt, now)
            }
        ]);
    });
});
