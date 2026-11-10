import {
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { cancelPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-cancel.service.js';
import {
    getPlanMigrationDetail,
    listPlanMigrations
} from '../../../src/services/billing/plan-migration/plan-migration-read.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupAnnouncedExitCases,
    createAnnouncedExitCase
} from './support/plan-migration-exit-fixtures.js';

const db = getServiceTestDb();
const recipients: string[] = [];
const readClock = { now: () => new Date('2026-10-23T13:00:00.000Z') };

// The shared fixture seeds catalog versions and users; subscriptions start through startSubscription,
// while preview and launch create each migration and its scope through the real services.

afterEach(async () => {
    if (recipients.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, recipients.splice(0)));
    await cleanupAnnouncedExitCases();
});
afterAll(closeServiceTestPool);

async function rememberRecipients(migrationId: string): Promise<void> {
    const rows = await db
        .select({ userId: subscriptions.userId })
        .from(planMigrationSubscriptions)
        .innerJoin(subscriptions, eq(subscriptions.id, planMigrationSubscriptions.subscriptionId))
        .where(eq(planMigrationSubscriptions.planMigrationId, migrationId));
    for (const row of rows) {
        if (!row.userId) throw new Error('Migration recipient missing');
        recipients.push(row.userId);
    }
}

async function planName(versionId: string): Promise<string> {
    const [row] = await db
        .select({ name: plans.name })
        .from(planVersions)
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(planVersions.id, versionId));
    if (!row) throw new Error('Seeded plan name missing');
    return row.name;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:6 AC:B12:6 y el panel la lista sin plazo y con su antigüedad desde el anuncio',
    () => {
        it('returns the complete detail with age only for PARA_RESOLVER after twelve local days', async () => {
            const fixture = await createAnnouncedExitCase({ addUnresolvedCustomer: true });
            await rememberRecipients(fixture.migrationId);
            if (!fixture.unresolvedCustomer) throw new Error('Unresolved customer missing');
            const [persisted] = await db
                .select()
                .from(planMigrations)
                .where(eq(planMigrations.id, fixture.migrationId));
            if (!persisted) throw new Error('Announced migration missing');
            const scope = await db
                .select({
                    id: planMigrationSubscriptions.id,
                    subscriptionId: planMigrationSubscriptions.subscriptionId,
                    ownerUserId: subscriptions.userId,
                    status: planMigrationSubscriptions.status,
                    outReason: planMigrationSubscriptions.outReason,
                    applicationDate: planMigrationSubscriptions.applicationDate,
                    appliedAt: planMigrationSubscriptions.appliedAt
                })
                .from(planMigrationSubscriptions)
                .innerJoin(
                    subscriptions,
                    eq(subscriptions.id, planMigrationSubscriptions.subscriptionId)
                )
                .where(eq(planMigrationSubscriptions.planMigrationId, fixture.migrationId));
            expect(scope).toHaveLength(2);
            const ordered = [...scope].sort(
                (a, b) =>
                    Number(b.status === 'PARA_RESOLVER') - Number(a.status === 'PARA_RESOLVER') ||
                    a.id.localeCompare(b.id)
            );
            const detail = await getPlanMigrationDetail(
                { actor: fixture.seeded.actor, planMigrationId: fixture.migrationId, db },
                { clock: readClock }
            );
            expect(detail).toEqual({
                id: fixture.migrationId,
                reason: 'RETIREMENT',
                sourcePlanVersionId: fixture.seeded.planVersionId,
                targetPlanVersionId: fixture.seeded.targetPlanVersionId,
                sourcePlanName: await planName(fixture.seeded.planVersionId),
                targetPlanName: await planName(fixture.seeded.targetPlanVersionId),
                announcedAt: expect.any(Date),
                cancelledAt: null,
                counts: { PENDIENTE: 1, PARA_RESOLVER: 1, APLICADA: 0, FUERA: 0, CANCELADA: 0 },
                noticeDays: persisted.noticeDays,
                deadlineVersion: persisted.deadlineVersion,
                rows: ordered.map((row) => ({
                    id: row.id,
                    subscriptionId: row.subscriptionId,
                    ownerUserId: row.ownerUserId,
                    status: row.status,
                    outReason: null,
                    applicationDate:
                        row.status === 'PARA_RESOLVER'
                            ? null
                            : getLocalDateString({ instant: row.applicationDate }),
                    appliedAt: null,
                    ageDays: row.status === 'PARA_RESOLVER' ? 12 : null
                }))
            });
        });

        it('counts the next local day even when only one hour elapsed', async () => {
            const announceClock = { now: () => new Date('2026-10-12T02:30:00.000Z') };
            const fixture = await createAnnouncedExitCase({
                addUnresolvedCustomer: true,
                clock: announceClock
            });
            await rememberRecipients(fixture.migrationId);
            const detail = await getPlanMigrationDetail(
                { actor: fixture.seeded.actor, planMigrationId: fixture.migrationId, db },
                { clock: { now: () => new Date('2026-10-12T03:30:00.000Z') } }
            );
            expect(detail.rows.map(({ status, ageDays }) => ({ status, ageDays }))).toEqual([
                { status: 'PARA_RESOLVER', ageDays: 1 },
                { status: 'PENDIENTE', ageDays: null }
            ]);
        });

        it('lists each owned migration with all five exact state counts', async () => {
            const fixture = await createAnnouncedExitCase({ addUnresolvedCustomer: true });
            await rememberRecipients(fixture.migrationId);
            const result = await listPlanMigrations({
                actor: fixture.seeded.actor,
                page: 1,
                pageSize: 100,
                db
            });
            const owned = result.items.filter((item) => item.id === fixture.migrationId);
            expect(owned).toHaveLength(1);
            expect(owned[0]?.counts).toEqual({
                PENDIENTE: 1,
                PARA_RESOLVER: 1,
                APLICADA: 0,
                FUERA: 0,
                CANCELADA: 0
            });
        });

        it('paginates three announced migrations in stable announcement order', async () => {
            const announced = [];
            for (const day of [1, 2, 3]) {
                const fixture = await createAnnouncedExitCase({
                    clock: { now: () => new Date(`2027-01-0${day}T13:00:00.000Z`) }
                });
                announced.push(fixture);
                await rememberRecipients(fixture.migrationId);
            }
            const actor = announced[0]?.seeded.actor;
            if (!actor) throw new Error('Pagination actor missing');
            const first = await listPlanMigrations({ actor, page: 1, pageSize: 2, db });
            const second = await listPlanMigrations({ actor, page: 2, pageSize: 2, db });
            const ownedIds = new Set(announced.map((item) => item.migrationId));
            expect(first.items.map((item) => item.id)).toEqual([
                announced[2]?.migrationId,
                announced[1]?.migrationId
            ]);
            expect(
                second.items.filter((item) => ownedIds.has(item.id)).map((item) => item.id)
            ).toEqual([announced[0]?.migrationId]);
            expect(first.pagination.page).toBe(1);
            expect(first.pagination.pageSize).toBe(2);
            expect(second.pagination.page).toBe(2);
        });

        it('shows cancellation time and cancelled scope after the real cancellation service', async () => {
            const fixture = await createAnnouncedExitCase({ addUnresolvedCustomer: true });
            await rememberRecipients(fixture.migrationId);
            await cancelPlanMigration(
                { actor: fixture.seeded.actor, planMigrationId: fixture.migrationId, db },
                { clock: readClock }
            );
            const detail = await getPlanMigrationDetail(
                { actor: fixture.seeded.actor, planMigrationId: fixture.migrationId, db },
                { clock: readClock }
            );
            expect(detail.cancelledAt).toEqual(expect.any(Date));
            expect(detail.counts).toEqual({
                PENDIENTE: 0,
                PARA_RESOLVER: 0,
                APLICADA: 0,
                FUERA: 0,
                CANCELADA: 2
            });
            expect(detail.rows.map(({ status, ageDays }) => ({ status, ageDays }))).toEqual([
                { status: 'CANCELADA', ageDays: null },
                { status: 'CANCELADA', ageDays: null }
            ]);
        });

        it('rejects a missing id and forbids an actor before reading the database', async () => {
            const fixture = await createAnnouncedExitCase();
            await rememberRecipients(fixture.migrationId);
            await expect(
                getPlanMigrationDetail(
                    { actor: fixture.seeded.actor, planMigrationId: crypto.randomUUID(), db },
                    { clock: readClock }
                )
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_NOT_FOUND' });
            await expect(
                getPlanMigrationDetail(
                    {
                        actor: { ...fixture.seeded.actor, permissions: [] },
                        planMigrationId: fixture.migrationId,
                        db
                    },
                    { clock: readClock }
                )
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            await expect(
                listPlanMigrations({
                    actor: { ...fixture.seeded.actor, permissions: [] },
                    page: 0,
                    db
                })
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        });
    }
);
