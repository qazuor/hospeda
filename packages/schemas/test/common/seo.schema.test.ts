/**
 * @file seo.schema.test.ts
 * @description Behaviour of the shared `SeoSchema` bounds (HOS-792).
 *
 * The interesting case is the EMPTY STRING, which is neither "a short title"
 * nor the same thing as an absent key from the caller's point of view:
 *
 * - Absent key → "do not touch whatever is stored".
 * - `''` → "remove the override; fall back to the computed default".
 *
 * Rejecting `''` made the second one unreachable. The host editor sends a diff
 * of changed fields, so clearing a saved override puts `''` on the wire, and
 * `.min(30)` refused it — the field could be filled but never emptied again.
 *
 * The bounds themselves still apply to every non-empty value, and these tests
 * pin both sides of each boundary so relaxing the minimum by accident fails
 * here rather than in a smoke session.
 */
import { describe, expect, it } from 'vitest';
import { SeoSchema } from '../../src/common/seo.schema.js';

/** First error code produced for a field, or `undefined` when it parsed. */
function errorCodeFor({
    input,
    field
}: {
    readonly input: unknown;
    readonly field: 'title' | 'description';
}): string | undefined {
    const result = SeoSchema.safeParse(input);
    if (result.success) return undefined;
    return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('SeoSchema', () => {
    describe('the empty string means "no override"', () => {
        it('should accept an empty title', () => {
            expect(SeoSchema.safeParse({ title: '' }).success).toBe(true);
        });

        it('should accept an empty description', () => {
            expect(SeoSchema.safeParse({ description: '' }).success).toBe(true);
        });

        it('should accept both fields empty at once', () => {
            const result = SeoSchema.safeParse({ title: '', description: '' });

            expect(result.success).toBe(true);
            if (result.success) {
                // Preserved rather than stripped: the caller is clearing the
                // stored value, and a dropped key would mean "leave it alone".
                expect(result.data).toEqual({ title: '', description: '' });
            }
        });

        it('should still accept an absent key', () => {
            expect(SeoSchema.safeParse({}).success).toBe(true);
        });
    });

    describe('title bounds still apply to authored text', () => {
        it('should reject a title below the minimum', () => {
            expect(errorCodeFor({ input: { title: 'Cheroga' }, field: 'title' })).toBe(
                'zodError.common.seo.title.min'
            );
        });

        it('should reject a title one character short of the minimum', () => {
            expect(errorCodeFor({ input: { title: 'x'.repeat(29) }, field: 'title' })).toBe(
                'zodError.common.seo.title.min'
            );
        });

        it('should accept a title exactly at the minimum', () => {
            expect(SeoSchema.safeParse({ title: 'x'.repeat(30) }).success).toBe(true);
        });

        it('should accept a title exactly at the maximum', () => {
            expect(SeoSchema.safeParse({ title: 'x'.repeat(60) }).success).toBe(true);
        });

        it('should reject a title above the maximum', () => {
            expect(errorCodeFor({ input: { title: 'x'.repeat(61) }, field: 'title' })).toBe(
                'zodError.common.seo.title.max'
            );
        });
    });

    describe('description bounds still apply to authored text', () => {
        it('should reject a description below the minimum', () => {
            expect(
                errorCodeFor({ input: { description: 'Una quinta' }, field: 'description' })
            ).toBe('zodError.common.seo.description.min');
        });

        it('should reject a description one character short of the minimum', () => {
            expect(
                errorCodeFor({ input: { description: 'x'.repeat(69) }, field: 'description' })
            ).toBe('zodError.common.seo.description.min');
        });

        it('should accept a description exactly at the minimum', () => {
            expect(SeoSchema.safeParse({ description: 'x'.repeat(70) }).success).toBe(true);
        });

        it('should accept a description exactly at the maximum', () => {
            expect(SeoSchema.safeParse({ description: 'x'.repeat(160) }).success).toBe(true);
        });

        it('should reject a description above the maximum', () => {
            expect(
                errorCodeFor({ input: { description: 'x'.repeat(161) }, field: 'description' })
            ).toBe('zodError.common.seo.description.max');
        });
    });

    describe('a non-string input still reports a translatable message', () => {
        // Zod answers `invalid_union` for these, not the string branch's own
        // `invalid_type`. Without a message on the union itself the caller gets
        // the literal "Invalid input", which `resolveValidationMessage` cannot
        // look up (no `zodError.` prefix) and echoes verbatim to the API client.
        // `PUT /api/v1/admin/posts/:id/seo` takes this schema as its whole body,
        // so that string would have reached a real response.
        it('should keep the title required key reachable', () => {
            expect(errorCodeFor({ input: { title: null }, field: 'title' })).toBe(
                'zodError.common.seo.title.required'
            );
        });

        it('should keep the description required key reachable', () => {
            expect(errorCodeFor({ input: { description: 42 }, field: 'description' })).toBe(
                'zodError.common.seo.description.required'
            );
        });

        it('should not leak the untranslatable zod default', () => {
            const result = SeoSchema.safeParse({ title: 123 });

            expect(result.success).toBe(false);
            if (!result.success) {
                for (const issue of result.error.issues) {
                    expect(issue.message).not.toBe('Invalid input');
                }
            }
        });
    });

    it('should reject whitespace that is not empty but is below the minimum', () => {
        // `'   '` is authored text, not a clearing signal. Nothing upstream
        // trims it — the editor sends `e.target.value` verbatim and the diff
        // compares raw strings — so a host who types three spaces gets a
        // length error rather than silently clearing the override. Only a
        // genuinely empty field means "remove it".
        expect(errorCodeFor({ input: { title: '   ' }, field: 'title' })).toBe(
            'zodError.common.seo.title.min'
        );
    });
});
