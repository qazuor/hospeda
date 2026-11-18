/**
 * HOS-2184 T-018 — `set_listing_publication`: per vertical, `pause` runs the
 * unpublish route's step (PB6, listing access `EDIT`) on a published listing
 * and `resume` runs publish (PB1, `PUBLISH`) from draft or billing pause and
 * reactivate (PB8, `REACTIVATE`) from archive; every other state is a no-op
 * or a refusal. Ownership is owner-only (AC-6), the audit carries the target
 * (AC-12), and the tool is listed as a destructive write.
 *
 * HOS-2247 (D-19): a `resume` that publishes is two steps, so the happy paths
 * here confirm the preview with its token; the confirmation step itself is
 * covered in `set-listing-publication.confirmation.test.ts`.
 *
 * Listing access runs for real over mocked ports (the pattern of
 * `update-listing-basic.test.ts`); `ListingPublicationService` and the
 * vertical services are spied on their prototypes. Billing refusals live in
 * `set-listing-publication.refusals.test.ts`.
 *
 * @module test/mcp/tools/listing/set-listing-publication
 */

import { PermissionEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
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

import { buildToolListEntry, handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import {
    LISTING_MODERATED_REASON,
    type ListingPublicationResult,
    planListingPublication,
    SET_LISTING_PUBLICATION_REASON_MESSAGES,
    setListingPublicationTool
} from '../../../../src/mcp/tools/listing/set-listing-publication';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { TOOL_NOT_FOUND_MESSAGE } from '../../../../src/mcp/tools/tool-errors';
import { clearSlidingWindowStore } from '../../../../src/middlewares/rate-limit';
import { ListingPublicationService } from '../../../../src/services/listing-publication/listing-publication.service';
import { env, validateApiEnv } from '../../../../src/utils/env';

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

/** The state after the call; a publish preview is confirmed first (two steps). */
const dataOf = async (input: Record<string, unknown>): Promise<ListingPublicationResult> => {
    const outcome = await harness.throughPreview((next) => run(next), input);
    if (!outcome.ok) throw new Error(`expected success, got ${outcome.failure.code}`);
    if (!('changed' in outcome.data)) throw new Error('expected the state after the call');
    return outcome.data;
};

describe('set_listing_publication', () => {
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

    describe.each(VERTICALS)('%s', (vertical) => {
        beforeEach(() => {
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.PUBLISHED });
        });

        it('pause unpublishes a published listing through the unpublish route step', async () => {
            // Arrange
            givenStates(vertical, PublicationStatusEnum.PUBLISHED, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const data = await dataOf({ vertical, id: LISTING_ID, action: 'pause' });

            // Assert
            expect(service.unpublish).toHaveBeenCalledTimes(1);
            expect(service.unpublish).toHaveBeenCalledWith({
                actor: expect.objectContaining({ id: OWNER_ID }),
                id: LISTING_ID,
                vertical
            });
            expect(service.publish).not.toHaveBeenCalled();
            expect(service.reactivate).not.toHaveBeenCalled();
            expect(data).toMatchObject({
                id: LISTING_ID,
                vertical,
                name: 'La Parrilla',
                action: 'pause',
                changed: true,
                previousStatus: PublicationStatusEnum.PUBLISHED,
                publicationStatus: PublicationStatusEnum.DRAFT,
                publicUrl: null
            });
            expect(data.summary).toContain('pausada');
        });

        it.each([
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.ARCHIVED,
            PublicationStatusEnum.MODERATED
        ])('pause on a %s listing changes nothing (idempotent)', async (status) => {
            // Arrange
            givenStates(vertical, status);
            const service = givenPublicationService();

            // Act
            const data = await dataOf({ vertical, id: LISTING_ID, action: 'pause' });

            // Assert
            expect(data).toMatchObject({ changed: false, publicationStatus: status });
            expect(service.unpublish).not.toHaveBeenCalled();
            expect(mocks.loadFacts).not.toHaveBeenCalled();
        });

        it.each([
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        ])('resume publishes a %s listing once confirmed and answers its public URL', async (status) => {
            // Arrange: the preview reads the state, the commit reads it before and after.
            harness.givenFacts(mocks, { vertical, status });
            givenStates(vertical, status, status, PublicationStatusEnum.PUBLISHED);
            const service = givenPublicationService();

            // Act
            const data = await dataOf({ vertical, id: LISTING_ID, action: 'resume' });

            // Assert
            expect(service.publish).toHaveBeenCalledWith({
                actor: expect.objectContaining({ id: OWNER_ID }),
                id: LISTING_ID,
                vertical
            });
            expect(service.reactivate).not.toHaveBeenCalled();
            expect(data).toMatchObject({
                changed: true,
                previousStatus: status,
                publicationStatus: PublicationStatusEnum.PUBLISHED
            });
            expect(data.publicUrl).toMatch(new RegExp(`^${env.HOSPEDA_SITE_URL}.*la-parrilla`));
            expect(mocks.capturePublished).toHaveBeenCalledTimes(
                vertical === VerticalEnum.ACCOMMODATION ? 1 : 0
            );
        });

        it('resume reactivates an archived listing to draft, without publishing it', async () => {
            // Arrange
            harness.givenFacts(mocks, { vertical, status: PublicationStatusEnum.ARCHIVED });
            givenStates(vertical, PublicationStatusEnum.ARCHIVED, PublicationStatusEnum.DRAFT);
            const service = givenPublicationService();

            // Act
            const data = await dataOf({ vertical, id: LISTING_ID, action: 'resume' });

            // Assert
            expect(service.reactivate).toHaveBeenCalledWith({
                actor: expect.objectContaining({ id: OWNER_ID }),
                id: LISTING_ID,
                vertical
            });
            expect(service.publish).not.toHaveBeenCalled();
            expect(data).toMatchObject({
                changed: true,
                previousStatus: PublicationStatusEnum.ARCHIVED,
                publicationStatus: PublicationStatusEnum.DRAFT,
                publicUrl: null
            });
            expect(data.summary).toContain('borrador');
        });

        it('resume on a published listing changes nothing (idempotent)', async () => {
            // Arrange
            givenStates(vertical, PublicationStatusEnum.PUBLISHED);
            const service = givenPublicationService();

            // Act
            const data = await dataOf({ vertical, id: LISTING_ID, action: 'resume' });

            // Assert
            expect(data).toMatchObject({
                changed: false,
                publicationStatus: PublicationStatusEnum.PUBLISHED
            });
            expect(data.publicUrl).toContain('la-parrilla');
            expect(service.publish).not.toHaveBeenCalled();
            expect(mocks.loadFacts).not.toHaveBeenCalled();
        });

        it('resume refuses a moderated listing in Spanish, without calling anything', async () => {
            // Arrange
            givenStates(vertical, PublicationStatusEnum.MODERATED);
            const service = givenPublicationService();

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, action: 'resume' });

            // Assert
            expect(failure).toMatchObject({
                code: 'FORBIDDEN',
                kind: 'denied',
                message: SET_LISTING_PUBLICATION_REASON_MESSAGES[LISTING_MODERATED_REASON]
            });
            expect(service.publish).not.toHaveBeenCalled();
            expect(service.reactivate).not.toHaveBeenCalled();
        });

        it.each([
            'pause',
            'resume'
        ])("answers another user's listing as not found on %s (AC-6)", async (action) => {
            // Arrange
            spyGetById(vertical).mockResolvedValue(row(PublicationStatusEnum.PUBLISHED, OTHER_ID));
            const service = givenPublicationService();

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, action });

            // Assert
            expect(failure).toMatchObject({
                code: 'NOT_FOUND',
                message: TOOL_NOT_FOUND_MESSAGE
            });
            expect(service.unpublish).not.toHaveBeenCalled();
            expect(service.publish).not.toHaveBeenCalled();
        });

        it('answers a missing listing with the same not found', async () => {
            // Arrange
            spyGetById(vertical).mockResolvedValue({
                error: { code: 'NOT_FOUND', message: 'missing' }
            } as unknown as GetByIdResult);
            const service = givenPublicationService();

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, action: 'pause' });

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(service.unpublish).not.toHaveBeenCalled();
        });

        it('stays owner-only at the listing-access step, even for staff', async () => {
            // Arrange: the listing-access facts name another owner (the row
            // changed hands between the two reads); staff holds the
            // foreign-edit permission a route would honour.
            harness.givenFacts(mocks, {
                vertical,
                status: PublicationStatusEnum.PUBLISHED,
                ownerId: OTHER_ID
            });
            givenStates(vertical, PublicationStatusEnum.PUBLISHED);
            const service = givenPublicationService();
            const staff = actorFor(OWNER_ID, {
                permissions: [
                    PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, action: 'pause' }, staff);

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(service.unpublish).not.toHaveBeenCalled();
        });

        it('refuses an unverified email before reading anything', async () => {
            // Arrange
            const getById = givenStates(vertical, PublicationStatusEnum.PUBLISHED);
            const service = givenPublicationService();

            // Act
            const failure = await failureOf(
                { vertical, id: LISTING_ID, action: 'pause' },
                actorFor(OWNER_ID, { emailVerified: false })
            );

            // Assert
            expect(failure.code).toBe('EMAIL_NOT_VERIFIED');
            expect(getById).not.toHaveBeenCalled();
            expect(service.unpublish).not.toHaveBeenCalled();
        });
    });

    describe('planListingPublication (action → route)', () => {
        it.each([
            ['pause', PublicationStatusEnum.PUBLISHED, { kind: 'run', step: 'UNPUBLISH' }],
            ['pause', PublicationStatusEnum.DRAFT, { kind: 'noop' }],
            ['pause', PublicationStatusEnum.UNPUBLISHED_BY_BILLING, { kind: 'noop' }],
            ['pause', PublicationStatusEnum.ARCHIVED, { kind: 'noop' }],
            ['pause', PublicationStatusEnum.MODERATED, { kind: 'noop' }],
            ['resume', PublicationStatusEnum.DRAFT, { kind: 'run', step: 'PUBLISH' }],
            [
                'resume',
                PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                { kind: 'run', step: 'PUBLISH' }
            ],
            ['resume', PublicationStatusEnum.ARCHIVED, { kind: 'run', step: 'REACTIVATE' }],
            ['resume', PublicationStatusEnum.PUBLISHED, { kind: 'noop' }],
            [
                'resume',
                PublicationStatusEnum.MODERATED,
                { kind: 'refuse', reason: LISTING_MODERATED_REASON }
            ]
        ] as const)('%s on %s → %o', (action, status, expected) => {
            // Act + Assert
            expect(planListingPublication({ action, status })).toEqual(expected);
        });
    });

    it('rejects an unknown action and verticals without owner listings', async () => {
        // Act
        const badAction = await failureOf({ vertical: 'venue', id: LISTING_ID, action: 'delete' });
        const badVertical = await failureOf({
            vertical: 'tourist',
            id: LISTING_ID,
            action: 'pause'
        });

        // Assert
        expect(badAction.code).toBe('VALIDATION_ERROR');
        expect(badAction.message).toContain('action');
        expect(badVertical.code).toBe('VALIDATION_ERROR');
        expect(badVertical.message).toContain('vertical');
    });

    describe('audit (AC-12)', () => {
        const mcpAuth = {
            userId: OWNER_ID,
            clientId: 'https://claude.ai/oauth/mcp-client-metadata',
            clientName: 'Claude',
            scopes: ['openid']
        } as const;
        const ctx = {
            http: {
                authInfo: buildMcpAuthInfo({
                    token: 'tok',
                    actor: actorFor(OWNER_ID),
                    mcpAuth,
                    resourceUrl: 'https://api.test/mcp'
                })
            }
        };
        const call = (input: Record<string, unknown>) =>
            handleMcpToolCall({ definition: setListingPublicationTool, input, ctx });
        const target = { type: 'venue', id: LISTING_ID };

        beforeEach(() => {
            clearSlidingWindowStore();
            harness.givenFacts(mocks, {
                vertical: VerticalEnum.VENUE,
                status: PublicationStatusEnum.PUBLISHED
            });
        });

        it('records a success with its target', async () => {
            // Arrange
            givenStates(
                VerticalEnum.VENUE,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.DRAFT
            );
            givenPublicationService();

            // Act
            const result = await call({ vertical: 'venue', id: LISTING_ID, action: 'pause' });

            // Assert
            expect(result.isError).toBeUndefined();
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    tool: 'set_listing_publication',
                    outcome: 'success',
                    target
                })
            );
        });

        it('records a billing refusal as denied, with its target', async () => {
            // Arrange
            harness.givenBilling(mocks, { covered: true, granted: false });
            givenStates(VerticalEnum.VENUE, PublicationStatusEnum.PUBLISHED);
            givenPublicationService();

            // Act
            const result = await call({ vertical: 'venue', id: LISTING_ID, action: 'pause' });

            // Assert
            expect(result.isError).toBe(true);
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    outcome: 'denied',
                    errorCode: 'ENTITLEMENT_REQUIRED',
                    target
                })
            );
        });

        it('records each step: pause applies, a publish previews then commits', async () => {
            // Arrange
            givenStates(
                VerticalEnum.VENUE,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.DRAFT
            );
            givenPublicationService();
            await call({ vertical: 'venue', id: LISTING_ID, action: 'pause' });
            harness.givenFacts(mocks, {
                vertical: VerticalEnum.VENUE,
                status: PublicationStatusEnum.DRAFT
            });
            givenStates(
                VerticalEnum.VENUE,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.PUBLISHED
            );
            const publish = { vertical: 'venue', id: LISTING_ID, action: 'resume' };

            // Act
            const preview = await call(publish);
            const token = JSON.parse(
                preview.content[0]?.type === 'text' ? preview.content[0].text : '{}'
            ).confirmationToken;
            await call({ ...publish, confirmationToken: token });

            // Assert
            expect(mocks.record.mock.calls.map(([row]) => row.details)).toEqual([
                { action: 'pause', step: 'apply' },
                { action: 'resume', step: 'preview' },
                { action: 'resume', step: 'commit' }
            ]);
        });

        it('records an unexpected failure as error, with its target', async () => {
            // Arrange
            givenStates(VerticalEnum.VENUE, PublicationStatusEnum.PUBLISHED);
            givenPublicationService().unpublish.mockRejectedValue(new Error('db down'));

            // Act
            const result = await call({ vertical: 'venue', id: LISTING_ID, action: 'pause' });

            // Assert
            expect(result.isError).toBe(true);
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({ outcome: 'error', errorCode: 'UNEXPECTED', target })
            );
        });
    });

    describe('tools/list entry', () => {
        const entry = buildToolListEntry({ definition: setListingPublicationTool });

        it('publishes one flat object schema MCP clients accept', () => {
            // Assert
            const schema = entry.inputSchema as Record<string, unknown>;
            expect(schema.type).toBe('object');
            expect(schema).not.toHaveProperty('oneOf');
            expect(schema).not.toHaveProperty('anyOf');
            expect(schema.additionalProperties).toBe(false);
            expect(schema.required).toEqual(['vertical', 'id', 'action']);
            expect((schema.properties as Record<string, unknown>).action).toMatchObject({
                enum: ['pause', 'resume']
            });
        });

        it('is a destructive, non-idempotent write', () => {
            // Assert
            expect(entry.annotations).toEqual({
                title: 'Pausar o reanudar una publicación',
                readOnlyHint: false,
                openWorldHint: false,
                destructiveHint: true,
                idempotentHint: false
            });
        });
    });
});
