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

/** Stable actor ID used by the mock authentication headers and audit assertions. */
export const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
/** Permissions granted to the super admin in publication tests. */
export const SUPER_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.MAINTENANCE_MODE_WRITE
];
/** Permissions granted to the regular admin in rejection tests. */
export const OTHER_PERMISSIONS = [PermissionEnum.ACCESS_PANEL_ADMIN];

/**
 * Builds mock-actor headers read by the API under `HOSPEDA_ALLOW_MOCK_ACTOR`.
 * @param args - Role and permissions assigned to the mock actor.
 * @returns JSON request headers with the mock actor identity and permissions.
 */
export function headers(args: { role: RoleEnum; permissions: PermissionEnum[] }) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': args.role,
        'x-mock-actor-permissions': JSON.stringify(args.permissions)
    };
}

/** Request headers for a super admin allowed to publish plans. */
export const superAdmin = headers({ role: RoleEnum.SUPER_ADMIN, permissions: SUPER_PERMISSIONS });
/** Request headers for an admin without publication permission. */
export const otherAdmin = headers({ role: RoleEnum.ADMIN, permissions: OTHER_PERMISSIONS });

/** Default content shared by preview and publication request bodies. */
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

/**
 * Inserts a plan fixture.
 * @param args - Vertical, slug and optional role for the plan.
 * @returns The ID of the inserted plan.
 */
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

/**
 * Inserts a version and its effects in one transaction, as extras 041 requires.
 * @param args - Plan version fields and optional entitlements and limits.
 * @returns The ID of the inserted version.
 */
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

/**
 * Reads a version's stored entitlements and limits for the trial rule.
 * @param args - ID of the version to inspect.
 * @returns Stored entitlement keys and limit keys.
 */
export async function readVersionEffects(args: { versionId: string }): Promise<{
    entitlements: { key: string }[];
    limits: { key: string }[];
}> {
    const entitlements = await getDb()
        .select({ key: planVersionEntitlements.key })
        .from(planVersionEntitlements)
        .where(eq(planVersionEntitlements.planVersionId, args.versionId));
    const limits = await getDb()
        .select({ key: planVersionLimits.key })
        .from(planVersionLimits)
        .where(eq(planVersionLimits.planVersionId, args.versionId));
    return { entitlements, limits };
}

/**
 * Builds a confirmed publication request body from the default content.
 * @param args - Content fields that override the defaults.
 * @returns The serialized publication request body.
 */
export function publishBody(args: { overrides: Record<string, unknown> }): string {
    return JSON.stringify({ ...BASE_CONTENT, ...args.overrides, confirmed: true });
}

/**
 * Builds a preview request body from the default content.
 * @param args - Content fields that override the defaults.
 * @returns The serialized preview request body.
 */
export function previewBody(args: { overrides: Record<string, unknown> }): string {
    return JSON.stringify({ ...BASE_CONTENT, ...args.overrides });
}

/**
 * Builds the publication endpoint URL for a plan.
 * @param args - ID of the plan to publish.
 * @returns The plan's publication endpoint URL.
 */
export const publishUrl = (args: { planId: string }): string =>
    `/api/v1/admin/plan-catalog/plans/${args.planId}/versions`;
/**
 * Builds the preview endpoint URL for a plan.
 * @param args - ID of the plan to preview.
 * @returns The plan's preview endpoint URL.
 */
export const previewUrl = (args: { planId: string }): string =>
    `/api/v1/admin/plan-catalog/plans/${args.planId}/versions/preview`;
/** Endpoint URL for creating a plan. */
export const createPlanUrl = '/api/v1/admin/plan-catalog/plans';

/**
 * Empties the plan catalog between tests.
 * @returns A promise that resolves after the catalog has been truncated.
 */
export async function truncatePlanCatalog(): Promise<void> {
    await getDb().execute(
        sql`TRUNCATE TABLE plan_version_entitlement, plan_version_limit, billing_option, plan_version, plan CASCADE`
    );
}
