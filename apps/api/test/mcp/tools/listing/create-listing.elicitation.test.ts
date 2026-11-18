/**
 * HOS-2247 — `create_listing` confirmed out of band (spec §5.7, D-17): on a
 * client that declared form elicitation the preview issues a bound state and
 * the client's form, never a token; the confirmed retry writes exactly the
 * point the form showed (AC-C64), a decline or a forged state writes nothing,
 * and a token from such a client is refused (AC-C63). Same mocks as
 * `create-listing.binding.test.ts`; the tool runs through
 * `executeConfirmableTool`, the executor the MCP binder uses.
 *
 * @module test/mcp/tools/listing/create-listing.elicitation
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CONFIRMATION_TOKEN_REFUSED_REASON,
    ELICITATION_REASON_MESSAGES,
    ELICITATION_STATE_INVALID_REASON
} from '../../../../src/mcp/tools/elicitation-confirmation';
import type {
    ToolConfirmationDecision,
    ToolContext
} from '../../../../src/mcp/tools/tool-definition';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    actorFor,
    CLIENT,
    FULL_MAPS_POINT,
    givenCreateServices,
    givenDestinations,
    givenPrecheck,
    makeFakeRedis,
    mocks,
    previewToken,
    SHORT_MAPS_URL,
    shortLinkFetcher,
    VALID_INPUT,
    VERTICALS
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
// Hoisted, not read from the harness: the harness imports @repo/service-core itself.
const { conflict, decideSpy } = vi.hoisted(() => ({ conflict: vi.fn(), decideSpy: vi.fn() }));
vi.mock('../../../../src/middlewares/listing-access', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/middlewares/listing-access')>();
    decideSpy.mockImplementation(actual.decideListingAccess);
    return { ...actual, decideListingAccess: decideSpy };
});
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, assertNoOwnLocationConflict: conflict };
});

type Services = ReturnType<typeof givenCreateServices>;

/** A capable client's context, optionally carrying the retry's answer. */
const capable = (answer?: {
    readonly stateId: string;
    readonly decision: ToolConfirmationDecision;
}): ToolContext => ({
    channel: 'mcp',
    clientId: CLIENT,
    confirmation: { elicitationSupported: true, ...(answer ? { answer } : {}) }
});

/** Runs `create_listing` the way the MCP binder does (confirmation requests surface). */
async function runConfirmable(
    input: Record<string, unknown>,
    context: ToolContext,
    fetchHop?: ReturnType<typeof shortLinkFetcher>
) {
    const { buildCreateListingTool } = await import(
        '../../../../src/mcp/tools/listing/create-listing'
    );
    const { executeConfirmableTool } = await import('../../../../src/mcp/tools/run-tool');
    const definition = buildCreateListingTool(fetchHop ? { fetchHop } : {});
    return executeConfirmableTool({
        definition,
        actor: actorFor(),
        input: definition.inputSchema.parse(input),
        context
    });
}

const INPUT = {
    ...VALID_INPUT.venue,
    mapsUrl: SHORT_MAPS_URL,
    street: 'Calle Falsa',
    number: '123'
};

describe('create_listing confirmed out of band', () => {
    let fake: ReturnType<typeof makeFakeRedis>;
    let services: Services;

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
        conflict.mockReset();
        decideSpy.mockClear();
        fake = makeFakeRedis();
        mocks.redis = fake.redis;
        mocks.coverage.mockResolvedValue({ sources: ['TRIAL'] });
        conflict.mockResolvedValue(undefined);
        givenPrecheck();
        givenDestinations();
        services = givenCreateServices();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const writes = () =>
        VERTICALS.reduce((total, vertical) => total + services[vertical].mock.calls.length, 0);

    /** Step 1: the confirmation request and its state id. */
    async function ask() {
        const outcome = await runConfirmable(INPUT, capable(), shortLinkFetcher());
        if (outcome.ok !== 'confirmation_required')
            throw new Error('expected a confirmation request');
        return outcome.request;
    }

    it('the preview asks the form with the listing and the resolved point, never a token, and writes nothing', async () => {
        // Act
        const request = await ask();

        // Assert
        expect(request.message).toContain('La Parrilla');
        expect(request.message).toContain(`${FULL_MAPS_POINT.lat}, ${FULL_MAPS_POINT.lng}`);
        expect(request.message).toContain(
            `https://www.google.com/maps?q=${FULL_MAPS_POINT.lat},${FULL_MAPS_POINT.lng}`
        );
        expect(request.message).toContain('Calle Falsa 123');
        expect(request.message).not.toContain('confirmationToken');
        expect(writes()).toBe(0);
    });

    it('AC-C64: the confirmed retry writes exactly the point the form showed, once', async () => {
        // Arrange: the short link would resolve elsewhere by now; only the stash counts.
        const { stateId } = await ask();
        const movedLink = shortLinkFetcher('https://www.google.com/maps/@-31.1,-59.9,17z');

        // Act
        const first = await runConfirmable(
            INPUT,
            capable({ stateId, decision: 'confirm' }),
            movedLink
        );
        const replay = await runConfirmable(
            INPUT,
            capable({ stateId, decision: 'confirm' }),
            movedLink
        );

        // Assert
        expect(first.ok).toBe(true);
        expect(movedLink).not.toHaveBeenCalled();
        const body = (services.venue.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
        expect(body.location).toMatchObject({
            coordinates: { lat: String(FULL_MAPS_POINT.lat), long: String(FULL_MAPS_POINT.lng) }
        });
        expect(replay).toMatchObject({ ok: false, failure: { code: 'VALIDATION_ERROR' } });
        expect(writes()).toBe(1);
    });

    it.each([
        ['decline', 'USER_DECLINED'],
        ['cancel', 'USER_CANCELLED']
    ] as const)('a %s writes nothing and burns the state', async (decision, code) => {
        // Arrange
        const { stateId } = await ask();

        // Act
        const declined = await runConfirmable(INPUT, capable({ stateId, decision }));
        const confirmAfter = await runConfirmable(INPUT, capable({ stateId, decision: 'confirm' }));

        // Assert
        expect(declined).toMatchObject({ ok: false, failure: { code } });
        expect(confirmAfter).toMatchObject({ ok: false });
        expect(writes()).toBe(0);
    });

    it.each([
        ['a forged state', 'Zm9yZ2VkLXN0YXRlLW5vYm9keS1ldmVyLWlzc3VlZC14eHg', INPUT],
        ['a changed name', undefined, { ...INPUT, name: 'Otro nombre' }],
        ['a changed street', undefined, { ...INPUT, street: 'Otra calle' }]
    ])('%s writes nothing', async (_label, forged, commitInput) => {
        // Arrange
        const { stateId } = await ask();

        // Act
        const outcome = await runConfirmable(
            commitInput,
            capable({ stateId: forged ?? stateId, decision: 'confirm' })
        );

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: { message: ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON] }
        });
        expect(writes()).toBe(0);
    });

    it('AC-C63: a token from a capable client is refused and writes nothing', async () => {
        // Arrange: a token the same user got on a client without the capability.
        const token = await previewToken({ ...VALID_INPUT.venue });

        // Act
        const outcome = await runConfirmable(
            { ...VALID_INPUT.venue, confirmationToken: token },
            capable()
        );

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: {
                code: 'VALIDATION_ERROR',
                message: ELICITATION_REASON_MESSAGES[CONFIRMATION_TOKEN_REFUSED_REASON]
            }
        });
        expect(writes()).toBe(0);
    });
});
