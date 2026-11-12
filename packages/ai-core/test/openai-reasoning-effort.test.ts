import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const sdk = vi.hoisted(() => ({
    generateText: vi.fn(),
    streamText: vi.fn(),
    generateObject: vi.fn(),
    createOpenAI: vi.fn()
}));

vi.mock('ai', () => ({
    generateText: sdk.generateText,
    streamText: sdk.streamText,
    generateObject: sdk.generateObject,
    zodSchema: (schema: unknown) => schema
}));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: sdk.createOpenAI }));

import { OpenAiAdapter } from '../src/providers/vercel-openai.adapter.js';

const usage = { inputTokens: 2, outputTokens: 1 };

describe('OpenAI reasoning effort plumbing', () => {
    it('adds providerOptions only when effort is configured for generateText', async () => {
        const model = vi.fn((modelId: string) => ({ modelId }));
        Object.assign(model, { chat: vi.fn((modelId: string) => ({ modelId })) });
        sdk.createOpenAI.mockReturnValue(model);
        sdk.generateText.mockResolvedValue({ text: 'answer', usage, finishReason: 'stop' });
        const adapter = new OpenAiAdapter({ apiKey: 'test-key' });

        await adapter.generateText({ feature: 'text_improve', prompt: 'test' });
        await adapter.generateText({
            feature: 'chat_venue',
            prompt: 'test',
            params: { reasoningEffort: 'low' }
        });

        expect(sdk.generateText.mock.calls[0]?.[0]).not.toHaveProperty('providerOptions');
        expect(sdk.generateText.mock.calls[1]?.[0]).toMatchObject({
            providerOptions: { openai: { reasoningEffort: 'low' } }
        });
    });

    it('passes configured effort to streamText', async () => {
        const model = vi.fn((modelId: string) => ({ modelId }));
        Object.assign(model, { chat: vi.fn((modelId: string) => ({ modelId })) });
        sdk.createOpenAI.mockReturnValue(model);
        sdk.streamText.mockReturnValue({
            textStream: (async function* () {
                yield 'answer';
            })(),
            usage: Promise.resolve(usage),
            finishReason: Promise.resolve('stop')
        });
        const adapter = new OpenAiAdapter({ apiKey: 'test-key' });

        const result = await adapter.streamText({
            feature: 'chat_venue',
            prompt: 'test',
            params: { reasoningEffort: 'low' }
        });
        for await (const _chunk of result.stream) {
            /* drain */
        }
        await result.meta;

        expect(sdk.streamText.mock.calls[0]?.[0]).toMatchObject({
            providerOptions: { openai: { reasoningEffort: 'low' } }
        });
    });

    it('passes configured effort to generateObject', async () => {
        const model = vi.fn((modelId: string) => ({ modelId }));
        Object.assign(model, { chat: vi.fn((modelId: string) => ({ modelId })) });
        sdk.createOpenAI.mockReturnValue(model);
        sdk.generateObject.mockResolvedValue({ object: { ok: true }, usage, finishReason: 'stop' });
        const adapter = new OpenAiAdapter({ apiKey: 'test-key' });

        await adapter.generateObject(
            { feature: 'text_improve', prompt: 'test', params: { reasoningEffort: 'low' } },
            z.object({ ok: z.boolean() })
        );

        expect(sdk.generateObject.mock.calls[0]?.[0]).toMatchObject({
            providerOptions: { openai: { reasoningEffort: 'low' } }
        });
    });
});
