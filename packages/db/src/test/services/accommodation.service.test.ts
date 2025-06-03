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
import * as accommodationHelper from '../../services/accommodation/accommodation.helper';
import type { UpdateInput } from '../../services/accommodation/accommodation.schemas';
import * as AccommodationService from '../../services/accommodation/accommodation.service';
import type * as LoggerModule from '../../utils/logger';
import * as permissionManager from '../../utils/permission-manager';
import {
    makeAccommodation,
    makeAccommodationWithMedia,
    makeArchivedAccommodation,
    makePrivateAccommodation
} from '../factories/accommodationFactory';
import {
    makeAdmin,
    makeDisabledUser,
    makeOwner,
    makePublicUser,
    makeUserWithoutPermissions
} from '../factories/userFactory';
import {
    getExpectedCreatedAccommodationMatchObject,
    getMockAccommodation,
    getMockAccommodationCreated,
    getMockAccommodationInput,
    getMockAccommodationPrivate,
    getMockAccommodationPublic,
    getMockAccommodationUpdateInput,
    getMockPublicUser,
    getMockSeo,
    getMockUser,
    getMockUserId
} from '../mockData';
import type {
    TestAccommodationCreateInput,
    TestAccommodationUpdateInput
} from '../types/testAccommodation.types';
import { expectInfoLog, expectNoPermissionLog, expectPermissionLog } from '../utils/logAssertions';
import { getNormalizedUpdateInput } from '../utils/normalizeAccommodationInput';
import { restoreMock } from '../utils/restoreMock';

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
        expectInfoLog(
            { input: { id: 'acc-1' as AccommodationId }, actor: publicUser },
            'getById:start'
        );
        expectInfoLog({ result: { accommodation: accommodationPublic } }, 'getById:end');
    });

    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById(
            { id: 'acc-2' as AccommodationId },
            publicUser
        );
        expect(result.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.anything()
        });
    });

    it('should return accommodation for logged in user regardless of visibility', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById({ id: 'acc-2' as AccommodationId }, user);
        expect(result.accommodation).toEqual(accommodationPrivate);
        expectInfoLog({ input: { id: 'acc-2' as AccommodationId }, actor: user }, 'getById:start');
        expectInfoLog({ result: { accommodation: accommodationPrivate } }, 'getById:end');
    });

    it('should return null if accommodation does not exist', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);
        const result = await AccommodationService.getById(
            { id: 'not-exist' as AccommodationId },
            publicUser
        );
        expect(result.accommodation).toBeNull();
        expectNoPermissionLog();
    });

    it('should return null and log permission if user is disabled', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById(
            { id: 'acc-2' as AccommodationId },
            disabledUser
        );
        expect(result.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
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
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: 'unknown visibility',
                visibility: 'UNKNOWN',
                input: expect.any(Object)
            })
        });
    });
});

describe('accommodation.service.getByName', () => {
    // This test verifies that a public user can access a PUBLIC accommodation by name.
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
        // Arrange: Set up a public accommodation and a public user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPublic);
        // Act: Attempt to get the accommodation by name as a public user.
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPublic.name },
            publicUser
        );
        // Assert: The accommodation is returned and logs are correct.
        expect(resultByName.accommodation).toEqual(accommodationPublic);
        expectInfoLog(
            { input: { name: accommodationPublic.name }, actor: publicUser },
            'getByName:start'
        );
        expectInfoLog({ result: { accommodation: accommodationPublic } }, 'getByName:end');
    });

    // This test verifies that a public user cannot access a PRIVATE accommodation by name and logs the permission denial.
    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        // Arrange: Set up a private accommodation and a public user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        // Act: Attempt to get the accommodation by name as a public user.
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            publicUser
        );
        // Assert: The result is null and a permission log is created.
        expect(resultByName.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.anything()
        });
    });

    // This test verifies that a logged-in user can access a PRIVATE accommodation by name.
    it('should return accommodation for logged in user regardless of visibility', async () => {
        // Arrange: Set up a private accommodation and an admin user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        // Act: Attempt to get the accommodation by name as an admin user.
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            user
        );
        // Assert: The accommodation is returned and logs are correct.
        expect(resultByName.accommodation).toEqual(accommodationPrivate);
        expectInfoLog(
            { input: { name: accommodationPrivate.name }, actor: user },
            'getByName:start'
        );
        expectInfoLog({ result: { accommodation: accommodationPrivate } }, 'getByName:end');
    });

    // This test verifies that if the accommodation does not exist, null is returned and no permission log is created.
    it('should return null if accommodation does not exist', async () => {
        // Arrange: Set up a non-existent accommodation name and a public user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(undefined);
        // Act: Attempt to get the accommodation by name as a public user.
        const resultByName = await AccommodationService.getByName(
            { name: 'not-exist' },
            publicUser
        );
        // Assert: The result is null and no permission log is created.
        expect(resultByName.accommodation).toBeNull();
        expectNoPermissionLog();
    });

    // This test verifies that a disabled user cannot access a PRIVATE accommodation by name and logs the permission denial with a specific reason.
    it('should return null and log permission if user is disabled', async () => {
        // Arrange: Set up a private accommodation and a disabled user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        // Act: Attempt to get the accommodation by name as a disabled user.
        const result = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            disabledUser
        );
        // Assert: The result is null and a permission log is created with the reason 'user disabled'.
        expect(result.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    // Edge-case: Ensures that if the accommodation has an unknown visibility, an error is thrown and the permission log contains the correct details.
    it('should throw and log if accommodation has unknown visibility', async () => {
        // Arrange: Set up an accommodation with unknown visibility and an admin user.
        const accommodationUnknown = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            name: 'Unknown Hotel',
            visibility: 'UNKNOWN' as unknown as VisibilityEnum
        });
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationUnknown);
        // Act & Assert: Attempt to get the accommodation by name and expect an error. The permission log should contain the error details.
        await expect(
            AccommodationService.getByName({ name: 'Unknown Hotel' }, user)
        ).rejects.toThrow(/Unknown accommodation visibility/);
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: 'unknown visibility',
                visibility: 'UNKNOWN',
                input: expect.any(Object)
            })
        });
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
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: publicUser }, 'list:start');
        expectInfoLog({ result: { accommodations: [accommodationPublic] } }, 'list:end');
    });

    it('should log permission if public user requests PRIVATE visibility', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([accommodationPublic]);
        await AccommodationService.list(
            { limit: 10, offset: 0, visibility: 'PRIVATE' },
            publicUser
        );
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_ALL,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.objectContaining({ override: expect.any(String) })
        });
    });

    it('should return all accommodations for logged in user', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue(accommodations);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, user);
        expect(result.accommodations).toEqual(accommodations);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: user }, 'list:start');
        expectInfoLog({ result: { accommodations: accommodations } }, 'list:end');
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
        expectInfoLog(
            {
                input: {
                    type: 'HOTEL',
                    q: 'Hotel',
                    order: 'asc',
                    orderBy: 'name',
                    limit: 5,
                    offset: 0
                },
                actor: user
            },
            'list:start'
        );
        expect(result.accommodations).toEqual([accommodationPublic]);
        expectInfoLog({ result: { accommodations: [accommodationPublic] } }, 'list:end');
    });

    it('should return empty array if no accommodations found', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([]);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, user);
        expect(result.accommodations).toEqual([]);
        expectInfoLog({ result: { accommodations: [] } }, 'list:end');
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
        const input: TestAccommodationCreateInput = getMockAccommodationInput();
        const result = await AccommodationService.create(input, user);
        expect(result.accommodation).toMatchObject(getExpectedCreatedAccommodationMatchObject());
        expectInfoLog(
            {
                input: expect.objectContaining({
                    name: 'Nuevo Hotel',
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                }),
                actor: expect.any(Object)
            },
            'create:start'
        );
        expectInfoLog(
            {
                result: expect.objectContaining({
                    accommodation: expect.objectContaining({
                        name: 'Nuevo Hotel',
                        createdAt: expect.any(Date),
                        updatedAt: expect.any(Date)
                    })
                })
            },
            'create:end'
        );
    });

    it('should throw and log permission if user has no permission', async () => {
        (AccommodationModel.create as Mock).mockResolvedValue(getMockAccommodationCreated());
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to create accommodation');
        });
        const input: TestAccommodationCreateInput = getMockAccommodationInput();
        await expect(AccommodationService.create(input, noPermUser)).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: noPermUser.id,
            role: noPermUser.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw on invalid input', async () => {
        const base = getMockAccommodationInput();
        const input: TestAccommodationCreateInput = {
            ...base,
            name: '',
            seo: { ...base.seo, keywords: base.seo.keywords ?? ['hotel', 'nuevo', 'moderno'] }
        };
        await expect(AccommodationService.create(input, user)).rejects.toThrow();
    });

    it('should throw and log permission if actor is public user', async () => {
        const input: TestAccommodationCreateInput = getMockAccommodationInput();
        await expect(AccommodationService.create(input, getMockPublicUser())).rejects.toThrow(
            /Public user cannot create/
        );
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.objectContaining({
                override: expect.stringContaining('Public user cannot create')
            })
        });
    });
});

describe('accommodation.service.update', () => {
    it('should update accommodation when user is the owner and has permission', async () => {
        // Arrange
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Updated Name',
            description: 'Updated description long enough for Zod.',
            seo: getMockSeo({ title: 'Updated SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, user);

        // Assert
        expect(result.accommodation).toEqual(updatedAccommodation);
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
    });

    it('should update accommodation when user is ADMIN and has global permission', async () => {
        // Arrange
        const adminId = getMockUserId();
        const adminUser = makeAdmin({ id: adminId });
        const accommodation = makeAccommodation({ ownerId: getMockUserId() });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Admin Updated Name',
            description: 'Admin updated description long enough for Zod.',
            seo: getMockSeo({ title: 'Admin SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, adminUser);

        // Assert
        expect(result.accommodation).toEqual(updatedAccommodation);
        expectInfoLog({ input: updateInput, actor: adminUser }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
    });

    it('should update and normalize nested fields (media, tags, features, etc.)', async () => {
        // Edge-case: Ensures that nested fields (media, tags, features) are normalized and not sent to the update operation.
        // Arrange: Create an accommodation with nested fields and a user who is the owner.
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = {
            ...makeAccommodationWithMedia({ ownerId }),
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
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act: Attempt to update the accommodation with nested fields.
        const result = await AccommodationService.update(updateInput, user);

        // Assert: The update succeeds, but nested fields are not present in the input. Only allowed fields are updated.
        expect(result.accommodation).toEqual(updatedAccommodation);
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
        expect(updateInput).not.toHaveProperty('tags');
        expect(updateInput).not.toHaveProperty('features');
        expect(updateInput).not.toHaveProperty('media');
    });

    it('should return the updated accommodation with expected data', async () => {
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Expected Updated Name',
            description: 'Expected updated description long enough for Zod.',
            seo: getMockSeo({ title: 'Expected SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
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
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
    });

    // 2. Permissions and Roles
    it('should deny update if user is not the owner and lacks global permissions', async () => {
        // Arrange: usuario no owner y sin permisos globales
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = makeUserWithoutPermissions({ id: notOwnerId });
        const accommodation = makeAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update',
            description: 'This update should be denied by permissions.',
            seo: getMockSeo({ title: 'Denied SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: expect.any(String),
            userId: notOwnerId,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should deny update if user is disabled', async () => {
        // Arrange: usuario deshabilitado
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const disabledUser = makeDisabledUser({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update (Disabled User)',
            description: 'This update should be denied because user is disabled.',
            seo: getMockSeo({ title: 'Disabled SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, disabledUser)).rejects.toThrow(
            /Forbidden: user disabled/
        );
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should deny update if user is public (unauthenticated)', async () => {
        // Arrange: usuario público (no autenticado)
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const publicUser = makePublicUser();
        const accommodation = makeAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update (Public User)',
            description: 'This update should be denied because user is public.',
            seo: getMockSeo({ title: 'Public SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, publicUser)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: expect.any(String),
            userId: 'public',
            role: publicUser.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('Forbidden')
            })
        });
    });

    it('should deny update if user has insufficient permissions', async () => {
        // Arrange: usuario sin permisos suficientes
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = makeUserWithoutPermissions({ id: notOwnerId });
        const accommodation = makeAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Update (No Permission)',
            description: 'This update should be denied due to insufficient permissions.',
            seo: getMockSeo({ title: 'No Permission SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: expect.any(String),
            userId: notOwnerId,
            role: user.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('Forbidden')
            })
        });
    });

    // 3. Validation and Errors
    it('should throw if accommodation does not exist', async () => {
        // Arrange: input válido pero el alojamiento no existe
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const user = makeOwner();
        const nonExistentId = 'acc-not-exist' as AccommodationId;
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput({
            id: nonExistentId,
            slug: 'non-existent-accommodation',
            name: 'Non-existent Accommodation',
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
        expectInfoLog({ result: { accommodation: null } }, 'update:end');
    });

    it('should throw if input is invalid (e.g., missing required field)', async () => {
        // Edge-case: input inválido (falta campo requerido)
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const user = makeOwner();
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
    });

    it('should throw if user cannot view the accommodation (visibility or permissions)', async () => {
        // Edge-case: usuario no puede ver el alojamiento (por visibilidad o permisos)
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makePrivateAccommodation({ ownerId });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput({
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
        expectPermissionLog({
            permission: expect.any(String),
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('Forbidden')
            })
        });
    });

    it('should throw if accommodation is in a state that does not allow update (e.g., ARCHIVED)', async () => {
        // Edge-case: alojamiento en estado ARCHIVED no puede ser actualizado
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeArchivedAccommodation({ ownerId });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput({
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
        expectPermissionLog({
            permission: expect.any(String),
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    // 4. Edge Cases and Side Effects
    it('should correctly update date fields (updatedAt, etc.) and IDs (updatedById)', async () => {
        // Edge-case: se prueba que los campos de fecha y updatedById se actualizan correctamente
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const oldDate = new Date('2023-01-01T00:00:00.000Z');
        const newDate = new Date('2024-01-01T00:00:00.000Z');
        const accommodation = {
            ...makeAccommodation({ ownerId }),
            updatedAt: oldDate,
            updatedById: 'old-updater-id' as UserId
        };
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Updated Name for Dates',
            description: 'Updated description for date fields long enough for Zod.',
            seo: getMockSeo({ title: 'Updated SEO Title for Dates long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
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
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
    });

    it('should normalize nested fields with dates and references', async () => {
        // Edge-case: se prueba que los campos anidados y de fechas/IDs se normalizan correctamente
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        // Mock con campos anidados
        const accommodation = {
            ...makeAccommodationWithMedia({ ownerId }),
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
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
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
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
    });

    it('should call dbLogger.info and dbLogger.permission at the correct points', async () => {
        // Arrange: testea que los logs se llamen correctamente en éxito y error de permisos
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Logger Test Name',
            description: 'Logger test description long enough for Zod.',
            seo: getMockSeo({ title: 'Logger SEO Title long enough for Zod validation' })
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
        const updatedAccommodation = { ...accommodation, ...updatedFields };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act (caso exitoso)
        await AccommodationService.update(updateInput, user);

        // Assert (caso exitoso)
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');

        // Arrange (caso error de permisos)
        vi.clearAllMocks();
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert (caso error de permisos)
        await expect(AccommodationService.update(updateInput, user)).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: expect.any(String),
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('Forbidden')
            })
        });
    });

    it('should not update forbidden fields (e.g., ownerId if not allowed)', async () => {
        // Edge-case: se prueba que el ownerId no puede ser cambiado por el usuario aunque lo intente en el input
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        // El input intenta cambiar el ownerId a otro valor
        const forbiddenOwnerId = '22222222-2222-2222-2222-222222222222' as UserId;
        const updatedFields = getMockAccommodationUpdateInput({
            name: 'Should Not Change Owner',
            description: 'Trying to update forbidden field ownerId.',
            seo: getMockSeo({ title: 'Forbidden Field SEO Title long enough for Zod validation' }),
            ownerId: forbiddenOwnerId
        });
        const updateInput: TestAccommodationUpdateInput = getNormalizedUpdateInput(
            accommodation,
            updatedFields
        );
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
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
    });
});
