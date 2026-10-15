import {
    and,
    eq,
    inArray,
    isNull,
    permanentGrants,
    permanentGrantVerticals,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import {
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan,
    seedPermanentGrant
} from './support/permanent-grant-fixtures.js';

const users: string[] = [];
const subscriptionsCreated: string[] = [];
const now = new Date('2026-10-14T12:00:00.000Z');
afterAll(closeServiceTestPool);
afterEach(async () => {
    if (subscriptionsCreated.length)
        await getServiceTestDb()
            .delete(subscriptions)
            .where(inArray(subscriptions.id, subscriptionsCreated.splice(0)));
    await retirePermanentGrantRows(users.splice(0));
});
async function fixture() {
    const result = await getServiceTestDb().transaction(async (tx) => {
        const [{ userId: beneficiary }, { userId: signer }] = await Promise.all([
            seedCoverageUser(tx),
            seedCoverageUser(tx)
        ]);
        const planA = await seedGrantPlan(tx, VerticalEnum.ACCOMMODATION);
        const planB = await seedGrantPlan(tx, VerticalEnum.GASTRONOMY);
        const coverageA = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
        const coverageB = await seedCoveragePlanVersion(tx, VerticalEnum.GASTRONOMY);
        const subA = await seedCoverageSubscription(tx, {
            userId: beneficiary,
            vertical: VerticalEnum.ACCOMMODATION,
            ...coverageA,
            status: 'ACTIVE'
        });
        const subB = await seedCoverageSubscription(tx, {
            userId: beneficiary,
            vertical: VerticalEnum.GASTRONOMY,
            ...coverageB,
            status: 'ACTIVE'
        });
        return {
            beneficiary,
            signer,
            planA,
            planB,
            subA: subA.subscriptionId,
            subB: subB.subscriptionId
        };
    });
    users.push(result.beneficiary, result.signer);
    subscriptionsCreated.push(result.subA, result.subB);
    return result;
}
function makePorts() {
    let calls = 0;
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => now }
    });
    const provider = new Proxy(fake, {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver) as unknown;
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
                calls++;
                return (value as (...a: unknown[]) => unknown).apply(target, args);
            };
        }
    });
    let notices = 0;
    return {
        calls: () => calls,
        notices: () => notices,
        ports: {
            clock: { now: () => now },
            provider,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
            coverageNotices: {
                emitCoverageChanged: async () => {
                    notices++;
                }
            },
            orphanhood: {
                addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                listing: async () => {
                    throw new Error('no listing addon seeded');
                }
            }
        }
    };
}
function input(
    f: Awaited<ReturnType<typeof fixture>>,
    vertical: string,
    plan: typeof f.planA,
    actor: Actor = grantSignerActor(f.signer)
) {
    return {
        beneficiaryUserId: f.beneficiary,
        actor,
        reason: 'unique test',
        includesAddons: false,
        anchors: [{ vertical, ...plan }]
    };
}
async function liveCount(userId: string) {
    return (
        await getServiceTestDb()
            .select({ id: permanentGrants.id })
            .from(permanentGrants)
            .where(
                and(
                    eq(permanentGrants.beneficiaryUserId, userId),
                    isNull(permanentGrants.revokedAt)
                )
            )
    ).length;
}
describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:8 — at most one live grant per beneficiary, by the database (AC:B9a:8)',
    () => {
        it('a — a second live grant is rejected by the database, mapped to PERMANENT_GRANT_ALREADY_LIVE, and cancels nothing', async () => {
            const f = await fixture();
            await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: f.beneficiary,
                grantedBy: f.signer,
                revoked: true,
                anchors: [{ vertical: VerticalEnum.EXPERIENCE }]
            });
            await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: f.beneficiary,
                grantedBy: f.signer,
                revoked: true,
                anchors: [{ vertical: VerticalEnum.TOURIST }]
            });
            const p = makePorts();
            const first = await grantPermanentGrant(
                input(f, VerticalEnum.ACCOMMODATION, f.planA),
                p.ports
            );
            const anchorCount = (
                await getServiceTestDb()
                    .select({ id: permanentGrantVerticals.id })
                    .from(permanentGrantVerticals)
                    .where(eq(permanentGrantVerticals.permanentGrantId, first.permanentGrantId))
            ).length;
            const callsBefore = p.calls();
            const noticesBefore = p.notices();
            await expect(
                grantPermanentGrant(input(f, VerticalEnum.GASTRONOMY, f.planB), p.ports)
            ).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'PERMANENT_GRANT_ALREADY_LIVE'
            });
            expect(await liveCount(f.beneficiary)).toBe(1);
            expect(
                (
                    await getServiceTestDb()
                        .select({ id: permanentGrantVerticals.id })
                        .from(permanentGrantVerticals)
                        .where(eq(permanentGrantVerticals.permanentGrantId, first.permanentGrantId))
                ).length
            ).toBe(anchorCount);
            expect(
                (
                    await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, f.subB))
                )[0]?.status
            ).toBe('ACTIVE');
            expect(p.calls()).toBe(callsBefore);
            expect(p.notices()).toBe(noticesBefore);
        });
        it('b — revoked grants do not count: with only revoked grants a new live one is written', async () => {
            const f = await fixture();
            await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: f.beneficiary,
                grantedBy: f.signer,
                revoked: true,
                anchors: [{ vertical: VerticalEnum.EXPERIENCE }]
            });
            await seedPermanentGrant(getServiceTestDb(), {
                beneficiaryUserId: f.beneficiary,
                grantedBy: f.signer,
                revoked: true,
                anchors: [{ vertical: VerticalEnum.TOURIST }]
            });
            const result = await grantPermanentGrant(
                input(f, VerticalEnum.ACCOMMODATION, f.planA),
                makePorts().ports
            );
            expect(result.permanentGrantId).toBeTruthy();
            expect(await liveCount(f.beneficiary)).toBe(1);
        });
        it('c — the service writes no grant without an anchor or with duplicate vertical anchors (H18)', async () => {
            const f = await fixture();
            const p = makePorts();
            await expect(
                grantPermanentGrant(
                    { ...input(f, VerticalEnum.ACCOMMODATION, f.planA), anchors: [] },
                    p.ports
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'INVALID_PERMANENT_GRANT_INPUT'
            });
            await expect(
                grantPermanentGrant(
                    {
                        ...input(f, VerticalEnum.ACCOMMODATION, f.planA),
                        anchors: [
                            { vertical: VerticalEnum.ACCOMMODATION, ...f.planA },
                            { vertical: VerticalEnum.ACCOMMODATION, ...f.planA }
                        ]
                    },
                    p.ports
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'INVALID_PERMANENT_GRANT_INPUT'
            });
            expect(
                await getServiceTestDb()
                    .select({ id: permanentGrants.id })
                    .from(permanentGrants)
                    .where(eq(permanentGrants.beneficiaryUserId, f.beneficiary))
            ).toHaveLength(0);
        });
        it('d — an anchor the database refuses rolls the whole grant back', async () => {
            const f = await fixture();
            const p = makePorts();
            await expect(
                grantPermanentGrant(
                    {
                        ...input(f, VerticalEnum.ACCOMMODATION, f.planA),
                        anchors: [
                            { vertical: VerticalEnum.ACCOMMODATION, ...f.planA },
                            { vertical: VerticalEnum.GASTRONOMY, ...f.planA }
                        ]
                    },
                    p.ports
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'PERMANENT_GRANT_REFERENCE_NOT_FOUND'
            });
            const wrongFloor = await seedGrantPlan(getServiceTestDb(), VerticalEnum.ACCOMMODATION);
            await expect(
                grantPermanentGrant(
                    {
                        ...input(f, VerticalEnum.ACCOMMODATION, f.planA),
                        anchors: [
                            { vertical: VerticalEnum.ACCOMMODATION, ...f.planA },
                            {
                                vertical: VerticalEnum.GASTRONOMY,
                                planId: f.planB.planId,
                                floorPlanVersionId: wrongFloor.floorPlanVersionId
                            }
                        ]
                    },
                    p.ports
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'PERMANENT_GRANT_REFERENCE_NOT_FOUND'
            });
            expect(
                await getServiceTestDb()
                    .select({ id: permanentGrants.id })
                    .from(permanentGrants)
                    .where(eq(permanentGrants.beneficiaryUserId, f.beneficiary))
            ).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select({ id: permanentGrantVerticals.id })
                    .from(permanentGrantVerticals)
                    .innerJoin(
                        permanentGrants,
                        eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
                    )
                    .where(eq(permanentGrants.beneficiaryUserId, f.beneficiary))
            ).toHaveLength(0);
            expect(
                (
                    await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, f.subA))
                )[0]?.status
            ).toBe('ACTIVE');
        });
        it('e — a beneficiary that does not exist is a typed rejection', async () => {
            const f = await fixture();
            await expect(
                grantPermanentGrant(
                    {
                        ...input(f, VerticalEnum.ACCOMMODATION, f.planA),
                        beneficiaryUserId: crypto.randomUUID()
                    },
                    makePorts().ports
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'PERMANENT_GRANT_REFERENCE_NOT_FOUND'
            });
        });
        it('f — two concurrent grants for the same beneficiary leave exactly one live row', async () => {
            for (let run = 0; run < 5; run++) {
                const f = await fixture();
                const p = makePorts();
                const settled = await Promise.allSettled([
                    grantPermanentGrant(input(f, VerticalEnum.ACCOMMODATION, f.planA), p.ports),
                    grantPermanentGrant(input(f, VerticalEnum.GASTRONOMY, f.planB), p.ports)
                ]);
                expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
                const rejection = settled.find((r) => r.status === 'rejected');
                expect(rejection?.status === 'rejected' ? rejection.reason : null).toMatchObject({
                    code: 'ALREADY_EXISTS',
                    reason: 'PERMANENT_GRANT_ALREADY_LIVE'
                });
                expect(await liveCount(f.beneficiary)).toBe(1);
                const [grant] = await getServiceTestDb()
                    .select({ id: permanentGrants.id })
                    .from(permanentGrants)
                    .where(
                        and(
                            eq(permanentGrants.beneficiaryUserId, f.beneficiary),
                            isNull(permanentGrants.revokedAt)
                        )
                    );
                const [vertical] = await getServiceTestDb()
                    .select({ vertical: permanentGrantVerticals.vertical })
                    .from(permanentGrantVerticals)
                    .where(eq(permanentGrantVerticals.permanentGrantId, grant!.id));
                const loserSubscription =
                    vertical?.vertical === VerticalEnum.ACCOMMODATION ? f.subB : f.subA;
                expect(
                    (
                        await getServiceTestDb()
                            .select({ status: subscriptions.status })
                            .from(subscriptions)
                            .where(eq(subscriptions.id, loserSubscription))
                    )[0]?.status
                ).toBe('ACTIVE');
            }
        });
    }
);
