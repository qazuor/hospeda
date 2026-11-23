/**
 * HOS-1883: COMPLEMENTO charges through `recordChargeFact` (AC-5, AC-6), and the §5.3 rule table
 * of the ending choke point every A5/A6 caller goes through (AC-12, AC-16): which ending owes
 * which fact, and which owes none. The real ending producers are covered in
 * `addon-analytics-facts-producers.test.ts`.
 */
import { addonInstances, addonProducts, addonVersions, eq } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    type AddonEnding,
    emitAddonCoverageRemoved
} from '../../../src/services/billing/addon/addon-instance-a5';
import {
    emitBillingFact,
    type SinkFact
} from '../../../src/services/billing/facts/billing-fact-sink';
import { emitAddonChargeRejected } from '../../../src/services/billing/payment/addon-charge-facts';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { retireWithdrawalFixtures, withdrawalFixture } from './support/addon-withdrawal-fixtures';

const DAY = 86_400_000;

afterEach(async () => {
    vi.restoreAllMocks();
    await retireWithdrawalFixtures();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

function spySink() {
    const facts: SinkFact[] = [];
    return {
        sink: { emit: (fact: SinkFact) => facts.push(fact) },
        addonFacts: () => facts.filter((fact) => fact.kind.startsWith('ADDON_'))
    };
}

async function identityOf(instanceId: string) {
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

function chargePorts(s: Awaited<ReturnType<typeof withdrawalFixture>>, sink: SinkSpy['sink']) {
    return {
        provider: s.f.fake,
        clock: s.f.ports.clock,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => {} },
        complements: s.f.ports,
        billingFacts: sink
    };
}
type SinkSpy = ReturnType<typeof spySink>;

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: COMPLEMENTO charges', () => {
    it('a credited COMPLEMENTO charge emits addon_charge_succeeded, first charge (AC-5)', async () => {
        // Arrange
        const s = await withdrawalFixture();
        if (!s.authorizationId) throw new Error('Preapproval missing');
        const { subject, price } = await identityOf(s.instanceId);
        const { chargeId } = await s.f.fake.charge({
            authorizationId: s.authorizationId,
            amount: { amountMinor: price, currency: 'ARS' },
            reference: `${s.instanceId}-first`
        });
        // M8: the charge lands in the batch after the hour it was asked.
        s.f.advanceTo(new Date(s.f.ports.clock.now().getTime() + 2 * 3_600_000));
        const spy = spySink();

        // Act
        const result = await recordChargeFact({ chargeId }, chargePorts(s, spy.sink));

        // Assert
        expect(result.outcome).toBe('CREDITED');
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CHARGE_CREDITED',
                ...subject,
                actorKind: 'SYSTEM',
                occurredAt: expect.any(Date),
                paymentId: 'paymentId' in result ? result.paymentId : '',
                amountMinor: price,
                currency: 'ARS',
                isFirstCharge: true,
                cycle: 'monthly',
                promoApplied: false
            }
        ]);
        expect(spy.addonFacts().some((fact) => 'subscriptionClass' in fact)).toBe(false);
    });

    it('a rejected COMPLEMENTO charge emits addon_charge_declined without next_state (AC-6)', async () => {
        // Arrange
        const s = await withdrawalFixture();
        if (!s.authorizationId) throw new Error('Preapproval missing');
        const { subject, price } = await identityOf(s.instanceId);
        const { chargeId } = await s.f.fake.declineCharge({
            authorizationId: s.authorizationId,
            declineReason: 'cc_rejected_other_reason'
        });
        const spy = spySink();

        // Act
        await recordChargeFact({ chargeId }, chargePorts(s, spy.sink));

        // Assert
        const facts = spy.addonFacts();
        expect(facts).toEqual([
            {
                kind: 'ADDON_CHARGE_REJECTED',
                ...subject,
                actorKind: 'SYSTEM',
                occurredAt: expect.any(Date),
                paymentId: expect.any(String),
                amountMinor: price,
                currency: 'ARS',
                isFirstCharge: true,
                hasRetryWindow: expect.any(Boolean)
            }
        ]);
        expect(Object.keys(facts[0] ?? {})).not.toContain('nextState');
    });
});

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1883 add-on facts: renewals and redeliveries',
    () => {
        it('a credited renewal after a credited charge has is_first_charge:false (AC-5)', async () => {
            // Arrange: the fixture already holds one credited COMPLEMENTO charge.
            const s = await withdrawalFixture({ withCharge: true });
            if (!s.authorizationId) throw new Error('Preapproval missing');
            const { subject, price } = await identityOf(s.instanceId);
            const { chargeId } = await s.f.fake.charge({
                authorizationId: s.authorizationId,
                amount: { amountMinor: price, currency: 'ARS' },
                reference: `${s.instanceId}-renewal`
            });
            s.f.advanceTo(new Date(s.f.ports.clock.now().getTime() + 2 * 3_600_000));
            const spy = spySink();

            // Act
            const result = await recordChargeFact({ chargeId }, chargePorts(s, spy.sink));

            // Assert
            expect(result.outcome).toBe('CREDITED');
            expect(spy.addonFacts()).toEqual([
                {
                    kind: 'ADDON_CHARGE_CREDITED',
                    ...subject,
                    actorKind: 'SYSTEM',
                    occurredAt: expect.any(Date),
                    paymentId: 'paymentId' in result ? result.paymentId : '',
                    amountMinor: price,
                    currency: 'ARS',
                    isFirstCharge: false,
                    cycle: 'monthly',
                    promoApplied: false
                }
            ]);
        });

        it('a redelivered rejected charge emits addon_charge_declined once (AC-6, P-3)', async () => {
            // Arrange
            const s = await withdrawalFixture();
            if (!s.authorizationId) throw new Error('Preapproval missing');
            const { chargeId } = await s.f.fake.declineCharge({
                authorizationId: s.authorizationId,
                declineReason: 'cc_rejected_other_reason'
            });
            const spy = spySink();

            // Act: the webhook, its redelivery, then a sweep pass over the same charge.
            await recordChargeFact({ chargeId }, chargePorts(s, spy.sink));
            await recordChargeFact({ chargeId }, chargePorts(s, spy.sink));
            await recordChargeFact({ chargeId }, chargePorts(s, spy.sink));

            // Assert
            expect(spy.addonFacts().map(({ kind }) => kind)).toEqual(['ADDON_CHARGE_REJECTED']);
        });

        it('a failing first-charge read never throws out of recordChargeFact (AC-6, AC-16)', async () => {
            // Arrange
            const s = await withdrawalFixture();
            if (!s.authorizationId) throw new Error('Preapproval missing');
            const { chargeId } = await s.f.fake.declineCharge({
                authorizationId: s.authorizationId,
                declineReason: 'cc_rejected_other_reason'
            });
            const read = vi
                .spyOn(creditedPaymentsFromLedger, 'hasCreditedPayment')
                .mockRejectedValue(new Error('ledger down'));
            const spy = spySink();

            // Act
            const result = await recordChargeFact({ chargeId }, chargePorts(s, spy.sink));

            // Assert
            expect(result.outcome).not.toBe('CREDITED');
            expect(read).toHaveBeenCalled();
            expect(spy.addonFacts()).toEqual([]);
        });

        it('emitAddonChargeRejected swallows a failing first-charge read (AC-16)', async () => {
            // Arrange
            const spy = spySink();

            // Act + Assert
            await expect(
                emitAddonChargeRejected({
                    complementSubscriptionId: crypto.randomUUID(),
                    paymentId: crypto.randomUUID(),
                    amountMinor: 1,
                    currency: 'ARS',
                    occurredAt: new Date(),
                    isFirstCharge: async () => {
                        throw new Error('ledger down');
                    },
                    hasRetryWindow: true,
                    billingFacts: spy.sink
                })
            ).resolves.toBeUndefined();
            expect(spy.addonFacts()).toEqual([]);
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: ending choke point', () => {
    async function ended(input: {
        readonly ending: (now: Date) => AddonEnding;
        readonly end:
            | 'NOT_AN_END'
            | { readonly path: 'SERVICE_END' | 'ORPHANED' | 'LISTING_PURGED' };
    }) {
        const s = await withdrawalFixture();
        const identity = await identityOf(s.instanceId);
        const now = new Date(s.f.ports.clock.now().getTime() + 10 * DAY);
        const spy = spySink();
        await emitAddonCoverageRemoved({
            cancelled: [
                {
                    instanceId: s.instanceId,
                    ownerId: s.f.ownerId,
                    clause: 'ORPHANED',
                    coverageVerticals: [],
                    complementSubscriptionId: s.complementId,
                    providerCancellation: null,
                    ending: input.ending(now)
                }
            ],
            coverageNotices: { emitCoverageChanged: async () => {} },
            end:
                input.end === 'NOT_AN_END'
                    ? 'NOT_AN_END'
                    : { path: input.end.path, actorKind: 'SYSTEM', billingFacts: spy.sink }
        });
        return { identity, now, facts: spy.addonFacts() };
    }

    it('rule: an S12-cancelled scheduled complement is SERVICE_END with was_scheduled (§5.3)', async () => {
        // Arrange + Act
        const { identity, now, facts } = await ended({
            ending: (endedAt) => ({
                origin: 'ACTIVE',
                paid: true,
                complement: { outcome: 'CANCELLED', from: 'CANCEL_SCHEDULED' },
                endedAt
            }),
            end: { path: 'SERVICE_END' }
        });

        // Assert
        const startsAt = identity.instance.startsAt;
        if (!startsAt) throw new Error('startsAt missing');
        expect(facts).toEqual([
            {
                kind: 'ADDON_CANCELLED',
                ...identity.subject,
                actorKind: 'SYSTEM',
                occurredAt: now,
                path: 'SERVICE_END',
                wasScheduled: true,
                lifetimeDays: Math.floor((now.getTime() - startsAt.getTime()) / DAY)
            }
        ]);
    });

    it('the natural FIXED_DAYS expiry passes NOT_AN_END and emits nothing (AC-12)', async () => {
        const { facts } = await ended({
            ending: (endedAt) => ({ origin: 'ACTIVE', paid: true, complement: null, endedAt }),
            end: 'NOT_AN_END'
        });
        expect(facts).toEqual([]);
    });

    it('a free instance (titled by a grant) owes no fact on any path (§5.3)', async () => {
        const { facts } = await ended({
            ending: (endedAt) => ({ origin: 'ACTIVE', paid: false, complement: null, endedAt }),
            end: { path: 'ORPHANED' }
        });
        expect(facts).toEqual([]);
    });

    it('a complement an earlier act already cancelled owes no second fact (§5.3)', async () => {
        const { facts } = await ended({
            ending: (endedAt) => ({
                origin: 'ACTIVE',
                paid: true,
                complement: { outcome: 'ALREADY_CANCELLED' },
                endedAt
            }),
            end: { path: 'LISTING_PURGED' }
        });
        expect(facts).toEqual([]);
    });

    it('a pending instance closed by the system is an abandoned checkout (§5.3)', async () => {
        const { identity, now, facts } = await ended({
            ending: (endedAt) => ({
                origin: 'PENDING_AUTHORIZATION',
                paid: true,
                complement: { outcome: 'CANCELLED', from: 'PENDING_AUTHORIZATION' },
                endedAt
            }),
            end: { path: 'ORPHANED' }
        });
        expect(facts).toEqual([
            {
                kind: 'ADDON_CHECKOUT_ABANDONED',
                ...identity.subject,
                actorKind: 'SYSTEM',
                occurredAt: now,
                reason: 'CLOSED_BY_SYSTEM',
                secondsInPending: Math.max(
                    0,
                    Math.floor((now.getTime() - identity.instance.createdAt.getTime()) / 1000)
                )
            }
        ]);
    });

    it('a pending instance S20 already reported (complement ALREADY_CANCELLED) owes nothing (T-7)', async () => {
        const { facts } = await ended({
            ending: (endedAt) => ({
                origin: 'PENDING_AUTHORIZATION',
                paid: true,
                complement: { outcome: 'ALREADY_CANCELLED' },
                endedAt
            }),
            end: { path: 'ORPHANED' }
        });
        expect(facts).toEqual([]);
    });
});

describe('HOS-1883 add-on facts: sink failures never propagate (AC-16)', () => {
    it('emitBillingFact swallows a throwing sink for an add-on fact', () => {
        // Arrange
        const sink = {
            emit: () => {
                throw new Error('analytics down');
            }
        };

        // Act + Assert
        expect(() =>
            emitBillingFact({
                sink,
                fact: {
                    kind: 'ADDON_GRANTED_FREE',
                    userId: 'u1',
                    addonInstanceId: 'i1',
                    addonId: 'a1',
                    addonVersionId: 'v1',
                    addonProductId: 'p1',
                    chargeKind: 'UNA_VEZ',
                    scopeType: 'USER',
                    actorKind: 'USER',
                    occurredAt: new Date(),
                    source: 'FREE_CHOICE'
                }
            })
        ).not.toThrow();
    });
});
