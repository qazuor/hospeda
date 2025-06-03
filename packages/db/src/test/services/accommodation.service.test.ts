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
        // TODO: Implement test
    });

    it('should throw if user cannot view the accommodation (visibility or permissions)', async () => {
        // TODO: Implement test
    });

    it('should throw if accommodation is in a state that does not allow update (e.g., ARCHIVED)', async () => {
        // TODO: Implement test
    });

    // 4. Edge Cases and Side Effects
    it('should correctly update date fields (updatedAt, etc.) and IDs (updatedById)', async () => {
        // TODO: Implement test
    });

    it('should normalize nested fields with dates and references', async () => {
        // TODO: Implement test
    });

    it('should call dbLogger.info and dbLogger.permission at the correct points', async () => {
        // TODO: Implement test
    });

    it('should not update forbidden fields (e.g., ownerId if not allowed)', async () => {
        // TODO: Implement test
    });
});
