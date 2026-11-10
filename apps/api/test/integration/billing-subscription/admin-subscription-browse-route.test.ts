/** HOS-2081 CA-1 and the detail clause: admin subscription list and overview routes. */
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    BROWSE_AMOUNT_MINOR,
    BROWSE_CREATED_AT,
    BROWSE_CURRENCY,
    BROWSE_NEXT_CHARGE_AT,
    BROWSE_PLAN_NAME,
    BROWSE_PLAN_VERSION_CREATED_AT,
    BROWSE_SERVICE_ENDS_AT,
    retireBrowseRows,
    type SeededBrowseSubscription,
    seedBrowseSubscription
} from './admin-subscription-browse-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const clock = { now: () => new Date('2026-10-05T12:00:00.000Z') };
let app: ReturnType<typeof initApp>;
const readerId = crypto.randomUUID();

const listPath = '/api/v1/admin/billing-subscription';
const overviewPath = (id: string) => `${listPath}/${id}/overview`;
const inspectPath = (id: string) => `${listPath}/${id}`;

interface MockActor {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
}

const headers = (actor?: MockActor): Record<string, string> => {
    const base = { 'content-type': 'application/json', 'user-agent': 'vitest' };
    if (!actor) return base;
    return {
        ...base,
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
};
const inspectionActor = () =>
    headers({
        id: readerId,
        role: 'ADMIN',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
        ]
    });
const nonInspectionActor = () =>
    headers({ id: readerId, role: 'ADMIN', permissions: [PermissionEnum.ACCESS_PANEL_ADMIN] });
const guestActor = () =>
    headers({
        id: crypto.randomUUID(),
        role: 'GUEST',
        permissions: [PermissionEnum.ACCESS_API_PUBLIC]
    });

const expectedItem = (seeded: SeededBrowseSubscription) => ({
    id: seeded.subscriptionId,
    status: 'ACTIVE',
    class: 'PRINCIPAL',
    vertical: 'accommodation',
    owner: {
        id: seeded.userId,
        email: seeded.email,
        displayName: seeded.displayName,
        deleted: false
    },
    plan: {
        planId: seeded.planId,
        planName: BROWSE_PLAN_NAME,
        planVersionId: seeded.planVersionId
    },
    cycle: 'monthly',
    paymentMethod: 'CARD',
    nextChargeAt: BROWSE_NEXT_CHARGE_AT.toISOString(),
    createdAt: BROWSE_CREATED_AT.toISOString()
});

const expectedDetail = (seeded: SeededBrowseSubscription) => ({
    ...expectedItem(seeded),
    serviceEndsAt: BROWSE_SERVICE_ENDS_AT.toISOString(),
    planVersion: {
        id: seeded.planVersionId,
        current: false,
        sellable: false,
        createdAt: BROWSE_PLAN_VERSION_CREATED_AT.toISOString()
    },
    price: { amountMinor: BROWSE_AMOUNT_MINOR, currency: BROWSE_CURRENCY, cycle: 'monthly' },
    succeedsId: null,
    succeededById: null,
    pause: null,
    courtesy: null
});

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock });
});
beforeEach(() => {
    audit.mockClear();
});
afterEach(async () => retireBrowseRows());
afterAll(async () => {
    await retireBrowseRows();
    await testDb.teardown();
});

describe('HOS-2081 CA-1 un admin con permiso encuentra una suscripción por el email del dueño, sin conocer su ID', () => {
    it('returns 401 to a request without a session', async () => {
        const seeded = await seedBrowseSubscription('no-session');
        const response = await app.request(`${listPath}?q=${seeded.email}`, { headers: headers() });
        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 to a guest actor, never 403 or 200', async () => {
        const seeded = await seedBrowseSubscription('guest');
        const response = await app.request(`${listPath}?q=${seeded.email}`, {
            headers: guestActor()
        });
        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 to an admin without the inspection permission', async () => {
        const seeded = await seedBrowseSubscription('no-inspect');
        const response = await app.request(`${listPath}?q=${seeded.email}`, {
            headers: nonInspectionActor()
        });
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
    });

    it('finds the subscription by the owner email and audits the read', async () => {
        const seeded = await seedBrowseSubscription('search');
        const response = await app.request(`${listPath}?q=${seeded.email}`, {
            headers: inspectionActor()
        });
        expect(response.status).toBe(200);
        const body = (await response.json()).data;
        expect(body.items).toEqual([expectedItem(seeded)]);
        expect(body.pagination).toEqual({
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
        });
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: readerId,
                resourceType: 'subscription',
                resourceId: 'list',
                metadata: { subjectId: null }
            })
        );
    });

    it('rejects the unknown limit, an oversize page size and an unknown status', async () => {
        const unknownParam = await app.request(`${listPath}?limit=10`, {
            headers: inspectionActor()
        });
        const oversize = await app.request(`${listPath}?pageSize=101`, {
            headers: inspectionActor()
        });
        const unknownStatus = await app.request(`${listPath}?status=FOO`, {
            headers: inspectionActor()
        });
        expect([unknownParam.status, oversize.status, unknownStatus.status]).toEqual([
            400, 400, 400
        ]);
        expect((await unknownParam.json()).error.code).toBe('INVALID_PAGINATION_PARAMS');
        expect((await oversize.json()).error.code).toBe('VALIDATION_ERROR');
        expect((await unknownStatus.json()).error.code).toBe('VALIDATION_ERROR');
    });

    it('keeps the inspect route answering its own contract', async () => {
        const seeded = await seedBrowseSubscription('inspect');
        const response = await app.request(inspectPath(seeded.subscriptionId), {
            headers: inspectionActor()
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            id: seeded.subscriptionId,
            vertical: 'accommodation',
            billingOptionId: seeded.billingOptionId,
            declaredPayerEmail: null,
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            paymentMethod: 'CARD',
            nextChargeAt: BROWSE_NEXT_CHARGE_AT.toISOString(),
            serviceEndsAt: BROWSE_SERVICE_ENDS_AT.toISOString(),
            createdAt: BROWSE_CREATED_AT.toISOString(),
            subject: {
                id: seeded.userId,
                displayName: seeded.displayName,
                email: seeded.email
            },
            currentPlan: { planName: BROWSE_PLAN_NAME, cycle: 'monthly' }
        });
    });
});

describe('HOS-2081 el detalle de suscripción', () => {
    it('returns 401 to a request without a session', async () => {
        const seeded = await seedBrowseSubscription('overview-no-session');
        const response = await app.request(overviewPath(seeded.subscriptionId), {
            headers: headers()
        });
        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 to a guest actor, never 403 or 200', async () => {
        const seeded = await seedBrowseSubscription('overview-guest');
        const response = await app.request(overviewPath(seeded.subscriptionId), {
            headers: guestActor()
        });
        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 to an admin without the inspection permission', async () => {
        const seeded = await seedBrowseSubscription('overview-no-inspect');
        const response = await app.request(overviewPath(seeded.subscriptionId), {
            headers: nonInspectionActor()
        });
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
    });

    it('returns the detail with ISO dates and audits the read', async () => {
        const seeded = await seedBrowseSubscription('overview');
        const response = await app.request(overviewPath(seeded.subscriptionId), {
            headers: inspectionActor()
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual(expectedDetail(seeded));
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: readerId,
                resourceType: 'subscription',
                resourceId: seeded.subscriptionId,
                metadata: { subjectId: seeded.userId }
            })
        );
    });

    it('returns 400 for a malformed id and 404 NOT_FOUND for an unknown one', async () => {
        const malformed = await app.request(`${listPath}/not-a-uuid/overview`, {
            headers: inspectionActor()
        });
        expect(malformed.status).toBe(400);
        expect((await malformed.json()).error.code).toBe('VALIDATION_ERROR');

        const missing = crypto.randomUUID();
        const unknown = await app.request(overviewPath(missing), { headers: inspectionActor() });
        expect(unknown.status).toBe(404);
        expect((await unknown.json()).error.code).toBe('NOT_FOUND');
    });
});
