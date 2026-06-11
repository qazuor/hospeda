/**
 * Unit tests for `buildConversationalSearchPrompt` (SPEC-212 T-003).
 *
 * Covers:
 * - Locale amenity/feature allowlist lines are present (reused from SPEC-199).
 * - The new user message is embedded verbatim in triple quotes.
 * - CURRENT FILTER SET block is present (with serialized filters) when filters are provided.
 * - CURRENT FILTER SET block is omitted when filters are absent or empty (single-turn mode).
 * - Conversation history is bounded to the last CONVERSATION_HISTORY_LIMIT messages.
 * - History is formatted as `role: content`.
 * - The helper returns a plain string (no messages array).
 *
 * @module apps/api/routes/ai/protected/search-chat.prompt-builder.test
 */

import type { AiChatMessage, SearchIntentEntities } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    CONVERSATION_HISTORY_LIMIT,
    buildConversationalSearchPrompt
} from '../../../../src/routes/ai/protected/search-chat.prompt';

const MESSAGE = 'cabaña para 4 con pileta';

describe('buildConversationalSearchPrompt', () => {
    it('embeds the locale amenity and feature allowlist lines', () => {
        const prompt = buildConversationalSearchPrompt({
            history: [],
            message: MESSAGE,
            locale: 'es'
        });
        expect(prompt).toContain('Allowed amenity slugs for this request');
        expect(prompt).toContain('Allowed feature slugs for this request');
    });

    it('embeds the new user message verbatim in triple quotes', () => {
        const prompt = buildConversationalSearchPrompt({
            history: [],
            message: MESSAGE,
            locale: 'es'
        });
        expect(prompt).toContain(`New user message: """${MESSAGE}"""`);
    });

    it('includes the CURRENT FILTER SET block with serialized filters when provided', () => {
        const currentFilters: SearchIntentEntities = {
            minGuests: 4,
            hasPool: true
        };
        const prompt = buildConversationalSearchPrompt({
            currentFilters,
            history: [],
            message: 'más barata',
            locale: 'es'
        });
        expect(prompt).toContain('CURRENT FILTER SET');
        expect(prompt).toContain(JSON.stringify(currentFilters));
    });

    it('omits the CURRENT FILTER SET block when no filters are provided (single-turn mode)', () => {
        const prompt = buildConversationalSearchPrompt({
            history: [],
            message: MESSAGE,
            locale: 'es'
        });
        expect(prompt).not.toContain('CURRENT FILTER SET');
    });

    it('omits the CURRENT FILTER SET block when the filter set is empty', () => {
        const prompt = buildConversationalSearchPrompt({
            currentFilters: {},
            history: [],
            message: MESSAGE,
            locale: 'es'
        });
        expect(prompt).not.toContain('CURRENT FILTER SET');
    });

    it('bounds the conversation history to the last CONVERSATION_HISTORY_LIMIT messages', () => {
        const history: AiChatMessage[] = Array.from(
            { length: CONVERSATION_HISTORY_LIMIT + 4 },
            (_value, index) => ({
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `turn-${index}`
            })
        );
        const prompt = buildConversationalSearchPrompt({
            history,
            message: MESSAGE,
            locale: 'es'
        });
        // The 4 oldest messages are dropped; the last LIMIT are kept.
        expect(prompt).not.toContain('turn-0');
        expect(prompt).not.toContain('turn-3');
        expect(prompt).toContain(`turn-${CONVERSATION_HISTORY_LIMIT + 3}`);
        expect(prompt).toContain('Conversation so far (most recent last):');
    });

    it('formats history entries as "role: content"', () => {
        const history: AiChatMessage[] = [
            { role: 'user', content: 'hola' },
            { role: 'assistant', content: 'buenas' }
        ];
        const prompt = buildConversationalSearchPrompt({
            history,
            message: MESSAGE,
            locale: 'es'
        });
        expect(prompt).toContain('user: hola');
        expect(prompt).toContain('assistant: buenas');
    });

    it('omits the history block when there is no prior history', () => {
        const prompt = buildConversationalSearchPrompt({
            history: [],
            message: MESSAGE,
            locale: 'es'
        });
        expect(prompt).not.toContain('Conversation so far');
    });
});
