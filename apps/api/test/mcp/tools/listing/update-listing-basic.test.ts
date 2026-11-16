/**
 * HOS-2184 T-016 — `update_listing_basic` for venues and experiences: the
 * allowlist (a strict `.pick()` of the owner PATCH body, AC-5), the owner
 * PATCH route's listing-access step (`EDIT` + written sections, owner-only,
 * AC-6), the `updateOwn` call, the answer (the listing as `get_listing`
 * returns it), the audit record (AC-12) and the published input schema.
 *
 * Listing access runs for real over mocked ports (the pattern of
 * `test/middlewares/listing-access.test.ts`); services are spied on their
 * prototypes; catalog-relation readers are mocked at their module boundary.
 *
 * @module test/mcp/tools/listing/update-listing-basic
 */

import { PermissionEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { type Actor, ExperienceService, VenueService } from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    preTrialDraftLimits: vi.fn(),
    record: vi.fn()
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

vi.mock('../../../../src/utils/listing-catalog-relations', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/utils/listing-catalog-relations')>()),
    fetchVenueAmenities: vi.fn(async () => [
        { amenityId: '44444444-4444-4444-8444-444444444444', slug: 'wifi' }
    ]),
    fetchVenueFeatures: vi.fn(async () => []),
    fetchExperienceAmenities: vi.fn(async () => []),
    fetchExperienceFeatures: vi.fn(async () => [])
}));

import { buildToolListEntry, handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import { updateListingBasicTool } from '../../../../src/mcp/tools/listing/update-listing-basic';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_VALIDATION_MESSAGE
} from '../../../../src/mcp/tools/tool-errors';
import { clearSlidingWindowStore } from '../../../../src/middlewares/rate-limit';
import { validateApiEnv } from '../../../../src/utils/env';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
const AMENITY_ID = '44444444-4444-4444-8444-444444444444';
const FEATURE_ID = '55555555-5555-4555-8555-555555555555';
const context = { channel: 'mcp' } as const;

const actorFor = (
    id: string,
    options: { readonly permissions?: readonly string[]; readonly emailVerified?: boolean } = {}
): Actor =>
    ({
        id,
        roles: ['HOST'],
        permissions: options.permissions ?? [],
        emailVerified: options.emailVerified ?? true
    }) as unknown as Actor;

const DESCRIPTION = 'Parrilla de barrio con patio y mesas afuera.';
const OPEN_DAY = { closed: false, shifts: [{ open: '09:00', close: '18:00' }] };
const OPENING_HOURS = {
    timezone: 'America/Argentina/Buenos_Aires',
    days: {
        mon: OPEN_DAY,
        tue: OPEN_DAY,
        wed: OPEN_DAY,
        thu: OPEN_DAY,
        fri: OPEN_DAY,
        sat: { closed: true, shifts: [] },
        sun: { closed: true, shifts: [] }
    }
};
const CONTACT_INFO = { mobilePhone: '+5493442123456', website: 'https://example.com' };

const SCHEDULED = [VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const;
type Scheduled = (typeof SCHEDULED)[number];

const SERVICES = {
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

const EDIT_KEY = {
    [VerticalEnum.VENUE]: 'edit_venue_info',
    [VerticalEnum.EXPERIENCE]: 'edit_experience_info'
} as const;

/** Each editable field with a valid value. */
const FIELD_CASES = [
    ['description', DESCRIPTION],
    ['openingHours', OPENING_HOURS],
    ['contactInfo', CONTACT_INFO],
    ['amenityIds', [AMENITY_ID]],
    ['featureIds', [FEATURE_ID]]
] as const;

type ServiceResult = Awaited<ReturnType<VenueService['updateOwn']>>;
type GetByIdResult = Awaited<ReturnType<VenueService['getById']>>;

/** Spies one vertical's `updateOwn`. */
function givenUpdateOwn(vertical: Scheduled, result: unknown = { data: { id: LISTING_ID } }) {
    const prototype = SERVICES[vertical].prototype as unknown as {
        updateOwn: (...args: unknown[]) => Promise<ServiceResult>;
    };
    return vi.spyOn(prototype, 'updateOwn').mockResolvedValue(result as ServiceResult);
}

/** Spies one vertical's `getById` (the re-read after the write). */
function givenStoredRow(vertical: Scheduled, overrides: Record<string, unknown> = {}) {
    const prototype = SERVICES[vertical].prototype as unknown as {
        getById: (...args: unknown[]) => Promise<GetByIdResult>;
    };
    return vi.spyOn(prototype, 'getById').mockResolvedValue({
        data: {
            id: LISTING_ID,
            ownerId: OWNER_ID,
            name: 'La Parrilla',
            slug: 'la-parrilla',
            publicationStatus: PublicationStatusEnum.DRAFT,
            description: DESCRIPTION,
            openingHours: OPENING_HOURS,
            contactInfo: CONTACT_INFO,
            ...overrides
        }
    } as unknown as GetByIdResult);
}

/**
 * Listing facts: the listing exists, is owned by `ownerId` and is PUBLISHED
 * (a DRAFT is edited without the capability, so step 6 would not run).
 */
function givenListing(vertical: Scheduled, ownerId: string = OWNER_ID): void {
    mocks.loadFacts.mockResolvedValue({
        facts: {
            ownerId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            businessLines: vertical === VerticalEnum.VENUE ? ['food'] : ['standard']
        },
        ownerId
    });
}

/** The owner's effective set, with or without the vertical's edit capability. */
function givenCapability(vertical: Scheduled, granted: boolean): void {
    mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: true,
            inheritsTouristVip: false,
            entries: granted ? [{ key: EDIT_KEY[vertical], value: 1, strategy: 'MAX' }] : []
        })
    );
}

const run = (input: Record<string, unknown>, actor: Actor = actorFor(OWNER_ID)) =>
    runTool({ definition: updateListingBasicTool, actor, input, context });

const failureOf = async (input: Record<string, unknown>, actor?: Actor) => {
    const outcome = await run(input, actor);
    if (outcome.ok) throw new Error('expected a failure');
    return outcome.failure;
};

describe('update_listing_basic (venue, experience)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.coverage.mockResolvedValue({ covered: true, sources: [{ type: 'BASE' }] });
        mocks.preTrialDraftLimits.mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe.each(SCHEDULED)('%s', (vertical) => {
        beforeEach(() => {
            givenListing(vertical);
            givenCapability(vertical, true);
        });

        it.each(FIELD_CASES)('updates %s alone through updateOwn', async (field, value) => {
            // Arrange
            const updateOwn = givenUpdateOwn(vertical);
            givenStoredRow(vertical);

            // Act
            const outcome = await run({ vertical, id: LISTING_ID, [field]: value });

            // Assert
            expect(outcome.ok).toBe(true);
            expect(updateOwn).toHaveBeenCalledTimes(1);
            expect(updateOwn).toHaveBeenCalledWith(
                LISTING_ID,
                { [field]: value },
                expect.objectContaining({ id: OWNER_ID })
            );
        });

        it('answers with the listing as get_listing returns it', async () => {
            // Arrange
            givenUpdateOwn(vertical);
            givenStoredRow(vertical);

            // Act
            const outcome = await run({ vertical, id: LISTING_ID, description: DESCRIPTION });

            // Assert
            expect(outcome).toEqual({
                ok: true,
                data: {
                    id: LISTING_ID,
                    vertical,
                    name: 'La Parrilla',
                    publicationStatus: PublicationStatusEnum.DRAFT,
                    publicUrl: null,
                    description: DESCRIPTION,
                    openingHours: OPENING_HOURS,
                    contactInfo: CONTACT_INFO,
                    amenities:
                        vertical === VerticalEnum.VENUE ? [{ id: AMENITY_ID, slug: 'wifi' }] : [],
                    features: []
                }
            });
        });

        it.each([
            ['summary', 'Un resumen corto'],
            ['name', 'Otro nombre'],
            ['socialNetworks', { instagram: 'https://instagram.com/x' }],
            ['phone', '+5493442123456'],
            ['publicationStatus', 'PUBLISHED']
        ])('rejects %s, which is outside the allowlist (AC-5)', async (field, value) => {
            // Arrange
            const updateOwn = givenUpdateOwn(vertical);

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                description: DESCRIPTION,
                [field]: value
            });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message.startsWith(TOOL_VALIDATION_MESSAGE)).toBe(true);
            expect(failure.message).toContain(field);
            expect(updateOwn).not.toHaveBeenCalled();
            expect(mocks.loadFacts).not.toHaveBeenCalled();
        });

        it('rejects an empty patch', async () => {
            // Arrange
            const updateOwn = givenUpdateOwn(vertical);

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain('indicá al menos un campo a modificar');
            expect(updateOwn).not.toHaveBeenCalled();
        });

        it("applies the vertical's own description limits, reported once", async () => {
            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, description: 'corta' });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain('zodError.listing.description.min');
            expect(failure.message.match(/campo «description»/g)).toHaveLength(1);
        });

        it("answers another user's listing as not found, without writing (AC-6)", async () => {
            // Arrange
            givenListing(vertical, OTHER_ID);
            const updateOwn = givenUpdateOwn(vertical);

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, description: DESCRIPTION });

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(updateOwn).not.toHaveBeenCalled();
        });

        it('stays owner-only for staff holding the foreign-edit permission', async () => {
            // Arrange
            givenListing(vertical, OTHER_ID);
            const updateOwn = givenUpdateOwn(vertical);
            const staff = actorFor(OWNER_ID, {
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
            });

            // Act
            const failure = await failureOf(
                { vertical, id: LISTING_ID, description: DESCRIPTION },
                staff
            );

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(updateOwn).not.toHaveBeenCalled();
        });

        it('answers a missing listing with the same not found', async () => {
            // Arrange
            mocks.loadFacts.mockResolvedValue({ facts: null, ownerId: null });
            const updateOwn = givenUpdateOwn(vertical);

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, description: DESCRIPTION });

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(updateOwn).not.toHaveBeenCalled();
        });

        it('refuses an owner whose plan lacks the edit capability (EDIT, step 6)', async () => {
            // Arrange
            givenCapability(vertical, false);
            const updateOwn = givenUpdateOwn(vertical);

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, description: DESCRIPTION });

            // Assert
            expect(failure).toMatchObject({ code: 'ENTITLEMENT_REQUIRED', kind: 'denied' });
            expect(updateOwn).not.toHaveBeenCalled();
            expect(mocks.effectiveSet).toHaveBeenCalledWith(
                expect.objectContaining({ userId: OWNER_ID, vertical })
            );
        });

        it('answers a service NOT_FOUND with the same not found', async () => {
            // Arrange
            givenUpdateOwn(vertical, {
                error: { code: 'NOT_FOUND', message: 'Venue not found' }
            });

            // Act
            const failure = await failureOf({ vertical, id: LISTING_ID, description: DESCRIPTION });

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
        });

        it('refuses an unverified email before touching anything (write tool)', async () => {
            // Arrange
            const updateOwn = givenUpdateOwn(vertical);

            // Act
            const failure = await failureOf(
                { vertical, id: LISTING_ID, description: DESCRIPTION },
                actorFor(OWNER_ID, { emailVerified: false })
            );

            // Assert
            expect(failure.code).toBe('EMAIL_NOT_VERIFIED');
            expect(updateOwn).not.toHaveBeenCalled();
            expect(mocks.loadFacts).not.toHaveBeenCalled();
        });
    });

    it('rejects verticals the tool does not edit', async () => {
        // Act
        const failure = await failureOf({
            vertical: 'tourist',
            id: LISTING_ID,
            description: DESCRIPTION
        });

        // Assert
        expect(failure.code).toBe('VALIDATION_ERROR');
        expect(failure.message).toContain('vertical');
    });

    describe('audit (AC-12)', () => {
        const mcpAuth = {
            userId: OWNER_ID,
            clientId: 'https://claude.ai/oauth/mcp-client-metadata',
            clientName: 'Claude',
            scopes: ['openid']
        } as const;
        const actor = actorFor(OWNER_ID);
        const ctx = {
            http: {
                authInfo: buildMcpAuthInfo({
                    token: 'tok',
                    actor,
                    mcpAuth,
                    resourceUrl: 'https://api.test/mcp'
                })
            }
        };
        const call = (input: Record<string, unknown>) =>
            handleMcpToolCall({ definition: updateListingBasicTool, input, ctx });

        beforeEach(() => {
            clearSlidingWindowStore();
            givenListing(VerticalEnum.VENUE);
            givenCapability(VerticalEnum.VENUE, true);
        });

        it('records a success with target and description length', async () => {
            // Arrange
            givenUpdateOwn(VerticalEnum.VENUE);
            givenStoredRow(VerticalEnum.VENUE);

            // Act
            const result = await call({
                vertical: 'venue',
                id: LISTING_ID,
                description: DESCRIPTION
            });

            // Assert
            expect(result.isError).toBeUndefined();
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    tool: 'update_listing_basic',
                    outcome: 'success',
                    target: { type: 'venue', id: LISTING_ID },
                    contentLength: DESCRIPTION.length
                })
            );
        });

        it('records a foreign listing as denied, with its target', async () => {
            // Arrange
            givenListing(VerticalEnum.VENUE, OTHER_ID);

            // Act
            const result = await call({
                vertical: 'venue',
                id: LISTING_ID,
                openingHours: OPENING_HOURS
            });

            // Assert
            expect(result.isError).toBe(true);
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    outcome: 'denied',
                    errorCode: 'NOT_FOUND',
                    target: { type: 'venue', id: LISTING_ID }
                })
            );
            expect(mocks.record.mock.calls[0]?.[0]).not.toHaveProperty('contentLength');
        });

        it('records a service failure as error, with its target', async () => {
            // Arrange
            givenUpdateOwn(VerticalEnum.VENUE, {
                error: { code: 'INTERNAL_ERROR', message: 'db down' }
            });

            // Act
            const result = await call({ vertical: 'venue', id: LISTING_ID, amenityIds: [] });

            // Assert
            expect(result.isError).toBe(true);
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    outcome: 'error',
                    errorCode: 'INTERNAL_ERROR',
                    target: { type: 'venue', id: LISTING_ID }
                })
            );
        });

        it('records a call outside the allowlist as error, without target', async () => {
            // Act
            await call({ vertical: 'venue', id: LISTING_ID, name: 'x' });

            // Assert
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({ outcome: 'error', errorCode: 'VALIDATION_ERROR' })
            );
            expect(mocks.record.mock.calls[0]?.[0]).not.toHaveProperty('target');
        });
    });

    describe('tools/list entry', () => {
        const entry = buildToolListEntry({ definition: updateListingBasicTool });

        it('publishes one flat object schema MCP clients accept', () => {
            // Assert
            const schema = entry.inputSchema as Record<string, unknown>;
            expect(schema.type).toBe('object');
            expect(schema).not.toHaveProperty('oneOf');
            expect(schema).not.toHaveProperty('anyOf');
            expect(schema).not.toHaveProperty('allOf');
            expect(schema.additionalProperties).toBe(false);
            expect(schema.required).toEqual(['vertical', 'id']);
            expect(Object.keys(schema.properties as object)).toEqual([
                'vertical',
                'id',
                'summary',
                'description',
                'openingHours',
                'contactInfo',
                'phone',
                'website',
                'amenityIds',
                'featureIds'
            ]);
            expect((schema.properties as Record<string, unknown>).vertical).toMatchObject({
                enum: ['accommodation', 'venue', 'experience']
            });
        });

        it('is a non-destructive, idempotent write', () => {
            // Assert
            expect(entry.annotations).toEqual({
                title: 'Editar datos básicos de una publicación',
                readOnlyHint: false,
                openWorldHint: false,
                destructiveHint: false,
                idempotentHint: true
            });
        });
    });
});
