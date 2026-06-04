/**
 * @file adminTourSeen.test.ts
 *
 * Tests for UserService.markAdminTourSeen (SPEC-174 T-002).
 *
 * Covers:
 * - Read-modify-write: all sibling settings keys preserved after merge
 *   (theme, language, notifications, newsletter, onboarding.whatsNew keys).
 * - Upsert: calling twice with the same tourId overwrites the version.
 * - Multi-tour: a second tour is added without clobbering the first.
 * - Missing onboarding namespace: initializes cleanly.
 * - NOT_FOUND error path.
 * - INTERNAL_ERROR when model.update returns null.
 * - VALIDATION_ERROR for invalid input (empty tourId, negative version, float version).
 *
 * Mirrors the structure of whatsNewSeen.test.ts (SPEC-175 T-002).
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { UserSettings } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createMockUser } from '../../factories/userFactory';
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

/** Creates a HOST actor with the given id. */
const makeActor = (id: string = getMockId('user') as string) =>
    createMockUser({ id, role: RoleEnum.HOST });

describe('UserService.markAdminTourSeen', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    describe('when user exists with no prior onboarding state', () => {
        it('should initialize adminTours with the given tourId and return success', async () => {
            // Arrange
            const actor = makeActor();
            const user = createMockUser({ id: actor.id, settings: undefined });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            const result = await service.markAdminTourSeen(actor, {
                tourId: 'host.welcome',
                version: 1
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.success).toBe(true);
        });

        it('should write adminTours = { tourId: version } when no prior onboarding exists', async () => {
            // Arrange
            const actor = makeActor();
            const user = createMockUser({ id: actor.id, settings: undefined });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markAdminTourSeen(actor, { tourId: 'host.welcome', version: 2 });

            // Assert
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const adminTours = onboarding.adminTours as Record<string, number>;
            expect(adminTours['host.welcome']).toBe(2);
        });
    });

    describe('sibling key preservation', () => {
        it('should preserve theme, language, notifications, and newsletter settings', async () => {
            // Arrange
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                themeAdmin: 'dark',
                languageAdmin: 'en',
                themeWeb: 'light',
                languageWeb: 'es',
                notifications: {
                    enabled: true,
                    allowEmails: true,
                    allowSms: false,
                    allowPush: true
                },
                newsletter: true,
                onboarding: {
                    adminTours: {}
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markAdminTourSeen(actor, { tourId: 'host.welcome', version: 1 });

            // Assert: all sibling keys preserved in the patch
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            expect(patch.settings.themeAdmin).toBe('dark');
            expect(patch.settings.languageAdmin).toBe('en');
            expect(patch.settings.themeWeb).toBe('light');
            expect(patch.settings.languageWeb).toBe('es');
            expect(patch.settings.newsletter).toBe(true);
            expect(patch.settings.notifications).toEqual(settings.notifications);
        });

        it('should preserve onboarding.whatsNew keys when writing adminTours', async () => {
            // Arrange — simulate SPEC-175 having written whatsNew already
            const actor = makeActor();
            const whatsNew = {
                baselineAt: '2026-01-01T00:00:00.000Z',
                seenIds: ['entry-001', 'entry-002']
            };
            const settings: Record<string, unknown> = {
                themeAdmin: 'system',
                onboarding: {
                    whatsNew
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markAdminTourSeen(actor, { tourId: 'host.welcome', version: 1 });

            // Assert: whatsNew namespace untouched
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            expect(onboarding.whatsNew).toEqual(whatsNew);
        });

        it('should preserve onboarding.whatsNew.baselineAt when writing adminTours', async () => {
            // Arrange
            const actor = makeActor();
            const baselineAt = '2026-05-01T00:00:00.000Z';
            const settings: Record<string, unknown> = {
                onboarding: {
                    whatsNew: { baselineAt, seenIds: ['x'] }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markAdminTourSeen(actor, { tourId: 'editor.analisis', version: 3 });

            // Assert
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const whatsNew = onboarding.whatsNew as { baselineAt: string; seenIds: string[] };
            expect(whatsNew.baselineAt).toBe(baselineAt);
            expect(whatsNew.seenIds).toEqual(['x']);
        });
    });

    describe('upsert behaviour (same tourId)', () => {
        it('should overwrite the version for the same tourId', async () => {
            // Arrange — tourId already has version 1 stored
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                onboarding: {
                    adminTours: { 'host.welcome': 1 }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act — now marking version 2 seen
            await service.markAdminTourSeen(actor, { tourId: 'host.welcome', version: 2 });

            // Assert: version updated to 2
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const adminTours = onboarding.adminTours as Record<string, number>;
            expect(adminTours['host.welcome']).toBe(2);
        });
    });

    describe('multi-tour (second tour must not clobber the first)', () => {
        it('should add a second tour entry without removing the first', async () => {
            // Arrange — host.welcome already seen
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                onboarding: {
                    adminTours: { 'host.welcome': 1 }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act — now marking a second tour seen
            await service.markAdminTourSeen(actor, {
                tourId: 'host.misAlojamientos',
                version: 1
            });

            // Assert: both tours present
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const adminTours = onboarding.adminTours as Record<string, number>;
            expect(adminTours['host.welcome']).toBe(1);
            expect(adminTours['host.misAlojamientos']).toBe(1);
        });
    });

    describe('error cases', () => {
        it('should return NOT_FOUND when user does not exist', async () => {
            // Arrange
            const actor = makeActor();
            asMock(userModelMock.findById).mockResolvedValue(null);

            // Act
            const result = await service.markAdminTourSeen(actor, {
                tourId: 'host.welcome',
                version: 1
            });

            // Assert
            expectNotFoundError(result);
        });

        it('should return INTERNAL_ERROR when model.update returns null', async () => {
            // Arrange
            const actor = makeActor();
            const user = createMockUser({ id: actor.id, settings: undefined });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue(null);

            // Act
            const result = await service.markAdminTourSeen(actor, {
                tourId: 'host.welcome',
                version: 1
            });

            // Assert
            expectInternalError(result);
        });

        it('should return VALIDATION_ERROR when tourId is empty', async () => {
            // Arrange
            const actor = makeActor();

            // Act
            const result = await service.markAdminTourSeen(actor, { tourId: '', version: 1 });

            // Assert
            expectValidationError(result);
        });

        it('should return VALIDATION_ERROR when version is negative', async () => {
            // Arrange
            const actor = makeActor();

            // Act
            const result = await service.markAdminTourSeen(actor, {
                tourId: 'host.welcome',
                version: -1
            });

            // Assert
            expectValidationError(result);
        });

        it('should return VALIDATION_ERROR when version is a float', async () => {
            // Arrange
            const actor = makeActor();

            // Act
            const result = await service.markAdminTourSeen(actor, {
                tourId: 'host.welcome',
                version: 1.5
            });

            // Assert
            expectValidationError(result);
        });
    });
});
