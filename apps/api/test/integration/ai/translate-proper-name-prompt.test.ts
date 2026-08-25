/**
 * Integration test for the proper-name prompt instruction (HOS-789).
 *
 * `buildTranslationPrompt` (private, `apps/api/src/services/ai-translate.service.ts`)
 * takes a `fieldType` and, when that field is in `PROPER_NAME_FIELDS` (currently
 * only `'name'`), appends an extra instruction telling the model the text is a
 * proper name it must reproduce verbatim. Every other field keeps the plain
 * "translate the following text" prompt.
 *
 * `buildTranslationPrompt` is not exported, so this suite drives it exclusively
 * through the public `translateEntity()` entry point and captures the `prompt`
 * argument passed to the mocked `generateText` call.
 *
 * Scope is deliberately narrow: only `createConfiguredAiService`
 * (`../../../src/services/ai-service.factory`) is mocked. `translateEntity`
 * does not touch the database on this path — `onlyMissing` defaults to
 * `false`, so `loadExistingTranslations` (the only DB read in the function)
 * never runs — so no `@repo/db` mock is needed.
 *
 * @module test/integration/ai/translate-proper-name-prompt.test
 */

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports)
// ---------------------------------------------------------------------------

/**
 * Captures every `generateText` invocation so assertions can inspect the exact
 * `prompt` string the service built for each (field, target locale) pair.
 */
const { generateTextCalls } = vi.hoisted(() => ({
    generateTextCalls: [] as Array<{ prompt: string }>
}));

vi.mock('../../../src/services/ai-service.factory', () => ({
    createConfiguredAiService: vi.fn(async () => ({
        generateText: vi.fn(async (req: Record<string, unknown>) => {
            generateTextCalls.push({ prompt: String(req.prompt ?? '') });
            return {
                text: 'stub translation',
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
        }),
        streamText: vi.fn()
    }))
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translateEntity } from '../../../src/services/ai-translate.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Anchor token unique to the proper-name instruction added by HOS-789. Chosen
 * as an inevitable substring of the instruction rather than the whole
 * sentence, so the assertion survives copy edits to the surrounding wording
 * without becoming vacuous.
 */
const PROPER_NAME_INSTRUCTION_ANCHOR = 'Reproduce it EXACTLY as written';

const ENTITY_NAME_VALUE = 'Cabaña del Río';
const ENTITY_DESCRIPTION_VALUE = 'Descripción larga del contenido para traducir.';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('translateEntity — proper-name prompt instruction (HOS-789)', () => {
    beforeEach(() => {
        generateTextCalls.length = 0;
    });

    it('AC-a: includes the proper-name instruction and the field value when translating "name"', async () => {
        // Arrange: a single proper-name field, one target locale so exactly
        // one generateText call is made.
        const input = {
            entityType: 'accommodation' as const,
            entityId: '00000000-0000-4000-8000-000000000001',
            fields: { name: ENTITY_NAME_VALUE },
            sourceLocale: 'es' as const,
            targetLocales: ['en' as const]
        };

        // Act
        await translateEntity(input);

        // Assert
        expect(generateTextCalls).toHaveLength(1);
        const prompt = generateTextCalls[0]?.prompt ?? '';
        expect(prompt).toContain(PROPER_NAME_INSTRUCTION_ANCHOR);
        expect(prompt).toContain(ENTITY_NAME_VALUE);
    });

    it('AC-b (control): omits the proper-name instruction when translating "description"', async () => {
        // Arrange: a non-proper-name field. This is the negative control —
        // without it, a test that always sees the instruction (e.g. a prompt
        // builder that includes it unconditionally) would still pass AC-a.
        const input = {
            entityType: 'accommodation' as const,
            entityId: '00000000-0000-4000-8000-000000000001',
            fields: { description: ENTITY_DESCRIPTION_VALUE },
            sourceLocale: 'es' as const,
            targetLocales: ['en' as const]
        };

        // Act
        await translateEntity(input);

        // Assert
        expect(generateTextCalls).toHaveLength(1);
        const prompt = generateTextCalls[0]?.prompt ?? '';
        expect(prompt).not.toContain(PROPER_NAME_INSTRUCTION_ANCHOR);
        expect(prompt).toContain(ENTITY_DESCRIPTION_VALUE);
    });
});
