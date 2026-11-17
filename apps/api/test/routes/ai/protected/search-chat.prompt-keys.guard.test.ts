/**
 * HOS-2294 guard: the `search` system prompt names exactly the keys of the
 * model-facing output schema, all of them and nothing else, and tells the model
 * to answer `null` (never to omit) because the feature runs under strict
 * structured outputs.
 *
 * The expected key sets are derived from `SearchIntentModelOutputSchema`, never
 * hardcoded, so adding or renaming a schema field without updating the prompt
 * fails here. The prompt is read from ai-core SOURCE by relative path:
 * `@repo/ai-core` resolves to its build output and a stale build would compare
 * old text.
 */

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_PROMPTS,
    DEFAULT_RULES
} from '../../../../../../packages/ai-core/src/engine/default-prompts.js';
import { SearchIntentModelOutputSchema } from '../../../../src/routes/ai/protected/search-chat.model-output';

/** Marks where the entity sub-field list starts and ends in the prompt. */
const ENTITIES_START = '  entities: object with exactly these sub-fields';
const ENTITIES_END = 'Guest / bedroom / bathroom counts';

/**
 * Reads the field names the prompt declares, per nesting level: two-space
 * indented `name:` lines are top-level, four-space indented ones are entity
 * sub-fields.
 *
 * @param input.prompt - The system prompt.
 * @returns `{ top, entities }`, each sorted.
 */
function promptFieldNames(input: { readonly prompt: string }): {
    readonly top: string[];
    readonly entities: string[];
} {
    const start = input.prompt.indexOf(ENTITIES_START);
    const end = input.prompt.indexOf(ENTITIES_END, start);
    if (start === -1 || end === -1) return { top: [], entities: [] };
    const block = input.prompt.slice(input.prompt.indexOf('Extract a JSON object'), end);
    const top = [...block.matchAll(/^ {2}([a-z][A-Za-z]*):/gm)].map((m) => m[1] as string);
    const entities = [...block.matchAll(/^ {4}([a-z][A-Za-z]*):/gm)].map((m) => m[1] as string);
    return { top: top.sort(), entities: entities.sort() };
}

describe('HOS-2294 search prompt names the model schema keys', () => {
    const topKeys = Object.keys(SearchIntentModelOutputSchema.shape).sort();
    const entityKeys = Object.keys(SearchIntentModelOutputSchema.shape.entities.shape).sort();

    it('declares every top-level and every entity key, and no other, once each', () => {
        // Act
        const { top, entities } = promptFieldNames({ prompt: DEFAULT_PROMPTS.search });

        // Assert
        expect(top).toEqual(topKeys);
        expect(entities).toEqual(entityKeys);
        expect(new Set(entities).size).toBe(entities.length);
    });

    it('the extractor sees a renamed key as drift (self-check of the guard)', () => {
        // Arrange
        const drifted = DEFAULT_PROMPTS.search.replace('    minGuests:', '    guests:');

        // Act
        const { entities } = promptFieldNames({ prompt: drifted });

        // Assert
        expect(drifted).not.toBe(DEFAULT_PROMPTS.search);
        expect(entities).not.toEqual(entityKeys);
        expect(entities).toContain('guests');
    });

    it('prompt and rules tell the model to answer null instead of omitting a field', () => {
        // Act
        const content = DEFAULT_PROMPTS.search;
        const rules = DEFAULT_RULES.search;

        // Assert
        expect(content).toContain('Set a sub-field to null when the query does not state it');
        expect(rules).toContain('Set every other field to null');
        expect(`${content}\n${rules}`.toLowerCase()).not.toMatch(/\bomit\b/);
    });
});
