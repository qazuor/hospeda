/**
 * @file eventos-detail-byline.test.ts
 * @description HOS-375 §6.9 (G-7) — the event detail page must credit its
 * author with a byline linking to `/autores/<slug>/`.
 *
 * Before this, no event component linked to an author at all, and the public
 * event payload carried none to link to. Astro components cannot be rendered in
 * Vitest (see apps/web/CLAUDE.md), so these assert on the raw source of the page
 * and the header, the way the post byline is covered in
 * `publicaciones-detail-media.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '../../src/lib/i18n';

const pageSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/eventos/[slug].astro'),
    'utf8'
);

const headerSrc = readFileSync(
    resolve(__dirname, '../../src/components/event/EventDetailHeader.astro'),
    'utf8'
);

describe('eventos/[slug].astro — forwards the author to the header', () => {
    it('reads the author off the transformed event', () => {
        expect(pageSrc).toMatch(/^\tauthor,$/m);
    });

    it('passes it to EventDetailHeader', () => {
        // Without this the header prop is permanently undefined and the byline
        // never renders, however correct the component itself is.
        expect(pageSrc).toContain('author={author ?? null}');
    });
});

describe('EventDetailHeader.astro — author byline', () => {
    it('accepts an optional author prop and destructures it', () => {
        expect(headerSrc).toContain('readonly author?: EventDetailAuthor | null;');
        expect(headerSrc).toMatch(/^\s*author,$/m);
    });

    it('links to the HOS-375 author page, not the retired post-only URL', () => {
        // Linked DIRECTLY: routing the byline through the `/publicaciones/autor/`
        // middleware redirect would make that redirect load-bearing for
        // first-party traffic instead of only for inbound links.
        expect(headerSrc).toContain('autores/${author.slug}');
        expect(headerSrc).not.toContain('publicaciones/autor/');
    });

    it('builds the href with buildUrl so the locale prefix and trailing slash are applied', () => {
        expect(headerSrc).toMatch(/import \{ buildUrl \} from '@\/lib\/urls';/);
        expect(headerSrc).toContain('buildUrl({ locale, path: `autores/${author.slug}` })');
    });

    it('renders the byline only when there is an author', () => {
        // `authorLabel` is null unless an author was passed, so the whole
        // element — icon included — is skipped rather than emitted empty.
        expect(headerSrc).toContain('{authorLabel && (');
        expect(headerSrc).toContain('event-header__byline');
    });

    it('degrades to plain text when the author has no slug', () => {
        // `authorHref` is null without a slug, and the ternary must fall back to
        // a plain span — never to an anchor pointing at `/autores/undefined/`.
        expect(headerSrc).toMatch(/const authorHref = author\?\.slug \? buildUrl\(.+\) : null;/);
        expect(headerSrc).toMatch(
            /\{authorHref \? \([\s\S]*?\) : \([\s\S]*?<span>\{authorLabel\}<\/span>/
        );
    });

    it('renders the byline label through i18n, not a hardcoded string', () => {
        // The namespace is `events` (event.json is registered under that key in
        // config.shared.ts) — an `event.detail.*` key would silently resolve to
        // the inline fallback and never translate.
        expect(headerSrc).toContain("t('events.detail.byline'");
    });

    it('interpolates through the params form, not by hand', () => {
        // `t` interpolates the resolved string AND the fallback; `.replace()` on
        // the result only ever reached the first, so a missing key rendered the
        // raw `{{name}}` placeholder or a pre-baked Spanish fallback.
        expect(headerSrc).toContain(
            "t('events.detail.byline', 'Por {{name}}', { name: author.name })"
        );
        expect(headerSrc).not.toContain("replace('{{name}}'");
    });
});

describe('PostDetailHeader.astro — author byline', () => {
    const postHeaderSrc = readFileSync(
        resolve(__dirname, '../../src/components/post/PostDetailHeader.astro'),
        'utf8'
    );

    it('interpolates through the params form, not by hand', () => {
        expect(postHeaderSrc).toContain(
            "t('blog.detail.byline', 'Por {{name}}', { name: author.name })"
        );
        expect(postHeaderSrc).not.toContain("replace('{{name}}'");
    });

    it('resolves the label once, so the linked and unlinked bylines cannot drift', () => {
        expect(postHeaderSrc).toContain('const authorLabel = author ?');
        expect(postHeaderSrc).toContain('{authorLabel && (');
    });
});

describe('the byline keys actually RESOLVE — the namespace gotcha (§6.9)', () => {
    /**
     * A byline key that silently falls back is invisible in `/es/`: the inline
     * fallback IS the Spanish copy, so the page looks perfect while the key is
     * dead. `event.json` is registered under the `events` namespace, and several
     * `event.detail.*` keys in this repo hit the fallback for exactly that
     * reason. `/en/` is where it shows.
     */
    it.each([
        { key: 'events.detail.byline', expected: 'By Ana Torres' },
        { key: 'blog.detail.byline', expected: 'By Ana Torres' }
    ])('$key resolves to the English copy, not the Spanish fallback', ({ key, expected }) => {
        const { t } = createTranslations('en');

        const label = t(key, 'Por {{name}}', { name: 'Ana Torres' });

        expect(label).toBe(expected);
    });

    it('reports a dead key as the fallback — proving the check above bites', () => {
        // Non-vacuity: without this, a `t` that returned the English string for
        // anything would make the two cases above pass for the wrong reason.
        const { t } = createTranslations('en');

        expect(t('events.detai.byline', 'Por {{name}}', { name: 'Ana Torres' })).toBe(
            'Por Ana Torres'
        );
    });
});
