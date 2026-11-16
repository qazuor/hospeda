/**
 * HOS-2250 guard: the `accommodation_import` system prompt names exactly the
 * keys of the model-facing output schema, all of them and nothing else.
 *
 * The old prompt listed `address`, `city`, `email`, `pricePerNight`,
 * `maxGuests` and `amenities`, keys the schema never had. The model followed
 * the prompt over the schema, and the lenient parse dropped what it returned,
 * so imports lost capacity, price, amenities and address. The expected key set
 * is derived from `AccommodationImportAiModelOutputSchema`, never hardcoded,
 * so adding or renaming a schema field without updating the prompt fails here.
 *
 * The prompt is read from ai-core SOURCE by relative path: `@repo/ai-core`
 * resolves to its build output, and a stale build would compare old text.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPTS } from '../../../../../../packages/ai-core/src/engine/default-prompts.js';
import {
    AccommodationImportAiModelOutputSchema,
    buildImportAiPrompt
} from '../../../../src/routes/accommodation/protected/import-from-url.ai';

/** Sentence that opens the field list in the prompt. */
const LIST_START = 'Use exactly these field names, every one of them and no others:';
/** Sentence that closes the field list in the prompt. */
const LIST_END = 'Set a field to null';

/**
 * Reads the field names the prompt declares: every `name (` inside the field
 * list sentence.
 *
 * @param input.prompt - The system prompt.
 * @returns `{ keys }`, sorted.
 */
function promptFieldNames(input: { readonly prompt: string }): { readonly keys: string[] } {
    const start = input.prompt.indexOf(LIST_START);
    const end = input.prompt.indexOf(LIST_END, start);
    if (start === -1 || end === -1) return { keys: [] };
    const list = input.prompt.slice(start + LIST_START.length, end);
    const keys = [...list.matchAll(/\b([a-z][A-Za-z]*) \(/g)].map((m) => m[1] as string);
    return { keys: keys.sort() };
}

describe('HOS-2250 accommodation_import prompt names the model schema keys', () => {
    const schemaKeys = Object.keys(AccommodationImportAiModelOutputSchema.shape).sort();

    it('the system prompt declares every schema key and no other key', () => {
        // Act
        const { keys } = promptFieldNames({ prompt: DEFAULT_PROMPTS.accommodation_import });

        // Assert: equal sets, and no key declared twice.
        expect(keys).toEqual(schemaKeys);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('the extractor sees a renamed key as drift (self-check of the guard)', () => {
        // Arrange
        const drifted = DEFAULT_PROMPTS.accommodation_import.replace(
            'capacity (number',
            'maxGuests (number'
        );

        // Act
        const { keys } = promptFieldNames({ prompt: drifted });

        // Assert
        expect(drifted).not.toBe(DEFAULT_PROMPTS.accommodation_import);
        expect(keys).not.toEqual(schemaKeys);
        expect(keys).toContain('maxGuests');
    });

    it('both prompts tell the model to answer null instead of omitting a field', () => {
        // Act
        const system = DEFAULT_PROMPTS.accommodation_import;
        const user = buildImportAiPrompt('page');

        // Assert
        expect(system).toContain('Set a field to null when its value is not clearly present');
        expect(user).toContain('Set every field you cannot find to null');
        expect(`${system}\n${user}`.toLowerCase()).not.toMatch(/\bomit\b/);
    });
});
