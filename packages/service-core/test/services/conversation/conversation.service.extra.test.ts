/**
 * @file conversation.service.extra.test.ts
 *
 * Supplemental coverage for ConversationService methods that are not covered
 * in conversation.service.test.ts:
 *
 * - listForGuest: happy path, empty result
 * - listForOwner: happy path, empty accommodationIds short-circuit
 * - archive: GUEST side, OWNER side, not-found path
 * - getUnreadCount: GUEST side, OWNER side, empty accommodationIds short-circuit
 * - getHostResponseRate: permission gate, success path
 * - getHostMonthlyInquiries: permission gate, success path, months fill
 * - verifyEmailToken: NOT_FOUND after JWT decode
 * - initiateAnonymous: failed insert (null row) → INTERNAL_ERROR
 * - requestAccessByEmail: token error path, no mailer path, accommodation fetch error (non-fatal)
 * - sendVerificationEmail: mailer throws → error is caught and logged
 * - updateStatus: CLOSED path appends SYSTEM message, INTERNAL_ERROR when update returns nothing
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

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        getDb: vi.fn(),
        AccommodationModel: vi.fn().mockImplementation(() => ({
            findById: vi.fn(),
            findIdsByOwnerId: vi.fn()
        })),
        ConversationModel: vi.fn().mockImplementation(() => ({
            findById: vi.fn(),
            findByAnonymousEmailAndAccommodationId: vi.fn(),
            findByUserIdAndAccommodationId: vi.fn(),
            listByUserId: vi.fn(),
            listByAccommodationIds: vi.fn(),
            getResponseRateByOwnerId: vi.fn(),
            getMonthlyInquiriesByOwnerId: vi.fn()
        })),
        MessageModel: vi.fn().mockImplementation(() => ({
            findByConversationId: vi.fn()
        }))
    };
});

import * as dbModule from '@repo/db';
import { AccommodationModel, ConversationModel, MessageModel } from '@repo/db';
import type { SelectConversation } from '@repo/db';
import { ConversationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import * as jose from 'jose';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessTokenService } from '../../../src/services/conversation/access-token.service.js';
import { ConversationService } from '../../../src/services/conversation/conversation.service.js';
import type { MessageService } from '../../../src/services/conversation/message.service.js';
import type { NotificationScheduleService } from '../../../src/services/conversation/notification-schedule.service.js';
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

const HOST_ACTOR = createActor({
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
        status: 'PENDING_OWNER' as SelectConversation['status'],
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

/** Builds a chainable DB mock for the select → from → where pattern (no limit) */
function makeSelectChainMock(resolvedValue: unknown[]) {
    const whereMock = vi.fn().mockResolvedValue(resolvedValue);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    return { select: selectMock };
}

/** Builds a chainable DB mock for the select → from → where → limit pattern */
function makeSelectChainMockWithLimit(resolvedValue: unknown[]) {
    const limitMock = vi.fn().mockResolvedValue(resolvedValue);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    return { select: selectMock };
}

/** Builds a chainable DB mock for update → set → where → returning */
function makeUpdateChainMock(resolvedValue: unknown[]) {
    const returningMock = vi.fn().mockResolvedValue(resolvedValue);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    return { update: updateMock };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ConversationService (extra coverage)', () => {
    let service: ConversationService;
    let conversationModelMock: ConversationModel;
    let messageModelMock: MessageModel;
    let accommodationModelMock: AccommodationModel;
    let accessTokenServiceMock: AccessTokenService;
    let notificationScheduleMock: NotificationScheduleService;
    let messageServiceMock: MessageService;
    let mockGetDb: Mock;

    beforeEach(() => {
        conversationModelMock = createTypedModelMock(ConversationModel, [
            'findById',
            'findByAnonymousEmailAndAccommodationId',
            'findByUserIdAndAccommodationId',
            'listByUserId',
            'listByAccommodationIds',
            'getResponseRateByOwnerId',
            'getMonthlyInquiriesByOwnerId'
        ]);
        messageModelMock = createTypedModelMock(MessageModel, ['findByConversationId']);
        accommodationModelMock = createTypedModelMock(AccommodationModel, [
            'findById',
            'findIdsByOwnerId'
        ]);

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
            createMessage: vi.fn().mockResolvedValue({ data: { id: crypto.randomUUID() } }),
            createSystemMessage: vi.fn().mockResolvedValue({ data: { id: crypto.randomUUID() } })
        } as unknown as MessageService;

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
    // listForGuest
    // =========================================================================

    describe('listForGuest', () => {
        it('should return a paginated list of conversations for a guest', async () => {
            // Arrange
            const conversations = [
                makeConversation(),
                makeConversation({ id: crypto.randomUUID() })
            ];
            asMock(conversationModelMock.listByUserId).mockResolvedValue({
                items: conversations,
                total: 2
            });

            // Act
            const result = await service.listForGuest(ACTOR, {
                userId: ACTOR.id,
                page: 1,
                pageSize: 20
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.items).toHaveLength(2);
            expect(result.data?.total).toBe(2);
            expect(result.data?.page).toBe(1);
            expect(result.data?.pageSize).toBe(20);
        });

        it('should return empty list when no conversations exist', async () => {
            // Arrange
            asMock(conversationModelMock.listByUserId).mockResolvedValue({
                items: [],
                total: 0
            });

            // Act
            const result = await service.listForGuest(ACTOR, {
                userId: ACTOR.id
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.total).toBe(0);
        });

        it('should pass accommodationId filter when provided', async () => {
            // Arrange
            asMock(conversationModelMock.listByUserId).mockResolvedValue({
                items: [],
                total: 0
            });

            // Act
            await service.listForGuest(ACTOR, {
                userId: ACTOR.id,
                accommodationId: ACCOMMODATION_ID
            });

            // Assert
            expect(conversationModelMock.listByUserId).toHaveBeenCalledWith(
                ACTOR.id,
                expect.objectContaining({ accommodationId: ACCOMMODATION_ID })
            );
        });
    });

    // =========================================================================
    // listForOwner
    // =========================================================================

    describe('listForOwner', () => {
        it('should return paginated conversations for an owner', async () => {
            // Arrange
            const conversations = [makeConversation()];
            asMock(conversationModelMock.listByAccommodationIds).mockResolvedValue({
                items: conversations,
                total: 1
            });

            // Act
            const result = await service.listForOwner(ADMIN_ACTOR, {
                userId: ADMIN_ACTOR.id,
                accommodationIds: [ACCOMMODATION_ID],
                page: 1,
                pageSize: 20
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('should short-circuit and return empty when accommodationIds is empty', async () => {
            // Act
            const result = await service.listForOwner(ADMIN_ACTOR, {
                userId: ADMIN_ACTOR.id,
                accommodationIds: []
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.total).toBe(0);
            expect(conversationModelMock.listByAccommodationIds).not.toHaveBeenCalled();
        });

        it('should pass status and search filters when provided', async () => {
            // Arrange
            asMock(conversationModelMock.listByAccommodationIds).mockResolvedValue({
                items: [],
                total: 0
            });

            // Act
            await service.listForOwner(ADMIN_ACTOR, {
                userId: ADMIN_ACTOR.id,
                accommodationIds: [ACCOMMODATION_ID],
                status: 'OPEN',
                search: 'test'
            });

            // Assert
            expect(conversationModelMock.listByAccommodationIds).toHaveBeenCalledWith(
                [ACCOMMODATION_ID],
                expect.objectContaining({ status: 'OPEN', search: 'test' })
            );
        });
    });

    // =========================================================================
    // archive
    // =========================================================================

    describe('archive', () => {
        it('should archive a conversation for the GUEST side', async () => {
            // Arrange
            const updatedConv = makeConversation({ archivedByGuest: true });
            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue(updateChain);

            // Act
            const result = await service.archive(ACTOR, {
                conversationId: CONVERSATION_ID,
                side: 'GUEST',
                archived: true
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.archivedByGuest).toBe(true);
        });

        it('should archive a conversation for the OWNER side', async () => {
            // Arrange
            const updatedConv = makeConversation({ archivedByOwner: true });
            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue(updateChain);

            // Act
            const result = await service.archive(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID,
                side: 'OWNER',
                archived: true
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.archivedByOwner).toBe(true);
        });

        it('should return NOT_FOUND when update returns no row', async () => {
            // Arrange
            const updateChain = makeUpdateChainMock([]);
            mockGetDb.mockReturnValue(updateChain);

            // Act
            const result = await service.archive(ACTOR, {
                conversationId: CONVERSATION_ID,
                side: 'GUEST',
                archived: false
            });

            // Assert
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should un-archive a conversation when archived=false', async () => {
            // Arrange
            const updatedConv = makeConversation({ archivedByGuest: false });
            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue(updateChain);

            // Act
            const result = await service.archive(ACTOR, {
                conversationId: CONVERSATION_ID,
                side: 'GUEST',
                archived: false
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.archivedByGuest).toBe(false);
        });
    });

    // =========================================================================
    // getUnreadCount
    // =========================================================================

    describe('getUnreadCount', () => {
        it('should return unread count for GUEST side', async () => {
            // Arrange — two rows returned (two conversations with activity)
            const selectChain = makeSelectChainMock([
                { id: crypto.randomUUID() },
                { id: crypto.randomUUID() }
            ]);
            // getUnreadCount calls db.select().from().where() (no .limit())
            const db = {
                select: selectChain.select
            };
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await service.getUnreadCount(ACTOR, {
                actorId: ACTOR.id,
                actorSide: 'GUEST'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.count).toBe(2);
        });

        it('should return 0 for OWNER side when accommodationIds is empty', async () => {
            // Act
            const result = await service.getUnreadCount(ACTOR, {
                actorId: ACTOR.id,
                actorSide: 'OWNER',
                accommodationIds: []
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.count).toBe(0);
            // select() is NOT called for the DB query when accommodation list is empty
            // (early return before the query is built)
        });

        it('should return unread count for OWNER side with accommodation IDs', async () => {
            // Arrange
            const selectChain = makeSelectChainMock([{ id: CONVERSATION_ID }]);
            mockGetDb.mockReturnValue({ select: selectChain.select });

            // Act
            const result = await service.getUnreadCount(ACTOR, {
                actorId: ACTOR.id,
                actorSide: 'OWNER',
                accommodationIds: [ACCOMMODATION_ID]
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.count).toBe(1);
        });

        it('should return 0 for OWNER side when accommodationIds is absent', async () => {
            // Act — no accommodationIds provided
            const result = await service.getUnreadCount(ACTOR, {
                actorId: ACTOR.id,
                actorSide: 'OWNER'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.count).toBe(0);
        });
    });

    // =========================================================================
    // getHostResponseRate
    // =========================================================================

    describe('getHostResponseRate', () => {
        it('should throw FORBIDDEN when actor lacks CONVERSATION_VIEW_OWN', async () => {
            // Act
            const result = await service.getHostResponseRate(FORBIDDEN_ACTOR);

            // Assert
            expectForbiddenError(result);
        });

        it('should return response rate when actor has CONVERSATION_VIEW_OWN', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([ACCOMMODATION_ID]);
            asMock(conversationModelMock.getResponseRateByOwnerId).mockResolvedValue({
                responseRatePct: 85,
                avgResponseTimeMinutes: 120
            });

            // Act
            const result = await service.getHostResponseRate(HOST_ACTOR);

            // Assert
            expectSuccess(result);
            expect(result.data?.responseRatePct).toBe(85);
            expect(result.data?.avgResponseTimeMinutes).toBe(120);
        });

        it('should handle host with no accommodations gracefully', async () => {
            // Arrange — empty accommodationIds (brand-new host)
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);
            asMock(conversationModelMock.getResponseRateByOwnerId).mockResolvedValue({
                responseRatePct: 0,
                avgResponseTimeMinutes: null
            });

            // Act
            const result = await service.getHostResponseRate(HOST_ACTOR);

            // Assert
            expectSuccess(result);
            expect(result.data?.responseRatePct).toBe(0);
        });
    });

    // =========================================================================
    // getHostMonthlyInquiries
    // =========================================================================

    describe('getHostMonthlyInquiries', () => {
        it('should throw FORBIDDEN when actor lacks CONVERSATION_VIEW_OWN', async () => {
            // Act
            const result = await service.getHostMonthlyInquiries(FORBIDDEN_ACTOR, {});

            // Assert
            expectForbiddenError(result);
        });

        it('should return 6 months of data by default (fills missing months with 0)', async () => {
            // Arrange — model returns only one month of data
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([ACCOMMODATION_ID]);

            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const currentMonthKey = `${year}-${month}`;

            asMock(conversationModelMock.getMonthlyInquiriesByOwnerId).mockResolvedValue([
                { month: currentMonthKey, count: 5 }
            ]);

            // Act
            const result = await service.getHostMonthlyInquiries(HOST_ACTOR, {});

            // Assert
            expectSuccess(result);
            expect(result.data).toHaveLength(6);
            const currentEntry = result.data?.find((r) => r.month === currentMonthKey);
            expect(currentEntry?.count).toBe(5);
            // All other months should be 0 (filled)
            const otherMonths = result.data?.filter((r) => r.month !== currentMonthKey) ?? [];
            for (const m of otherMonths) {
                expect(m.count).toBe(0);
            }
        });

        it('should return N months when months is specified', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);
            asMock(conversationModelMock.getMonthlyInquiriesByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getHostMonthlyInquiries(HOST_ACTOR, { months: 3 });

            // Assert
            expectSuccess(result);
            expect(result.data).toHaveLength(3);
        });

        it('should pass accommodationIds to model', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([
                ACCOMMODATION_ID,
                crypto.randomUUID()
            ]);
            asMock(conversationModelMock.getMonthlyInquiriesByOwnerId).mockResolvedValue([]);

            // Act
            await service.getHostMonthlyInquiries(HOST_ACTOR, { months: 2 });

            // Assert
            expect(conversationModelMock.getMonthlyInquiriesByOwnerId).toHaveBeenCalledWith(
                expect.arrayContaining([ACCOMMODATION_ID]),
                2,
                undefined
            );
        });
    });

    // =========================================================================
    // verifyEmailToken — NOT_FOUND after valid JWT
    // =========================================================================

    describe('verifyEmailToken — conversation not found after valid JWT', () => {
        it('should return NOT_FOUND when JWT is valid but conversation is gone', async () => {
            // Arrange — JWT verifies OK but conversation is missing
            asMock(jose.jwtVerify).mockResolvedValue({
                payload: { conversationId: CONVERSATION_ID }
            });
            asMock(conversationModelMock.findById).mockResolvedValue(null);

            // Act
            const result = await service.verifyEmailToken(ACTOR, {
                verificationToken: 'valid.jwt.token'
            });

            // Assert
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    // =========================================================================
    // initiateAnonymous — failed insert → INTERNAL_ERROR
    // =========================================================================

    describe('initiateAnonymous — failed DB insert', () => {
        it('should return INTERNAL_ERROR when insert returns no row', async () => {
            // Arrange
            const accommodation = {
                id: ACCOMMODATION_ID,
                name: 'Posada del Sol',
                deletedAt: null
            };
            asMock(accommodationModelMock.findById).mockResolvedValue(accommodation);
            asMock(conversationModelMock.findByAnonymousEmailAndAccommodationId).mockResolvedValue(
                null
            );

            // select → no pending row
            const selectChain = makeSelectChainMock([]);
            // insert → returns empty (simulate failed insert)
            const insertReturningMock = vi.fn().mockResolvedValue([]);
            const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturningMock });
            const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

            mockGetDb.mockReturnValue({
                select: selectChain.select,
                insert: insertMock
            });

            // Act
            const result = await service.initiateAnonymous(ACTOR, {
                accommodationId: ACCOMMODATION_ID,
                guestName: 'Ana García',
                guestEmail: 'new@example.com',
                message: 'Primera vez que escribo'
            });

            // Assert
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });

    // =========================================================================
    // requestAccessByEmail — edge paths
    // =========================================================================

    describe('requestAccessByEmail — edge paths', () => {
        it('should silently return when access token generation fails', async () => {
            // Arrange — conversation found but token generation returns error
            const verifiedConv = makeConversation({
                anonymousEmailVerified: true,
                locale: 'es',
                accommodationId: ACCOMMODATION_ID
            });
            // requestAccessByEmail uses select().from().where().limit(1)
            const selectChain = makeSelectChainMockWithLimit([verifiedConv]);
            mockGetDb.mockReturnValue({ select: selectChain.select });

            asMock(accessTokenServiceMock.generateToken).mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'token gen failed' }
            });

            // Act — should NOT throw
            await expect(service.requestAccessByEmail('ana@example.com')).resolves.toBeUndefined();

            // Assert — mailer never called
            expect(mockMailer.sendAccessLinkEmail).not.toHaveBeenCalled();
        });

        it('should silently return when mailer is not configured', async () => {
            // Arrange — service without a mailer
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
                notificationScheduleMock,
                messageServiceMock
            );

            const verifiedConv = makeConversation({
                anonymousEmailVerified: true,
                locale: 'es'
            });
            const selectChain = makeSelectChainMockWithLimit([verifiedConv]);
            mockGetDb.mockReturnValue({ select: selectChain.select });

            asMock(accessTokenServiceMock.generateToken).mockResolvedValue({
                data: { rawToken: 'magic-token-32chars00000000000000' }
            });

            // Act — should NOT throw
            await expect(
                serviceNoMailer.requestAccessByEmail('ana@example.com')
            ).resolves.toBeUndefined();

            // Assert — the real mailer mock is never invoked
            expect(mockMailer.sendAccessLinkEmail).not.toHaveBeenCalled();
        });

        it('should use default accommodation name when findById throws', async () => {
            // Arrange — accommodation model throws (non-fatal path)
            const verifiedConv = makeConversation({
                anonymousEmailVerified: true,
                locale: 'es'
            });
            const selectChain = makeSelectChainMockWithLimit([verifiedConv]);
            mockGetDb.mockReturnValue({ select: selectChain.select });

            asMock(accessTokenServiceMock.generateToken).mockResolvedValue({
                data: { rawToken: 'magic-token-32chars00000000000000' }
            });
            asMock(accommodationModelMock.findById).mockRejectedValue(new Error('DB fail'));

            // Act — should NOT throw
            await expect(service.requestAccessByEmail('ana@example.com')).resolves.toBeUndefined();

            // Assert — mailer called with fallback accommodation name
            expect(mockMailer.sendAccessLinkEmail).toHaveBeenCalledOnce();
            expect(mockMailer.sendAccessLinkEmail).toHaveBeenCalledWith(
                expect.objectContaining({ accommodationName: 'Alojamiento' })
            );
        });
    });

    // =========================================================================
    // sendVerificationEmail — mailer throws
    // =========================================================================

    describe('sendVerificationEmail — mailer error is swallowed', () => {
        it('should catch and log when mailer.sendVerificationEmail throws', async () => {
            // Arrange — mailer throws
            mockMailer.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP failure'));

            // Act — should NOT throw
            await expect(
                service.sendVerificationEmail(
                    CONVERSATION_ID,
                    'guest@example.com',
                    'Guest',
                    'Posada del Sol',
                    'en'
                )
            ).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // updateStatus — CLOSED appends SYSTEM message; INTERNAL_ERROR when no row
    // =========================================================================

    describe('updateStatus — extra paths', () => {
        it('should append a SYSTEM message on OPEN → CLOSED transition', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'OPEN' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const updatedConv = makeConversation({ status: 'CLOSED', closedAt: new Date() });
            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue(updateChain);

            asMock(messageServiceMock.createSystemMessage).mockResolvedValue({
                data: { id: crypto.randomUUID() }
            });

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
            expect(messageServiceMock.createSystemMessage).toHaveBeenCalledOnce();
            expect(messageServiceMock.createSystemMessage).toHaveBeenCalledWith(
                expect.objectContaining({ _isSystemActor: true }),
                expect.objectContaining({
                    conversationId: CONVERSATION_ID,
                    body: 'Conversation closed.'
                })
            );
        });

        it('should NOT block CLOSED transition when SYSTEM message insertion fails', async () => {
            // Arrange — createSystemMessage throws but the status change must still succeed
            const conversation = makeConversation({ status: 'OPEN' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const updatedConv = makeConversation({ status: 'CLOSED' });
            const updateChain = makeUpdateChainMock([updatedConv]);
            mockGetDb.mockReturnValue(updateChain);

            asMock(messageServiceMock.createSystemMessage).mockRejectedValue(
                new Error('Message insert failed')
            );

            // Act
            const result = await service.updateStatus(
                ADMIN_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    status: ConversationStatusEnum.CLOSED
                },
                []
            );

            // Assert — status change still succeeds despite message failure
            expectSuccess(result);
            expect(result.data?.status).toBe('CLOSED');
        });

        it('should return INTERNAL_ERROR when update returns no row', async () => {
            // Arrange
            const conversation = makeConversation({ status: 'PENDING_OWNER' });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);

            const updateChain = makeUpdateChainMock([]);
            mockGetDb.mockReturnValue(updateChain);

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
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should throw NOT_FOUND when conversation is missing in updateStatus', async () => {
            // Arrange
            asMock(conversationModelMock.findById).mockResolvedValue(null);

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
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });
});
