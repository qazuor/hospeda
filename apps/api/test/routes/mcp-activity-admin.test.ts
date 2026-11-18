/**
 * GET /api/v1/admin/mcp-activity (HOS-2349, spec HOS-2335 §6.10), through the
 * real app.
 *
 * - AC-C51: without `MCP_ACTIVITY_VIEW` (an ADMIN, even holding the audit-log
 *   read) the route answers 403 before any read; with it, 200.
 * - AC-C52: every filter reaches the shared reader; the `total` it returns is
 *   the envelope's.
 * - AC-C53: an unregistered `tool` or an unknown query param answers 400.
 * - AC-C54: the route calls the ONE reader (`McpActivityService.list`) with the
 *   scope injected as `all`, whatever the query says.
 *
 * The reader itself is covered in service-core; here it is a spy.
 */

import { readFileSync } from 'node:fs';
import { McpActivityService } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

// The global setup swaps `ServiceError` for a double the error handler does not
// recognise; the real class is restored so 403 / 400 map correctly.
vi.mock('@repo/service-core', async () => vi.importActual('@repo/service-core'));
// The global `@repo/db` mock has no activity models; the reader is a spy, so
// placeholders are enough for its constructor defaults.
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return { ...createDbMock(), mcpActivityModel: {}, auditLogEntryModel: {} };
});

import { initApp } from '../../src/app.js';
import { MCP_TOOL_DEFINITIONS } from '../../src/mcp/tools/registry.js';
import type { AppOpenAPI } from '../../src/types.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const ROW_ID = '00000000-0000-4000-8000-000000000001';
const CLAUDE = 'https://claude.ai/oauth/mcp-client-metadata';
const BASE = '/api/v1/admin/mcp-activity';

const headersFor = (input: { readonly role: string; readonly permissions: readonly string[] }) => ({
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': input.role,
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', ...input.permissions])
});
/** SUPER_ADMIN: holds the permission (D-15). */
const SUPER_ADMIN = headersFor({
    role: 'SUPER_ADMIN',
    permissions: ['mcpActivity.view', 'auditLog.view']
});
/** ADMIN: staff, even with the audit-log read, but not the assistant log. */
const ADMIN = headersFor({ role: 'ADMIN', permissions: ['auditLog.view', 'securityLog.view'] });

const ITEM = {
    id: ROW_ID,
    loggedAt: new Date('2026-11-10T12:00:00.000Z'),
    tool: 'get_listing',
    isWrite: false,
    outcome: 'error' as const,
    errorCode: 'NOT_FOUND',
    client: { id: CLAUDE, name: 'Claude' },
    actorId: USER_ID,
    actorName: 'Ana Host',
    actorEmail: 'ana@local.test'
};

describe('GET /api/v1/admin/mcp-activity', () => {
    let app: AppOpenAPI;
    let list: MockInstance<McpActivityService['list']>;

    beforeEach(() => {
        app = initApp();
        list = vi
            .spyOn(McpActivityService.prototype, 'list')
            .mockResolvedValue({ data: { items: [ITEM], total: 41, skipped: 0 } });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** The arguments of the reader's only call. */
    const readerArgs = () => list.mock.calls[0]?.[0];

    describe('permission (AC-C51)', () => {
        it('answers 401 without a session', async () => {
            const res = await app.request(BASE, { headers: { 'user-agent': 'vitest' } });
            expect(res.status).toBe(401);
            expect(list).not.toHaveBeenCalled();
        });

        it('answers 403 to an ADMIN without MCP_ACTIVITY_VIEW, before any read', async () => {
            const res = await app.request(BASE, { headers: ADMIN });
            expect(res.status).toBe(403);
            expect(list).not.toHaveBeenCalled();
        });

        it('answers 200 to a SUPER_ADMIN holding MCP_ACTIVITY_VIEW, with the staff fields', async () => {
            const res = await app.request(BASE, { headers: SUPER_ADMIN });

            expect(res.status, await res.clone().text()).toBe(200);
            const body = (await res.json()) as {
                data: {
                    items: Record<string, unknown>[];
                    pagination: { total: number; page: number; pageSize: number };
                };
            };
            expect(body.data.items[0]).toMatchObject({
                id: ROW_ID,
                tool: 'get_listing',
                outcome: 'error',
                errorCode: 'NOT_FOUND',
                actorId: USER_ID,
                actorName: 'Ana Host',
                actorEmail: 'ana@local.test'
            });
            expect(body.data.pagination.total).toBe(41);
        });

        it('declares the permission in the route and references no role (static)', () => {
            const source = readFileSync(
                new URL('../../src/routes/mcp-activity/admin/list.ts', import.meta.url),
                'utf8'
            );
            expect(source).toMatch(
                /requiredPermissions:\s*\[\s*PermissionEnum\.MCP_ACTIVITY_VIEW\s*\]/
            );
            expect(source).not.toMatch(/RoleEnum|SUPER_ADMIN'|'ADMIN'/);
        });
    });

    describe('scope (AC-C54)', () => {
        it('calls the shared reader with the scope injected as all', async () => {
            await app.request(BASE, { headers: SUPER_ADMIN });

            expect(list).toHaveBeenCalledTimes(1);
            expect(readerArgs()).toMatchObject({
                actor: { id: ACTOR_ID },
                scope: { kind: 'all' },
                page: 1,
                pageSize: 20
            });
        });

        it.each([
            ['scope', 'scope=own'],
            ['actorId', `actorId=${USER_ID}`],
            ['limit', 'limit=5']
        ])('answers 400 to the unknown param %s (AC-C53)', async (_name, query) => {
            const res = await app.request(`${BASE}?${query}`, { headers: SUPER_ADMIN });
            expect(res.status).toBe(400);
            expect(list).not.toHaveBeenCalled();
        });
    });

    describe('filters (AC-C52)', () => {
        it.each([
            ['userId', `userId=${USER_ID}`, { userId: USER_ID }],
            ['tool', 'tool=reply_inquiry', { tool: 'reply_inquiry' }],
            ['outcome', 'outcome=denied', { outcome: 'denied' }],
            ['access=read', 'access=read', { access: 'read' }],
            ['access=write', 'access=write', { access: 'write' }],
            ['clientId', `clientId=${encodeURIComponent(CLAUDE)}`, { clientId: CLAUDE }],
            ['fromDate', 'fromDate=2026-11-01', { fromDate: new Date('2026-11-01T00:00:00.000Z') }],
            ['toDate', 'toDate=2026-11-03', { toDate: new Date('2026-11-03T23:59:59.999Z') }]
        ])('forwards %s to the reader', async (_name, query, expected) => {
            const res = await app.request(`${BASE}?${query}`, { headers: SUPER_ADMIN });

            expect(res.status, await res.clone().text()).toBe(200);
            expect(readerArgs()?.filter).toEqual({ sortDirection: 'desc', ...expected });
        });

        it('combines every filter in one call, with page and pageSize', async () => {
            const query = new URLSearchParams({
                userId: USER_ID,
                tool: 'get_listing',
                outcome: 'success',
                access: 'read',
                clientId: CLAUDE,
                fromDate: '2026-11-01',
                toDate: '2026-11-03',
                page: '3',
                pageSize: '10'
            });
            const res = await app.request(`${BASE}?${query.toString()}`, { headers: SUPER_ADMIN });

            expect(res.status).toBe(200);
            expect(readerArgs()).toMatchObject({
                scope: { kind: 'all' },
                page: 3,
                pageSize: 10,
                filter: {
                    userId: USER_ID,
                    tool: 'get_listing',
                    outcome: 'success',
                    access: 'read',
                    clientId: CLAUDE,
                    fromDate: new Date('2026-11-01T00:00:00.000Z'),
                    toDate: new Date('2026-11-03T23:59:59.999Z'),
                    sortDirection: 'desc'
                }
            });
            const body = (await res.json()) as { data: { pagination: { totalPages: number } } };
            expect(body.data.pagination.totalPages).toBe(5);
        });

        it.each([
            ['loggedAt:asc', 'asc'],
            ['loggedAt:desc', 'desc']
        ])('maps sort=%s to the reader direction', async (sort, direction) => {
            await app.request(`${BASE}?sort=${sort}`, { headers: SUPER_ADMIN });
            expect(readerArgs()?.filter).toEqual({ sortDirection: direction });
        });

        it('accepts every registered tool name', async () => {
            for (const definition of MCP_TOOL_DEFINITIONS) {
                const res = await app.request(`${BASE}?tool=${definition.name}`, {
                    headers: SUPER_ADMIN
                });
                expect(res.status, definition.name).toBe(200);
            }
            expect(list).toHaveBeenCalledTimes(MCP_TOOL_DEFINITIONS.length);
        });

        it.each([
            ['an unregistered tool', 'tool=delete_everything'],
            ['an unknown outcome', 'outcome=maybe'],
            ['an unknown access', 'access=admin'],
            ['a non-uuid user', 'userId=abc'],
            ['a malformed date', 'fromDate=not-a-date'],
            ['a sort on another field', 'sort=tool:asc']
        ])('answers 400 for %s before any read (AC-C53)', async (_label, query) => {
            const res = await app.request(`${BASE}?${query}`, { headers: SUPER_ADMIN });
            expect(res.status).toBe(400);
            expect(list).not.toHaveBeenCalled();
        });
    });
});
