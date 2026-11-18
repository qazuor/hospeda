/**
 * HOS-2247, owner decision D-19 — the confirmation step of publishing through
 * `set_listing_publication`. A `resume` that publishes is two steps: the
 * preview writes nothing (after a dry run of the publish access step) and
 * answers a single-use token bound to the listing (clients without the
 * capability) or the client's own form (clients that declared form
 * elicitation, D-17). `pause`, and a `resume` that reactivates or changes
 * nothing, stay one step. The token store runs for real over an in-memory Redis
 * fake; the rest of the setup is the one of `set-listing-publication.test.ts`.
 * The out-of-band (form) flow is in `set-listing-publication.elicitation.test.ts`.
 *
 * @module test/mcp/tools/listing/set-listing-publication.confirmation
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
    PUBLISH_CONFIRMATION_INVALID_REASON,
    PUBLISH_CONFIRMATION_NOT_NEEDED_REASON
} from '../../../../src/mcp/tools/listing/publish-confirmation';
import {
    SET_LISTING_PUBLICATION_REASON_MESSAGES,
    setListingPublicationTool
} from '../../../../src/mcp/tools/listing/set-listing-publication';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { ListingPublicationService } from '../../../../src/services/listing-publication/listing-publication.service';
import { validateApiEnv } from '../../../../src/utils/env';

const { OWNER_ID, OTHER_ID, LISTING_ID, VERTICALS, CLIENT, actorFor } = harness;
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

const failureOf = async (input: Record<string, unknown>, actor?: Actor) => {
    const outcome = await run(input, actor);
    if (outcome.ok) throw new Error('expected a failure');
    return outcome.failure;
};

describe('set_listing_publication confirmation (HOS-2247, D-19)', () => {
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

    describe('publish is two steps (HOS-2247, D-19)', () => {
        const vertical = VerticalEnum.VENUE;
        const input = { vertical, id: LISTING_ID, action: 'resume' } as const;

        beforeEach(() => {
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.DRAFT });
        });

        it('the preview publishes nothing and answers a token bound to the listing', async () => {
            // Arrange
            const getById = givenStates(vertical, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const outcome = await run(input);

            // Assert
            expect(outcome.ok).toBe(true);
            if (!outcome.ok) return;
            expect(outcome.data).toMatchObject({
                status: 'confirmation_required',
                id: LISTING_ID,
                vertical,
                name: 'La Parrilla',
                action: 'resume',
                previousStatus: PublicationStatusEnum.DRAFT,
                publicationStatusAfter: PublicationStatusEnum.PUBLISHED,
                confirmationToken: expect.any(String)
            });
            expect(service.publish).not.toHaveBeenCalled();
            expect(service.reactivate).not.toHaveBeenCalled();
            expect(mocks.capturePublished).not.toHaveBeenCalled();
            expect(getById).toHaveBeenCalledTimes(1);
        });

        it('the preview runs the publish access step first: a refusal shows before any token', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: false, granted: true });
            givenStates(vertical, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const failure = await failureOf(input);

            // Assert
            expect(failure.code).toBe('ENTITLEMENT_REQUIRED');
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('the token publishes exactly once (single use)', async () => {
            // Arrange
            givenStates(
                vertical,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.DRAFT
            );
            const service = givenPublicationService();
            const preview = await run(input);
            const token = preview.ok ? harness.previewTokenOf(preview.data) : undefined;

            // Act
            const first = await run({ ...input, confirmationToken: token });
            const replay = await failureOf({ ...input, confirmationToken: token });

            // Assert
            expect(first.ok).toBe(true);
            expect(replay.message).toBe(
                SET_LISTING_PUBLICATION_REASON_MESSAGES[PUBLISH_CONFIRMATION_INVALID_REASON]
            );
            expect(service.publish).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['a forged token', 'forged-token', OWNER_ID, CLIENT],
            ['the token of another user', undefined, OTHER_ID, CLIENT],
            [
                'the token of another OAuth client',
                undefined,
                OWNER_ID,
                'https://chatgpt.com/oauth/x'
            ]
        ])('refuses %s and publishes nothing', async (_label, forged, commitUser, commitClient) => {
            // Arrange: the preview reads the owner's draft; the commit reads a
            // draft owned by the committing user, so only the token can refuse.
            givenStates(vertical, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();
            const preview = await run(input);
            const token = forged ?? (preview.ok ? harness.previewTokenOf(preview.data) : undefined);
            spyGetById(vertical).mockResolvedValue(row(PublicationStatusEnum.DRAFT, commitUser));
            harness.givenFacts(mocks, {
                vertical,
                status: PublicationStatusEnum.DRAFT,
                ownerId: commitUser
            });

            // Act
            const outcome = await runTool({
                definition: setListingPublicationTool,
                actor: actorFor(commitUser),
                input: { ...input, confirmationToken: token },
                context: { channel: 'mcp', clientId: commitClient }
            });

            // Assert
            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toBe(
                SET_LISTING_PUBLICATION_REASON_MESSAGES[PUBLISH_CONFIRMATION_INVALID_REASON]
            );
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('a token issued for another listing does not publish this one', async () => {
            // Arrange
            const OTHER_LISTING = '7b6a5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
            givenStates(vertical, PublicationStatusEnum.DRAFT, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();
            const preview = await run(input);
            const token = preview.ok ? harness.previewTokenOf(preview.data) : undefined;

            // Act
            const failure = await failureOf({
                ...input,
                id: OTHER_LISTING,
                confirmationToken: token
            });

            // Assert
            expect(failure.message).toBe(
                SET_LISTING_PUBLICATION_REASON_MESSAGES[PUBLISH_CONFIRMATION_INVALID_REASON]
            );
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('pause stays one step: no preview, no token', async () => {
            // Arrange
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.PUBLISHED });
            givenStates(vertical, PublicationStatusEnum.PUBLISHED, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();
            const fake = harness.makeFakeRedis();
            mocks.redis = fake.redis;

            // Act
            const outcome = await run({ vertical, id: LISTING_ID, action: 'pause' });

            // Assert
            expect(outcome.ok).toBe(true);
            if (!outcome.ok) return;
            expect(outcome.data).not.toHaveProperty('confirmationToken');
            expect(outcome.data).toMatchObject({ changed: true });
            expect(service.unpublish).toHaveBeenCalledTimes(1);
            expect(fake.redis.set).not.toHaveBeenCalled();
        });

        it('pause with a token is refused and changes nothing', async () => {
            // Arrange
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.PUBLISHED });
            givenStates(vertical, PublicationStatusEnum.PUBLISHED);
            const service = givenPublicationService();

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                action: 'pause',
                confirmationToken: 'stale-token'
            });

            // Assert
            expect(failure.message).toBe(
                SET_LISTING_PUBLICATION_REASON_MESSAGES[PUBLISH_CONFIRMATION_NOT_NEEDED_REASON]
            );
            expect(service.unpublish).not.toHaveBeenCalled();
        });

        it('a publish token used after the listing changed state burns and changes nothing', async () => {
            // Arrange: previewed as a draft, archived before the commit.
            givenStates(vertical, PublicationStatusEnum.DRAFT, PublicationStatusEnum.ARCHIVED);
            const service = givenPublicationService();
            const preview = await run(input);
            const token = preview.ok ? harness.previewTokenOf(preview.data) : undefined;

            // Act
            const failure = await failureOf({ ...input, confirmationToken: token });

            // Assert
            expect(failure.message).toBe(
                SET_LISTING_PUBLICATION_REASON_MESSAGES[PUBLISH_CONFIRMATION_NOT_NEEDED_REASON]
            );
            expect(service.reactivate).not.toHaveBeenCalled();
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('a reactivate stays one step', async () => {
            // Arrange
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.ARCHIVED });
            givenStates(vertical, PublicationStatusEnum.ARCHIVED, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const outcome = await run(input);

            // Assert
            expect(outcome.ok).toBe(true);
            expect(service.reactivate).toHaveBeenCalledTimes(1);
        });

        it('publishing needs an identified OAuth client (the proof is bound to it)', async () => {
            // Arrange
            givenStates(vertical, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const outcome = await runTool({
                definition: setListingPublicationTool,
                actor: actorFor(OWNER_ID),
                input,
                context: { channel: 'mcp' }
            });

            // Assert
            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.code).toBe('UNAUTHORIZED');
            expect(service.publish).not.toHaveBeenCalled();
        });
    });
});
