/**
 * Unit tests for `buildConversationalSearchPrompt` (SPEC-212 T-003) and
 * `buildSearchReplySystemPrompt` / `buildSearchReplyMessages` (SPEC-212 T-006).
 *
 * ## T-003 coverage (buildConversationalSearchPrompt)
 * - Locale amenity/feature allowlist lines are present (reused from SPEC-199).
 * - The new user message is embedded verbatim in triple quotes.
 * - CURRENT FILTER SET block is present (with serialized filters) when filters are provided.
 * - CURRENT FILTER SET block is omitted when filters are absent or empty (single-turn mode).
 * - Conversation history is bounded to the last CONVERSATION_HISTORY_LIMIT messages.
 * - History is formatted as `role: content`.
 * - The helper returns a plain string (no messages array).
 *
 * ## T-006 coverage (buildSearchReplySystemPrompt / buildSearchReplyMessages)
 * - Reply system prompt mentions the locale's language.
 * - Reply system prompt forbids citing exact result counts.
 * - Reply system prompt instructs short, friendly reply.
 * - buildSearchReplyMessages: first message is system.
 * - buildSearchReplyMessages: user message is last.
 * - buildSearchReplyMessages: extracted filters appear as an assistant context note.
 * - buildSearchReplyMessages: history bounded to CONVERSATION_HISTORY_LIMIT.
 *
 * @module apps/api/routes/ai/protected/search-chat.prompt-builder.test
 */

import { AccommodationTypeEnum } from '@repo/schemas';
import type { AiChatMessage, SearchIntentEntities } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    CONVERSATION_HISTORY_LIMIT,
    buildConversationalSearchPrompt,
    buildSearchReplyMessages,
    buildSearchReplySystemPrompt
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

// ─── buildSearchReplySystemPrompt (T-006) ────────────────────────────────────

describe('buildSearchReplySystemPrompt', () => {
    it('mentions "Spanish" for locale es', () => {
        const prompt = buildSearchReplySystemPrompt({ locale: 'es' });
        expect(prompt).toContain('Spanish');
    });

    it('mentions "English" for locale en', () => {
        const prompt = buildSearchReplySystemPrompt({ locale: 'en' });
        expect(prompt).toContain('English');
    });

    it('mentions "Portuguese" for locale pt', () => {
        const prompt = buildSearchReplySystemPrompt({ locale: 'pt' });
        expect(prompt).toContain('Portuguese');
    });

    it('instructs the model NOT to cite an exact result count', () => {
        const prompt = buildSearchReplySystemPrompt({ locale: 'es' });
        // The phrase "exact result count" (or similar) must appear
        expect(prompt.toLowerCase()).toContain('result count');
    });

    it('instructs the model to write a short reply', () => {
        const prompt = buildSearchReplySystemPrompt({ locale: 'es' });
        expect(prompt.toLowerCase()).toContain('short');
    });

    it('does not include JSON-extraction instructions (slot extractor must not leak)', () => {
        const prompt = buildSearchReplySystemPrompt({ locale: 'es' });
        // The slot extractor contract uses "confidence" and "entities" — these
        // must not appear in the reply system prompt.
        expect(prompt.toLowerCase()).not.toContain('confidence');
        expect(prompt.toLowerCase()).not.toContain('"entities"');
    });

    it('instructs the model to stay on-topic (accommodation search only)', () => {
        const prompt = buildSearchReplySystemPrompt({ locale: 'es' });
        expect(prompt.toLowerCase()).toContain('accommodation');
    });
});

// ─── buildSearchReplyMessages (T-006) ────────────────────────────────────────

describe('buildSearchReplyMessages', () => {
    const SYSTEM = 'Reply system prompt.';
    const USER_MSG = 'Quiero una cabaña con pileta.';

    it('first message is the system prompt', () => {
        const msgs = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {}
        });
        expect(msgs[0]?.role).toBe('system');
        expect(msgs[0]?.content).toBe(SYSTEM);
    });

    it('last message is the user turn', () => {
        const msgs = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {}
        });
        const last = msgs[msgs.length - 1];
        expect(last?.role).toBe('user');
        expect(last?.content).toBe(USER_MSG);
    });

    it('includes an assistant context note with serialized filters when filters are provided', () => {
        const filters: SearchIntentEntities = {
            accommodationType: AccommodationTypeEnum.CABIN,
            hasPool: true
        };
        const msgs = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: filters
        });
        const assistantNote = msgs.find((m) => m.role === 'assistant');
        expect(assistantNote).toBeDefined();
        expect(assistantNote?.content).toContain(JSON.stringify(filters));
    });

    it('includes an assistant note saying no filters when extractedFilters is empty', () => {
        const msgs = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {}
        });
        const assistantNote = msgs.find((m) => m.role === 'assistant');
        expect(assistantNote).toBeDefined();
        expect(assistantNote?.content?.toLowerCase()).toContain('no specific search filters');
    });

    it('includes prior history messages between system and assistant-context', () => {
        const history: AiChatMessage[] = [
            { role: 'user', content: 'primera consulta' },
            { role: 'assistant', content: 'primera respuesta' }
        ];
        const msgs = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history,
            message: USER_MSG,
            extractedFilters: {}
        });
        const userTurns = msgs.filter((m) => m.role === 'user');
        const assistantTurns = msgs.filter((m) => m.role === 'assistant');

        // Two user turns: one from history, one new
        expect(userTurns.length).toBeGreaterThanOrEqual(2);
        // Two assistant turns: one from history, one context note
        expect(assistantTurns.length).toBeGreaterThanOrEqual(2);
    });

    it('bounds prior history to CONVERSATION_HISTORY_LIMIT messages', () => {
        const history: AiChatMessage[] = Array.from(
            { length: CONVERSATION_HISTORY_LIMIT + 4 },
            (_v, i) => ({
                role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
                content: `turn-${i}`
            })
        );
        const msgs = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history,
            message: USER_MSG,
            extractedFilters: {}
        });
        const allContent = msgs.map((m) => m.content).join('\n');

        // The 4 oldest messages must be dropped
        expect(allContent).not.toContain('turn-0');
        expect(allContent).not.toContain('turn-3');
        // The most recent history messages must be present
        expect(allContent).toContain(`turn-${CONVERSATION_HISTORY_LIMIT + 3}`);
    });
});
