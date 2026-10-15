import type { DrizzleClient } from '@repo/db';
import { addonInstances, eq, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import { seedCoveragePayment } from './support/coverage-fixtures.js';
import {
    seedServiceEndPrincipal,
    serviceEndHarness,
    serviceEndPorts
} from './support/service-end-fixtures.js';

const extraPrincipalIds: string[] = [];
const endedAt = new Date('2026-10-13T00:00:00.000Z');
afterEach(async () => {
    await retireComplementRows();
    for (const id of extraPrincipalIds.splice(0))
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, id));
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1562 TEST:B7:14 AC:B7:21 el tercer evento de S32 en S12',
    () => {
        it('A5 conserva el USER con otra principal SUSPENDED y acreditada, después S32 lo pausa', async () => {
            const provider = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: provider.fake,
                principalStatus: 'CANCEL_SCHEDULED',
                otherStatus: 'SUSPENDED',
                scopeTypes: ['USER', 'LISTING']
            });
            if (!seeded.otherPrincipalId) throw new Error('compatible principal missing');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ serviceEndsAt: endedAt })
                .where(eq(subscriptions.id, seeded.principalId));
            await seedCoveragePayment(getServiceTestDb() as unknown as DrizzleClient, {
                subscriptionId: seeded.otherPrincipalId,
                status: 'SUCCEEDED'
            });
            const support = await getServiceTestDb().transaction(async (tx) =>
                seedServiceEndPrincipal(tx as unknown as DrizzleClient, {
                    userId: seeded.userId,
                    vertical: 'accommodation',
                    status: 'ACTIVE'
                })
            );
            extraPrincipalIds.push(support.subscriptionId);
            const h = serviceEndHarness();
            const base = serviceEndPorts(getServiceTestDb() as unknown as DrizzleClient, h).ports;
            const result = await endScheduledServices(
                { limit: 100 },
                {
                    ...base,
                    provider: provider.provider,
                    clock: { now: () => complementNow },
                    addonPolicy: seeded.policy.addonPolicy,
                    listing: seeded.policy.listing,
                    liveAnchors: seeded.policy.liveAnchors,
                    payments: creditedPaymentsFromLedger
                }
            );
            expect(
                result.rows.find(({ subscriptionId }) => subscriptionId === seeded.principalId)
            ).toMatchObject({ outcome: 'CANCELLED' });
            const [principal] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.principalId));
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            const [pause] = await getServiceTestDb()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, seeded.complementId));
            expect(principal?.status).toBe('CANCELLED');
            expect(complement?.status).toBe('PAUSED');
            expect(pause?.expectedEndAt).toBeNull();
            const listingComplementId = seeded.addons.find(
                ({ instanceId }) => instanceId !== seeded.instanceId
            )?.complementId;
            if (!listingComplementId) throw new Error('listing complement missing');
            const [listingComplement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, listingComplementId));
            expect(listingComplement?.status).toBe('ACTIVE');
        });

        it('no pausa el USER si la otra compatible sigue ACTIVE y con pago', async () => {
            const provider = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: provider.fake,
                principalStatus: 'CANCEL_SCHEDULED',
                otherStatus: 'ACTIVE',
                scopeType: 'USER'
            });
            if (!seeded.otherPrincipalId) throw new Error('compatible principal missing');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ serviceEndsAt: endedAt })
                .where(eq(subscriptions.id, seeded.principalId));
            await seedCoveragePayment(getServiceTestDb() as unknown as DrizzleClient, {
                subscriptionId: seeded.otherPrincipalId,
                status: 'SUCCEEDED'
            });
            const h = serviceEndHarness();
            const base = serviceEndPorts(getServiceTestDb() as unknown as DrizzleClient, h).ports;
            await endScheduledServices(
                { limit: 100 },
                {
                    ...base,
                    provider: provider.provider,
                    clock: { now: () => complementNow },
                    addonPolicy: seeded.policy.addonPolicy,
                    listing: seeded.policy.listing,
                    liveAnchors: seeded.policy.liveAnchors,
                    payments: creditedPaymentsFromLedger
                }
            );
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            expect(complement?.status).toBe('ACTIVE');
        });

        it('A5 cancela el USER huérfano si la otra principal SUSPENDED no tiene pago acreditado', async () => {
            const provider = providerHarness();
            const seeded = await seedCommittedComplement({
                fake: provider.fake,
                principalStatus: 'CANCEL_SCHEDULED',
                otherStatus: 'SUSPENDED',
                scopeType: 'USER'
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ serviceEndsAt: endedAt })
                .where(eq(subscriptions.id, seeded.principalId));
            const h = serviceEndHarness();
            const base = serviceEndPorts(getServiceTestDb() as unknown as DrizzleClient, h).ports;
            await endScheduledServices(
                { limit: 100 },
                {
                    ...base,
                    provider: provider.provider,
                    clock: { now: () => complementNow },
                    addonPolicy: seeded.policy.addonPolicy,
                    listing: seeded.policy.listing,
                    liveAnchors: seeded.policy.liveAnchors,
                    payments: creditedPaymentsFromLedger
                }
            );
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.complementId));
            const [instance] = await getServiceTestDb()
                .select({ status: addonInstances.status })
                .from(addonInstances)
                .where(eq(addonInstances.id, seeded.instanceId));
            expect(complement?.status).toBe('CANCELLED');
            expect(instance?.status).toBe('CANCELLED');
        });
    }
);
