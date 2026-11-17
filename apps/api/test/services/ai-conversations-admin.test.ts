/**
 * Pure mapping of the staff conversation read (HOS-2075): anonymity and redaction.
 */
import { aiConversations } from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it, vi } from 'vitest';

// The global setup mocks @repo/db; this test needs the real table definitions.
vi.mock('@repo/db', async () => ({
    ...(await import('../../../../packages/db/src/schemas/ai/ai_conversations.dbschema.ts')),
    ...(await import('../../../../packages/db/src/schemas/ai/ai_messages.dbschema.ts')),
    getDb: vi.fn()
}));

import {
    AI_CONVERSATION_PREVIEW_MAX,
    buildConversationListSelect,
    toConversationDetail,
    toConversationListItems
} from '../../src/services/ai-conversations-admin.service.js';

const ID = '33333333-3333-4333-8333-333333333333';
const LISTING = '11111111-1111-4111-8111-111111111111';

describe('toConversationListItems', () => {
    it('redacts the preview, truncates it and builds exact keys', () => {
        const long = `juan@mail.com ${'a'.repeat(500)}`;
        const [item] = toConversationListItems({
            rows: [
                {
                    id: ID,
                    entityType: 'venue',
                    entityId: LISTING,
                    startedAt: new Date('2026-11-09T12:00:00.000Z'),
                    lastMessageAt: '2026-11-09T12:05:00.000Z',
                    messageCount: '4',
                    firstQuestion: long,
                    // A column leaked from a wider query must not reach the response.
                    ...({ userId: 'secret-user' } as object)
                }
            ]
        });

        expect(Object.keys(item ?? {}).sort()).toEqual(
            [
                'entityId',
                'entityType',
                'firstQuestion',
                'id',
                'lastMessageAt',
                'messageCount',
                'startedAt'
            ].sort()
        );
        expect(item?.messageCount).toBe(4);
        expect(item?.firstQuestion.startsWith('[REDACTED_EMAIL]')).toBe(true);
        expect(item?.firstQuestion.length).toBeLessThanOrEqual(AI_CONVERSATION_PREVIEW_MAX);
        expect(JSON.stringify(item)).not.toContain('secret-user');
    });

    it('treats a conversation without a user turn as an empty preview', () => {
        const [item] = toConversationListItems({
            rows: [
                {
                    id: ID,
                    entityType: 'venue',
                    entityId: LISTING,
                    startedAt: new Date(),
                    lastMessageAt: new Date(),
                    messageCount: 0,
                    firstQuestion: null
                }
            ]
        });
        expect(item?.firstQuestion).toBe('');
    });
});

describe('toConversationDetail', () => {
    it('keeps the incoming chronological order, redacting user turns only', () => {
        const detail = toConversationDetail({
            id: ID,
            entityType: 'accommodation',
            entityId: LISTING,
            startedAt: new Date('2026-11-09T12:00:00.000Z'),
            turns: [
                {
                    id: 'a',
                    role: 'user',
                    content: 'mi cel +54 9 3442 123456',
                    createdAt: new Date('2026-11-09T12:00:00.000Z')
                },
                {
                    id: 'b',
                    role: 'assistant',
                    content: 'Te escribo a juan@mail.com o al +54 9 3442 123456',
                    createdAt: '2026-11-09T12:00:05.000Z'
                }
            ]
        });

        expect(detail.turns.map((turn) => turn.id)).toEqual(['a', 'b']);
        expect(detail.turns[0]?.content).toBe('mi cel [REDACTED_PHONE]');
        expect(detail.turns[1]?.content).toBe('Te escribo a juan@mail.com o al +54 9 3442 123456');
        expect(Object.keys(detail).sort()).toEqual(
            ['entityId', 'entityType', 'id', 'startedAt', 'turns'].sort()
        );
    });
});

describe('buildConversationListSelect (HOS-2319)', () => {
    it('correlates the message subqueries to the OUTER conversation id', () => {
        // Arrange
        const db = drizzle.mock();

        // Act
        const { sql: text } = db
            .select(buildConversationListSelect())
            .from(aiConversations)
            .toSQL();

        // Assert: a bare "id" would resolve to the inner ai_messages.id.
        const correlations = text.match(/m\.conversation_id = ([^ )]+)/g) ?? [];
        expect(correlations).toHaveLength(3);
        for (const c of correlations) {
            expect(c).toBe('m.conversation_id = "ai_conversations".id');
        }
    });
});
