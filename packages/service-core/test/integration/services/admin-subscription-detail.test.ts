import {
    billingOptions,
    courtesyGrants,
    eq,
    planVersions,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { getAdminSubscriptionDetail } from '../../../src/services/billing/subscription/admin-subscription-detail.service.js';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireAdminSubscriptionReadFixtures,
    seedAdminSubscriptionReadPrincipal,
    seedAdminSubscriptionReadTombstone
} from './support/admin-subscription-read-fixtures.js';
import { complementNow } from './support/complement-fixtures.js';
import {
    courtesyNow,
    retireCourtesyFixtures,
    seedCourtesyPrincipal
} from './support/courtesy-fixtures.js';
import { pausePlanPolicy, seedClosedPause } from './support/pause-fixtures.js';

const actor = {
    id: crypto.randomUUID(),
    roles: [],
    permissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
};
const clock = { now: () => courtesyNow };
const db = () => getServiceTestDb();
const detail = (subscriptionId: string, at = courtesyNow) =>
    getAdminSubscriptionDetail({ actor, subscriptionId }, { clock: { now: () => at } });

async function expectedBase(input: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly planVersionId: string;
    readonly email: string;
    readonly displayName: string | null;
}) {
    const [subscription] = await db()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId));
    const [version] = await db()
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, input.planVersionId));
    if (!subscription || !version || !subscription.billingOptionId)
        throw new Error('fixture missing');
    const [option] = await db()
        .select()
        .from(billingOptions)
        .where(eq(billingOptions.id, subscription.billingOptionId));
    if (!option) throw new Error('billing option missing');
    return {
        id: input.subscriptionId,
        status: subscription.status,
        class: 'PRINCIPAL',
        vertical: VerticalEnum.ACCOMMODATION,
        owner: {
            id: input.userId,
            email: input.email,
            displayName: input.displayName,
            deleted: false
        },
        plan: {
            planId: version.planId,
            planName: 'Coverage plan',
            planVersionId: input.planVersionId
        },
        cycle: option.cycle,
        paymentMethod: subscription.paymentMethod,
        nextChargeAt: subscription.nextChargeAt,
        createdAt: subscription.createdAt,
        serviceEndsAt: subscription.serviceEndsAt,
        planVersion: {
            id: input.planVersionId,
            current: version.current,
            sellable: version.sellable,
            createdAt: version.createdAt
        },
        price: { amountMinor: option.amount, currency: option.currency, cycle: option.cycle },
        succeedsId: subscription.succeedsId,
        succeededById: subscription.succeededById,
        pause: null,
        courtesy: null
    };
}

afterEach(async () => {
    await retireCourtesyFixtures();
    await retireAdminSubscriptionReadFixtures();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2081 CA-2 desde el detalle llega a cada acción para la que tiene permiso; las que no puede ejecutar no se muestran',
    () => {
        it('returns the entire active detail with persisted version and price', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: crypto.randomUUID(),
                label: 'active'
            });
            expect(await detail(owner.subscriptionId)).toEqual(await expectedBase(owner));
        });

        it('reads a customer pause written by the real pause service', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: crypto.randomUUID(),
                label: 'paused'
            });
            const result = await pauseSubscription(
                { subscriptionId: owner.subscriptionId, requestedMonths: 2 },
                {
                    provider: owner.harness.provider,
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
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            if (result.outcome !== 'PAUSED') throw new Error(`Unexpected pause: ${result.outcome}`);
            const [pause] = await db()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, owner.subscriptionId));
            if (!pause) throw new Error('pause missing');
            expect(await detail(owner.subscriptionId)).toEqual({
                ...(await expectedBase(owner)),
                pause: {
                    reason: 'CUSTOMER_REQUEST',
                    startsAt: pause.startsAt,
                    expectedEndAt: result.expectedEndAt,
                    requestedMonths: 2
                }
            });
        });

        it('reads real courtesy and its pause using the injected clock', async () => {
            const owner = await seedCourtesyPrincipal();
            const result = await grantTemporaryCourtesy(
                {
                    subscriptionId: owner.subscriptionId,
                    months: 2,
                    grantedBy: owner.userId,
                    reason: 'detail test'
                },
                owner.ports
            );
            if (result.outcome !== 'GRANTED')
                throw new Error(`Unexpected grant: ${result.outcome}`);
            const [pause] = await db()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, owner.subscriptionId));
            if (!pause) throw new Error('courtesy pause missing');
            const [user] = await db()
                .select({ email: users.email, displayName: users.displayName })
                .from(users)
                .where(eq(users.id, owner.userId));
            if (!user) throw new Error('courtesy owner missing');
            const base = await expectedBase({
                ...owner,
                email: user.email,
                displayName: user.displayName
            });
            expect(await detail(owner.subscriptionId)).toEqual({
                ...base,
                pause: {
                    reason: 'COURTESY',
                    startsAt: pause.startsAt,
                    expectedEndAt: pause.expectedEndAt,
                    requestedMonths: pause.requestedMonths
                },
                courtesy: {
                    courtesyGrantId: result.courtesyGrantId,
                    months: 2,
                    startsAt: courtesyNow,
                    endsAt: result.endsAt,
                    remainingMonths: 2
                }
            });
            expect(
                await detail(owner.subscriptionId, new Date(result.endsAt.getTime() + 1))
            ).toEqual({
                ...base,
                pause: {
                    reason: 'COURTESY',
                    startsAt: pause.startsAt,
                    expectedEndAt: pause.expectedEndAt,
                    requestedMonths: pause.requestedMonths
                },
                courtesy: null
            });
            // Fixture state: close the balance directly; no read-only service performs this transition.
            await db()
                .update(courtesyGrants)
                .set({
                    balanceMonths: 1,
                    balanceClosedAt: courtesyNow,
                    closeReason: 'GRANT_PERMANENTE_OTORGADO'
                })
                .where(eq(courtesyGrants.id, result.courtesyGrantId));
            expect(await detail(owner.subscriptionId)).toEqual({
                ...base,
                pause: {
                    reason: 'COURTESY',
                    startsAt: pause.startsAt,
                    expectedEndAt: pause.expectedEndAt,
                    requestedMonths: pause.requestedMonths
                },
                courtesy: null
            });
        });

        it('ignores a closed pause', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: crypto.randomUUID(),
                label: 'closed'
            });
            await seedClosedPause({
                subscriptionId: owner.subscriptionId,
                startsAt: courtesyNow,
                actualEndAt: new Date(courtesyNow.getTime() + 1)
            });
            expect(await detail(owner.subscriptionId)).toEqual(await expectedBase(owner));
        });

        it('uses the owner email and never the declared payer email', async () => {
            const owner = await seedAdminSubscriptionReadPrincipal({
                token: crypto.randomUUID(),
                label: 'payer'
            });
            // Fixture state: only checkout writes the declared payer email.
            await db()
                .update(subscriptions)
                .set({ declaredPayerEmail: `declared-${crypto.randomUUID()}@example.test` })
                .where(eq(subscriptions.id, owner.subscriptionId));
            expect(await detail(owner.subscriptionId)).toEqual(await expectedBase(owner));
        });

        it('reads a tombstone by its exact id', async () => {
            const subscriptionId = await seedAdminSubscriptionReadTombstone();
            const [row] = await db()
                .select({
                    userId: subscriptions.userId,
                    planVersionId: subscriptions.planVersionId
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            if (!row?.userId || !row.planVersionId) throw new Error('tombstone fixture missing');
            const [owner] = await db()
                .select({ email: users.email, displayName: users.displayName })
                .from(users)
                .where(eq(users.id, row.userId));
            if (!owner) throw new Error('tombstone owner missing');
            expect(await detail(subscriptionId)).toEqual({
                ...(await expectedBase({
                    subscriptionId,
                    userId: row.userId,
                    email: owner.email,
                    displayName: owner.displayName,
                    planVersionId: row.planVersionId
                })),
                status: 'CANCELLED',
                class: 'LAPIDA'
            });
        });

        it('returns NOT_FOUND for an unknown id and FORBIDDEN before reading without permission', async () => {
            await expect(detail(crypto.randomUUID())).rejects.toMatchObject({
                code: ServiceErrorCode.NOT_FOUND
            });
            await expect(detail('invalid')).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR
            });
            await expect(
                getAdminSubscriptionDetail(
                    { actor: { ...actor, permissions: [] }, subscriptionId: crypto.randomUUID() },
                    { clock }
                )
            ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        });
    }
);
