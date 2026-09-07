/**
 * @file destinos-detail-i18n-fallback.test.ts
 * @description HOS-802 review F5 — `destinos/[...path].astro` resolved
 * `summary`/`description` inline with the pre-fix `resolveI18nText(i18n ??
 * legacy, locale)` pattern, which shares the exact same defect the rest of
 * HOS-802 fixed: an i18n object present but populated with every key empty
 * (`{ es: '', en: '', pt: '' }`) is truthy, so the `??` never falls through
 * to the legacy plain field. `summary` feeds `seoDescription` (via
 * `pickLocalizedSeo({ fallback: summary || description, ... })`), so an
 * interrupted `ai-translate.service.ts` run on a destination's `summaryI18n`
 * would have published an empty meta description — same production
 * mechanism, same acceptance criterion.
 *
 * `dest.name` stays a plain column (destination names are proper nouns,
 * never translated per the comment on that line), so the `<title>` itself
 * was never at risk here — only the meta description.
 *
 * `.astro` frontmatter cannot render in Vitest — source-based assertions per
 * the project convention (see e.g. `destinos-no-op-regression.test.ts`). The
 * runtime behavior of `resolveI18nTextWithLegacyFallback` itself is already
 * covered exhaustively in `test/lib/resolve-i18n-text.test.ts`; this test
 * only pins that the page actually calls it instead of the bare resolver.
 *
 * @module test/pages/destinos-detail-i18n-fallback
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/[...path].astro'),
    'utf8'
);

describe('destinos/[...path].astro — summary/description use the legacy-fallback resolver (HOS-802 F5)', () => {
    it('imports resolveI18nTextWithLegacyFallback', () => {
        expect(src).toContain('resolveI18nTextWithLegacyFallback');
    });

    it('no longer calls the bare resolveI18nText for summary/description', () => {
        // Only the `??`-in-the-import-list form should exist now; the plain
        // resolver import itself must be gone from this file.
        expect(src).not.toMatch(/\bresolveI18nText\(/);
    });

    it('resolves summary with dest.summaryI18n as the i18n source and dest.summary as the legacy fallback', () => {
        expect(src).toMatch(
            /resolveI18nTextWithLegacyFallback\(\{\s*i18n:\s*dest\.summaryI18n[^)]*legacy:\s*dest\.summary/s
        );
    });

    it('resolves description with dest.descriptionI18n as the i18n source and dest.description as the legacy fallback', () => {
        expect(src).toMatch(
            /resolveI18nTextWithLegacyFallback\(\{\s*i18n:\s*dest\.descriptionI18n[^)]*legacy:\s*dest\.description/s
        );
    });
});
