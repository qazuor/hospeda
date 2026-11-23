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

    it('is used by both description renderings', () => {
        expect(read('components/accommodation/Description.astro')).toContain('<ClampedText');
        expect(read('pages/[lang]/alojamientos/[slug].astro')).toContain('<ClampedText');
    });

    it.each(['es', 'en', 'pt'] as const)('has toggle labels in %s', (locale) => {
        const { t } = createTranslations(locale);
        expect(t('accommodations.detail.descriptionToggle.more')).not.toMatch(
            /^\[?MISSING|descriptionToggle/
        );
        expect(t('accommodations.detail.descriptionToggle.less')).not.toMatch(/descriptionToggle/);
    });
});
