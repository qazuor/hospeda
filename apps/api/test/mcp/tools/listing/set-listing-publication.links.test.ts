/**
 * HOS-2326 (spec HOS-2335 §5.1, AC-C2, AC-C3, AC-C4) — every refusal of
 * `set_listing_publication` that a page can fix carries the portal link the
 * spec lists, for each vertical; the rest carry none.
 *
 * Same harness as `set-listing-publication.refusals.test.ts`.
 *
 * @module test/mcp/tools/listing/set-listing-publication.links
 */

import {
    buildPublishRequirementsReason,
    DUPLICATE_LOCATION_REASON,
    PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import {
    AccommodationService,
    ExperienceService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

import { setListingPublicationTool } from '../../../../src/mcp/tools/listing/set-listing-publication';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import {
    ListingPublicationService,
    mapListingPublishDenial
} from '../../../../src/services/listing-publication/listing-publication.service';
import { env, validateApiEnv } from '../../../../src/utils/env';

const { OWNER_ID, OTHER_ID, LISTING_ID, VERTICALS, actorFor } = harness;
const SITE = 'https://hospeda.test';

type Vertical = (typeof VERTICALS)[number];
type GetByIdResult = Awaited<ReturnType<VenueService['getById']>>;

const SERVICES = {
    [VerticalEnum.ACCOMMODATION]: AccommodationService,
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

/** The listing `getById` answers, in `status`, owned by `ownerId`; and its access facts. */
function givenState(vertical: Vertical, status: PublicationStatusEnum, ownerId: string = OWNER_ID) {
    const prototype = SERVICES[vertical].prototype as unknown as {
        getById: (...args: unknown[]) => Promise<GetByIdResult>;
    };
    vi.spyOn(prototype, 'getById').mockResolvedValue({
        data: {
            id: LISTING_ID,
            ownerId,
            name: 'La Parrilla',
            slug: 'la-parrilla',
            publicationStatus: status
        }
    } as unknown as GetByIdResult);
    harness.givenFacts(mocks, { vertical, status, ownerId });
}

/** `publish` rejects with `error`, from a draft. */
function givenPublishRejects(vertical: Vertical, error: unknown) {
    givenState(vertical, PublicationStatusEnum.DRAFT);
    vi.spyOn(ListingPublicationService.prototype, 'publish').mockRejectedValue(error);
}

/** Runs `resume` and returns the failure. */
async function failureOf(vertical: Vertical, action: 'pause' | 'resume' = 'resume') {
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

/** Absolute editor URL of the listing, at an editor slug (or the hub). */
function editorUrl(vertical: Vertical, slug?: string): string {
    const base =
        vertical === VerticalEnum.ACCOMMODATION
            ? `${SITE}/es/mi-cuenta/propiedades/${LISTING_ID}/editar/`
            : `${SITE}/es/mi-cuenta/comercio/${vertical}/${LISTING_ID}/editar/`;
    return slug === undefined ? base : `${base}${slug}/`;
}

const PLANS_URL: Record<Vertical, string> = {
    [VerticalEnum.ACCOMMODATION]: `${SITE}/es/planes/anfitriones/`,
    [VerticalEnum.VENUE]: `${SITE}/es/planes/comer-y-salir/`,
    [VerticalEnum.EXPERIENCE]: `${SITE}/es/planes/experiencias/`
};
const SUBSCRIPTION_URL = `${SITE}/es/mi-cuenta/suscripcion/`;

describe('set_listing_publication — portal links on refusals', () => {
    let originalSiteUrl: string;

    beforeAll(() => {
        validateApiEnv();
        originalSiteUrl = env.HOSPEDA_SITE_URL;
    });

    afterAll(() => {
        env.HOSPEDA_SITE_URL = originalSiteUrl;
    });

    beforeEach(() => {
        env.HOSPEDA_SITE_URL = SITE;
        vi.clearAllMocks();
        mocks.redis = harness.makeFakeRedis().redis;
        harness.givenBilling(mocks, { covered: true, granted: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe.each(VERTICALS)('%s', (vertical) => {
        it('LISTING_INCOMPLETE → the editor section of the first missing requirement', async () => {
            // Arrange: an accommodation reports requirement ids, the others field names.
            const [first, second] =
                vertical === VerticalEnum.ACCOMMODATION
                    ? [
                          new ServiceError(
                              ServiceErrorCode.VALIDATION_ERROR,
                              'Cannot publish accommodation: missing capacity, mainImage',
                              undefined,
                              buildPublishRequirementsReason({ missing: ['capacity', 'mainImage'] })
                          ),
                          'capacidad-precio'
                      ]
                    : [
                          new ServiceError(
                              ServiceErrorCode.VALIDATION_ERROR,
                              'Listing incomplete: contactInfo, media.featuredImage'
                          ),
                          'contacto'
                      ];
            givenPublishRejects(vertical, first);

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action?.url).toBe(editorUrl(vertical, second));
        });

        it('LISTING_INCOMPLETE with a missing field that has no section → the hub', async () => {
            // Arrange
            givenPublishRejects(
                vertical,
                new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Listing incomplete: ownerId, mystery'
                )
            );

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action?.url).toBe(editorUrl(vertical));
        });

        it('LISTING_MODERATED → the editor hub', async () => {
            // Arrange
            givenState(vertical, PublicationStatusEnum.MODERATED);

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action?.url).toBe(editorUrl(vertical));
        });

        it('NO_COVERAGE → the plans of the vertical', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: false, granted: true });
            givenState(vertical, PublicationStatusEnum.DRAFT);

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action?.url).toBe(PLANS_URL[vertical]);
        });

        it('SUBSCRIPTION_REQUIRED → the plans of the vertical', async () => {
            // Arrange
            givenPublishRejects(vertical, mapListingPublishDenial('TRIAL_LIMIT_REACHED', vertical));

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action?.url).toBe(PLANS_URL[vertical]);
        });

        it('NO_CAPABILITY → the subscription', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: true, granted: false });
            givenState(vertical, PublicationStatusEnum.PUBLISHED);

            // Act
            const failure = await failureOf(vertical, 'pause');

            // Assert
            expect(failure.action?.url).toBe(SUBSCRIPTION_URL);
        });

        it('LISTING_LIMIT_REACHED → the subscription', async () => {
            // Arrange
            givenPublishRejects(vertical, mapListingPublishDenial('LIMIT_REACHED', vertical));

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action?.url).toBe(SUBSCRIPTION_URL);
        });

        it('DUPLICATE_LOCATION → the editor location section', async () => {
            // Arrange
            givenPublishRejects(
                vertical,
                new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Another published listing of yours already occupies this address',
                    { reason: DUPLICATE_LOCATION_REASON },
                    DUPLICATE_LOCATION_REASON
                )
            );

            // Act
            const failure = await failureOf(vertical);

            // Assert: experiences keep their address in the meeting point.
            expect(failure.action?.url).toBe(
                editorUrl(
                    vertical,
                    vertical === VerticalEnum.EXPERIENCE ? 'punto-de-encuentro' : 'ubicacion'
                )
            );
        });

        it.each([
            [
                'no plans offered',
                () => new ServiceError(ServiceErrorCode.FORBIDDEN, 'no_plans_available')
            ],
            [
                'paid signups paused',
                (v: Vertical) => mapListingPublishDenial('NEW_PAID_SIGNUPS_FROZEN', v)
            ],
            ['a lost race', (v: Vertical) => mapListingPublishDenial('STATE_CHANGED', v)]
        ])('%s → no page fixes it, so no link', async (_label, build) => {
            // Arrange
            givenPublishRejects(vertical, build(vertical));

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action).toBeUndefined();
        });

        it('a transient failure carries no link (AC-C3)', async () => {
            // Arrange
            givenPublishRejects(
                vertical,
                new ServiceError(ServiceErrorCode.SERVICE_UNAVAILABLE, 'billing down')
            );

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.action).toBeUndefined();
        });

        it('a foreign listing is the uniform not-found with only the owner listings link (AC-C4)', async () => {
            // Arrange
            givenState(vertical, PublicationStatusEnum.DRAFT, OTHER_ID);

            // Act
            const failure = await failureOf(vertical);

            // Assert
            expect(failure.code).toBe('NOT_FOUND');
            expect(failure.action?.url).toBe(
                vertical === VerticalEnum.ACCOMMODATION
                    ? `${SITE}/es/mi-cuenta/propiedades/`
                    : `${SITE}/es/mi-cuenta/comercio/`
            );
            expect(JSON.stringify(failure)).not.toContain(LISTING_ID);
        });
    });
});
