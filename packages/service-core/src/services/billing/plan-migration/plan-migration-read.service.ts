import {
    asc,
    count,
    type DrizzleClient,
    desc,
    eq,
    getDb,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    plans,
    planVersions,
    sql,
    subscriptions
} from '@repo/db';
import {
    type PlanMigrationDetail,
    PlanMigrationDetailSchema,
    type PlanMigrationList,
    PlanMigrationListQuerySchema,
    PlanMigrationListSchema
} from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import {
    assertPlanMigrationActionPermitted,
    planMigrationRejection
} from './plan-migration-authorization.js';

const sourceVersion = alias(planVersions, 'migration_source_version');
const targetVersion = alias(planVersions, 'migration_target_version');
const sourcePlan = alias(plans, 'migration_source_plan');
const targetPlan = alias(plans, 'migration_target_plan');

const migrationColumns = {
    id: planMigrations.id,
    reason: planMigrations.reason,
    sourcePlanVersionId: planMigrations.sourcePlanVersionId,
    targetPlanVersionId: planMigrations.targetPlanVersionId,
    sourcePlanName: sourcePlan.name,
    targetPlanName: targetPlan.name,
    announcedAt: planMigrations.announcedAt,
    cancelledAt: planMigrations.cancelledAt
};

function migrationNames<T extends DrizzleClient>(db: T) {
    return db
        .select(migrationColumns)
        .from(planMigrations)
        .innerJoin(sourceVersion, eq(sourceVersion.id, planMigrations.sourcePlanVersionId))
        .innerJoin(sourcePlan, eq(sourcePlan.id, sourceVersion.planId))
        .innerJoin(targetVersion, eq(targetVersion.id, planMigrations.targetPlanVersionId))
        .innerJoin(targetPlan, eq(targetPlan.id, targetVersion.planId));
}

type ScopeCount = { planMigrationId: string; status: string; total: number };

function countsFor(args: { readonly migrationId: string; readonly rows: readonly ScopeCount[] }) {
    const counts = { PENDIENTE: 0, PARA_RESOLVER: 0, APLICADA: 0, FUERA: 0, CANCELADA: 0 };
    for (const row of args.rows) {
        if (row.planMigrationId !== args.migrationId) continue;
        if (row.status in counts) counts[row.status as keyof typeof counts] = row.total;
    }
    return counts;
}

function localDayNumber(date: string): number {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}

/** List action 17 migrations in stable announcement order with one grouped count query. */
export async function listPlanMigrations(input: {
    readonly actor?: Actor;
    readonly page?: unknown;
    readonly pageSize?: unknown;
    readonly db?: DrizzleClient;
}): Promise<PlanMigrationList> {
    assertPlanMigrationActionPermitted({ actor: input.actor });
    const parsed = PlanMigrationListQuerySchema.safeParse({
        page: input.page,
        pageSize: input.pageSize
    });
    if (!parsed.success)
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Invalid plan migration pagination.'
        });
    const { page, pageSize } = parsed.data;
    const db = input.db ?? getDb();
    const [totalRow] = await db.select({ total: count() }).from(planMigrations);
    const migrations = await migrationNames(db)
        .orderBy(desc(planMigrations.announcedAt), asc(planMigrations.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    const ids = migrations.map((migration) => migration.id);
    const groupedCounts: ScopeCount[] =
        ids.length === 0
            ? []
            : await db
                  .select({
                      planMigrationId: planMigrationSubscriptions.planMigrationId,
                      status: planMigrationSubscriptions.status,
                      total: sql<number>`count(*)::int`
                  })
                  .from(planMigrationSubscriptions)
                  .where(inArray(planMigrationSubscriptions.planMigrationId, ids))
                  .groupBy(
                      planMigrationSubscriptions.planMigrationId,
                      planMigrationSubscriptions.status
                  );
    const total = totalRow?.total ?? 0;
    return PlanMigrationListSchema.parse({
        items: migrations.map((migration) => ({
            ...migration,
            counts: countsFor({ migrationId: migration.id, rows: groupedCounts })
        })),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
}

/** Read one action 17 migration with unresolved age measured in local calendar days. */
export async function getPlanMigrationDetail(
    input: {
        readonly actor?: Actor;
        readonly planMigrationId: unknown;
        readonly db?: DrizzleClient;
    },
    ports: { readonly clock: { readonly now: () => Date } }
): Promise<PlanMigrationDetail> {
    assertPlanMigrationActionPermitted({ actor: input.actor });
    const parsed = z.string().uuid().safeParse(input.planMigrationId);
    if (!parsed.success)
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Invalid plan migration id.'
        });
    const db = input.db ?? getDb();
    const [migration] = await migrationNames(db).where(eq(planMigrations.id, parsed.data));
    if (!migration)
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_NOT_FOUND',
            message: 'Plan migration not found.'
        });
    const [metadata] = await db
        .select({
            noticeDays: planMigrations.noticeDays,
            deadlineVersion: planMigrations.deadlineVersion
        })
        .from(planMigrations)
        .where(eq(planMigrations.id, parsed.data));
    if (!metadata) throw new Error('Migration metadata disappeared during read');
    const [groupedCounts, rows] = await Promise.all([
        db
            .select({
                planMigrationId: planMigrationSubscriptions.planMigrationId,
                status: planMigrationSubscriptions.status,
                total: sql<number>`count(*)::int`
            })
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, migration.id))
            .groupBy(planMigrationSubscriptions.planMigrationId, planMigrationSubscriptions.status),
        db
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
            .where(eq(planMigrationSubscriptions.planMigrationId, migration.id))
            .orderBy(
                sql`case when ${planMigrationSubscriptions.status} = 'PARA_RESOLVER' then 0 else 1 end`,
                asc(planMigrationSubscriptions.status),
                asc(planMigrationSubscriptions.id)
            )
    ]);
    const today = localDayNumber(getLocalDateString({ instant: ports.clock.now() }));
    const announced = localDayNumber(getLocalDateString({ instant: migration.announcedAt }));
    return PlanMigrationDetailSchema.parse({
        ...migration,
        ...metadata,
        counts: countsFor({ migrationId: migration.id, rows: groupedCounts }),
        rows: rows.map((row) => ({
            id: row.id,
            subscriptionId: row.subscriptionId,
            ownerUserId: row.ownerUserId,
            status: row.status,
            outReason: row.outReason,
            applicationDate:
                row.status === 'PARA_RESOLVER'
                    ? null
                    : getLocalDateString({ instant: row.applicationDate }),
            appliedAt: row.appliedAt,
            ageDays: row.status === 'PARA_RESOLVER' ? today - announced : null
        }))
    });
}
