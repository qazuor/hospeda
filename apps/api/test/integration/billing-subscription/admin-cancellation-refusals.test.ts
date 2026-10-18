import { eq, getDb, subscriptions } from '@repo/db';
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
    presetSelfCancelNotice,
    REVOKER_PERMISSIONS,
    retireAdminCancellationRows,
    revocationWrites,
    routeClock,
    routeFake,
    seedAdminGraceCard,
    seedSelfActive,
    seedSelfComplement,
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
const pathOf = (id: string) => `/api/v1/admin/billing-subscription/${id}/cancellation`;
const admin = (id: string) =>
    actorHeaders({ id, role: 'SUPER_ADMIN', permissions: REVOKER_PERMISSIONS });
const noCancelPermission = (id: string) =>
    actorHeaders({
        id,
        role: 'ADMIN',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
            PermissionEnum.BILLING_SETTLE_EXTERNAL
        ]
    });
const post = async (
    id: string,
    headers: Record<string, string>,
    body: unknown = { expectedOrigin: 'ACTIVE' }
) => await app.request(pathOf(id), { method: 'POST', headers, body: JSON.stringify(body) });
const get = async (id: string, headers: Record<string, string>) =>
    await app.request(pathOf(id), { headers });
async function errorOf(response: Response) {
    const body = await response.json();
    return { status: response.status, code: body.error?.code, reason: body.error?.reason };
}
async function expectUntouched(input: {
    subscriptionId: string;
    ownerId: string;
    operation: () => Promise<Response>;
}) {
    const before = await revocationWrites({
        subscriptionId: input.subscriptionId,
        ownerId: input.ownerId
    });
    const cancel = vi.spyOn(fake, 'cancel');
    cancel.mockClear();
    const result = await input.operation();
    const after = await revocationWrites({
        subscriptionId: input.subscriptionId,
        ownerId: input.ownerId
    });
    expect(after).toEqual(before);
    expect(cancel).not.toHaveBeenCalled();
    return result;
}

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
    expect(
        audit.mock.calls.some(([event]) => event.auditEvent === AuditEventType.BILLING_MUTATION)
    ).toBe(false);
    await retireAdminCancellationRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await retireAdminCancellationRows();
    await testDb.teardown();
});

describe('TEST:1696:2 AC:1696:2 and TEST:1696:5 AC:1696:5 admin cancellation refusals', () => {
    it('(a) GET and POST require a session', async () => {
        const seeded = await seedSelfActive(fake, clock);
        for (const operation of [
            () => get(seeded.subscriptionId, actorHeaders()),
            () => post(seeded.subscriptionId, actorHeaders())
        ]) {
            const response = await expectUntouched({ ...seeded, operation });
            expect((await errorOf(response)).status).toBe(401);
        }
    });

    it('(b) route permission wins over malformed params on both methods', async () => {
        const actorId = '00000000-0000-4000-8000-000000000081';
        const seeded = await seedSelfActive(fake, clock);
        for (const operation of [
            () => get(seeded.subscriptionId, noCancelPermission(actorId)),
            () => post(seeded.subscriptionId, noCancelPermission(actorId)),
            () => get('not-a-uuid', noCancelPermission(actorId)),
            () => post('not-a-uuid', noCancelPermission(actorId))
        ]) {
            const response = await expectUntouched({ ...seeded, operation });
            expect((await errorOf(response)).status).toBe(403);
        }
    });

    it('(c) actor equal to subject is refused case-insensitively on GET and POST without writes', async () => {
        const seeded = await seedSelfActive(fake, clock);
        await presetSelfCancelNotice({ ...seeded, status: 'sent' });
        for (const actorId of [seeded.ownerId, seeded.ownerId.toUpperCase()]) {
            for (const operation of [
                () => get(seeded.subscriptionId, admin(actorId)),
                () => post(seeded.subscriptionId, admin(actorId))
            ]) {
                const response = await expectUntouched({ ...seeded, operation });
                expect(await errorOf(response)).toEqual({
                    status: 403,
                    code: 'FORBIDDEN',
                    reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
                });
            }
        }
        expect(
            audit.mock.calls.some(([event]) => event.auditEvent === AuditEventType.BILLING_MUTATION)
        ).toBe(false);
    });

    it('(d) permitted callers receive 400 for malformed params and strict request bodies', async () => {
        const adminId = '00000000-0000-4000-8000-000000000082';
        const seeded = await seedSelfActive(fake, clock);
        expect(
            (
                await errorOf(
                    await expectUntouched({
                        ...seeded,
                        operation: () => get('not-a-uuid', admin(adminId))
                    })
                )
            ).status
        ).toBe(400);
        for (const body of [
            {},
            { expectedOrigin: 'ACTIVE', extra: true },
            { expectedOrigin: 'CANCEL_SCHEDULED' },
            { expectedOrigin: 'ACTIVE', note: '   ' },
            { expectedOrigin: 'ACTIVE', note: 'x'.repeat(2001) }
        ]) {
            const response = await expectUntouched({
                ...seeded,
                operation: () => post(seeded.subscriptionId, admin(adminId), body)
            });
            expect((await errorOf(response)).status).toBe(400);
        }
    });

    it('(e) a missing subscription is typed 404', async () => {
        const id = '00000000-0000-4000-8000-000000000083';
        const headers = admin('00000000-0000-4000-8000-000000000084');
        for (const response of [await get(id, headers), await post(id, headers)])
            expect(await errorOf(response)).toEqual({
                status: 404,
                code: 'NOT_FOUND',
                reason: 'SUBSCRIPTION_NOT_FOUND'
            });
    });

    it('(f) PAUSED and PENDING_AUTHORIZATION are rejected untouched', async () => {
        const adminId = '00000000-0000-4000-8000-000000000085';
        for (const state of ['PAUSED', 'PENDING_AUTHORIZATION'] as const) {
            const seeded = await seedSelfState(state);
            const before = await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            const response = await expectUntouched({
                ...seeded,
                operation: () => post(seeded.subscriptionId, admin(adminId))
            });
            expect(await errorOf(response)).toEqual({
                status: 409,
                code: 'ALREADY_EXISTS',
                reason: 'CANCELLATION_STATE_NOT_ALLOWED'
            });
            expect(
                await getDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, seeded.subscriptionId))
            ).toEqual(before);
        }
    });

    it('(g) a complement subscription is rejected as non-principal', async () => {
        const principal = await seedSelfState('ACTIVE');
        const complement = await seedSelfComplement(principal.ownerId);
        const response = await expectUntouched({
            ownerId: principal.ownerId,
            subscriptionId: complement.subscriptionId,
            operation: () =>
                post(complement.subscriptionId, admin('00000000-0000-4000-8000-000000000086'))
        });
        expect(await errorOf(response)).toEqual({
            status: 409,
            code: 'ALREADY_EXISTS',
            reason: 'CANCELLATION_NOT_PRINCIPAL'
        });
    });

    it('(h) expectedOrigin mismatch refuses ACTIVE and GRACE_PERIOD before provider calls', async () => {
        const active = await seedSelfActive(fake, clock);
        const response = await expectUntouched({
            ...active,
            operation: () =>
                post(active.subscriptionId, admin('00000000-0000-4000-8000-000000000087'), {
                    expectedOrigin: 'SUSPENDED'
                })
        });
        expect(await errorOf(response)).toEqual({
            status: 409,
            code: 'ALREADY_EXISTS',
            reason: 'CANCELLATION_ORIGIN_CHANGED'
        });
        const grace = await seedAdminGraceCard({ fake, clock });
        const other = await expectUntouched({
            ...grace,
            operation: () =>
                post(grace.subscriptionId, admin('00000000-0000-4000-8000-000000000087'), {
                    expectedOrigin: 'ACTIVE'
                })
        });
        expect(await errorOf(other)).toEqual({
            status: 409,
            code: 'ALREADY_EXISTS',
            reason: 'CANCELLATION_ORIGIN_CHANGED'
        });
    });

    it('(i) success audits every ACC_8 field and refusals never audit mutation', async () => {
        const seeded = await seedSelfActive(fake, clock);
        await presetSelfCancelNotice({ ...seeded, status: 'sent' });
        const note = 'Requested after chargeback review';
        const response = await post(
            seeded.subscriptionId,
            admin('00000000-0000-4000-8000-000000000088'),
            {
                expectedOrigin: 'ACTIVE',
                note
            }
        );
        expect(response.status).toBe(200);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_8',
                    transition: 'S11',
                    outcome: 'SCHEDULED',
                    origin: 'ACTIVE',
                    subjectId: seeded.ownerId,
                    cancelCall: 'SENT',
                    note
                })
            })
        );
        audit.mockClear();
        const mismatch = await post(
            seeded.subscriptionId,
            admin('00000000-0000-4000-8000-000000000088'),
            { expectedOrigin: 'SUSPENDED' }
        );
        expect((await errorOf(mismatch)).reason).toBe('CANCELLATION_ORIGIN_CHANGED');
        expect(
            audit.mock.calls.some(([event]) => event.auditEvent === AuditEventType.BILLING_MUTATION)
        ).toBe(false);
    });
});
