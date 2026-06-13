/**
 * @file conversation.service.test.ts
 *
 * Unit tests for ConversationService.
 *
 * All external dependencies are mocked:
 * - `@repo/db`: getDb() returns a chainable query builder mock
 * - `mailer` dep: a vi.fn() stub that records sendVerificationEmail calls
 * - `jose`: SignJWT / jwtVerify are controlled via vitest mocks
 * - `transaction.js`: withServiceTransaction passes a fake ctx.tx to the callback
 * - Model instances: injected via constructor DI
 * - AccessTokenService / NotificationScheduleService: injected stubs
 *
 * Coverage targets:
 * - initiateAnonymous: new, unverified-duplicate, verified-duplicate
 * - initiateAuthenticated: new (isNew=true), existing (isNew=false)
 * - verifyEmailToken: happy path, idempotent, invalid JWT
 * - softDelete: 4-step cascade inside single transaction
 * - closeAllForAccommodation: updates conversations + cancels schedules
 * - updateStatus: allowed transition, forbidden transition (state machine)
 * - updateStatus BLOCKED: cancels all schedules
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must be before imports)
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => {
            const fakeTxClient = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            };
            return fn({ tx: fakeTxClient, hookState: {} });
        }
    )
}));

vi.mock('jose', () => {
    /** Minimal JWTExpired class for testing the expired-token path. */
    class JWTExpiredError extends Error {
        readonly code = 'ERR_JWT_EXPIRED';
        constructor(message: string) {
            super(message);
            this.name = 'JWTExpired';
        }
    }
    return {
        SignJWT: vi.fn().mockImplementation(() => ({
            setProtectedHeader: vi.fn().mockReturnThis(),
            setExpirationTime: vi.fn().mockReturnThis(),
            sign: vi.fn().mockResolvedValue('mock.jwt.token')
        })),
        jwtVerify: vi.fn(),
        errors: {
            JWTExpired: JWTExpiredError
        }
    };
});

// @repo/db mock: getDb returns a chainable query builder that tests can override
vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        getDb: vi.fn(),
        AccommodationModel: vi.fn().mockImplementation(() => ({ findById: vi.fn() })),
        ConversationModel: vi.fn().mockImplementation(() => ({
            findById: vi.fn(),
            findByAnonymousEmailAndAccommodationId: vi.fn(),
            findByUserIdAndAccommodationId: vi.fn(),
            listByUserId: vi.fn(),
            listByAccommodationIds: vi.fn()
        })),
        MessageModel: vi.fn().mockImplementation(() => ({
            findByConversationId: vi.fn()
        }))
    };
});

import * as dbModule from '@repo/db';
import { AccommodationModel, ConversationModel, MessageModel } from '@repo/db';
import type { DrizzleClient, SelectConversation } from '@repo/db';
import { ConversationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import * as jose from 'jose';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessTokenService } from '../../../src/services/conversation/access-token.service.js';
import { ConversationService } from '../../../src/services/conversation/conversation.service.js';
import type { MessageService } from '../../../src/services/conversation/message.service.js';
import type { NotificationScheduleService } from '../../../src/services/conversation/notification-schedule.service.js';
import { withServiceTransaction } from '../../../src/utils/transaction.js';
import { createActor } from '../../factories/actorFactory.js';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';

/** Cast helper for Vitest mock access */
const asMock = <T>(fn: T) => fn as unknown as Mock;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ACTOR = createActor({
    id: crypto.randomUUID(),
    role: RoleEnum.USER,
    permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
});

const ADMIN_ACTOR = createActor({
    id: crypto.randomUUID(),
    role: RoleEnum.SUPER_ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_ALL,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
        PermissionEnum.CONVERSATION_DELETE_ANY,
        PermissionEnum.CONVERSATION_BLOCK_ANY
    ]
});

const OWNER_ACTOR = createActor({
    id: crypto.randomUUID(),
    role: RoleEnum.HOST,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
        PermissionEnum.CONVERSATION_BLOCK_OWN
    ]
});

const FORBIDDEN_ACTOR = createActor({
    id: crypto.randomUUID(),
    role: RoleEnum.USER,
    permissions: []
});

const CONVERSATION_ID = crypto.randomUUID();
const ACCOMMODATION_ID = crypto.randomUUID();

const mockMailer = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendAccessLinkEmail: vi.fn().mockResolvedValue(undefined)
};

const SERVICE_DEPS = {
    authSecret: 'test-secret-must-be-at-least-32-chars-long!!',
    siteUrl: 'https://test.hospeda.com',
    mailer: mockMailer
} as const;

function makeConversation(overrides: Partial<SelectConversation> = {}): SelectConversation {
    const now = new Date();
    return {
        id: CONVERSATION_ID,
        accommodationId: ACCOMMODATION_ID,
        userId: null,
        anonymousName: 'Ana García',
        anonymousEmail: 'ana@example.com',
        anonymousEmailVerified: false,
        anonymousPhone: null,
        status: 'PENDING_VERIFICATION' as SelectConversation['status'],
        blockReason: null,
        locale: 'es',
        archivedByGuest: false,
        archivedByOwner: false,
        lastReadAtByGuest: null,
        lastReadAtByOwner: null,
        firstGuestMessageAt: null,
        firstOwnerReplyAt: null,
        lastActivityAt: null,
        lastGuestMessageAt: null,
        lastOwnerMessageAt: null,
        closedAt: null,
        blockedAt: null,
        guestMessageCount: 0,
        ownerMessageCount: 0,
        createdAt: now,
        updatedAt: now,
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

function makeAccommodation(overrides: { deletedAt?: Date | null; name?: string } = {}) {
    return {
        id: ACCOMMODATION_ID,
        name: 'Posada del Sol',
        deletedAt: null,
        ...overrides
    };
}

/** Builds a chainable DB mock for the select → from → where → limit pattern */
function makeSelectChainMock(resolvedValue: unknown[]) {
    const limitMock = vi.fn().mockResolvedValue(resolvedValue);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    return {
        select: selectMock,
        from: fromMock,
        where: whereMock,
        limit: limitMock,
        _resolvedValue: resolvedValue
    };
}

/** Builds a chainable DB mock for the insert → values → returning pattern */
function makeInsertChainMock(resolvedValue: unknown[]) {
    const returningMock = vi.fn().mockResolvedValue(resolvedValue);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    return {
        insert: insertMock,
        values: valuesMock,
        returning: returningMock
    };
}

/** Builds a chainable DB mock for update → set → where → returning */
function makeUpdateChainMock(resolvedValue: unknown[]) {
    const returningMock = vi.fn().mockResolvedValue(resolvedValue);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    return {
        update: updateMock,
        set: setMock,
        where: whereMock,
        returning: returningMock
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const MESSAGE_ID = crypto.randomUUID();

describe('ConversationService', () => {
    let service: ConversationService;
    let conversationModelMock: ConversationModel;
    let messageModelMock: MessageModel;
    let accommodationModelMock: AccommodationModel;
    let accessTokenServiceMock: AccessTokenService;
    let notificationScheduleMock: NotificationScheduleService;
    let messageServiceMock: MessageService;
    let mockGetDb: Mock;

    beforeEach(async () => {
        // Model mocks
        conversationModelMock = createTypedModelMock(ConversationModel, [
            'findById',
            'findByAnonymousEmailAndAccommodationId',
            'findByUserIdAndAccommodationId',
            'listByUserId',
            'listByAccommodationIds'
        ]);
        messageModelMock = createTypedModelMock(MessageModel, ['findByConversationId']);
        accommodationModelMock = createTypedModelMock(AccommodationModel, ['findById']);

        // Service stubs
        accessTokenServiceMock = {
            generateToken: vi.fn().mockResolvedValue({
                data: { rawToken: 'fake-raw-token-32chars0000000000' }
            }),
            revokeAllForConversation: vi.fn().mockResolvedValue({ data: { count: 0 } })
        } as unknown as AccessTokenService;

        notificationScheduleMock = {
            upsertForMessage: vi.fn().mockResolvedValue({ data: {} }),
            cancelForRecipient: vi.fn().mockResolvedValue({ data: { count: 0 } }),
            cancelAllForConversation: vi.fn().mockResolvedValue({ data: { count: 0 } })
        } as unknown as NotificationScheduleService;

        messageServiceMock = {
            createMessage: vi.fn().mockResolvedValue({ data: { id: MESSAGE_ID } })
        } as unknown as MessageService;

        // getDb mock

        mockGetDb = dbModule.getDb as unknown as Mock;

        const loggerMock = createLoggerMock();
        service = new ConversationService(
            { logger: loggerMock },
            SERVICE_DEPS,
            conversationModelMock,
            messageModelMock,
            accommodationModelMock,
            accessTokenServiceMock,
            notificationScheduleMock,
            messageServiceMock
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // initiateAnonymous
    // =========================================================================

    describe('initiateAnonymous', () => {
        it('should create a new PENDING_VERIFICATION conversation and send verification email', async () => {
            // Arrange
            const accommodationMock = makeAccommodation();
            asMock(accommodationModelMock.findById).mockResolvedValue(accommodationMock);
            asMock(conversationModelMock.findByAnonymousEmailAndAccommodationId).mockResolvedValue(
                null
            );

            const newConv = makeConversation({
                id: CONVERSATION_ID,
                status: 'PENDING_VERIFICATION'
            });

            // select → from → where → limit: no existing pending row
            const selectChain = makeSelectChainMock([]);
            // insert → values → returning: new conversation
            const insertChain = makeInsertChainMock([newConv]);

            mockGetDb.mockReturnValue({
                select: selectChain.select,
                insert: insertChain.insert
            });

            // Act
            const result = await service.initiateAnonymous(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                guestName: 'Ana García',
                guestEmail: 'ana@example.com',
                message: 'Hola, me gustaría reservar una habitación'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.status).toBe('pending_verification');
            expect(result.data?.conversationId).toBe(CONVERSATION_ID);
        });

        it('should re-send email and return status=resent for unverified duplicate', async () => {
            // Arrange
            const accommodationMock = makeAccommodation();
            asMock(accommodationModelMock.findById).mockResolvedValue(accommodationMock);
            // No verified duplicate
            asMock(conversationModelMock.findByAnonymousEmailAndAccommodationId).mockResolvedValue(
                null
            );

            const existingPendingRow = makeConversation({
                id: CONVERSATION_ID,
                status: 'PENDING_VERIFICATION'
            });

            // select returns the existing pending row (unverified duplicate)
            const selectChain = makeSelectChainMock([existingPendingRow]);
            mockGetDb.mockReturnValue({ select: selectChain.select });

            // Act
            const result = await service.initiateAnonymous(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                guestName: 'Ana García',
                guestEmail: 'ana@example.com',
                message: 'Intento de nuevo'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.status).toBe('resent');
            expect(result.data?.conversationId).toBe(CONVERSATION_ID);
        });

        it('should throw ALREADY_EXISTS for a verified duplicate conversation', async () => {
            // Arrange
            const accommodationMock = makeAccommodation();
            asMock(accommodationModelMock.findById).mockResolvedValue(accommodationMock);

            // Verified duplicate already exists
            const verifiedConv = makeConversation({
                anonymousEmailVerified: true,
                status: 'PENDING_OWNER'
            });
            asMock(conversationModelMock.findByAnonymousEmailAndAccommodationId).mockResolvedValue(
                verifiedConv
            );

            // Act
            const result = await service.initiateAnonymous(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                guestName: 'Ana García',
                guestEmail: 'ana@example.com',
                message: 'Another message'
            });

            // Assert
            expect(result.error?.code).toBe('ALREADY_EXISTS');
            // ServiceError.reason is accessible at runtime even though ServiceOutput type doesn't declare it
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'CONVERSATION_DUPLICATE'
            );
        });

        it('should throw NOT_FOUND when accommodation does not exist', async () => {
            // Arrange
            asMock(accommodationModelMock.findById).mockResolvedValue(null);

            // Act
            const result = await service.initiateAnonymous(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                guestName: 'Ana García',
                guestEmail: 'ana@example.com',
                message: 'Hello'
            });

            // Assert
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    // =========================================================================
    // initiateAuthenticated
    // =========================================================================

    describe('initiateAuthenticated', () => {
        it('should create a new PENDING_OWNER conversation and return isNew=true with messageId', async () => {
            // Arrange
            const accommodationMock = makeAccommodation();
            asMock(accommodationModelMock.findById).mockResolvedValue(accommodationMock);
            asMock(conversationModelMock.findByUserIdAndAccommodationId).mockResolvedValue(null);

            const newConv = makeConversation({
                id: CONVERSATION_ID,
                status: 'PENDING_OWNER',
                userId: ACTOR.id
            });
            const newMsgId = crypto.randomUUID();
            const insertedMessage = { id: newMsgId };

            // Override withServiceTransaction: insert(conversations) → [newConv],
            // insert(messages) → [insertedMessage], update(conversations) → []

            let insertCallCount = 0;
            asMock(withServiceTransaction).mockImplementationOnce(
                async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => {
                    const fakeTx = {
                        insert: vi.fn().mockImplementation(() => {
                            insertCallCount++;
                            if (insertCallCount === 1) {
                                // First insert: conversations → .returning() → [newConv]
                                return {
                                    values: vi.fn().mockReturnValue({
                                        returning: vi.fn().mockResolvedValue([newConv])
                                    })
                                };
                            }
                            // Second insert: messages → .returning() → [insertedMessage]
                            return {
                                values: vi.fn().mockReturnValue({
                                    returning: vi.fn().mockResolvedValue([insertedMessage])
                                })
                            };
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return fn({ tx: fakeTx, hookState: {} });
                }
            );

            // Act
            const result = await service.initiateAuthenticated(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                message: 'Hola, me gustaría reservar'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.isNew).toBe(true);
            expect(result.data?.conversationId).toBe(CONVERSATION_ID);
            expect(result.data?.messageId).toBe(newMsgId);
        });

        it('should return isNew=false with messageId when an existing conversation is found', async () => {
            // Arrange
            const accommodationMock = makeAccommodation();
            asMock(accommodationModelMock.findById).mockResolvedValue(accommodationMock);

            const existingConv = makeConversation({
                id: CONVERSATION_ID,
                status: 'OPEN',
                userId: ACTOR.id
            });
            asMock(conversationModelMock.findByUserIdAndAccommodationId).mockResolvedValue(
                existingConv
            );
            // MessageService.createMessage returns a message id
            asMock(messageServiceMock.createMessage).mockResolvedValue({
                data: { id: MESSAGE_ID }
            });

            // Act
            const result = await service.initiateAuthenticated(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                message: 'Another message'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.isNew).toBe(false);
            expect(result.data?.conversationId).toBe(CONVERSATION_ID);
            expect(result.data?.messageId).toBe(MESSAGE_ID);
            expect(messageServiceMock.createMessage).toHaveBeenCalledOnce();
        });

        it('should throw NOT_FOUND when accommodation is deleted', async () => {
            // Arrange
            asMock(accommodationModelMock.findById).mockResolvedValue(
                makeAccommodation({ deletedAt: new Date() })
            );

            // Act
            const result = await service.initiateAuthenticated(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                message: 'Hello'
            });

            // Assert
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    // =========================================================================
    // verifyEmailToken
    // =========================================================================

    describe('verifyEmailToken', () => {
        it('should transition PENDING_VERIFICATION → PENDING_OWNER and return rawToken', async () => {
            // Arrange
            const conversation = makeConversation({
                status: 'PENDING_VERIFICATION',
                anonymousEmailVerified: false
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            asMock(jose.jwtVerify).mockResolvedValue({
                payload: { conversationId: CONVERSATION_ID, email: 'ana@example.com' }
            });

            const rawToken = 'fresh-raw-token-32chars000000000000';
            asMock(accessTokenServiceMock.generateToken).mockResolvedValue({
                data: { rawToken }
            });

            // withServiceTransaction: override to capture the calls

            asMock(withServiceTransaction).mockImplementationOnce(
                async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => {
                    const fakeTx = {
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return fn({ tx: fakeTx, hookState: {} });
                }
            );

            // Act
            const result = await service.verifyEmailToken(ACTOR, {
                verificationToken: 'mock.jwt.token'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.conversationId).toBe(CONVERSATION_ID);
            expect(result.data?.rawToken).toBe(rawToken);
            expect(notificationScheduleMock.upsertForMessage).toHaveBeenCalledOnce();
        });

        it('should be idempotent — return fresh token when conversation is already past PENDING_VERIFICATION', async () => {
            // Arrange
            const conversation = makeConversation({
                status: 'PENDING_OWNER',
                anonymousEmailVerified: true
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            asMock(jose.jwtVerify).mockResolvedValue({
                payload: { conversationId: CONVERSATION_ID, email: 'ana@example.com' }
            });

            const rawToken = 'idempotent-raw-token-32chars000000';
            asMock(accessTokenServiceMock.generateToken).mockResolvedValue({
                data: { rawToken }
            });

            // Act
            const result = await service.verifyEmailToken(ACTOR, {
                verificationToken: 'mock.jwt.token'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.rawToken).toBe(rawToken);
            // Should NOT schedule a new notification (idempotent path bypasses transaction)
            expect(notificationScheduleMock.upsertForMessage).not.toHaveBeenCalled();
        });

        it('should return VERIFICATION_TOKEN_EXPIRED when JWT is expired (AC-002-03)', async () => {
            // Arrange — throw a JWTExpired error (matches jose's error class via instanceof)
            const JWTExpiredCtor = (jose as any).errors.JWTExpired;
            asMock(jose.jwtVerify).mockRejectedValue(new JWTExpiredCtor('Token expired'));

            // Act
            const result = await service.verifyEmailToken(ACTOR, {
                verificationToken: 'expired.jwt.token'
            });

            // Assert
            expect(result.error?.code).toBe('UNAUTHORIZED');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'VERIFICATION_TOKEN_EXPIRED'
            );
        });

        it('should return VERIFICATION_TOKEN_INVALID when JWT has bad signature (AC-002-04)', async () => {
            // Arrange — throw a generic (non-expiry) error
            asMock(jose.jwtVerify).mockRejectedValue(new Error('Invalid signature'));

            // Act
            const result = await service.verifyEmailToken(ACTOR, {
                verificationToken: 'invalid.jwt.token'
            });

            // Assert
            expect(result.error?.code).toBe('UNAUTHORIZED');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'VERIFICATION_TOKEN_INVALID'
            );
        });

        it('should return VERIFICATION_TOKEN_INVALID when JWT payload is missing conversationId', async () => {
            // Arrange
            asMock(jose.jwtVerify).mockResolvedValue({
                payload: { email: 'ana@example.com' } // no conversationId
            });

            // Act
            const result = await service.verifyEmailToken(ACTOR, {
                verificationToken: 'mock.jwt.token'
            });

            // Assert
            expect(result.error?.code).toBe('UNAUTHORIZED');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'VERIFICATION_TOKEN_INVALID'
            );
        });
    });

    // =========================================================================
    // softDelete — 4-step cascade
    // =========================================================================

    describe('softDelete', () => {
        it('should call all 4 cascade steps inside a single transaction', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'OPEN' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const transactionSpy = vi.fn();

            asMock(withServiceTransaction).mockImplementationOnce(
                async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => {
                    const fakeTx = {
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    transactionSpy(fakeTx);
                    return fn({ tx: fakeTx, hookState: {} });
                }
            );

            // Act
            const result = await service.softDelete(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID
            });

            // Assert
            expectSuccess(result);
            // Transaction was opened
            expect(transactionSpy).toHaveBeenCalledOnce();
            // AccessTokenService.revokeAllForConversation called with correct id
            expect(accessTokenServiceMock.revokeAllForConversation).toHaveBeenCalledOnce();
            const revokeCall = asMock(accessTokenServiceMock.revokeAllForConversation).mock
                .calls[0] as [unknown, { conversationId: string }];
            expect(revokeCall[1].conversationId).toBe(CONVERSATION_ID);
            // NotificationScheduleService.cancelAllForConversation called
            expect(notificationScheduleMock.cancelAllForConversation).toHaveBeenCalledOnce();
        });

        it('should throw FORBIDDEN when actor lacks CONVERSATION_DELETE_ANY', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'OPEN' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            // Act
            const result = await service.softDelete(FORBIDDEN_ACTOR, {
                conversationId: CONVERSATION_ID
            });

            // Assert
            expectForbiddenError(result);
        });

        it('should throw NOT_FOUND when conversation does not exist', async () => {
            // Arrange
            asMock(conversationModelMock.findById).mockResolvedValue(null);

            // Act
            const result = await service.softDelete(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID
            });

            // Assert
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    // =========================================================================
    // closeAllForAccommodation
    // =========================================================================

    describe('closeAllForAccommodation', () => {
        it('should close all conversations and cancel schedules for each', async () => {
            // Arrange
            const id1 = crypto.randomUUID();
            const id2 = crypto.randomUUID();

            const fakeTx = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([{ id: id1 }, { id: id2 }])
                        })
                    })
                })
            } as unknown as DrizzleClient;

            // Act
            const count = await service.closeAllForAccommodation(ACCOMMODATION_ID, fakeTx);

            // Assert
            expect(count).toBe(2);
            // One cancelAllForConversation call per updated conversation
            expect(notificationScheduleMock.cancelAllForConversation).toHaveBeenCalledTimes(2);
            const calls = asMock(notificationScheduleMock.cancelAllForConversation).mock.calls as [
                unknown,
                { conversationId: string }
            ][];
            const cancelledIds = calls.map((c) => c[1].conversationId).sort();
            expect(cancelledIds).toEqual([id1, id2].sort());
        });

        it('should return 0 when there are no active conversations', async () => {
            // Arrange
            const fakeTx = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as unknown as DrizzleClient;

            // Act
            const count = await service.closeAllForAccommodation(ACCOMMODATION_ID, fakeTx);

            // Assert
            expect(count).toBe(0);
            expect(notificationScheduleMock.cancelAllForConversation).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // updateStatus — state machine
    // =========================================================================

    describe('updateStatus', () => {
        it('should allow PENDING_OWNER → CLOSED transition', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'PENDING_OWNER' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const updatedConv = makeConversation({
                status: 'CLOSED',
                closedAt: new Date()
            });

            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue({ update: updateChain.update });

            // Act
            const result = await service.updateStatus(
                ADMIN_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.CLOSED
                },
                []
            );

            // Assert
            expectSuccess(result);
            expect(result.data?.status).toBe('CLOSED');
        });

        it('should allow CLOSED → OPEN reopen by owner/admin (AC-003-04)', async () => {
            // Arrange — gap 1 fix: CLOSED → OPEN is now a valid transition
            const conversation = makeConversation({ status: 'CLOSED' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const updatedConv = makeConversation({ status: 'OPEN' });
            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue({ update: updateChain.update });

            // Act
            const result = await service.updateStatus(
                ADMIN_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.OPEN
                },
                []
            );

            // Assert — transition must succeed (previously rejected, now allowed per AC-003-04)
            expectSuccess(result);
            expect(result.data?.status).toBe('OPEN');
        });

        it('should reject BLOCKED → OPEN (blocked is terminal) with ALREADY_EXISTS', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'BLOCKED' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            // Act
            const result = await service.updateStatus(
                ADMIN_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.OPEN
                },
                []
            );

            // Assert
            expect(result.error?.code).toBe('ALREADY_EXISTS');
        });

        it('should cancel all schedules when transitioning to BLOCKED', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'OPEN' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const updatedConv = makeConversation({
                status: 'BLOCKED',
                blockedAt: new Date()
            });

            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue({ update: updateChain.update });

            // Act
            const result = await service.updateStatus(
                ADMIN_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.BLOCKED,
                    blockReason: 'Spam'
                },
                []
            );

            // Assert
            expectSuccess(result);
            expect(notificationScheduleMock.cancelAllForConversation).toHaveBeenCalledOnce();
            const cancelCall = asMock(notificationScheduleMock.cancelAllForConversation).mock
                .calls[0] as [unknown, { conversationId: string }];
            expect(cancelCall[1].conversationId).toBe(CONVERSATION_ID);
        });

        it('should throw FORBIDDEN when actor lacks UPDATE_STATUS permission', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'PENDING_OWNER' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            // Act
            const result = await service.updateStatus(
                FORBIDDEN_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.CLOSED
                },
                []
            );

            // Assert
            expectForbiddenError(result);
        });

        it('should allow OPEN → CLOSED for owner of the accommodation', async () => {
            // Arrange
            const conversation = makeConversation({
                status: 'OPEN',
                accommodationId: ACCOMMODATION_ID
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const updatedConv = makeConversation({ status: 'CLOSED' });
            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue({ update: updateChain.update });

            // Act — owner actor with UPDATE_STATUS_OWN and matching accommodation
            const result = await service.updateStatus(
                OWNER_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.CLOSED
                },
                [ACCOMMODATION_ID] // ownerAccommodationIds
            );

            // Assert
            expectSuccess(result);
        });

        it('should reject owner update when accommodation is not in ownerAccommodationIds', async () => {
            // Arrange
            const conversation = makeConversation({
                status: 'OPEN',
                accommodationId: ACCOMMODATION_ID
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            // Act — owner actor but wrong accommodation
            const result = await service.updateStatus(
                OWNER_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.CLOSED
                },
                [crypto.randomUUID()] // different accommodation
            );

            // Assert
            expectForbiddenError(result);
        });
    });

    // =========================================================================
    // sendVerificationEmail (no email key → skip gracefully)
    // =========================================================================

    describe('sendVerificationEmail', () => {
        it('should skip email and log warning when mailer is absent', async () => {
            // Arrange
            const serviceNoMailer = new ConversationService(
                { logger: createLoggerMock() },
                {
                    authSecret: SERVICE_DEPS.authSecret,
                    siteUrl: SERVICE_DEPS.siteUrl
                    // mailer deliberately absent
                },
                conversationModelMock,
                messageModelMock,
                accommodationModelMock,
                accessTokenServiceMock,
                notificationScheduleMock
            );

            // Act
            await serviceNoMailer.sendVerificationEmail(
                CONVERSATION_ID,
                'guest@example.com',
                'Guest',
                'Posada del Sol',
                'es'
            );

            // Assert — mailer was NOT invoked
            expect(mockMailer.sendVerificationEmail).not.toHaveBeenCalled();
        });

        it('should sign a JWT and call mailer.sendVerificationEmail when mailer is present', async () => {
            // Arrange
            mockMailer.sendVerificationEmail.mockClear();

            // Act
            await service.sendVerificationEmail(
                CONVERSATION_ID,
                'guest@example.com',
                'Guest',
                'Posada del Sol',
                'es'
            );

            // Assert — JWT signed and mailer invoked
            expect(jose.SignJWT).toHaveBeenCalledOnce();
            expect(mockMailer.sendVerificationEmail).toHaveBeenCalledOnce();
            expect(mockMailer.sendVerificationEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversationId: CONVERSATION_ID,
                    recipientEmail: 'guest@example.com',
                    guestName: 'Guest',
                    accommodationName: 'Posada del Sol',
                    locale: 'es'
                })
            );
        });
    });

    // =========================================================================
    // requestAccessByEmail (gap 5 — AC-004-04)
    // =========================================================================

    describe('requestAccessByEmail', () => {
        it('should generate token and call mailer.sendAccessLinkEmail when email matches a verified conversation', async () => {
            // Arrange
            const verifiedConv = makeConversation({
                id: CONVERSATION_ID,
                anonymousEmail: 'ana@example.com',
                anonymousName: 'Ana García',
                anonymousEmailVerified: true,
                locale: 'es',
                accommodationId: ACCOMMODATION_ID
            });

            const selectChain = makeSelectChainMock([verifiedConv]);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(accessTokenServiceMock.generateToken).mockResolvedValue({
                data: { rawToken: 'magic-token-32chars00000000000000' }
            });
            mockGetDb.mockReturnValue({ select: selectChain.select });

            // Act
            await service.requestAccessByEmail('ana@example.com');

            // Assert — access token generated and mailer called
            expect(accessTokenServiceMock.generateToken).toHaveBeenCalledOnce();
            expect(mockMailer.sendAccessLinkEmail).toHaveBeenCalledOnce();
            expect(mockMailer.sendAccessLinkEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversationId: CONVERSATION_ID,
                    recipientEmail: 'ana@example.com'
                })
            );
        });

        it('should NOT call mailer when no verified conversation is found (anti-enumeration)', async () => {
            // Arrange — empty result set
            const selectChain = makeSelectChainMock([]);
            mockGetDb.mockReturnValue({ select: selectChain.select });

            // Act
            await service.requestAccessByEmail('unknown@example.com');

            // Assert — mailer never invoked
            expect(mockMailer.sendAccessLinkEmail).not.toHaveBeenCalled();
            expect(accessTokenServiceMock.generateToken).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // getThread — ownership invariant (SPEC-206 write-IDOR regression)
    // =========================================================================

    describe('getThread', () => {
        it('should reject a non-owner BEFORE running any read-receipt side effect', async () => {
            // Arrange — conversation belongs to ACCOMMODATION_ID, but the owner
            // actor owns NO accommodations, so it is neither a guest nor an
            // owner participant.
            const foreignConversation = makeConversation({
                id: CONVERSATION_ID,
                accommodationId: ACCOMMODATION_ID,
                userId: null
            });
            asMock(conversationModelMock.findById).mockResolvedValue(foreignConversation);

            // Act — empty ownerAccommodationIds: this conversation is not the
            // actor's to read.
            const result = await service.getThread(
                OWNER_ACTOR,
                { conversationId: CONVERSATION_ID, actorSide: 'OWNER' },
                []
            );

            // Assert — rejected, and NONE of the side effects ran. This is the
            // core regression guard: a foreign conversationId must not mutate
            // lastReadAtByOwner nor cancel the legitimate owner's notifications.
            expectForbiddenError(result);
            expect(messageModelMock.findByConversationId).not.toHaveBeenCalled();
            expect(withServiceTransaction).not.toHaveBeenCalled();
            expect(notificationScheduleMock.cancelForRecipient).not.toHaveBeenCalled();
        });

        it('should return the thread and run side effects for the legitimate owner', async () => {
            // Arrange — owner owns ACCOMMODATION_ID, which the conversation
            // belongs to.
            const ownedConversation = makeConversation({
                id: CONVERSATION_ID,
                accommodationId: ACCOMMODATION_ID,
                userId: null
            });
            asMock(conversationModelMock.findById).mockResolvedValue(ownedConversation);
            asMock(messageModelMock.findByConversationId).mockResolvedValue([]);

            // Act
            const result = await service.getThread(
                OWNER_ACTOR,
                { conversationId: CONVERSATION_ID, actorSide: 'OWNER' },
                [ACCOMMODATION_ID]
            );

            // Assert — success and side effects executed exactly once.
            expectSuccess(result);
            expect(messageModelMock.findByConversationId).toHaveBeenCalledOnce();
            expect(withServiceTransaction).toHaveBeenCalledOnce();
            expect(notificationScheduleMock.cancelForRecipient).toHaveBeenCalledOnce();
        });

        it('keeps the most recent messages and returns them ascending (newest at bottom)', async () => {
            // Regression: the page must hold the LATEST messages, not the oldest.
            // The model returns rows newest-first; getThread keeps the newest
            // `limit` and reverses to ascending order for chat display.
            const ownedConversation = makeConversation({
                id: CONVERSATION_ID,
                accommodationId: ACCOMMODATION_ID,
                userId: null
            });
            asMock(conversationModelMock.findById).mockResolvedValue(ownedConversation);
            // limit=2 -> service requests 3; model returns 3 newest-first (m3,m2,m1).
            const msg = (n: number, iso: string) =>
                ({
                    id: `m${n}`,
                    conversationId: CONVERSATION_ID,
                    body: `msg ${n}`,
                    senderType: 'GUEST',
                    createdAt: new Date(iso)
                }) as unknown as Awaited<
                    ReturnType<typeof messageModelMock.findByConversationId>
                >[number];
            asMock(messageModelMock.findByConversationId).mockResolvedValue([
                msg(3, '2026-01-03T00:00:00Z'),
                msg(2, '2026-01-02T00:00:00Z'),
                msg(1, '2026-01-01T00:00:00Z')
            ]);

            const result = await service.getThread(
                OWNER_ACTOR,
                { conversationId: CONVERSATION_ID, actorSide: 'OWNER', limit: 2 },
                [ACCOMMODATION_ID]
            );

            expectSuccess(result);
            if (!result.data) throw new Error('expected thread data');
            // Newest two kept (m3, m2), reversed to ascending -> [m2, m3]; m1 dropped.
            expect(result.data.hasMore).toBe(true);
            expect(result.data.messages.map((m) => m.id)).toEqual(['m2', 'm3']);
        });
    });
});
