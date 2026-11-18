/**
 * Route tests for the owner's assistant history (HOS-2348, spec HOS-2335 §6.9).
 *
 * `GET /api/v1/protected/ai-connections/activity` runs through the REAL shared
 * reader (`McpActivityService`) and its projection; only the database model
 * underneath is an in-memory fake that filters like the real one. So what is
 * under test is the whole owner path: scope injection, the strict query, the
 * reads toggle, pagination, the response allowlist and the lost-target rule.
 *
 * - AC-C45: user A only ever gets A's rows; `userId`/`actorId`/`scope` → 400.
 * - AC-C46: no private text in the response, for every registered tool's row.
 * - AC-C47: a target A no longer owns, or that is gone, has no label and no link.
 * - AC-C50a: writes only by default; `includeReads=true` adds reads, same order.
 */
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeRow = {
    readonly id: string;
    readonly loggedAt: Date;
    readonly actorId: string | null;
    readonly data: Record<string, unknown>;
};

type FakeFilter = {
    readonly actorId?: string;
    readonly outcome?: string;
    readonly clientId?: string;
    readonly isWrite?: boolean;
    readonly page: number;
    readonly pageSize: number;
};

const fake = vi.hoisted(() => ({
    rows: [] as FakeRow[],
    listings: [] as { vertical: string; id: string; name: string; ownerId: string }[],
    lastFilter: undefined as FakeFilter | undefined
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    const model = {
        listToolCalls: async (filter: FakeFilter) => {
            fake.lastFilter = filter;
            const matching = fake.rows
                .filter((row) => filter.actorId === undefined || row.actorId === filter.actorId)
                .filter(
                    (row) =>
                        filter.isWrite === undefined ||
                        (row.data.isWrite ?? true) === filter.isWrite
                )
                .filter(
                    (row) => filter.outcome === undefined || row.data.outcome === filter.outcome
                )
                .filter(
                    (row) => filter.clientId === undefined || row.data.clientId === filter.clientId
                )
                .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());
            const start = (filter.page - 1) * filter.pageSize;
            return {
                items: matching.slice(start, start + filter.pageSize),
                total: matching.length
            };
        },
        findListingNames: async (input: { vertical: string; ids: readonly string[] }) =>
            fake.listings.filter(
                (listing) => listing.vertical === input.vertical && input.ids.includes(listing.id)
            ),
        findConversationOwners: async () => [],
        findClientNames: async (input: { clientIds: readonly string[] }) =>
            input.clientIds.map((clientId) => ({ clientId, name: `Name of ${clientId}` }))
    };
    class ReaderOverFakeModel extends orig.McpActivityService {
        constructor(
            config: ConstructorParameters<typeof orig.McpActivityService>[0],
            deps: ConstructorParameters<typeof orig.McpActivityService>[1] = {}
        ) {
            super(config, {
                ...deps,
                model: model as unknown as NonNullable<typeof deps>['model'],
                auditLogModel: {} as NonNullable<typeof deps>['auditLogModel']
            });
        }
    }
    return { ...orig, McpActivityService: ReaderOverFakeModel };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const { initApp } = await import('../../../src/app.js');
const { MCP_TOOL_DEFINITIONS } = await import('../../../src/mcp/tools/registry.js');

const URL_BASE = '/api/v1/protected/ai-connections/activity';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LISTING_OWNED = '11111111-1111-4111-8111-111111111111';
const LISTING_SOLD = '22222222-2222-4222-8222-222222222222';
const LISTING_GONE = '33333333-3333-4333-8333-333333333333';

/** Keys an owner item may carry, and the keys of its nested objects. */
const ITEM_KEYS = [
    'id',
    'loggedAt',
    'tool',
    'isWrite',
    'outcome',
    'errorCode',
    'step',
    'client',
    'target'
];
const CLIENT_KEYS = ['id', 'name'];
const TARGET_KEYS = ['type', 'id', 'label', 'url'];

let sequence = 0;

/** One audit row; ids and timestamps increase with each call. */
function row(input: {
    readonly actorId: string;
    readonly tool: string;
    readonly isWrite?: boolean;
    readonly outcome?: string;
    readonly extra?: Record<string, unknown>;
}): FakeRow {
    sequence += 1;
    const suffix = String(sequence).padStart(12, '0');
    return {
        id: `cccccccc-cccc-4ccc-8ccc-${suffix}`,
        loggedAt: new Date(Date.UTC(2026, 10, 18, 10, 0, sequence)),
        actorId: input.actorId,
        data: {
            tool: input.tool,
            outcome: input.outcome ?? 'success',
            clientId: 'client-claude',
            ...(input.isWrite === undefined ? {} : { isWrite: input.isWrite }),
            ...input.extra
        }
    };
}

function headers(actorId: string = USER_A): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

type Item = Record<string, unknown> & {
    readonly id: string;
    readonly tool: string;
    readonly target?: Record<string, unknown>;
};

async function list(query = '', actorId: string = USER_A) {
    const res = await initApp().request(`${URL_BASE}${query}`, { headers: headers(actorId) });
    const body = await res.json();
    return { res, body, items: (body.data?.items ?? []) as Item[] };
}

describe('GET /api/v1/protected/ai-connections/activity', () => {
    beforeEach(() => {
        fake.rows = [];
        fake.listings = [];
        fake.lastFilter = undefined;
    });

    describe('scope (AC-C45)', () => {
        it('returns only the session user rows, newest first', async () => {
            // Arrange
            const a1 = row({ actorId: USER_A, tool: 'update_listing_basic' });
            const b1 = row({ actorId: USER_B, tool: 'update_listing_basic' });
            const a2 = row({ actorId: USER_A, tool: 'reply_inquiry' });
            fake.rows = [a1, b1, a2];

            // Act
            const { res, items } = await list();

            // Assert
            expect(res.status).toBe(200);
            expect(items.map((item) => item.id)).toEqual([a2.id, a1.id]);
            expect(fake.lastFilter?.actorId).toBe(USER_A);
        });

        it.each([
            ['userId', USER_B],
            ['actorId', USER_B],
            ['scope', 'all'],
            ['tool', 'reply_inquiry'],
            ['access', 'read']
        ])('answers 400 to a %s param and reads nothing', async (key, value) => {
            fake.rows = [row({ actorId: USER_B, tool: 'reply_inquiry' })];

            const { res, body } = await list(`?${key}=${encodeURIComponent(value)}`);

            expect(res.status).toBe(400);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(fake.lastFilter).toBeUndefined();
        });

        it('answers 401 without a session, before any read', async () => {
            const res = await initApp().request(`${URL_BASE}?userId=${USER_B}`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(401);
            expect(fake.lastFilter).toBeUndefined();
        });
    });

    describe('reads toggle (D-12, AC-C50a)', () => {
        it('lists writes only by default; a row without isWrite counts as a write', async () => {
            // Arrange
            const legacyWrite = row({ actorId: USER_A, tool: 'reply_inquiry' });
            const read = row({ actorId: USER_A, tool: 'get_listing', isWrite: false });
            const write = row({ actorId: USER_A, tool: 'update_listing_basic', isWrite: true });
            fake.rows = [legacyWrite, read, write];

            // Act
            const { items } = await list();

            // Assert
            expect(items.map((item) => item.id)).toEqual([write.id, legacyWrite.id]);
            expect(fake.lastFilter?.isWrite).toBe(true);
        });

        it('adds the reads with includeReads=true, in the same order', async () => {
            const legacyWrite = row({ actorId: USER_A, tool: 'reply_inquiry' });
            const read = row({ actorId: USER_A, tool: 'get_listing', isWrite: false });
            const write = row({ actorId: USER_A, tool: 'update_listing_basic', isWrite: true });
            fake.rows = [legacyWrite, read, write];

            const { items } = await list('?includeReads=true');

            expect(items.map((item) => item.id)).toEqual([write.id, read.id, legacyWrite.id]);
            expect(fake.lastFilter?.isWrite).toBeUndefined();
        });

        it('includeReads=false is writes only, and a non-literal is a 400', async () => {
            fake.rows = [row({ actorId: USER_A, tool: 'get_listing', isWrite: false })];

            expect((await list('?includeReads=false')).items).toEqual([]);
            expect((await list('?includeReads=1')).res.status).toBe(400);
        });
    });

    describe('pagination', () => {
        it('pages 20 at a time by default and reports the total', async () => {
            fake.rows = Array.from({ length: 23 }, () =>
                row({ actorId: USER_A, tool: 'update_listing_basic' })
            );

            const first = await list();
            const second = await list('?page=2');

            expect(first.items).toHaveLength(20);
            expect(first.body.data.pagination).toMatchObject({
                page: 1,
                pageSize: 20,
                total: 23,
                totalPages: 2
            });
            expect(second.items).toHaveLength(3);
            expect(second.items[0]?.id).toBe(fake.rows[2]?.id);
        });

        it('refuses a page size over 20', async () => {
            expect((await list('?pageSize=21')).res.status).toBe(400);
        });
    });

    describe('privacy (AC-C46)', () => {
        it('carries only allowlisted keys and no private text, for every registered tool', async () => {
            // Arrange: each row hides private text in every place `data` could carry it.
            fake.rows = MCP_TOOL_DEFINITIONS.map((definition) =>
                row({
                    actorId: USER_A,
                    tool: definition.name,
                    isWrite: definition.isWrite,
                    extra: {
                        text: 'SECRET reply text',
                        guestName: 'SECRET guest',
                        guestEmail: 'secret@guest.test',
                        contentLength: 17,
                        details: { step: 'preview', description: 'SECRET description' }
                    }
                })
            );

            // Act: every page, so a registry longer than one page is still covered.
            const items: Item[] = [];
            for (let page = 1; items.length < fake.rows.length; page += 1) {
                const result = await list(`?includeReads=true&page=${page}`);
                expect(result.res.status).toBe(200);
                expect(result.items.length).toBeGreaterThan(0);
                items.push(...result.items);
            }

            // Assert
            expect(items.map((item) => item.tool).sort()).toEqual(
                MCP_TOOL_DEFINITIONS.map((definition) => definition.name).sort()
            );
            for (const item of items) {
                expect(ITEM_KEYS).toEqual(expect.arrayContaining(Object.keys(item)));
                expect(CLIENT_KEYS).toEqual(
                    expect.arrayContaining(Object.keys(item.client as object))
                );
            }
            expect(JSON.stringify(items).toLowerCase()).not.toContain('secret');
        });
    });

    describe('targets (AC-C47)', () => {
        it('labels and links an owned listing; a sold or deleted one has neither', async () => {
            // Arrange
            fake.listings = [
                {
                    vertical: 'accommodation',
                    id: LISTING_OWNED,
                    name: 'Casa del Río',
                    ownerId: USER_A
                },
                { vertical: 'accommodation', id: LISTING_SOLD, name: 'Ajena', ownerId: USER_B }
            ];
            const target = (id: string) => ({ resourceType: 'accommodation', resourceId: id });
            const owned = row({
                actorId: USER_A,
                tool: 'update_listing_basic',
                extra: target(LISTING_OWNED)
            });
            const sold = row({
                actorId: USER_A,
                tool: 'update_listing_basic',
                extra: target(LISTING_SOLD)
            });
            const gone = row({
                actorId: USER_A,
                tool: 'update_listing_basic',
                extra: target(LISTING_GONE)
            });
            fake.rows = [owned, sold, gone];

            // Act
            const { items } = await list();
            const byId = new Map(items.map((item) => [item.id, item]));

            // Assert
            expect(byId.get(owned.id)?.target).toEqual({
                type: 'accommodation',
                id: LISTING_OWNED,
                label: 'Casa del Río',
                url: expect.stringMatching(
                    new RegExp(`/es/mi-cuenta/propiedades/${LISTING_OWNED}/editar/$`)
                )
            });
            expect(byId.get(sold.id)?.target).toEqual({ type: 'accommodation', id: LISTING_SOLD });
            expect(byId.get(gone.id)?.target).toEqual({ type: 'accommodation', id: LISTING_GONE });
            for (const item of items) {
                expect(TARGET_KEYS).toEqual(expect.arrayContaining(Object.keys(item.target ?? {})));
            }
        });
    });
});
