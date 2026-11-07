import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    addonInstances,
    courtesyGrants,
    emailOutbox,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    permanentGrants,
    permanentGrantVerticals,
    providerLinks,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { runOrphanhood } from '../../../src/services/billing/addon/addon-instance-a5.js';
import { resolveGrantSources } from '../../../src/services/billing/coverage/grant-sources.js';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import { extractPostgresErrorCause } from '../../../src/utils/postgres-error-cause.js';
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
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';
import {
    createRevokeScenario,
    retireRevokeScenarios,
    revokeNow
} from './support/permanent-grant-revoke-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireRevokeScenarios);
const db = getServiceTestDb;

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:7 — revoking keeps the reason and repairs nothing (AC:B9a:7)',
    () => {
        it('wires the grant-specific A5 clause and S21 cause', () => {
            const source = readFileSync(
                resolve(
                    import.meta.dirname,
                    '../../../src/services/billing/grant/permanent-grant-revoke.ts'
                ),
                'utf8'
            );
            expect(source).toMatch(/clause:\s*'GRANT_REVOKED',[\s\S]*?s21Cause:\s*'GRANT_REVOKED'/);
        });
        it('a,c,d,e,f,i — writes all audit fields, retains rows, and does not repair billing or addons', async () => {
            const s = await createRevokeScenario({ withPrincipal: true });
            if (!s.addon || !s.principalId) throw new Error('fixture missing');
            const beforeLinks = await db()
                .select({ id: providerLinks.id })
                .from(providerLinks)
                .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
                .where(eq(subscriptions.userId, s.userId));
            const beforeSubs = await db()
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(eq(subscriptions.userId, s.userId));
            const authorize = vi.spyOn(s.fake, 'authorize');
            const approve = vi.spyOn(s.fake, 'approve');
            const resume = vi.spyOn(s.fake, 'resume');
            const result = await revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: '  deliberate revocation  ',
                    actor: grantSignerActor(s.otherId)
                },
                s.ports
            );
            const [grant] = await db()
                .select()
                .from(permanentGrants)
                .where(eq(permanentGrants.id, s.grant.permanentGrantId));
            expect(grant).toMatchObject({
                revokedAt: revokeNow,
                revokedBy: s.otherId,
                revocationReason: 'deliberate revocation',
                updatedAt: expect.any(Date)
            });
            expect(result).toMatchObject({
                permanentGrantId: s.grant.permanentGrantId,
                revokedAt: revokeNow,
                anchorIds: s.grant.anchorIds,
                revokedVerticals: [s.vertical],
                cancelledAddonInstanceIds: [s.addon.instanceId],
                addonProviderCalls: []
            });
            const anchors = await db()
                .select({ id: permanentGrantVerticals.id })
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.permanentGrantId, s.grant.permanentGrantId));
            expect(anchors.map(({ id }) => id)).toEqual(s.grant.anchorIds);
            const [instance] = await db()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, s.addon.instanceId));
            const [complement] = await db()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, s.addon.complementId));
            expect(instance?.status).toBe('CANCELLED');
            expect(complement?.status).toBe('CANCELLED');
            expect(
                (await resolveGrantSources({ userId: s.userId, vertical: s.vertical })).sources
            ).toEqual([]);
            const subs = await db()
                .select({ id: subscriptions.id, status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.userId, s.userId));
            expect(
                subs.some(({ status }) => LIVE_SUBSCRIPTION_STATUSES.includes(status as never))
            ).toBe(false);
            expect(subs.find(({ id }) => id === s.principalId)?.status).toBe('CANCELLED');
            expect(subs.map(({ id }) => id).sort()).toEqual(beforeSubs.map(({ id }) => id).sort());
            const links = await db()
                .select({ id: providerLinks.id })
                .from(providerLinks)
                .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
                .where(eq(subscriptions.userId, s.userId));
            expect(links.map(({ id }) => id).sort()).toEqual(
                beforeLinks.map(({ id }) => id).sort()
            );
            expect(authorize).not.toHaveBeenCalled();
            expect(approve).not.toHaveBeenCalled();
            expect(resume).not.toHaveBeenCalled();
            await db().transaction(async (tx) => {
                const rerun = await runOrphanhood(
                    { tx, subscriptionId: s.principalId!, now: revokeNow },
                    s.ports.orphanhood
                );
                expect(rerun.cancelled).toEqual([]);
            });
            await expect(
                revokePermanentGrant(
                    {
                        permanentGrantId: s.grant.permanentGrantId,
                        reason: 'again',
                        actor: grantSignerActor(s.otherId)
                    },
                    s.ports
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_LIVE' });
            const [again] = await db()
                .select({ revokedAt: permanentGrants.revokedAt })
                .from(permanentGrants)
                .where(eq(permanentGrants.id, s.grant.permanentGrantId));
            expect(again?.revokedAt).toEqual(revokeNow);
            await expect(
                revokePermanentGrant(
                    {
                        permanentGrantId: crypto.randomUUID(),
                        reason: 'missing',
                        actor: grantSignerActor(s.otherId)
                    },
                    s.ports
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_FOUND' });
        });

        it('b — the database rejects a lone revocation field and a blank reason', async () => {
            const s = await createRevokeScenario({ withAddon: false });
            const other = await createRevokeScenario({ withAddon: false });
            for (const [id, values] of [
                [s.grant.permanentGrantId, { revokedAt: revokeNow }],
                [
                    other.grant.permanentGrantId,
                    { revokedAt: revokeNow, revokedBy: other.otherId, revocationReason: '   ' }
                ]
            ] as const) {
                let error: unknown;
                try {
                    await db()
                        .update(permanentGrants)
                        .set(values)
                        .where(eq(permanentGrants.id, id));
                } catch (caught) {
                    error = caught;
                }
                expect(extractPostgresErrorCause(error)).toMatchObject({
                    code: '23514',
                    constraint: 'ck_permanent_grant_revocation_together'
                });
            }
        });

        it('h — notices follow commit, and A5 failure rolls every local write back', async () => {
            const s = await createRevokeScenario({});
            if (!s.addon) throw new Error('fixture missing');
            s.emitCoverageChanged.mockClear();
            const broken = {
                ...s.ports,
                orphanhood: {
                    ...s.ports.orphanhood,
                    addonPolicy: async (): Promise<never> => {
                        throw new Error('A5 forced failure');
                    }
                }
            };
            await expect(
                revokePermanentGrant(
                    {
                        permanentGrantId: s.grant.permanentGrantId,
                        reason: 'rollback',
                        actor: grantSignerActor(s.otherId)
                    },
                    broken
                )
            ).rejects.toThrow('A5 forced failure');
            const [before] = await db()
                .select({
                    revokedAt: permanentGrants.revokedAt,
                    revokedBy: permanentGrants.revokedBy,
                    revocationReason: permanentGrants.revocationReason
                })
                .from(permanentGrants)
                .where(eq(permanentGrants.id, s.grant.permanentGrantId));
            expect(before).toEqual({ revokedAt: null, revokedBy: null, revocationReason: null });
            const [addon] = await db()
                .select({ status: addonInstances.status })
                .from(addonInstances)
                .where(eq(addonInstances.id, s.addon.instanceId));
            expect(addon?.status).toBe('ACTIVE');
            expect(
                s.emitCoverageChanged.mock.calls.filter(([event]) => event.userId === s.userId)
            ).toHaveLength(0);
            await revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: 'committed',
                    actor: grantSignerActor(s.otherId)
                },
                s.ports
            );
            expect(
                s.emitCoverageChanged.mock.calls.filter(
                    ([event]) =>
                        event.userId === s.userId &&
                        event.sourceType === 'GRANT' &&
                        event.change === 'REMOVED'
                )
            ).toHaveLength(1);
        });

        it('g — a deferred courtesy balance closed by granting stays closed after revocation', async () => {
            const tx = db();
            const user = await seedCoverageUser(tx);
            const admin = await seedCoverageUser(tx);
            const other = await seedCoverageUser(tx);
            const tracked = [user.userId, admin.userId, other.userId];
            try {
                const version = await seedCoveragePlanVersion(tx, VerticalEnum.ACCOMMODATION);
                const subscription = await seedCoverageSubscription(tx, {
                    userId: user.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ...version,
                    status: 'CANCELLED'
                });
                const [courtesy] = await tx
                    .insert(courtesyGrants)
                    .values({
                        beneficiaryUserId: user.userId,
                        grantedBy: admin.userId,
                        subscriptionId: subscription.subscriptionId,
                        months: 3,
                        startsAt: new Date(revokeNow.getTime() - 5000),
                        endsAt: new Date(revokeNow.getTime() + 86400000),
                        reason: 'deferred courtesy',
                        balanceMonths: 2
                    })
                    .returning({ id: courtesyGrants.id });
                if (!courtesy) throw new Error('courtesy missing');
                const fake = new FakePaymentProvider({
                    idNamespace: crypto.randomUUID(),
                    clock: { now: () => revokeNow }
                });
                const ports = {
                    planPolicy: currentFloorPolicy,
                    clock: { now: () => revokeNow },
                    provider: fake,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: addonPolicyFromTx(tx),
                        listing: async () => {
                            throw new Error('no listing');
                        }
                    }
                };
                const plan = await seedGrantPlan(tx, VerticalEnum.ACCOMMODATION);
                const grant = await grantPermanentGrant(
                    {
                        beneficiaryUserId: user.userId,
                        actor: grantSignerActor(admin.userId),
                        reason: 'courtesy',
                        includesAddons: false,
                        anchors: [{ vertical: VerticalEnum.ACCOMMODATION, ...plan }]
                    },
                    ports
                );
                const [closed] = await tx
                    .select()
                    .from(courtesyGrants)
                    .where(eq(courtesyGrants.id, courtesy.id));
                expect(closed?.balanceClosedAt).toEqual(revokeNow);
                await revokePermanentGrant(
                    {
                        permanentGrantId: grant.permanentGrantId,
                        reason: 'revoke',
                        actor: grantSignerActor(other.userId)
                    },
                    ports
                );
                const [after] = await tx
                    .select()
                    .from(courtesyGrants)
                    .where(eq(courtesyGrants.id, courtesy.id));
                expect(after).toMatchObject({
                    balanceMonths: 2,
                    balanceClosedAt: closed?.balanceClosedAt,
                    closeReason: closed?.closeReason
                });
            } finally {
                await tx.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, tracked));
                await tx
                    .delete(courtesyGrants)
                    .where(eq(courtesyGrants.beneficiaryUserId, user.userId));
                await tx.delete(subscriptions).where(eq(subscriptions.userId, user.userId));
                await retirePermanentGrantRows(tracked);
            }
        });
    }
);
