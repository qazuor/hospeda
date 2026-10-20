/** Actor order and inspection audit for the subscription open-refunds read. */
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedRevocable,
    seedUser
} from './revocation-route-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
let readerId: string;

const pathOf = (subscriptionId: string) =>
    `/api/v1/admin/billing-subscription/${subscriptionId}/open-refunds`;
const inspectionActor = () =>
    actorHeaders({
        id: readerId,
        role: 'ADMIN',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
        ]
    });
const read = (subscriptionId: string, headers = inspectionActor()) =>
    app.request(pathOf(subscriptionId), { method: 'GET', headers });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(async () => {
    audit.mockClear();
    readerId = await seedUser('open-refunds-reader');
});
afterEach(async () => retireRevocationRouteRows());
afterAll(async () => {
    await retireRevocationRouteRows();
    await testDb.teardown();
});

describe('TEST:1711:9 AC:1711:9 open-refunds route actor order and audit', () => {
    it('TEST:1711:9 AC:1711:9 returns 401 without a session before auditing', async () => {
        const seeded = await seedRevocable();
        const response = await read(seeded.subscriptionId, actorHeaders());
        expect(response.status).toBe(401);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                resourceId: seeded.subscriptionId
            })
        );
    });

    it('TEST:1711:9 AC:1711:9 returns 403 without inspection permission even when settlement and cancellation are allowed', async () => {
        const seeded = await seedRevocable();
        const headers = actorHeaders({
            id: readerId,
            role: 'ADMIN',
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_SETTLE_EXTERNAL,
                PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
            ]
        });
        const response = await read(seeded.subscriptionId, headers);
        expect(response.status).toBe(403);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                resourceId: seeded.subscriptionId
            })
        );
    });

    it('TEST:1711:9 AC:1711:9 returns 400 for a malformed subscription id before auditing', async () => {
        const response = await read('not-a-uuid');
        expect(response.status).toBe(400);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_READ })
        );
    });

    it('TEST:1711:9 AC:1711:9 returns 404 NOT_FOUND for an unknown subscription before auditing', async () => {
        const id = crypto.randomUUID();
        const response = await read(id);
        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('NOT_FOUND');
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                resourceId: id
            })
        );
    });

    it('TEST:1711:9 AC:1711:9 returns an empty list and audits the subscription read', async () => {
        const seeded = await seedRevocable();
        const response = await read(seeded.subscriptionId);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({ items: [] });
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: readerId,
                resourceType: 'subscription',
                resourceId: seeded.subscriptionId
            })
        );
    });
});
