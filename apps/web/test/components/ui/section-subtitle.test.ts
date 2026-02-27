import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/SectionSubtitle.astro');
const content = readFileSync(componentPath, 'utf8');

describe('SectionSubtitle.astro', () => {
    describe('Props', () => {
        it('should accept as prop with p, span, div', () => {
            expect(content).toContain("as?: 'p' | 'span' | 'div'");
        });

        it('should default as to p', () => {
            expect(content).toContain("as: Tag = 'p'");
        });

        it('should accept optional size prop', () => {
            expect(content).toContain('size?: string');
        });

        it('should default size to accent-subtitle token', () => {
            expect(content).toContain("size = 'var(--fs-accent-subtitle)'");
        });

        it('should accept optional color prop', () => {
            expect(content).toContain('color?: string');
        });

        it('should accept optional rotated prop', () => {
            expect(content).toContain('rotated?: boolean');
        });

        it('should default rotated to true', () => {
            expect(content).toContain('rotated = true');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });
    });

    describe('Typography', () => {
        it('should always apply font-accent', () => {
            expect(content).toContain('font-accent');
        });

        it('should apply text-accent-warm by default', () => {
            expect(content).toContain('text-accent-warm');
        });
    });

    describe('Rotation', () => {
        it('should conditionally apply -rotate-2 class', () => {
            expect(content).toContain('-rotate-2');
        });
    });

    describe('Structure', () => {
        it('should export SectionSubtitleProps', () => {
            expect(content).toContain('SectionSubtitleProps');
        });

        it('should use slot for content', () => {
            expect(content).toContain('<slot />');
        });
    });
});
