/**
 * Unit tests for AI intent envelope Zod schemas (SPEC-173).
 *
 * Coverage:
 *   - AiIntentSchema: valid envelope; confidence [0,1] bounds; missing fields;
 *                     empty entities (valid); extension via .extend().
 *   - ExtractIntentResponseSchema: alias of AiIntentSchema — same tests apply.
 *
 * @module test/entities/ai/ai-intent.schema.test
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    AiIntentSchema,
    ExtractIntentResponseSchema
} from '../../../src/entities/ai/ai-intent.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validIntent = {
    kind: 'search',
    confidence: 0.87,
    entities: { location: 'Colón', guests: 2 },
    rawQuery: 'alojamiento para 2 personas en Colón'
};

// ---------------------------------------------------------------------------
// AiIntentSchema
// ---------------------------------------------------------------------------

describe('AiIntentSchema', () => {
    it('accepts a valid intent envelope', () => {
        // Arrange + Act
        const result = AiIntentSchema.safeParse(validIntent);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.kind).toBe('search');
            expect(result.data.confidence).toBe(0.87);
            expect(result.data.rawQuery).toBe('alojamiento para 2 personas en Colón');
        }
    });

    it('accepts confidence at the lower boundary (0)', () => {
        const result = AiIntentSchema.safeParse({ ...validIntent, confidence: 0 });
        expect(result.success).toBe(true);
    });

    it('accepts confidence at the upper boundary (1)', () => {
        const result = AiIntentSchema.safeParse({ ...validIntent, confidence: 1 });
        expect(result.success).toBe(true);
    });

    it('rejects confidence below 0', () => {
        const result = AiIntentSchema.safeParse({ ...validIntent, confidence: -0.01 });
        expect(result.success).toBe(false);
    });

    it('rejects confidence above 1', () => {
        const result = AiIntentSchema.safeParse({ ...validIntent, confidence: 1.01 });
        expect(result.success).toBe(false);
    });

    it('accepts an empty entities object (no slots extracted)', () => {
        // Low confidence + empty entities is valid structurally — the engine
        // decides what to do with a low-confidence empty intent.
        const result = AiIntentSchema.safeParse({ ...validIntent, entities: {}, confidence: 0.1 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.entities).toEqual({});
        }
    });

    it('accepts entities with heterogeneous value types (Record<string, unknown>)', () => {
        const result = AiIntentSchema.safeParse({
            ...validIntent,
            entities: {
                location: 'Gualeguaychú',
                guests: 4,
                amenities: ['wifi', 'pool'],
                checkIn: null,
                priceMax: 15000.5
            }
        });
        expect(result.success).toBe(true);
    });

    it('rejects an empty kind string', () => {
        const result = AiIntentSchema.safeParse({ ...validIntent, kind: '' });
        expect(result.success).toBe(false);
    });

    it('rejects an empty rawQuery string', () => {
        const result = AiIntentSchema.safeParse({ ...validIntent, rawQuery: '' });
        expect(result.success).toBe(false);
    });

    it('rejects a missing kind field', () => {
        const { kind: _, ...withoutKind } = validIntent;
        const result = AiIntentSchema.safeParse(withoutKind);
        expect(result.success).toBe(false);
    });

    it('rejects a missing confidence field', () => {
        const { confidence: _, ...withoutConfidence } = validIntent;
        const result = AiIntentSchema.safeParse(withoutConfidence);
        expect(result.success).toBe(false);
    });

    it('rejects a missing entities field', () => {
        const { entities: _, ...withoutEntities } = validIntent;
        const result = AiIntentSchema.safeParse(withoutEntities);
        expect(result.success).toBe(false);
    });

    it('rejects a missing rawQuery field', () => {
        const { rawQuery: _, ...withoutRaw } = validIntent;
        const result = AiIntentSchema.safeParse(withoutRaw);
        expect(result.success).toBe(false);
    });

    it('does not reject extra fields (base schema is not strict — allows .extend())', () => {
        // The base schema is open so that child specs can extend it with
        // additional fields using .extend(). Unknown keys should pass through.
        const result = AiIntentSchema.safeParse({
            ...validIntent,
            facets: ['price', 'location'] // extended by child spec
        });
        expect(result.success).toBe(true);
    });

    it('supports child-spec extension via .extend() with a literal kind and typed entities', () => {
        // Arrange: simulate a child-spec-B search intent extension
        const SearchIntentSchema = AiIntentSchema.extend({
            kind: z.literal('search'),
            entities: z.object({
                location: z.string().optional(),
                guests: z.number().int().min(1).optional()
            })
        });

        const input = {
            kind: 'search',
            confidence: 0.9,
            entities: { location: 'Colón', guests: 2 },
            rawQuery: 'cabin in Colón for 2'
        };

        // Act
        const result = SearchIntentSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.kind).toBe('search');
            expect(result.data.entities.location).toBe('Colón');
        }
    });

    it('rejects wrong kind literal in a child extension', () => {
        const ChatIntentSchema = AiIntentSchema.extend({ kind: z.literal('chat_query') });
        const result = ChatIntentSchema.safeParse({ ...validIntent, kind: 'search' });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ExtractIntentResponseSchema
// ---------------------------------------------------------------------------

describe('ExtractIntentResponseSchema', () => {
    it('is structurally identical to AiIntentSchema', () => {
        // ExtractIntentResponseSchema is an alias for AiIntentSchema.
        // Verifying they parse the same input consistently.
        const withAiIntent = AiIntentSchema.safeParse(validIntent);
        const withResponse = ExtractIntentResponseSchema.safeParse(validIntent);
        expect(withAiIntent.success).toBe(withResponse.success);
        if (withAiIntent.success && withResponse.success) {
            expect(withAiIntent.data).toEqual(withResponse.data);
        }
    });

    it('rejects the same invalid input that AiIntentSchema rejects', () => {
        const invalid = { kind: '', confidence: 2, entities: {}, rawQuery: '' };
        expect(AiIntentSchema.safeParse(invalid).success).toBe(false);
        expect(ExtractIntentResponseSchema.safeParse(invalid).success).toBe(false);
    });
});
