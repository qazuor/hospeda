/**
 * TEST:B5:11 (HOS-1543), the refusals of admin action 8 with reason revocation (ACC:8, S36)
 * on `GET`/`POST /api/v1/admin/billing-subscription/{subscriptionId}/revocation`: every
 * foreign actor gets its status and leaves nothing behind (no state change, no refund, no
 * outbox row, no coverage loss, no decision event, no provider call, no mutation audit).
 * Each case runs over a card subscription WITH its provider link, so an act that slipped
 * through would call the provider.
 *
 * The system actor never reaches a route with headers (the mock actor carries no system
 * marker and the real one is never a session); its refusal is covered by the service, in
 * `packages/service-core/test/integration/services/subscription-revocation-guards.test.ts` (q).
 *
 * Seeds its own rows with random ids and retires only them; never TRUNCATE.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    grantRole,
    NOW,
    REVOKER_PERMISSIONS,
    retireRevocationRouteRows,
    revocationWrites,
    routeClock,
    routeFake,
    seedCardRevocable,
    seedUser,
    spyingProvider
} from './revocation-route-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

type MockActor = {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
};

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;

const pathOf = (subscriptionId: string) =>
    `/api/v1/admin/billing-subscription/${subscriptionId}/revocation`;

function request(input: {
    readonly method: 'GET' | 'POST';
    readonly subscriptionId: string;
    readonly expectedPaymentId: string;
    readonly actor?: MockActor;
}) {
    return app.request(pathOf(input.subscriptionId), {
        method: input.method,
        headers: actorHeaders(input.actor),
        ...(input.method === 'POST'
            ? { body: JSON.stringify({ expectedPaymentId: input.expectedPaymentId }) }
            : {})
    });
}

/**
 * Sends the preview and the act as `actor` over a fresh card subscription and asserts both
 * answer `status` and that nothing was written, called or audited as a mutation.
 */
async function expectRefusedUntouched(input: {
    readonly actor: (seeded: { readonly ownerId: string }) => Promise<MockActor | undefined>;
    readonly status: number;
    readonly reason?: string;
    readonly subjectRole?: RoleEnum;
}) {
    // Arrange
    const seeded = await seedCardRevocable({ fake, clock });
    if (input.subjectRole) await grantRole(seeded.ownerId, input.subjectRole);
    const actor = await input.actor(seeded);
    const spy = spyingProvider(fake);
    injectPaymentProvider({ provider: spy.provider });
    const before = await revocationWrites(seeded);
    audit.mockClear();

    // Act
    const responses = [
        await request({ method: 'GET', ...seeded, expectedPaymentId: seeded.paymentId, actor }),
        await request({ method: 'POST', ...seeded, expectedPaymentId: seeded.paymentId, actor })
    ];

    // Assert
    for (const response of responses) {
        expect(response.status).toBe(input.status);
        if (input.reason)
            expect((await response.json()).error).toMatchObject({
                code: 'FORBIDDEN',
                reason: input.reason
            });
    }
    expect(await revocationWrites(seeded)).toEqual(before);
    expect(spy.calls).toEqual([]);
    expect(audit).not.toHaveBeenCalledWith(
        expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
    );
}

describe('TEST:B5:11 AC:B5:20 the revocation route refuses every foreign actor', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock, paymentProvider: fake });
    });
    beforeEach(() => {
        clock.set(NOW);
        injectPaymentProvider({ provider: fake });
    });
    afterEach(async () => {
        await retireRevocationRouteRows();
    });
    afterAll(async () => {
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it('answers 401 without a session and writes nothing', async () => {
        await expectRefusedUntouched({ actor: async () => undefined, status: 401 });
    });

    it('answers 403 to an ADMIN holding billing permissions but not the one of action 8', async () => {
        await expectRefusedUntouched({
            actor: async () => ({
                id: await seedUser('admin'),
                role: 'ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.REFUND_PROCESS,
                    PermissionEnum.PAYMENT_REFUND,
                    PermissionEnum.REFUND_APPROVE,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
                ]
            }),
            status: 403
        });
    });

    it('answers 403 to an actor holding action 14 and the subscription inspection but not action 8', async () => {
        await expectRefusedUntouched({
            actor: async () => ({
                id: await seedUser('settler'),
                role: 'SUPER_ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
                ]
            }),
            status: 403
        });
    });

    it('answers 403 ADMINISTRATIVE_ACTION_FORBIDDEN to the owner revoking their own subscription WITH the permission (actor = subject)', async () => {
        await expectRefusedUntouched({
            actor: async (seeded) => ({
                id: seeded.ownerId,
                role: 'SUPER_ADMIN',
                permissions: REVOKER_PERMISSIONS
            }),
            status: 403,
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
    });

    it('answers 403 to an ADMIN over the subscription of a SUPER_ADMIN (I-9: the permission is SUPER_ADMIN only)', async () => {
        await expectRefusedUntouched({
            subjectRole: RoleEnum.SUPER_ADMIN,
            actor: async () => ({
                id: await seedUser('admin-over-super'),
                role: 'ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
                ]
            }),
            status: 403
        });
    });
});
