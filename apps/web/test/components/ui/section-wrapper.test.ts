import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/SectionWrapper.astro');
const content = readFileSync(componentPath, 'utf8');

describe('SectionWrapper.astro', () => {
    describe('Props', () => {
        it('should accept variant prop with white, gray, warm, image options', () => {
            expect(content).toContain('variant?:');
            expect(content).toContain("'white'");
            expect(content).toContain("'gray'");
            expect(content).toContain("'warm'");
            expect(content).toContain("'image'");
        });

        it('should accept backgroundImage prop', () => {
            expect(content).toContain('backgroundImage?: string');
        });

        it('should accept padding prop with compact, standard, feature, first options', () => {
            expect(content).toContain('padding?:');
            expect(content).toContain("'compact'");
            expect(content).toContain("'standard'");
            expect(content).toContain("'feature'");
            expect(content).toContain("'first'");
        });

        it('should accept overlap prop', () => {
            expect(content).toContain('overlap?: boolean');
        });

        it('should accept id prop', () => {
            expect(content).toContain('id?: string');
        });

        it('should accept class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should default variant to white', () => {
            expect(content).toContain("variant = 'white'");
        });

        it('should default padding to standard', () => {
            expect(content).toContain("padding = 'standard'");
        });
    });

    describe('Background variants', () => {
        it('should have white variant class', () => {
            expect(content).toContain('bg-surface');
        });

        it('should have gray variant with surface-alt', () => {
            expect(content).toContain('bg-surface-alt');
        });

        it('should have warm variant using --color-bg-warm', () => {
            expect(content).toContain('bg-bg-warm');
        });

        it('should have image variant with bg-cover and bg-center', () => {
            expect(content).toContain('bg-cover');
            expect(content).toContain('bg-center');
        });

        it('should render overlay with aria-hidden for image variant', () => {
            expect(content).toContain('aria-hidden="true"');
            expect(content).toContain('bg-black/50');
        });
    });

    describe('Padding levels', () => {
        it('should have compact padding (py-16)', () => {
            expect(content).toContain('py-16');
        });

        it('should have standard padding (py-24)', () => {
            expect(content).toContain('py-24');
        });

        it('should have feature padding (120px)', () => {
            expect(content).toMatch(/py-\[120px\]|padding.*120px/);
        });

        it('should have first padding (py-20)', () => {
            expect(content).toContain('py-20');
        });
    });

    describe('Content container', () => {
        it('should constrain inner content to max-w-site', () => {
            expect(content).toContain('max-w-site');
        });

        it('should center content with mx-auto', () => {
            expect(content).toContain('mx-auto');
        });

        it('should have responsive horizontal padding', () => {
            expect(content).toContain('px-4');
            expect(content).toContain('sm:px-6');
        });
    });

    describe('Overlap', () => {
        it('should apply negative margin for overlap', () => {
            expect(content).toContain('-mt-6');
        });
    });

    describe('Structure', () => {
        it('should use semantic section element', () => {
            expect(content).toContain('<section');
        });

        it('should include a slot', () => {
            expect(content).toContain('<slot />');
        });
    });
});
