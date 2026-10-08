import { billingDeadlineVersions, getDb, sql } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import {
    changeBillingDeadline,
    getBillingDeadlinesVersion,
    getCurrentBillingDeadlines,
    previewBillingDeadlineChange
} from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const actor = {
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.MAINTENANCE_MODE_WRITE]
};

function headers(role: RoleEnum, permissions: PermissionEnum[]) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': role,
        'x-mock-actor-permissions': JSON.stringify(permissions)
    };
}

describe('HOS-1516 billing deadlines', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    afterEach(async () => {
        const initial = await getBillingDeadlinesVersion({ version: 1 });
        await getDb().execute(sql`TRUNCATE TABLE billing_deadline_version`);
        await getDb()
            .insert(billingDeadlineVersions)
            .values({ version: 1, values: initial.values });
    });

    afterAll(async () => testDb.teardown());

    it('TEST:B2:7 changes key 19 into version 2 with actor, time and before/after, leaving version 1 intact', async () => {
        const confirmation = await previewBillingDeadlineChange({
            actor,
            key: 19,
            value: { minutes: 90 }
        });
        expect(confirmation).toMatchObject({
            currentVersion: 1,
            currentValue: { minutes: 60 },
            newValue: { minutes: 90 }
        });
        expect(confirmation.message).toContain('relojes ya arrancados conservan su versión');

        const version2 = await changeBillingDeadline({
            actor,
            key: 19,
            value: { minutes: 90 },
            expectedVersion: confirmation.currentVersion,
            confirmed: true
        });
        expect(version2).toMatchObject({
            version: 2,
            changedKey: 19,
            changedBy: actor.id,
            previousValue: { minutes: 60 },
            newValue: { minutes: 90 }
        });
        expect(version2.createdAt).toBeInstanceOf(Date);
        expect((await getBillingDeadlinesVersion({ version: 1 })).values['19']).toEqual({
            minutes: 60
        });
        expect((await getCurrentBillingDeadlines()).values['19']).toEqual({ minutes: 90 });
        await expect(
            getDb()
                .update(billingDeadlineVersions)
                .set({ values: version2.values })
                .where(eq(billingDeadlineVersions.version, 1))
        ).rejects.toMatchObject({ cause: { message: expect.stringContaining('immutable') } });
    });

    it('TEST:B2:9 API rejects non-SUPER_ADMIN and contradictory contacts or notices', async () => {
        const app = initApp();
        const url = '/api/v1/admin/billing-deadlines';
        const admin = headers(RoleEnum.ADMIN, [PermissionEnum.ACCESS_PANEL_ADMIN]);
        const superAdmin = headers(RoleEnum.SUPER_ADMIN, actor.permissions);
        const request = (key: number, value: unknown) =>
            JSON.stringify({ key, value, expectedVersion: 1, confirmed: true });

        const denied = await app.request(url, {
            method: 'POST',
            headers: admin,
            body: request(19, { minutes: 90 })
        });
        const deniedBody = await denied.json();
        expect(denied.status, JSON.stringify(deniedBody)).toBe(403);
        expect(deniedBody.error.code).toBe(ServiceErrorCode.FORBIDDEN);

        for (const [key, value] of [
            [11, { noticeDays: 60, contactDays: [60, 7] }],
            [12, { noticeDays: 60, contactDays: [30, 60] }],
            [11, { noticeDays: 59, contactDays: [30, 7] }],
            [12, { noticeDays: 59, contactDays: [30, 7] }]
        ] as const) {
            const response = await app.request(url, {
                method: 'POST',
                headers: superAdmin,
                body: request(key, value)
            });
            expect(response.status).toBe(400);
            expect((await response.json()).error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        }
        expect((await getCurrentBillingDeadlines()).version).toBe(1);
    });

    it('TEST:B2:10 a clock anchored to version 1 keeps its date after notice 11 grows to 90 days', async () => {
        const announced = { startedAt: new Date('2026-10-08T12:00:00Z'), deadlinesVersion: 1 };
        const version2 = await changeBillingDeadline({
            actor,
            key: 11,
            value: { noticeDays: 90, contactDays: [30, 7] },
            expectedVersion: 1,
            confirmed: true
        });
        expect(version2.version).toBe(2);
        const anchored = await getBillingDeadlinesVersion({ version: announced.deadlinesVersion });
        const fresh = await getCurrentBillingDeadlines();
        const atDay = (days: number) =>
            new Date(announced.startedAt.getTime() + days * 86_400_000).toISOString();
        expect(atDay(anchored.values['11'].noticeDays)).toBe(atDay(60));
        expect(atDay(fresh.values['11'].noticeDays)).toBe(atDay(90));
        expect((await getBillingDeadlinesVersion({ version: 1 })).values['11'].noticeDays).toBe(60);
    });
});
