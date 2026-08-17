/**
 * @file ImageAttribution.astro.test.ts
 * @description Source-level invariants for the photo-credit component
 * (SPEC-274 T-274-08/09, revisited by H-125).
 *
 * An `.astro` component cannot be rendered under vitest, so what is left here
 * is a static guard — and a static guard is only worth its runtime when its
 * predicate is a real invariant rather than the shape the code happens to have
 * today. The previous version of this file failed that test in the most
 * literal way possible: it asserted
 *
 *     "attribution.provider === 'unsplash' ? 'Unsplash' : 'Pexels'"
 *
 * verbatim, which pinned the exact expression that published "Foto por <the
 * host's photographer> en Pexels" for any photo that was not from Unsplash.
 * The test was green the entire time the component was lying about where a
 * photo came from, because it was checking that a line existed, not that the
 * component was right. Nine of its cases broke on a refactor that FIXED that
 * bug — the signature of a test measuring form instead of behaviour.
 *
 * So the wording, the provider mapping and the URL handling are now covered by
 * behaviour tests over `formatPhotoCredit` (`test/lib/photo-credit.test.ts`),
 * which can actually execute. What stays here is only what a behaviour test
 * cannot reach: the rendered markup's security attributes, the scoped CSS, and
 * the presence of the i18n keys the formatter names.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSrc = readFileSync(
    resolve(__dirname, '../../../src/components/shared/ImageAttribution.astro'),
    'utf8'
);

const esCommon = readFileSync(
    resolve(__dirname, '../../../../../packages/i18n/src/locales/es/common.json'),
    'utf8'
);

describe('ImageAttribution.astro', () => {
    describe('Structure', () => {
        it('renders the container with its variant attribute', () => {
            expect(componentSrc).toContain('div class="image-attribution" data-variant={variant}');
        });

        it('renders nothing at all when there is no credit to show', () => {
            // The whole block is gated, so an uncredited photo emits no empty
            // container that CSS margins would still reserve space for.
            expect(componentSrc).toContain('{credit && (');
        });

        it('supports the overlay variant', () => {
            expect(componentSrc).toContain('data-variant="overlay"');
        });
    });

    describe('Outbound link (SPEC-274 legal requirement + H-125 hardening)', () => {
        it('opens the credit link in a new tab', () => {
            expect(componentSrc).toContain('target="_blank"');
        });

        it('marks the credit link nofollow, noopener and noreferrer', () => {
            // Host-supplied outbound links must not pass ranking signal, and
            // `target="_blank"` without `noopener` hands the opener to the
            // destination.
            expect(componentSrc).toContain('rel="nofollow noopener noreferrer"');
        });

        it('never puts the raw stored URL into an href', () => {
            // The write side validates `sourceUrl` with `z.string().url()`,
            // which accepts `javascript:` and `data:`. The only value allowed
            // into an href is the one `formatPhotoCredit` already scheme-checked
            // through `resolveSafeExternalUrl`.
            expect(componentSrc).not.toContain('href={attribution.sourceUrl}');
            expect(componentSrc).toContain('href={credit.url}');
        });

        it('labels the link for screen readers', () => {
            expect(componentSrc).toContain('aria-label={credit.ariaLabel}');
        });

        it('still shows the photographer when the credit carries no link', () => {
            // A name with no URL is the common case for a host crediting a
            // friend; dropping it would silently discard a credit they wrote.
            expect(componentSrc).toContain('image-attribution__name');
        });
    });

    describe('Wording comes from the shared formatter', () => {
        it('composes the credit through formatPhotoCredit, not inline', () => {
            // Two surfaces render this credit (this component and the React
            // lightbox). Composing it in either one is how they drift apart.
            expect(componentSrc).toContain('formatPhotoCredit');
        });

        it('does not hardcode a provider name', () => {
            // The regression this file used to enshrine: mapping every
            // non-Unsplash value to 'Pexels'.
            expect(componentSrc).not.toContain("'Pexels'");
            expect(componentSrc).not.toContain("'Unsplash'");
        });
    });

    describe('CSS styling', () => {
        it('should have scoped styles', () => {
            expect(componentSrc).toContain('<style>');
            expect(componentSrc).toContain('.image-attribution {');
        });

        it('should use CSS custom properties', () => {
            expect(componentSrc).toContain('var(--space-');
            expect(componentSrc).toContain('var(--core-muted-foreground)');
            expect(componentSrc).toContain('var(--radius-pill');
        });

        it('should have overlay variant positioning', () => {
            expect(componentSrc).toContain('.image-attribution[data-variant="overlay"]');
            expect(componentSrc).toContain('position: absolute');
            expect(componentSrc).toContain('bottom: var(--space-2');
        });

        it('should have inline variant margin', () => {
            expect(componentSrc).toContain('.image-attribution[data-variant="inline"]');
            expect(componentSrc).toContain('margin-top: var(--space-2');
        });

        it('should respect prefers-reduced-motion', () => {
            expect(componentSrc).toContain('@media (prefers-reduced-motion: reduce)');
            expect(componentSrc).toContain('transition: none');
        });
    });

    describe('Accessibility', () => {
        it('should have semantic HTML structure', () => {
            expect(componentSrc).toContain('<span class="image-attribution__text">');
        });

        it('should have link hover state', () => {
            expect(componentSrc).toContain('.image-attribution__link:hover');
            expect(componentSrc).toContain('text-decoration: underline');
        });
    });
});

describe('ImageAttribution i18n keys', () => {
    it('should have attribution.text key with interpolation placeholders', () => {
        expect(esCommon).toContain('"attribution":');
        expect(esCommon).toContain('"text": "Foto por {{photographer}} en {{provider}}"');
    });

    it('should have attribution.byline key', () => {
        expect(esCommon).toContain('"byline": "Foto por"');
    });

    it('should have attribution.onProvider key', () => {
        expect(esCommon).toContain('"onProvider": "en {{provider}}"');
    });

    it('should have attribution.ariaLabel key', () => {
        expect(esCommon).toContain('"ariaLabel": "Perfil de {{photographer}} en {{provider}}"');
    });

    it('should have attribution.ariaLabelNoProvider key for a credit with no provider', () => {
        // Without this key the no-provider branch falls back to the inline
        // Spanish default on /en/ and /pt/ — the silent failure mode H-125's
        // sibling finding is about.
        expect(esCommon).toContain('"ariaLabelNoProvider":');
    });
});
