import { eq, planVersions, subscriptions, users } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { listAdminSubscriptions } from '../../../src/services/billing/subscription/admin-subscription-list.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireAdminSubscriptionReadFixtures,
    seedAdminSubscriptionReadPrincipal,
    seedAdminSubscriptionReadTombstone
} from './support/admin-subscription-read-fixtures.js';
import { complementNow } from './support/complement-fixtures.js';
import { pausePlanPolicy } from './support/pause-fixtures.js';

const token = () => `hos-${crypto.randomUUID()}`;
const actor = {
    id: crypto.randomUUID(),
    roles: [],
    permissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
};
const list = (input: {
    readonly q: string;
    readonly page?: number;
    readonly pageSize?: number;
    readonly status?: 'ACTIVE' | 'PAUSED';
    readonly vertical?: VerticalEnum;
}) =>
    listAdminSubscriptions({
        actor,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 20,
        q: input.q,
        status: input.status,
        vertical: input.vertical
    });

afterEach(retireAdminSubscriptionReadFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2081 CA-1 un admin con permiso encuentra una suscripción por el email del dueño, sin conocer su ID',
    () => {
        it('finds the exact owner email and returns the complete item', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: token(),
                label: 'exact'
            });
            const [version] = await getServiceTestDb()
                .select({ planId: planVersions.planId })
                .from(planVersions)
                .where(eq(planVersions.id, owner.planVersionId));
            const [subscription] = await getServiceTestDb()
                .select({ createdAt: subscriptions.createdAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, owner.subscriptionId));
            if (!version || !subscription) throw new Error('fixture anchor missing');
            expect(await list({ q: owner.email })).toEqual({
                items: [
                    {
                        id: owner.subscriptionId,
                        status: 'ACTIVE',
                        class: 'PRINCIPAL',
                        vertical: VerticalEnum.ACCOMMODATION,
                        owner: {
                            id: owner.userId,
                            email: owner.email,
                            displayName: owner.displayName,
                            deleted: false
                        },
                        plan: {
                            planId: version.planId,
                            planName: 'Coverage plan',
                            planVersionId: owner.planVersionId
                        },
                        cycle: 'monthly',
                        paymentMethod: 'CARD',
                        nextChargeAt: null,
                        createdAt: subscription.createdAt
                    }
                ],
                total: 1
            });
        });

        it('matches an uppercase email substring and the visible name', async () => {
            const mark = token();
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: mark,
                label: 'substring'
            });
            const byEmail = await list({ q: mark.slice(0, 12).toUpperCase() });
            expect(byEmail.items.map(({ id }) => id)).toEqual([owner.subscriptionId]);
            expect(byEmail.total).toBe(1);
            const byName = await list({ q: 'SUBSTRING' });
            expect(byName.items.map(({ id }) => id)).toEqual([owner.subscriptionId]);
            expect(byName.total).toBe(1);
        });

        it('finds both subscription and owner UUIDs', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: token(),
                label: 'uuid'
            });
            expect((await list({ q: owner.subscriptionId })).items.map(({ id }) => id)).toEqual([
                owner.subscriptionId
            ]);
            expect((await list({ q: owner.userId })).items.map(({ id }) => id)).toEqual([
                owner.subscriptionId
            ]);
        });

        it('does not treat the declared payer email as owner identity', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: token(),
                label: 'declared'
            });
            const declared = `declared-${token()}@example.test`;
            // Fixture seeding: the declared payer email has no read-only production writer.
            await getServiceTestDb()
                .update(subscriptions)
                .set({ declaredPayerEmail: declared })
                .where(eq(subscriptions.id, owner.subscriptionId));
            expect(await list({ q: declared })).toEqual({ items: [], total: 0 });
        });

        it('treats LIKE wildcard characters literally', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: token(),
                label: 'wildcard'
            });
            expect(await list({ q: '%' })).toEqual({ items: [], total: 0 });
            expect(await list({ q: '_' })).toEqual({ items: [], total: 0 });
            expect((await list({ q: owner.email })).items.map(({ id }) => id)).toEqual([
                owner.subscriptionId
            ]);
        });

        it('filters by status and vertical after a real pause', async () => {
            const mark = token();
            const active = await seedAdminSubscriptionReadPrincipal({
                token: mark,
                label: 'active'
            });
            const paused = await seedAdminSubscriptionReadPrincipal({
                token: mark,
                label: 'paused'
            });
            const result = await pauseSubscription(
                { subscriptionId: paused.subscriptionId, requestedMonths: 2 },
                {
                    provider: paused.harness.provider,
                    clock: { now: () => complementNow },
                    planPolicy: pausePlanPolicy(),
                    complements: {
                        addonPolicy: async () => {
                            throw new Error('No addon expected');
                        },
                        listing: async () => {
                            throw new Error('No listing expected');
                        }
                    },
                    coverageNotices: { emitCoverageChanged: async () => {} }
                }
            );
            expect(result.outcome).toBe('PAUSED');
            expect((await list({ q: mark, status: 'ACTIVE' })).items.map(({ id }) => id)).toEqual([
                active.subscriptionId
            ]);
            expect((await list({ q: mark, status: 'PAUSED' })).items.map(({ id }) => id)).toEqual([
                paused.subscriptionId
            ]);
            expect((await list({ q: mark, vertical: VerticalEnum.ACCOMMODATION })).total).toBe(2);
            expect(await list({ q: mark, vertical: VerticalEnum.VENUE })).toEqual({
                items: [],
                total: 0
            });
        });

        it('paginates a timestamp tie by descending id with an exact filtered count', async () => {
            const mark = token();
            const owners = await Promise.all(
                ['a', 'b', 'c'].map((label) =>
                    seedAdminSubscriptionReadPrincipal({ token: mark, label })
                )
            );
            const sameInstant = new Date('2026-01-01T00:00:00.000Z');
            // Fixture seeding: a timestamp tie needs a deterministic UPDATE.
            for (const owner of owners)
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({ createdAt: sameInstant })
                    .where(eq(subscriptions.id, owner.subscriptionId));
            const expected = owners
                .map(({ subscriptionId }) => subscriptionId)
                .sort()
                .reverse();
            const first = await list({ q: mark, pageSize: 2 });
            const second = await list({ q: mark, page: 2, pageSize: 2 });
            expect(first.items.map(({ id }) => id)).toEqual(expected.slice(0, 2));
            expect(first.total).toBe(3);
            expect(second.items.map(({ id }) => id)).toEqual(expected.slice(2));
            expect(second.total).toBe(3);
        });

        it('excludes a seeded tombstone and reports the exact count', async () => {
            const tombstoneId = await seedAdminSubscriptionReadTombstone();
            expect(await list({ q: tombstoneId })).toEqual({ items: [], total: 0 });
        });

        it('retains a deleted owner and marks it deleted', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: token(),
                label: 'deleted'
            });
            // Fixture seeding: soft deletion is deliberately set on this owner.
            await getServiceTestDb()
                .update(users)
                .set({ deletedAt: new Date('2026-01-01T00:00:00.000Z') })
                .where(eq(users.id, owner.userId));
            const result = await list({ q: owner.email });
            expect(result.items.map(({ owner: itemOwner }) => itemOwner?.deleted)).toEqual([true]);
            expect(result.total).toBe(1);
        });

        it('rejects an actor without inspection permission and a missing actor', async () => {
            const query = { page: 1, pageSize: 20, q: token() };
            await expect(
                listAdminSubscriptions({ ...query, actor: { ...actor, permissions: [] } })
            ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
            await expect(listAdminSubscriptions(query)).rejects.toMatchObject({
                code: ServiceErrorCode.FORBIDDEN
            });
        });
    }
);
