/** TEST:V8b:2 (soporte API) — route contract, authorization order, defaults, and audit. */

import type { AdminPartnerApplicationPanelResponse } from '@repo/schemas';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    auditLog: vi.fn()
}));

vi.mock('../../../../src/services/partner-application/partner-application-panel.service', () => ({
    listPartnerApplicationPanel: mocks.list
}));
vi.mock('../../../../src/utils/create-app', async () => {
    const { OpenAPIHono } = await import('@hono/zod-openapi');
    return { createRouter: () => new OpenAPIHono() };
});
vi.mock('../../../../src/utils/audit-logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/audit-logger')>();
    return { ...actual, auditLog: mocks.auditLog };
});

import { adminListPartnerApplicationPanelRoute } from '../../../../src/routes/partner-application/admin/list';
import { injectClock } from '../../../../src/utils/clock';

const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-01-02T03:04:05.000Z');
const item = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'partner@example.test',
    status: 'PENDING' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    resolvedAt: null,
    overdue: true,
    waitEndsAt: null,
    partner: null
};
const page: AdminPartnerApplicationPanelResponse = {
    items: [item],
    pagination: {
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
    }
};

function buildApp(actor: Actor) {
    const app = new Hono<AppBindings>();
    app.use('*', (ctx, next) => {
        ctx.set('actor', actor);
        return next();
    });
    app.route('/', adminListPartnerApplicationPanelRoute);
    return app;
}

async function get(actor: Actor, query = '') {
    const response = await buildApp(actor).request(`/${query}`, { method: 'GET' });
    const body = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : await response.text();
    return { status: response.status, body };
}

function admin(permissions: PermissionEnum[]): Actor {
    return { id: ACTOR_ID, roles: [RoleEnum.ADMIN], permissions };
}

const allowed = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_RESOLVE_APPLICATION];
const denied = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_MANAGE];

beforeEach(() => {
    mocks.list.mockReset().mockResolvedValue(page);
    mocks.auditLog.mockReset();
    injectClock({ clock: { now: () => NOW } });
});

describe('TEST:V8b:2 (soporte API) admin Partner application panel route', () => {
    it('(a,g) defaults to pending and returns the real paginated list envelope with one audit entry', async () => {
        const result = await get(admin(allowed));
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: { items: [item], pagination: page.pagination },
            metadata: { timestamp: expect.any(String), requestId: 'unknown' }
        });
        expect(mocks.list).toHaveBeenCalledExactlyOnceWith({
            query: { page: 1, pageSize: 50, view: 'pending' },
            now: NOW
        });
        expect(mocks.auditLog).toHaveBeenCalledTimes(1);
        expect(mocks.auditLog).toHaveBeenCalledWith({
            auditEvent: 'billing.read',
            actorId: ACTOR_ID,
            resourceType: 'partner_application',
            resourceId: 'pending',
            metadata: { subjectId: null }
        });
    });

    it('(b) passes the requested view and pagination to the service', async () => {
        const result = await get(admin(allowed), '?view=approvedUnclaimed&page=2&pageSize=10');
        expect(result.status).toBe(200);
        expect(mocks.list).toHaveBeenCalledExactlyOnceWith({
            query: { page: 2, pageSize: 10, view: 'approvedUnclaimed' },
            now: NOW
        });
    });

    it('(c) denies an admin without the panel permission before invoking the service', async () => {
        const result = await get(admin(denied));
        expect(result.status).toBe(403);
        expect(mocks.list).toHaveBeenCalledTimes(0);
    });

    it('(d) returns forbidden before validating an invalid query', async () => {
        const result = await get(admin(denied), '?view=x');
        expect(result.status).toBe(403);
        expect(mocks.list).toHaveBeenCalledTimes(0);
    });

    it('(e) rejects an invalid view for an authorized admin', async () => {
        expect((await get(admin(allowed), '?view=x')).status).toBe(400);
    });

    it('(f) rejects page sizes over 100 for an authorized admin', async () => {
        expect((await get(admin(allowed), '?pageSize=500')).status).toBe(400);
    });
});
