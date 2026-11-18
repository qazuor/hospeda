/**
 * HOS-2247, owner decisions D-17/D-19 — publishing through
 * `set_listing_publication` on a client that declared form elicitation: the
 * preview asks the client's form (never a token) and publishes nothing; the
 * confirmed retry publishes once; a decline, a cancel, a forged state or a
 * token publish nothing; `pause` stays one step. Same setup as
 * `set-listing-publication.confirmation.test.ts`.
 *
 * @module test/mcp/tools/listing/set-listing-publication.elicitation
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ExperienceService,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness } from './set-listing-publication.harness';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    preTrialDraftLimits: vi.fn(),
    record: vi.fn(),
    capturePublished: vi.fn(),
    redis: undefined as unknown
}));

vi.mock('../../../../src/utils/redis', () => ({
    getRedisClient: vi.fn(async () => mocks.redis)
}));

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet,
        preTrialDraftLimits: mocks.preTrialDraftLimits
    })
}));

vi.mock('../../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mocks.record }));

vi.mock('../../../../src/services/listing-publication/accommodation-published-analytics', () => ({
    captureAccommodationPublished: mocks.capturePublished
}));

vi.mock('../../../../src/utils/accommodation-catalog-relations', () => ({
    fetchProtectedAmenities: vi.fn(async () => []),
    fetchProtectedFeatures: vi.fn(async () => [])
}));

vi.mock('../../../../src/utils/listing-catalog-relations', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/utils/listing-catalog-relations')>()),
    fetchVenueAmenities: vi.fn(async () => []),
    fetchVenueFeatures: vi.fn(async () => []),
    fetchExperienceAmenities: vi.fn(async () => []),
    fetchExperienceFeatures: vi.fn(async () => [])
}));

import {
    ELICITATION_REASON_MESSAGES,
    ELICITATION_STATE_INVALID_REASON
} from '../../../../src/mcp/tools/elicitation-confirmation';
import { setListingPublicationTool } from '../../../../src/mcp/tools/listing/set-listing-publication';
import { executeConfirmableTool, runTool } from '../../../../src/mcp/tools/run-tool';
import type {
    ToolConfirmationDecision,
    ToolContext
} from '../../../../src/mcp/tools/tool-definition';
import { ListingPublicationService } from '../../../../src/services/listing-publication/listing-publication.service';
import { validateApiEnv } from '../../../../src/utils/env';

const { OWNER_ID, LISTING_ID, VERTICALS, CLIENT, actorFor } = harness;
const context = { channel: 'mcp', clientId: CLIENT } as const;

const SERVICES = {
    [VerticalEnum.ACCOMMODATION]: AccommodationService,
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

type Vertical = (typeof VERTICALS)[number];
type GetByIdResult = Awaited<ReturnType<VenueService['getById']>>;

/** The listing row `getById` returns, in a given state and owner. */
function row(status: PublicationStatusEnum, ownerId: string = OWNER_ID) {
    return {
        data: {
            id: LISTING_ID,
            ownerId,
            name: 'La Parrilla',
            slug: 'la-parrilla',
            publicationStatus: status
        }
    } as unknown as GetByIdResult;
}

/** Spies one vertical's `getById` (the `get_listing` reader the tool reads through). */
function spyGetById(vertical: Vertical) {
    const prototype = SERVICES[vertical].prototype as unknown as {
        getById: (...args: unknown[]) => Promise<GetByIdResult>;
    };
    return vi.spyOn(prototype, 'getById');
}

/** `getById` answers `statuses` in order: the read before the call, then after it. */
function givenStates(vertical: Vertical, ...statuses: PublicationStatusEnum[]) {
    const spy = spyGetById(vertical);
    for (const status of statuses) {
        spy.mockResolvedValueOnce(row(status));
    }
    return spy;
}

/** Spies the three `ListingPublicationService` methods. */
function givenPublicationService() {
    const proto = ListingPublicationService.prototype;
    return {
        publish: vi.spyOn(proto, 'publish').mockResolvedValue({ id: LISTING_ID } as never),
        unpublish: vi.spyOn(proto, 'unpublish').mockResolvedValue({ id: LISTING_ID } as never),
        reactivate: vi.spyOn(proto, 'reactivate').mockResolvedValue({ id: LISTING_ID } as never)
    };
}

const run = (input: Record<string, unknown>, actor: Actor = actorFor(OWNER_ID)) =>
    runTool({ definition: setListingPublicationTool, actor, input, context });

describe('set_listing_publication confirmed out of band (HOS-2247)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.redis = harness.makeFakeRedis().redis;
        harness.givenBilling(mocks, { covered: true, granted: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('publish confirmed out of band (D-17)', () => {
        const vertical = VerticalEnum.VENUE;
        const input = { vertical, id: LISTING_ID, action: 'resume' } as const;

        /** A capable client's context, optionally carrying the retry's answer. */
        const capable = (answer?: {
            readonly stateId: string;
            readonly decision: ToolConfirmationDecision;
        }): ToolContext => ({
            channel: 'mcp',
            clientId: CLIENT,
            confirmation: { elicitationSupported: true, ...(answer ? { answer } : {}) }
        });

        /** Runs the tool the way the MCP binder does (confirmation requests surface). */
        const runCapable = (next: Record<string, unknown>, ctx: ToolContext) =>
            executeConfirmableTool({
                definition: setListingPublicationTool,
                actor: actorFor(OWNER_ID),
                input: setListingPublicationTool.inputSchema.parse(next),
                context: ctx
            });

        beforeEach(() => {
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.DRAFT });
        });

        async function ask() {
            const outcome = await runCapable(input, capable());
            if (outcome.ok !== 'confirmation_required')
                throw new Error('expected a confirmation request');
            return outcome.request;
        }

        it('the preview asks the form, never a token, and publishes nothing', async () => {
            // Arrange
            givenStates(vertical, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const request = await ask();

            // Assert
            expect(request.message).toContain('«La Parrilla»');
            expect(request.message).toContain('¿Confirmás la publicación?');
            expect(request.stateId).toMatch(/^[A-Za-z0-9_-]{43}$/);
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('confirm publishes exactly once', async () => {
            // Arrange
            givenStates(
                vertical,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.DRAFT
            );
            const service = givenPublicationService();
            const { stateId } = await ask();

            // Act
            const first = await runCapable(input, capable({ stateId, decision: 'confirm' }));
            const replay = await runCapable(input, capable({ stateId, decision: 'confirm' }));

            // Assert
            expect(first).toMatchObject({ ok: true, data: { changed: true } });
            expect(replay).toMatchObject({
                ok: false,
                failure: { message: ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON] }
            });
            expect(service.publish).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['decline', 'USER_DECLINED'],
            ['cancel', 'USER_CANCELLED']
        ] as const)('a %s publishes nothing', async (decision, code) => {
            // Arrange
            givenStates(vertical, PublicationStatusEnum.DRAFT, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();
            const { stateId } = await ask();

            // Act
            const outcome = await runCapable(input, capable({ stateId, decision }));

            // Assert
            expect(outcome).toMatchObject({ ok: false, failure: { code } });
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('a forged state publishes nothing', async () => {
            // Arrange
            givenStates(vertical, PublicationStatusEnum.DRAFT, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();
            await ask();

            // Act
            const outcome = await runCapable(
                input,
                capable({
                    stateId: 'Zm9yZ2VkLXN0YXRlLW5vYm9keS1ldmVyLWlzc3VlZC14eHg',
                    decision: 'confirm'
                })
            );

            // Assert
            expect(outcome).toMatchObject({
                ok: false,
                failure: { message: ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON] }
            });
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('a token is refused on a capable client and publishes nothing (AC-C63)', async () => {
            // Arrange: a token the same user got without the capability.
            givenStates(vertical, PublicationStatusEnum.DRAFT, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();
            const preview = await run(input);
            const token = preview.ok ? harness.previewTokenOf(preview.data) : undefined;

            // Act
            const outcome = await runCapable({ ...input, confirmationToken: token }, capable());

            // Assert
            expect(outcome).toMatchObject({ ok: false, failure: { code: 'VALIDATION_ERROR' } });
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('pause stays one step on a capable client too', async () => {
            // Arrange
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.PUBLISHED });
            givenStates(vertical, PublicationStatusEnum.PUBLISHED, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const outcome = await runCapable(
                { vertical, id: LISTING_ID, action: 'pause' },
                capable()
            );

            // Assert
            expect(outcome).toMatchObject({ ok: true, data: { changed: true } });
            expect(service.unpublish).toHaveBeenCalledTimes(1);
        });
    });
});
