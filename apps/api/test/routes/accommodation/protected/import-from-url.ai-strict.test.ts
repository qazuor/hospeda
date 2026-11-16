/**
 * HOS-2250: the accommodation import runs under OpenAI strict structured outputs.
 *
 * Without strict mode the model renamed keys (`maxGuests`, `amenities`,
 * `pricePerNight`, `address`) and the lenient parse silently dropped them, so
 * imports lost capacity, price, amenities and address. Strict mode only accepts
 * a schema whose every property is required (nullable instead of optional) and
 * every object closed (`additionalProperties: false`). These tests pin:
 *
 *   - the JSON Schema the AI SDK actually sends for the model-facing schema
 *     (converted with `zodSchema()`, the same path the OpenAI adapter uses);
 *   - the `null` -> absent normalizer that keeps the downstream pipeline
 *     unchanged for real values;
 *   - that the normalized answer maps exactly like the old "omitted" answer.
 */

import { describe, expect, it } from 'vitest';
import { toSdkJsonSchema } from '../../../../../../packages/ai-core/scripts/ai-sweep/sdk-json-schema.js';
import {
    AccommodationImportAiModelOutputSchema,
    AccommodationImportAiOutputSchema,
    mapAiOutputToRawExtraction,
    nullFieldsToUndefined
} from '../../../../src/routes/accommodation/protected/import-from-url.ai';

type JsonNode = Readonly<Record<string, unknown>>;

const isRecord = (v: unknown): v is JsonNode =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keywords OpenAI strict mode rejects or that signal a non-strict-safe Zod construct. */
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

/** True when a property schema admits JSON `null`. */
const allowsNull = (node: JsonNode): boolean => {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (types.includes('null')) return true;
    return Array.isArray(node.anyOf) && node.anyOf.some((o) => isRecord(o) && allowsNull(o));
};

describe('HOS-2250 model-facing schema is OpenAI-strict', () => {
    const { jsonSchema } = toSdkJsonSchema({ schema: AccommodationImportAiModelOutputSchema });

    it('every object level requires all its properties and forbids additional ones', () => {
        // Arrange
        const objects = collectNodes(jsonSchema).filter((n) => isRecord(n.properties));

        // Act / Assert
        expect(objects.length).toBeGreaterThan(0);
        for (const node of objects) {
            const keys = Object.keys(node.properties as JsonNode).sort();
            expect([...((node.required as string[] | undefined) ?? [])].sort()).toEqual(keys);
            expect(node.additionalProperties).toBe(false);
        }
    });

    it('every top-level property is nullable, so the model can say "not found"', () => {
        // Arrange
        const props = jsonSchema.properties as Record<string, JsonNode>;

        // Act
        const notNullable = Object.entries(props)
            .filter(([, node]) => !allowsNull(node))
            .map(([key]) => key);

        // Assert
        expect(Object.keys(props).length).toBe(21);
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

    it('the model-facing and downstream schemas cover exactly the same fields', () => {
        // Assert
        expect(Object.keys(AccommodationImportAiModelOutputSchema.shape).sort()).toEqual(
            Object.keys(AccommodationImportAiOutputSchema.shape).sort()
        );
    });

    it('rejects a renamed key answer the old lenient schema silently accepted', () => {
        // Arrange: the measured failure mode (gpt-5.4-nano, gpt-6-luna effort none).
        const renamed = { name: 'Cabaña', maxGuests: 4, amenities: ['Wifi'], pricePerNight: 100 };

        // Act / Assert
        expect(AccommodationImportAiModelOutputSchema.safeParse(renamed).success).toBe(false);
        expect(AccommodationImportAiOutputSchema.safeParse(renamed).success).toBe(true);
    });
});

describe('nullFieldsToUndefined', () => {
    it('drops null fields and keeps real values, falsy ones included', () => {
        // Arrange
        const value = {
            name: 'Casa',
            capacity: 0,
            street: '',
            amenityNames: [],
            price: null,
            website: null
        };

        // Act
        const result = nullFieldsToUndefined({ value }).value;

        // Assert
        expect(result).toEqual({ name: 'Casa', capacity: 0, street: '', amenityNames: [] });
        expect(Object.keys(result as object)).not.toContain('price');
        expect(value.price).toBeNull();
    });

    it('recurses into nested objects and objects inside arrays', () => {
        // Arrange
        const value = {
            location: { street: 'San Martín', number: null, geo: { lat: -32.4, long: null } },
            rooms: [{ beds: 2, bathrooms: null }, 'x', null]
        };

        // Act
        const result = nullFieldsToUndefined({ value }).value;

        // Assert
        expect(result).toEqual({
            location: { street: 'San Martín', geo: { lat: -32.4 } },
            rooms: [{ beds: 2 }, 'x', null]
        });
    });

    it('passes scalars and null through unchanged', () => {
        // Act / Assert
        expect(nullFieldsToUndefined({ value: null }).value).toBeNull();
        expect(nullFieldsToUndefined({ value: 'text' }).value).toBe('text');
        expect(nullFieldsToUndefined({ value: 3 }).value).toBe(3);
    });
});

describe('strict answer -> pipeline, end to end', () => {
    it('a strict all-keys answer maps exactly like the old answer that omitted unknown fields', () => {
        // Arrange
        const strictAnswer = Object.fromEntries(
            Object.keys(AccommodationImportAiModelOutputSchema.shape).map((key) => [key, null])
        ) as Record<string, unknown>;
        Object.assign(strictAnswer, {
            name: 'Cabaña del Río',
            capacity: 4,
            price: 120,
            currency: 'USD',
            street: 'Ruta 14',
            streetNumber: '123',
            amenityNames: ['Wifi', 'Pileta']
        });
        const omittedAnswer = {
            name: 'Cabaña del Río',
            capacity: 4,
            price: 120,
            currency: 'USD',
            street: 'Ruta 14',
            streetNumber: '123',
            amenityNames: ['Wifi', 'Pileta']
        };

        // Act
        expect(AccommodationImportAiModelOutputSchema.safeParse(strictAnswer).success).toBe(true);
        const parsed = AccommodationImportAiOutputSchema.safeParse(
            nullFieldsToUndefined({ value: strictAnswer }).value
        );

        // Assert
        expect(parsed.success).toBe(true);
        const raw = mapAiOutputToRawExtraction(parsed.success ? parsed.data : {});
        expect(raw).toEqual(mapAiOutputToRawExtraction(omittedAnswer));
        expect(raw.extraInfo?.capacity).toEqual({ value: 4, source: 'ai' });
        expect(raw.price).toEqual({
            price: { value: 120, source: 'ai' },
            currency: { value: 'USD', source: 'ai' }
        });
        expect(raw.amenityNames).toEqual(['Wifi', 'Pileta']);
        expect(raw.location?.street).toEqual({ value: 'Ruta 14', source: 'ai' });
        expect(raw).not.toHaveProperty('seo');
        expect(raw).not.toHaveProperty('contactInfo');
    });

    it('an all-null answer maps to an empty extraction, not a failure', () => {
        // Arrange
        const allNull = Object.fromEntries(
            Object.keys(AccommodationImportAiModelOutputSchema.shape).map((key) => [key, null])
        );

        // Act
        const parsed = AccommodationImportAiOutputSchema.safeParse(
            nullFieldsToUndefined({ value: allNull }).value
        );

        // Assert
        expect(parsed.success).toBe(true);
        expect(mapAiOutputToRawExtraction(parsed.success ? parsed.data : {})).toEqual({
            sourcePlatform: 'generic'
        });
    });
});
