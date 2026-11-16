/**
 * `finalizeChatTurn` hands the persisted assistant row to the chat-answer
 * classifier (HOS-2101), and never for an empty answer (HOS-2095).
 */

import type { StreamTextFinalMeta } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPersist, mockSchedule, mockCaptureChatEvent } = vi.hoisted(() => ({
    mockPersist: vi.fn(),
    mockSchedule: vi.fn(),
    mockCaptureChatEvent: vi.fn()
}));

vi.mock('@repo/ai-core', () => ({ recordAiUsage: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../../src/services/ai-chat-persistence.js', () => ({
    persistChatTurn: mockPersist
}));
vi.mock('../../../../src/services/ai-chat-answer-classifier.js', () => ({
    scheduleChatAnswerClassification: mockSchedule
}));
vi.mock('../../../../src/utils/ai-rate-overrides.js', () => ({
    loadModelRateOverrides: vi.fn().mockResolvedValue({})
}));
vi.mock('../../../../src/routes/ai/protected/chat.helpers.js', () => ({
    captureChatEvent: mockCaptureChatEvent
}));

import { finalizeChatTurn } from '../../../../src/routes/ai/protected/chat.finalize';

const META: StreamTextFinalMeta = {
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    provider: 'openai',
    model: 'gpt-4o-mini',
    finishReason: 'stop'
};

function input(assistantText: string) {
    return {
        resolvedMeta: META,
        assistantText,
        feature: 'chat_venue' as const,
        entityType: 'venue' as const,
        entityId: '11111111-1111-4111-8111-111111111111',
        ownerId: '22222222-2222-4222-8222-222222222222',
        actorId: '33333333-3333-4333-8333-333333333333',
        locale: 'es' as never,
        conversationId: null,
        userMessage: '¿Hay estacionamiento?',
        handlerStartMs: Date.now()
    };
}

describe('finalizeChatTurn — answer classification (HOS-2101)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPersist.mockResolvedValue({
            conversationId: 'conv-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1'
        });
    });

    it('schedules the classifier on the persisted assistant row', async () => {
        // Act
        const out = await finalizeChatTurn(input('No figura en la ficha.'));

        // Assert
        expect(out.conversationId).toBe('conv-1');
        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule).toHaveBeenCalledWith({
            assistantMessageId: 'assistant-1',
            question: '¿Hay estacionamiento?',
            answer: 'No figura en la ficha.',
            feature: 'chat_venue',
            locale: 'es'
        });
    });

    it('neither persists nor classifies an empty answer', async () => {
        await finalizeChatTurn(input('   '));

        expect(mockPersist).not.toHaveBeenCalled();
        expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('does not classify when persistence fails', async () => {
        mockPersist.mockRejectedValue(new Error('db down'));

        const out = await finalizeChatTurn(input('Sí.'));

        expect(out.conversationId).toBeNull();
        expect(mockSchedule).not.toHaveBeenCalled();
    });
});

describe('finalizeChatTurn — visitor attribution (HOS-2119 T-072)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPersist.mockResolvedValue({
            conversationId: 'conv-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1'
        });
    });

    it('forwards the request-time visitor to ai_chat_response_completed', async () => {
        const visitor = { ip: '203.0.113.7', userAgent: 'UA/1' };

        await finalizeChatTurn({ ...input('Sí.'), visitor });

        expect(mockCaptureChatEvent).toHaveBeenCalledWith(
            '33333333-3333-4333-8333-333333333333',
            'ai_chat_response_completed',
            expect.objectContaining({ provider: 'openai' }),
            { visitor }
        );
    });

    it('forwards no visitor when none was captured', async () => {
        await finalizeChatTurn(input('Sí.'));

        expect(mockCaptureChatEvent.mock.calls[0]?.[3]).toEqual({ visitor: undefined });
    });
});
