/**
 * Unit tests for `createOpenAPISchema` (HOS-106).
 *
 * The utility rebuilds each ZodObject via `z.object(newShape)` to convert
 * `z.date()` fields into OpenAPI-renderable `z.string().datetime()`. A bare
 * `z.object()` defaults to `unknownKeys: 'strip'`, so the rebuild used to
 * silently drop `.strict()` / `.passthrough()` from the source schema. Because
 * route-factory feeds this rebuilt copy to BOTH the OpenAPI doc AND the runtime
 * body validator, losing `.strict()` meant ~25 endpoints accepted-and-stripped
 * unknown fields instead of rejecting them with 400.
 *
 * These tests pin that the unknown-keys mode survives the rebuild, and that the
 * date conversion the utility exists for still works alongside it.
 */

import { z } from '@hono/zod-openapi';
import { describe, expect, it } from 'vitest';
import { createOpenAPISchema } from '../../src/utils/openapi-schema';

describe('createOpenAPISchema — unknown-keys mode preservation (HOS-106)', () => {
    it('preserves .strict(): rebuilt schema rejects unknown keys', () => {
        const source = z.object({ a: z.string() }).strict();

        const rebuilt = createOpenAPISchema(source);

        expect(rebuilt.safeParse({ a: 'x' }).success).toBe(true);
        expect(rebuilt.safeParse({ a: 'x', unknown: 'boom' }).success).toBe(false);
    });

    it('preserves .passthrough(): rebuilt schema keeps unknown keys', () => {
        const source = z.object({ a: z.string() }).passthrough();

        const rebuilt = createOpenAPISchema(source);
        const parsed = rebuilt.parse({ a: 'x', extra: 1 }) as Record<string, unknown>;

        expect(parsed).toEqual({ a: 'x', extra: 1 });
    });

    it('keeps default strip behavior for a plain object', () => {
        const source = z.object({ a: z.string() });

        const rebuilt = createOpenAPISchema(source);
        const parsed = rebuilt.parse({ a: 'x', extra: 1 }) as Record<string, unknown>;

        // Unknown key silently dropped — the pre-existing, intended default.
        expect(parsed).toEqual({ a: 'x' });
    });

    it('preserves a custom .catchall() validator on the rebuilt object', () => {
        // A non-never/unknown catchall constrains unknown keys to a type. It must
        // survive the rebuild verbatim, not collapse to strip (HOS-106).
        const source = z.object({ a: z.string() }).catchall(z.boolean());

        const rebuilt = createOpenAPISchema(source);

        // Unknown key that satisfies the catchall type is accepted...
        expect(rebuilt.safeParse({ a: 'x', extra: true }).success).toBe(true);
        // ...one that violates it is rejected (would pass if downgraded to strip).
        expect(rebuilt.safeParse({ a: 'x', extra: 'not-a-boolean' }).success).toBe(false);
    });

    it('preserves .strict() on a nested object', () => {
        const source = z.object({
            nested: z.object({ b: z.string() }).strict()
        });

        const rebuilt = createOpenAPISchema(source);

        expect(rebuilt.safeParse({ nested: { b: 'x' } }).success).toBe(true);
        expect(rebuilt.safeParse({ nested: { b: 'x', bad: 1 } }).success).toBe(false);
    });

    it('still converts z.date() fields to string datetime while preserving strict', () => {
        const source = z
            .object({
                a: z.string(),
                when: z.date()
            })
            .strict();

        const rebuilt = createOpenAPISchema(source) as z.ZodObject<z.ZodRawShape>;

        // Date field now accepts an ISO string (OpenAPI-renderable form)...
        expect(rebuilt.safeParse({ a: 'x', when: '2024-07-15T18:00:00Z' }).success).toBe(true);
        // ...a real Date is no longer the accepted shape post-conversion...
        expect(rebuilt.safeParse({ a: 'x', when: new Date() }).success).toBe(false);
        // ...and strict rejection still applies to unknown keys.
        expect(rebuilt.safeParse({ a: 'x', when: '2024-07-15T18:00:00Z', extra: 1 }).success).toBe(
            false
        );
    });

    it('leaves a refined (ZodEffects) schema as-is, keeping its strict validation', () => {
        // Top-level .refine() wraps the object in ZodEffects, which the utility
        // returns unchanged — so its .strict() was never lost even before the fix.
        const source = z
            .object({ a: z.string() })
            .strict()
            .refine((v) => v.a.length > 0, 'a required');

        const rebuilt = createOpenAPISchema(source);

        expect(rebuilt.safeParse({ a: 'x' }).success).toBe(true);
        expect(rebuilt.safeParse({ a: 'x', extra: 1 }).success).toBe(false);
    });
});
