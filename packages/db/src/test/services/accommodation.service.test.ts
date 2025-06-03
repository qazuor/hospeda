vi.mock('../../../utils/logger');

vi.mock('../../models/accommodation/accommodation.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        AccommodationModel: {
            ...((actual as Record<string, unknown>).AccommodationModel ?? {}),
            create: vi.fn(),
            getById: vi.fn(),
            getByName: vi.fn(),
            search: vi.fn(),
            update: vi.fn()
        },
        ACCOMMODATION_ORDERABLE_COLUMNS: [
            'ownerId',
            'destinationId',
            'averageRating',
            'visibility',
            'lifecycle',
            'name',
            'type'
        ]
    };
});

import type { AccommodationId } from '@repo/types/common/id.types';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import type { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../models/accommodation/accommodation.model';
import * as AccommodationService from '../../services/accommodation/accommodation.service';
import type * as LoggerModule from '../../utils/logger';
import { dbLogger } from '../../utils/logger';
import * as permissionManager from '../../utils/permission-manager';
import {
    getExpectedCreatedAccommodationMatchObject,
    getMockAccommodation,
    getMockAccommodationCreated,
    getMockAccommodationInput,
    getMockAccommodationPrivate,
    getMockAccommodationPublic,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../mockData';

vi.mock('../../utils/logger', async (importOriginal) => {
    const actual: typeof LoggerModule = await importOriginal();
    return {
        ...actual,
        dbLogger: {
            info: vi.fn(),
            error: vi.fn(),
            permission: vi.fn()
        }
    };
});

describe('accommodation.service.getById', () => {
    const publicUser = getMockPublicUser();
    const user = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const disabledUser = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        settings: {
            notifications: {
                enabled: false,
                allowEmails: true,
                allowSms: true,
                allowPush: true
            }
        }
    });
    const accommodationPublic = getMockAccommodationPublic();
    const accommodationPrivate = getMockAccommodationPrivate();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return accommodation for public user if visibility is PUBLIC', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPublic);
        const result = await AccommodationService.getById(
            { id: 'acc-1' as AccommodationId },
            publicUser
        );
        expect(result.accommodation).toEqual(accommodationPublic);
        expect(dbLogger.info).toHaveBeenCalledWith(
            { input: { id: 'acc-1' as AccommodationId }, actor: publicUser },
            'getById:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            { result: { accommodation: accommodationPublic } },
            'getById:end'
        );
    });

    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById(
            { id: 'acc-2' as AccommodationId },
            publicUser
        );
        expect(result.accommodation).toBeNull();
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                userId: 'public',
                role: RoleEnum.GUEST,
                extraData: expect.anything()
            })
        );
    });

    it('should return accommodation for logged in user regardless of visibility', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById({ id: 'acc-2' as AccommodationId }, user);
        expect(result.accommodation).toEqual(accommodationPrivate);
        expect(dbLogger.info).toHaveBeenCalledWith(
            { input: { id: 'acc-2' as AccommodationId }, actor: user },
            'getById:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            { result: { accommodation: accommodationPrivate } },
            'getById:end'
        );
    });

    it('should return null if accommodation does not exist', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);
        const result = await AccommodationService.getById(
            { id: 'not-exist' as AccommodationId },
            publicUser
        );
        expect(result.accommodation).toBeNull();
        expect(dbLogger.permission).not.toHaveBeenCalled();
    });

    it('should return null and log permission if user is disabled', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById(
            { id: 'acc-2' as AccommodationId },
            disabledUser
        );
        expect(result.accommodation).toBeNull();
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                userId: disabledUser.id,
                role: disabledUser.role,
                extraData: expect.objectContaining({ reason: 'user disabled' })
            })
        );
    });

    it('should throw and log if accommodation has unknown visibility', async () => {
        const accommodationUnknown = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            visibility: 'UNKNOWN' as unknown as VisibilityEnum
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationUnknown);
        await expect(
            AccommodationService.getById({ id: 'acc-3' as AccommodationId }, user)
        ).rejects.toThrow(/Unknown accommodation visibility/);
        expect(dbLogger.permission).toHaveBeenCalled();
    });
});

describe('accommodation.service.getByName', () => {
    const publicUser = getMockPublicUser();
    const user = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const disabledUser = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        settings: {
            notifications: {
                enabled: false,
                allowEmails: true,
                allowSms: true,
                allowPush: true
            }
        }
    });
    const accommodationPublic = getMockAccommodationPublic();
    const accommodationPrivate = getMockAccommodationPrivate();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return accommodation for public user if visibility is PUBLIC', async () => {
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPublic);
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPublic.name },
            publicUser
        );
        expect(resultByName.accommodation).toEqual(accommodationPublic);
        expect(dbLogger.info).toHaveBeenCalledWith(
            { input: { name: accommodationPublic.name }, actor: publicUser },
            'getByName:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            { result: { accommodation: accommodationPublic } },
            'getByName:end'
        );
    });

    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            publicUser
        );
        expect(resultByName.accommodation).toBeNull();
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                userId: 'public',
                role: RoleEnum.GUEST,
                extraData: expect.anything()
            })
        );
    });

    it('should return accommodation for logged in user regardless of visibility', async () => {
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            user
        );
        expect(resultByName.accommodation).toEqual(accommodationPrivate);
        expect(dbLogger.info).toHaveBeenCalledWith(
            { input: { name: accommodationPrivate.name }, actor: user },
            'getByName:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            { result: { accommodation: accommodationPrivate } },
            'getByName:end'
        );
    });

    it('should return null if accommodation does not exist', async () => {
        (AccommodationModel.getByName as Mock).mockResolvedValue(undefined);
        const resultByName = await AccommodationService.getByName(
            { name: 'not-exist' },
            publicUser
        );
        expect(resultByName.accommodation).toBeNull();
        expect(dbLogger.permission).not.toHaveBeenCalled();
    });

    it('should return null and log permission if user is disabled', async () => {
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            disabledUser
        );
        expect(result.accommodation).toBeNull();
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                userId: disabledUser.id,
                role: disabledUser.role,
                extraData: expect.objectContaining({ reason: 'user disabled' })
            })
        );
    });

    it('should throw and log if accommodation has unknown visibility', async () => {
        const accommodationUnknown = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            name: 'Unknown Hotel',
            visibility: 'UNKNOWN' as unknown as VisibilityEnum
        });
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationUnknown);
        await expect(
            AccommodationService.getByName({ name: 'Unknown Hotel' }, user)
        ).rejects.toThrow(/Unknown accommodation visibility/);
        expect(dbLogger.permission).toHaveBeenCalled();
    });
});

describe('accommodation.service.list', () => {
    const publicUser = getMockPublicUser();
    const user = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const accommodationPublic = getMockAccommodationPublic();
    const accommodationPrivate = getMockAccommodationPrivate();
    const accommodations = [accommodationPublic, accommodationPrivate];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return only PUBLIC accommodations for public user', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([accommodationPublic]);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, publicUser);
        expect(result.accommodations).toEqual([accommodationPublic]);
        expect(AccommodationModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ visibility: 'PUBLIC' })
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            { input: { limit: 10, offset: 0 }, actor: publicUser },
            'list:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            { result: { accommodations: [accommodationPublic] } },
            'list:end'
        );
    });

    it('should log permission if public user requests PRIVATE visibility', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([accommodationPublic]);
        await AccommodationService.list(
            { limit: 10, offset: 0, visibility: 'PRIVATE' },
            publicUser
        );
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_VIEW_ALL,
                userId: 'public',
                role: RoleEnum.GUEST,
                extraData: expect.objectContaining({ override: expect.any(String) })
            })
        );
    });

    it('should return all accommodations for logged in user', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue(accommodations);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, user);
        expect(result.accommodations).toEqual(accommodations);
        expect(AccommodationModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 0 })
        );
    });

    it('should apply filters (type, q, order)', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([accommodationPublic]);
        const result = await AccommodationService.list(
            {
                limit: 5,
                offset: 0,
                type: 'HOTEL',
                q: 'Hotel',
                order: 'asc',
                orderBy: 'name'
            },
            user
        );
        expect(AccommodationModel.search).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'HOTEL',
                q: 'Hotel',
                order: 'asc',
                orderBy: 'name',
                limit: 5,
                offset: 0
            })
        );
        expect(result.accommodations).toEqual([accommodationPublic]);
    });

    it('should return empty array if no accommodations found', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([]);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, user);
        expect(result.accommodations).toEqual([]);
    });
});

describe('accommodation.service.create', () => {
    const user = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const noPermUser = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create accommodation and log start/end', async () => {
        (AccommodationModel.create as Mock).mockResolvedValue(getMockAccommodationCreated());
        const result = await AccommodationService.create(getMockAccommodationInput(), user);
        expect(result.accommodation).toMatchObject(getExpectedCreatedAccommodationMatchObject());
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    name: 'Nuevo Hotel',
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                }),
                actor: expect.any(Object)
            }),
            'create:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    accommodation: expect.objectContaining({
                        name: 'Nuevo Hotel',
                        createdAt: expect.any(Date),
                        updatedAt: expect.any(Date)
                    })
                })
            }),
            'create:end'
        );
    });

    it('should throw and log permission if user has no permission', async () => {
        (AccommodationModel.create as Mock).mockResolvedValue(getMockAccommodationCreated());
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to create accommodation');
        });
        await expect(
            AccommodationService.create(getMockAccommodationInput(), noPermUser)
        ).rejects.toThrow(/Forbidden/);
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_CREATE,
                userId: noPermUser.id,
                role: noPermUser.role,
                extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
            })
        );
    });

    it('should throw on invalid input', async () => {
        const input = { ...getMockAccommodationInput(), name: '' };
        await expect(AccommodationService.create(input, user)).rejects.toThrow();
    });

    it('should throw and log permission if actor is public user', async () => {
        const input = getMockAccommodationInput();
        await expect(AccommodationService.create(input, getMockPublicUser())).rejects.toThrow(
            /Public user cannot create/
        );
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_CREATE,
                userId: 'public',
                role: RoleEnum.GUEST,
                extraData: expect.objectContaining({
                    error: expect.stringContaining('Public user cannot create')
                })
            })
        );
    });
});

// describe('accommodation.service.update', () => {
//     const ownerId = getMockUserId();
//     const user = getMockUser({
//         id: ownerId,
//         permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
//     });
//     const accommodation = getMockAccommodation({ ownerId });
//     const updatedAccommodation = { ...accommodation, name: 'Nuevo Nombre' };

//     beforeEach(() => {
//         vi.clearAllMocks();
//     });

//     it('should update accommodation for owner with permission', async () => {
//         vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
//         (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
//         (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);
//         const input = buildUpdateAccommodationInput(accommodation, {
//             name: 'Nuevo Nombre',
//             updatedAt: new Date().toISOString(),
//             updatedById: getMockUserId(),
//             seo: {
//                 title: 'SEO title',
//                 description: 'SEO desc'
//             }
//         });
//         const result = await AccommodationService.update(input, user);
//         expect(result.accommodation).toEqual(updatedAccommodation);
//         expect(AccommodationModel.update).toHaveBeenCalledWith(
//             accommodation.id,
//             expect.objectContaining({ name: 'Nuevo Nombre' })
//         );
//     });
// });
