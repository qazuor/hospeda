import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';

const read = (rel: string) => readFileSync(resolve(__dirname, '../../../src', rel), 'utf8');
const source = read('components/listing/ClampedText.astro');

describe('ClampedText (AC-2.4)', () => {
    it('clamps to 4 lines on mobile and 8 on desktop via CSS only', () => {
        expect(source).toMatch(/--clamp-lines: 4;/);
        expect(source).toMatch(
            /@media \(min-width: 768px\)\s*\{\s*\.clamped-text\s*\{\s*--clamp-lines: 8;/
        );
        expect(source).toContain('-webkit-line-clamp: var(--clamp-lines)');
    });

    it('renders the slot unconditionally so the full text is always in the DOM', () => {
        expect(source).toContain('<slot />');
        expect(source).not.toMatch(/\{[^}]*\?\s*<slot/);
    });

    it('ships a toggle with aria-expanded, hidden by default', () => {
        expect(source).toMatch(/aria-expanded="false"\s+hidden/);
    });

    it('shows the full text without JavaScript', () => {
        expect(source).toContain('<noscript>');
        // Without `is:inline` Astro hoists the <style> into the bundled CSS, which would
        // disable the clamp for everyone instead of only for no-JS visitors.
        expect(source).toMatch(/<noscript>\s*<style is:inline>/);
    });

    it('the <noscript> override is declared inline so Astro cannot hoist it', () => {
        const noscript = source.match(/<noscript>[\s\S]*?<\/noscript>/)?.[0] ?? '';
        expect(noscript).toContain('is:inline');
        expect(noscript).toContain('line-clamp: unset');
    });

    it('clamps both the plain and rich description through the same renderer', () => {
        // D19 / CARD-022 H-6: the route deduplicates content before passing either body to Description.
        expect(read('components/accommodation/Description.astro')).toContain('<ClampedText');
        const page = read('pages/[lang]/alojamientos/[slug].astro');
        expect(page).toMatch(
            /displayDescription\s*=[\s\S]*?\? safeRichDescriptionHtml : safeDescriptionHtml;/
        );
        expect(page).toMatch(
            /<Description\b[^>]*summary=\{displaySummary\} descriptionHtml=\{displayDescription\}/
        );
        expect(page).not.toMatch(/<ClampedText\b/);
    });

    it.each([
        ['venue', 'components/venue/VenueDescription.astro', 'venue-desc__body'],
        ['experience', 'components/experience/ExperienceDescription.astro', 'exp-info__body']
    ] as const)('wraps the %s description body, never the summary (HOS-2579 AC-24)', (_v, file, bodyClass) => {
        // Arrange
        const component = read(file);
        const markup = component.slice(
            component.indexOf('---', 3) + 3,
            component.indexOf('<style>')
        );
        const clamp =
            markup.match(/<ClampedText lang=\{locale\}>[\s\S]*?<\/ClampedText>/)?.[0] ?? '';

        // Assert: both body renderings (rich and plain) sit inside the clamp…
        expect(clamp.match(new RegExp(`class="${bodyClass}`, 'g'))).toHaveLength(2);
        // …and the summary stays outside it, always visible in full.
        expect(clamp).not.toContain('__summary');
        expect(markup).toContain('__summary');
    });

    it.each(['es', 'en', 'pt'] as const)('has toggle labels in %s', (locale) => {
        const { t } = createTranslations(locale);
        expect(t('accommodations.detail.descriptionToggle.more')).not.toMatch(
            /^\[?MISSING|descriptionToggle/
        );
        expect(t('accommodations.detail.descriptionToggle.less')).not.toMatch(/descriptionToggle/);
    });
});
