/**
 * Tool `list_benefit_usages` (HOS-2332, spec HOS-2335 §6.7, AC-C35).
 *
 * Read through a REAL `HostTradeUsageService` over fake models, so `canAnswer`
 * is checked against the service's own counterpart rule, and the scoping is
 * checked on what the service asked its model for.
 *
 * @module test/mcp/tools/host-trade/list-benefit-usages
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actorFor,
    buildUsageService,
    context,
    HOST_PROVIDER_ID,
    OTHER_HOST_ID,
    OWN_TRADE_ID,
    ownTrade,
    usageRow
} from './host-trade-tools.harness';

const mocks = vi.hoisted(() => ({
    usageService: undefined as unknown,
    getOwn: vi.fn()
}));

vi.mock('../../../../src/mcp/tools/host-trade/host-trade-tool-services', () => ({
    getHostTradeUsageToolService: () => mocks.usageService,
    getHostTradeToolService: () => ({ getOwn: mocks.getOwn })
}));

import { listBenefitUsagesTool } from '../../../../src/mcp/tools/host-trade/list-benefit-usages';
import {
    MCP_RESULT_MAX_CHARS,
    measureResultChars
} from '../../../../src/mcp/tools/response-budget';
import { runTool } from '../../../../src/mcp/tools/run-tool';

const PROVIDER_DECLARED = usageRow({
    id: 'c1111111-1111-4111-8111-111111111111',
    createdAt: new Date('2026-11-05T00:00:00Z'),
    note: 'Arreglo de la canilla'
});
const OWN_HOST_DECLARATION = usageRow({
    id: 'c3333333-3333-4333-8333-333333333333',
    declaredBy: 'HOST',
    declaredById: HOST_PROVIDER_ID,
    createdAt: new Date('2026-11-03T00:00:00Z')
});
const HOST_DECLARED_ON_OWN = usageRow({
    id: 'c2222222-2222-4222-8222-222222222222',
    hostTradeId: OWN_TRADE_ID,
    hostUserId: OTHER_HOST_ID,
    declaredBy: 'HOST',
    declaredById: OTHER_HOST_ID,
    createdAt: new Date('2026-11-04T00:00:00Z')
});
const OWN_PROVIDER_DECLARATION = usageRow({
    id: 'c4444444-4444-4444-8444-444444444444',
    hostTradeId: OWN_TRADE_ID,
    hostUserId: 'f0000000-0000-4000-8000-000000000000',
    declaredBy: 'PROVIDER',
    declaredById: HOST_PROVIDER_ID,
    createdAt: new Date('2026-11-01T00:00:00Z')
});
const ROWS = [
    PROVIDER_DECLARED,
    OWN_HOST_DECLARATION,
    HOST_DECLARED_ON_OWN,
    OWN_PROVIDER_DECLARATION
];

let fakes: ReturnType<typeof buildUsageService>;

beforeEach(() => {
    vi.clearAllMocks();
    fakes = buildUsageService(ROWS);
    mocks.usageService = fakes.service;
    mocks.getOwn.mockResolvedValue({ data: { trade: ownTrade() } });
});

const list = (input: Record<string, unknown> = {}, actor = actorFor()) =>
    runTool({ definition: listBenefitUsagesTool, actor, input, context });

/** The data of a successful call. */
async function listData(input: Record<string, unknown> = {}, actor = actorFor()) {
    const outcome = await list(input, actor);
    if (!outcome.ok) {
        throw new Error(outcome.failure.message);
    }
    return outcome.data;
}

describe('AC-C35: the host-provider sees both sides with the correct side and canAnswer', () => {
    it('lists the host side and the provider side, newest first', async () => {
        // Act
        const data = await listData();

        // Assert
        expect(data.items.map((item) => [item.id, item.side, item.canAnswer])).toEqual([
            [PROVIDER_DECLARED.id, 'host', true],
            [HOST_DECLARED_ON_OWN.id, 'provider', true],
            [OWN_HOST_DECLARATION.id, 'host', false],
            [OWN_PROVIDER_DECLARATION.id, 'provider', false]
        ]);
        expect(data.total).toBe(4);
        expect(data.isProvider).toBe(true);
        expect(data.providerPanelUrl).toMatch(/\/mi-cuenta\/proveedor\/$/);
    });

    it('decides canAnswer from the row, not the role: the same with no roles', async () => {
        // Act
        const withRole = await listData();
        const withoutRoles = await listData({}, actorFor(HOST_PROVIDER_ID, { roles: [] }));

        // Assert
        expect(withoutRoles.items).toEqual(withRole.items);
    });

    it('never answers anything that is no longer pending', async () => {
        // Arrange
        fakes = buildUsageService([{ ...PROVIDER_DECLARED, status: 'CONFIRMED' }]);
        mocks.usageService = fakes.service;

        // Act
        const data = await listData({ side: 'host' });

        // Assert
        expect(data.items[0]?.canAnswer).toBe(false);
    });
});

describe('scoping, as the routes scope it', () => {
    it('reads the host side for the actor, never for a parameter', async () => {
        // Act
        await listData({ side: 'host' });

        // Assert
        expect(fakes.usageModel.findAll.mock.calls[0]?.[0]).toMatchObject({
            hostUserId: HOST_PROVIDER_ID
        });
    });

    it('reads the provider side only for the listing getOwn returned', async () => {
        // Act
        await listData({ side: 'provider' });

        // Assert
        expect(mocks.getOwn).toHaveBeenCalledWith(
            expect.objectContaining({ id: HOST_PROVIDER_ID })
        );
        expect(fakes.usageModel.findAll.mock.calls[0]?.[0]).toMatchObject({
            hostTradeId: OWN_TRADE_ID
        });
    });

    it('has no provider side for an account without a directory listing', async () => {
        // Arrange
        mocks.getOwn.mockResolvedValue({ data: { trade: null } });

        // Act
        const data = await listData();

        // Assert
        expect(data.isProvider).toBe(false);
        expect(data.providerPanelUrl).toBeUndefined();
        expect(data.items.every((item) => item.side === 'host')).toBe(true);
    });

    it('pendingMine reads the two inboxes: host /usages/pending and provider PENDING+HOST', async () => {
        // Act
        const data = await listData({ pendingMine: true });

        // Assert
        expect(fakes.usageModel.findPendingForUser).toHaveBeenCalledWith(
            HOST_PROVIDER_ID,
            expect.anything(),
            undefined
        );
        expect(fakes.usageModel.findAll.mock.calls[0]?.[0]).toMatchObject({
            hostTradeId: OWN_TRADE_ID,
            status: 'PENDING',
            declaredBy: 'HOST'
        });
        expect(data.items.map((item) => item.id)).toEqual([
            PROVIDER_DECLARED.id,
            HOST_DECLARED_ON_OWN.id
        ]);
        expect(data.items.every((item) => item.canAnswer)).toBe(true);
    });

    it('refuses pendingMine with a status other than PENDING', async () => {
        // Act
        const outcome = await list({ pendingMine: true, status: 'CONFIRMED' });

        // Assert
        expect(!outcome.ok && outcome.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('refuses an unverified email, like the routes', async () => {
        // Act
        const outcome = await list({}, actorFor(HOST_PROVIDER_ID, { emailVerified: false }));

        // Assert
        expect(!outcome.ok && outcome.failure.code).toBe(ServiceErrorCode.EMAIL_NOT_VERIFIED);
    });
});

describe('what each row says', () => {
    it('names the provider on the host side and wraps third-party text', async () => {
        // Act
        const data = await listData({ side: 'host' });
        const row = data.items.find((item) => item.id === PROVIDER_DECLARED.id);

        // Assert
        expect(row?.counterpartName).toContain('<untrusted_data source="provider_listing">');
        expect(row?.counterpartName).toContain('Electricidad Sur');
        expect(row?.note).toContain('<untrusted_data source="usage_note">');
    });

    it('names a host on the provider side only when the pair is linked', async () => {
        // Act
        const data = await listData({ side: 'provider' });

        // Assert
        const linked = data.items.find((item) => item.id === HOST_DECLARED_ON_OWN.id);
        const unlinked = data.items.find((item) => item.id === OWN_PROVIDER_DECLARATION.id);
        expect(linked?.counterpartName).toContain('<untrusted_data source="host_name">');
        expect(linked?.counterpartName).toContain('Ana');
        expect(unlinked?.counterpartName).toBeNull();
    });

    it('carries no host id, email, channel or audit column', async () => {
        // Act
        const data = await listData();

        // Assert
        const keys = new Set(data.items.flatMap((item) => Object.keys(item)));
        for (const hidden of [
            'hostUserId',
            'declaredById',
            'rejectedById',
            'confirmedById',
            'creationChannel',
            'email'
        ]) {
            expect(keys.has(hidden), hidden).toBe(false);
        }
    });

    it('pages "both" after merging the two sides', async () => {
        // Act
        const first = await listData({ pageSize: 3 });
        const second = await listData({ pageSize: 3, page: 2 });

        // Assert
        expect(first.items).toHaveLength(3);
        expect(first.hasMore).toBe(true);
        expect(second.items.map((item) => item.id)).toEqual([OWN_PROVIDER_DECLARATION.id]);
        expect(second.hasMore).toBe(false);
    });
});

describe('response budget', () => {
    it('stays inside the budget with 20 rows of long names and notes per side', async () => {
        // Arrange
        const long = (index: number, overrides: Record<string, unknown>) =>
            usageRow({
                id: `c${String(index).padStart(7, '0')}-1111-4111-8111-111111111111`,
                note: 'N'.repeat(300),
                rejectionNote: 'R'.repeat(300),
                ...overrides
            });
        fakes = buildUsageService([
            ...Array.from({ length: 20 }, (_, index) => long(index, {})),
            ...Array.from({ length: 20 }, (_, index) =>
                long(index + 20, {
                    hostTradeId: OWN_TRADE_ID,
                    hostUserId: OTHER_HOST_ID,
                    declaredBy: 'HOST'
                })
            )
        ]);
        fakes.hostTradeModel.findByIds.mockImplementation(async (ids: readonly string[]) =>
            ids.map((id) => ({ id, slug: 'x', name: 'P'.repeat(5000), ownerUserId: 'o' }))
        );
        mocks.usageService = fakes.service;
        mocks.getOwn.mockResolvedValue({
            data: { trade: { ...ownTrade(), name: 'M'.repeat(5000) } }
        });

        // Act
        const data = await listData({ pageSize: 20 });

        // Assert
        expect(data.items).toHaveLength(20);
        expect(measureResultChars({ value: data })).toBeLessThanOrEqual(MCP_RESULT_MAX_CHARS);
    });
});
