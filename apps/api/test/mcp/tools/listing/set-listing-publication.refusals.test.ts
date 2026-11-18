/**
 * HOS-2184 T-018 — every refusal the publication path can return reaches the
 * user of `set_listing_publication` as a specific Spanish message, never the
 * generic one: listing access (step 5 coverage, step 6 capability, the
 * publish-specific subscription/no-plans branch) and `ListingPublicationService`
 * (PB1 denials through the real `mapListingPublishDenial`, completeness, the
 * one-address rule, the paid-signups freeze, a lost race).
 *
 * Same harness as `set-listing-publication.test.ts`.
 *
 * @module test/mcp/tools/listing/set-listing-publication.refusals
 */

import {
    buildPublishRequirementsReason,
    DUPLICATE_LOCATION_REASON,
    NO_PLANS_AVAILABLE_MESSAGE,
    PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness } from './set-listing-publication.harness';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    preTrialDraftLimits: vi.fn(),
    subscribeDestination: vi.fn(),
    redis: undefined as unknown
}));

// Publishing is two steps (HOS-2247, D-19): the token store runs over a fake.
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

vi.mock('../../../../src/services/listing-publication/subscribe-destination.service', () => ({
    resolveSubscribeDestinationForUser: mocks.subscribeDestination
}));

vi.mock('../../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));

vi.mock('../../../../src/utils/listing-catalog-relations', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/utils/listing-catalog-relations')>()),
    fetchVenueAmenities: vi.fn(async () => []),
    fetchVenueFeatures: vi.fn(async () => [])
}));

import {
    publicationRefusalReason,
    SET_LISTING_PUBLICATION_REASON_MESSAGES,
    setListingPublicationTool
} from '../../../../src/mcp/tools/listing/set-listing-publication';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_UNEXPECTED_ERROR_MESSAGE
} from '../../../../src/mcp/tools/tool-errors';
import {
    ListingPublicationService,
    mapListingPublishDenial
} from '../../../../src/services/listing-publication/listing-publication.service';
import { validateApiEnv } from '../../../../src/utils/env';

const { OWNER_ID, LISTING_ID, actorFor } = harness;
const vertical = VerticalEnum.VENUE;
const MESSAGES = SET_LISTING_PUBLICATION_REASON_MESSAGES;

/** The venue `getById` answers `status` (the read before the call). */
function givenState(status: PublicationStatusEnum): void {
    vi.spyOn(VenueService.prototype, 'getById').mockResolvedValue({
        data: {
            id: LISTING_ID,
            ownerId: OWNER_ID,
            name: 'La Parrilla',
            slug: 'la-parrilla',
            publicationStatus: status
        }
    } as unknown as Awaited<ReturnType<VenueService['getById']>>);
    harness.givenFacts(mocks, { vertical, status });
}

/** Runs the tool and returns its failure. */
async function failureOf(action: 'pause' | 'resume') {
    // A publish refusal of the service shows on the confirmed second call.
    const outcome = await harness.throughPreview(
        (input) =>
            runTool({
                definition: setListingPublicationTool,
                actor: actorFor(OWNER_ID),
                input,
                context: { channel: 'mcp', clientId: harness.CLIENT }
            }),
        { vertical, id: LISTING_ID, action }
    );
    if (outcome.ok) throw new Error('expected a failure');
    return outcome.failure;
}

describe('set_listing_publication — refusals in Spanish', () => {
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

    describe('listing access (before any write)', () => {
        it('resume without coverage → NO_COVERAGE (step 5)', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: false, granted: true });
            givenState(PublicationStatusEnum.DRAFT);
            const publish = vi.spyOn(ListingPublicationService.prototype, 'publish');

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure).toMatchObject({
                code: 'ENTITLEMENT_REQUIRED',
                kind: 'denied',
                message: MESSAGES.NO_COVERAGE
            });
            expect(publish).not.toHaveBeenCalled();
        });

        it('pause without coverage → NO_COVERAGE (EDIT passes step 5 too)', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: false, granted: true });
            givenState(PublicationStatusEnum.PUBLISHED);
            const unpublish = vi.spyOn(ListingPublicationService.prototype, 'unpublish');

            // Act
            const failure = await failureOf('pause');

            // Assert
            expect(failure.message).toBe(MESSAGES.NO_COVERAGE);
            expect(unpublish).not.toHaveBeenCalled();
        });

        it('pause without the edit capability → NO_CAPABILITY (step 6, EDIT)', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: true, granted: false });
            givenState(PublicationStatusEnum.PUBLISHED);

            // Act
            const failure = await failureOf('pause');

            // Assert
            expect(failure).toMatchObject({
                code: 'ENTITLEMENT_REQUIRED',
                message: MESSAGES.NO_CAPABILITY
            });
            expect(mocks.effectiveSet).toHaveBeenCalledWith(
                expect.objectContaining({ userId: OWNER_ID, vertical })
            );
        });

        it('resume without the recover capability on an archived listing → NO_CAPABILITY (REACTIVATE)', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: true, granted: false });
            givenState(PublicationStatusEnum.ARCHIVED);
            const reactivate = vi.spyOn(ListingPublicationService.prototype, 'reactivate');

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure.message).toBe(MESSAGES.NO_CAPABILITY);
            expect(reactivate).not.toHaveBeenCalled();
        });

        it.each([
            ['PLANS', 'SUBSCRIPTION_REQUIRED'],
            ['NO_PLANS_AVAILABLE', 'NO_PLANS_AVAILABLE']
        ] as const)('resume without a publish capability nor a paid title, destination %s → %s', async (destination, reason) => {
            // Arrange
            harness.givenBilling(mocks, {
                covered: true,
                granted: false,
                hasLiveNonTrialTitle: false
            });
            mocks.subscribeDestination.mockResolvedValue({ destination });
            givenState(PublicationStatusEnum.DRAFT);

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure).toMatchObject({ code: 'FORBIDDEN', message: MESSAGES[reason] });
        });
    });

    describe('ListingPublicationService.publish refusals', () => {
        const rejectPublish = (error: unknown) => {
            givenState(PublicationStatusEnum.DRAFT);
            vi.spyOn(ListingPublicationService.prototype, 'publish').mockRejectedValue(error);
        };

        it.each([
            ['LIMIT_REACHED', 'LIMIT_REACHED', 'LISTING_LIMIT_REACHED'],
            ['TRIAL_LIMIT_REACHED', 'FORBIDDEN', 'SUBSCRIPTION_REQUIRED'],
            ['USER_ALREADY_HAS_TRIAL_ROW', 'FORBIDDEN', 'SUBSCRIPTION_REQUIRED'],
            ['NEW_PAID_SIGNUPS_FROZEN', 'NEW_PAID_SIGNUPS_FROZEN', 'FIRST_PUBLISH_PAUSED'],
            ['STATE_CHANGED', 'ALREADY_EXISTS', 'PUBLICATION_STATE_CHANGED'],
            ['INVALID_FROM', 'ALREADY_EXISTS', 'PUBLICATION_STATE_CHANGED']
        ] as const)('PB1 %s → %s with the %s message', async (denial, code, reason) => {
            // Arrange
            rejectPublish(mapListingPublishDenial(denial, vertical));

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure).toMatchObject({ code, message: MESSAGES[reason], unexpected: false });
        });

        it.each([
            'NOT_OWNER',
            'LISTING_NOT_FOUND'
        ])('PB1 %s → the uniform not found', async (denial) => {
            // Arrange
            rejectPublish(mapListingPublishDenial(denial, vertical));

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
        });

        it('no plans for the trial denial → NO_PLANS_AVAILABLE', async () => {
            // Arrange
            rejectPublish(new ServiceError(ServiceErrorCode.FORBIDDEN, NO_PLANS_AVAILABLE_MESSAGE));

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure.message).toBe(MESSAGES.NO_PLANS_AVAILABLE);
        });

        it.each([
            [
                'accommodation requirements',
                new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Cannot publish accommodation: missing photos',
                    undefined,
                    buildPublishRequirementsReason({ missing: ['photos'] as never })
                )
            ],
            [
                'venue/experience completeness',
                new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Listing incomplete: media')
            ]
        ])('an incomplete listing (%s) → LISTING_INCOMPLETE', async (_label, error) => {
            // Arrange
            rejectPublish(error);

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure).toMatchObject({
                code: 'VALIDATION_ERROR',
                message: MESSAGES.LISTING_INCOMPLETE
            });
        });

        it('another published listing at the same address → DUPLICATE_LOCATION', async () => {
            // Arrange
            rejectPublish(
                new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Another published listing of yours already occupies this address',
                    { reason: DUPLICATE_LOCATION_REASON },
                    DUPLICATE_LOCATION_REASON
                )
            );

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure.message).toBe(MESSAGES[DUPLICATE_LOCATION_REASON]);
        });

        it('a non-service throw → the generic message, no internals', async () => {
            // Arrange
            rejectPublish(new Error('connection reset at 10.0.0.3'));

            // Act
            const failure = await failureOf('resume');

            // Assert
            expect(failure).toMatchObject({
                code: 'UNEXPECTED',
                message: TOOL_UNEXPECTED_ERROR_MESSAGE
            });
        });
    });

    it('unpublish losing a race → PUBLICATION_STATE_CHANGED', async () => {
        // Arrange
        givenState(PublicationStatusEnum.PUBLISHED);
        vi.spyOn(ListingPublicationService.prototype, 'unpublish').mockRejectedValue(
            new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed')
        );

        // Act
        const failure = await failureOf('pause');

        // Assert
        expect(failure.message).toBe(MESSAGES.PUBLICATION_STATE_CHANGED);
    });

    it('leaves unrelated codes on their default mapping', () => {
        // Assert
        expect(
            publicationRefusalReason(new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden'))
        ).toBeUndefined();
        expect(
            publicationRefusalReason(
                new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid owner email')
            )
        ).toBeUndefined();
        expect(
            publicationRefusalReason(new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'other'))
        ).toBeUndefined();
    });

    it('has a Spanish message for every reason it can name', () => {
        // Assert
        for (const message of Object.values(MESSAGES)) {
            expect(message.length).toBeGreaterThan(20);
        }
        expect(Object.keys(MESSAGES).sort()).toEqual(
            [
                'DUPLICATE_LOCATION',
                'FIRST_PUBLISH_PAUSED',
                'LISTING_INCOMPLETE',
                'LISTING_LIMIT_REACHED',
                'LISTING_MODERATED',
                'NO_CAPABILITY',
                'NO_COVERAGE',
                'NO_PLANS_AVAILABLE',
                'PUBLICATION_STATE_CHANGED',
                'SUBSCRIPTION_REQUIRED',
                // HOS-2247 (D-19): the confirmation step of publishing.
                'CONFIRMATION_INVALID',
                'CONFIRMATION_NOT_NEEDED',
                'CONFIRMATION_TOKEN_REFUSED',
                'CONFIRMATION_UNAVAILABLE',
                'ELICITATION_STATE_INVALID'
            ].sort()
        );
    });
});
