/**
 * createForOnboarding.test.ts
 *
 * Unit tests for the public-host-onboarding entry point of AccommodationService.
 *
 * Validates the two terminal states (`created`, `resumed`),
 * the idempotency contract (one DRAFT per USER), the no-op role promotion for
 * already-privileged actors, the defense-in-depth `ownerId = actor.id` override,
 * and the SPEC-258 B-API expansion: import-provided fields (capacity, location,
 * price, contactInfo, amenityIds) are persisted in the draft and amenities are
 * synced transactionally.
 */

import type { AccommodationModel, RAccommodationAmenityModel, UserModel } from '@repo/db';
import {
    AccommodationTypeEnum,
    DestinationTypeEnum,
    LifecycleStatusEnum,
    PriceCurrencyEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import * as junctionSync from '../../../src/services/accommodation/accommodation.junction-sync';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createActor, createHostActor, createSuperAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

vi.mock('../../../src/utils/transaction.js', () => ({
    /**
     * Drop-in stub for `withServiceTransaction`. Runs the callback synchronously
     * with a fake context so unit tests do not need a real DB. Integration tests
     * exercise the real driver.
     */
    withServiceTransaction: vi.fn(async (cb: (txCtx: unknown) => Promise<unknown>) => {
        return cb({ tx: {} as unknown, hookState: {} });
    })
}));

/** Minimal required draft input (name / summary / type / destinationId). */
const VALID_DRAFT_INPUT = {
    name: 'Casa frente al rio',
    summary: 'Una casa amplia con vista al rio Uruguay y mucho parque',
    description:
        'Casa de cinco ambientes a metros del rio Uruguay. Ideal para familias o grupos chicos.',
    type: AccommodationTypeEnum.CABIN,
    destinationId: '8d8fe2db-2f7f-4a9b-8f3a-1234567890ab'
} as const;

/**
 * Extended draft input that includes all optional import-provided fields
 * introduced by SPEC-258 B-API (capacity, location, price, contactInfo, amenityIds).
 * Not marked `as const` so `amenityIds` stays `string[]` (matches Zod schema type).
 */
const VALID_DRAFT_INPUT_WITH_IMPORT_DATA = {
    ...VALID_DRAFT_INPUT,
    // capacity
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 2,
    beds: 4,
    // price
    basePrice: 120,
    currency: PriceCurrencyEnum.ARS,
    // location
    latitude: -32.4854,
    longitude: -58.2357,
    street: 'Calle Falsa',
    number: '123',
    // contact
    phone: '+5493442123456',
    website: 'https://casafrentealrio.com',
    // amenities (mutable array — schema expects string[], not readonly)
    amenityIds: [
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    ] as string[]
};

function createUserModelMock(): UserModel {
    return createModelMock() as unknown as UserModel;
}

function buildService(
    model: ReturnType<typeof createMockBaseModel>,
    userModel: UserModel
): AccommodationService {
    const mockLogger = createLoggerMock();
    const service = new AccommodationService(
        { logger: mockLogger },
        model as AccommodationModel,
        null,
        userModel
    );
    // Suppress destination-count side-effect.
    // @ts-expect-error: override internal for test isolation
    service.destinationService = {
        updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
    };
    // Stub destination model so _assertDestinationIsCity sees a CITY.
    // @ts-expect-error: override for test
    service._destinationModel = {
        findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.CITY })
    };
    // Stub amenity models so syncAmenityJunction does not throw when called
    // with the fake transaction context. The junction sync itself is tested
    // via the spy on the exported function.
    // @ts-expect-error: override internal for test isolation
    service._rAmenityModel = {
        findAll: vi.fn().mockResolvedValue({ items: [] }),
        create: vi.fn().mockResolvedValue(undefined),
        hardDelete: vi.fn().mockResolvedValue(undefined)
    } as unknown as RAccommodationAmenityModel;
    // @ts-expect-error: override internal for test isolation
    service._amenityModel = {
        findById: vi.fn().mockResolvedValue({ id: 'amenity-exists' })
    };
    return service;
}

describe('AccommodationService.createForOnboarding', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');

        accommodationModel = createMockBaseModel();
        // The shared mock factory does not include findOne — add it for this suite.
        (accommodationModel as unknown as { findOne: unknown }).findOne = vi.fn();
        userModel = createUserModelMock();
        service = buildService(accommodationModel, userModel);
    });

    describe('status: created', () => {
        it('inserts a fresh DRAFT for a USER without an existing draft', async () => {
            // Arrange
            const actor = createActor({ id: 'user-001' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-001',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            const created = createMockAccommodation({
                id: 'acc-001',
                ownerId: 'user-001',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.status).toBe('created');
            if (result.data?.status === 'created') {
                expect(result.data.accommodation.id).toBe('acc-001');
            }
            expect(accommodationModel.create).toHaveBeenCalledTimes(1);
        });

        it('promotes the owner USER -> HOST in the same transaction as the draft insert', async () => {
            const actor = createActor({ id: 'user-001b' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-001b',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            (accommodationModel.create as Mock).mockResolvedValue(
                createMockAccommodation({ id: 'acc-001b', ownerId: 'user-001b' })
            );

            await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // The owner is promoted to HOST so they can access the admin panel.
            expect(userModel.update).toHaveBeenCalledWith(
                { id: 'user-001b' },
                { role: RoleEnum.HOST },
                expect.anything()
            );
        });

        it('forces ownerId to actor.id and lifecycleState to DRAFT (defense in depth)', async () => {
            // Arrange
            const actor = createActor({ id: 'user-002' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-002',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            const created = createMockAccommodation({
                id: 'acc-002',
                ownerId: 'user-002',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert: payload passed to model.create has the correct ownerId and DRAFT state
            const createCalls = (accommodationModel.create as Mock).mock.calls;
            expect(createCalls).toHaveLength(1);
            const payload = createCalls[0]?.[0];
            expect(payload.ownerId).toBe('user-002');
            expect(payload.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
            expect(payload.lastWarnedAt).toBeNull();
            expect(payload.createdById).toBe('user-002');
        });
    });

    describe('status: resumed (idempotency)', () => {
        it('returns the existing DRAFT when one is already active for this owner', async () => {
            // Arrange
            const actor = createActor({ id: 'user-003' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-003',
                role: RoleEnum.USER
            });
            const existing = createMockAccommodation({
                id: 'acc-existing',
                ownerId: 'user-003',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(existing);

            // Act
            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('resumed');
            if (result.data?.status === 'resumed') {
                expect(result.data.accommodation.id).toBe('acc-existing');
            }
            // model.create must not be called when a draft already exists
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });

        it('queries for non-deleted DRAFT only', async () => {
            // Arrange
            const actor = createActor({ id: 'user-004' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-004',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            (accommodationModel.create as Mock).mockResolvedValue(
                createMockAccommodation({ id: 'acc-new', ownerId: 'user-004' })
            );

            // Act
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert: the where clause locks the lookup to ownerId + DRAFT + not soft-deleted
            const findOneCalls = (accommodationModel.findOne as Mock).mock.calls;
            expect(findOneCalls).toHaveLength(1);
            expect(findOneCalls[0]?.[0]).toEqual({
                ownerId: 'user-004',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                deletedAt: null
            });
        });
    });

    describe('existing HOST actor — creates a new DRAFT (no short-circuit)', () => {
        it('returns created with a new DRAFT for a HOST with no existing draft', async () => {
            // Regression guard: the old short-circuit returned `already_host` for HOST
            // actors. With the fix, an existing HOST flows through normally and gets
            // a new DRAFT created so they do not lose their input.
            const actor = createHostActor({ id: 'user-host' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-host',
                role: RoleEnum.HOST
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            const created = createMockAccommodation({
                id: 'acc-host-new',
                ownerId: 'user-host',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('created');
            if (result.data?.status === 'created') {
                expect(result.data.accommodation.id).toBe('acc-host-new');
            }
            expect(accommodationModel.create).toHaveBeenCalledTimes(1);
        });

        it('returns resumed (not created) for a HOST who already has an active DRAFT', async () => {
            // The DRAFT idempotency guard fires before any create logic,
            // so a HOST with an existing DRAFT gets `resumed`, not a second draft.
            const actor = createHostActor({ id: 'user-host-draft' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-host-draft',
                role: RoleEnum.HOST
            });
            const existing = createMockAccommodation({
                id: 'acc-host-existing',
                ownerId: 'user-host-draft',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(existing);

            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('resumed');
            if (result.data?.status === 'resumed') {
                expect(result.data.accommodation.id).toBe('acc-host-existing');
            }
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });

        it.each([
            ['ADMIN', RoleEnum.ADMIN],
            ['CLIENT_MANAGER', RoleEnum.CLIENT_MANAGER],
            ['SUPER_ADMIN', RoleEnum.SUPER_ADMIN]
        ])('returns created for a %s actor with no existing draft', async (_label, role) => {
            const actor = createSuperAdminActor({ id: 'user-priv' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-priv',
                role
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            (accommodationModel.create as Mock).mockResolvedValue(
                createMockAccommodation({ id: 'acc-priv', ownerId: 'user-priv' })
            );

            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            expect(result.data?.status).toBe('created');
            expect(accommodationModel.create).toHaveBeenCalledTimes(1);
        });
    });

    describe('validation', () => {
        it('returns VALIDATION_ERROR when name is missing', async () => {
            const actor = createActor({ id: 'user-005' });
            const result = await service.createForOnboarding(actor, {
                ...VALID_DRAFT_INPUT,
                name: undefined
            } as unknown as typeof VALID_DRAFT_INPUT);
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.data).toBeUndefined();
        });

        it('returns VALIDATION_ERROR when destinationId is not a UUID', async () => {
            const actor = createActor({ id: 'user-006' });
            const result = await service.createForOnboarding(actor, {
                ...VALID_DRAFT_INPUT,
                destinationId: 'not-a-uuid'
            });
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('returns VALIDATION_ERROR when destination is not a CITY', async () => {
            const actor = createActor({ id: 'user-007' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-007',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            // Override destination to a non-CITY type.
            // @ts-expect-error: override for test
            service._destinationModel = {
                findById: vi
                    .fn()
                    .mockResolvedValue({ destinationType: DestinationTypeEnum.PROVINCE })
            };

            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toMatch(/CITY/);
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });

        it('returns VALIDATION_ERROR when amenityIds contains a non-UUID', async () => {
            // Arrange
            const actor = createActor({ id: 'user-008' });
            // Act
            const result = await service.createForOnboarding(actor, {
                ...VALID_DRAFT_INPUT,
                amenityIds: ['not-a-uuid']
            });
            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });

        it('returns VALIDATION_ERROR when website URL is invalid', async () => {
            // Arrange
            const actor = createActor({ id: 'user-009' });
            // Act
            const result = await service.createForOnboarding(actor, {
                ...VALID_DRAFT_INPUT,
                website: 'not-a-valid-url'
            });
            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // -------------------------------------------------------------------------
    // SPEC-258 B-API — import-provided optional fields
    // -------------------------------------------------------------------------

    describe('SPEC-258 B-API: import-provided optional fields are persisted', () => {
        beforeEach(() => {
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-import',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
        });

        it('persists extraInfo (capacity/bedrooms/bathrooms/beds) when provided', async () => {
            // Arrange
            const actor = createActor({ id: 'user-import' });
            const created = createMockAccommodation({ id: 'acc-import', ownerId: 'user-import' });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            const result = await service.createForOnboarding(
                actor,
                VALID_DRAFT_INPUT_WITH_IMPORT_DATA
            );

            // Assert
            expect(result.error).toBeUndefined();
            const payload = (accommodationModel.create as Mock).mock.calls[0]?.[0];
            expect(payload.extraInfo).toBeDefined();
            expect(payload.extraInfo.capacity).toBe(6);
            expect(payload.extraInfo.bedrooms).toBe(3);
            expect(payload.extraInfo.bathrooms).toBe(2);
            expect(payload.extraInfo.beds).toBe(4);
        });

        it('persists price (basePrice/currency) when provided', async () => {
            // Arrange
            const actor = createActor({ id: 'user-import' });
            const created = createMockAccommodation({ id: 'acc-import', ownerId: 'user-import' });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT_WITH_IMPORT_DATA);

            // Assert
            const payload = (accommodationModel.create as Mock).mock.calls[0]?.[0];
            expect(payload.price).toBeDefined();
            expect(payload.price.price).toBe(120);
            expect(payload.price.currency).toBe(PriceCurrencyEnum.ARS);
        });

        it('persists location (coordinates/street/number) when provided', async () => {
            // Arrange
            const actor = createActor({ id: 'user-import' });
            const created = createMockAccommodation({ id: 'acc-import', ownerId: 'user-import' });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT_WITH_IMPORT_DATA);

            // Assert
            const payload = (accommodationModel.create as Mock).mock.calls[0]?.[0];
            expect(payload.location).toBeDefined();
            expect(payload.location.coordinates.lat).toBe('-32.4854');
            expect(payload.location.coordinates.long).toBe('-58.2357');
            expect(payload.location.street).toBe('Calle Falsa');
            expect(payload.location.number).toBe('123');
        });

        it('persists contactInfo (phone/website) when provided', async () => {
            // Arrange
            const actor = createActor({ id: 'user-import' });
            const created = createMockAccommodation({ id: 'acc-import', ownerId: 'user-import' });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT_WITH_IMPORT_DATA);

            // Assert
            const payload = (accommodationModel.create as Mock).mock.calls[0]?.[0];
            expect(payload.contactInfo).toBeDefined();
            expect(payload.contactInfo.mobilePhone).toBe('+5493442123456');
            expect(payload.contactInfo.website).toBe('https://casafrentealrio.com');
        });

        it('calls syncAmenityJunction when amenityIds are provided', async () => {
            // Arrange
            const actor = createActor({ id: 'user-import' });
            const created = createMockAccommodation({ id: 'acc-import', ownerId: 'user-import' });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Spy on the exported syncAmenityJunction so we can verify it is called
            // with the correct arguments without needing a real database connection.
            const syncSpy = vi
                .spyOn(junctionSync, 'syncAmenityJunction')
                .mockResolvedValue(undefined);

            // Act
            const result = await service.createForOnboarding(
                actor,
                VALID_DRAFT_INPUT_WITH_IMPORT_DATA
            );

            // Assert
            expect(result.error).toBeUndefined();
            expect(syncSpy).toHaveBeenCalledTimes(1);
            const syncCall = syncSpy.mock.calls[0]?.[0];
            expect(syncCall?.accommodationId).toBe('acc-import');
            expect(syncCall?.amenityIds).toEqual([
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'b2c3d4e5-f6a7-8901-bcde-f12345678901'
            ]);
            expect(syncCall?.tx).toBeDefined();
        });

        it('does NOT call syncAmenityJunction when amenityIds are absent', async () => {
            // Arrange
            const actor = createActor({ id: 'user-import' });
            const created = createMockAccommodation({ id: 'acc-import', ownerId: 'user-import' });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            const syncSpy = vi
                .spyOn(junctionSync, 'syncAmenityJunction')
                .mockResolvedValue(undefined);

            // Act — minimal payload without amenityIds
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert
            expect(syncSpy).not.toHaveBeenCalled();
        });

        it('still works correctly with just the minimal required fields (regression)', async () => {
            // Arrange
            const actor = createActor({ id: 'user-minimal' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-minimal',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            const created = createMockAccommodation({
                id: 'acc-minimal',
                ownerId: 'user-minimal',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('created');
            const payload = (accommodationModel.create as Mock).mock.calls[0]?.[0];
            // These optional JSONB fields are absent when not provided
            expect(payload.extraInfo).toBeUndefined();
            expect(payload.location).toBeUndefined();
            expect(payload.price).toBeUndefined();
            expect(payload.contactInfo).toBeUndefined();
            // Required forced fields are still set
            expect(payload.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
            expect(payload.ownerId).toBe('user-minimal');
        });
    });
});
