/**
 * @file updateAvatar.test.ts
 *
 * Tests for UserService.updateAvatar method.
 *
 * Covers:
 * - Success: all 4 columns (image, imagePublicId, imageModerationState, imageCaption) updated.
 * - Success: imageCaption is optional and defaults to null when omitted.
 * - NOT_FOUND when user does not exist.
 * - INTERNAL_ERROR when model.update returns null.
 * - VALIDATION_ERROR for invalid inputs (missing required fields, bad URL, etc.).
 * - All 4 columns are passed atomically to model.update in a single call.
 */
import { UserModel } from '@repo/db';
import { ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

/** Build a super-admin actor that has all permissions. */
const getSuperAdmin = () =>
    createUser({
        id: getMockId('user', 'super-admin') as string,
        role: RoleEnum.SUPER_ADMIN,
        permissions: Object.values(PermissionEnum)
    });

/** Minimal valid updateAvatar input. */
const validInput = {
    userId: getMockId('user') as string,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    imagePublicId: 'hospeda/prod/avatars/user-abc123',
    imageModerationState: ModerationStatusEnum.APPROVED,
    imageCaption: 'Profile picture'
};

describe('UserService.updateAvatar', () => {
    let service: UserService;
    let userModelMock: UserModel;

    const existingUser = createUser({ id: validInput.userId, role: RoleEnum.USER });

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        const loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    // -------------------------------------------------------------------------
    // SUCCESS CASES
    // -------------------------------------------------------------------------

    it('updates all 4 satellite columns atomically on success', async () => {
        // Arrange
        const actor = getSuperAdmin();
        const updatedUser = {
            ...existingUser,
            image: validInput.imageUrl,
            imagePublicId: validInput.imagePublicId,
            imageModerationState: validInput.imageModerationState,
            imageCaption: validInput.imageCaption
        };
        asMock(userModelMock.findById).mockResolvedValue(existingUser);
        asMock(userModelMock.update).mockResolvedValue(updatedUser);

        // Act
        const result = await service.updateAvatar(actor, validInput);

        // Assert — result is success
        expectSuccess(result);

        // Assert — model.update received all 4 columns in one call
        expect(userModelMock.update).toHaveBeenCalledTimes(1);
        const updateCall = asMock(userModelMock.update).mock.calls[0] as unknown[];
        const payload = updateCall[1] as Record<string, unknown>;
        expect(payload).toMatchObject({
            image: validInput.imageUrl,
            imagePublicId: validInput.imagePublicId,
            imageModerationState: validInput.imageModerationState,
            imageCaption: validInput.imageCaption
        });
    });

    it('sets imageCaption to null when not provided', async () => {
        // Arrange
        const actor = getSuperAdmin();
        const inputWithoutCaption = { ...validInput, imageCaption: undefined };
        const updatedUser = {
            ...existingUser,
            image: validInput.imageUrl,
            imagePublicId: validInput.imagePublicId,
            imageModerationState: validInput.imageModerationState,
            imageCaption: null
        };
        asMock(userModelMock.findById).mockResolvedValue(existingUser);
        asMock(userModelMock.update).mockResolvedValue(updatedUser);

        // Act
        const result = await service.updateAvatar(actor, inputWithoutCaption);

        // Assert
        expectSuccess(result);
        const updateCall = asMock(userModelMock.update).mock.calls[0] as unknown[];
        const payload = updateCall[1] as Record<string, unknown>;
        expect(payload.imageCaption).toBeNull();
    });

    it('passes PENDING moderation state correctly', async () => {
        // Arrange
        const actor = getSuperAdmin();
        const pendingInput = {
            ...validInput,
            imageModerationState: ModerationStatusEnum.PENDING
        };
        const updatedUser = {
            ...existingUser,
            imageModerationState: ModerationStatusEnum.PENDING
        };
        asMock(userModelMock.findById).mockResolvedValue(existingUser);
        asMock(userModelMock.update).mockResolvedValue(updatedUser);

        // Act
        const result = await service.updateAvatar(actor, pendingInput);

        // Assert
        expectSuccess(result);
        const updateCall = asMock(userModelMock.update).mock.calls[0] as unknown[];
        const payload = updateCall[1] as Record<string, unknown>;
        expect(payload.imageModerationState).toBe(ModerationStatusEnum.PENDING);
    });

    // -------------------------------------------------------------------------
    // NOT FOUND
    // -------------------------------------------------------------------------

    it('returns NOT_FOUND when user does not exist', async () => {
        // Arrange
        const actor = getSuperAdmin();
        asMock(userModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.updateAvatar(actor, validInput);

        // Assert
        expectNotFoundError(result);
        expect(userModelMock.update).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // INTERNAL ERROR
    // -------------------------------------------------------------------------

    it('returns INTERNAL_ERROR when model.update returns null', async () => {
        // Arrange
        const actor = getSuperAdmin();
        asMock(userModelMock.findById).mockResolvedValue(existingUser);
        asMock(userModelMock.update).mockResolvedValue(null);

        // Act
        const result = await service.updateAvatar(actor, validInput);

        // Assert
        expectInternalError(result);
    });

    // -------------------------------------------------------------------------
    // VALIDATION ERRORS
    // -------------------------------------------------------------------------

    it('returns VALIDATION_ERROR when imageUrl is not a valid URL', async () => {
        // Arrange
        const actor = getSuperAdmin();

        // Act
        const result = await service.updateAvatar(actor, {
            ...validInput,
            imageUrl: 'not-a-url'
        });

        // Assert
        expectValidationError(result);
        expect(userModelMock.findById).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR when imagePublicId is empty', async () => {
        // Arrange
        const actor = getSuperAdmin();

        // Act
        const result = await service.updateAvatar(actor, {
            ...validInput,
            imagePublicId: ''
        });

        // Assert
        expectValidationError(result);
    });

    it('returns VALIDATION_ERROR when userId is missing', async () => {
        // Arrange
        const actor = getSuperAdmin();
        const { userId: _omitted, ...inputWithoutUserId } = validInput;

        // Act
        const result = await service.updateAvatar(
            actor,
            inputWithoutUserId as unknown as typeof validInput
        );

        // Assert
        expectValidationError(result);
    });

    it('returns VALIDATION_ERROR when imageModerationState is invalid', async () => {
        // Arrange
        const actor = getSuperAdmin();

        // Act
        const result = await service.updateAvatar(actor, {
            ...validInput,
            imageModerationState: 'INVALID_STATE' as ModerationStatusEnum
        });

        // Assert
        expectValidationError(result);
    });

    // -------------------------------------------------------------------------
    // ATOMICITY GUARD
    // -------------------------------------------------------------------------

    it('calls model.update exactly once (atomic write)', async () => {
        // Arrange
        const actor = getSuperAdmin();
        asMock(userModelMock.findById).mockResolvedValue(existingUser);
        asMock(userModelMock.update).mockResolvedValue({
            ...existingUser,
            image: validInput.imageUrl,
            imagePublicId: validInput.imagePublicId,
            imageModerationState: validInput.imageModerationState,
            imageCaption: validInput.imageCaption
        });

        // Act
        await service.updateAvatar(actor, validInput);

        // Assert — model.update is called exactly once (atomic, not split into multiple calls)
        expect(userModelMock.update).toHaveBeenCalledTimes(1);
    });
});
