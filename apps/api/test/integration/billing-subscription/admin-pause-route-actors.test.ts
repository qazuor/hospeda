import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireAdminCancellationRows,
    routeClock,
    routeFake,
    seedSelfActive,
    seedSelfState
} from './admin-cancellation-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));
let app: ReturnType<typeof initApp>;
const pathOf = (id: string, action: 'pause-preview' | 'pause' | 'resume') =>
    `/api/v1/admin/billing-subscription/${id}/${action}`;
const permitted = (id: string) =>
    actorHeaders({
        id,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_PAUSE_SUBSCRIPTION]
    });
const denied = (id: string) =>
    actorHeaders({
        id,
        role: 'ADMIN',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
        ]
    });
const pauseBody = { months: 1, expectedStatus: 'ACTIVE', confirmed: true };
const resumeBody = { expectedStatus: 'PAUSED', confirmed: true };
const request = (
    id: string,
    action: 'pause-preview' | 'pause' | 'resume',
    headers: Record<string, string>
) =>
    app.request(
        pathOf(id, action),
        action === 'pause-preview'
            ? { headers }
            : {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(action === 'pause' ? pauseBody : resumeBody)
              }
    );
const errorOf = async (response: Response) => {
    const body = await response.json();
    return { status: response.status, code: body.error?.code, reason: body.error?.reason };
};

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
    audit.mockClear();
});
afterEach(async () => {
    await retireAdminCancellationRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await retireAdminCancellationRows();
    await testDb.teardown();
});

describe('TEST:B8b:22 AC:B8b:22 administrative action 9 actor gates', () => {
    it.each([
        'pause-preview',
        'pause',
        'resume'
    ] as const)('%s returns 404 for a missing subscription', async (action) => {
        const response = await request(
            '00000000-0000-4000-8000-000000000099',
            action,
            permitted('00000000-0000-4000-8000-000000000091')
        );
        expect(await errorOf(response)).toEqual({
            status: 404,
            code: 'NOT_FOUND',
            reason: 'SUBSCRIPTION_NOT_FOUND'
        });
    });

    it.each([
        'pause-preview',
        'pause',
        'resume'
    ] as const)('%s rejects a valid request without its permission', async (action) => {
        const seeded =
            action === 'resume' ? await seedSelfState('PAUSED') : await seedSelfActive(fake, clock);
        const response = await request(
            seeded.subscriptionId,
            action,
            denied('00000000-0000-4000-8000-000000000091')
        );
        expect(await errorOf(response)).toEqual({
            status: 403,
            code: 'FORBIDDEN',
            reason: undefined
        });
        expect(
            audit.mock.calls.filter(
                ([event]) => event.auditEvent === AuditEventType.BILLING_MUTATION
            )
        ).toEqual([]);
    });

    it.each([
        'pause-preview',
        'pause',
        'resume'
    ] as const)('%s refuses actor equal to subject', async (action) => {
        const seeded =
            action === 'resume' ? await seedSelfState('PAUSED') : await seedSelfActive(fake, clock);
        const response = await request(seeded.subscriptionId, action, permitted(seeded.ownerId));
        expect(await errorOf(response)).toEqual({
            status: 403,
            code: 'FORBIDDEN',
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect(
            audit.mock.calls.filter(
                ([event]) => event.auditEvent === AuditEventType.BILLING_MUTATION
            )
        ).toEqual([]);
    });
});
