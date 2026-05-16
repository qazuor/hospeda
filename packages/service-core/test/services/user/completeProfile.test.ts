/**
 * @file completeProfile.test.ts
 *
 * Tests for UserService.completeProfile, UserService.skipSetPassword, and
 * UserService.markSetPasswordDone (SPEC-113 T-113-02 / T-113-03).
 *
 * `_userRequiresSetPassword` calls `getDb()` directly, so `@repo/db` is
 * partially mocked here: `getDb` returns a chainable query builder stub while
 * the rest of the package exports remain as-is.
 */

import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../../src';
import { UserService } from '../../../src/services/user/user.service';
import { createActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectUnauthorizedError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Mock @repo/db so that getDb() returns a chainable stub.
// We only mock getDb — the model class and other exports use the real module.
// ---------------------------------------------------------------------------

const mockDbSelect = vi.fn();
const mockDbChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockDbSelect.mockReturnValue(mockDbChain)
        }))
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

/** Sets up the getDb mock to return a specific list of account rows. */
function mockAccountQuery(rows: { providerId: string }[]) {
    // Make the chain thenable (i.e., awaitable) by resolving to `rows`
    vi.spyOn(mockDbChain, 'where').mockReturnValue(
        Promise.resolve(rows) as unknown as typeof mockDbChain
    );
}

// ---------------------------------------------------------------------------
// Tests: completeProfile
// ---------------------------------------------------------------------------

describe('UserService.completeProfile', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const actor = createActor({ id: userId, role: RoleEnum.USER, permissions: [] });

    beforeEach(() => {
        vi.clearAllMocks();
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should persist profile fields and return profileCompleted + requiresSetPassword (success — credential user)', async () => {
        // Arrange
        const user = getUser({ id: userId, displayName: 'Old Name' });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({
            ...user,
            displayName: 'New Name',
            profileCompleted: true
        });
        // Credential user — no OAuth accounts
        mockAccountQuery([{ providerId: 'credential' }]);

        // Act
        const result = await service.completeProfile(actor, {
            userId,
            firstName: 'New',
            lastName: 'Name',
            displayName: 'New Name',
            acceptedTerms: true
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.profileCompleted).toBe(true);
        expect(result.data?.requiresSetPassword).toBe(false);
        expect(asMock(userModelMock.update).mock.lastCall?.[1]).toMatchObject({
            displayName: 'New Name',
            profileCompleted: true
        });
    });

    it('should set requiresSetPassword = true for OAuth-only user', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });
        mockAccountQuery([{ providerId: 'google' }]);

        // Act
        const result = await service.completeProfile(actor, {
            userId,
            firstName: 'OAuth',
            lastName: 'User',
            displayName: 'OAuth User',
            acceptedTerms: true
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.requiresSetPassword).toBe(true);
    });

    it('should auto-derive displayName from firstName + lastName when not provided', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });
        mockAccountQuery([{ providerId: 'credential' }]);

        // Act — no displayName provided
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            acceptedTerms: true
        });

        // Assert — server derives `${firstName} ${lastName}`.trim()
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.displayName).toBe('Maria Fernanda');
        expect(updateCall?.firstName).toBe('Maria');
        expect(updateCall?.lastName).toBe('Fernanda');
    });

    it('should use provided displayName over the auto-derived one', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });
        mockAccountQuery([{ providerId: 'credential' }]);

        // Act — explicit displayName overrides the firstName+lastName derivation
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            displayName: 'Mafer',
            acceptedTerms: true
        });

        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.displayName).toBe('Mafer');
    });

    it('should persist phone into contactInfo.mobilePhone', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });
        mockAccountQuery([{ providerId: 'credential' }]);

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Test',
            lastName: 'User',
            phone: '+5493415551234',
            acceptedTerms: true
        });

        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.contactInfo?.mobilePhone).toBe('+5493415551234');
    });

    it('should persist locale into settings.languageWeb', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });
        mockAccountQuery([{ providerId: 'credential' }]);

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Test',
            lastName: 'User',
            locale: 'pt',
            acceptedTerms: true
        });

        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.settings?.languageWeb).toBe('pt');
    });

    it('should return FORBIDDEN when actor is not acting on their own profile', async () => {
        // Arrange
        const otherUserId = getMockId('user', 'other-user') as string;
        const result = await service.completeProfile(actor, {
            userId: otherUserId,
            firstName: 'Hacker',
            lastName: 'McAttack',
            acceptedTerms: true
        });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND when user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.completeProfile(actor, {
            userId,
            firstName: 'Ghost',
            lastName: 'User',
            acceptedTerms: true
        });
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR when model.update returns null', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue(null);

        // Act
        const result = await service.completeProfile(actor, {
            userId,
            firstName: 'Some',
            lastName: 'User',
            acceptedTerms: true
        });
        expectInternalError(result);
    });

    it('should return UNAUTHORIZED when actor is undefined', async () => {
        const result = await service.completeProfile(undefined as unknown as Actor, {
            userId,
            firstName: 'Some',
            lastName: 'User',
            acceptedTerms: true
        });
        expectUnauthorizedError(result);
    });
});

// ---------------------------------------------------------------------------
// Tests: skipSetPassword
// ---------------------------------------------------------------------------

describe('UserService.skipSetPassword', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-2') as string;
    const actor = createActor({ id: userId, role: RoleEnum.USER, permissions: [] });

    beforeEach(() => {
        vi.clearAllMocks();
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should flip setPasswordPrompted = true and return credentialCreated = false', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, setPasswordPrompted: true });

        // Act
        const result = await service.skipSetPassword(actor, { userId });

        // Assert
        expectSuccess(result);
        expect(result.data?.setPasswordPrompted).toBe(true);
        expect(result.data?.credentialCreated).toBe(false);
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall).toMatchObject({ setPasswordPrompted: true });
    });

    it('should return FORBIDDEN when actor acts on another user', async () => {
        const otherUserId = getMockId('user', 'other') as string;
        const result = await service.skipSetPassword(actor, { userId: otherUserId });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND when user does not exist', async () => {
        asMock(userModelMock.findById).mockResolvedValue(null);
        const result = await service.skipSetPassword(actor, { userId });
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR when model.update returns null', async () => {
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue(null);
        const result = await service.skipSetPassword(actor, { userId });
        expectInternalError(result);
    });

    it('should return UNAUTHORIZED when actor is undefined', async () => {
        const result = await service.skipSetPassword(undefined as unknown as Actor, { userId });
        expectUnauthorizedError(result);
    });
});

// ---------------------------------------------------------------------------
// Tests: markSetPasswordDone
// ---------------------------------------------------------------------------

describe('UserService.markSetPasswordDone', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-3') as string;
    const actor = createActor({ id: userId, role: RoleEnum.USER, permissions: [] });

    beforeEach(() => {
        vi.clearAllMocks();
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should flip setPasswordPrompted = true and return credentialCreated = true', async () => {
        // Arrange
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, setPasswordPrompted: true });

        // Act
        const result = await service.markSetPasswordDone(actor, { userId });

        // Assert
        expectSuccess(result);
        expect(result.data?.setPasswordPrompted).toBe(true);
        expect(result.data?.credentialCreated).toBe(true);
    });

    it('should return FORBIDDEN when actor acts on another user', async () => {
        const otherUserId = getMockId('user', 'other2') as string;
        const result = await service.markSetPasswordDone(actor, { userId: otherUserId });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND when user does not exist', async () => {
        asMock(userModelMock.findById).mockResolvedValue(null);
        const result = await service.markSetPasswordDone(actor, { userId });
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR when model.update returns null', async () => {
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue(null);
        const result = await service.markSetPasswordDone(actor, { userId });
        expectInternalError(result);
    });

    it('should return UNAUTHORIZED when actor is undefined', async () => {
        const result = await service.markSetPasswordDone(undefined as unknown as Actor, { userId });
        expectUnauthorizedError(result);
    });
});
