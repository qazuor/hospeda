import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/illustrations/dividers/WaveDivider.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('WaveDivider.astro', () => {
    describe('Props', () => {
        it('should accept optional fill prop', () => {
            expect(content).toContain('fill?: string');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should export WaveDividerProps', () => {
            expect(content).toContain('WaveDividerProps');
        });
    });

    describe('SVG attributes', () => {
        it('should have aria-hidden on SVG', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have focusable="false"', () => {
            expect(content).toContain('focusable="false"');
        });

        it('should have preserveAspectRatio="none"', () => {
            expect(content).toContain('preserveAspectRatio="none"');
        });

        it('should have width="100%"', () => {
            expect(content).toContain('width="100%"');
        });
    });

    describe('Responsive height', () => {
        it('should have mobile height class h-10', () => {
            expect(content).toContain('h-10');
        });

        it('should have desktop height class sm:h-[60px]', () => {
            expect(content).toContain('sm:h-[60px]');
        });
    });

    describe('Fill', () => {
        it('should reference fill prop in path element', () => {
            expect(content).toContain('fill');
            expect(content).toContain('<path');
        });
    });

    describe('Size', () => {
        it('should be under 100 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThanOrEqual(100);
        });
    });
});
