import type { AccommodationModel } from '@repo/db';
import {
    AccommodationTypeEnum,
    AccommodationUpdateInputSchema,
    DestinationTypeEnum,
    LifecycleStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { z } from 'zod';
import { ZodError } from 'zod';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createMockAccommodation,
    createNewAccommodationInput
} from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

// HOS-296: `_afterUpdate` grants the owner the HOST hat when a listing becomes
// ACTIVE, and the grant is no longer best-effort — a failure fails the update.
// These suites mock every other DB touchpoint, so the primitive is stubbed here
// too; the grant's own behaviour is covered by `roleAssignment.test.ts`.
vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    grantRole: vi.fn().mockResolvedValue({ data: undefined }),
    // HOS-296: the module also exports the read primitive, and the
    // billing-exempt-owner branch calls it. A module mock that omits it turns
    // that branch into "getUserRoles is not a function" — an INTERNAL_ERROR
    // that looks nothing like a role problem.
    getUserRoles: vi.fn().mockResolvedValue([])
}));

// Mocks
const mockLogger = createLoggerMock();

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    // Mock safeParseAsync for validation
    vi.spyOn(AccommodationUpdateInputSchema, 'safeParseAsync').mockImplementation(
        async (input: unknown) => {
            const typedInput = input as z.infer<typeof AccommodationUpdateInputSchema>;
            if (typedInput && Object.hasOwn(typedInput, 'name') && typedInput.name === undefined) {
                return {
                    success: false,
                    error: new ZodError([
                        {
                            code: 'custom',
                            message: 'Invalid input',
                            path: ['name']
                        }
                    ])
                } as z.ZodSafeParseError<z.infer<typeof AccommodationUpdateInputSchema>>;
            }
            return { success: true, data: typedInput } as z.ZodSafeParseSuccess<
                z.infer<typeof AccommodationUpdateInputSchema>
            >;
        }
    );
});

describe('AccommodationService.update', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        // SPEC-095: stub the private destination model so _assertDestinationIsCity
        // resolves a CITY destination without hitting the real DB.
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.CITY })
        };
        vi.clearAllMocks();
    });

    it('should update an accommodation when permissions and input are valid', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        const updateInput = { name: 'Updated Name' };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({ ...existing, ...updateInput });
        // Act
        const result = await service.update(actor, id, updateInput);
        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe('Updated Name');
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(id, undefined);
        expect(model.update).toHaveBeenCalled();
    });

    it('regenerates the slug when an unpublished accommodation is renamed', async () => {
        const actor = createAdminActor();
        const id = 'draft-accommodation-id';
        const existing = createMockAccommodation({
            id,
            name: 'Nombre original',
            slug: 'house-nombre-original',
            type: AccommodationTypeEnum.HOUSE,
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        const updateInput = { name: 'Nombre nuevo' };

        vi.spyOn(helpers, 'generateSlug').mockResolvedValueOnce('house-nombre-nuevo');
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({
            ...existing,
            ...updateInput,
            slug: 'house-nombre-nuevo'
        });

        const result = await service.update(actor, id, updateInput);

        expect(result.error).toBeUndefined();
        expect(helpers.generateSlug).toHaveBeenCalledWith(
            AccommodationTypeEnum.HOUSE,
            'Nombre nuevo',
            id
        );
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.objectContaining({ name: 'Nombre nuevo', slug: 'house-nombre-nuevo' }),
            undefined
        );
    });

    it('does not regenerate the slug when a published accommodation is renamed', async () => {
        const actor = createAdminActor();
        const id = 'published-accommodation-id';
        const existing = createMockAccommodation({
            id,
            name: 'Publicado original',
            slug: 'house-publicado-original',
            type: AccommodationTypeEnum.HOUSE,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        const updateInput = { name: 'Publicado renombrado' };

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({
            ...existing,
            ...updateInput,
            slug: existing.slug
        });

        const result = await service.update(actor, id, updateInput);

        expect(result.error).toBeUndefined();
        expect(helpers.generateSlug).not.toHaveBeenCalled();
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.not.objectContaining({ slug: expect.anything() }),
            undefined
        );
    });

    it('regenerates the slug for a published accommodation only when explicitly requested', async () => {
        const actor = createAdminActor();
        const id = 'published-accommodation-opt-in-id';
        const existing = createMockAccommodation({
            id,
            name: 'Publicado original',
            slug: 'house-publicado-original',
            type: AccommodationTypeEnum.HOUSE,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        const updateInput = {
            name: 'Publicado renombrado',
            refreshSlugFromName: true
        };

        vi.spyOn(helpers, 'generateSlug').mockResolvedValueOnce('house-publicado-renombrado');
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({
            ...existing,
            ...updateInput,
            slug: 'house-publicado-renombrado'
        });

        const result = await service.update(actor, id, updateInput);

        expect(result.error).toBeUndefined();
        expect(helpers.generateSlug).toHaveBeenCalledWith(
            AccommodationTypeEnum.HOUSE,
            'Publicado renombrado',
            id
        );
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.objectContaining({
                name: 'Publicado renombrado',
                slug: 'house-publicado-renombrado'
            }),
            undefined
        );
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.not.objectContaining({ refreshSlugFromName: true }),
            undefined
        );
    });

    // HOS-879: the slug is generated from `type` + `name`, so a type change is
    // just as capable of invalidating the current slug as a rename is. The
    // policy (DRAFT auto-regenerates, published needs the opt-in) applies
    // identically to a type-only change.

    it('regenerates the slug when an unpublished accommodation changes type only', async () => {
        const actor = createAdminActor();
        const id = 'draft-accommodation-type-change-id';
        const existing = createMockAccommodation({
            id,
            name: 'Nombre sin cambios',
            slug: 'countryhouse-nombre-sin-cambios',
            type: AccommodationTypeEnum.COUNTRY_HOUSE,
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        const updateInput = { type: AccommodationTypeEnum.CABIN };

        vi.spyOn(helpers, 'generateSlug').mockResolvedValueOnce('cabin-nombre-sin-cambios');
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({
            ...existing,
            ...updateInput,
            slug: 'cabin-nombre-sin-cambios'
        });

        const result = await service.update(actor, id, updateInput);

        expect(result.error).toBeUndefined();
        // The name did not change, so the composed slug input must fall back
        // to the CURRENT name — not `undefined` (data.name is absent here).
        expect(helpers.generateSlug).toHaveBeenCalledWith(
            AccommodationTypeEnum.CABIN,
            'Nombre sin cambios',
            id
        );
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.objectContaining({ slug: 'cabin-nombre-sin-cambios' }),
            undefined
        );
    });

    it('does not regenerate the slug when a published accommodation changes type only, without opt-in', async () => {
        const actor = createAdminActor();
        const id = 'published-accommodation-type-change-id';
        const existing = createMockAccommodation({
            id,
            name: 'Nombre sin cambios',
            slug: 'countryhouse-nombre-sin-cambios',
            type: AccommodationTypeEnum.COUNTRY_HOUSE,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        const updateInput = { type: AccommodationTypeEnum.CABIN };

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({
            ...existing,
            ...updateInput,
            slug: existing.slug
        });

        const result = await service.update(actor, id, updateInput);

        expect(result.error).toBeUndefined();
        expect(helpers.generateSlug).not.toHaveBeenCalled();
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.not.objectContaining({ slug: expect.anything() }),
            undefined
        );
    });

    it('regenerates the slug for a published accommodation type change only when explicitly requested', async () => {
        const actor = createAdminActor();
        const id = 'published-accommodation-type-change-opt-in-id';
        const existing = createMockAccommodation({
            id,
            name: 'Nombre sin cambios',
            slug: 'countryhouse-nombre-sin-cambios',
            type: AccommodationTypeEnum.COUNTRY_HOUSE,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        const updateInput = {
            type: AccommodationTypeEnum.CABIN,
            refreshSlugFromName: true
        };

        vi.spyOn(helpers, 'generateSlug').mockResolvedValueOnce('cabin-nombre-sin-cambios');
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({
            ...existing,
            ...updateInput,
            slug: 'cabin-nombre-sin-cambios'
        });

        const result = await service.update(actor, id, updateInput);

        expect(result.error).toBeUndefined();
        expect(helpers.generateSlug).toHaveBeenCalledWith(
            AccommodationTypeEnum.CABIN,
            'Nombre sin cambios',
            id
        );
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.objectContaining({ slug: 'cabin-nombre-sin-cambios' }),
            undefined
        );
    });

    it('does not regenerate the slug when neither name nor type change', async () => {
        const actor = createAdminActor();
        const id = 'no-change-accommodation-id';
        const existing = createMockAccommodation({
            id,
            name: 'Nombre sin cambios',
            slug: 'cabin-nombre-sin-cambios',
            type: AccommodationTypeEnum.CABIN,
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        const updateInput = { type: AccommodationTypeEnum.CABIN };

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({ ...existing, ...updateInput });

        const result = await service.update(actor, id, updateInput);

        expect(result.error).toBeUndefined();
        expect(helpers.generateSlug).not.toHaveBeenCalled();
        expect(model.update).toHaveBeenCalledWith(
            { id },
            expect.not.objectContaining({ slug: expect.anything() }),
            undefined
        );
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);
        // Act
        const result = await service.update(actor, id, { name: 'Updated Name' });
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'mock-id';
        const updateInput = { name: 'a' }; // Too short name should fail validation (min 3 chars)
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);

        // Restore original safeParseAsync for this test to use real validation
        vi.restoreAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');

        // Act - Send invalid data that should fail validation
        const result = await service.update(actor, id, updateInput);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'not-found-id';
        (model.findById as Mock).mockResolvedValue(null);
        // Act
        const result = await service.update(actor, id, { name: 'Updated Name' });
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        const actor = createAdminActor();
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.update(actor, id, { name: 'Updated Name' });
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    // SPEC-095: destinationType=CITY enforcement on update
    it('should return VALIDATION_ERROR when changing destinationId to a non-CITY destination', async () => {
        const actor = createAdminActor();
        const id = 'mock-id';
        const existing = { ...createNewAccommodationInput(), id };
        (model.findById as Mock).mockResolvedValue(existing);
        // @ts-expect-error: override for test
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.PROVINCE })
        };
        const result = await service.update(actor, id, {
            destinationId: '11111111-1111-4111-8111-111111111111'
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toMatch(/CITY/);
        expect(model.update).not.toHaveBeenCalled();
    });
});
