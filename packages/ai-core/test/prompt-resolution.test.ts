/**
 * Tests for the system-prompt resolution layer (SPEC-173 T-034, AC-12).
 *
 * ## Coverage
 *
 * **resolveSystemPrompt:**
 *  - Active admin prompt used (source 'admin').
 *  - content null → default (AC-12).
 *  - content '   ' whitespace-only → default (AC-12).
 *  - Cache hit: storage called once for two resolves within TTL.
 *  - invalidatePromptCache(feature) forces re-read on next call.
 *  - invalidatePromptCache() (full clear) forces re-read for all features.
 *
 * **Engine integration (generateText, streamText, generateObject):**
 *  - generateText with prompt-only request → provider receives messages with
 *    injected system message first + user message.
 *  - Request with caller-supplied system message → passed through UNCHANGED
 *    (caller-wins policy).
 *  - streamText also receives injected system message.
 *  - generateObject receives system content prepended to the prompt string.
 *
 * **DEFAULT_PROMPTS exhaustiveness:**
 *  - DEFAULT_PROMPTS has an entry for every AiFeature member.
 *
 * The storage layer (`getActivePrompt`) is stubbed entirely via `vi.mock` so no
 * real database connection is required.  Engine tests use `StubProvider` and
 * mock the config resolver (same pattern as engine.test.ts).
 *
 * @module test/prompt-resolution
 */

import type { AiFeatureConfig, AiMessage } from '@repo/schemas';
import { AiFeatureSchema } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock storage.prompt BEFORE importing modules under test
// ---------------------------------------------------------------------------

vi.mock('../src/storage/prompt.storage.js', () => ({
    getActivePrompt: vi.fn()
}));

import * as promptStorageModule from '../src/storage/prompt.storage.js';

const mockGetActivePrompt = promptStorageModule.getActivePrompt as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock the config resolver — no DB required (mirrors engine.test.ts)
// ---------------------------------------------------------------------------

vi.mock('../src/config/resolver.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/config/resolver.js')>();
    return {
        ...original,
        resolveConfig: vi.fn(),
        resolveFeatureConfig: vi.fn(),
        getProviderOrder: vi.fn(),
        isFeatureKillSwitched: vi.fn()
    };
});

import * as configResolver from '../src/config/resolver.js';

const mockResolveConfig = configResolver.resolveConfig as ReturnType<typeof vi.fn>;
const mockResolveFeatureConfig = configResolver.resolveFeatureConfig as ReturnType<typeof vi.fn>;
const mockIsFeatureKillSwitched = configResolver.isFeatureKillSwitched as ReturnType<typeof vi.fn>;
const mockGetProviderOrder = configResolver.getProviderOrder as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
    composeSystemPrompt,
    invalidatePromptCache,
    resolveSystemPrompt
} from '../src/config/prompt-resolver.js';
import { DEFAULT_PROMPTS, DEFAULT_RULES } from '../src/engine/default-prompts.js';
import { createAiEngine } from '../src/engine/engine.js';
import type { AiProvider } from '../src/providers/ai-provider.interface.js';
import { StubProvider } from '../src/providers/index.js';

// ---------------------------------------------------------------------------
// Shared engine config fixture (matches engine.test.ts pattern)
// ---------------------------------------------------------------------------

const FEATURE_CONFIG_ENABLED: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'stub',
    fallbackChain: [],
    model: 'stub-model-v1',
    params: {}
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    // Reset prompt cache between tests so they are independent.
    invalidatePromptCache();

    // Default config mock setup — mirrors engine.test.ts beforeEach.
    mockResolveConfig.mockResolvedValue({ providers: {}, features: {} });
    mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_ENABLED);
    mockIsFeatureKillSwitched.mockImplementation((cfg: AiFeatureConfig) => !cfg.enabled);
    mockGetProviderOrder.mockImplementation(
        ({ featureConfig }: { featureConfig: AiFeatureConfig }) => ({
            providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
        })
    );
});

// ---------------------------------------------------------------------------
// resolveSystemPrompt — admin prompt used
// ---------------------------------------------------------------------------

describe('resolveSystemPrompt', () => {
    describe('when an active admin prompt exists', () => {
        it('should return the admin content with source "admin"', async () => {
            // Arrange
            mockGetActivePrompt.mockResolvedValue({
                content: 'Custom admin system prompt.',
                row: { id: 'row-1', feature: 'text_improve', isActive: true }
            });

            // Act
            const result = await resolveSystemPrompt({ feature: 'text_improve' });

            // Assert
            expect(result.content).toBe('Custom admin system prompt.');
            expect(result.source).toBe('admin');
        });
    });

    // -------------------------------------------------------------------------
    // AC-12: null content → default fallback
    // -------------------------------------------------------------------------

    describe('when getActivePrompt returns content: null (AC-12)', () => {
        it('should return the in-code default with source "default"', async () => {
            // Arrange
            mockGetActivePrompt.mockResolvedValue({ content: null, row: null });

            // Act
            const result = await resolveSystemPrompt({ feature: 'chat' });

            // Assert
            expect(result.source).toBe('default');
            expect(result.content).toBe(DEFAULT_PROMPTS.chat);
            expect(result.content.length).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // AC-12: blank/whitespace-only content → default fallback
    // -------------------------------------------------------------------------

    describe('when getActivePrompt returns whitespace-only content (AC-12)', () => {
        it('should fall back to the in-code default with source "default"', async () => {
            // Arrange
            mockGetActivePrompt.mockResolvedValue({
                content: '   ',
                row: { id: 'row-2', feature: 'search', isActive: true }
            });

            // Act
            const result = await resolveSystemPrompt({ feature: 'search' });

            // Assert
            expect(result.source).toBe('default');
            expect(result.content).toBe(DEFAULT_PROMPTS.search);
        });

        it('should also fall back for tab-and-newline-only content', async () => {
            // Arrange
            mockGetActivePrompt.mockResolvedValue({ content: '\t\n  \r\n', row: null });

            // Act
            const result = await resolveSystemPrompt({ feature: 'support' });

            // Assert
            expect(result.source).toBe('default');
            expect(result.content).toBe(DEFAULT_PROMPTS.support);
        });
    });

    // -------------------------------------------------------------------------
    // Cache: storage called once for two resolves within TTL
    // -------------------------------------------------------------------------

    describe('cache behaviour', () => {
        it('should call storage only once when resolved twice within TTL', async () => {
            // Arrange
            mockGetActivePrompt.mockResolvedValue({
                content: 'Cached admin prompt.',
                row: { id: 'row-3', feature: 'text_improve', isActive: true }
            });

            // Act
            const first = await resolveSystemPrompt({ feature: 'text_improve' });
            const second = await resolveSystemPrompt({ feature: 'text_improve' });

            // Assert
            expect(mockGetActivePrompt).toHaveBeenCalledOnce();
            expect(first.content).toBe('Cached admin prompt.');
            expect(second.content).toBe('Cached admin prompt.');
            expect(first.source).toBe('admin');
            expect(second.source).toBe('admin');
        });

        it('should call storage once and cache the default for a null-content response', async () => {
            // Arrange
            mockGetActivePrompt.mockResolvedValue({ content: null, row: null });

            // Act
            await resolveSystemPrompt({ feature: 'chat' });
            await resolveSystemPrompt({ feature: 'chat' });

            // Assert — storage called once; second call hit cache
            expect(mockGetActivePrompt).toHaveBeenCalledOnce();
        });
    });

    // -------------------------------------------------------------------------
    // invalidatePromptCache(feature) forces re-read
    // -------------------------------------------------------------------------

    describe('invalidatePromptCache(feature)', () => {
        it('should force re-read on the next resolve after feature invalidation', async () => {
            // Arrange
            mockGetActivePrompt.mockResolvedValue({
                content: 'First prompt.',
                row: { id: 'row-4', feature: 'text_improve', isActive: true }
            });

            // Act — first resolve populates cache
            const first = await resolveSystemPrompt({ feature: 'text_improve' });

            // Invalidate the specific feature
            invalidatePromptCache('text_improve');

            // Storage now returns a different prompt
            mockGetActivePrompt.mockResolvedValue({
                content: 'Updated prompt.',
                row: { id: 'row-5', feature: 'text_improve', isActive: true }
            });

            const second = await resolveSystemPrompt({ feature: 'text_improve' });

            // Assert — storage called twice (before and after invalidation)
            expect(mockGetActivePrompt).toHaveBeenCalledTimes(2);
            expect(first.content).toBe('First prompt.');
            expect(second.content).toBe('Updated prompt.');
        });

        it('should NOT invalidate other features when a specific feature is cleared', async () => {
            // Arrange — resolve both features
            mockGetActivePrompt.mockResolvedValue({
                content: 'Chat prompt.',
                row: { id: 'row-6', feature: 'chat', isActive: true }
            });
            await resolveSystemPrompt({ feature: 'chat' });

            mockGetActivePrompt.mockResolvedValue({
                content: 'Search prompt.',
                row: { id: 'row-7', feature: 'search', isActive: true }
            });
            await resolveSystemPrompt({ feature: 'search' });

            // Reset call count for the assertion
            mockGetActivePrompt.mockClear();

            // Invalidate only 'chat'
            invalidatePromptCache('chat');

            mockGetActivePrompt.mockResolvedValue({
                content: 'Chat prompt.',
                row: { id: 'row-6', feature: 'chat', isActive: true }
            });

            // Re-resolve both
            await resolveSystemPrompt({ feature: 'chat' }); // miss → storage call
            await resolveSystemPrompt({ feature: 'search' }); // hit → no storage call

            // Assert — storage called once (only for chat)
            expect(mockGetActivePrompt).toHaveBeenCalledOnce();
        });
    });

    // -------------------------------------------------------------------------
    // invalidatePromptCache() (no-arg) clears all features
    // -------------------------------------------------------------------------

    describe('invalidatePromptCache() (full clear)', () => {
        it('should force re-read for all features after a full clear', async () => {
            // Arrange — prime cache for two features
            mockGetActivePrompt.mockResolvedValue({ content: 'Prompt A.', row: null });
            await resolveSystemPrompt({ feature: 'chat' });
            await resolveSystemPrompt({ feature: 'search' });

            mockGetActivePrompt.mockClear();

            // Full clear
            invalidatePromptCache();

            mockGetActivePrompt.mockResolvedValue({ content: 'Prompt A.', row: null });

            // Re-resolve both
            await resolveSystemPrompt({ feature: 'chat' });
            await resolveSystemPrompt({ feature: 'search' });

            // Assert — storage called for each feature after clear
            expect(mockGetActivePrompt).toHaveBeenCalledTimes(2);
        });
    });

    // -------------------------------------------------------------------------
    // F4: storage throws → default returned, cache NOT poisoned (AC-12 spirit)
    // -------------------------------------------------------------------------

    describe('storage error resilience (F4 — AC-12 spirit)', () => {
        it('should return the in-code default with source "default" when storage throws', async () => {
            // Arrange — storage rejects (e.g. DB connection error)
            mockGetActivePrompt.mockRejectedValue(new Error('DB connection lost'));

            // Act
            const result = await resolveSystemPrompt({ feature: 'text_improve' });

            // Assert
            expect(result.source).toBe('default');
            expect(result.content).toBe(DEFAULT_PROMPTS.text_improve);
            expect(result.content.length).toBeGreaterThan(0);
        });

        it('should NOT cache the failure — a subsequent successful read returns admin content', async () => {
            // Arrange — first call: storage rejects
            mockGetActivePrompt.mockRejectedValueOnce(new Error('DB unavailable'));

            // Act — first call: error → default
            const first = await resolveSystemPrompt({ feature: 'chat' });
            expect(first.source).toBe('default');

            // Arrange — DB recovers, admin prompt now available
            mockGetActivePrompt.mockResolvedValueOnce({
                content: 'Recovered admin prompt.',
                row: { id: 'row-recovered', feature: 'chat', isActive: true }
            });

            // Act — second call: storage succeeds → admin content
            const second = await resolveSystemPrompt({ feature: 'chat' });

            // Assert — no poisoned cache; admin content served after recovery
            expect(second.source).toBe('admin');
            expect(second.content).toBe('Recovered admin prompt.');
            // Storage was called twice (no caching of the error result)
            expect(mockGetActivePrompt).toHaveBeenCalledTimes(2);
        });
    });
});

// ---------------------------------------------------------------------------
// DEFAULT_PROMPTS exhaustiveness
// ---------------------------------------------------------------------------

describe('DEFAULT_PROMPTS', () => {
    it('should have a non-empty entry for every AiFeature', () => {
        // AiFeatureSchema.options contains every valid feature string.
        const allFeatures = AiFeatureSchema.options;

        for (const feature of allFeatures) {
            const prompt = DEFAULT_PROMPTS[feature];
            expect(prompt, `DEFAULT_PROMPTS['${feature}'] is missing or empty`).toBeDefined();
            expect(prompt.length, `DEFAULT_PROMPTS['${feature}'] is empty`).toBeGreaterThan(0);
        }
    });

    it('should instruct the model to respond in the user locale (R-3 check)', () => {
        const allFeatures = AiFeatureSchema.options;
        for (const feature of allFeatures) {
            const composed = composeSystemPrompt({
                content: DEFAULT_PROMPTS[feature],
                rules: DEFAULT_RULES[feature]
            });
            expect(
                composed.toLowerCase(),
                `DEFAULT_PROMPTS['${feature}'] missing locale instruction`
            ).toMatch(/language|locale/i);
        }
    });

    it('should contain a refusal / off-topic instruction (R-3 check)', () => {
        const allFeatures = AiFeatureSchema.options;
        for (const feature of allFeatures) {
            const composed = composeSystemPrompt({
                content: DEFAULT_PROMPTS[feature],
                rules: DEFAULT_RULES[feature]
            });
            expect(
                composed.toLowerCase(),
                `DEFAULT_PROMPTS['${feature}'] missing refusal instruction`
            ).toMatch(
                /refus|declin|off-topic|outside your role|outside your|outside the scope|must not/i
            );
        }
    });
});

// ---------------------------------------------------------------------------
// Engine integration: generateText with prompt-only request
// ---------------------------------------------------------------------------

describe('engine integration — generateText', () => {
    it('should inject a system message when the caller supplies only a prompt', async () => {
        // Arrange
        const capturedMessages: AiMessage[][] = [];
        const spyProvider: AiProvider = {
            id: 'stub',
            generateText: vi.fn().mockImplementation((req) => {
                if (req.messages !== undefined) {
                    capturedMessages.push([...req.messages]);
                }
                return Promise.resolve({
                    text: 'ok',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                    provider: 'stub',
                    model: 'stub-model-v1',
                    finishReason: 'stop'
                });
            }),
            streamText: vi.fn(),
            generateObject: vi.fn(),
            extractIntent: vi.fn(),
            moderate: vi.fn().mockResolvedValue({ flagged: false, categories: {} }),
            embed: vi.fn()
        };

        mockGetActivePrompt.mockResolvedValue({
            content: 'System: you are a helpful assistant.',
            row: { id: 'row-engine', feature: 'text_improve', isActive: true }
        });

        const engine = createAiEngine({ getProvider: () => spyProvider });

        // Act
        await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Improve this text'
        });

        // Assert — provider received messages, not prompt.
        // The engine composes content + "\n\n" + rules; since the mock row has no
        // `rules` field (null), the resolver falls back to DEFAULT_RULES.text_improve.
        expect(capturedMessages).toHaveLength(1);
        const messages = capturedMessages[0];
        expect(messages).toBeDefined();
        expect(messages?.[0]?.role).toBe('system');
        expect(messages?.[0]?.content).toBe(
            composeSystemPrompt({
                content: 'System: you are a helpful assistant.',
                rules: DEFAULT_RULES.text_improve
            })
        );
        expect(messages?.[1]?.role).toBe('user');
        expect(messages?.[1]?.content).toBe('Improve this text');
    });

    it('should pass request through UNCHANGED when caller already supplies a system message (caller-wins)', async () => {
        // Arrange
        const capturedRequests: unknown[] = [];
        const spyProvider: AiProvider = {
            id: 'stub',
            generateText: vi.fn().mockImplementation((req) => {
                capturedRequests.push(req);
                return Promise.resolve({
                    text: 'ok',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                    provider: 'stub',
                    model: 'stub-model-v1',
                    finishReason: 'stop'
                });
            }),
            streamText: vi.fn(),
            generateObject: vi.fn(),
            extractIntent: vi.fn(),
            moderate: vi.fn().mockResolvedValue({ flagged: false, categories: {} }),
            embed: vi.fn()
        };

        mockGetActivePrompt.mockResolvedValue({ content: 'Admin prompt.', row: null });

        const engine = createAiEngine({ getProvider: () => spyProvider });

        const callerMessages: AiMessage[] = [
            { role: 'system', content: 'My custom system prompt.' },
            { role: 'user', content: 'Hello' }
        ];

        // Act
        await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            messages: callerMessages
        });

        // Assert — the system message is the caller's original, not the admin's
        const captured = capturedRequests[0] as { messages: AiMessage[] };
        const systemMsg = captured.messages.find((m) => m.role === 'system');
        expect(systemMsg?.content).toBe('My custom system prompt.');
        // Verify admin prompt was NOT prepended
        expect(captured.messages[0]?.content).toBe('My custom system prompt.');
    });
});

// ---------------------------------------------------------------------------
// Engine integration: streamText
// ---------------------------------------------------------------------------

describe('engine integration — streamText', () => {
    it('should inject a system message before routing to the provider', async () => {
        // Arrange
        const capturedMessages: AiMessage[][] = [];
        const fakeStream = (async function* () {
            yield { delta: 'streamed text' };
        })();

        const spyProvider: AiProvider = {
            id: 'stub',
            generateText: vi.fn(),
            streamText: vi.fn().mockImplementation((req) => {
                if (req.messages !== undefined) {
                    capturedMessages.push([...req.messages]);
                }
                return Promise.resolve({
                    stream: fakeStream,
                    meta: Promise.resolve({
                        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
                        provider: 'stub',
                        model: 'stub-model-v1',
                        finishReason: 'stop'
                    })
                });
            }),
            generateObject: vi.fn(),
            extractIntent: vi.fn(),
            moderate: vi.fn().mockResolvedValue({ flagged: false, categories: {} }),
            embed: vi.fn()
        };

        mockGetActivePrompt.mockResolvedValue({ content: null, row: null });

        const engine = createAiEngine({ getProvider: () => spyProvider });

        // Act
        await engine.streamText({
            feature: 'chat',
            locale: 'es',
            prompt: 'Tell me about Concepción'
        });

        // Assert — provider received messages array with system first.
        // Source is 'default' (content was null) → composed DEFAULT_PROMPTS.chat + DEFAULT_RULES.chat.
        expect(capturedMessages).toHaveLength(1);
        const messages = capturedMessages[0];
        expect(messages?.[0]?.role).toBe('system');
        expect(messages?.[0]?.content).toBe(
            composeSystemPrompt({
                content: DEFAULT_PROMPTS.chat,
                rules: DEFAULT_RULES.chat
            })
        );
        expect(messages?.[1]?.role).toBe('user');
    });
});

// ---------------------------------------------------------------------------
// Engine integration: generateObject
// ---------------------------------------------------------------------------

import { z } from 'zod';

describe('engine integration — generateObject', () => {
    it('should prepend the system content to the prompt string', async () => {
        // Arrange
        const capturedPrompts: string[] = [];
        const TestSchema = z.object({ name: z.string().default('stub') });

        const spyProvider: AiProvider = {
            id: 'stub',
            generateText: vi.fn(),
            streamText: vi.fn(),
            generateObject: vi.fn().mockImplementation((req) => {
                capturedPrompts.push(req.prompt);
                return Promise.resolve({
                    object: TestSchema.parse({}),
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                    provider: 'stub',
                    model: 'stub-model-v1',
                    finishReason: 'stop'
                });
            }),
            extractIntent: vi.fn(),
            moderate: vi.fn().mockResolvedValue({ flagged: false, categories: {} }),
            embed: vi.fn()
        };

        mockGetActivePrompt.mockResolvedValue({
            content: 'Extract structured data carefully.',
            row: { id: 'row-obj', feature: 'search', isActive: true }
        });

        const engine = createAiEngine({ getProvider: () => spyProvider });

        // Act
        await engine.generateObject(
            { feature: 'search', locale: 'es', prompt: 'Find a hotel' },
            TestSchema
        );

        // Assert — system content was prepended to the prompt
        expect(capturedPrompts).toHaveLength(1);
        expect(capturedPrompts[0]).toContain('Extract structured data carefully.');
        expect(capturedPrompts[0]).toContain('Find a hotel');
        // System content must appear BEFORE the user request
        const sysIdx = capturedPrompts[0]?.indexOf('Extract structured data carefully.') ?? -1;
        const userIdx = capturedPrompts[0]?.indexOf('Find a hotel') ?? -1;
        expect(sysIdx).toBeLessThan(userIdx);
    });
});

// ---------------------------------------------------------------------------
// Engine integration: StubProvider end-to-end (prompt-only → messages form)
// ---------------------------------------------------------------------------

describe('engine integration — StubProvider end-to-end', () => {
    it('generateText with prompt-only resolves successfully through StubProvider', async () => {
        // Arrange
        mockGetActivePrompt.mockResolvedValue({ content: null, row: null });
        const engine = createAiEngine({
            getProvider: () => new StubProvider()
        });

        // Act — StubProvider.generateText reads messages array if messages is set
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Improve: bad text'
        });

        // Assert — result is defined; injection didn't break the happy path
        expect(result.text).toBeDefined();
        expect(result.provider).toBe('stub');
    });
});
