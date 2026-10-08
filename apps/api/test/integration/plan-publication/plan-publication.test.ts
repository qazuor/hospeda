import { eq, getDb, planVersions } from '@repo/db';
import type { CreateAuditLogEntry } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import {
    __resetAuditLogPersisterForTests,
    registerAuditLogPersister
} from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    ACTOR_ID,
    BASE_CONTENT,
    createPlanUrl,
    insertPlan,
    insertVersion,
    otherAdmin,
    previewBody,
    previewUrl,
    publishBody,
    publishUrl,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

/**
 * TEST:V2:9 (route) — action 18, publish a plan version (HOS-1436, piece V2.3,
 * AC:V2:6): a SUPER_ADMIN previews the key-by-key confirmation, publishes, and
 * the action is audited; another account is rejected. Also covers the plan
 * creation route and the confirmation's deleted-key deltas.
 */
describe('HOS-1436 V2.3 — action 18 (route, TEST:V2:9)', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    beforeEach(async () => truncatePlanCatalog());

    afterEach(() => __resetAuditLogPersisterForTests());

    afterAll(async () => testDb.teardown());

    it('TEST:V2:9 SUPER_ADMIN previews key by key with the reach, publishes, and the action is audited', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const previousVersionId = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true,
            entitlements: [{ key: 'view_basic_stats' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
        });

        const preview = await app.request(previewUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: previewBody({
                overrides: {
                    rank: 20,
                    trialDays: 3,
                    entitlements: [{ key: 'view_basic_stats' }, { key: 'view_advanced_stats' }],
                    limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
                }
            })
        });
        expect(preview.status, JSON.stringify(await preview.clone().json())).toBe(201);
        const confirmation = (await preview.json()).data;
        expect(confirmation.planId).toBe(planId);
        expect(confirmation.anchoredCustomers).toBe(0);
        expect(confirmation.currentVersionId).toBe(previousVersionId);
        // Key by key: a setting, an added entitlement and a changed limit.
        expect(confirmation.changes).toContainEqual({
            key: 'rank',
            kind: 'setting',
            from: 10,
            to: 20
        });
        expect(confirmation.changes).toContainEqual({
            key: 'view_advanced_stats',
            kind: 'entitlement',
            from: null,
            to: { planQuota: null, trialQuota: null }
        });
        expect(confirmation.changes).toContainEqual({
            key: 'max_photos_per_accommodation',
            kind: 'limit',
            from: 20,
            to: 30
        });

        // The preview wrote nothing: still exactly one version, still current.
        const afterPreview = await getDb()
            .select({ id: planVersions.id, current: planVersions.current })
            .from(planVersions)
            .where(eq(planVersions.planId, planId));
        expect(afterPreview).toHaveLength(1);
        expect(afterPreview[0]).toEqual({ id: previousVersionId, current: true });

        // Publishing is audited as a billing mutation of a plan version.
        const persisted: CreateAuditLogEntry[] = [];
        registerAuditLogPersister((record) => persisted.push(record));

        const publish = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    rank: 20,
                    trialDays: 3,
                    entitlements: [{ key: 'view_basic_stats' }, { key: 'view_advanced_stats' }],
                    limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
                }
            })
        });
        expect(publish.status, JSON.stringify(await publish.clone().json())).toBe(201);
        const published = (await publish.json()).data;
        expect(published).toMatchObject({ planId, current: true, rank: 20, sellable: true });

        const audit = persisted.find((record) => record.eventType === 'billing.mutation');
        expect(audit).toBeDefined();
        expect(audit?.data).toMatchObject({
            resourceType: 'plan-version',
            resourceId: published.id,
            actorId: ACTOR_ID
        });
    });

    it('TEST:V2:9 the confirmation reports a deleted entitlement and a deleted limit with `to: null`', async () => {
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

        const preview = await app.request(previewUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: previewBody({
                overrides: {
                    entitlements: [{ key: 'view_advanced_stats' }],
                    limits: []
                }
            })
        });
        expect(preview.status, JSON.stringify(await preview.clone().json())).toBe(201);
        const { changes } = (await preview.json()).data;
        expect(changes).toContainEqual({
            key: 'view_basic_stats',
            kind: 'entitlement',
            from: { planQuota: null, trialQuota: null },
            to: null
        });
        expect(changes).toContainEqual({
            key: 'max_photos_per_accommodation',
            kind: 'limit',
            from: 20,
            to: null
        });
    });

    it('TEST:V2:9 SUPER_ADMIN creates a plan by the admin route', async () => {
        const app = initApp();
        const response = await app.request(createPlanUrl, {
            method: 'POST',
            headers: superAdmin,
            body: JSON.stringify({
                vertical: 'accommodation',
                slug: 'pre-trial',
                name: 'Pre trial',
                role: 'pre_trial'
            })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const created = (await response.json()).data;
        expect(created).toMatchObject({
            vertical: 'accommodation',
            slug: 'pre-trial',
            role: 'pre_trial'
        });
        const rows = await getDb()
            .select({ id: planVersions.id })
            .from(planVersions)
            .where(eq(planVersions.planId, created.id));
        expect(rows).toHaveLength(0);

        const response2 = await app.request(createPlanUrl, {
            method: 'POST',
            headers: otherAdmin,
            body: JSON.stringify({ vertical: 'accommodation', slug: 'other', name: 'Other' })
        });
        expect(response2.status).toBe(403);
        expect((await response2.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('TEST:V2:9 an account without SUPER_ADMIN is rejected with FORBIDDEN', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: otherAdmin,
            body: publishBody({ overrides: {} })
        });
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('TEST:V2:9 publishing without `confirmed: true` is rejected and writes nothing', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const previousVersionId = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true
        });

        for (const raw of [
            JSON.stringify({ ...BASE_CONTENT }),
            JSON.stringify({ ...BASE_CONTENT, confirmed: false })
        ]) {
            const response = await app.request(publishUrl({ planId }), {
                method: 'POST',
                headers: superAdmin,
                body: raw
            });
            expect(response.status).toBe(400);
        }

        const rows = await getDb()
            .select({ id: planVersions.id, current: planVersions.current })
            .from(planVersions)
            .where(eq(planVersions.planId, planId));
        expect(rows).toEqual([{ id: previousVersionId, current: true }]);
    });

    it('TEST:V2:9 retiring a plan (non-sellable version) and undoing the retire both publish one current version', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true
        });

        const retire = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { sellable: false } })
        });
        expect(retire.status, JSON.stringify(await retire.clone().json())).toBe(201);
        expect((await retire.json()).data).toMatchObject({ sellable: false, current: true });

        const undo = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { sellable: true, rank: 10 } })
        });
        expect(undo.status, JSON.stringify(await undo.clone().json())).toBe(201);
        expect((await undo.json()).data).toMatchObject({ sellable: true, current: true });

        const currentRows = await getDb()
            .select({ id: planVersions.id, sellable: planVersions.sellable })
            .from(planVersions)
            .where(eq(planVersions.current, true));
        expect(currentRows).toHaveLength(1);
        expect(currentRows[0]?.sellable).toBe(true);
    });
});
