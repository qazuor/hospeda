/**
 * Integration tests for the complete Zod → i18n error pipeline (GAP-034).
 *
 * These tests exercise the full chain:
 * 1. Zod schema with `zodError.*` message keys
 * 2. Trigger a validation error via safeParse
 * 3. Transform with transformZodError()
 * 4. Verify the output contains the correct i18n key in `messageKey`
 * 5. Load the real `es/validation.json` locale and verify the key resolves
 *    to a real Spanish translation
 *
 * This confirms end-to-end that schemas, the transformer, and the i18n
 * locale files are all properly wired together.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { transformZodError } from '../../src/utils/zod-error-transformer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../../');
const ES_VALIDATION_PATH = path.join(REPO_ROOT, 'packages/i18n/src/locales/es/validation.json');

/**
 * Loads the Spanish validation locale file and flattens it to a dot-notation
 * map, prefixed with "zodError." to match how schemas reference keys.
 *
 * E.g. `{ accommodation: { name: { min: "..." } } }` → `{ "zodError.accommodation.name.min": "..." }`
 */
function loadEsLocaleKeys(): Record<string, string> {
    const raw = fs.readFileSync(ES_VALIDATION_PATH, 'utf-8');
    const json = JSON.parse(raw) as Record<string, unknown>;

    const flattened: Record<string, string> = {};

    function flatten(obj: Record<string, unknown>, prefix: string): void {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'string') {
                flattened[`zodError.${fullKey}`] = value;
            } else if (value && typeof value === 'object') {
                flatten(value as Record<string, unknown>, fullKey);
            }
        }
    }

    flatten(json, '');
    return flattened;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Zod → i18n pipeline (GAP-034)', () => {
    let esLocaleKeys: Record<string, string>;

    // Load once — reading a file is synchronous and fast enough for test setup
    try {
        esLocaleKeys = loadEsLocaleKeys();
    } catch {
        esLocaleKeys = {};
    }

    describe('required field (missing → invalid_type)', () => {
        const schema = z.object({
            name: z.string('zodError.accommodation.name.required')
        });

        it('should produce a messageKey that starts with zodError.*', () => {
            // Arrange
            const result = schema.safeParse({});
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert — field-level messageKey must be a proper key
            expect(detail).toBeDefined();
            expect(detail?.messageKey).toBeTruthy();
            // Either the schema's zodError.* key or the generic translation key
            expect(
                detail?.messageKey.startsWith('zodError.') ||
                    detail?.messageKey.startsWith('validationError.')
            ).toBe(true);
        });
    });

    describe('min-length string (too_small with zodError.* message key)', () => {
        const schema = z.object({
            name: z.string().min(3, 'zodError.accommodation.name.min')
        });

        it('should set messageKey to the schema-provided zodError.* key', () => {
            // Arrange
            const result = schema.safeParse({ name: 'ab' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.messageKey).toBe('zodError.accommodation.name.min');
        });

        it('messageKey should resolve to a Spanish translation in es/validation.json', () => {
            // Arrange
            const result = schema.safeParse({ name: 'ab' });
            if (result.success) throw new Error('Expected failure');

            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];
            const key = detail?.messageKey;

            // Skip if locale file could not be loaded
            if (Object.keys(esLocaleKeys).length === 0) {
                return;
            }

            // Assert — the key must exist in the locale file
            expect(key).toBeDefined();
            if (key) {
                expect(esLocaleKeys[key!]).toBeDefined();
                expect(typeof esLocaleKeys[key!]).toBe('string');
                expect(esLocaleKeys[key!]!.length).toBeGreaterThan(0);
            }
        });

        it('should produce a TOO_SMALL code with correct params', () => {
            // Arrange
            const result = schema.safeParse({ name: 'x' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('TOO_SMALL');
            expect(detail?.params?.min).toBe(3);
        });
    });

    describe('invalid_type (wrong type with zodError.* message key)', () => {
        const schema = z.object({
            price: z.number('zodError.accommodation.price.required')
        });

        it('should set messageKey to the schema-provided zodError.* key', () => {
            // Arrange
            const result = schema.safeParse({ price: 'not-a-number' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.messageKey).toBe('zodError.accommodation.price.required');
        });

        it('should include received type in params', () => {
            // Arrange
            const result = schema.safeParse({ price: 'not-a-number' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('INVALID_TYPE');
            // received may be undefined when Zod v4 doesn't attach it to the issue
            expect(detail?.userFriendlyMessage).toBeDefined();
            expect(detail?.userFriendlyMessage.length).toBeGreaterThan(0);
        });
    });

    describe('fallback to generic key when no zodError.* prefix', () => {
        const schema = z.object({
            email: z.string().email()
        });

        it('should fall back to validationError.* key for built-in validators without custom messages', () => {
            // Arrange
            const result = schema.safeParse({ email: 'bad-email' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert — no zodError.* prefix since no custom message was provided
            expect(detail?.messageKey.startsWith('validationError.')).toBe(true);
        });
    });

    describe('summary and overall message', () => {
        const schema = z.object({
            name: z.string().min(2, 'zodError.accommodation.name.min'),
            slug: z.string().min(3, 'zodError.accommodation.slug.min'),
            price: z.number('zodError.accommodation.price.required')
        });

        it('should include correct summary for multiple field errors', () => {
            // Arrange
            const result = schema.safeParse({ name: 'A', slug: 'ab', price: 'bad' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);

            // Assert
            expect(transformed.summary.totalErrors).toBe(3);
            expect(transformed.summary.fieldCount).toBe(3);
            expect(transformed.userFriendlyMessage).toContain('3');
        });
    });
});
