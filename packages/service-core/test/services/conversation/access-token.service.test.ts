/**
 * @file access-token.service.test.ts
 *
 * Unit tests for AccessTokenService.
 *
 * All model interactions are mocked using createTypedModelMock so the suite
 * runs without a live database connection.
 */

import { AccessTokenModel } from '@repo/db';
import type { SelectConversationAccessToken } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenService } from '../../../src/services/conversation/access-token.service';
import { createActor } from '../../factories/actorFactory';
import {
    expectForbiddenError,
    expectSuccess,
    expectUnauthorizedError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/** Cast helper for Vitest mock access */
const asMock = <T>(fn: T) => fn as unknown as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SYSTEM_ACTOR = createActor({
    role: RoleEnum.SUPER_ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_DELETE_ANY
    ]
});

const GUEST_ACTOR = createActor({
    role: RoleEnum.USER,
    permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
});

const FORBIDDEN_ACTOR = createActor({
    role: RoleEnum.USER,
    permissions: []
});

const CONVERSATION_ID = 'aaaabbbb-cccc-4ddd-8eee-ffffffffffff';
const TOKEN_ID = 'bbbbcccc-dddd-4eee-8fff-000000000000';

function makeTokenRow(
    overrides: Partial<SelectConversationAccessToken> = {}
): SelectConversationAccessToken {
    return {
        id: TOKEN_ID,
        conversationId: CONVERSATION_ID,
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        day15ReminderSentAt: null,
        day25ReminderSentAt: null,
        createdAt: new Date(),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccessTokenService', () => {
    let service: AccessTokenService;
    let modelMock: AccessTokenModel;

    beforeEach(() => {
        modelMock = createTypedModelMock(AccessTokenModel, [
            'findOne',
            'findByTokenHash',
            'findByConversationId',
            'findDueReminders',
            'revokeAll'
        ]);
        const loggerMock = createLoggerMock();
        service = new AccessTokenService({ logger: loggerMock }, modelMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // generateToken
    // -----------------------------------------------------------------------

    describe('generateToken', () => {
        it('should return a 32-char hex rawToken on success', async () => {
            asMock(modelMock.create).mockResolvedValue(makeTokenRow());

            const result = await service.generateToken(GUEST_ACTOR, {
                conversationId: CONVERSATION_ID
            });

            expectSuccess(result);
            expect(result.data?.rawToken).toMatch(/^[0-9a-f]{32}$/);
        });

        it('should persist a hash (not the raw token) and an expiresAt ~30 days out', async () => {
            let captured: Partial<SelectConversationAccessToken> | undefined;
            asMock(modelMock.create).mockImplementation(
                async (data: Partial<SelectConversationAccessToken>) => {
                    captured = data;
                    return makeTokenRow();
                }
            );

            const before = Date.now();
            const result = await service.generateToken(GUEST_ACTOR, {
                conversationId: CONVERSATION_ID
            });
            const after = Date.now();

            expectSuccess(result);

            // Hash is 64 hex chars (SHA-256 output)
            expect(captured?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
            // Hash must differ from the returned rawToken
            expect(captured?.tokenHash).not.toBe(result.data?.rawToken);

            // expiresAt should be approximately 30 days from now (within a 5-second tolerance)
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            const expiresMs = captured?.expiresAt?.getTime() ?? 0;
            expect(expiresMs).toBeGreaterThanOrEqual(before + thirtyDays - 5000);
            expect(expiresMs).toBeLessThanOrEqual(after + thirtyDays + 5000);
        });

        it('should return FORBIDDEN when actor lacks conversation permissions', async () => {
            const result = await service.generateToken(FORBIDDEN_ACTOR, {
                conversationId: CONVERSATION_ID
            });
            expectForbiddenError(result);
            expect(asMock(modelMock.create)).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR for non-UUID conversationId', async () => {
            const result = await service.generateToken(GUEST_ACTOR, {
                conversationId: 'not-a-uuid'
            });
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    // -----------------------------------------------------------------------
    // validateToken
    // -----------------------------------------------------------------------

    describe('validateToken', () => {
        it('should return the token row for a valid, non-revoked, non-expired token', async () => {
            const row = makeTokenRow();
            asMock(modelMock.findOne).mockResolvedValue(row);

            const result = await service.validateToken(GUEST_ACTOR, { rawToken: 'a'.repeat(32) });

            expectSuccess(result);
            expect(result.data?.id).toBe(TOKEN_ID);
        });

        it('should return UNAUTHORIZED with TOKEN_EXPIRED for an expired token', async () => {
            const row = makeTokenRow({ expiresAt: new Date(Date.now() - 1000) }); // past
            asMock(modelMock.findOne).mockResolvedValue(row);

            const result = await service.validateToken(GUEST_ACTOR, { rawToken: 'b'.repeat(32) });

            expectUnauthorizedError(result);
            // ServiceError.reason is accessible at runtime even if ServiceOutput type doesn't declare it
            expect((result.error as unknown as { reason?: string })?.reason).toBe('TOKEN_EXPIRED');
        });

        it('should return UNAUTHORIZED with TOKEN_REVOKED for a revoked token', async () => {
            const row = makeTokenRow({ revokedAt: new Date() });
            asMock(modelMock.findOne).mockResolvedValue(row);

            const result = await service.validateToken(GUEST_ACTOR, { rawToken: 'c'.repeat(32) });

            expectUnauthorizedError(result);
            expect((result.error as unknown as { reason?: string })?.reason).toBe('TOKEN_REVOKED');
        });

        it('should return UNAUTHORIZED with TOKEN_REVOKED when hash is not found', async () => {
            asMock(modelMock.findOne).mockResolvedValue(null);

            const result = await service.validateToken(GUEST_ACTOR, { rawToken: 'd'.repeat(32) });

            expectUnauthorizedError(result);
            expect((result.error as unknown as { reason?: string })?.reason).toBe('TOKEN_REVOKED');
        });

        it('should return FORBIDDEN when actor lacks conversation permissions', async () => {
            const result = await service.validateToken(FORBIDDEN_ACTOR, {
                rawToken: 'e'.repeat(32)
            });
            expectForbiddenError(result);
        });
    });

    // -----------------------------------------------------------------------
    // revokeAllForConversation
    // -----------------------------------------------------------------------

    describe('revokeAllForConversation', () => {
        it('should call model.revokeAll and return the count', async () => {
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            asMock(modelMock.revokeAll).mockResolvedValue(2);

            const result = await service.revokeAllForConversation(
                SYSTEM_ACTOR,
                { conversationId: CONVERSATION_ID },
                fakeDb
            );

            expectSuccess(result);
            expect(result.data?.count).toBe(2);
            expect(asMock(modelMock.revokeAll)).toHaveBeenCalledWith(CONVERSATION_ID, fakeDb);
        });

        it('should be idempotent: calling twice does not throw', async () => {
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            asMock(modelMock.revokeAll).mockResolvedValueOnce(2).mockResolvedValueOnce(0);

            await service.revokeAllForConversation(
                SYSTEM_ACTOR,
                { conversationId: CONVERSATION_ID },
                fakeDb
            );
            const second = await service.revokeAllForConversation(
                SYSTEM_ACTOR,
                { conversationId: CONVERSATION_ID },
                fakeDb
            );

            expectSuccess(second);
            expect(second.data?.count).toBe(0);
        });

        it('should return FORBIDDEN when actor lacks CONVERSATION_VIEW_ANY', async () => {
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            const result = await service.revokeAllForConversation(
                GUEST_ACTOR,
                { conversationId: CONVERSATION_ID },
                fakeDb
            );
            expectForbiddenError(result);
        });
    });

    // -----------------------------------------------------------------------
    // findDueReminders
    // -----------------------------------------------------------------------

    describe('findDueReminders', () => {
        it('should call model.findDueReminders with the day15 window', async () => {
            asMock(modelMock.findDueReminders).mockResolvedValue([makeTokenRow()]);

            vi.useFakeTimers();
            const now = Date.now();
            vi.setSystemTime(now);

            const result = await service.findDueReminders(SYSTEM_ACTOR, { reminderType: 'day15' });

            vi.useRealTimers();

            expectSuccess(result);
            expect(result.data).toHaveLength(1);

            const call0 = asMock(modelMock.findDueReminders).mock.calls[0] as [Date, Date, string];
            const [windowStart, windowEnd, type] = call0;
            const expectedLower = new Date(now + 14 * 24 * 60 * 60 * 1000);
            const expectedUpper = new Date(now + 16 * 24 * 60 * 60 * 1000);
            expect(windowStart.getTime()).toBe(expectedLower.getTime());
            expect(windowEnd.getTime()).toBe(expectedUpper.getTime());
            expect(type).toBe('day15');
        });

        it('should call model.findDueReminders with the day25 window', async () => {
            asMock(modelMock.findDueReminders).mockResolvedValue([]);

            vi.useFakeTimers();
            const now = Date.now();
            vi.setSystemTime(now);

            await service.findDueReminders(SYSTEM_ACTOR, { reminderType: 'day25' });

            vi.useRealTimers();

            const call0 = asMock(modelMock.findDueReminders).mock.calls[0] as [Date, Date, string];
            const [windowStart, windowEnd, type] = call0;
            const expectedLower = new Date(now + 4 * 24 * 60 * 60 * 1000);
            const expectedUpper = new Date(now + 6 * 24 * 60 * 60 * 1000);
            expect(windowStart.getTime()).toBe(expectedLower.getTime());
            expect(windowEnd.getTime()).toBe(expectedUpper.getTime());
            expect(type).toBe('day25');
        });

        it('should return FORBIDDEN when actor lacks CONVERSATION_VIEW_ANY', async () => {
            const result = await service.findDueReminders(GUEST_ACTOR, { reminderType: 'day15' });
            expectForbiddenError(result);
        });
    });

    // -----------------------------------------------------------------------
    // markReminderSent
    // -----------------------------------------------------------------------

    describe('markReminderSent', () => {
        it('should update day15ReminderSentAt and not touch day25ReminderSentAt', async () => {
            const updated = makeTokenRow({ day15ReminderSentAt: new Date() });
            asMock(modelMock.update).mockResolvedValue(updated);

            const result = await service.markReminderSent(SYSTEM_ACTOR, {
                tokenId: TOKEN_ID,
                reminderType: 'day15'
            });

            expectSuccess(result);
            const call0day15 = asMock(modelMock.update).mock.calls[0] as [
                Record<string, unknown>,
                Record<string, unknown>
            ];
            const [where15, patch15] = call0day15;
            expect(where15).toEqual({ id: TOKEN_ID });
            expect(patch15).toHaveProperty('day15ReminderSentAt');
            expect(patch15).not.toHaveProperty('day25ReminderSentAt');
        });

        it('should update day25ReminderSentAt and not touch day15ReminderSentAt', async () => {
            const updated = makeTokenRow({ day25ReminderSentAt: new Date() });
            asMock(modelMock.update).mockResolvedValue(updated);

            const result = await service.markReminderSent(SYSTEM_ACTOR, {
                tokenId: TOKEN_ID,
                reminderType: 'day25'
            });

            expectSuccess(result);
            const call0day25 = asMock(modelMock.update).mock.calls[0] as [
                Record<string, unknown>,
                Record<string, unknown>
            ];
            const [where25, patch25] = call0day25;
            expect(where25).toEqual({ id: TOKEN_ID });
            expect(patch25).toHaveProperty('day25ReminderSentAt');
            expect(patch25).not.toHaveProperty('day15ReminderSentAt');
        });

        it('should return FORBIDDEN when actor lacks CONVERSATION_VIEW_ANY', async () => {
            const result = await service.markReminderSent(GUEST_ACTOR, {
                tokenId: TOKEN_ID,
                reminderType: 'day15'
            });
            expectForbiddenError(result);
        });
    });
});
