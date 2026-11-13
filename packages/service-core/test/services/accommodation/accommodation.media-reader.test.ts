import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findAccommodation, findMedia } = vi.hoisted(() => ({
    findAccommodation: vi.fn(),
    findMedia: vi.fn()
}));
vi.mock('@repo/db', () => ({
    AccommodationModel: vi.fn().mockImplementation(function () {
        return { findById: findAccommodation };
    }),
    AccommodationMediaModel: vi.fn().mockImplementation(function () {
        return { findByAccommodation: findMedia };
    })
}));

import { getAccommodationMediaForReader } from '../../../src/services/accommodation/accommodation.media-reader.js';
import type { ServiceError } from '../../../src/types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createActor, createAdminActor, createHostActor } from '../../factories/actorFactory';

const accommodationId = '11111111-1111-4111-8111-111111111111';
const ownerId = 'owner-1';
const rows = [{ id: 'media-1' }];
const owner = createHostActor({
    id: ownerId,
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
});
const foreign = createHostActor({
    id: 'foreign',
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
});
const staff = (permissions: PermissionEnum[]) => createAdminActor({ id: 'staff', permissions });

beforeEach(() => {
    vi.clearAllMocks();
    findAccommodation.mockResolvedValue(
        createMockAccommodation({ id: accommodationId, ownerId, deletedAt: null })
    );
    findMedia.mockResolvedValue({ items: rows });
});

async function errorOf(promise: Promise<unknown>): Promise<ServiceError> {
    try {
        await promise;
    } catch (error) {
        return error as ServiceError;
    }
    throw new Error('Expected the reader to reject');
}

describe('getAccommodationMediaForReader', () => {
    it('rejects UPDATE_ANY-only staff with the same NOT_FOUND as a missing record and does not read media', async () => {
        const foreignError = await errorOf(
            getAccommodationMediaForReader({
                actor: staff([PermissionEnum.ACCOMMODATION_UPDATE_ANY]),
                accommodationId
            })
        );
        findAccommodation.mockResolvedValue(null);
        const missingError = await errorOf(
            getAccommodationMediaForReader({ actor: staff([]), accommodationId })
        );
        expect({ code: foreignError.code, message: foreignError.message }).toEqual({
            code: missingError.code,
            message: missingError.message
        });
        expect(foreignError.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(findMedia).not.toHaveBeenCalled();
    });

    it('lets VIEW_ALL read and honors an explicit media state', async () => {
        await expect(
            getAccommodationMediaForReader({
                actor: staff([PermissionEnum.ACCOMMODATION_VIEW_ALL]),
                accommodationId,
                state: 'archived'
            })
        ).resolves.toEqual(rows);
        expect(findMedia).toHaveBeenCalledWith({
            accommodationId,
            state: 'archived',
            pageSize: 200
        });
    });

    it('lets staff with VIEW_ALL and UPDATE_ANY read', async () => {
        await expect(
            getAccommodationMediaForReader({
                actor: staff([
                    PermissionEnum.ACCOMMODATION_VIEW_ALL,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]),
                accommodationId
            })
        ).resolves.toEqual(rows);
    });

    it('lets the owner with UPDATE_OWN read and defaults state to visible', async () => {
        await expect(
            getAccommodationMediaForReader({ actor: owner, accommodationId })
        ).resolves.toEqual(rows);
        expect(findMedia).toHaveBeenCalledWith({
            accommodationId,
            state: 'visible',
            pageSize: 200
        });
    });

    it('rejects a foreign UPDATE_OWN actor with NOT_FOUND matching a missing record', async () => {
        const denied = await errorOf(
            getAccommodationMediaForReader({ actor: foreign, accommodationId })
        );
        findAccommodation.mockResolvedValue(null);
        const missing = await errorOf(
            getAccommodationMediaForReader({ actor: foreign, accommodationId })
        );
        expect({ code: denied.code, message: denied.message }).toEqual({
            code: missing.code,
            message: missing.message
        });
    });

    it('rejects the owner without UPDATE_OWN', async () => {
        const error = await errorOf(
            getAccommodationMediaForReader({ actor: createActor({ id: ownerId }), accommodationId })
        );
        expect(error.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('rejects a soft-deleted accommodation', async () => {
        findAccommodation.mockResolvedValue(
            createMockAccommodation({ id: accommodationId, ownerId, deletedAt: new Date() })
        );
        expect(
            (
                await errorOf(
                    getAccommodationMediaForReader({
                        actor: staff([PermissionEnum.ACCOMMODATION_VIEW_ALL]),
                        accommodationId
                    })
                )
            ).code
        ).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('validates the accommodation id', async () => {
        expect(
            (
                await errorOf(
                    getAccommodationMediaForReader({ actor: owner, accommodationId: 'not-a-uuid' })
                )
            ).code
        ).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
