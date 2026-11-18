/**
 * HOS-2335 follow-up (known gap U-5) — every portal link of `create_listing`
 * (the committed draft's editor link and its next steps) and of
 * `get_listing_creation_guide` carries the locale of the call context.
 *
 * @module test/mcp/tools/listing/listing-tools.locale
 */

import { VerticalEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getListingCreationGuideTool } from '../../../../src/mcp/tools/listing/get-listing-creation-guide';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { validateApiEnv } from '../../../../src/utils/env';
import { expectEveryPortalUrlInLocale, PORTAL_LOCALES } from '../portal-locale.helper';
import {
    actorFor,
    context,
    givenCreateServices,
    givenDestinations,
    givenPrecheck,
    makeFakeRedis,
    mocks,
    previewToken,
    run,
    VALID_INPUT
} from './create-listing.harness';

vi.mock('../../../../src/utils/listing-access/ports', async () => {
    const { mocks } = await import('./create-listing.harness');
    return {
        getListingAccessPorts: () => ({
            loadFacts: mocks.loadFacts,
            billing: { coverage: mocks.coverage },
            effectiveSet: mocks.effectiveSet,
            preTrialDraftLimits: mocks.preTrialDraftLimits
        })
    };
});
vi.mock('../../../../src/middlewares/cache', async (importOriginal) => {
    const { mocks } = await import('./create-listing.harness');
    const actual = await importOriginal<typeof import('../../../../src/middlewares/cache')>();
    return { ...actual, invalidateCacheByPathPrefix: mocks.invalidateCache };
});
vi.mock('../../../../src/lib/analytics-client', async (importOriginal) => {
    const { mocks } = await import('./create-listing.harness');
    const actual = await importOriginal<typeof import('../../../../src/lib/analytics-client')>();
    return { ...actual, captureServerAnalyticsEvent: mocks.analytics };
});
vi.mock('../../../../src/services/publish-precheck.service', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { resolvePublishPrecheck: mocks.precheck };
});
vi.mock('../../../../src/utils/redis', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { getRedisClient: vi.fn(async () => mocks.redis) };
});
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, assertNoOwnLocationConflict: vi.fn(async () => undefined) };
});

const DRAFT_ID = 'e1111111-1111-4111-8111-111111111111';

describe('listing tools link in the caller locale', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        for (const mock of [
            mocks.loadFacts,
            mocks.coverage,
            mocks.effectiveSet,
            mocks.preTrialDraftLimits,
            mocks.record,
            mocks.invalidateCache,
            mocks.analytics,
            mocks.precheck
        ]) {
            mock.mockReset();
        }
        mocks.redis = makeFakeRedis().redis;
        mocks.coverage.mockResolvedValue({ sources: ['TRIAL'] });
        givenPrecheck();
        givenDestinations();
        givenCreateServices();
    });

    it.each(
        PORTAL_LOCALES
    )('create_listing: the editor link and every next step use %s', async (locale) => {
        const input = { ...VALID_INPUT[VerticalEnum.EXPERIENCE] };
        const token = await previewToken(input);

        const outcome = await run(
            { ...input, confirmationToken: token },
            { context: { ...context, locale } as never }
        );

        expect(outcome.ok).toBe(true);
        if (!outcome.ok || outcome.data.status !== 'created') {
            throw new Error('expected a created draft');
        }
        // editorUrl + amenities, photos, location and publish steps
        expectEveryPortalUrlInLocale({ output: outcome.data, locale, minUrls: 5 });
        expect(outcome.data.nextSteps.map((step) => step.step)).toContain('location');
    });

    it.each(
        PORTAL_LOCALES
    )('get_listing_creation_guide: the create page and the drafts editor links use %s', async (locale) => {
        mocks.precheck.mockResolvedValue({
            currentCount: 1,
            maxAllowed: 1,
            hasQuota: false,
            draftCount: 1,
            drafts: [{ id: DRAFT_ID, slug: 'mi-cabana', name: 'Mi cabaña' }],
            decision: 'pick_draft_delete_or_upgrade'
        });

        const outcome = await runTool({
            definition: getListingCreationGuideTool,
            actor: actorFor(),
            input: { vertical: VerticalEnum.ACCOMMODATION },
            context: { ...context, locale }
        });

        expect(outcome.ok).toBe(true);
        expect(outcome.ok && outcome.data.existingDrafts).toHaveLength(1);
        // createPageUrl + the draft's editorUrl
        expectEveryPortalUrlInLocale({
            output: outcome.ok ? outcome.data : null,
            locale,
            minUrls: 2
        });
    });
});
