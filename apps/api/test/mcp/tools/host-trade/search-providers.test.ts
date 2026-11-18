/**
 * Tool `search_providers` (HOS-2332, spec HOS-2335 §6.7, AC-C34).
 *
 * The directory read is the route's own service call (`listForHost`), faked
 * here at its answer: what it returns IS the host's scope. The tool may only
 * narrow it, page it and project it to the route's public shape.
 *
 * @module test/mcp/tools/host-trade/search-providers
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actorFor, context, HOST_PROVIDER_ID } from './host-trade-tools.harness';

const mocks = vi.hoisted(() => ({
    listForHost: vi.fn(),
    destinations: vi.fn()
}));

vi.mock('../../../../src/mcp/tools/host-trade/host-trade-tool-services', () => ({
    getHostTradeToolService: () => ({ listForHost: mocks.listForHost }),
    getHostTradeUsageToolService: () => {
        throw new Error('the directory search never reads usages');
    }
}));
vi.mock('../../../../src/mcp/tools/listing/listing-creation-catalog', () => ({
    listCreationDestinations: mocks.destinations
}));

import {
    matchesProviderQuery,
    searchProvidersTool
} from '../../../../src/mcp/tools/host-trade/search-providers';
import {
    MCP_RESULT_MAX_CHARS,
    measureResultChars
} from '../../../../src/mcp/tools/response-budget';
import { runTool } from '../../../../src/mcp/tools/run-tool';

const CDU = 'd1111111-1111-4111-8111-111111111111';
const COLON = 'd2222222-2222-4222-8222-222222222222';

/** A directory row as the service returns it: the full entity, hidden columns included. */
const trade = (overrides: Record<string, unknown> = {}) => ({
    id: 'a1111111-1111-4111-8111-111111111111',
    slug: 'plomeria-sur',
    name: 'Plomería Sur',
    category: null,
    categories: [
        {
            id: 'e1111111-1111-4111-8111-111111111111',
            slug: 'plomeria',
            nameI18n: { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento' },
            groupSlug: 'instalaciones'
        }
    ],
    contact: '+54 3442 111111',
    benefit: '15% de descuento en mano de obra',
    benefitType: 'PERCENTAGE',
    benefitValue: 15,
    pendingBenefit: 'Algo que todavía no aprobó nadie',
    destinationId: CDU,
    is24h: false,
    scheduleText: 'Lun a vie 8 a 18',
    confirmedUsesCount: 12,
    distinctHostsCount: 5,
    reviewsCount: 3,
    averageRating: 4.5,
    benefitRespectedCount: 3,
    ownerUserId: 'f0000000-0000-4000-8000-000000000000',
    declarationSuspendedAt: new Date('2026-10-01T00:00:00Z'),
    declarationSuspendReason: 'Automatic: 3 declarations rejected',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides
});

const ROWS = [
    trade(),
    trade({
        id: 'a2222222-2222-4222-8222-222222222222',
        slug: 'electricidad-norte',
        name: 'Electricidad Norte',
        benefit: 'Visita sin cargo',
        destinationId: COLON,
        categories: []
    }),
    trade({
        id: 'a3333333-3333-4333-8333-333333333333',
        slug: 'limpieza-ya',
        name: 'Limpieza Ya',
        benefit: 'Descuento del 10% en la primera limpieza',
        categories: []
    })
];

beforeEach(() => {
    vi.clearAllMocks();
    mocks.listForHost.mockResolvedValue({ data: { trades: ROWS } });
    mocks.destinations.mockResolvedValue([
        { id: CDU, name: 'Concepción del Uruguay' },
        { id: COLON, name: 'Colón' }
    ]);
});

const search = (input: Record<string, unknown> = {}, actor = actorFor()) =>
    runTool({ definition: searchProvidersTool, actor, input, context });

async function searchData(input: Record<string, unknown> = {}) {
    const outcome = await search(input);
    if (!outcome.ok) {
        throw new Error(outcome.failure.message);
    }
    return outcome.data;
}

describe('AC-C34: exactly the rows listForHost returns, filtered by the inputs', () => {
    it('returns every scoped row when no filter is given', async () => {
        // Act
        const data = await searchData();

        // Assert
        expect(mocks.listForHost).toHaveBeenCalledWith(
            expect.objectContaining({ id: HOST_PROVIDER_ID }),
            undefined,
            undefined
        );
        expect(data.items.map((item) => item.slug)).toEqual([
            'plomeria-sur',
            'electricidad-norte',
            'limpieza-ya'
        ]);
        expect(data.total).toBe(3);
    });

    it('hands the category to the service, as the route hands `categories`', async () => {
        // Act
        await searchData({ category: 'plomeria' });

        // Assert
        expect(mocks.listForHost).toHaveBeenCalledWith(expect.anything(), undefined, {
            categories: ['plomeria']
        });
    });

    it('filters by destination inside the scoped list only', async () => {
        // Act
        const data = await searchData({ destinationId: COLON });

        // Assert
        expect(data.items.map((item) => item.slug)).toEqual(['electricidad-norte']);
        expect(data.items[0]?.destination).toEqual({ id: COLON, name: 'Colón' });
    });

    it('matches every query word in the name or benefit, ignoring accents and case', async () => {
        // Act
        const data = await searchData({ query: 'DESCUENTO limpieza' });

        // Assert
        expect(data.items.map((item) => item.slug)).toEqual(['limpieza-ya']);
        expect(matchesProviderQuery({ row: ROWS[0] ?? trade(), queryWords: ['plomeria'] })).toBe(
            true
        );
    });

    it('never surfaces a provider the service did not return', async () => {
        // Arrange: the service scoped the host to nothing.
        mocks.listForHost.mockResolvedValue({ data: { trades: [] } });

        // Act
        const data = await searchData({ query: 'plomería', destinationId: CDU });

        // Assert
        expect(data.items).toEqual([]);
        expect(data.total).toBe(0);
    });

    it('pages in the tool', async () => {
        // Act
        const first = await searchData({ pageSize: 2 });
        const second = await searchData({ pageSize: 2, page: 2 });

        // Assert
        expect(first.items).toHaveLength(2);
        expect(first.hasMore).toBe(true);
        expect(second.items.map((item) => item.slug)).toEqual(['limpieza-ya']);
        expect(second.hasMore).toBe(false);
    });
});

describe('projection and untrusted text', () => {
    it('returns only fields of the route projection, never the hidden columns', async () => {
        // Act
        const data = await searchData();
        const serialized = JSON.stringify(data);

        // Assert
        for (const hidden of [
            'Algo que todavía no aprobó nadie',
            'Automatic: 3 declarations rejected',
            'f0000000-0000-4000-8000-000000000000',
            'PERCENTAGE'
        ]) {
            expect(serialized, hidden).not.toContain(hidden);
        }
    });

    it('wraps every text the provider wrote', async () => {
        // Act
        const [item] = (await searchData()).items;

        // Assert
        for (const text of [item?.name, item?.benefit, item?.contact, item?.schedule]) {
            expect(text).toContain('<untrusted_data source="provider_listing">');
        }
        expect(item?.categories).toEqual([{ slug: 'plomeria', label: 'Plomería' }]);
    });

    it('links each provider to its directory page and its declare page', async () => {
        // Act
        const [item] = (await searchData()).items;

        // Assert
        expect(item?.directoryUrl).toMatch(
            /\/es\/mi-cuenta\/directorio-proveedores\/plomeria-sur\/$/
        );
        expect(item?.declareUsageUrl).toMatch(
            /\/es\/mi-cuenta\/directorio-proveedores\/plomeria-sur\/registrar-uso\/$/
        );
    });

    it('stays inside the response budget with 20 long providers', async () => {
        // Arrange
        mocks.listForHost.mockResolvedValue({
            data: {
                trades: Array.from({ length: 20 }, (_, index) =>
                    trade({
                        slug: `proveedor-${index}`,
                        name: 'N'.repeat(150),
                        benefit: 'B'.repeat(5000),
                        contact: 'C'.repeat(300),
                        scheduleText: 'S'.repeat(300)
                    })
                )
            }
        });

        // Act
        const data = await searchData({ pageSize: 20 });

        // Assert
        expect(data.items).toHaveLength(20);
        expect(data.items.every((item) => item.textTruncated)).toBe(true);
        expect(measureResultChars({ value: data })).toBeLessThanOrEqual(MCP_RESULT_MAX_CHARS);
    });
});

describe('the response budget never overflows (MEDIUM-2)', () => {
    it('20 providers whose texts are quotes and control characters', async () => {
        // Arrange
        const hostile = '"\u0001\u0002\n\t\u001f'.repeat(20).slice(0, 120);
        mocks.listForHost.mockResolvedValue({
            data: {
                trades: Array.from({ length: 20 }, (_, index) =>
                    trade({
                        slug: `proveedor-${index}`,
                        name: hostile,
                        benefit: hostile.repeat(40),
                        contact: hostile,
                        scheduleText: hostile
                    })
                )
            }
        });

        // Act
        const data = await searchData({ pageSize: 20 });

        // Assert
        expect(measureResultChars({ value: data })).toBeLessThanOrEqual(MCP_RESULT_MAX_CHARS);
        expect(data.items.length).toBeGreaterThan(0);
        expect(data.items.length + (data.omittedItems ?? 0)).toBe(20);
        if (data.omittedItems) {
            expect(data.hasMore).toBe(true);
        }
    });
});

describe('a query of filler words only (LOW-4)', () => {
    it.each([
        'de la',
        'para que con',
        'el'
    ])('refuses %j instead of returning everything', async (query) => {
        // Act
        const outcome = await search({ query });

        // Assert
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
            expect(outcome.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        }
        expect(mocks.listForHost).not.toHaveBeenCalled();
    });

    it('ignores the filler words of a query that has a real one', async () => {
        // Act
        const data = await searchData({ query: 'descuento de la limpieza' });

        // Assert
        expect(data.items.map((item) => item.slug)).toEqual(['limpieza-ya']);
    });
});

describe('refusals', () => {
    it('maps a non-host FORBIDDEN to a message and the directory link', async () => {
        // Arrange
        mocks.listForHost.mockResolvedValue({
            error: { code: ServiceErrorCode.FORBIDDEN, message: 'Permission denied' }
        });

        // Act
        const outcome = await search();

        // Assert
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
            expect(outcome.failure.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(outcome.failure.message).toContain('beneficio para anfitriones');
            expect(outcome.failure.action?.url).toMatch(
                /\/es\/mi-cuenta\/directorio-proveedores\/$/
            );
        }
    });

    it('refuses an unverified email, like the route', async () => {
        // Act
        const outcome = await search({}, actorFor(HOST_PROVIDER_ID, { emailVerified: false }));

        // Assert
        expect(!outcome.ok && outcome.failure.code).toBe(ServiceErrorCode.EMAIL_NOT_VERIFIED);
        expect(mocks.listForHost).not.toHaveBeenCalled();
    });
});
