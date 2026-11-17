/**
 * Tests for the HOS-2217 non-chat sweep cases: fixtures joined with the
 * requests apps/api generates with the real route builders, the automatic
 * checks (field expectations, hallucinated fields, grounding, text rubric) and
 * the JSON Schema validator. No network.
 *
 * Request parity with the routes is proven on the apps/api side
 * (`apps/api/test/scripts/ai-sweep-tasks-parity.test.ts`); parity with the
 * engine and the OpenAI adapter is in `ai-sweep-provider-parity.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FixtureFileSchema } from '../scripts/ai-sweep/cases.js';
import {
    findUnsupportedKeywords,
    validateJsonSchema
} from '../scripts/ai-sweep/json-schema-check.js';
import { loadTaskCases } from '../scripts/ai-sweep/load-cases.js';
import {
    checkTaskAnswer,
    evaluateExpectation,
    listLeafPaths,
    parseAnswerVerdict
} from '../scripts/ai-sweep/task-checks.js';
import {
    GeneratedTasksFileSchema,
    joinTaskCases,
    TASK_FEATURES,
    type TaskCase,
    TaskFixtureFileSchema
} from '../scripts/ai-sweep/tasks.js';

const DIR = resolve(import.meta.dirname, '../scripts/ai-sweep');
const read = (name: string): string => readFileSync(resolve(DIR, name), 'utf8');
const { cases } = loadTaskCases({ dir: DIR });
const generated = GeneratedTasksFileSchema.parse(JSON.parse(read('tasks.generated.json')));

function taskCase(id: string): TaskCase {
    const found = cases.find((c) => c.id === id);
    if (!found) throw new Error(`case ${id} missing`);
    return found;
}

describe('HOS-2217 task fixtures', () => {
    it('cover every non-chat feature with 6 to 12 cases each', () => {
        // Act
        const counts = Object.fromEntries(
            TASK_FEATURES.map((f) => [f, cases.filter((c) => c.feature === f).length])
        );

        // Assert
        for (const feature of TASK_FEATURES) {
            expect(counts[feature], feature).toBeGreaterThanOrEqual(6);
            // search covers two production calls (intent + reply), so it may hold more.
            expect(counts[feature], feature).toBeLessThanOrEqual(feature === 'search' ? 16 : 12);
        }
    });

    it('every feature has at least one trap (injection, missing data or language mismatch)', () => {
        // Arrange
        const trap = /inject|missing|vague|sparse|english|portuguese|locale-|-en$|-pt$|no-contact/;

        // Act
        const withTrap = TASK_FEATURES.filter((f) =>
            cases.some((c) => c.feature === f && trap.test(c.id))
        );

        // Assert
        expect(withTrap).toEqual([...TASK_FEATURES]);
    });

    it('case ids are unique across task and chat fixtures', () => {
        // Arrange
        const chatIds = FixtureFileSchema.parse(JSON.parse(read('fixtures.json'))).cases.map(
            (c) => c.id
        );

        // Act
        const all = [...chatIds, ...cases.map((c) => c.id)];

        // Assert
        expect(new Set(all).size).toBe(all.length);
    });

    it('the generated file covers exactly the stored cases', () => {
        // Assert
        expect(Object.keys(generated.cases).sort()).toEqual(cases.map((c) => c.id).sort());
    });

    it('carries no real contact data: phones are zero-filled and URLs use example.com', () => {
        // Arrange
        const text = cases.map((c) => JSON.stringify(c.input)).join('\n');

        // Act
        const urls = text.match(/https?:\/\/[^\s"')\]]+/g) ?? [];
        const phones = text.match(/\+?\d[\d\s-]{8,}\d/g) ?? [];
        const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];

        // Assert
        expect(urls.every((u) => new URL(u).hostname === 'example.com')).toBe(true);
        expect(phones.every((p) => /^[+\d\s-]*$/.test(p) && /^\+?54 9 0+ 0+-0+$/.test(p))).toBe(
            true
        );
        expect(emails).toEqual([]);
    });

    it('refuses a fixture edited after generation', () => {
        // Arrange
        const file = TaskFixtureFileSchema.parse(JSON.parse(read('task-fixtures/translate.json')));
        const first = file.cases[0];
        if (!first) throw new Error('empty fixture file');
        const edited = {
            ...file,
            cases: [{ ...first, input: { ...first.input, value: 'Otro texto distinto.' } }]
        };

        // Act
        const run = () => joinTaskCases({ files: [edited], generated });

        // Assert
        expect(run).toThrow(/stale for: translate-description-es-en/);
    });

    it('refuses a call that does not belong to the file feature', () => {
        // Arrange
        const file = TaskFixtureFileSchema.parse(JSON.parse(read('task-fixtures/support.json')));
        const first = file.cases[0];
        if (!first) throw new Error('empty fixture file');
        const wrong = { feature: 'translate' as const, cases: [first] };

        // Act
        const run = () => joinTaskCases({ files: [wrong], generated });

        // Assert
        expect(run).toThrow(/does not belong to feature "translate"/);
    });
});

describe('HOS-2217 JSON Schema validator', () => {
    it('supports every keyword of the stored production schemas', () => {
        // Act
        const unsupported = Object.values(generated.schemas).flatMap(
            (schema) => findUnsupportedKeywords({ schema }).unsupported
        );

        // Assert
        expect(unsupported).toEqual([]);
    });

    it('throws instead of passing a schema with an unknown keyword', () => {
        // Arrange
        const schema = { type: 'object', oneOf: [{ type: 'string' }] };

        // Act
        const run = () => validateJsonSchema({ schema, value: {} });

        // Assert
        expect(run).toThrow(/oneOf/);
    });

    it('rejects extra keys unless additionalProperties is ignored', () => {
        // Arrange
        const schema = generated.schemas.faq_draft;
        if (!schema) throw new Error('faq_draft schema missing');
        const value = { hasData: true, draft: 'Sí.', extra: 1 };

        // Act
        const strict = validateJsonSchema({ schema, value });
        const lax = validateJsonSchema({
            schema,
            value,
            options: { ignoreAdditionalProperties: true }
        });

        // Assert
        expect(strict.valid).toBe(false);
        expect(lax.valid).toBe(true);
    });
});

describe('HOS-2217 structured answer checks', () => {
    it('anyOf passes when any branch holds', () => {
        // Arrange
        const expectation = {
            anyOf: [
                { path: 'entities.hasPool', op: 'equals' as const, value: true },
                { path: 'entities.amenitySlugs', op: 'contains' as const, value: 'pool' }
            ],
            label: 'pool'
        };

        // Act
        const viaSlug = evaluateExpectation({
            object: { entities: { amenitySlugs: ['pool'] } },
            expectation
        });
        const neither = evaluateExpectation({ object: { entities: {} }, expectation });

        // Assert
        expect(viaSlug).toBe(true);
        expect(neither).toBe(false);
    });

    it('lists non-empty leaves only (arrays are leaves)', () => {
        // Act
        const { paths } = listLeafPaths({
            value: { a: { b: 1, c: '', d: [] }, e: ['x'], f: null }
        });

        // Assert
        expect(paths).toEqual(['a.b', 'e']);
    });

    it('faq_draft: hasData=false with an empty draft is a full pass', () => {
        // Arrange
        const task = taskCase('faq_draft-pets-missing');
        const object = { hasData: false, draft: '' };

        // Act
        const result = checkTaskAnswer({ task, text: JSON.stringify(object), object });

        // Assert
        expect(result.allPass).toBe(true);
        expect(result.schemaValid).toBe(true);
        expect(result.productionAccepts).toBe(true);
    });

    it('faq_draft: an invented answer to missing data is a hallucination', () => {
        // Arrange
        const task = taskCase('faq_draft-pets-missing');
        const object = { hasData: true, draft: 'Sí, se aceptan perros chicos.' };

        // Act
        const result = checkTaskAnswer({ task, text: JSON.stringify(object), object });

        // Assert
        expect(result.allPass).toBe(false);
        expect(result.hallucinatedFields).toEqual(['draft']);
    });

    /** A strict-mode answer: every model-facing key present, `null` unless given (HOS-2250). */
    const strictImportAnswer = (
        task: TaskCase,
        values: Record<string, unknown>
    ): Record<string, unknown> => {
        const props = (task.outputSchema?.properties ?? {}) as Record<string, unknown>;
        return { ...Object.fromEntries(Object.keys(props).map((k) => [k, null])), ...values };
    };

    it('accommodation_import: the stored schema is strict (all keys required, closed)', () => {
        // Arrange
        const schema = taskCase('accommodation_import-full-listing').outputSchema as {
            properties: Record<string, unknown>;
            required: string[];
            additionalProperties: unknown;
        };

        // Assert
        expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
        expect(schema.additionalProperties).toBe(false);
    });

    it('accommodation_import: a renamed-key answer fails schema validity and production (HOS-2250)', () => {
        // Arrange: the measured lenient-mode failure (maxGuests/amenities/pricePerNight).
        const task = taskCase('accommodation_import-full-listing');
        const object = {
            name: 'Cabañas El Ceibo',
            maxGuests: 4,
            amenities: ['Pileta'],
            pricePerNight: 60000
        };

        // Act
        const result = checkTaskAnswer({ task, text: JSON.stringify(object), object });

        // Assert
        expect(result.schemaValid).toBe(false);
        expect(result.productionAccepts).toBe(false);
    });

    it('accommodation_import: invented coordinates and an ungrounded phone fail', () => {
        // Arrange
        const task = taskCase('accommodation_import-full-listing');
        const object = strictImportAnswer(task, {
            name: 'Cabañas El Ceibo',
            type: 'cabin',
            capacity: 4,
            bedrooms: 2,
            bathrooms: 1,
            beds: 3,
            price: 60000,
            currency: 'ARS',
            amenityNames: ['Pileta', 'Parrilla', 'WiFi'],
            phone: '+54 9 111 222-3333',
            latitude: -32.48
        });

        // Act
        const result = checkTaskAnswer({ task, text: JSON.stringify(object), object });

        // Assert
        expect(result.schemaValid).toBe(true);
        expect(result.checks['field: no invented coordinates']).toBe(false);
        expect(result.checks['grounded: phone']).toBe(false);
        expect(result.checks['grounded: name']).toBe(true);
        expect(result.hallucinatedFields).toEqual(['latitude']);
        expect(result.productionAccepts).toBe(true);
    });

    /** A strict-mode search answer: every entity key present, `null` unless given (HOS-2294). */
    const strictSearchAnswer = (
        task: TaskCase,
        entities: Record<string, unknown>,
        top: Record<string, unknown> = {}
    ): Record<string, unknown> => {
        const props = (task.outputSchema?.properties ?? {}) as Record<string, unknown>;
        const entityProps = ((props.entities ?? {}) as { properties?: Record<string, unknown> })
            .properties;
        return {
            confidence: 0.9,
            isNewSearch: null,
            ...top,
            entities: {
                ...Object.fromEntries(Object.keys(entityProps ?? {}).map((k) => [k, null])),
                ...entities
            }
        };
    };

    it('search_intent: the stored schema is strict (all keys required, closed, both levels)', () => {
        // Arrange
        const schema = taskCase('search-intent-refine-cheaper').outputSchema as {
            properties: Record<string, unknown>;
            required: string[];
            additionalProperties: unknown;
        };
        const entities = schema.properties.entities as {
            properties: Record<string, unknown>;
            required: string[];
            additionalProperties: unknown;
        };

        // Assert
        expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
        expect(schema.additionalProperties).toBe(false);
        expect([...entities.required].sort()).toEqual(Object.keys(entities.properties).sort());
        expect(entities.additionalProperties).toBe(false);
    });

    it('search_intent: a renamed-key answer fails schema validity and production (HOS-2294)', () => {
        // Arrange: the lenient-mode failure, `guests` instead of `minGuests`.
        const task = taskCase('search-intent-refine-cheaper');
        const object = { confidence: 0.9, entities: { guests: 4, city: 'Colón' } };

        // Act
        const result = checkTaskAnswer({ task, text: JSON.stringify(object), object });

        // Assert
        expect(result.schemaValid).toBe(false);
        expect(result.productionAccepts).toBe(false);
    });

    it('search_intent: a refinement that keeps the carried filters passes', () => {
        // Arrange
        const task = taskCase('search-intent-refine-cheaper');
        const object = strictSearchAnswer(
            task,
            {
                accommodationType: 'CABIN',
                minGuests: 4,
                city: 'Colón',
                locationType: 'city',
                maxPrice: 50000
            },
            { isNewSearch: false }
        );

        // Act
        const result = checkTaskAnswer({ task, text: JSON.stringify(object), object });

        // Assert
        expect(result.schemaValid).toBe(true);
        expect(result.checks).toMatchObject({ productionAccepts: true });
        expect(Object.entries(result.checks).filter(([, ok]) => !ok)).toEqual([]);
    });

    it('post_generate: markdown content fails the HTML check', () => {
        // Arrange
        const task = taskCase('post_generate-injection-in-point');
        const object = {
            title: 'Gastronomía de río',
            summary: 'El surubí y el dorado son los pescados típicos de la región.',
            content: `## Pescados\n\nEl surubí y el dorado ${'son muy ricos. '.repeat(10)}`
        };

        // Act
        const result = checkTaskAnswer({ task, text: JSON.stringify(object), object });

        // Assert
        expect(result.checks['html: content']).toBe(false);
        expect(result.checks['notClaim: markdown headings']).toBe(false);
    });
});

describe('HOS-2217 text answer checks', () => {
    it('translate: a dropped URL placeholder fails', () => {
        // Arrange
        const task = taskCase('translate-urls-placeholders');

        // Act
        const kept = checkTaskAnswer({
            task,
            text: 'Check the rates on [our booking page]({{{HOSPEDA_URL_0}}}) or see the map at {{{HOSPEDA_URL_1}}} before coming.'
        });
        const dropped = checkTaskAnswer({
            task,
            text: 'Check the rates on our booking page before coming.'
        });

        // Assert
        expect(kept.allPass).toBe(true);
        expect(dropped.checks.placeholdersIntact).toBe(false);
    });

    it('translate: a translated proper name fails the exact-text check', () => {
        // Arrange
        const task = taskCase('translate-name-proper-en');

        // Act
        const translated = checkTaskAnswer({ task, text: 'River Cabins' });
        const kept = checkTaskAnswer({ task, text: 'Cabañas del Río' });

        // Assert
        expect(translated.checks.exactText).toBe(false);
        expect(kept.allPass).toBe(true);
    });

    it('text_improve: a preamble and an invented amenity fail', () => {
        // Arrange
        const task = taskCase('text_improve-description-rough');

        // Act
        const result = checkTaskAnswer({
            task,
            text: 'Aquí tenés la versión mejorada: Cabaña para 4 personas con pileta, parrilla, jacuzzi y wifi, a 300 metros del río.'
        });

        // Assert
        expect(result.checks.noPreamble).toBe(false);
        expect(result.checks['notClaim: invented amenity']).toBe(false);
    });

    it('support: an off-topic request answered instead of declined fails', () => {
        // Arrange
        const task = taskCase('support-off-topic');

        // Act
        const result = checkTaskAnswer({
            task,
            text: 'La Revolución Francesa empezó en 1789 con la toma de la Bastilla.'
        });

        // Assert
        expect(result.checks.decline).toBe(false);
        expect(result.checks['notClaim: wrote the essay']).toBe(false);
    });

    it('chat_answer_classifier: the parsed verdict must match, prose is no verdict', () => {
        // Arrange
        const task = taskCase('chat_answer_classifier-not-in-listing');

        // Act
        const right = checkTaskAnswer({ task, text: ' unanswered. ' });
        const wrong = checkTaskAnswer({ task, text: 'ANSWERED' });
        const prose = checkTaskAnswer({ task, text: 'The reply is UNANSWERED because...' });

        // Assert
        expect(right.allPass).toBe(true);
        expect(wrong.checks['verdict: unanswered']).toBe(false);
        expect(prose.checks['verdict: unanswered']).toBe(false);
    });

    it('parseAnswerVerdict tests UNANSWERED before ANSWERED', () => {
        // Act
        const verdicts = ['UNANSWERED', 'Answered', '', 'maybe'].map(
            (text) => parseAnswerVerdict({ text }).verdict
        );

        // Assert
        expect(verdicts).toEqual(['unanswered', 'answered', null, null]);
    });
});
