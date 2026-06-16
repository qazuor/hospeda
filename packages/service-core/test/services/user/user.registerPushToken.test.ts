/**
 * @file user.registerPushToken.test.ts
 *
 * Unit tests for UserService.registerPushToken (SPEC-243 T-011).
 *
 * Tests the service method with a mocked UserPushTokenModel to verify:
 * - actor.id is always used (self-scoped, no injected userId)
 * - upsertByToken is called with the right arguments
 * - the success path returns { registered: true }
 * - when upsertByToken throws, the service surfaces a ServiceError
 * - invalid input (empty token, bad platform) returns VALIDATION_ERROR
 */

import { type PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createLoggerMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const buildActor = () => ({
    id: ACTOR_ID,
    email: 'test@example.com',
    role: RoleEnum.USER,
    permissions: [] as PermissionEnum[]
});

const buildMockPushTokenModel = () => ({
    upsertByToken: vi.fn().mockResolvedValue({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: ACTOR_ID,
        token: 'ExponentPushToken[test_token]',
        platform: 'ios',
        createdAt: new Date(),
        updatedAt: new Date()
    })
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserService.registerPushToken', () => {
    let service: UserService;
    let mockPushTokenModel: ReturnType<typeof buildMockPushTokenModel>;

    beforeEach(() => {
        mockPushTokenModel = buildMockPushTokenModel();
        const loggerMock = createLoggerMock();
        service = new UserService({ logger: loggerMock });
        // Inject mock via the private field using a type-safe cast (test-only).
        (service as unknown as Record<string, unknown>).pushTokenModel = mockPushTokenModel;
    });

    it('returns { registered: true } on success', async () => {
        const actor = buildActor();
        const result = await service.registerPushToken(actor, {
            token: 'ExponentPushToken[test_token]',
            platform: 'ios'
        });

        expect(result.data).toEqual({ registered: true });
        expect(result.error).toBeFalsy();
    });

    it('calls upsertByToken with actor.id (self-scoped, not an injected userId)', async () => {
        const actor = buildActor();
        await service.registerPushToken(actor, {
            token: 'ExponentPushToken[test_token]',
            platform: 'android'
        });

        expect(mockPushTokenModel.upsertByToken).toHaveBeenCalledWith(
            { userId: ACTOR_ID, token: 'ExponentPushToken[test_token]', platform: 'android' },
            undefined // no transaction
        );
    });

    it('calls upsertByToken with the exact token and platform from input', async () => {
        const actor = buildActor();
        const token = 'ExponentPushToken[abc123]';
        const platform = 'web' as const;

        await service.registerPushToken(actor, { token, platform });

        expect(mockPushTokenModel.upsertByToken).toHaveBeenCalledWith(
            expect.objectContaining({ token, platform }),
            undefined
        );
    });

    it('returns a ServiceError when upsertByToken throws', async () => {
        mockPushTokenModel.upsertByToken.mockRejectedValue(new Error('DB connection lost'));
        const actor = buildActor();

        const result = await service.registerPushToken(actor, {
            token: 'ExponentPushToken[fail]',
            platform: 'ios'
        });

        expect(result.error).toBeTruthy();
        // runWithLoggingAndValidation wraps unexpected errors as INTERNAL_ERROR
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('returns a validation ServiceError when token is empty string', async () => {
        const actor = buildActor();

        const result = await service.registerPushToken(actor, {
            token: '',
            platform: 'ios'
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns a validation ServiceError when platform is invalid', async () => {
        const actor = buildActor();

        const result = await service.registerPushToken(actor, {
            token: 'ExponentPushToken[x]',
            platform: 'windows' as unknown as 'ios'
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
