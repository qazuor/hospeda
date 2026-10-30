import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    cleanupSettleExternalRows,
    seedUser
} from '../billing-refund/settle-external-fixtures';

const BASE = '/api/v1/admin/billing-reconciliation/marks';
let app: ReturnType<typeof initApp>;
let noPermissionId: string;
let userId: string;

function headers(id: string, role: string, permissions: PermissionEnum[]) {
    return actorHeaders({ id, role, permissions });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp();
    noPermissionId = await seedUser('reconciliation-no-permission');
    userId = await seedUser('reconciliation-user');
});
afterAll(async () => {
    await cleanupSettleExternalRows();
    await testDb.teardown();
});

describe('TEST:1620:7 actor authorization', () => {
    it('(e) requires a session on both routes', async () => {
        const list = await app.request(BASE, { headers: actorHeaders() });
        const events = await app.request(`${BASE}/bad/events`, { headers: actorHeaders() });
        expect(list.status).toBe(401);
        expect(events.status).toBe(401);
    });
    it('(f) checks the permission before event parameter validation on both routes', async () => {
        const actor = headers(noPermissionId, 'ADMIN', [PermissionEnum.ACCESS_PANEL_ADMIN]);
        const list = await app.request(BASE, { headers: actor });
        const events = await app.request(`${BASE}/bad/events`, { headers: actor });
        expect(list.status).toBe(403);
        expect(events.status).toBe(403);
    });
    it('(g) denies a regular user with only own billing access on both routes', async () => {
        const actor = headers(userId, 'USER', [PermissionEnum.BILLING_VIEW_OWN]);
        const list = await app.request(BASE, { headers: actor });
        const events = await app.request(`${BASE}/${crypto.randomUUID()}/events`, {
            headers: actor
        });
        expect(list.status).toBe(403);
        expect(events.status).toBe(403);
    });
});
