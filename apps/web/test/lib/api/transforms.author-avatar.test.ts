/**
 * @file transforms.author-avatar.test.ts
 * @description Consumer-layer guard: `toArticleCardProps` must drop an author
 * avatar the browser cannot load (HOS-375).
 *
 * `PostAuthorPublicSchema.image` asserts TYPE but not URL FORMAT on purpose —
 * `users.image` is an unbounded `text` column Better Auth writes outside Zod,
 * and a strict response schema fail-closes to HTTP 500 through
 * `stripWithSchema`, which `createPaginatedResponse` runs per item, so one bad
 * row would 500 every page of `/api/v1/public/posts`.
 *
 * The schema used to ALSO erase the bad value via `.catch(undefined)`. That was
 * removed because `ZodCatch` has no renderer in `@hono/zod-openapi` and the
 * OpenAPI document is global — one such field 500'd `/docs/openapi.json`
 * everywhere. The junk therefore reaches this transform intact, and dropping it
 * before it becomes an `<img src>` is now the transform's responsibility.
 */

import { describe, expect, it } from 'vitest';
import { toArticleCardProps } from '../../../src/lib/api/transforms';

const AUTHOR_ID = 'c0ffee00-0000-4000-8000-000000000001';

describe('toArticleCardProps — author avatar is dropped unless renderable', () => {
    it.each([
        // The exact production shape data-migration `0043` and the seed
        // fixtures can leave behind in the JSONB/`users.image` columns.
        ['a bare relative path', 'avatars/laura-vega.jpg'],
        ['a protocol-less host', 'example.com/a.jpg'],
        ['free text that is not a URL', 'not-a-url'],
        ['an empty string', ''],
        ['a javascript: scheme', 'javascript:alert(1)']
    ])('drops %s from author.image rather than emitting a broken <img>', (_label, image) => {
        const result = toArticleCardProps({
            item: {
                slug: 'nota-avatar-malformado',
                author: { id: AUTHOR_ID, displayName: 'Laura Vega', image }
            }
        });

        expect(result.authorAvatar).toBeUndefined();
        // The card still renders — only the picture is gone.
        expect(result.authorName).toBe('Laura Vega');
    });

    it('drops a malformed flat `authorAvatar` field too', () => {
        // `item.authorAvatar` is the flat field some payloads carry instead of
        // the relation; it comes from the same unvalidated column.
        const result = toArticleCardProps({
            item: { slug: 'nota-avatar-plano-malo', authorAvatar: 'avatars/laura-vega.jpg' }
        });

        expect(result.authorAvatar).toBeUndefined();
    });

    // Non-vacuity: the guard must not be swallowing everything. A real avatar
    // has to survive, from BOTH sources, or "always undefined" would pass the
    // block above for the wrong reason.
    it('keeps a well-formed avatar from the author relation', () => {
        const image = 'https://res.cloudinary.com/x/image/upload/laura.webp';
        const result = toArticleCardProps({
            item: {
                slug: 'nota-avatar-valido',
                author: { id: AUTHOR_ID, displayName: 'Laura Vega', image }
            }
        });

        expect(result.authorAvatar).toBe(image);
    });

    it('keeps a well-formed flat `authorAvatar` and prefers it over the relation', () => {
        const flat = 'https://res.cloudinary.com/x/image/upload/plano.webp';
        const result = toArticleCardProps({
            item: {
                slug: 'nota-avatar-plano-valido',
                authorAvatar: flat,
                author: {
                    id: AUTHOR_ID,
                    displayName: 'Laura Vega',
                    image: 'https://res.cloudinary.com/x/image/upload/relacion.webp'
                }
            }
        });

        expect(result.authorAvatar).toBe(flat);
    });

    it('falls back to the relation when the flat field is present but unrenderable', () => {
        // Precedence must be "first RENDERABLE value", not "first PRESENT
        // value" — otherwise a junk flat field would mask a perfectly good
        // avatar on the relation.
        const image = 'https://res.cloudinary.com/x/image/upload/relacion.webp';
        const result = toArticleCardProps({
            item: {
                slug: 'nota-avatar-fallback',
                authorAvatar: 'avatars/roto.jpg',
                author: { id: AUTHOR_ID, displayName: 'Laura Vega', image }
            }
        });

        expect(result.authorAvatar).toBe(image);
    });
});
