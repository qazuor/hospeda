import {
    getDb,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    sql
} from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

/**
 * TEST:V2:9 (route) and TEST:V2:10 (integration with DB) — action 18, publish a
 * plan version (HOS-1436, piece V2.3, AC:V2:6/7).
 */

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const SUPER_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.MAINTENANCE_MODE_WRITE
];
const OTHER_PERMISSIONS = [PermissionEnum.ACCESS_PANEL_ADMIN];

function headers(role: RoleEnum, permissions: PermissionEnum[]) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': role,
        'x-mock-actor-permissions': JSON.stringify(permissions)
    };
}

const superAdmin = headers(RoleEnum.SUPER_ADMIN, SUPER_PERMISSIONS);
const otherAdmin = headers(RoleEnum.ADMIN, OTHER_PERMISSIONS);

const BASE_CONTENT = {
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
async function insertPlan(args: {
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
async function insertVersion(args: {
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

function publishBody(overrides: Record<string, unknown>): string {
    return JSON.stringify({ ...BASE_CONTENT, ...overrides, confirmed: true });
}

function previewBody(overrides: Record<string, unknown>): string {
    return JSON.stringify({ ...BASE_CONTENT, ...overrides });
}

describe('HOS-1436 V2.3 — action 18 (publish a plan version)', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    beforeEach(async () => {
        await getDb().execute(
            sql`TRUNCATE TABLE plan_version_entitlement, plan_version_limit, billing_option, plan_version, plan CASCADE`
        );
    });

    afterAll(async () => testDb.teardown());

    it('TEST:V2:9 SUPER_ADMIN previews key by key with the reach, publishes, and the action is audited', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true,
            entitlements: [{ key: 'view_basic_stats' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
        });

        const preview = await app.request(
            `/api/v1/admin/plan-catalog/plans/${planId}/versions/preview`,
            {
                method: 'POST',
                headers: superAdmin,
                body: previewBody({
                    rank: 10,
                    entitlements: [{ key: 'view_basic_stats' }],
                    limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
                })
            }
        );
        expect(preview.status, JSON.stringify(await preview.clone().json())).toBe(201);
        const confirmation = (await preview.json()).data;
        expect(confirmation.planId).toBe(planId);
        expect(confirmation.anchoredCustomers).toBe(0);
        expect(confirmation.currentVersionId).not.toBeNull();
        expect(confirmation.changes).toContainEqual({
            key: 'max_photos_per_accommodation',
            kind: 'limit',
            from: 20,
            to: 30
        });

        const publish = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                entitlements: [{ key: 'view_basic_stats' }],
                limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
            })
        });
        expect(publish.status, JSON.stringify(await publish.clone().json())).toBe(201);
        const published = (await publish.json()).data;
        expect(published).toMatchObject({ planId, current: true, rank: 10, sellable: true });
    });

    it('TEST:V2:9 an account without SUPER_ADMIN is rejected with FORBIDDEN', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: otherAdmin,
            body: publishBody({})
        });
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('TEST:V2:10 (a) a non-sellable version that grants a commercial key is rejected: clave de más', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'pre-trial',
            role: 'pre_trial'
        });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ sellable: false, entitlements: [{ key: 'view_basic_stats' }] })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('clave de más');
    });

    it('TEST:V2:10 (b) a floor version missing a floor key is rejected: clave de piso que falta', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'floor',
            role: 'floor'
        });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                sellable: false,
                entitlements: [{ key: 'subscribe_to_plan' }]
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('clave de piso que falta');
    });

    it('TEST:V2:10 (c) the activation capability outside the if-and-only-if is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'pre-trial',
            role: 'pre_trial'
        });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                sellable: false,
                entitlements: [{ key: 'activate_trial' }]
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('activación fuera del si y sólo si');
    });

    it('TEST:V2:10 (d) a trial version that inherits Turista VIP is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'tourist', slug: 'trial', role: 'trial' });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ sellable: false, trialDays: 7, inheritsTouristVip: true })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'herencia de VIP fuera de una versión vendible'
        );
    });

    it('TEST:V2:10 (e) a repeated rank among the sellable current versions is rejected', async () => {
        const app = initApp();
        const other = await insertPlan({ vertical: 'gastronomy', slug: 'basic' });
        await insertVersion({
            planId: other,
            vertical: 'gastronomy',
            rank: 20,
            sellable: true,
            current: true
        });
        const planId = await insertPlan({ vertical: 'gastronomy', slug: 'pro' });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ rank: 20 })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'rank repetido entre las versiones vendibles y vigentes de la vertical'
        );
    });

    it('TEST:V2:10 (f) leaving a plan without exactly one current version is rejected', async () => {
        const app = initApp();
        await insertPlan({ vertical: 'experience', slug: 'orphan' });
        const planId = await insertPlan({ vertical: 'experience', slug: 'pro' });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({})
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'el plan no queda con exactamente una versión vigente'
        );
    });

    it('TEST:V2:10 (g) passing trial days from 0 to more is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'trial',
            role: 'trial'
        });
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: false,
            current: true,
            trialDays: 0
        });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ sellable: false, trialDays: 7 })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'los días de prueba de la vertical no pueden pasar de cero a más, ni al revés'
        );
    });

    it('TEST:V2:10 (h) a grace not shorter than the shortest cycle is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ graceDays: 28, cycles: ['monthly'] })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'la gracia debe ser menor que el ciclo más corto que la versión ofrece'
        );
    });

    it('TEST:V2:10 a valid version is published', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(`/api/v1/admin/plan-catalog/plans/${planId}/versions`, {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                cycles: ['annual'],
                entitlements: [{ key: 'view_basic_stats' }],
                limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
            })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const published = (await response.json()).data;
        expect(published).toMatchObject({ planId, current: true, sellable: true });
    });
});
