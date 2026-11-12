import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateObject } = vi.hoisted(() => ({ mockGenerateObject: vi.fn() }));
vi.mock('../../src/services/ai-service.factory.js', () => ({
    createConfiguredAiService: vi.fn(async () => ({ generateObject: mockGenerateObject }))
}));
vi.mock('../../src/services/ai-context/index.js', () => ({
    CHAT_CONTEXT_ASSEMBLERS: {
        accommodation: vi.fn(async () => ({
            contextBlock: 'Listing context: Wi-Fi is available.',
            systemMessage: 'Listing context: Wi-Fi is available.',
            entityName: 'Example'
        })),
        venue: vi.fn(async () => ({
            contextBlock: 'Venue context.',
            systemMessage: 'Venue context.',
            entityName: 'Venue'
        })),
        experience: vi.fn(async () => ({
            contextBlock: 'Experience context.',
            systemMessage: 'Experience context.',
            entityName: 'Experience'
        }))
    },
    truncateAtWord: (text: string | null | undefined, max: number) => (text ?? '').slice(0, max)
}));

import type { AiChatEntityType } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { AssembleChatContextInput } from '../../src/services/ai-context/types.js';
import { generateFaqDraft } from '../../src/services/ai-faq-draft.service.js';

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
const actor: Actor = { id: OWNER_ID, roles: [], permissions: [] };
const listingSections: AssembleChatContextInput['listingSections'] = new Map();

function context(question: string, entityType: AiChatEntityType = 'accommodation') {
    return {
        messageId: MESSAGE_ID,
        ownerId: OWNER_ID,
        businessLines: [],
        entityType,
        entityId: '11111111-1111-4111-8111-111111111111',
        question,
        answerStatus: null
    };
}

describe('FAQ answer draft generation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateObject.mockResolvedValue({
            object: { hasData: true, draft: '**Yes, Wi-Fi is available.**' },
            provider: 'stub',
            model: 'gpt-5.4-mini',
            usage: { promptTokens: 12, completionTokens: 8 }
        });
    });

    it('instructs the model to reply in the question language and removes markdown', async () => {
        // Arrange
        const input = {
            context: context('Where can I find the Wi-Fi and what is available?'),
            actor,
            locale: 'es' as const,
            listingSections
        };

        // Act
        const result = await generateFaqDraft(input);

        // Assert
        expect(mockGenerateObject.mock.calls[0]?.[0].systemPrompt).toContain('Reply in English');
        expect(result.response).toEqual({
            messageId: MESSAGE_ID,
            hasData: true,
            draft: 'Yes, Wi-Fi is available.'
        });
        expect(mockGenerateObject.mock.calls[0]?.[0]).toMatchObject({
            feature: 'faq_draft',
            params: { maxTokens: 1024, temperature: 0 }
        });
    });

    it('returns no draft for empty or unavailable model output', async () => {
        mockGenerateObject.mockResolvedValueOnce({
            object: { hasData: true, draft: '   ' },
            provider: 'stub',
            model: 'gpt-5.4-mini',
            usage: { promptTokens: 1, completionTokens: 1 }
        });
        const result = await generateFaqDraft({
            context: context('Is there Wi-Fi?'),
            actor,
            locale: 'en',
            listingSections
        });
        expect(result.response).toEqual({ messageId: MESSAGE_ID, hasData: false, draft: null });
    });

    it('propagates provider failures for the route to report and meter as errors', async () => {
        mockGenerateObject.mockRejectedValueOnce(new Error('provider unavailable'));
        await expect(
            generateFaqDraft({
                context: context('Is there Wi-Fi?'),
                actor,
                locale: 'en',
                listingSections
            })
        ).rejects.toThrow('provider unavailable');
    });
});
