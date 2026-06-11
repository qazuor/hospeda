/**
 * Tests for the `persistChatTurn` helper (SPEC-200 T-003).
 *
 * ## Coverage
 *
 * 1. **First turn (AC-3.1)** — `conversationId === null` → helper inserts
 *    one `aiConversations` row (with `feature='chat'`, `title=null`,
 *    `contextNote: '{"accommodationId":"..."}'`) AND two `aiMessages` rows
 *    (one `user`, one `assistant`). Returns the NEW conversation id.
 * 2. **Subsequent turn (AC-3.2)** — `conversationId` is a UUID → helper
 *    does NOT insert an `aiConversations` row. Inserts only two
 *    `aiMessages` rows against the existing conversation. Returns the
 *    INPUT conversation id (echoed back).
 * 3. **Title stays null (Q-R1)** — on first turn, the `aiConversations`
 *    insert values include `title: null` (NOT undefined, NOT empty string,
 *    NOT derived from message content).
 * 4. **DB failure (AC-3.3 / AC-14)** — when any insert throws, the helper
 *    logs `apiLogger.error` AND re-throws. Caller is responsible for
 *    swallowing (verified at the route integration level).
 *
 * ## Mocks
 *
 *   - `@repo/db` → `getDb` returns a fluent chain; `aiConversations` and
 *     `aiMessages` are simple marker objects so the test can assert which
 *     table each insert targeted.
 *   - `../../src/utils/logger` → `apiLogger.{error,warn,...}` are spies.
 *
 * @module test/services/ai-chat-persistence
 */

import type { StreamTextFinalMeta } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockInsert,
    mockValues,
    mockReturning,
    mockGetDb,
    mockAiConversations,
    mockAiMessages,
    mockApiLogger
} = vi.hoisted(() => {
    // Mock the Drizzle insert chain:
    //   db.insert(table).values({...}).returning({...}) → resolves to rows
    const mockReturning = vi.fn().mockResolvedValue([{ id: 'new-conv-uuid-from-mock' }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    const mockGetDb = vi.fn().mockReturnValue({ insert: mockInsert });

    // Marker objects so the test can assert which table the SUT inserted
    // against by reference identity (call order is also asserted).
    const mockAiConversations = { _tableName: 'aiConversations' };
    const mockAiMessages = { _tableName: 'aiMessages' };

    return {
        mockInsert,
        mockValues,
        mockReturning,
        mockGetDb,
        mockAiConversations,
        mockAiMessages,
        mockApiLogger: {
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        }
    };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    aiConversations: mockAiConversations,
    aiMessages: mockAiMessages
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { persistChatTurn } from '../../src/services/ai-chat-persistence';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACCOMMODATION_ID = '22222222-2222-4222-8222-222222222222';
const EXISTING_CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const USER_MESSAGE = '¿La cabaña tiene aire acondicionado?';
const ASSISTANT_MESSAGE = 'Sí, la cabaña cuenta con aire acondicionado y calefacción.';

const META: StreamTextFinalMeta = {
    usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
    provider: 'openai',
    model: 'gpt-4o-mini',
    finishReason: 'stop'
};

function makeInput(overrides: Partial<Parameters<typeof persistChatTurn>[0]> = {}) {
    return {
        userId: USER_ID,
        accommodationId: ACCOMMODATION_ID,
        conversationId: null,
        userMessage: USER_MESSAGE,
        assistantMessage: ASSISTANT_MESSAGE,
        meta: META,
        ...overrides
    };
}

/** Returns the `values()` argument passed to the Nth insert call. */
function nthValues(n: number): Record<string, unknown> {
    return mockValues.mock.calls[n]?.[0] as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('persistChatTurn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock return: a fresh id on every returning() call.
        mockReturning.mockResolvedValue([{ id: 'new-conv-uuid-from-mock' }]);
        mockValues.mockReturnValue({ returning: mockReturning });
        mockInsert.mockReturnValue({ values: mockValues });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Test 1 — First turn: aiConversations + 2 aiMessages
    // -----------------------------------------------------------------------
    it('should insert aiConversations + 2 aiMessages on first turn (AC-3.1)', async () => {
        const out = await persistChatTurn(makeInput({ conversationId: null }));

        // 3 inserts: 1 aiConversations, 2 aiMessages
        expect(mockInsert).toHaveBeenCalledTimes(3);
        expect(mockInsert.mock.calls[0]?.[0]).toBe(mockAiConversations);
        expect(mockInsert.mock.calls[1]?.[0]).toBe(mockAiMessages);
        expect(mockInsert.mock.calls[2]?.[0]).toBe(mockAiMessages);

        // aiConversations values (Q-R1 + D-4 invariants)
        const convValues = nthValues(0);
        expect(convValues.userId).toBe(USER_ID);
        expect(convValues.feature).toBe('chat');
        expect(convValues.title).toBeNull();
        expect(convValues.contextNote).toBe(JSON.stringify({ accommodationId: ACCOMMODATION_ID }));

        // User message values
        const userValues = nthValues(1);
        expect(userValues.role).toBe('user');
        expect(userValues.content).toBe(USER_MESSAGE);
        expect(userValues.provider).toBeNull();
        expect(userValues.tokens).toBe(0);
        // The conversationId on the user message should be the newly-created one
        // (NOT the input null).
        expect(userValues.conversationId).toBe('new-conv-uuid-from-mock');

        // Assistant message values
        const assistantValues = nthValues(2);
        expect(assistantValues.role).toBe('assistant');
        expect(assistantValues.content).toBe(ASSISTANT_MESSAGE);
        expect(assistantValues.provider).toBe('openai');
        expect(assistantValues.tokens).toBe(100); // meta.usage.completionTokens
        expect(assistantValues.conversationId).toBe('new-conv-uuid-from-mock');

        // Returned conversation id is the newly-created one
        expect(out).toEqual({ conversationId: 'new-conv-uuid-from-mock' });
    });

    // -----------------------------------------------------------------------
    // Test 2 — Subsequent turn: only 2 aiMessages, no aiConversations
    // -----------------------------------------------------------------------
    it('should insert only 2 aiMessages on subsequent turn (AC-3.2)', async () => {
        const out = await persistChatTurn(makeInput({ conversationId: EXISTING_CONVERSATION_ID }));

        // 2 inserts: NO aiConversations call, only 2 aiMessages
        expect(mockInsert).toHaveBeenCalledTimes(2);
        expect(mockInsert.mock.calls[0]?.[0]).toBe(mockAiMessages);
        expect(mockInsert.mock.calls[1]?.[0]).toBe(mockAiMessages);

        // Both messages use the EXISTING conversation id
        expect(nthValues(0).conversationId).toBe(EXISTING_CONVERSATION_ID);
        expect(nthValues(1).conversationId).toBe(EXISTING_CONVERSATION_ID);
        expect(nthValues(0).role).toBe('user');
        expect(nthValues(1).role).toBe('assistant');

        // Returned conversation id is the input (echoed back)
        expect(out).toEqual({ conversationId: EXISTING_CONVERSATION_ID });
    });

    // -----------------------------------------------------------------------
    // Test 3 — Title stays null on the new row (Q-R1)
    // -----------------------------------------------------------------------
    it('should set title to null on the new aiConversations row (Q-R1)', async () => {
        // Sanity: also verify that providing a long user message does NOT
        // influence the title (Q-R1 forbids auto-titling in V1).
        const longUserMessage = 'a'.repeat(2000);
        await persistChatTurn(makeInput({ userMessage: longUserMessage }));

        const convValues = nthValues(0);
        expect(convValues.title).toBeNull();
        // Defensive: title must NOT be derived from the user message content.
        expect(convValues.title).not.toBe(longUserMessage);
        expect(convValues.title).not.toBe(longUserMessage.slice(0, 255));
    });

    // -----------------------------------------------------------------------
    // Test 4 — DB failure: log apiLogger.error AND re-throw (AC-3.3 / AC-14)
    // -----------------------------------------------------------------------
    it('should log apiLogger.error and re-throw when the aiConversations insert fails (AC-14)', async () => {
        const dbError = new Error('connection refused');
        // Make the FIRST .values() call (the aiConversations insert) throw.
        // The SUT should log and re-throw; the subsequent aiMessages inserts
        // must NOT be attempted.
        mockValues.mockImplementationOnce(() => {
            throw dbError;
        });

        await expect(persistChatTurn(makeInput())).rejects.toThrow('connection refused');

        // apiLogger.error fired exactly once with structured context.
        // Since SPEC-212 T-007, persistChatTurn delegates to persistConversationTurn
        // which logs `feature` plus the opaque `contextNote` (carrying the
        // accommodationId for chat) for the conversation row error.
        expect(mockApiLogger.error).toHaveBeenCalledTimes(1);
        const [logPayload, logMessage] = mockApiLogger.error.mock.calls[0] ?? [];
        expect(logMessage).toContain('ai-chat-persistence');
        expect(logPayload).toMatchObject({
            userId: USER_ID,
            feature: 'chat',
            contextNote: JSON.stringify({ accommodationId: ACCOMMODATION_ID })
        });
        expect((logPayload as { error: string }).error).toContain('connection refused');

        // The aiMessages inserts must NOT have been attempted.
        // Only 1 insert call (the one that threw).
        expect(mockInsert).toHaveBeenCalledTimes(1);
        expect(mockInsert.mock.calls[0]?.[0]).toBe(mockAiConversations);
    });

    it('should log apiLogger.error and re-throw when the assistant aiMessages insert fails (AC-14)', async () => {
        const dbError = new Error('FK violation');
        // On a subsequent turn there is NO aiConversations insert.
        // First .values() (user aiMessages) succeeds.
        // Second .values() (assistant aiMessages) throws.
        // The SUT must log error AND re-throw; the assistant message insert
        // must NOT be attempted.
        mockValues.mockImplementationOnce(() => ({ returning: mockReturning }));
        mockValues.mockImplementationOnce(() => {
            throw dbError;
        });

        await expect(
            persistChatTurn(makeInput({ conversationId: EXISTING_CONVERSATION_ID }))
        ).rejects.toThrow('FK violation');

        expect(mockApiLogger.error).toHaveBeenCalledTimes(1);
        const [logPayload, logMessage] = mockApiLogger.error.mock.calls[0] ?? [];
        expect(logMessage).toContain('assistant aiMessages');
        expect((logPayload as { error: string }).error).toContain('FK violation');

        // 2 inserts attempted: user aiMessages + assistant aiMessages.
        expect(mockInsert).toHaveBeenCalledTimes(2);
    });
});
