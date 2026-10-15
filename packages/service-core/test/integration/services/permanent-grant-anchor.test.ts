import { eq, permanentGrants, permanentGrantVerticals, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { realCoverage } from './support/coverage-notice-fixtures.js';
import {
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';

afterAll(closeServiceTestPool);
const userIds: string[] = [];
const V1 = VerticalEnum.ACCOMMODATION;
const V2 = VerticalEnum.GASTRONOMY;
const now = new Date('2026-10-14T12:00:00.000Z');
afterEach(async () => retirePermanentGrantRows(userIds.splice(0)));

async function setup() {
    return getServiceTestDb().transaction(async (tx) => {
        const { userId } = await seedCoverageUser(tx);
        const { userId: adminId } = await seedCoverageUser(tx);
        userIds.push(userId, adminId);
        const anchor = await seedGrantPlan(tx, V1);
        const added = await seedGrantPlan(tx, V2);
        return { userId, adminId, anchor, added };
    });
}

function ports(
    onNotice: (event: {
        userId: string;
        vertical: string;
        sourceType: string;
        change: string;
    }) => Promise<void> = async () => undefined
) {
    const clock = { now: () => now };
    return {
        clock,
        provider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: onNotice },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('no listing addon seeded');
            }
        }
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:2 — anchoring a new vertical is the same act, and both writes emit the coverage notice (AC:B9a:2)',
    () => {
        it('a — anchoring V2 cancels its new live row and leaves the existing V1 coverage alone', async () => {
            const s = await setup();
            const created = await grantPermanentGrant(
                {
                    beneficiaryUserId: s.userId,
                    actor: grantSignerActor(s.adminId),
                    reason: 'anchor test',
                    includesAddons: false,
                    anchors: [{ vertical: V1, ...s.anchor }]
                },
                ports()
            );
            const rows = await getServiceTestDb().transaction(async (tx) => {
                const p1 = await seedCoveragePlanVersion(tx, V1);
                const p2 = await seedCoveragePlanVersion(tx, V2);
                const v1 = await seedCoverageSubscription(tx, {
                    userId: s.userId,
                    vertical: V1,
                    ...p1,
                    status: 'ACTIVE'
                });
                const v2 = await seedCoverageSubscription(tx, {
                    userId: s.userId,
                    vertical: V2,
                    ...p2,
                    status: 'ACTIVE'
                });
                return { v1, v2 };
            });
            const result = await anchorPermanentGrantVertical(
                {
                    permanentGrantId: created.permanentGrantId,
                    actor: grantSignerActor(s.adminId),
                    vertical: V2,
                    ...s.added
                },
                ports()
            );
            expect(result.cancelledSubscriptionIds).toEqual([rows.v2.subscriptionId]);
            const [one] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, rows.v1.subscriptionId));
            const [two] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, rows.v2.subscriptionId));
            expect(one?.status).toBe('ACTIVE');
            expect(two?.status).toBe('CANCELLED');
        });

        it('b — notices are emitted after commit and each reread sees committed state', async () => {
            const s = await setup();
            const notices: Array<{
                sourceType: string;
                change: string;
                vertical: string;
                observed: string | null;
            }> = [];
            const noticePorts = ports(async (event) => {
                const row = await getServiceTestPool().query<{ status: string }>(
                    'SELECT status FROM subscription WHERE user_id = $1 AND vertical = $2 ORDER BY id LIMIT 1',
                    [event.userId, event.vertical]
                );
                notices.push({ ...event, observed: row.rows[0]?.status ?? null });
            });
            await getServiceTestDb().transaction(async (tx) => {
                const p = await seedCoveragePlanVersion(tx, V1);
                await seedCoverageSubscription(tx, {
                    userId: s.userId,
                    vertical: V1,
                    ...p,
                    status: 'ACTIVE'
                });
            });
            const created = await grantPermanentGrant(
                {
                    beneficiaryUserId: s.userId,
                    actor: grantSignerActor(s.adminId),
                    reason: 'notice test',
                    includesAddons: false,
                    anchors: [{ vertical: V1, ...s.anchor }]
                },
                noticePorts
            );
            expect(notices).toEqual([
                expect.objectContaining({
                    sourceType: 'GRANT',
                    change: 'ADDED',
                    vertical: V1,
                    observed: 'CANCELLED'
                }),
                expect.objectContaining({
                    sourceType: 'SUBSCRIPTION',
                    change: 'REMOVED',
                    vertical: V1,
                    observed: 'CANCELLED'
                })
            ]);
            notices.length = 0;
            await anchorPermanentGrantVertical(
                {
                    permanentGrantId: created.permanentGrantId,
                    actor: grantSignerActor(s.adminId),
                    vertical: V2,
                    ...s.added
                },
                noticePorts
            );
            expect(notices).toEqual([
                expect.objectContaining({ sourceType: 'GRANT', change: 'ADDED', vertical: V2 })
            ]);
        });

        it('c — anchoring with no subscription still emits GRANT ADDED', async () => {
            const s = await setup();
            const created = await grantPermanentGrant(
                {
                    beneficiaryUserId: s.userId,
                    actor: grantSignerActor(s.adminId),
                    reason: 'empty anchor',
                    includesAddons: false,
                    anchors: [{ vertical: V1, ...s.anchor }]
                },
                ports()
            );
            const seen: string[] = [];
            await anchorPermanentGrantVertical(
                {
                    permanentGrantId: created.permanentGrantId,
                    actor: grantSignerActor(s.adminId),
                    vertical: V2,
                    ...s.added
                },
                ports(async (event) => {
                    seen.push(`${event.sourceType}:${event.change}:${event.vertical}`);
                })
            );
            expect(seen).toEqual([`GRANT:ADDED:${V2}`]);
        });

        it('e — missing, revoked and already anchored grants reject without a new anchor', async () => {
            const s = await setup();
            const created = await grantPermanentGrant(
                {
                    beneficiaryUserId: s.userId,
                    actor: grantSignerActor(s.adminId),
                    reason: 'reject test',
                    includesAddons: false,
                    anchors: [{ vertical: V1, ...s.anchor }]
                },
                ports()
            );
            const revoked = await getServiceTestDb()
                .update(permanentGrants)
                .set({ revokedAt: now, revokedBy: s.adminId, revocationReason: 'test revocation' })
                .where(eq(permanentGrants.id, created.permanentGrantId))
                .returning();
            expect(revoked).toHaveLength(1);
            await expect(
                anchorPermanentGrantVertical(
                    {
                        permanentGrantId: created.permanentGrantId,
                        actor: grantSignerActor(s.adminId),
                        vertical: V2,
                        ...s.added
                    },
                    ports()
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_LIVE' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(permanentGrantVerticals)
                    .where(eq(permanentGrantVerticals.permanentGrantId, created.permanentGrantId))
            ).toHaveLength(1);
            const live = await grantPermanentGrant(
                {
                    beneficiaryUserId: (await setup()).userId,
                    actor: grantSignerActor(s.adminId),
                    reason: 'already anchored',
                    includesAddons: false,
                    anchors: [{ vertical: V1, ...s.anchor }]
                },
                ports()
            );
            await expect(
                anchorPermanentGrantVertical(
                    {
                        permanentGrantId: live.permanentGrantId,
                        actor: grantSignerActor(s.adminId),
                        vertical: V1,
                        ...s.anchor
                    },
                    ports()
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED' });
            await expect(
                anchorPermanentGrantVertical(
                    {
                        permanentGrantId: crypto.randomUUID(),
                        actor: grantSignerActor(s.adminId),
                        vertical: V2,
                        ...s.added
                    },
                    ports()
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_FOUND' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(permanentGrantVerticals)
                    .where(eq(permanentGrantVerticals.permanentGrantId, live.permanentGrantId))
            ).toHaveLength(1);
        });

        it('f — an unanchored vertical has no GRANT coverage source yet', async () => {
            const s = await setup();
            await grantPermanentGrant(
                {
                    beneficiaryUserId: s.userId,
                    actor: grantSignerActor(s.adminId),
                    reason: 'source check',
                    includesAddons: false,
                    anchors: [{ vertical: V1, ...s.anchor }]
                },
                ports()
            );
            const coverage = realCoverage({ now: () => now });
            const answer = await coverage.coverage({ userId: s.userId, vertical: V2 });
            expect(answer.sources.some((source) => source.type === 'GRANT')).toBe(false);
        });
    }
);
