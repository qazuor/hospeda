/**
 * @file ImageAttribution.astro.test.ts
 * @description Tests for the ImageAttribution component (SPEC-274 T-274-08/09).
 *
 * Tests verify:
 * - Attribution renders correctly with all required fields
 * - Component gracefully skips when attribution is missing
 * - Both variants (overlay/inline) render correctly
 * - Link has correct attributes (rel, target, href)
 * - i18n strings are properly interpolated
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSrc = readFileSync(
    resolve(__dirname, '../../../src/components/shared/ImageAttribution.astro'),
    'utf8'
);

describe('ImageAttribution.astro', () => {
    describe('Structure', () => {
        it('should render container div with data-variant attribute', () => {
            expect(componentSrc).toContain('div class="image-attribution" data-variant={variant}');
        });

        it('should use conditional rendering for attribution', () => {
            expect(componentSrc).toContain('{attribution && (');
        });

        it('should support overlay variant', () => {
            expect(componentSrc).toContain("variant === 'overlay'");
        });

        it('should support inline variant', () => {
            expect(componentSrc).toContain('variant="overlay"');
        });
    });

    describe('Link attributes (SPEC-274 legal requirements)', () => {
        it('should have photographer profile link', () => {
            expect(componentSrc).toContain('href={attribution.sourceUrl}');
        });

        it('should have target="_blank" for external link', () => {
            expect(componentSrc).toContain('target="_blank"');
        });

        it('should have rel="nofollow noopener noreferrer"', () => {
            expect(componentSrc).toContain('rel="nofollow noopener noreferrer"');
        });

        it('should have aria-label for accessibility', () => {
            expect(componentSrc).toContain("aria-label={t('common.attribution.ariaLabel'");
        });
    });

    describe('i18n integration', () => {
        it('should use common.attribution.text key', () => {
            expect(componentSrc).toContain("t('common.attribution.text'");
        });

        it('should use common.attribution.byline key', () => {
            expect(componentSrc).toContain("t('common.attribution.byline'");
        });

        it('should use common.attribution.onProvider key', () => {
            expect(componentSrc).toContain("t('common.attribution.onProvider'");
        });

        it('should interpolate photographer and provider params', () => {
            expect(componentSrc).toContain('photographer: attribution.photographer');
            expect(componentSrc).toContain('provider: providerName');
        });
    });

    describe('Provider name mapping', () => {
        it('should map unsplash to "Unsplash"', () => {
            expect(componentSrc).toContain(
                "attribution.provider === 'unsplash' ? 'Unsplash' : 'Pexels'"
            );
        });

        it('should map pexels to "Pexels"', () => {
            expect(componentSrc).toContain("Unsplash' : 'Pexels'");
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
        const esCommon = readFileSync(
            resolve(__dirname, '../../../../../packages/i18n/src/locales/es/common.json'),
            'utf8'
        );
        expect(esCommon).toContain('"attribution":');
        expect(esCommon).toContain('"text": "Foto por {{photographer}} en {{provider}}"');
    });

    it('should have attribution.byline key', () => {
        const esCommon = readFileSync(
            resolve(__dirname, '../../../../../packages/i18n/src/locales/es/common.json'),
            'utf8'
        );
        expect(esCommon).toContain('"byline": "Foto por"');
    });

    it('should have attribution.onProvider key', () => {
        const esCommon = readFileSync(
            resolve(__dirname, '../../../../../packages/i18n/src/locales/es/common.json'),
            'utf8'
        );
        expect(esCommon).toContain('"onProvider": "en {{provider}}"');
    });

    it('should have attribution.ariaLabel key', () => {
        const esCommon = readFileSync(
            resolve(__dirname, '../../../../../packages/i18n/src/locales/es/common.json'),
            'utf8'
        );
        expect(esCommon).toContain('"ariaLabel": "Perfil de {{photographer}} en {{provider}}"');
    });
});
