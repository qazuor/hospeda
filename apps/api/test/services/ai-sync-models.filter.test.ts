/**
 * Tests for `filterChatCapableModels` (HOS-94 T-006, OQ-1: denylist +
 * "uncertain" bucket).
 *
 * ## Coverage
 *
 * 1. Known non-chat families (embeddings, whisper, tts, dall-e, moderation)
 *    are hidden entirely.
 * 2. Known chat families (gpt-*, claude-*, gemini-*) pass with
 *    `uncertain: false`.
 * 3. An unrecognized id is kept and tagged `uncertain: true` (not dropped).
 * 4. Edge cases: empty input, duplicate ids, deprecated marker.
 *
 * @module test/services/ai-sync-models.filter
 */

import { describe, expect, it } from 'vitest';
import { filterChatCapableModels } from '../../src/services/ai-sync-models.filter.js';

describe('filterChatCapableModels', () => {
    describe('when given known non-chat model families', () => {
        it('should hide text-embedding models', () => {
            // Arrange
            const input = { ids: ['text-embedding-3-large'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toHaveLength(0);
        });

        it('should hide whisper (speech-to-text) models', () => {
            // Arrange
            const input = { ids: ['whisper-1'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toHaveLength(0);
        });

        it('should hide tts (text-to-speech) models', () => {
            // Arrange
            const input = { ids: ['tts-1'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toHaveLength(0);
        });

        it('should hide dall-e (image generation) models', () => {
            // Arrange
            const input = { ids: ['dall-e-3'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toHaveLength(0);
        });

        it('should hide moderation models', () => {
            // Arrange
            const input = { ids: ['omni-moderation-latest'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toHaveLength(0);
        });

        it('should hide a model with an explicit deprecated marker', () => {
            // Arrange
            const input = { ids: ['gpt-3.5-turbo-deprecated'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toHaveLength(0);
        });

        it('should hide all non-chat families together in one call', () => {
            // Arrange
            const input = {
                ids: [
                    'text-embedding-3-large',
                    'whisper-1',
                    'tts-1',
                    'dall-e-3',
                    'omni-moderation-latest'
                ]
            };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toHaveLength(0);
        });
    });

    describe('when given known chat/text-generation model families', () => {
        it('should pass gpt-4o with uncertain=false', () => {
            // Arrange
            const input = { ids: ['gpt-4o'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([{ id: 'gpt-4o', uncertain: false }]);
        });

        it('should pass claude-3-5-sonnet with uncertain=false', () => {
            // Arrange
            const input = { ids: ['claude-3-5-sonnet'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([{ id: 'claude-3-5-sonnet', uncertain: false }]);
        });

        it('should pass gemini-1.5-pro with uncertain=false', () => {
            // Arrange
            const input = { ids: ['gemini-1.5-pro'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([{ id: 'gemini-1.5-pro', uncertain: false }]);
        });

        it('should pass an OpenAI reasoning model (o3-mini) with uncertain=false', () => {
            // Arrange
            const input = { ids: ['o3-mini'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([{ id: 'o3-mini', uncertain: false }]);
        });

        it('should pass llama, mistral, deepseek, and qwen families with uncertain=false', () => {
            // Arrange
            const input = {
                ids: [
                    'llama-3.1-70b',
                    'mistral-large-latest',
                    'deepseek-chat',
                    'qwen2.5-72b-instruct'
                ]
            };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([
                { id: 'llama-3.1-70b', uncertain: false },
                { id: 'mistral-large-latest', uncertain: false },
                { id: 'deepseek-chat', uncertain: false },
                { id: 'qwen2.5-72b-instruct', uncertain: false }
            ]);
        });
    });

    describe('when given an unrecognized model id', () => {
        it('should keep it (not drop it) and tag it uncertain=true', () => {
            // Arrange
            const input = { ids: ['weird-new-model-x'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([{ id: 'weird-new-model-x', uncertain: true }]);
        });
    });

    describe('edge cases', () => {
        it('should return an empty result for an empty input list', () => {
            // Arrange
            const input = { ids: [] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([]);
        });

        it('should de-duplicate repeated ids, keeping the first occurrence', () => {
            // Arrange
            const input = { ids: ['gpt-4o', 'gpt-4o', 'weird-new-model-x', 'weird-new-model-x'] };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([
                { id: 'gpt-4o', uncertain: false },
                { id: 'weird-new-model-x', uncertain: true }
            ]);
        });

        it('should classify a mix of hidden, chat, and uncertain ids correctly in one call', () => {
            // Arrange
            const input = {
                ids: [
                    'text-embedding-3-large',
                    'gpt-4o',
                    'weird-new-model-x',
                    'whisper-1',
                    'claude-3-5-sonnet'
                ]
            };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([
                { id: 'gpt-4o', uncertain: false },
                { id: 'weird-new-model-x', uncertain: true },
                { id: 'claude-3-5-sonnet', uncertain: false }
            ]);
        });

        it('should accept an optional providerId without affecting classification', () => {
            // Arrange
            const input = { ids: ['gpt-4o'], providerId: 'openai' };

            // Act
            const result = filterChatCapableModels(input);

            // Assert
            expect(result.models).toEqual([{ id: 'gpt-4o', uncertain: false }]);
        });
    });
});
