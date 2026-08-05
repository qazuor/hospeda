/**
 * @file media.renderable-image-url.test.ts
 * @description Consumer-layer guard for author avatars (HOS-375).
 *
 * ## Which layer owns what
 *
 * The public author-avatar fields — `PostAuthorPublicSchema.image`,
 * `EventAuthorPublicSchema.image` and the author page's `avatar` — assert TYPE
 * but not URL FORMAT. That is deliberate: `users.image` and the
 * `profile.avatar` JSONB path are both written outside Zod (Better Auth signup,
 * seed fixtures, data-migration `0043`), and a strict response schema
 * fail-closes to HTTP 500 through `stripWithSchema`, taking a whole public page
 * down over one bad stored row.
 *
 * Those schemas previously ALSO erased the bad value with `.catch(undefined)`.
 * That had to go: `ZodCatch` has no renderer in `@hono/zod-openapi`, and the
 * OpenAPI document is GLOBAL, so a single such field made
 * `getOpenAPIDocument()` throw and 500'd `/docs/openapi.json` — plus `/docs`,
 * `/reference` and `/ui` — in every environment.
 *
 * So the two goals split across two layers:
 *   1. "never 500"          → the SCHEMA (pinned in `packages/schemas/test/**`
 *                             and `apps/api/test/routes/user/public/`)
 *   2. "never render broken" → THIS layer, and this file is its guard.
 */

import { describe, expect, it } from 'vitest';
import { isRenderableImageUrl, toRenderableImageUrl } from '../../src/lib/media';

describe('isRenderableImageUrl — accepts what a browser can actually load', () => {
    it.each([
        [
            'an https URL (the OAuth/Cloudinary shape every real avatar has)',
            'https://res.cloudinary.com/x/a.webp'
        ],
        ['an http URL', 'http://localhost:3001/a.png'],
        ['a root-relative path', '/images/placeholder.svg'],
        ['a protocol-relative path', '//cdn.example.com/a.png'],
        ['an https URL with surrounding whitespace', '  https://example.com/a.png  ']
    ])('accepts %s', (_label, value) => {
        expect(isRenderableImageUrl(value)).toBe(true);
    });
});

describe('isRenderableImageUrl — rejects what would render a broken image', () => {
    it.each([
        // What makes this class reachable is that `profile.avatar` is a JSONB
        // path written OUTSIDE Zod (seed fixtures, data-migration `0043`), so
        // no schema vouches for the stored value. Note those two writers do
        // currently write well-formed `https://` URLs — they establish the
        // bypass, not this specific shape. The write path a user can reach
        // (`UserProfileSchema.avatar`) enforces `.url()`, which still admits
        // non-renderable schemes like `ftp:` (covered below).
        ['a bare relative path', 'avatars/tomas-quiroga.jpg'],
        ['a protocol-less host', 'example.com/a.jpg'],
        ['free text that is not a URL at all', 'not-a-url'],
        ['an empty string', ''],
        ['whitespace only', '   '],
        ['null', null],
        ['undefined', undefined]
    ])('rejects %s', (_label, value) => {
        expect(isRenderableImageUrl(value)).toBe(false);
    });

    it.each([
        ['a javascript: scheme', 'javascript:alert(1)'],
        ['a data: URI', 'data:image/svg+xml;base64,AAAA'],
        ['a file: scheme', 'file:///etc/passwd'],
        // The reachable-through-the-product one: `UserProfileSchema.avatar`'s
        // `.url()` ACCEPTS this, so the admin account form can store it.
        ['an ftp: scheme', 'ftp://cdn.example.com/a.png']
    ])('rejects %s — parseable by `new URL` but not a fetchable image source', (_label, value) => {
        // Non-vacuity note: these DO parse, so a naive `try { new URL(v) }`
        // guard would wave them through. The protocol check is what stops them.
        expect(() => new URL(value)).not.toThrow();
        expect(isRenderableImageUrl(value)).toBe(false);
    });

    it('proves the ftp: case is not hypothetical — the WRITE schema admits it', async () => {
        // Non-vacuity partner for the case above: if `.url()` ever rejected
        // `ftp:`, that row could never be stored and the guard would be
        // guarding nothing.
        const { UserProfileSchema } = await import('@repo/schemas');

        expect(UserProfileSchema.safeParse({ avatar: 'ftp://cdn.example.com/a.png' }).success).toBe(
            true
        );
    });
});

describe('toRenderableImageUrl — the render-or-nothing wrapper', () => {
    it('returns the trimmed URL when renderable, so no `src` carries stray whitespace', () => {
        expect(toRenderableImageUrl('  https://example.com/a.png ')).toBe(
            'https://example.com/a.png'
        );
    });

    it('returns undefined for the stored value that used to reach `<img src>`', () => {
        expect(toRenderableImageUrl('avatars/tomas-quiroga.jpg')).toBeUndefined();
    });

    it.each([[null], [undefined], ['']])('returns undefined for %s', (value) => {
        expect(toRenderableImageUrl(value)).toBeUndefined();
    });
});
