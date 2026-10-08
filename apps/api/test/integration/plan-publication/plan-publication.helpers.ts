import {
    eq,
    getDb,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    sql
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';

/**
 * Shared fixtures for TEST:V2:9 (route) and TEST:V2:10 (integration with DB) of
 * action 18, publish a plan version (HOS-1436, piece V2.3, AC:V2:6/7).
 */

export const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
export const SUPER_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.MAINTENANCE_MODE_WRITE
];
export const OTHER_PERMISSIONS = [PermissionEnum.ACCESS_PANEL_ADMIN];

/** Mock-actor headers the API reads under `HOSPEDA_ALLOW_MOCK_ACTOR`. */
export function headers(role: RoleEnum, permissions: PermissionEnum[]) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': role,
        'x-mock-actor-permissions': JSON.stringify(permissions)
    };
}

export const superAdmin = headers(RoleEnum.SUPER_ADMIN, SUPER_PERMISSIONS);
export const otherAdmin = headers(RoleEnum.ADMIN, OTHER_PERMISSIONS);

export const BASE_CONTENT = {
    rank: 10,
    sellable: true,
    trialDays: 0,
    graceDays: 5,
    allowsPause: true,
    inheritsTouristVip: false,
    entitlements: [] as { key: string }[],
    limits: [] as { key: string; value: number }[]
};

/** Inserts a plan and returns its id. */
export async function insertPlan(args: {
    vertical: string;
    slug: string;
    role?: string | null;
}): Promise<string> {
    const [row] = await getDb()
        .insert(plans)
        .values({
            vertical: args.vertical,
            slug: args.slug,
            name: `Plan ${args.slug}`,
            role: args.role ?? null
        })
        .returning({ id: plans.id });
    if (!row) throw new Error('no plan');
    return row.id;
}

/** Inserts a version and its effects in ONE transaction (extras 041 requires it). */
export async function insertVersion(args: {
    planId: string;
    vertical: string;
    rank: number;
    sellable: boolean;
    current: boolean;
    trialDays?: number;
    graceDays?: number;
    allowsPause?: boolean;
    inheritsTouristVip?: boolean;
    entitlements?: { key: string; planQuota?: number | null; trialQuota?: number | null }[];
    limits?: { key: string; value: number }[];
}): Promise<string> {
    return getDb().transaction(async (tx) => {
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: args.planId,
                vertical: args.vertical,
                rank: args.rank,
                sellable: args.sellable,
                current: args.current,
                trialDays: args.trialDays ?? 0,
                graceDays: args.graceDays ?? 5,
                allowsPause: args.allowsPause ?? true,
                inheritsTouristVip: args.inheritsTouristVip ?? false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('no version');
        if (args.entitlements?.length) {
            await tx.insert(planVersionEntitlements).values(
                args.entitlements.map((item) => ({
                    planVersionId: version.id,
                    key: item.key,
                    planQuota: item.planQuota ?? null,
                    trialQuota: item.trialQuota ?? null
                }))
            );
        }
        if (args.limits?.length) {
            await tx.insert(planVersionLimits).values(
                args.limits.map((item) => ({
                    planVersionId: version.id,
                    key: item.key,
                    value: item.value
                }))
            );
        }
        return version.id;
    });
}

/** Reads one version's stored entitlements and limits (for the trial rule). */
export async function readVersionEffects(versionId: string): Promise<{
    entitlements: { key: string }[];
    limits: { key: string }[];
}> {
    const entitlements = await getDb()
        .select({ key: planVersionEntitlements.key })
        .from(planVersionEntitlements)
        .where(eq(planVersionEntitlements.planVersionId, versionId));
    const limits = await getDb()
        .select({ key: planVersionLimits.key })
        .from(planVersionLimits)
        .where(eq(planVersionLimits.planVersionId, versionId));
    return { entitlements, limits };
}

export function publishBody(overrides: Record<string, unknown>): string {
    return JSON.stringify({ ...BASE_CONTENT, ...overrides, confirmed: true });
}

export function previewBody(overrides: Record<string, unknown>): string {
    return JSON.stringify({ ...BASE_CONTENT, ...overrides });
}

export const publishUrl = (planId: string): string =>
    `/api/v1/admin/plan-catalog/plans/${planId}/versions`;
export const previewUrl = (planId: string): string =>
    `/api/v1/admin/plan-catalog/plans/${planId}/versions/preview`;
export const createPlanUrl = '/api/v1/admin/plan-catalog/plans';

/** Empties the plan catalog between tests. */
export async function truncatePlanCatalog(): Promise<void> {
    await getDb().execute(
        sql`TRUNCATE TABLE plan_version_entitlement, plan_version_limit, billing_option, plan_version, plan CASCADE`
    );
}
