/**
 * HOS-2217: the AI sweep must measure every non-chat feature EXACTLY as
 * production calls it.
 *
 * The sweep (packages/ai-core/scripts/ai-sweep) reads `tasks.generated.json`
 * for each case's provider request and output schema. These tests prove, from
 * the apps/api side where the real builders live, that the committed file is
 * not stale, that the stored schemas are the AI SDK conversion of the live
 * production Zod schemas, and — for one case per call kind, built WITHOUT the
 * generator's own render helper — that the stored request is what the route
 * builds.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    AiFaqDraftOutputSchema,
    AiPostGenerateDraftGenerationSchema,
    AiPostGenerateRequestSchema,
    AiTextImproveRequestSchema,
    SearchIntentOutputSchema
} from '@repo/schemas';
import { stripHtmlToText } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { toSdkJsonSchema } from '../../../../packages/ai-core/scripts/ai-sweep/sdk-json-schema.js';
import { SWEEP_DIR } from '../../scripts/ai-sweep/generate-sweep-contexts.js';
import { buildGeneratedTasksFile } from '../../scripts/ai-sweep/generate-sweep-tasks.js';
import {
    AccommodationImportAiOutputSchema,
    buildImportAiPrompt
} from '../../src/routes/accommodation/protected/import-from-url.ai.js';
import { buildPostGeneratePrompt } from '../../src/routes/ai/admin/post-generate.js';
import { buildConversationalSearchPrompt } from '../../src/routes/ai/protected/search-chat.prompt.js';
import { buildTextImprovePrompt } from '../../src/routes/ai/protected/text-improve.js';
import { buildTranslationPrompt, protectUrls } from '../../src/services/ai-translate.service.js';

interface StoredCase {
    readonly call: string;
    readonly mode: string;
    readonly request: Record<string, unknown>;
    readonly placeholders: readonly string[];
    readonly groundingText: string;
}

const read = (name: string): string => readFileSync(resolve(SWEEP_DIR, name), 'utf8');
const generated = JSON.parse(read('tasks.generated.json')) as {
    schemas: Record<string, unknown>;
    cases: Record<string, StoredCase>;
};

/** Raw input of a stored fixture case. */
function fixtureInput(feature: string, id: string): Record<string, unknown> {
    const file = JSON.parse(read(`task-fixtures/${feature}.json`)) as {
        cases: { id: string; input: Record<string, unknown> }[];
    };
    const found = file.cases.find((c) => c.id === id);
    if (!found) throw new Error(`fixture ${id} missing`);
    return found.input;
}

function stored(id: string): StoredCase {
    const c = generated.cases[id];
    if (!c) throw new Error(`case ${id} missing from tasks.generated.json`);
    return c;
}

/** What the AI SDK sends for a Zod schema (`zodSchema()` itself; apps/api has no `ai` dependency). */
const sdk = (schema: unknown): unknown => toSdkJsonSchema({ schema }).jsonSchema;

describe('HOS-2217 sweep task requests are the production requests', () => {
    it('the committed tasks.generated.json is not stale', () => {
        // Arrange: compared as data, so Biome may reformat the committed file.
        const committed: unknown = JSON.parse(read('tasks.generated.json'));

        // Act
        const { json } = buildGeneratedTasksFile();

        // Assert
        expect(
            committed,
            'Regenerate: CI=true pnpm --filter hospeda-api exec tsx scripts/ai-sweep/generate-sweep-tasks.ts'
        ).toEqual(JSON.parse(json));
    });

    it('stored output schemas are the AI SDK conversion of the live production schemas', () => {
        // Arrange
        const live = {
            search_intent: SearchIntentOutputSchema,
            accommodation_import: AccommodationImportAiOutputSchema,
            post_generate: AiPostGenerateDraftGenerationSchema,
            faq_draft: AiFaqDraftOutputSchema
        };

        // Act
        const converted = Object.fromEntries(
            Object.entries(live).map(([id, schema]) => [id, sdk(schema)])
        );

        // Assert
        expect(generated.schemas).toEqual(converted);
    });

    it('text_improve: the route builder over the validated body, page locale default es', () => {
        // Arrange
        const body = AiTextImproveRequestSchema.parse(
            fixtureInput('text_improve', 'text_improve-description-rough')
        );

        // Act
        const c = stored('text_improve-description-rough');

        // Assert
        expect(c.request).toEqual({
            feature: 'text_improve',
            locale: body.locale ?? 'es',
            prompt: buildTextImprovePrompt(body)
        });
    });

    it('post_generate: the route builder, buffered generateObject', () => {
        // Arrange
        const body = AiPostGenerateRequestSchema.parse(
            fixtureInput('post_generate', 'post_generate-locale-en')
        );

        // Act
        const c = stored('post_generate-locale-en');

        // Assert
        expect(c.mode).toBe('object');
        expect(c.request).toEqual({
            feature: 'post_generate',
            locale: 'en',
            prompt: buildPostGeneratePrompt(body)
        });
    });

    it('translate: URLs are shielded before the prompt, and every placeholder is tracked', () => {
        // Arrange
        const input = fixtureInput('translate', 'translate-urls-placeholders') as {
            value: string;
            sourceLocale: 'es';
            targetLocale: 'en';
            fieldType: string;
        };
        const { protectedText, urls } = protectUrls(input.value);

        // Act
        const c = stored('translate-urls-placeholders');

        // Assert
        expect(c.request).toEqual({
            feature: 'translate',
            locale: 'en',
            prompt: buildTranslationPrompt(protectedText, 'es', 'en', input.fieldType)
        });
        expect(c.placeholders).toHaveLength(urls.length);
        expect(c.placeholders.length).toBeGreaterThan(0);
        expect(JSON.stringify(c.request)).not.toContain('https://');
    });

    it('accommodation_import: page text stripped with the deployed default cap (12000)', () => {
        // Arrange
        const input = fixtureInput('accommodation_import', 'accommodation_import-reviews-trap') as {
            html: string;
        };
        const text = stripHtmlToText({ html: input.html, maxChars: 12000 });

        // Act
        const c = stored('accommodation_import-reviews-trap');

        // Assert
        expect(c.request.prompt).toBe(buildImportAiPrompt(text));
        expect(c.groundingText).toBe(text);
    });

    it('search_intent: single-turn prompt without a CURRENT FILTER SET block', () => {
        // Arrange
        const input = fixtureInput('search', 'search-intent-vague') as { message: string };

        // Act
        const c = stored('search-intent-vague');

        // Assert
        expect(c.request).toEqual({
            feature: 'search',
            locale: 'es',
            prompt: buildConversationalSearchPrompt({
                history: [],
                message: input.message,
                locale: 'es'
            })
        });
    });

    it('faq_draft: fixed production params and the plain visitor-question prompt', () => {
        // Arrange
        const input = fixtureInput('faq_draft', 'faq_draft-pets-missing') as { question: string };

        // Act
        const c = stored('faq_draft-pets-missing');

        // Assert
        expect(c.request.params).toEqual({ maxTokens: 1024, temperature: 0 });
        expect(c.request.prompt).toBe(`Visitor question: ${input.question}`);
        expect(c.groundingText.length).toBeGreaterThan(100);
        expect(String(c.request.systemPrompt).startsWith(c.groundingText)).toBe(true);
    });

    it('support: engine defaults only (no caller system), since no route calls it', () => {
        // Act
        const c = stored('support-off-topic');

        // Assert
        expect(c.request.system).toBeUndefined();
        expect(c.request.systemPrompt).toBeUndefined();
        expect(c.request.messages).toEqual([
            { role: 'user', content: 'Escribime un ensayo sobre la Revolución Francesa' }
        ]);
    });
});
