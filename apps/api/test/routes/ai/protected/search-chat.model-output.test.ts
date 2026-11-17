/**
 * HOS-2294: the conversational AI search runs under OpenAI strict structured
 * outputs.
 *
 * Without strict mode the model could rename a filter key (`guests` for
 * `minGuests`) and the lenient parse silently dropped it, so the filter was
 * lost with no error. These tests pin:
 *
 *   - the regression itself (the old lenient parse accepts a misnamed key and
 *     returns nothing; the model-facing schema rejects it);
 *   - the JSON Schema the AI SDK actually sends (every object closed, every
 *     property required and nullable, no strict-unsafe keyword);
 *   - key parity with the canonical `SearchIntentEntitiesSchema`;
 *   - the `null` -> absent normalizer and its per-field handling of invalid
 *     values (HOS-207: one bad value must never fail the whole search).
 */

import { SearchIntentEntitiesSchema, SearchIntentOutputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { toSdkJsonSchema } from '../../../../../../packages/ai-core/scripts/ai-sweep/sdk-json-schema.js';
import {
    normalizeSearchModelOutput,
    SearchIntentModelOutputSchema
} from '../../../../src/routes/ai/protected/search-chat.model-output';

type JsonNode = Readonly<Record<string, unknown>>;

const isRecord = (v: unknown): v is JsonNode =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const STRICT_UNSAFE_KEYWORDS = [
    'default',
    'format',
    'oneOf',
    'allOf',
    'not',
    'patternProperties',
    'propertyNames',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'pattern'
] as const;

/** Every schema node reachable through properties, items and anyOf. */
function collectNodes(root: JsonNode): JsonNode[] {
    const out: JsonNode[] = [];
    const walk = (node: unknown): void => {
        if (!isRecord(node)) return;
        out.push(node);
        if (isRecord(node.properties))
            for (const child of Object.values(node.properties)) walk(child);
        if (node.items !== undefined) walk(node.items);
        if (Array.isArray(node.anyOf)) for (const child of node.anyOf) walk(child);
    };
    walk(root);
    return out;
}

const allowsNull = (node: JsonNode): boolean => {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (types.includes('null')) return true;
    return Array.isArray(node.anyOf) && node.anyOf.some((o) => isRecord(o) && allowsNull(o));
};

/** A strict-mode answer: every entity key present, `null` unless given. */
const strictAnswer = (
    entities: Record<string, unknown>,
    top: Record<string, unknown> = {}
): Record<string, unknown> => ({
    confidence: 0.9,
    isNewSearch: null,
    ...top,
    entities: {
        ...Object.fromEntries(
            Object.keys(SearchIntentModelOutputSchema.shape.entities.shape).map((k) => [k, null])
        ),
        ...entities
    }
});

describe('HOS-2294 regression: a misnamed filter key', () => {
    const misnamed = { confidence: 0.9, entities: { guests: 4, maxPeople: 6 } };

    it('the old lenient parse accepted it and silently lost the filter (the bug)', () => {
        // Act
        const parsed = SearchIntentOutputSchema.safeParse(misnamed);

        // Assert: accepted, with no guest filter at all and no error.
        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.entities).toEqual({});
    });

    it('the model-facing schema rejects it, so strict decoding cannot emit it', () => {
        // Act
        const parsed = SearchIntentModelOutputSchema.safeParse(misnamed);

        // Assert
        expect(parsed.success).toBe(false);
    });
});

describe('HOS-2294 model-facing schema is OpenAI-strict', () => {
    const { jsonSchema } = toSdkJsonSchema({ schema: SearchIntentModelOutputSchema });

    it('every object level requires all its properties and forbids additional ones', () => {
        // Arrange
        const objects = collectNodes(jsonSchema).filter((n) => isRecord(n.properties));

        // Assert
        expect(objects.length).toBeGreaterThanOrEqual(2);
        for (const node of objects) {
            const keys = Object.keys(node.properties as JsonNode).sort();
            expect([...((node.required as string[] | undefined) ?? [])].sort()).toEqual(keys);
            expect(node.additionalProperties).toBe(false);
        }
    });

    it('every property at both levels is nullable', () => {
        // Arrange
        const top = jsonSchema.properties as Record<string, JsonNode>;
        const entities = (top.entities as JsonNode).properties as Record<string, JsonNode>;

        // Act
        const notNullable = [
            ...Object.entries(top).filter(([k]) => k !== 'entities'),
            ...Object.entries(entities)
        ]
            .filter(([, node]) => !allowsNull(node))
            .map(([key]) => key);

        // Assert
        expect(notNullable).toEqual([]);
    });

    it('uses no keyword strict mode rejects (defaults, formats, bounds, combinators)', () => {
        // Act
        const used = collectNodes(jsonSchema).flatMap((node) =>
            STRICT_UNSAFE_KEYWORDS.filter((k) => k in node)
        );

        // Assert
        expect(used).toEqual([]);
    });

    it('entity keys equal the canonical SearchIntentEntitiesSchema keys (no drift either way)', () => {
        // Act
        const model = Object.keys(SearchIntentModelOutputSchema.shape.entities.shape).sort();
        const canonical = Object.keys(SearchIntentEntitiesSchema.shape).sort();

        // Assert
        expect(model).toEqual(canonical);
    });
});

describe('HOS-2294 normalizeSearchModelOutput', () => {
    it('drops null slots and keeps real values, including 0 and false', () => {
        // Arrange
        const answer = strictAnswer({
            minGuests: 4,
            hasPool: false,
            radius: 0,
            amenitySlugs: []
        });

        // Act
        const out = normalizeSearchModelOutput({ value: answer });

        // Assert
        expect(out.entities).toEqual({
            minGuests: 4,
            hasPool: false,
            radius: 0,
            amenitySlugs: []
        });
        expect(out.droppedFields).toEqual([]);
    });

    it('an all-null answer yields an empty entity bag', () => {
        // Act
        const out = normalizeSearchModelOutput({ value: strictAnswer({}) });

        // Assert
        expect(out.entities).toEqual({});
    });

    it('an out-of-range or malformed slot is dropped alone; the other filters survive', () => {
        // Arrange: minGuests 0 (<1), latitude 200, destinationId not a UUID, valid type and price.
        const answer = strictAnswer({
            minGuests: 0,
            latitude: 200,
            destinationId: 'not-a-uuid',
            accommodationType: 'CABIN',
            maxPrice: 50000,
            hasWifi: true
        });

        // Act
        const out = normalizeSearchModelOutput({ value: answer });

        // Assert
        expect(out.entities).toEqual({
            accommodationType: 'CABIN',
            maxPrice: 50000,
            hasWifi: true
        });
        expect([...out.droppedFields].sort()).toEqual(['destinationId', 'latitude', 'minGuests']);
    });

    it('a non-integer count is dropped, not rounded', () => {
        // Act
        const out = normalizeSearchModelOutput({ value: strictAnswer({ minGuests: 2.5 }) });

        // Assert
        expect(out.entities.minGuests).toBeUndefined();
        expect(out.droppedFields).toEqual(['minGuests']);
    });

    it('an unknown key is dropped and reported', () => {
        // Act
        const out = normalizeSearchModelOutput({
            value: { confidence: 1, entities: { guests: 4, minGuests: 2 } }
        });

        // Assert
        expect(out.entities).toEqual({ minGuests: 2 });
        expect(out.droppedFields).toEqual(['guests']);
    });

    it('clamps confidence to [0, 1] and reads null or missing as 0', () => {
        // Act / Assert
        const confidenceOf = (confidence: unknown) =>
            normalizeSearchModelOutput({ value: { confidence, entities: {} } }).confidence;
        expect(confidenceOf(1.7)).toBe(1);
        expect(confidenceOf(-0.2)).toBe(0);
        expect(confidenceOf(0.4)).toBe(0.4);
        expect(confidenceOf(null)).toBe(0);
        expect(confidenceOf(undefined)).toBe(0);
        expect(confidenceOf('0.9')).toBe(0);
    });

    it('keeps isNewSearch three-state: true, false, and undefined for null/missing', () => {
        // Act / Assert
        const flag = (isNewSearch: unknown) =>
            normalizeSearchModelOutput({ value: { confidence: 1, isNewSearch, entities: {} } })
                .isNewSearch;
        expect(flag(true)).toBe(true);
        expect(flag(false)).toBe(false);
        expect(flag(null)).toBeUndefined();
        expect(flag(undefined)).toBeUndefined();
    });

    it('tolerates a non-object answer without throwing', () => {
        // Act
        const out = normalizeSearchModelOutput({ value: 'not an object' });

        // Assert
        expect(out).toEqual({
            confidence: 0,
            isNewSearch: undefined,
            entities: {},
            droppedFields: []
        });
    });
});
