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
 * - buildSearchReplyMessages: returned `system` string starts with the reply prompt.
 * - buildSearchReplyMessages: `messages` never contains a `role: 'system'` entry.
 * - buildSearchReplyMessages: user message is last.
 * - buildSearchReplyMessages: extracted filters appear as an assistant context note.
 * - buildSearchReplyMessages: history bounded to CONVERSATION_HISTORY_LIMIT.
 *
 * @module apps/api/routes/ai/protected/search-chat.prompt-builder.test
 */

import type { AiChatMessage, SearchIntentEntities } from '@repo/schemas';
import { AccommodationTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    extractAllSlugs,
    POI_ALLOWLIST,
    PROMPT_FEATURED_POI_SLUGS
} from '../../../../src/routes/ai/protected/poi-allowlist';
import {
    buildConversationalSearchPrompt,
    buildSearchReplyMessages,
    buildSearchReplySystemPrompt,
    CONVERSATION_HISTORY_LIMIT
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

    it('embeds the locale destination attraction and point-of-interest allowlist lines (HOS-113 §6.3, HOS-142 Phase 4b)', () => {
        const prompt = buildConversationalSearchPrompt({
            history: [],
            message: MESSAGE,
            locale: 'es'
        });
        expect(prompt).toContain('Allowed destination attraction slugs for this request');
        // HOS-142 Phase 4b: the embedded POI line now advertises itself as a
        // curated/featured SUBSET (not the complete ~661-landmark catalog) —
        // see search-chat.prompt.ts's buildAllowlistLines + poi-allowlist.ts's
        // PROMPT_FEATURED_POI_SLUGS. The curated allowlist slugs still appear
        // verbatim, since they are always part of the embedded subset.
        expect(prompt).toContain('Featured destination point-of-interest slugs for this request');
        expect(prompt).toContain('autodromo_concepcion_del_uruguay');
        expect(prompt).toContain('entities.poiSlugs');
    });

    it('embeds only the bounded PROMPT_FEATURED_POI_SLUGS subset, not the full POI_ALLOWLIST catalog (HOS-142 Phase 4b)', () => {
        const prompt = buildConversationalSearchPrompt({
            history: [],
            message: MESSAGE,
            locale: 'es'
        });

        const fullCatalogSlugCount = extractAllSlugs(POI_ALLOWLIST).size;

        // The full catalog (~661 landmarks) must NOT be embedded verbatim —
        // only the small featured/curated subset. Bounds match the ~30-60
        // target the generator script's PROMPT_FEATURED_POI_LIMIT aims for.
        expect(PROMPT_FEATURED_POI_SLUGS.length).toBeGreaterThan(0);
        expect(PROMPT_FEATURED_POI_SLUGS.length).toBeLessThanOrEqual(60);
        expect(PROMPT_FEATURED_POI_SLUGS.length).toBeLessThan(fullCatalogSlugCount);

        for (const slug of PROMPT_FEATURED_POI_SLUGS) {
            expect(prompt).toContain(slug);
        }
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

// ─── HOS-111 T-012: nearby-expansion reinforcement ───────────────────────────

describe('buildConversationalSearchPrompt — nearby expansion (HOS-111 T-012, G-9)', () => {
    it('includes the NEARBY EXPANSION instruction block AND example follow-up phrases when a current filter set exists', () => {
        // A follow-up like "y en destinos cercanos" only makes sense once a
        // destination is already in the accumulated filter set.
        const currentFilters: SearchIntentEntities = { destinationId: 'dest-colon-uuid' };
        const prompt = buildConversationalSearchPrompt({
            currentFilters,
            history: [{ role: 'user', content: 'cabaña en Colón' }],
            message: 'y en destinos cercanos también',
            locale: 'es'
        });

        expect(prompt).toContain('NEARBY EXPANSION');
        expect(prompt).toContain('expandToNearby');
        expect(prompt).toContain('y en destinos cercanos');
        expect(prompt).toContain('también cerca');
    });

    it('omits the NEARBY EXPANSION instruction block when there is no current filter set (unrelated / single-turn message)', () => {
        // Single-turn message, no prior destination context — the model must
        // never be told expandToNearby is settable here (deterministic guard,
        // R-3: the anchor destination must already exist to expand from).
        const prompt = buildConversationalSearchPrompt({
            history: [],
            message: 'cabaña para 4 con pileta',
            locale: 'es'
        });

        expect(prompt).not.toContain('NEARBY EXPANSION');
        expect(prompt).not.toContain('expandToNearby');
    });

    it('omits the NEARBY EXPANSION instruction block when the current filter set is empty', () => {
        const prompt = buildConversationalSearchPrompt({
            currentFilters: {},
            history: [],
            message: 'también cerca',
            locale: 'es'
        });

        expect(prompt).not.toContain('NEARBY EXPANSION');
    });

    it('instructs the model to only set expandToNearby when an existing destination is already in context', () => {
        const currentFilters: SearchIntentEntities = { destinationId: 'dest-colon-uuid' };
        const prompt = buildConversationalSearchPrompt({
            currentFilters,
            history: [],
            message: 'también cerca',
            locale: 'es'
        });

        expect(prompt).toContain('never infer it from a message with no prior search context');
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

    it('returns the reply system prompt as the `system` string', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {}
        });
        expect(result.system).toBe(SYSTEM);
    });

    it('never includes a role: "system" entry in `messages` (the security-warning regression)', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {},
            attractionLocationConflict: { attractionSlugs: ['sede_carnaval'] },
            poiLocationConflict: { poiSlugs: ['autodromo_concepcion_del_uruguay'] }
        });
        expect(result.messages.some((m) => m.role === 'system')).toBe(false);
    });

    it('last message is the user turn', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {}
        });
        const last = result.messages[result.messages.length - 1];
        expect(last?.role).toBe('user');
        expect(last?.content).toBe(USER_MSG);
    });

    it('includes an assistant context note with serialized filters when filters are provided', () => {
        const filters: SearchIntentEntities = {
            accommodationType: AccommodationTypeEnum.CABIN,
            hasPool: true
        };
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: filters
        });
        const assistantNote = result.messages.find((m) => m.role === 'assistant');
        expect(assistantNote).toBeDefined();
        expect(assistantNote?.content).toContain(JSON.stringify(filters));
    });

    it('includes an assistant note saying no filters when extractedFilters is empty', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {}
        });
        const assistantNote = result.messages.find((m) => m.role === 'assistant');
        expect(assistantNote).toBeDefined();
        expect(assistantNote?.content?.toLowerCase()).toContain('no specific search filters');
    });

    it('includes prior history messages before the assistant-context note', () => {
        const history: AiChatMessage[] = [
            { role: 'user', content: 'primera consulta' },
            { role: 'assistant', content: 'primera respuesta' }
        ];
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history,
            message: USER_MSG,
            extractedFilters: {}
        });
        const userTurns = result.messages.filter((m) => m.role === 'user');
        const assistantTurns = result.messages.filter((m) => m.role === 'assistant');

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
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history,
            message: USER_MSG,
            extractedFilters: {}
        });
        const allContent = result.messages.map((m) => m.content).join('\n');

        // The 4 oldest messages must be dropped
        expect(allContent).not.toContain('turn-0');
        expect(allContent).not.toContain('turn-3');
        // The most recent history messages must be present
        expect(allContent).toContain(`turn-${CONVERSATION_HISTORY_LIMIT + 3}`);
    });
});

// ─── buildSearchReplyMessages — poiLocationConflict (HOS-113 review H-1/M-1) ─

describe('buildSearchReplyMessages — poiLocationConflict (HOS-113 review H-1/M-1)', () => {
    const SYSTEM = 'Reply system prompt.';
    const USER_MSG = 'busco algo cerca del autódromo imaginario';
    const RAW_POI_SLUG = 'autodromo_concepcion_del_uruguay';

    it('scrubs the raw unresolved poiSlugs out of the assistant filters-context note', () => {
        const filters: SearchIntentEntities = {
            accommodationType: AccommodationTypeEnum.CABIN,
            poiSlugs: [RAW_POI_SLUG]
        };
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: filters,
            poiLocationConflict: { poiSlugs: [RAW_POI_SLUG] }
        });

        const assistantNote = result.messages.find(
            (m) => m.role === 'assistant' && m.content.startsWith('Extracted search filters')
        );
        expect(assistantNote).toBeDefined();
        // The raw landmark slug must NOT survive into the filters context —
        // otherwise the model could narrate a proximity search that never ran.
        expect(assistantNote?.content).not.toContain(RAW_POI_SLUG);
        expect(assistantNote?.content).toContain('"poiSlugs":[]');
        // Every other extracted filter is left untouched.
        expect(assistantNote?.content).toContain(AccommodationTypeEnum.CABIN);
    });

    it('leaves extractedFilters untouched when poiLocationConflict is absent', () => {
        const filters: SearchIntentEntities = { poiSlugs: [RAW_POI_SLUG] };
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: filters
        });

        const assistantNote = result.messages.find(
            (m) => m.role === 'assistant' && m.content.startsWith('Extracted search filters')
        );
        expect(assistantNote?.content).toContain(RAW_POI_SLUG);
    });

    it('appends a corrective IMPORTANT — LANDMARK NOT APPLIED note to `system` naming the unresolved slug', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: { poiSlugs: [RAW_POI_SLUG] },
            poiLocationConflict: { poiSlugs: [RAW_POI_SLUG] }
        });

        expect(result.system).toContain('LANDMARK NOT APPLIED');
        expect(result.system).toContain(RAW_POI_SLUG);
        // Unlike the attraction conflict, this must NOT claim zero results —
        // the search itself still ran, just without the proximity narrowing.
        expect(result.system.toUpperCase()).not.toContain('ZERO');
        // The corrective note must never leak into `messages` (no role: 'system').
        expect(result.messages.some((m) => m.role === 'system')).toBe(false);
    });

    it('does not append the corrective note when poiLocationConflict is absent', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {}
        });

        expect(result.system).not.toContain('LANDMARK NOT APPLIED');
    });

    it('includes the best-effort locationLabel in the corrective note when present', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: { poiSlugs: [RAW_POI_SLUG] },
            poiLocationConflict: { poiSlugs: [RAW_POI_SLUG], locationLabel: 'Gualeguaychú' }
        });

        expect(result.system).toContain('Gualeguaychú');
    });

    it('places the corrective note after the attraction conflict note (and the base prompt) in `system` when both are present', () => {
        const result = buildSearchReplyMessages({
            systemPrompt: SYSTEM,
            history: [],
            message: USER_MSG,
            extractedFilters: {},
            attractionLocationConflict: { attractionSlugs: ['sede_carnaval'] },
            poiLocationConflict: { poiSlugs: [RAW_POI_SLUG] }
        });

        const systemPromptIdx = result.system.indexOf(SYSTEM);
        const attractionIdx = result.system.indexOf('NO RESULTS');
        const poiIdx = result.system.indexOf('LANDMARK NOT APPLIED');
        const userIdx = result.messages.findIndex((m) => m.role === 'user');

        expect(systemPromptIdx).toBe(0);
        expect(attractionIdx).toBeGreaterThan(systemPromptIdx);
        expect(poiIdx).toBeGreaterThan(attractionIdx);
        // The user turn is still the last entry in `messages` (unaffected by
        // the conflict notes now living in `system`).
        expect(userIdx).toBe(result.messages.length - 1);
    });
});
