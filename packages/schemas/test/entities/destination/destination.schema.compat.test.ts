/**
 * Schema compatibility test for `entities/destination/destination.schema.ts`.
 *
 * Enforces the additive-only schema compatibility policy documented in
 * `packages/schemas/docs/guides/schema-compat-policy.md`: the historic shape
 * captured under `test/fixtures/historic/destination.historic.ts` MUST still
 * `safeParse` against the current `DestinationSchema` after SPEC-158 added the
 * optional `faqs` array and relaxed `description` from .max(2000) to .max(8000).
 *
 * Also pins the new `description` boundary (8000 valid, 8001 rejected).
 */
import { describe, expect, it } from 'vitest';
import { DestinationSchema } from '../../../src/entities/destination/destination.schema.js';
import { createValidDestination } from '../../fixtures/destination.fixtures.js';
import { destinationPreSpec158 } from '../../fixtures/historic/destination.historic.js';

describe('destination.schema compat — historic fixture still parses', () => {
    it('parses the pre-SPEC-158 destination (no faqs, ~2000-char description)', () => {
        const result = DestinationSchema.safeParse(destinationPreSpec158);
        expect(result.success).toBe(true);
    });

    it('treats faqs as optional (absent in historic payloads)', () => {
        const result = DestinationSchema.safeParse(destinationPreSpec158);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.faqs).toBeUndefined();
        }
    });
});

describe('DestinationSchema.description max (SPEC-158: 2000 -> 8000)', () => {
    it('accepts a description at the 8000-char maximum', () => {
        const result = DestinationSchema.safeParse({
            ...createValidDestination(),
            description: 'a'.repeat(8000)
        });
        expect(result.success).toBe(true);
    });

    it('rejects a description longer than 8000 chars', () => {
        const result = DestinationSchema.safeParse({
            ...createValidDestination(),
            description: 'a'.repeat(8001)
        });
        expect(result.success).toBe(false);
    });
});
