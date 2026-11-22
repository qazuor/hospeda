/**
 * HOS-1883: the one-time page activation (activated + charge_succeeded), and the free paths
 * (O-5): a free choice and an S20 conversion emit `addon_granted_free`, never an activation or a
 * cancellation; the grant preview emits nothing (AC-4, AC-19, AC-21, AC-22).
 */
import { addonInstances, addonProducts, addonVersions, eq, providerLinks } from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { chooseFreeAddon } from '../../../src/services/billing/addon/choose-free-addon.service';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import type { SinkFact } from '../../../src/services/billing/facts/billing-fact-sink';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service';
import { previewPermanentGrant } from '../../../src/services/billing/grant/permanent-grant-preview';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { freeChoiceFixture, retireFreeChoiceFixtures } from './support/addon-free-choice-fixtures';
import {
    purchaseFixture,
    purchaseNow,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';
import { seedCoverageUser } from './support/coverage-fixtures';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures';

const MINUTE = 60_000;
const grantUsers: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    await retireFreeChoiceFixtures();
    await retirePurchaseFixtures();
    await retirePermanentGrantRows(grantUsers.splice(0));
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
        base: {
            userId: row.instance.ownerId,
            addonInstanceId: row.instance.id,
            addonId: row.addonId,
            addonVersionId: row.instance.addonVersionId,
            addonProductId: row.instance.productId,
            chargeKind: row.chargeKind,
            scopeType: row.scopeType,
            vertical: 'accommodation'
        }
    };
}

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: one-time page', () => {
    it('an approved page payment emits addon_activated and addon_charge_succeeded (AC-4)', async () => {
        // Arrange
        const f = await purchaseFixture();
        await payingPrincipal(f);
        const bought = await purchaseAddon(f.input(), f.ports);
        if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
        const pending = await identityOf(bought.instanceId);
        if (!pending.instance.paymentPageId) throw new Error('Payment page missing');
        const paid = f.fake.payOnPage({
            paymentPageId: pending.instance.paymentPageId,
            outcome: 'approved'
        });
        f.advanceTo(new Date(purchaseNow.getTime() + 5 * MINUTE));
        const spy = spySink();

        // Act
        const result = await confirmOneTimePagePayment(
            { instanceId: bought.instanceId, chargeId: paid.chargeId },
            {
                ...f.ports,
                coverageNotices: { emitCoverageChanged: async () => {} },
                billingFacts: spy.sink
            }
        );

        // Assert
        if (result.outcome !== 'ACTIVATED') throw new Error(`A2 returned ${result.outcome}`);
        const active = await identityOf(bought.instanceId);
        if (!active.instance.startsAt) throw new Error('startsAt missing');
        const facts = spy.addonFacts();
        expect(facts.map(({ kind }) => kind).sort()).toEqual([
            'ADDON_ACTIVATED',
            'ADDON_CHARGE_CREDITED'
        ]);
        expect(facts.find(({ kind }) => kind === 'ADDON_ACTIVATED')).toEqual({
            kind: 'ADDON_ACTIVATED',
            ...active.base,
            actorKind: 'SYSTEM',
            occurredAt: active.instance.startsAt,
            amountMinor: active.price,
            currency: 'ARS',
            secondsInPending: Math.max(
                0,
                Math.floor(
                    (active.instance.startsAt.getTime() - active.instance.createdAt.getTime()) /
                        1000
                )
            )
        });
        expect(facts.find(({ kind }) => kind === 'ADDON_CHARGE_CREDITED')).toEqual({
            kind: 'ADDON_CHARGE_CREDITED',
            ...active.base,
            actorKind: 'SYSTEM',
            occurredAt: expect.any(Date),
            paymentId: result.paymentId,
            amountMinor: active.price,
            currency: 'ARS'
        });
    });
});

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: free paths (O-5)', () => {
    it('a free choice emits addon_granted_free{FREE_CHOICE} and no activation (AC-22)', async () => {
        // Arrange
        const f = await freeChoiceFixture();
        const spy = spySink();

        // Act
        const result = await chooseFreeAddon(f.freeInput(), {
            ...f.freePorts,
            billingFacts: spy.sink
        });

        // Assert
        if (result.outcome !== 'CREATED') throw new Error(`Free choice returned ${result.outcome}`);
        const { base } = await identityOf(result.instanceId);
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_GRANTED_FREE',
                ...base,
                actorKind: 'USER',
                occurredAt: f.ports.clock.now(),
                source: 'FREE_CHOICE'
            }
        ]);
    });

    it('S20 converts a paid ACTIVE add-on: addon_granted_free{S20_CONVERSION}; the preview emits nothing (AC-19, AC-21)', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        await payingPrincipal(f);
        const bought = await purchaseAddon(f.input(), f.ports);
        if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
        const pending = await identityOf(bought.instanceId);
        const complementId = pending.instance.complementSubscriptionId;
        if (!complementId) throw new Error('Complement missing');
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, complementId));
        if (!link) throw new Error('Addon preapproval missing');
        await f.fake.approve({ authorizationId: link.providerId });
        const notice = encodeFakeNotice({
            notice: { resourceKind: 'authorization', resourceId: link.providerId, version: '1' },
            format: 'json'
        });
        await processProviderNotice(
            {
                channel: 'WEBHOOKS',
                delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
            },
            {
                provider: f.fake,
                clock: f.ports.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                complements: f.ports,
                coverageNotices: { emitCoverageChanged: async () => {} }
            }
        );
        const admin = await seedCoverageUser(getServiceTestDb());
        grantUsers.push(f.ownerId, admin.userId);
        const plan = await seedGrantPlan(getServiceTestDb(), 'accommodation');
        const spy = spySink();
        const ports = {
            planPolicy: currentFloorPolicy,
            clock: f.ports.clock,
            provider: f.fake,
            billingFacts: spy.sink,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
            coverageNotices: { emitCoverageChanged: async () => {} },
            orphanhood: { addonPolicy: f.ports.addonPolicy, listing: f.ports.listing }
        };
        const request = {
            beneficiaryUserId: f.ownerId,
            actor: grantSignerActor(admin.userId),
            reason: 'S20 analytics integration test',
            includesAddons: true,
            anchors: [{ vertical: 'accommodation', ...plan }]
        };

        // Act
        await previewPermanentGrant(request, ports);
        const factsAfterPreview = spy.addonFacts().length;
        await grantPermanentGrant(request, ports);

        // Assert
        expect(factsAfterPreview).toBe(0);
        const { base, price } = await identityOf(bought.instanceId);
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_GRANTED_FREE',
                ...base,
                actorKind: 'ADMIN',
                occurredAt: f.ports.clock.now(),
                source: 'S20_CONVERSION',
                previousAmountMinor: price,
                previousCycle: 'monthly',
                previousSubscriptionId: complementId
            }
        ]);
    });
});
