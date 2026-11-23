/**
 * @file presentacion-index-share-row.test.ts
 * @description HOS-2359 §6.D.3 (AC-19): the `/presentacion/` index renders one
 * share row per presentation card, handing out the `/go/` short links, while the
 * card link stays the canonical URL with no UTMs. Asserted against the source
 * (Astro frontmatter cannot render under Vitest); the row's own behaviour is in
 * `test/components/presentacion/PresentationShareRow.test.tsx`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/presentacion/index.astro'),
    'utf8'
);
const deckItem = src.match(/<li class="deck__item">[\s\S]*?<\/li>/)?.[0] ?? '';

describe('/presentacion/ index — share rows (HOS-2359 AC-19)', () => {
    it('renders the shared PRESENTATIONS list, not a local copy', () => {
        expect(src).toMatch(
            /import \{ PRESENTATIONS \} from '@\/lib\/attribution\/presentation-links'/
        );
        expect(src).not.toMatch(/const PRESENTATIONS\b/);
    });

    it('renders one PresentationShareRow per card, hydrated on visibility', () => {
        const row = deckItem.match(/<PresentationShareRow\b[\s\S]*?\/>/)?.[0] ?? '';
        expect(row).toMatch(/\bpresentation=\{entry\}/);
        expect(row).toMatch(/\bsiteUrl=\{siteUrl\}/);
        expect(row).toMatch(/\blocale=\{locale\}/);
        expect(row).toMatch(/\sclient:visible\b/);
    });

    it('keeps the card link canonical: no UTMs, no short link', () => {
        const card = deckItem.match(/<a class="deck__card" href=\{href\}>/)?.[0];
        expect(card).toBeDefined();
        expect(src).toMatch(
            /const href = buildUrl\(\{ locale, path: `presentacion\/\$\{entry\.slug\}` \}\);/
        );
        expect(src).not.toContain('withUtm');
    });

    it('stays cacheable and reads nothing per-user', () => {
        expect(src).toMatch(/cacheable:\s*true/);
        expect(src).not.toMatch(/Astro\.locals\.user|Astro\.cookies|cookieHeader/);
    });
});
