import { courtesyGrants, eq, permanentGrants } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { runS13InTransaction } from '../../../src/services/billing/grant/permanent-grant-s13.js';
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
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';

afterAll(closeServiceTestPool);
const userIds: string[] = [];
const now = new Date('2026-10-14T12:00:00.000Z');
const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.GASTRONOMY;
afterEach(async () => retirePermanentGrantRows(userIds.splice(0)));

async function seed() {
    return getServiceTestDb().transaction(async (tx) => {
        const { userId } = await seedCoverageUser(tx);
        const { userId: adminId } = await seedCoverageUser(tx);
        userIds.push(userId, adminId);
        const version = await seedCoveragePlanVersion(tx, V);
        const subscription = await seedCoverageSubscription(tx, {
            userId,
            vertical: V,
            ...version,
            status: 'CANCELLED'
        });
        const grantPlan = await seedGrantPlan(tx, V);
        const [courtesy] = await tx
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: userId,
                grantedBy: adminId,
                subscriptionId: subscription.subscriptionId,
                months: 3,
                startsAt: new Date(now.getTime() - 5_000),
                endsAt: new Date(now.getTime() + 86_400_000),
                reason: 'deferred courtesy test',
                balanceMonths: 2
            })
            .returning({ id: courtesyGrants.id });
        if (!courtesy) throw new Error('courtesy fixture missing');
        return {
            userId,
            adminId,
            subscriptionId: subscription.subscriptionId,
            grantPlan,
            courtesyId: courtesy.id
        };
    });
}

function ports() {
    const clock = { now: () => now };
    return {
        clock,
        provider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('no listing addon');
            }
        }
    };
}

async function grant(s: Awaited<ReturnType<typeof seed>>) {
    return grantPermanentGrant(
        {
            beneficiaryUserId: s.userId,
            actor: grantSignerActor(s.adminId),
            reason: 'courtesy grant',
            includesAddons: false,
            anchors: [{ vertical: V, ...s.grantPlan }]
        },
        ports()
    );
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:3 — granting closes a deferred courtesy balance (AC:B9a:3)',
    () => {
        it('a — grant closes the seeded balance without changing balance_months', async () => {
            const s = await seed();
            await grant(s);
            const [row] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, s.courtesyId));
            expect(row).toMatchObject({
                balanceMonths: 2,
                balanceClosedAt: now,
                closeReason: 'GRANT_PERMANENTE_OTORGADO'
            });
        });

        it('b — a balance in a vertical outside the act stays open', async () => {
            const s = await seed();
            const other = await getServiceTestDb().transaction(async (tx) => {
                const plan = await seedCoveragePlanVersion(tx, W);
                const sub = await seedCoverageSubscription(tx, {
                    userId: s.userId,
                    vertical: W,
                    ...plan,
                    status: 'CANCELLED'
                });
                const [row] = await tx
                    .insert(courtesyGrants)
                    .values({
                        beneficiaryUserId: s.userId,
                        grantedBy: s.adminId,
                        subscriptionId: sub.subscriptionId,
                        months: 2,
                        startsAt: now,
                        endsAt: new Date(now.getTime() + 86_400_000),
                        reason: 'other vertical',
                        balanceMonths: 1
                    })
                    .returning({ id: courtesyGrants.id });
                return row?.id;
            });
            await grant(s);
            const [row] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, other ?? ''));
            expect(row?.balanceClosedAt).toBeNull();
        });

        it('c — an already closed courtesy stays untouched and a second S13 pass writes nothing', async () => {
            const s = await seed();
            const [closed] = await getServiceTestDb()
                .update(courtesyGrants)
                .set({ balanceClosedAt: now, closeReason: 'VENTANA_DE_AUTORIZACION_VENCIDA' })
                .where(eq(courtesyGrants.id, s.courtesyId))
                .returning();
            const created = await grant(s);
            const [before] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, s.courtesyId));
            const repeated = await getServiceTestDb().transaction((tx) =>
                runS13InTransaction(
                    {
                        tx,
                        permanentGrantId: created.permanentGrantId,
                        beneficiaryUserId: s.userId,
                        verticals: [V],
                        now: new Date(now.getTime() + 1000),
                        actorId: s.adminId
                    },
                    { orphanhood: ports().orphanhood }
                )
            );
            const [after] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, s.courtesyId));
            expect(closed?.closeReason).toBe('VENTANA_DE_AUTORIZACION_VENCIDA');
            expect(repeated.closedCourtesyIds).toEqual([]);
            expect(after?.balanceClosedAt).toEqual(before?.balanceClosedAt);
        });

        it('d — anchoring W closes that vertical balance', async () => {
            const s = await seed();
            const { permanentGrantId } = await grant(s);
            const plan = await getServiceTestDb().transaction((tx) => seedGrantPlan(tx, W));
            const sub = await getServiceTestDb().transaction(async (tx) => {
                const version = await seedCoveragePlanVersion(tx, W);
                return seedCoverageSubscription(tx, {
                    userId: s.userId,
                    vertical: W,
                    ...version,
                    status: 'CANCELLED'
                });
            });
            const [row] = await getServiceTestDb()
                .insert(courtesyGrants)
                .values({
                    beneficiaryUserId: s.userId,
                    grantedBy: s.adminId,
                    subscriptionId: sub.subscriptionId,
                    months: 2,
                    startsAt: now,
                    endsAt: new Date(now.getTime() + 86_400_000),
                    reason: 'anchor W',
                    balanceMonths: 1
                })
                .returning({ id: courtesyGrants.id });
            const { anchorPermanentGrantVertical } = await import(
                '../../../src/services/billing/grant/permanent-grant.service.js'
            );
            await anchorPermanentGrantVertical(
                { permanentGrantId, actor: grantSignerActor(s.adminId), vertical: W, ...plan },
                ports()
            );
            const [closed] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, row?.id ?? ''));
            expect(closed).toMatchObject({
                balanceClosedAt: now,
                closeReason: 'GRANT_PERMANENTE_OTORGADO'
            });
        });

        it('e — writing revocation fields after closure does not reopen the balance', async () => {
            const s = await seed();
            const result = await grant(s);
            await getServiceTestDb()
                .update(permanentGrants)
                .set({ revokedAt: now, revokedBy: s.adminId, revocationReason: 'manual test' })
                .where(eq(permanentGrants.id, result.permanentGrantId));
            const [row] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, s.courtesyId));
            expect(row).toMatchObject({
                balanceClosedAt: now,
                closeReason: 'GRANT_PERMANENTE_OTORGADO'
            });
        });

        it('f — another beneficiary balance stays open', async () => {
            const s = await seed();
            const other = await seed();
            const [otherCourtesy] = await getServiceTestDb()
                .insert(courtesyGrants)
                .values({
                    beneficiaryUserId: other.userId,
                    grantedBy: other.adminId,
                    subscriptionId: s.subscriptionId,
                    months: 2,
                    startsAt: now,
                    endsAt: new Date(now.getTime() + 86_400_000),
                    reason: 'different beneficiary',
                    balanceMonths: 1
                })
                .returning({ id: courtesyGrants.id });
            await grant(s);
            const [row] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, otherCourtesy?.id ?? ''));
            expect(row?.balanceClosedAt).toBeNull();
        });
    }
);
