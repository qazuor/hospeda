import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/SectionTitle.astro');
const content = readFileSync(componentPath, 'utf8');

describe('SectionTitle.astro', () => {
    describe('Props', () => {
        it('should accept as prop with heading levels', () => {
            expect(content).toContain("as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'");
        });

        it('should default as to h2', () => {
            expect(content).toContain("as: Tag = 'h2'");
        });

        it('should accept optional size prop', () => {
            expect(content).toContain('size?: string');
        });

        it('should default size to display-section token', () => {
            expect(content).toContain("size = 'var(--fs-display-section)'");
        });

        it('should accept optional weight prop', () => {
            expect(content).toContain("weight?: 'normal' | 'medium' | 'semibold' | 'bold'");
        });

        it('should default weight to bold', () => {
            expect(content).toContain("weight = 'bold'");
        });

        it('should accept optional color prop', () => {
            expect(content).toContain('color?: string');
        });

        it('should accept optional underline prop', () => {
            expect(content).toContain('underline?: boolean');
        });

        it('should default underline to true', () => {
            expect(content).toContain('underline = true');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });
    });

    describe('Typography', () => {
        it('should always apply font-serif', () => {
            expect(content).toContain('font-serif');
        });

        it('should always apply tight letter-spacing', () => {
            expect(content).toContain('tracking-[-0.03em]');
        });

        it('should always apply tight line-height', () => {
            expect(content).toContain('leading-tight');
        });

        it('should apply Fraunces variation settings', () => {
            expect(content).toContain('--fraunces-section');
        });
    });

    describe('Underline', () => {
        it('should conditionally apply brush-stroke-underline class', () => {
            expect(content).toContain('brush-stroke-underline');
        });
    });

    describe('Structure', () => {
        it('should export SectionTitleProps', () => {
            expect(content).toContain('SectionTitleProps');
        });

        it('should use slot for content', () => {
            expect(content).toContain('<slot />');
        });
    });
});
