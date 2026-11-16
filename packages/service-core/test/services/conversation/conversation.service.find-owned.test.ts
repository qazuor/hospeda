/**
 * @file conversation.service.find-owned.test.ts
 *
 * Unit tests for ConversationService.findOwnedConversation: own / foreign / missing.
 */

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        getDb: vi.fn(),
        AccommodationModel: vi.fn().mockImplementation(() => ({})),
        ConversationModel: vi.fn().mockImplementation(() => ({})),
        MessageModel: vi.fn().mockImplementation(() => ({}))
    };
});

import type { SelectConversation } from '@repo/db';
import * as dbModule from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { AccessTokenService } from '../../../src/services/conversation/access-token.service.js';
import { ConversationService } from '../../../src/services/conversation/conversation.service.js';
import type { MessageService } from '../../../src/services/conversation/message.service.js';
import type { NotificationScheduleService } from '../../../src/services/conversation/notification-schedule.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock } from '../../utils/modelMockFactory.js';

const OWNER = createActor({
    id: crypto.randomUUID(),
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
});
const CONVERSATION_ID = crypto.randomUUID();

/** Builds a drizzle-like chain whose `.limit()` resolves to `rows`. */
function makeSelectChain(rows: unknown[]) {
    const chain: Record<string, Mock> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue(rows);
    return chain;
}

describe('ConversationService.findOwnedConversation', () => {
    let service: ConversationService;
    let mockGetDb: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDb = dbModule.getDb as unknown as Mock;
        service = new ConversationService(
            { logger: createLoggerMock() },
            {
                authSecret: 'test-secret-must-be-at-least-32-chars-long!!',
                siteUrl: 'https://x.test'
            },
            {} as never,
            {} as never,
            {} as never,
            {} as AccessTokenService,
            {} as NotificationScheduleService,
            {} as MessageService
        );
    });

    it('returns the conversation when it belongs to one of the actor accommodations', async () => {
        // Arrange
        const row = { id: CONVERSATION_ID } as SelectConversation;
        mockGetDb.mockReturnValue(makeSelectChain([row]));

        // Act
        const result = await service.findOwnedConversation(OWNER, {
            conversationId: CONVERSATION_ID
        });

        // Assert
        expectSuccess(result);
        expect(result.data).toEqual(row);
    });

    it('returns null for a conversation of another owner', async () => {
        // Arrange (the ownership predicate filters it out in SQL)
        mockGetDb.mockReturnValue(makeSelectChain([]));

        // Act
        const result = await service.findOwnedConversation(OWNER, {
            conversationId: CONVERSATION_ID
        });

        // Assert
        expectSuccess(result);
        expect(result.data).toBeNull();
    });

    it('returns null for a missing conversation id', async () => {
        // Arrange
        mockGetDb.mockReturnValue(makeSelectChain([]));

        // Act
        const result = await service.findOwnedConversation(OWNER, {
            conversationId: crypto.randomUUID()
        });

        // Assert
        expectSuccess(result);
        expect(result.data).toBeNull();
    });
});
