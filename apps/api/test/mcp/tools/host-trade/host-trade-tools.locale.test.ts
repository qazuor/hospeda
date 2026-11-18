/**
 * HOS-2335 follow-up (known gap U-5) — every portal link of `search_providers`
 * and `list_benefit_usages` carries the locale of the call context.
 *
 * @module test/mcp/tools/host-trade/host-trade-tools.locale
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateApiEnv } from '../../../../src/utils/env';
import { expectEveryPortalUrlInLocale, PORTAL_LOCALES } from '../portal-locale.helper';
import {
    actorFor,
    buildUsageService,
    CLIENT,
    OTHER_HOST_ID,
    OWN_TRADE_ID,
    ownTrade,
    usageRow
} from './host-trade-tools.harness';

const mocks = vi.hoisted(() => ({
    usageService: undefined as unknown,
    getOwn: vi.fn(),
    listForHost: vi.fn(),
    destinations: vi.fn()
}));

vi.mock('../../../../src/mcp/tools/host-trade/host-trade-tool-services', () => ({
    getHostTradeUsageToolService: () => mocks.usageService,
    getHostTradeToolService: () => ({ getOwn: mocks.getOwn, listForHost: mocks.listForHost })
}));
vi.mock('../../../../src/mcp/tools/listing/listing-creation-catalog', () => ({
    listCreationDestinations: mocks.destinations
}));

import { listBenefitUsagesTool } from '../../../../src/mcp/tools/host-trade/list-benefit-usages';
import { searchProvidersTool } from '../../../../src/mcp/tools/host-trade/search-providers';
import { runTool } from '../../../../src/mcp/tools/run-tool';

const CDU = 'd1111111-1111-4111-8111-111111111111';

const TRADE_ROW = {
    id: 'a1111111-1111-4111-8111-111111111111',
    slug: 'plomeria-sur',
    name: 'Plomería Sur',
    category: null,
    categories: [],
    contact: '+54 3442 111111',
    benefit: '15% de descuento',
    destinationId: CDU,
    is24h: false,
    scheduleText: null,
    confirmedUsesCount: 1,
    distinctHostsCount: 1,
    reviewsCount: 0,
    averageRating: 0,
    isActive: true
};

const callerContext = (locale: (typeof PORTAL_LOCALES)[number]) =>
    ({ channel: 'mcp', clientId: CLIENT, locale }) as const;

describe('host-trade tools link in the caller locale', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listForHost.mockResolvedValue({ data: { trades: [TRADE_ROW] } });
        mocks.destinations.mockResolvedValue([{ id: CDU, name: 'Concepción del Uruguay' }]);
        mocks.usageService = buildUsageService([
            usageRow(),
            usageRow({
                id: 'c2222222-2222-4222-8222-222222222222',
                hostTradeId: OWN_TRADE_ID,
                hostUserId: OTHER_HOST_ID,
                declaredBy: 'HOST',
                declaredById: OTHER_HOST_ID
            })
        ]).service;
        mocks.getOwn.mockResolvedValue({ data: { trade: ownTrade() } });
    });

    it.each(
        PORTAL_LOCALES
    )('search_providers: directory and declare links use %s', async (locale) => {
        const outcome = await runTool({
            definition: searchProvidersTool,
            actor: actorFor(),
            input: {},
            context: callerContext(locale)
        });

        expect(outcome.ok).toBe(true);
        // directoryUrl + declareUsageUrl of the one provider
        expectEveryPortalUrlInLocale({
            output: outcome.ok ? outcome.data : null,
            locale,
            minUrls: 2
        });
    });

    it.each(
        PORTAL_LOCALES
    )('list_benefit_usages: usages and provider panel links use %s', async (locale) => {
        const outcome = await runTool({
            definition: listBenefitUsagesTool,
            actor: actorFor(),
            input: {},
            context: callerContext(locale)
        });

        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.data.providerPanelUrl).toBeDefined();
        }
        // benefitUsagesUrl + providerPanelUrl
        expectEveryPortalUrlInLocale({
            output: outcome.ok ? outcome.data : null,
            locale,
            minUrls: 2
        });
    });
});
