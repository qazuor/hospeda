import {
    addonInstances,
    emailOutbox,
    eq,
    inArray,
    reconciliationMarks,
    reconciliationZeroCallModel,
    subscriptions
} from '@repo/db';
import type { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { AddonOrphanhoodPorts } from '../../../src/services/billing/addon/addon-orphanhood-ports.js';
import { runZeroCallChecks } from '../../../src/services/billing/reconciliation/sweep/zero-call-checks.service.js';
import type { AddonWithoutShutdownPorts } from '../../../src/services/billing/reconciliation/sweep/zero-call-ports.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { createReconciliationFake } from './reconciliation-sweep-fixtures.js';
import {
    orphanPorts,
    readInstance,
    retireCommittedOrphanRows,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './support/addon-orphan-fixtures.js';

const assertListingPurgedIsRequired = (ports: AddonOrphanhoodPorts): AddonWithoutShutdownPorts => {
    // @ts-expect-error fichaPurgada is mandatory for the fourth check.
    return ports;
};
void assertListingPurgedIsRequired;

type Seed = {
    instanceId: string;
    complementId: string | null;
    principalId: string | null;
    ownerId: string;
    status: 'ACTIVE' | 'PENDING_AUTHORIZATION';
};
const seeds: Seed[] = [];
const ownerIds: string[] = [];

function isolateUnrelatedChecks(): void {
    vi.spyOn(
        reconciliationZeroCallModel,
        'listOpenSuccessionsOnDeadPredecessorsPage'
    ).mockResolvedValue([]);
    vi.spyOn(
        reconciliationZeroCallModel,
        'listDeferredCourtesiesWithActiveSuccessorPage'
    ).mockResolvedValue([]);
}

async function seedListingInstance(
    status: Seed['status'],
    withPrincipal = true,
    withComplement = true
) {
    const db = getServiceTestDb();
    const targetId = crypto.randomUUID();
    const data = await db.transaction(async (tx) => {
        const owner = await seedOrphanOwner(tx as never);
        const principal = withPrincipal
            ? await seedPrincipal(tx as never, {
                  userId: owner.userId,
                  vertical: 'accommodation',
                  status: 'ACTIVE'
              })
            : undefined;
        const complement = withComplement
            ? await seedComplement(tx as never, {
                  userId: owner.userId,
                  vertical: 'accommodation',
                  status: 'ACTIVE'
              })
            : undefined;
        const instance = await seedOrphanInstance(tx as never, {
            ownerId: owner.userId,
            scopeType: 'LISTING',
            compatibleVerticals: ['accommodation'],
            status,
            targetId,
            ...(complement ? { complementSubscriptionId: complement.subscriptionId } : {}),
            chargeKind: withComplement ? 'PERIODICO' : 'UNA_VEZ'
        });
        return {
            ownerId: owner.userId,
            instanceId: instance.instanceId,
            complementId: complement?.subscriptionId,
            principalId: principal?.subscriptionId
        };
    });
    ownerIds.push(data.ownerId);
    seeds.push({
        instanceId: data.instanceId,
        complementId: data.complementId ?? null,
        principalId: data.principalId ?? null,
        ownerId: data.ownerId,
        status
    });
    const { ports, setListing } = orphanPorts(db as never);
    setListing(targetId, {
        vertical: 'accommodation' as VerticalEnum,
        ownerId: data.ownerId,
        acceptsFeature: true
    });
    return { ...data, targetId, ports };
}

async function run(
    ports: AddonWithoutShutdownPorts,
    correlationId = crypto.randomUUID(),
    provider?: unknown
) {
    isolateUnrelatedChecks();
    const instanceIds = seeds.map(({ instanceId }) => instanceId);
    const ownVersions = await getServiceTestDb()
        .select({
            addonVersionId: addonInstances.addonVersionId,
            targetId: addonInstances.targetId
        })
        .from(addonInstances)
        .where(inArray(addonInstances.id, instanceIds));
    const ownVersionIds = new Set(ownVersions.map(({ addonVersionId }) => addonVersionId));
    const ownTargetIds = new Set(
        ownVersions.flatMap(({ targetId }) => (targetId ? [targetId] : []))
    );
    const isolatedPorts: AddonWithoutShutdownPorts = {
        ...ports,
        addonPolicy: async (input) => {
            const policy = await ports.addonPolicy(input);
            return ownVersionIds.has(input.addonVersionId)
                ? policy
                : { ...policy, scopeType: 'LISTING' };
        },
        listingPurged: async (input) => {
            if (!ownTargetIds.has(input.listingId)) throw new Error('unrelated listing');
            return ports.listingPurged(input);
        },
        listing: async (input) => {
            if (!ownTargetIds.has(input.listingId)) throw new Error('unrelated listing');
            return ports.listing(input);
        },
        payments: { hasCreditedPayment: async () => true }
    };
    return runZeroCallChecks(
        { correlationId },
        {
            addonOrphanhood: isolatedPorts,
            retainedPayments: { listRetainedPayments: async () => [] },
            retainedPaymentBranches: {
                resolveByBranch: async () => ({ kind: 'NO_BRANCH' as const })
            },
            markPayments: { hang: async () => {}, countUnresolved: async () => 0 },
            ...(provider ? { provider } : {})
        }
    );
}

async function marksFor(complementId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, complementId));
}

afterAll(closeServiceTestPool);
afterEach(async () => {
    const db = getServiceTestDb();
    for (const seed of seeds)
        if (seed.complementId)
            await db
                .delete(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, seed.complementId));
    if (seeds.length) {
        await db
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(
                inArray(
                    addonInstances.id,
                    seeds.map(({ instanceId }) => instanceId)
                )
            );
        const subscriptionIds = seeds.flatMap(({ complementId, principalId }) =>
            [complementId, principalId].filter((id): id is string => id !== null)
        );
        if (subscriptionIds.length)
            await db
                .update(subscriptions)
                .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
                .where(inArray(subscriptions.id, subscriptionIds));
    }
    if (ownerIds.length)
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, ownerIds));
    seeds.length = 0;
    ownerIds.length = 0;
    await retireCommittedOrphanRows();
    await vi.restoreAllMocks();
});

describe('TEST:B5:18 AC:B5:36 purged LISTING half of the fourth check', () => {
    it.each([
        'PENDING_AUTHORIZATION',
        'ACTIVE'
    ] as const)('calls A6 on a purged %s and resolves without marking', async (status) => {
        const fixture = await seedListingInstance(status);
        const canceller = vi.fn(async () => {});
        const listingPurged = vi.fn(async ({ listingId }: { listingId: string }) => ({
            purged: listingId === fixture.targetId
        }));
        const summary = await run({
            ...fixture.ports,
            listingPurged,
            listingPurgedAddons: { cancelPurgedListingAddon: canceller }
        });
        expect(canceller).toHaveBeenCalledTimes(1);
        expect(canceller).toHaveBeenCalledWith({
            instanceId: fixture.instanceId,
            correlationId: expect.any(String)
        });
        expect(await marksFor(fixture.complementId as string)).toEqual([]);
        expect(
            summary.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')?.resolved
        ).toBeGreaterThanOrEqual(1);
        expect((await readInstance(getServiceTestDb() as never, fixture.instanceId)).status).toBe(
            status
        );
    });

    it.each([
        'PENDING_AUTHORIZATION',
        'ACTIVE'
    ] as const)('marks only after A6 throws for %s', async (status) => {
        const fixture = await seedListingInstance(status);
        let marksAtCall = -1;
        const canceller = vi.fn(async () => {
            marksAtCall = (await marksFor(fixture.complementId as string)).length;
            throw new Error('A6 failed');
        });
        const summary = await run({
            ...fixture.ports,
            listingPurged: async () => ({ purged: true }),
            listingPurgedAddons: { cancelPurgedListingAddon: canceller }
        });
        expect(canceller).toHaveBeenCalledTimes(1);
        expect(marksAtCall).toBe(0);
        expect(
            (await marksFor(fixture.complementId as string)).map(({ reason }) => reason)
        ).toEqual(['ADDON_SIN_APAGAR']);
        expect(
            summary.failures.filter(({ subjectId }) => subjectId === fixture.instanceId)
        ).toEqual([]);
    });

    it('marks when the A6 interface is not registered', async () => {
        const fixture = await seedListingInstance('ACTIVE');
        await run({ ...fixture.ports, listingPurged: async () => ({ purged: true }) });
        expect(
            (await marksFor(fixture.complementId as string)).map(({ reason }) => reason)
        ).toEqual(['ADDON_SIN_APAGAR']);
    });

    it('does not call A6 or mark when fichaPurgada is false and the principal is live', async () => {
        const fixture = await seedListingInstance('ACTIVE');
        const principals = await getServiceTestDb()
            .select({
                status: subscriptions.status,
                class: subscriptions.class,
                vertical: subscriptions.vertical
            })
            .from(subscriptions)
            .where(eq(subscriptions.userId, fixture.ownerId));
        expect(principals).toContainEqual({
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            vertical: 'accommodation'
        });
        expect(await fixture.ports.listing({ listingId: fixture.targetId })).toMatchObject({
            ownerId: fixture.ownerId,
            vertical: 'accommodation'
        });
        const canceller = vi.fn(async () => {});
        await run({
            ...fixture.ports,
            listingPurged: async () => ({ purged: false }),
            listingPurgedAddons: { cancelPurgedListingAddon: canceller }
        });
        expect(canceller).not.toHaveBeenCalled();
        expect(await marksFor(fixture.complementId as string)).toEqual([]);
    });

    it('calls A6 before the orphanhood verdict and does not consult listing()', async () => {
        const fixture = await seedListingInstance('ACTIVE', false);
        const canceller = vi.fn(async () => {});
        const listing = vi.fn(async () => {
            throw new Error('listing is unavailable');
        });
        await run({
            ...fixture.ports,
            listing,
            listingPurged: async () => ({ purged: true }),
            listingPurgedAddons: { cancelPurgedListingAddon: canceller }
        });
        expect(canceller).toHaveBeenCalledTimes(1);
        expect(listing).not.toHaveBeenCalled();
        expect(await marksFor(fixture.complementId as string)).toEqual([]);
    });

    it('calls A6 when fichaPurged identifies a target unknown to the listing reader', async () => {
        const fixture = await seedListingInstance('ACTIVE');
        const canceller = vi.fn(async () => {});
        const listing = vi.fn(async () => {
            throw new Error('unknown listing');
        });
        await run({
            ...fixture.ports,
            listing,
            listingPurged: async () => ({ purged: true }),
            listingPurgedAddons: { cancelPurgedListingAddon: canceller }
        });
        expect(canceller).toHaveBeenCalledTimes(1);
        expect(listing).not.toHaveBeenCalled();
    });

    it('does not mark or fail for an UNA_VEZ without a complement when A6 throws', async () => {
        const fixture = await seedListingInstance('ACTIVE', true, false);
        const canceller = vi.fn(async () => {
            throw new Error('A6 failed');
        });
        const summary = await run({
            ...fixture.ports,
            listingPurged: async () => ({ purged: true }),
            listingPurgedAddons: { cancelPurgedListingAddon: canceller }
        });
        expect(canceller).toHaveBeenCalledTimes(1);
        expect(
            summary.failures.filter(({ subjectId }) => subjectId === fixture.instanceId)
        ).toEqual([]);
        const subscriptionIds = [fixture.principalId, fixture.complementId].filter(
            (id): id is string => !!id
        );
        expect(
            await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds))
        ).toEqual([]);
    });

    it('records a fichaPurgada read error and continues to the next instance', async () => {
        const first = await seedListingInstance('ACTIVE');
        const second = await seedListingInstance('ACTIVE');
        const canceller = vi.fn(async () => {});
        const listingPurged = vi.fn(async ({ listingId }: { listingId: string }) => {
            if (listingId === first.targetId) throw new Error('read failed');
            return { purged: true };
        });
        const summary = await run({
            ...first.ports,
            listingPurged,
            listingPurgedAddons: { cancelPurgedListingAddon: canceller }
        });
        expect(
            summary.failures.filter(({ subjectId }) => subjectId === first.instanceId)
        ).toHaveLength(1);
        expect(canceller).toHaveBeenCalledWith({
            instanceId: second.instanceId,
            correlationId: expect.any(String)
        });
        expect(canceller).toHaveBeenCalledTimes(1);
        expect(await marksFor(first.complementId as string)).toEqual([]);
    });

    it('makes zero provider calls while A6 is called', async () => {
        const fixture = await seedListingInstance('ACTIVE');
        const { fake } = createReconciliationFake();
        let calls = 0;
        const tripwire = new Proxy(fake, {
            get(target, key, receiver) {
                const value: unknown = Reflect.get(target, key, receiver);
                if (typeof value !== 'function') return value;
                calls++;
                return (...args: unknown[]) => value.apply(target, args);
            }
        });
        const canceller = vi.fn(async () => {});
        await run(
            {
                ...fixture.ports,
                listingPurged: async () => ({ purged: true }),
                listingPurgedAddons: { cancelPurgedListingAddon: canceller }
            },
            crypto.randomUUID(),
            tripwire
        );
        expect(canceller).toHaveBeenCalledTimes(1);
        expect(calls).toBe(0);
    });
});
