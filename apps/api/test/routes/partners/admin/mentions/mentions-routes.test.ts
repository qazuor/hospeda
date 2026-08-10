/**
 * Route-level tests for the admin partner-mentions endpoints (HOS-377 T-016).
 *
 * Deliberately under `test/routes/`, NOT `test/e2e/`: `apps/api` carries three
 * vitest configs and only the default one (`vitest.config.ts`) is reached by
 * `turbo run test` in CI. `test:e2e` appears in no workflow, so a suite placed
 * there would be green locally and never run on a pull request.
 *
 * The route factories are replaced with identity functions, so each module's
 * export IS its options object. That buys two things a hand-extracted handler
 * would not: the declared path, method and permissions are assertable, and the
 * handler is still exercised through exactly the shape the factory receives.
 *
 * @module test/routes/partners/admin/mentions/mentions-routes
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createBatchMock, listForPartnerMock, correctMock, removeMock, auditLogMock } = vi.hoisted(
    () => ({
        createBatchMock: vi.fn(),
        listForPartnerMock: vi.fn(),
        correctMock: vi.fn(),
        removeMock: vi.fn(),
        auditLogMock: vi.fn()
    })
);

// Identity factories: the exported "route" is the options object itself.
vi.mock('../../../../../src/utils/route-factory.js', () => ({
    createAdminRoute: vi.fn((options: unknown) => options),
    createAdminListRoute: vi.fn((options: unknown) => options)
}));
vi.mock('../../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((options: unknown) => options),
    createAdminListRoute: vi.fn((options: unknown) => options)
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class PartnerMentionServiceStub {
        createBatch = createBatchMock;
        listForPartner = listForPartnerMock;
        correct = correctMock;
        remove = removeMock;
    }
    return { ...actual, PartnerMentionService: PartnerMentionServiceStub };
});

vi.mock('../../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'admin-1', roles: [], permissions: [] }))
}));

vi.mock('../../../../../src/utils/audit-logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../../src/utils/audit-logger')>();
    return { ...actual, auditLog: auditLogMock };
});

import { PartnerMentionChannelEnum, PermissionEnum } from '@repo/schemas';
import { adminCreatePartnerMentionsRoute } from '../../../../../src/routes/partners/admin/mentions/create';
import { adminDeletePartnerMentionRoute } from '../../../../../src/routes/partners/admin/mentions/delete';
import { adminListPartnerMentionsRoute } from '../../../../../src/routes/partners/admin/mentions/list';
import { adminUpdatePartnerMentionRoute } from '../../../../../src/routes/partners/admin/mentions/update';

const PARTNER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_PARTNER_ID = '00000000-0000-4000-a000-0000000000ff';
const MENTION_ID = '00000000-0000-4000-a000-000000000002';
const AUG_01 = new Date('2026-08-01T12:00:00.000Z');

// biome-ignore lint/suspicious/noExplicitAny: the handlers only read params/body; the Hono context is unused
const ctx = {} as any;
// biome-ignore lint/suspicious/noExplicitAny: route options are typed by the real factory, replaced here
const route = (r: unknown) => r as any;

const makeMention = (overrides: Record<string, unknown> = {}) => ({
    id: MENTION_ID,
    partnerId: PARTNER_ID,
    channel: PartnerMentionChannelEnum.INSTAGRAM,
    batchId: null,
    mentionedAt: AUG_01,
    url: 'https://ig.test/1',
    internalNote: 'agreed with the owner',
    ...overrides
});

beforeEach(() => {
    vi.clearAllMocks();
    createBatchMock.mockResolvedValue({ data: { mentions: [makeMention()] } });
    listForPartnerMock.mockResolvedValue({ data: { mentions: [makeMention()], total: 1 } });
    correctMock.mockResolvedValue({ data: { mention: makeMention() } });
    removeMock.mockResolvedValue({ data: { count: 1 } });
});

describe('admin mention routes — declared surface', () => {
    it('gates all four on PARTNER_MANAGE', () => {
        for (const r of [
            adminCreatePartnerMentionsRoute,
            adminListPartnerMentionsRoute,
            adminUpdatePartnerMentionRoute,
            adminDeletePartnerMentionRoute
        ]) {
            expect(route(r).requiredPermissions).toEqual([PermissionEnum.PARTNER_MANAGE]);
        }
    });

    it('scopes every path under the partner it belongs to', () => {
        expect(route(adminCreatePartnerMentionsRoute).path).toBe('/{partnerId}/mentions');
        expect(route(adminListPartnerMentionsRoute).path).toBe('/{partnerId}/mentions');
        expect(route(adminUpdatePartnerMentionRoute).path).toBe('/{partnerId}/mentions/{id}');
        expect(route(adminDeletePartnerMentionRoute).path).toBe('/{partnerId}/mentions/{id}');
    });

    it('never declares `limit` on the list route — admin pagination is page+pageSize', () => {
        const queryKeys = Object.keys(route(adminListPartnerMentionsRoute).requestQuery ?? {});

        expect(queryKeys).not.toContain('limit');
        // `page`/`pageSize` are merged by the list factory, so their absence
        // from the declared shape is expected, not a gap.
        expect(queryKeys).toEqual(
            expect.arrayContaining(['channel', 'batchId', 'mentionedAfter', 'mentionedBefore'])
        );
    });

    it('removes only softly — the delete route reaches `remove`, never a hard delete', async () => {
        await route(adminDeletePartnerMentionRoute).handler(ctx, {
            partnerId: PARTNER_ID,
            id: MENTION_ID
        });

        expect(removeMock).toHaveBeenCalledTimes(1);
    });
});

describe('POST /{partnerId}/mentions', () => {
    it('takes the partner from the PATH, overriding any copy in the body', async () => {
        // The schema strips both of these before the handler sees them; this
        // pins the handler's own spread order, which is what makes the
        // stripping mean anything if the schema is ever loosened.
        const body = {
            mentionedAt: AUG_01,
            entries: [{ channel: PartnerMentionChannelEnum.INSTAGRAM, url: 'https://ig.test/1' }],
            partnerId: OTHER_PARTNER_ID,
            batchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        };

        await route(adminCreatePartnerMentionsRoute).handler(ctx, { partnerId: PARTNER_ID }, body);

        expect(createBatchMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ partnerId: PARTNER_ID })
        );
    });

    it('returns the created rows', async () => {
        createBatchMock.mockResolvedValue({
            data: { mentions: [makeMention(), makeMention({ id: 'x' })] }
        });

        const result = await route(adminCreatePartnerMentionsRoute).handler(
            ctx,
            { partnerId: PARTNER_ID },
            { mentionedAt: AUG_01, entries: [] }
        );

        expect(result.mentions).toHaveLength(2);
    });

    it('surfaces a service error instead of answering 201 with nothing', async () => {
        createBatchMock.mockResolvedValue({
            error: { code: 'FORBIDDEN', message: 'Permission denied' }
        });

        await expect(
            route(adminCreatePartnerMentionsRoute).handler(
                ctx,
                { partnerId: PARTNER_ID },
                { mentionedAt: AUG_01, entries: [] }
            )
        ).rejects.toThrow(/permission denied/i);
    });
});

describe('GET /{partnerId}/mentions', () => {
    it('paginates against the FILTERED total, not the page length', async () => {
        listForPartnerMock.mockResolvedValue({ data: { mentions: [makeMention()], total: 137 } });

        const result = await route(adminListPartnerMentionsRoute).handler(
            ctx,
            { partnerId: PARTNER_ID },
            undefined,
            { page: 1, pageSize: 1 }
        );

        expect(result.pagination.total).toBe(137);
        expect(result.pagination.totalPages).toBe(137);
        expect(result.pagination.hasNextPage).toBe(true);
    });

    it('forwards the declared filters to the service', async () => {
        await route(adminListPartnerMentionsRoute).handler(
            ctx,
            { partnerId: PARTNER_ID },
            undefined,
            {
                channel: PartnerMentionChannelEnum.NEWSLETTER,
                mentionedAfter: AUG_01,
                page: 2,
                pageSize: 50
            }
        );

        expect(listForPartnerMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                partnerId: PARTNER_ID,
                filters: expect.objectContaining({
                    channel: PartnerMentionChannelEnum.NEWSLETTER,
                    mentionedAfter: AUG_01,
                    page: 2,
                    pageSize: 50
                })
            })
        );
    });

    it('scopes to the path partner even when the query carries another one', async () => {
        await route(adminListPartnerMentionsRoute).handler(
            ctx,
            { partnerId: PARTNER_ID },
            undefined,
            { partnerId: OTHER_PARTNER_ID }
        );

        expect(listForPartnerMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ partnerId: PARTNER_ID })
        );
    });
});

describe('PATCH and DELETE /{partnerId}/mentions/{id}', () => {
    it('PATCH passes BOTH path segments, so the scope can be checked', async () => {
        await route(adminUpdatePartnerMentionRoute).handler(
            ctx,
            { partnerId: PARTNER_ID, id: MENTION_ID },
            { internalNote: 'fixed' }
        );

        expect(correctMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ partnerId: PARTNER_ID, id: MENTION_ID })
        );
    });

    it('DELETE passes BOTH path segments, so the scope can be checked', async () => {
        await route(adminDeletePartnerMentionRoute).handler(ctx, {
            partnerId: PARTNER_ID,
            id: MENTION_ID
        });

        expect(removeMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ partnerId: PARTNER_ID, id: MENTION_ID })
        );
    });

    it('PATCH surfaces a service error', async () => {
        correctMock.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'Mention not found' }
        });

        await expect(
            route(adminUpdatePartnerMentionRoute).handler(
                ctx,
                { partnerId: PARTNER_ID, id: MENTION_ID },
                {}
            )
        ).rejects.toThrow(/mention not found/i);
    });

    it('DELETE surfaces a service error', async () => {
        removeMock.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'Mention not found' }
        });

        await expect(
            route(adminDeletePartnerMentionRoute).handler(ctx, {
                partnerId: PARTNER_ID,
                id: MENTION_ID
            })
        ).rejects.toThrow(/mention not found/i);
    });
});

describe('audit trail', () => {
    // `auditMiddleware` exists but is mounted nowhere, so these explicit calls
    // are the ONLY record of a mention mutation.
    it('records the partner on every mutating route', async () => {
        await route(adminCreatePartnerMentionsRoute).handler(
            ctx,
            { partnerId: PARTNER_ID },
            { mentionedAt: AUG_01, entries: [] }
        );
        await route(adminUpdatePartnerMentionRoute).handler(
            ctx,
            { partnerId: PARTNER_ID, id: MENTION_ID },
            { internalNote: 'fixed' }
        );
        await route(adminDeletePartnerMentionRoute).handler(ctx, {
            partnerId: PARTNER_ID,
            id: MENTION_ID
        });

        expect(auditLogMock).toHaveBeenCalledTimes(3);
        for (const call of auditLogMock.mock.calls) {
            expect(call[0]).toMatchObject({ resourceType: 'partner-mention' });
        }
        expect(auditLogMock.mock.calls.map((call) => call[0].action)).toEqual([
            'create',
            'update',
            'delete'
        ]);
    });
});
