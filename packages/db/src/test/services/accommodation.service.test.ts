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

import type {
    AccommodationId,
    DestinationId,
    FeatureId,
    TagId,
    UserId
} from '@repo/types/common/id.types';
import { AccommodationTypeEnum } from '@repo/types/enums/accommodation-type.enum';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import type { Mock } from 'vitest';
import { type MockInstance, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../models/accommodation/accommodation.model';
import * as accommodationHelper from '../../services/accommodation/accommodation.helper';
import type { UpdateInput } from '../../services/accommodation/accommodation.schemas';
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
    getMockAccommodationUpdateInput,
    getMockAccommodationWithMedia,
    getMockPublicUser,
    getMockSeo,
    getMockUser,
    getMockUserId
} from '../mockData';
import { normalizeAccommodationInput } from '../utils/normalizeAccommodationInput';

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
        const base = getMockAccommodationInput();
        const input = {
            ...base,
            name: '',
            seo: { ...base.seo, keywords: base.seo.keywords ?? ['hotel', 'nuevo', 'moderno'] }
        };
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
                    override: expect.stringContaining('Public user cannot create')
                })
            })
        );
    });
});

describe('accommodation.service.update', () => {
    it('should update accommodation when user is the owner and has permission', async () => {
        // Arrange
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const accommodation = getMockAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Updated Name',
            description: 'Updated description long enough for Zod.',
            seo: getMockSeo({ title: 'Updated SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, user);

        // Assert
        expect(result.accommodation).toEqual(updatedAccommodation);
        expect(AccommodationModel.update).toHaveBeenCalledWith(
            accommodation.id,
            expect.objectContaining(updatedFields)
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ input: updateInput, actor: user }),
            'update:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: { accommodation: updatedAccommodation } }),
            'update:end'
        );
    });

    it('should update accommodation when user is ADMIN and has global permission', async () => {
        // Arrange
        const adminId = getMockUserId();
        const adminUser = getMockUser({
            id: adminId,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        const accommodation = getMockAccommodation({ ownerId: getMockUserId() });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Admin Updated Name',
            description: 'Admin updated description long enough for Zod.',
            seo: getMockSeo({ title: 'Admin SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, adminUser);

        // Assert
        expect(result.accommodation).toEqual(updatedAccommodation);
        expect(AccommodationModel.update).toHaveBeenCalledWith(
            accommodation.id,
            expect.objectContaining(updatedFields)
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ input: updateInput, actor: adminUser }),
            'update:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: { accommodation: updatedAccommodation } }),
            'update:end'
        );
    });

    it('should update and normalize nested fields (media, tags, features, etc.)', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy1 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy1.mockRestore) spy1.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        // Mock with nested fields (media, tags, features)
        const accommodation = {
            ...getMockAccommodationWithMedia({ ownerId }),
            tags: [
                {
                    id: 'tag-1' as TagId,
                    name: 'Tag 1',
                    color: 'blue',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: ownerId,
                    updatedById: ownerId,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                }
            ],
            features: [
                {
                    featureId: 'feature-1' as FeatureId,
                    accommodationId: 'acc-1' as AccommodationId
                }
            ]
        };
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Nested Updated Name',
            description: 'Updated description for nested fields long enough for Zod.',
            seo: getMockSeo({ title: 'Nested SEO Title long enough for Zod validation' }),
            // Simulate update in tags and features (should be normalized out)
            tags: [
                {
                    id: 'tag-2' as TagId,
                    name: 'Tag 2',
                    color: 'red',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: ownerId,
                    updatedById: ownerId,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                }
            ],
            features: [
                {
                    featureId: 'feature-2' as FeatureId,
                    accommodationId: 'acc-1' as AccommodationId
                }
            ],
            media: {
                featuredImage: {
                    url: 'https://example.com/updated.jpg',
                    moderationState: ModerationStatusEnum.APPROVED,
                    description: 'Updated featured image',
                    tags: []
                },
                gallery: [],
                videos: []
            }
        });
        // The input for update should be normalized (no nested fields)
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, user);

        // Assert
        expect(result.accommodation).toEqual(updatedAccommodation);
        expect(AccommodationModel.update).toHaveBeenCalledWith(
            accommodation.id,
            expect.objectContaining({
                name: updatedFields.name,
                description: updatedFields.description,
                seo: updatedFields.seo
                // tags, features, media should NOT be present in updateInput
            })
        );
        // Ensure tags, features, media are not present in the update input
        expect(updateInput).not.toHaveProperty('tags');
        expect(updateInput).not.toHaveProperty('features');
        expect(updateInput).not.toHaveProperty('media');
    });

    it('should return the updated accommodation with expected data', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy2 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy2.mockRestore) spy2.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const accommodation = getMockAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Expected Updated Name',
            description: 'Expected updated description long enough for Zod.',
            seo: getMockSeo({ title: 'Expected SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, user);

        // Assert
        expect(result.accommodation).toEqual(updatedAccommodation);
        expect(result.accommodation.name).toBe(updatedFields.name);
        expect(result.accommodation.description).toBe(updatedFields.description);
        expect(result.accommodation.seo).toEqual(updatedFields.seo);
    });

    // 2. Permissions and Roles
    it('should deny update if user is not the owner and lacks global permissions', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy3 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy3.mockRestore) spy3.mockRestore();
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = getMockUser({
            id: notOwnerId,
            permissions: [] // No global update permissions
        });
        const accommodation = getMockAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update',
            description: 'This update should be denied by permissions.',
            seo: getMockSeo({ title: 'Denied SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(/Forbidden/);
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: expect.any(String),
                userId: notOwnerId,
                role: user.role,
                extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
            })
        );
    });

    it('should deny update if user is disabled', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy4 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy4.mockRestore) spy4.mockRestore();
        const ownerId = getMockUserId();
        const disabledUser = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
            settings: {
                notifications: {
                    enabled: false,
                    allowEmails: true,
                    allowSms: true,
                    allowPush: true
                }
            }
        });
        const accommodation = getMockAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update (Disabled User)',
            description: 'This update should be denied because user is disabled.',
            seo: getMockSeo({ title: 'Disabled SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, disabledUser)).rejects.toThrow(
            /Forbidden: user disabled/
        );
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                userId: disabledUser.id,
                role: disabledUser.role,
                extraData: expect.objectContaining({ reason: 'user disabled' })
            })
        );
    });

    it('should deny update if user is public (unauthenticated)', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy5 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy5.mockRestore) spy5.mockRestore();
        const ownerId = getMockUserId();
        const publicUser = getMockPublicUser();
        const accommodation = getMockAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update (Public User)',
            description: 'This update should be denied because user is public.',
            seo: getMockSeo({ title: 'Public SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, publicUser)).rejects.toThrow(
            /Forbidden/
        );
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: expect.any(String),
                userId: 'public',
                role: publicUser.role,
                extraData: expect.objectContaining({
                    error: expect.stringContaining('Forbidden')
                })
            })
        );
    });

    it('should deny update if user has insufficient permissions', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy6 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy6.mockRestore) spy6.mockRestore();
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = getMockUser({
            id: notOwnerId,
            permissions: [] // No update permissions
        });
        const accommodation = getMockAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update (No Permission)',
            description: 'This update should be denied due to insufficient permissions.',
            seo: getMockSeo({ title: 'No Permission SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(/Forbidden/);
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: expect.any(String),
                userId: notOwnerId,
                role: user.role,
                extraData: expect.objectContaining({
                    error: expect.stringContaining('Forbidden')
                })
            })
        );
    });

    // 3. Validation and Errors
    it('should throw if accommodation does not exist', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy7 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy7.mockRestore) spy7.mockRestore();
        const user = getMockUser({
            id: getMockUserId(),
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const nonExistentId = 'acc-not-exist' as AccommodationId;
        const updateInput = normalizeAccommodationInput({
            id: nonExistentId,
            name: 'Non-existent Accommodation',
            slug: 'non-existent-accommodation',
            summary: 'Summary for non-existent accommodation.',
            description: 'Trying to update a non-existent accommodation.',
            type: AccommodationTypeEnum.HOTEL,
            ownerId: getMockUserId(),
            destinationId: '11111111-1111-1111-1111-111111111111' as DestinationId,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            visibility: VisibilityEnum.PUBLIC,
            moderationState: ModerationStatusEnum.APPROVED,
            seo: getMockSeo({ title: 'Non-existent SEO Title long enough for Zod validation' })
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(
            'Accommodation not found'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: { accommodation: null } }),
            'update:end'
        );
    });

    it('should throw if input is invalid (e.g., missing required field)', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy8 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy8.mockRestore) spy8.mockRestore();
        const user = getMockUser({
            id: getMockUserId(),
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        // Input inválido: falta 'name'
        const invalidInput = {
            id: 'acc-1' as AccommodationId,
            // name: missing
            slug: 'invalid-accommodation',
            summary: 'Summary for invalid accommodation.',
            description: 'Trying to update with invalid input.',
            type: AccommodationTypeEnum.HOTEL,
            ownerId: getMockUserId(),
            destinationId: '11111111-1111-1111-1111-111111111111' as DestinationId,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            visibility: VisibilityEnum.PUBLIC,
            moderationState: ModerationStatusEnum.APPROVED,
            seo: getMockSeo({ title: 'Invalid SEO Title long enough for Zod validation' })
        };

        // Act & Assert
        await expect(
            AccommodationService.update(invalidInput as unknown as UpdateInput, user)
        ).rejects.toThrow();
        // No update ni log de éxito
        expect(AccommodationModel.update).not.toHaveBeenCalled();
        expect(dbLogger.info).not.toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({ accommodation: expect.anything() })
            }),
            'update:end'
        );
    });

    it('should throw if user cannot view the accommodation (visibility or permissions)', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy9 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy9.mockRestore) spy9.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const accommodation = getMockAccommodation({
            ownerId,
            visibility: VisibilityEnum.PRIVATE
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            name: 'Should Not Update (No View Permission)',
            description: 'Trying to update without view permission.',
            seo: getMockSeo({
                title: 'No View Permission SEO Title long enough for Zod validation'
            })
        });
        // Mock canViewAccommodation para devolver canView: false
        vi.spyOn(accommodationHelper, 'canViewAccommodation').mockReturnValue({
            canView: false,
            reason: accommodationHelper.CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(
            'Forbidden: user does not have permission to update accommodation'
        );
        // Logger debe registrar el intento denegado
        expect(dbLogger.permission).toHaveBeenCalled();
    });

    it('should throw if accommodation is in a state that does not allow update (e.g., ARCHIVED)', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy10 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy10.mockRestore) spy10.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const accommodation = getMockAccommodation({
            ownerId,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            name: 'Should Not Update (Archived)',
            description: 'Trying to update an archived accommodation.',
            seo: getMockSeo({ title: 'Archived SEO Title long enough for Zod validation' })
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(
            'Forbidden: user does not have permission to update accommodation'
        );
        // Logger debe registrar el intento denegado
        expect(dbLogger.permission).toHaveBeenCalled();
    });

    // 4. Edge Cases and Side Effects
    it('should correctly update date fields (updatedAt, etc.) and IDs (updatedById)', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy11 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy11.mockRestore) spy11.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const oldDate = new Date('2023-01-01T00:00:00.000Z');
        const newDate = new Date('2024-01-01T00:00:00.000Z');
        const accommodation = {
            ...getMockAccommodation({ ownerId }),
            updatedAt: oldDate,
            updatedById: 'old-updater-id' as UserId
        };
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Updated Name for Dates',
            description: 'Updated description for date fields long enough for Zod.',
            seo: getMockSeo({ title: 'Updated SEO Title for Dates long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        const updatedAccommodation = {
            ...accommodation,
            ...updatedFields,
            updatedAt: newDate,
            updatedById: user.id
        };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, user);

        // Assert
        expect(result.accommodation.updatedAt).toEqual(newDate);
        expect(result.accommodation.updatedById).toEqual(user.id);
        expect(result.accommodation.name).toBe(updatedFields.name);
        expect(result.accommodation.description).toBe(updatedFields.description);
    });

    it('should normalize nested fields with dates and references', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy12 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy12.mockRestore) spy12.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        // Mock con campos anidados
        const accommodation = {
            ...getMockAccommodationWithMedia({ ownerId }),
            tags: [
                {
                    id: 'tag-1' as TagId,
                    name: 'Tag 1',
                    color: 'blue',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: ownerId,
                    updatedById: ownerId,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                }
            ],
            features: [
                {
                    featureId: 'feature-1' as FeatureId,
                    accommodationId: 'acc-1' as AccommodationId
                }
            ]
        };
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Normalized Name',
            description: 'Normalized description long enough for Zod.',
            seo: getMockSeo({ title: 'Normalized SEO Title long enough for Zod validation' }),
            // Simula update en tags y features (deben ser normalizados fuera)
            tags: [
                {
                    id: 'tag-2' as TagId,
                    name: 'Tag 2',
                    color: 'red',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: ownerId,
                    updatedById: ownerId,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                }
            ],
            features: [
                {
                    featureId: 'feature-2' as FeatureId,
                    accommodationId: 'acc-1' as AccommodationId
                }
            ],
            media: {
                featuredImage: {
                    url: 'https://example.com/normalized.jpg',
                    moderationState: ModerationStatusEnum.APPROVED,
                    description: 'Normalized featured image',
                    tags: []
                },
                gallery: [],
                videos: []
            }
        });
        // El input para update debe estar normalizado (sin campos anidados)
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        await AccommodationService.update(updateInput, user);

        // Assert
        // Los campos anidados no deben estar presentes en el input normalizado
        expect(updateInput).not.toHaveProperty('tags');
        expect(updateInput).not.toHaveProperty('features');
        expect(updateInput).not.toHaveProperty('media');
        // Los campos de fechas e IDs deben estar correctamente formateados
        expect(!('updatedAt' in updateInput) || updateInput.updatedAt instanceof Date).toBe(true);
        expect(typeof updateInput.ownerId).toBe('string');
    });

    it('should call dbLogger.info and dbLogger.permission at the correct points', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy13 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy13.mockRestore) spy13.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const accommodation = getMockAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Logger Test Name',
            description: 'Logger test description long enough for Zod.',
            seo: getMockSeo({ title: 'Logger SEO Title long enough for Zod validation' })
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act (caso exitoso)
        await AccommodationService.update(updateInput, user);

        // Assert (caso exitoso)
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ input: updateInput, actor: user }),
            'update:start'
        );
        expect(dbLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: { accommodation: updatedAccommodation } }),
            'update:end'
        );

        // Arrange (caso error de permisos)
        vi.clearAllMocks();
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert (caso error de permisos)
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(/Forbidden/);
        expect(dbLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: expect.any(String),
                userId: user.id,
                role: user.role,
                extraData: expect.objectContaining({
                    error: expect.stringContaining('Forbidden')
                })
            })
        );
    });

    it('should not update forbidden fields (e.g., ownerId if not allowed)', async () => {
        // Arrange
        vi.clearAllMocks();
        const spy14 = accommodationHelper.canViewAccommodation as unknown as MockInstance;
        if (spy14.mockRestore) spy14.mockRestore();
        const ownerId = getMockUserId();
        const user = getMockUser({
            id: ownerId,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const accommodation = getMockAccommodation({ ownerId });
        // El input intenta cambiar el ownerId a otro valor
        const forbiddenOwnerId = '22222222-2222-2222-2222-222222222222' as UserId;
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Change Owner',
            description: 'Trying to update forbidden field ownerId.',
            seo: getMockSeo({ title: 'Forbidden Field SEO Title long enough for Zod validation' }),
            ownerId: forbiddenOwnerId
        });
        const updateInput = normalizeAccommodationInput({
            ...accommodation,
            ...updatedFields
        });
        // El modelo debe devolver el ownerId original, no el nuevo
        const updatedAccommodation = { ...accommodation, ...updatedFields, ownerId };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, user);

        // Assert
        // El ownerId no debe cambiar
        expect(AccommodationModel.update).toHaveBeenCalledWith(
            accommodation.id,
            expect.objectContaining({
                ownerId
            })
        );
        expect(result.accommodation.ownerId).toBe(ownerId);
    });
});
