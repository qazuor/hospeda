import { AccommodationModel } from '@repo/db';
import {
    type AccommodationId,
    AccommodationTypeEnum,
    type DestinationId,
    type FeatureId,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    type TagId,
    type UserId,
    VisibilityEnum
} from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import * as accommodationHelper from '../../accommodation/accommodation.helper';
import type { AccommodationUpdateInput } from '../../accommodation/accommodation.schemas';
import { AccommodationService } from '../../accommodation/accommodation.service';
import * as permissionManager from '../../utils/permission-manager';
import { CanViewReasonEnum } from '../../utils/service-helper';
import {
    createMockAccommodation,
    createMockAccommodationWithMedia,
    createMockArchivedAccommodation,
    createMockPrivateAccommodation,
    getMockAccommodationUpdateInput
} from '../factories/accommodationFactory';
import {
    getMockAdminUser,
    getMockDisabledUser,
    getMockOwnerUser,
    getMockPublicUser,
    getMockUserId,
    getMockUserWithoutPermissions
} from '../factories/userFactory';
import { getMockSeo } from '../factories/utilsFactory';
import type { TestAccommodationUpdateInput } from '../types/testAccommodation.types';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';
import { getNormalizedUpdateInput } from '../utils/normalize-accommodation-input';
import { restoreMock } from '../utils/restore-mock';

describe('accommodation.service.update', () => {
    it('should update accommodation when user is the owner and has permission', async () => {
        // Arrange
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockAccommodation({ ownerId });
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
        const adminUser = getMockAdminUser({ id: adminId });
        const accommodation = createMockAccommodation({ ownerId: getMockUserId() });
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
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = {
            ...createMockAccommodationWithMedia({ ownerId }),
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
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockAccommodation({ ownerId });
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
        // Arrange: user is not the owner and has no global permissions
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = getMockUserWithoutPermissions({ id: notOwnerId });
        const accommodation = createMockAccommodation({ ownerId });
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
        // Arrange: disabled user
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const disabledUser = getMockDisabledUser({
            id: ownerId,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const accommodation = createMockAccommodation({ ownerId });
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
        // Arrange: public user (unauthenticated)
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const publicUser = getMockPublicUser();
        const accommodation = createMockAccommodation({ ownerId });
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
        // Arrange: user with insufficient permissions
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = getMockUserWithoutPermissions({ id: notOwnerId });
        const accommodation = createMockAccommodation({ ownerId });
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
        // Arrange: valid input but the accommodation does not exist
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const user = getMockOwnerUser();
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
        // Edge-case: invalid input (missing required field)
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const user = getMockOwnerUser();
        // Invalid input: missing 'name'
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
            AccommodationService.update(invalidInput as unknown as AccommodationUpdateInput, user)
        ).rejects.toThrow();
        // No update ni log de éxito
        expect(AccommodationModel.update).not.toHaveBeenCalled();
    });

    it('should throw if user cannot view the accommodation (visibility or permissions)', async () => {
        // Edge-case: user cannot view the accommodation (due to visibility or permissions)
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockPrivateAccommodation({ ownerId });
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
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
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
        // Edge-case: accommodation in ARCHIVED state cannot be updated
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockArchivedAccommodation({ ownerId });
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
        // Edge-case: test that date fields and updatedById are updated correctly
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const oldDate = new Date('2023-01-01T00:00:00.000Z');
        const newDate = new Date('2024-01-01T00:00:00.000Z');
        const accommodation = {
            ...createMockAccommodation({ ownerId }),
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
        // Edge-case: test that nested fields and date/ID fields are normalized correctly
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        // Mock with nested fields
        const accommodation = {
            ...createMockAccommodationWithMedia({ ownerId }),
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
        // Nested fields should not be present in the normalized input
        expect(updateInput).not.toHaveProperty('tags');
        expect(updateInput).not.toHaveProperty('features');
        expect(updateInput).not.toHaveProperty('media');
        // Date and ID fields should be correctly formatted
        expect(!('updatedAt' in updateInput) || updateInput.updatedAt instanceof Date).toBe(true);
        expect(typeof updateInput.ownerId).toBe('string');
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');
    });

    it('update should call serviceLogger.info and serviceLogger.permission at the correct points', async () => {
        // Arrange: test that logs are called correctly on success and permission error
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockAccommodation({ ownerId });
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

        // Act (successful case)
        await AccommodationService.update(updateInput, user);

        // Assert (successful case)
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { accommodation: updatedAccommodation } }, 'update:end');

        // Arrange (permission error case)
        vi.clearAllMocks();
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert (permission error case)
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
        // Edge-case: test that ownerId cannot be changed by the user even if attempted in the input
        // Arrange
        vi.clearAllMocks();
        restoreMock(accommodationHelper.canViewAccommodation);
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockAccommodation({ ownerId });
        // The input attempts to change the ownerId to another value
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
        // The model should return the original ownerId, not the new one
        const updatedAccommodation = { ...accommodation, ...updatedFields, ownerId };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(updatedAccommodation);

        // Act
        const result = await AccommodationService.update(updateInput, user);

        // Assert
        // The ownerId should not change
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
