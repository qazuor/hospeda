/**
 * Chat-answer classifier (HOS-2101).
 *
 * The three outcomes the owner's design relies on: an unanswered verdict is
 * written, an answered verdict is written, and any failure writes NOTHING (the
 * row stays unclassified) without throwing into the chat.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import {
    CLASSIFIER_MAX_OUTPUT_TOKENS,
    type ClassifyChatAnswerDeps,
    classifyChatAnswer,
    MAX_CLASSIFIER_INPUT_CHARS,
    parseClassifierVerdict,
    scheduleChatAnswerClassification
} from '../../src/services/ai-chat-answer-classifier';

const ASSISTANT_ID = '11111111-2222-4333-8444-555555555555';

function buildDeps(generate: ReturnType<typeof vi.fn>): {
    readonly deps: ClassifyChatAnswerDeps;
    readonly writeVerdict: ReturnType<typeof vi.fn>;
} {
    const writeVerdict = vi.fn().mockResolvedValue(undefined);
    return {
        deps: {
            createAiService: async () =>
                ({ generateText: generate }) as unknown as Awaited<
                    ReturnType<ClassifyChatAnswerDeps['createAiService']>
                >,
            writeVerdict
        },
        writeVerdict
    };
}

const baseInput = {
    assistantMessageId: ASSISTANT_ID,
    question: '¿Aceptan mascotas?',
    answer: 'Ese dato no está en la ficha. Te recomiendo consultar al anfitrión.',
    feature: 'chat' as const,
    locale: 'es' as const
};

describe('parseClassifierVerdict', () => {
    it.each([
        ['UNANSWERED', 'unanswered'],
        [' unanswered. ', 'unanswered'],
        ['ANSWERED', 'answered'],
        ['answered\n', 'answered']
    ] as const)('reads %j as %s', (text, verdict) => {
        expect(parseClassifierVerdict({ text }).verdict).toBe(verdict);
    });

    it.each(['', 'The reply answered it', 'MAYBE'])('reads %j as no verdict', (text) => {
        expect(parseClassifierVerdict({ text }).verdict).toBeNull();
    });
});

describe('classifyChatAnswer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes "unanswered" when the model says the fact is missing', async () => {
        // Arrange
        const generate = vi.fn().mockResolvedValue({ text: 'UNANSWERED' });
        const { deps, writeVerdict } = buildDeps(generate);

        // Act
        const result = await classifyChatAnswer({ ...baseInput, deps });

        // Assert
        expect(result.verdict).toBe('unanswered');
        expect(writeVerdict).toHaveBeenCalledWith({
            assistantMessageId: ASSISTANT_ID,
            verdict: 'unanswered'
        });
    });

    it('writes "answered" when the model says the reply gave the fact', async () => {
        const generate = vi.fn().mockResolvedValue({ text: 'ANSWERED' });
        const { deps, writeVerdict } = buildDeps(generate);

        const result = await classifyChatAnswer({
            ...baseInput,
            answer: 'Sí, se aceptan mascotas pequeñas.',
            deps
        });

        expect(result.verdict).toBe('answered');
        expect(writeVerdict).toHaveBeenCalledWith({
            assistantMessageId: ASSISTANT_ID,
            verdict: 'answered'
        });
    });

    it('calls the vertical chat feature with a capped, cheap request', async () => {
        const generate = vi.fn().mockResolvedValue({ text: 'ANSWERED' });
        const { deps } = buildDeps(generate);

        await classifyChatAnswer({
            ...baseInput,
            feature: 'chat_venue',
            answer: 'x'.repeat(MAX_CLASSIFIER_INPUT_CHARS * 3),
            deps
        });

        const request = generate.mock.calls[0]?.[0] as {
            feature: string;
            prompt: string;
            params: { maxTokens: number; temperature: number };
        };
        expect(request.feature).toBe('chat_venue');
        expect(request.params).toEqual({ maxTokens: CLASSIFIER_MAX_OUTPUT_TOKENS, temperature: 0 });
        // Question + answer are both clipped, so the prompt stays bounded.
        expect(request.prompt.length).toBeLessThan(MAX_CLASSIFIER_INPUT_CHARS * 2 + 100);
    });

    it('leaves the row unclassified when the provider fails, and does not throw', async () => {
        const generate = vi.fn().mockRejectedValue(new Error('provider down'));
        const { deps, writeVerdict } = buildDeps(generate);

        const result = await classifyChatAnswer({ ...baseInput, deps });

        expect(result.verdict).toBeNull();
        expect(writeVerdict).not.toHaveBeenCalled();
    });

    it('leaves the row unclassified on an unparseable output', async () => {
        const generate = vi.fn().mockResolvedValue({ text: '' });
        const { deps, writeVerdict } = buildDeps(generate);

        const result = await classifyChatAnswer({ ...baseInput, deps });

        expect(result.verdict).toBeNull();
        expect(writeVerdict).not.toHaveBeenCalled();
    });

    it('reports null when the verdict write itself fails', async () => {
        const generate = vi.fn().mockResolvedValue({ text: 'UNANSWERED' });
        const { deps, writeVerdict } = buildDeps(generate);
        writeVerdict.mockRejectedValue(new Error('db down'));

        await expect(classifyChatAnswer({ ...baseInput, deps })).resolves.toEqual({
            verdict: null
        });
    });
});

describe('scheduleChatAnswerClassification', () => {
    it('returns synchronously before the model answers', () => {
        // A generate that never settles: if the scheduler awaited it, this
        // test would hang instead of returning.
        const generate = vi.fn().mockReturnValue(new Promise(() => {}));
        const { deps } = buildDeps(generate);

        const returned = scheduleChatAnswerClassification({ ...baseInput, deps });

        expect(returned).toBeUndefined();
    });
});
