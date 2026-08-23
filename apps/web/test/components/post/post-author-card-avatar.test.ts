/**
 * @file post-author-card-avatar.test.ts
 * @description Source guard: `PostAuthorCard.astro` and the post detail page
 * must drop an unrenderable author avatar (HOS-375). Vitest cannot render
 * `.astro`, so the wiring is asserted against the source.
 *
 * `PostAuthorPublicSchema.image` asserts TYPE but not URL FORMAT on purpose —
 * `users.image` is written outside Zod by Better Auth, and a strict response
 * schema fail-closes the whole post to an HTTP 500 through `stripWithSchema`.
 * The schema no longer erases a bad value either: `.catch(undefined)` was
 * removed because `ZodCatch` has no renderer in `@hono/zod-openapi` and the
 * OpenAPI document is GLOBAL, so it 500'd `/docs/openapi.json` everywhere.
 *
 * Keeping the broken picture off the page is therefore a CONSUMER guarantee,
 * and this file is what pins it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CARD_PATH = resolve(__dirname, '../../../src/components/post/PostAuthorCard.astro');
const PAGE_PATH = resolve(__dirname, '../../../src/pages/[lang]/publicaciones/[slug].astro');

const cardSrc = readFileSync(CARD_PATH, 'utf8');
const pageSrc = readFileSync(PAGE_PATH, 'utf8');

describe('PostAuthorCard.astro — the component that emits the <img>', () => {
    it('guards the avatar through the shared helper', () => {
        expect(cardSrc).toContain("from '@/lib/media';");
        expect(cardSrc).toContain('toRenderableImageUrl(author.profilePicture)');
    });

    it('renders the guarded value, never the raw prop', () => {
        expect(cardSrc).toContain('{avatarSrc ? (');
        expect(cardSrc).toContain('src={avatarSrc}');
        // The pre-HOS-375 wiring: a junk `profilePicture` reached `src` intact.
        expect(cardSrc).not.toContain('src={author.profilePicture}');
        expect(cardSrc).not.toContain('{author.profilePicture ? (');
    });

    it('still falls back to the initial placeholder rather than a broken image', () => {
        // Non-vacuity: proves the guard drops INTO the existing placeholder
        // branch instead of removing the identity block altogether.
        expect(cardSrc).toContain('post-author-card__avatar-placeholder');
    });
});

describe('publicaciones/[slug].astro — guards before getMediaUrl', () => {
    it('filters the raw avatar through the shared helper', () => {
        expect(pageSrc).toContain("import { toRenderableImageUrl } from '@/lib/media';");
        expect(pageSrc).toContain('const rawAuthorAvatar = toRenderableImageUrl(');
    });

    it('applies the guard BEFORE getMediaUrl, not after', () => {
        // Order is load-bearing: `getMediaUrl` passes any non-Cloudinary string
        // through UNCHANGED, so guarding afterwards would still let
        // `avatars/x.jpg` reach `<img src>` — it would just have survived a
        // no-op transform first.
        const guardAt = pageSrc.indexOf('toRenderableImageUrl(');
        const mediaAt = pageSrc.indexOf('getMediaUrl(rawAuthorAvatar');

        expect(guardAt).toBeGreaterThan(-1);
        expect(mediaAt).toBeGreaterThan(-1);
        expect(guardAt).toBeLessThan(mediaAt);
    });
});
