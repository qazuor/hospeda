/**
 * @file completeProfile.newFields.test.ts
 * @description Tests for the new optional fields added in SPEC-113 polish round:
 * firstName + lastName (now required), lastName, birthDate, imageUrl, bio,
 * website, occupation, socialNetworks, and location.
 *
 * These tests supplement completeProfile.test.ts without modifying it.
 */

import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Mock @repo/db — only getDb needs to be stubbed (for _userRequiresSetPassword)
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

const asMock = <T>(fn: T) => fn as unknown as Mock;

/** Configures the account query stub to return specific provider rows. */
function mockAccountQuery(rows: { providerId: string }[]) {
    vi.spyOn(mockDbChain, 'where').mockReturnValue(
        Promise.resolve(rows) as unknown as typeof mockDbChain
    );
}

// ---------------------------------------------------------------------------
// Tests: completeProfile — new optional fields (polish round)
// ---------------------------------------------------------------------------

describe('UserService.completeProfile — new fields (SPEC-113 polish round)', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-polish') as string;
    const actor = createActor({ id: userId, role: RoleEnum.USER, permissions: [] });

    beforeEach(() => {
        vi.clearAllMocks();
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
        // Default: credential user (no OAuth accounts)
        mockAccountQuery([{ providerId: 'credential' }]);
    });

    // ── firstName + lastName (now required) ───────────────────────────────────

    it('persists firstName and lastName when explicitly provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.firstName).toBe('Maria');
        expect(updateCall?.lastName).toBe('Fernanda');
    });

    it('derives displayName from firstName + lastName when displayName is not provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            acceptedTerms: true
        });

        // Assert — displayName derived as "Maria Fernanda"
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.displayName).toBe('Maria Fernanda');
    });

    it('uses explicit displayName over the derived value when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            displayName: 'MaFer',
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.displayName).toBe('MaFer');
    });

    // ── birthDate ─────────────────────────────────────────────────────────────

    it('persists birthDate when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            birthDate: '1990-05-15',
            acceptedTerms: true
        });

        // Assert — service converts the ISO date string (from <input type="date">)
        // into a Date object before passing to the model, since the DB column
        // is timestamp and Drizzle expects a Date instance.
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.birthDate).toBeInstanceOf(Date);
        expect((updateCall?.birthDate as Date).toISOString()).toBe('1990-05-15T00:00:00.000Z');
    });

    it('does not set birthDate field when not provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            acceptedTerms: true
        });

        // Assert — birthDate should be absent or undefined in the patch
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.birthDate).toBeUndefined();
    });

    // ── imageUrl ──────────────────────────────────────────────────────────────

    it('persists imageUrl (mapped to users.image) when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            imageUrl: 'https://cdn.example.com/avatar.jpg',
            acceptedTerms: true
        });

        // Assert — imageUrl is stored in users.image column
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.image).toBe('https://cdn.example.com/avatar.jpg');
    });

    // ── bio ───────────────────────────────────────────────────────────────────

    it('persists bio inside profile JSONB when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            bio: 'Desarrolladora apasionada por el código limpio.',
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.profile?.bio).toBe('Desarrolladora apasionada por el código limpio.');
    });

    // ── website ───────────────────────────────────────────────────────────────

    it('persists website inside profile JSONB when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            website: 'https://mariafernanda.dev',
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.profile?.website).toBe('https://mariafernanda.dev');
    });

    // ── occupation ────────────────────────────────────────────────────────────

    it('persists occupation inside profile JSONB when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            occupation: 'Software Engineer',
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.profile?.occupation).toBe('Software Engineer');
    });

    // ── socialNetworks ────────────────────────────────────────────────────────

    it('persists socialNetworks when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });
        const networks = {
            instagram: 'https://instagram.com/maria',
            linkedIn: 'https://linkedin.com/in/maria'
        };

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            socialNetworks: networks,
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.socialNetworks?.instagram).toBe('https://instagram.com/maria');
        expect(updateCall?.socialNetworks?.linkedIn).toBe('https://linkedin.com/in/maria');
    });

    // ── location ──────────────────────────────────────────────────────────────

    it('persists location when provided', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });
        const location = { country: 'AR', region: 'Entre Ríos', city: 'Concepción del Uruguay' };

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            location,
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.location?.country).toBe('AR');
        expect(updateCall?.location?.region).toBe('Entre Ríos');
        expect(updateCall?.location?.city).toBe('Concepción del Uruguay');
    });

    it('persists location with only country (region/city are optional)', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            location: { country: 'BR' },
            acceptedTerms: true
        });

        // Assert
        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.location?.country).toBe('BR');
        expect(updateCall?.location?.region).toBeUndefined();
        expect(updateCall?.location?.city).toBeUndefined();
    });

    // ── Full payload (all new fields together) ────────────────────────────────

    it('correctly persists all new fields in a single complete call', async () => {
        // Arrange
        const user = createUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, profileCompleted: true });

        // Act
        const result = await service.completeProfile(actor, {
            userId,
            firstName: 'Maria',
            lastName: 'Fernanda',
            displayName: 'MaFer',
            birthDate: '1990-05-15',
            imageUrl: 'https://cdn.example.com/avatar.jpg',
            bio: 'Desarrolladora apasionada.',
            website: 'https://mariafernanda.dev',
            occupation: 'Software Engineer',
            socialNetworks: { instagram: 'https://instagram.com/maria' },
            location: { country: 'AR', city: 'Concepción del Uruguay' },
            phone: '+5493415551234',
            locale: 'es',
            newsletterOptIn: true,
            acceptedTerms: true
        });

        // Assert success
        expectSuccess(result);

        const updateCall = asMock(userModelMock.update).mock.lastCall?.[1];
        expect(updateCall?.firstName).toBe('Maria');
        expect(updateCall?.lastName).toBe('Fernanda');
        expect(updateCall?.displayName).toBe('MaFer');
        expect(updateCall?.birthDate).toBeInstanceOf(Date);
        expect((updateCall?.birthDate as Date).toISOString()).toBe('1990-05-15T00:00:00.000Z');
        expect(updateCall?.image).toBe('https://cdn.example.com/avatar.jpg');
        expect(updateCall?.profile?.bio).toBe('Desarrolladora apasionada.');
        expect(updateCall?.profile?.website).toBe('https://mariafernanda.dev');
        expect(updateCall?.profile?.occupation).toBe('Software Engineer');
        expect(updateCall?.socialNetworks?.instagram).toBe('https://instagram.com/maria');
        expect(updateCall?.location?.country).toBe('AR');
        expect(updateCall?.location?.city).toBe('Concepción del Uruguay');
        expect(updateCall?.contactInfo?.mobilePhone).toBe('+5493415551234');
        expect(updateCall?.settings?.languageWeb).toBe('es');
        // newsletterOptIn is intentionally NOT in the user row update —
        // the route layer delegates it to NewsletterSubscriberService
        expect(updateCall?.profileCompleted).toBe(true);
    });
});
