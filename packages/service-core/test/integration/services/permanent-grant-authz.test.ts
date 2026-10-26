import { emailOutbox, eq, permanentGrants, permanentGrantVerticals, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { ADMINISTRATIVE_ACTION_PERMISSIONS } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant,
    resumePermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan,
    seedPermanentGrant
} from './support/permanent-grant-fixtures.js';

const users: string[] = [];
const now = new Date('2026-10-14T12:00:00.000Z');
afterAll(closeServiceTestPool);
afterEach(async () => {
    if (users.length)
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, users[0]!));
    await retirePermanentGrantRows(users.splice(0));
});

type Setup = {
    beneficiary: string;
    signer: string;
    other: string;
    planA: Awaited<ReturnType<typeof seedGrantPlan>>;
    planB: Awaited<ReturnType<typeof seedGrantPlan>>;
    subscriptionA: string;
    subscriptionB: string;
};
async function setup(): Promise<Setup> {
    const seeded = await getServiceTestDb().transaction(async (tx) => {
        const [{ userId: beneficiary }, { userId: signer }, { userId: other }] = await Promise.all([
            seedCoverageUser(tx),
            seedCoverageUser(tx),
            seedCoverageUser(tx)
        ]);
        const coverageA = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
        const coverageB = await seedCoveragePlanVersion(tx, VerticalEnum.VENUE);
        const subscriptionA = await seedCoverageSubscription(tx, {
            userId: beneficiary,
            vertical: VerticalEnum.ACCOMMODATION,
            ...coverageA,
            status: 'ACTIVE'
        });
        const subscriptionB = await seedCoverageSubscription(tx, {
            userId: beneficiary,
            vertical: VerticalEnum.VENUE,
            ...coverageB,
            status: 'ACTIVE'
        });
        return {
            beneficiary,
            signer,
            other,
            planA: await seedGrantPlan(tx, VerticalEnum.ACCOMMODATION),
            planB: await seedGrantPlan(tx, VerticalEnum.VENUE),
            subscriptionA: subscriptionA.subscriptionId,
            subscriptionB: subscriptionB.subscriptionId
        };
    });
    users.push(seeded.beneficiary, seeded.signer, seeded.other);
    return seeded;
}
function ports() {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => now }
    });
    let providerCalls = 0;
    const provider = new Proxy(fake, {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver) as unknown;
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
                providerCalls++;
                return (value as (...a: unknown[]) => unknown).apply(target, args);
            };
        }
    });
    const emitCoverageChanged = vi.fn(async () => undefined);
    const beforeCancel = vi.fn(async () => 'SENT' as const);
    return {
        value: {
            planPolicy: currentFloorPolicy,
            clock: { now: () => now },
            provider,
            beforeCancelNotice: { beforeCancel },
            coverageNotices: { emitCoverageChanged },
            orphanhood: {
                addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                listing: async () => {
                    throw new Error('no listing addon seeded');
                }
            }
        },
        emitCoverageChanged,
        beforeCancel,
        providerCalls: () => providerCalls
    };
}
function actor(userId: string, permitted = true): Actor {
    return permitted
        ? grantSignerActor(userId)
        : {
              id: userId,
              roles: [RoleEnum.ADMIN],
              permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
          };
}
function grantInput(
    s: Setup,
    signer: Actor,
    vertical = VerticalEnum.ACCOMMODATION,
    plan = s.planA
) {
    return {
        beneficiaryUserId: s.beneficiary,
        actor: signer,
        reason: 'authorization test',
        includesAddons: false,
        anchors: [{ vertical, ...plan }]
    };
}
async function expectForbiddenAndUntouched(
    action: () => Promise<unknown>,
    s: Setup,
    p: ReturnType<typeof ports>
) {
    const statusBefore = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, s.subscriptionA));
    const before = await getServiceTestDb()
        .select({ id: permanentGrants.id })
        .from(permanentGrants)
        .where(eq(permanentGrants.beneficiaryUserId, s.beneficiary));
    const anchorsBefore = await getServiceTestDb()
        .select({ id: permanentGrantVerticals.id })
        .from(permanentGrantVerticals)
        .innerJoin(
            permanentGrants,
            eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
        )
        .where(eq(permanentGrants.beneficiaryUserId, s.beneficiary));
    await expect(action()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
    });
    const after = await getServiceTestDb()
        .select({ id: permanentGrants.id })
        .from(permanentGrants)
        .where(eq(permanentGrants.beneficiaryUserId, s.beneficiary));
    const anchorsAfter = await getServiceTestDb()
        .select({ id: permanentGrantVerticals.id })
        .from(permanentGrantVerticals)
        .innerJoin(
            permanentGrants,
            eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
        )
        .where(eq(permanentGrants.beneficiaryUserId, s.beneficiary));
    const statuses = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, s.subscriptionA));
    const outbox = await getServiceTestDb()
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, s.beneficiary));
    expect(after).toEqual(before);
    expect(anchorsAfter).toEqual(anchorsBefore);
    expect(statuses[0]?.status).toBe(statusBefore[0]?.status);
    expect(p.providerCalls()).toBe(0);
    expect(p.emitCoverageChanged).not.toHaveBeenCalled();
    expect(p.beforeCancel).not.toHaveBeenCalled();
    expect(outbox).toHaveLength(0);
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:9 — the permanent grant acts authorize ACC_2 inside the service (AC:B9a:9)',
    () => {
        it('a — neighbour permissions without ACC_2 forbid granting', async () => {
            const s = await setup();
            const p = ports();
            await expectForbiddenAndUntouched(
                () => grantPermanentGrant(grantInput(s, actor(s.signer, false)), p.value),
                s,
                p
            );
        });
        it('b — an empty permission set forbids granting', async () => {
            const s = await setup();
            const p = ports();
            await expectForbiddenAndUntouched(
                () =>
                    grantPermanentGrant(
                        grantInput(s, { id: s.signer, roles: [RoleEnum.ADMIN], permissions: [] }),
                        p.value
                    ),
                s,
                p
            );
        });
        it('c — the beneficiary cannot grant to themself', async () => {
            const s = await setup();
            const p = ports();
            await expectForbiddenAndUntouched(
                () => grantPermanentGrant(grantInput(s, actor(s.beneficiary)), p.value),
                s,
                p
            );
        });
        it('d — a hand-built system actor is forbidden', async () => {
            const s = await setup();
            const p = ports();
            // createSystemActor rejects ACC_2 by construction; hand-build to verify the step 3 marker.
            const system: Actor = {
                id: s.signer,
                roles: [RoleEnum.SYSTEM],
                permissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
                _isSystemActor: true
            };
            await expectForbiddenAndUntouched(
                () => grantPermanentGrant(grantInput(s, system), p.value),
                s,
                p
            );
        });
        it('e — an authorized actor writes the grant, records actor.id, and cancels the active subscription', async () => {
            const s = await setup();
            const p = ports();
            const result = await grantPermanentGrant(grantInput(s, actor(s.signer)), p.value);
            const [grant] = await getServiceTestDb()
                .select()
                .from(permanentGrants)
                .where(eq(permanentGrants.id, result.permanentGrantId));
            const [sub] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, s.subscriptionA));
            expect(grant?.grantedBy).toBe(s.signer);
            expect(sub?.status).toBe('CANCELLED');
        });
        it('f — permission precedes malformed input validation', async () => {
            const s = await setup();
            const p = ports();
            const malformed = { ...grantInput(s, actor(s.signer, false)), anchors: [] };
            await expect(grantPermanentGrant(malformed, p.value)).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            await expect(
                grantPermanentGrant({ ...malformed, actor: actor(s.signer) }, p.value)
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'INVALID_PERMANENT_GRANT_INPUT'
            });
        });
        it('g — neighbour permissions forbid anchoring without changing the new vertical', async () => {
            const s = await setup();
            const p = ports();
            const created = await grantPermanentGrant(grantInput(s, actor(s.other)), p.value);
            const p2 = ports();
            await expectForbiddenAndUntouched(
                () =>
                    anchorPermanentGrantVertical(
                        {
                            permanentGrantId: created.permanentGrantId,
                            actor: actor(s.signer, false),
                            vertical: VerticalEnum.VENUE,
                            ...s.planB
                        },
                        p2.value
                    ),
                s,
                p2
            );
            expect(
                (
                    await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, s.subscriptionB))
                )[0]?.status
            ).toBe('ACTIVE');
        });
        it('h — the grant beneficiary cannot anchor themself', async () => {
            const s = await setup();
            const p = ports();
            const seeded = await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: s.beneficiary,
                grantedBy: s.other,
                anchors: [{ vertical: VerticalEnum.ACCOMMODATION }]
            });
            await expectForbiddenAndUntouched(
                () =>
                    anchorPermanentGrantVertical(
                        {
                            permanentGrantId: seeded.grantId,
                            actor: actor(s.beneficiary),
                            vertical: VerticalEnum.VENUE,
                            ...s.planB
                        },
                        p.value
                    ),
                s,
                p
            );
        });
        it('i — a hand-built system actor is forbidden from anchoring', async () => {
            const s = await setup();
            const p = ports();
            const seeded = await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: s.beneficiary,
                grantedBy: s.other,
                anchors: [{ vertical: VerticalEnum.ACCOMMODATION }]
            });
            const system: Actor = {
                id: s.signer,
                roles: [RoleEnum.SYSTEM],
                permissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
                _isSystemActor: true
            };
            await expectForbiddenAndUntouched(
                () =>
                    anchorPermanentGrantVertical(
                        {
                            permanentGrantId: seeded.grantId,
                            actor: system,
                            vertical: VerticalEnum.VENUE,
                            ...s.planB
                        },
                        p.value
                    ),
                s,
                p
            );
        });
        it('j — permission is checked before grant existence is revealed', async () => {
            const s = await setup();
            const p = ports();
            const id = crypto.randomUUID();
            await expect(
                anchorPermanentGrantVertical(
                    {
                        permanentGrantId: id,
                        actor: actor(s.signer, false),
                        vertical: VerticalEnum.VENUE,
                        ...s.planB
                    },
                    p.value
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            await expect(
                anchorPermanentGrantVertical(
                    {
                        permanentGrantId: id,
                        actor: actor(s.signer),
                        vertical: VerticalEnum.VENUE,
                        ...s.planB
                    },
                    p.value
                )
            ).rejects.toMatchObject({ code: 'NOT_FOUND', reason: 'PERMANENT_GRANT_NOT_FOUND' });
        });
        it('k — beneficiary subject rejection precedes the revoked-grant check', async () => {
            const s = await setup();
            const p = ports();
            const seeded = await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: s.beneficiary,
                grantedBy: s.other,
                revoked: true,
                anchors: [{ vertical: VerticalEnum.ACCOMMODATION }]
            });
            await expect(
                anchorPermanentGrantVertical(
                    {
                        permanentGrantId: seeded.grantId,
                        actor: actor(s.beneficiary),
                        vertical: VerticalEnum.VENUE,
                        ...s.planB
                    },
                    p.value
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
        });
        it('l — resume gates before provider calls and the authorized actor can resume', async () => {
            const s = await setup();
            const seeded = await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: s.beneficiary,
                grantedBy: s.other,
                anchors: [{ vertical: VerticalEnum.ACCOMMODATION }]
            });
            const p = ports();
            await expect(
                resumePermanentGrant(
                    { permanentGrantId: seeded.grantId, actor: actor(s.signer, false) },
                    p.value
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            expect(p.providerCalls()).toBe(0);
            await expect(
                resumePermanentGrant(
                    { permanentGrantId: seeded.grantId, actor: actor(s.other) },
                    p.value
                )
            ).resolves.toMatchObject({ permanentGrantId: seeded.grantId });
        });
        it('m — the grant beneficiary cannot resume themself', async () => {
            const s = await setup();
            const seeded = await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: s.beneficiary,
                grantedBy: s.other,
                anchors: [{ vertical: VerticalEnum.ACCOMMODATION }]
            });
            await expect(
                resumePermanentGrant(
                    { permanentGrantId: seeded.grantId, actor: actor(s.beneficiary) },
                    ports().value
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
        });
        it('n — ACC_2 resolves to exactly the complimentary grant permission', async () => {
            expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_2.permissions).toEqual([
                PermissionEnum.BILLING_GRANT_COMPLIMENTARY
            ]);
        });
    }
);
