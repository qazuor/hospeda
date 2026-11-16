/**
 * HOS-2184 T-017 — `update_listing_basic` for accommodations: the allowlist
 * (a strict `.pick()` of `AccommodationUpdateHttpSchema`: summary,
 * description, phone, website, amenityIds, featureIds — no opening hours,
 * AC-5), the accommodation owner PATCH route's listing access (`EDIT`,
 * owner-only, AC-6), the same conversion and service call as the route
 * (`httpToDomainAccommodationUpdate` + `AccommodationService.update`), the
 * answer (the listing as `get_listing` returns it) and the audit (AC-12).
 *
 * Same harness as `update-listing-basic.test.ts`: listing access runs for
 * real over mocked ports; services are spied on their prototypes.
 *
 * @module test/mcp/tools/listing/update-listing-basic.accommodation
 */

import {
    httpToDomainAccommodationUpdate,
    PermissionEnum,
    PublicationStatusEnum,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, type Actor } from '@repo/service-core';
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

vi.mock('../../../../src/utils/accommodation-catalog-relations', () => ({
    fetchProtectedAmenities: vi.fn(async () => [
        { id: '44444444-4444-4444-8444-444444444444', slug: 'wifi' }
    ]),
    fetchProtectedFeatures: vi.fn(async () => [])
}));

import { handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
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
const vertical = VerticalEnum.ACCOMMODATION;

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

const SUMMARY = 'Cabañas frente al río Uruguay';
const DESCRIPTION = 'Cabañas equipadas a metros del río Uruguay, con parrilla y pileta.';
const PHONE = '+5493442123456';
const WEBSITE = 'https://example.com';

/** Each editable field with a valid value. */
const FIELD_CASES = [
    ['summary', SUMMARY],
    ['description', DESCRIPTION],
    ['phone', PHONE],
    ['website', WEBSITE],
    ['amenityIds', [AMENITY_ID]],
    ['featureIds', [FEATURE_ID]]
] as const;

type UpdateResult = Awaited<ReturnType<AccommodationService['update']>>;
type GetByIdResult = Awaited<ReturnType<AccommodationService['getById']>>;

/** Spies `AccommodationService.update`. */
function givenUpdate(result: unknown = { data: { id: LISTING_ID } }) {
    return vi
        .spyOn(AccommodationService.prototype, 'update')
        .mockResolvedValue(result as UpdateResult);
}

/** Spies `AccommodationService.getById` (the re-read after the write). */
function givenStoredRow() {
    return vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
        data: {
            id: LISTING_ID,
            ownerId: OWNER_ID,
            name: 'Cabañas del Río',
            slug: 'cabanas-del-rio',
            publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            summary: SUMMARY,
            description: DESCRIPTION,
            contactInfo: { mobilePhone: PHONE, website: WEBSITE }
        }
    } as unknown as GetByIdResult);
}

/** Listing facts: an existing PUBLISHED accommodation owned by `ownerId`. */
function givenListing(ownerId: string = OWNER_ID): void {
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId
    });
}

/** The owner's effective set, with or without `edit_accommodation_info`. */
function givenCapability(granted: boolean): void {
    mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: true,
            inheritsTouristVip: false,
            entries: granted ? [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' }] : []
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

describe('update_listing_basic (accommodation)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.coverage.mockResolvedValue({ covered: true, sources: [{ type: 'BASE' }] });
        mocks.preTrialDraftLimits.mockResolvedValue(new Map());
        givenListing();
        givenCapability(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each(
        FIELD_CASES
    )('updates %s alone, converted as the PATCH route converts it', async (field, value) => {
        // Arrange
        const update = givenUpdate();
        givenStoredRow();

        // Act
        const outcome = await run({ vertical, id: LISTING_ID, [field]: value });

        // Assert
        expect(outcome.ok).toBe(true);
        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({ id: OWNER_ID }),
            LISTING_ID,
            httpToDomainAccommodationUpdate({ [field]: value })
        );
    });

    it('stores phone and website inside contactInfo, leaving its other keys alone', async () => {
        // Arrange
        const update = givenUpdate();
        givenStoredRow();

        // Act
        await run({ vertical, id: LISTING_ID, phone: PHONE, website: WEBSITE });

        // Assert
        const domainInput = update.mock.calls[0]?.[2];
        expect(domainInput?.contactInfo).toEqual({ mobilePhone: PHONE, website: WEBSITE });
    });

    it('answers with the listing as get_listing returns it', async () => {
        // Arrange
        givenUpdate();
        givenStoredRow();

        // Act
        const outcome = await run({ vertical, id: LISTING_ID, summary: SUMMARY });

        // Assert
        expect(outcome).toEqual({
            ok: true,
            data: {
                id: LISTING_ID,
                vertical,
                name: 'Cabañas del Río',
                publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                publicUrl: null,
                summary: SUMMARY,
                description: DESCRIPTION,
                phone: PHONE,
                website: WEBSITE,
                amenities: [{ id: AMENITY_ID, slug: 'wifi' }],
                features: []
            }
        });
    });

    it.each([
        ['openingHours', { timezone: 'America/Argentina/Buenos_Aires' }],
        ['contactInfo', { mobilePhone: PHONE }],
        ['name', 'Otro nombre'],
        ['basePrice', 1000],
        ['whatsapp', PHONE],
        ['media', { videos: [] }]
    ])('rejects %s, which is outside the accommodation allowlist (AC-5)', async (field, value) => {
        // Arrange
        const update = givenUpdate();

        // Act
        const failure = await failureOf({
            vertical,
            id: LISTING_ID,
            summary: SUMMARY,
            [field]: value
        });

        // Assert
        expect(failure.code).toBe('VALIDATION_ERROR');
        expect(failure.message.startsWith(TOOL_VALIDATION_MESSAGE)).toBe(true);
        expect(failure.message).toContain(field);
        expect(update).not.toHaveBeenCalled();
        expect(mocks.loadFacts).not.toHaveBeenCalled();
    });

    it('says opening hours cannot be changed on accommodations', async () => {
        // Act
        const failure = await failureOf({
            vertical,
            id: LISTING_ID,
            openingHours: {
                days: {
                    mon: { closed: true, shifts: [] },
                    tue: { closed: true, shifts: [] },
                    wed: { closed: true, shifts: [] },
                    thu: { closed: true, shifts: [] },
                    fri: { closed: true, shifts: [] },
                    sat: { closed: true, shifts: [] },
                    sun: { closed: true, shifts: [] }
                }
            }
        });

        // Assert
        expect(failure.message).toContain(
            'campo «openingHours»: no se puede modificar en alojamientos'
        );
    });

    it('rejects an empty patch', async () => {
        // Arrange
        const update = givenUpdate();

        // Act
        const failure = await failureOf({ vertical, id: LISTING_ID });

        // Assert
        expect(failure.code).toBe('VALIDATION_ERROR');
        expect(failure.message).toContain('indicá al menos un campo a modificar');
        expect(update).not.toHaveBeenCalled();
    });

    it("applies the accommodation description limit (30), not the venue's (20)", async () => {
        // Act
        const failure = await failureOf({
            vertical,
            id: LISTING_ID,
            description: 'Veinticinco caracteres ok'
        });

        // Assert
        expect(failure.message).toContain('zodError.accommodation.description.min');
    });

    it("answers another user's accommodation as not found, without writing (AC-6)", async () => {
        // Arrange
        givenListing(OTHER_ID);
        const update = givenUpdate();

        // Act
        const failure = await failureOf({ vertical, id: LISTING_ID, summary: SUMMARY });

        // Assert
        expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
        expect(update).not.toHaveBeenCalled();
    });

    it('stays owner-only for staff holding the foreign-edit permission', async () => {
        // Arrange
        givenListing(OTHER_ID);
        const update = givenUpdate();

        // Act
        const failure = await failureOf(
            { vertical, id: LISTING_ID, summary: SUMMARY },
            actorFor(OWNER_ID, { permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT] })
        );

        // Assert
        expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
        expect(update).not.toHaveBeenCalled();
    });

    it('answers a missing accommodation with the same not found', async () => {
        // Arrange
        mocks.loadFacts.mockResolvedValue({ facts: null, ownerId: null });
        const update = givenUpdate();

        // Act
        const failure = await failureOf({ vertical, id: LISTING_ID, summary: SUMMARY });

        // Assert
        expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
        expect(update).not.toHaveBeenCalled();
    });

    it('refuses an owner whose plan lacks edit_accommodation_info (EDIT, step 6)', async () => {
        // Arrange
        givenCapability(false);
        const update = givenUpdate();

        // Act
        const failure = await failureOf({ vertical, id: LISTING_ID, summary: SUMMARY });

        // Assert
        expect(failure).toMatchObject({ code: 'ENTITLEMENT_REQUIRED', kind: 'denied' });
        expect(update).not.toHaveBeenCalled();
    });

    it('reports a service refusal with its own message', async () => {
        // Arrange
        givenUpdate({ error: { code: 'FORBIDDEN', message: 'missing ACCOMMODATION_UPDATE_OWN' } });

        // Act
        const failure = await failureOf({ vertical, id: LISTING_ID, summary: SUMMARY });

        // Assert
        expect(failure).toMatchObject({ code: 'FORBIDDEN', kind: 'denied' });
        expect(failure.message).not.toContain('ACCOMMODATION_UPDATE_OWN');
    });

    it('refuses an unverified email before touching anything (write tool)', async () => {
        // Arrange
        const update = givenUpdate();

        // Act
        const failure = await failureOf(
            { vertical, id: LISTING_ID, summary: SUMMARY },
            actorFor(OWNER_ID, { emailVerified: false })
        );

        // Assert
        expect(failure.code).toBe('EMAIL_NOT_VERIFIED');
        expect(update).not.toHaveBeenCalled();
        expect(mocks.loadFacts).not.toHaveBeenCalled();
    });

    describe('audit (AC-12)', () => {
        const actor = actorFor(OWNER_ID);
        const ctx = {
            http: {
                authInfo: buildMcpAuthInfo({
                    token: 'tok',
                    actor,
                    mcpAuth: {
                        userId: OWNER_ID,
                        clientId: 'https://chatgpt.com/oauth/client',
                        clientName: 'ChatGPT',
                        scopes: ['openid']
                    },
                    resourceUrl: 'https://api.test/mcp'
                })
            }
        };
        const call = (input: Record<string, unknown>) =>
            handleMcpToolCall({ definition: updateListingBasicTool, input, ctx });

        beforeEach(() => {
            clearSlidingWindowStore();
        });

        it('records a success with the accommodation target and description length', async () => {
            // Arrange
            givenUpdate();
            givenStoredRow();

            // Act
            await call({ vertical, id: LISTING_ID, description: DESCRIPTION });

            // Assert
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    tool: 'update_listing_basic',
                    outcome: 'success',
                    target: { type: 'accommodation', id: LISTING_ID },
                    contentLength: DESCRIPTION.length
                })
            );
        });

        it('records a foreign accommodation as denied, with its target', async () => {
            // Arrange
            givenListing(OTHER_ID);

            // Act
            await call({ vertical, id: LISTING_ID, phone: PHONE });

            // Assert
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    outcome: 'denied',
                    errorCode: 'NOT_FOUND',
                    target: { type: 'accommodation', id: LISTING_ID }
                })
            );
        });

        it('records a service failure as error, with its target', async () => {
            // Arrange
            givenUpdate({ error: { code: 'INTERNAL_ERROR', message: 'db down' } });

            // Act
            await call({ vertical, id: LISTING_ID, featureIds: [] });

            // Assert
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    outcome: 'error',
                    errorCode: 'INTERNAL_ERROR',
                    target: { type: 'accommodation', id: LISTING_ID }
                })
            );
        });
    });
});
