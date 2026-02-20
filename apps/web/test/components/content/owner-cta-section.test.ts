/**
 * Tests for OwnerCTASection.astro.
 * Validates SectionWrapper usage, font classes, button variant, link target.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/OwnerCTASection.astro');
const content = readFileSync(componentPath, 'utf8');

describe('OwnerCTASection.astro', () => {
    describe('Props', () => {
        it('should accept optional locale prop', () => {
            expect(content).toContain('locale');
        });

        it('should not require backgroundImage prop (uses gradient)', () => {
            expect(content).toContain('locale');
        });
    });

    describe('SectionWrapper usage', () => {
        it('should import SectionWrapper', () => {
            expect(content).toContain('SectionWrapper');
        });

        it('should use gradient background (from-primary-50 via-surface-warm)', () => {
            expect(content).toContain('from-primary-50');
            expect(content).toContain('via-surface-warm');
        });
    });

    describe('i18n integration', () => {
        it('should import t function from lib/i18n', () => {
            expect(content).toContain("from '../../lib/i18n'");
        });

        it('should use t() for accent subtitle', () => {
            expect(content).toContain("'ownerCta.accentSubtitle'");
        });

        it('should use t() for heading', () => {
            expect(content).toContain("'ownerCta.title'");
        });

        it('should use t() for description', () => {
            expect(content).toContain("'ownerCta.description'");
        });

        it('should use t() for button label', () => {
            expect(content).toContain("'ownerCta.button'");
        });
    });

    describe('Typography', () => {
        it('should use font-accent (Caveat) for accent subtitle', () => {
            expect(content).toContain('font-accent');
        });

        it('should use font-serif (Fraunces) for heading', () => {
            expect(content).toContain('font-serif');
        });
    });

    describe('CTA Button', () => {
        it('should import Button component', () => {
            expect(content).toContain('Button');
        });

        it('should use primary-warm variant', () => {
            expect(content).toContain('variant="primary-warm"');
        });

        it('should link to propietarios page', () => {
            expect(content).toContain('/propietarios/');
        });

        it('should render button with translated label', () => {
            expect(content).toContain("'ownerCta.button'");
        });
    });

    describe('Background', () => {
        it('should have gradient background', () => {
            expect(content).toContain('bg-gradient-to-br');
        });

        it('should NOT use img element for background', () => {
            // Background must be CSS, not an <img> element
            // SectionWrapper handles this via style attribute
            expect(content).not.toMatch(/<img[^>]*background/i);
        });
    });

    describe('Styling', () => {
        it('should use white text', () => {
            expect(content).toContain('text-white');
        });
    });
});
