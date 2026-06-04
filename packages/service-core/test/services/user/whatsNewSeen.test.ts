/**
 * @file whatsNewSeen.test.ts
 *
 * Tests for UserService.markWhatsNewSeen and UserService.initWhatsNewBaseline.
 *
 * Covers (per SPEC-175 §12.2):
 * - Read-modify-write: all sibling settings keys preserved after merge.
 * - Idempotency: calling twice with overlapping ids produces a Set union, not duplicates.
 * - Missing `onboarding` → initializes cleanly.
 * - `adminTours` key untouched when only `seenIds` is written.
 * - Baseline no-op when already initialized.
 * - NOT_FOUND and INTERNAL_ERROR edge cases.
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

describe('UserService.markWhatsNewSeen', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    describe('when user exists with no prior whatsNew state', () => {
        it('should initialize seenIds and return success', async () => {
            // Arrange
            const actor = makeActor();
            const user = createMockUser({
                id: actor.id,
                settings: { themeAdmin: 'dark', languageAdmin: 'es' } as UserSettings
            });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            const result = await service.markWhatsNewSeen(actor, { ids: ['entry-001'] });

            // Assert
            expectSuccess(result);
            expect(result.data?.success).toBe(true);
        });

        it('should write seenIds = [id] when no prior onboarding exists', async () => {
            // Arrange
            const actor = makeActor();
            const user = createMockUser({ id: actor.id, settings: undefined });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markWhatsNewSeen(actor, { ids: ['entry-abc'] });

            // Assert
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const whatsNew = onboarding.whatsNew as { seenIds: string[] };
            expect(whatsNew.seenIds).toEqual(['entry-abc']);
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
                    whatsNew: { baselineAt: '2026-01-01T00:00:00.000Z', seenIds: [] }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markWhatsNewSeen(actor, { ids: ['entry-001'] });

            // Assert: sibling keys preserved in the patch
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            expect(patch.settings.themeAdmin).toBe('dark');
            expect(patch.settings.languageAdmin).toBe('en');
            expect(patch.settings.themeWeb).toBe('light');
            expect(patch.settings.newsletter).toBe(true);
            expect(patch.settings.notifications).toEqual(settings.notifications);
        });

        it('should preserve onboarding.adminTours when writing seenIds', async () => {
            // Arrange — simulate SPEC-174 having written adminTours already
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                themeAdmin: 'system',
                onboarding: {
                    adminTours: { 'host.welcome': 3 },
                    whatsNew: { baselineAt: '2026-01-01T00:00:00.000Z', seenIds: [] }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markWhatsNewSeen(actor, { ids: ['entry-x'] });

            // Assert: adminTours untouched
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            expect(onboarding.adminTours).toEqual({ 'host.welcome': 3 });
        });

        it('should preserve onboarding.whatsNew.baselineAt when writing seenIds', async () => {
            // Arrange
            const actor = makeActor();
            const baselineAt = '2026-05-01T00:00:00.000Z';
            const settings: Record<string, unknown> = {
                onboarding: {
                    whatsNew: { baselineAt, seenIds: ['existing-id'] }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.markWhatsNewSeen(actor, { ids: ['new-id'] });

            // Assert
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const whatsNew = onboarding.whatsNew as { baselineAt: string; seenIds: string[] };
            expect(whatsNew.baselineAt).toBe(baselineAt);
        });
    });

    describe('idempotency with overlapping ids', () => {
        it('should produce a Set union with no duplicates on overlapping ids', async () => {
            // Arrange
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                onboarding: {
                    whatsNew: { baselineAt: '2026-01-01T00:00:00.000Z', seenIds: ['a', 'b'] }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act — send ids with overlap
            await service.markWhatsNewSeen(actor, { ids: ['b', 'c'] });

            // Assert
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const whatsNew = onboarding.whatsNew as { seenIds: string[] };
            expect(whatsNew.seenIds).toEqual(expect.arrayContaining(['a', 'b', 'c']));
            // No duplicates
            expect(new Set(whatsNew.seenIds).size).toBe(whatsNew.seenIds.length);
        });

        it('should not grow seenIds when called twice with the same ids', async () => {
            // Arrange
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                onboarding: {
                    whatsNew: { baselineAt: '2026-01-01T00:00:00.000Z', seenIds: ['entry-1'] }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act — same id twice
            await service.markWhatsNewSeen(actor, { ids: ['entry-1'] });

            // Assert: still only one entry
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const whatsNew = onboarding.whatsNew as { seenIds: string[] };
            expect(whatsNew.seenIds).toEqual(['entry-1']);
        });
    });

    describe('error cases', () => {
        it('should return NOT_FOUND when user does not exist', async () => {
            // Arrange
            const actor = makeActor();
            asMock(userModelMock.findById).mockResolvedValue(null);

            // Act
            const result = await service.markWhatsNewSeen(actor, { ids: ['x'] });

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
            const result = await service.markWhatsNewSeen(actor, { ids: ['x'] });

            // Assert
            expectInternalError(result);
        });

        it('should return VALIDATION_ERROR when ids array is empty', async () => {
            // Arrange
            const actor = makeActor();

            // Act
            const result = await service.markWhatsNewSeen(actor, { ids: [] });

            // Assert
            expectValidationError(result);
        });
    });
});

describe('UserService.initWhatsNewBaseline', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    describe('when onboarding.whatsNew is absent', () => {
        it('should write baselineAt (ISO string) and empty seenIds', async () => {
            // Arrange
            const actor = makeActor();
            const user = createMockUser({ id: actor.id, settings: undefined });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            const result = await service.initWhatsNewBaseline(actor);

            // Assert
            expectSuccess(result);
            expect(result.data?.initialized).toBe(true);

            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            const whatsNew = onboarding.whatsNew as {
                baselineAt: string;
                seenIds: string[];
            };
            expect(typeof whatsNew.baselineAt).toBe('string');
            // Must be parseable ISO date
            expect(new Date(whatsNew.baselineAt).toISOString()).toBe(whatsNew.baselineAt);
            expect(whatsNew.seenIds).toEqual([]);
        });

        it('should preserve sibling onboarding.adminTours when initializing', async () => {
            // Arrange
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                themeAdmin: 'dark',
                onboarding: { adminTours: { 'host.welcome': 1 } }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);
            asMock(userModelMock.update).mockResolvedValue({ ...user });

            // Act
            await service.initWhatsNewBaseline(actor);

            // Assert: adminTours preserved, themeAdmin preserved
            const updateCall = asMock(userModelMock.update).mock.calls[0];
            const patch = updateCall?.[1] as { settings: Record<string, unknown> };
            expect(patch.settings.themeAdmin).toBe('dark');
            const onboarding = patch.settings.onboarding as Record<string, unknown>;
            expect(onboarding.adminTours).toEqual({ 'host.welcome': 1 });
        });
    });

    describe('when onboarding.whatsNew already exists (no-op)', () => {
        it('should return initialized=false without calling model.update', async () => {
            // Arrange
            const actor = makeActor();
            const settings: Record<string, unknown> = {
                onboarding: {
                    whatsNew: { baselineAt: '2026-05-01T00:00:00.000Z', seenIds: ['abc'] }
                }
            };
            const user = createMockUser({ id: actor.id, settings: settings as UserSettings });
            asMock(userModelMock.findById).mockResolvedValue(user);

            // Act
            const result = await service.initWhatsNewBaseline(actor);

            // Assert
            expectSuccess(result);
            expect(result.data?.initialized).toBe(false);
            expect(userModelMock.update).not.toHaveBeenCalled();
        });
    });

    describe('error cases', () => {
        it('should return NOT_FOUND when user does not exist', async () => {
            // Arrange
            const actor = makeActor();
            asMock(userModelMock.findById).mockResolvedValue(null);

            // Act
            const result = await service.initWhatsNewBaseline(actor);

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
            const result = await service.initWhatsNewBaseline(actor);

            // Assert
            expectInternalError(result);
        });
    });
});
