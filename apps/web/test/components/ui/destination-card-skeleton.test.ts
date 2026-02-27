import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/ui/DestinationCardSkeleton.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('DestinationCardSkeleton.astro', () => {
    describe('Props', () => {
        it('should accept hero prop', () => {
            expect(content).toContain('hero?: boolean');
        });

        it('should accept class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should default hero to false', () => {
            expect(content).toContain('hero = false');
        });
    });

    describe('Structure', () => {
        it('should have role=status for loading state', () => {
            expect(content).toContain('role="status"');
        });

        it('should have aria-label for screen readers', () => {
            expect(content).toContain('aria-label={loadingLabel}');
        });

        it('should have sr-only loading text', () => {
            expect(content).toContain('sr-only');
            expect(content).toContain('loadingLabel');
        });

        it('should have glass bar skeleton', () => {
            expect(content).toContain('skeleton-glass-bar');
        });

        it('should have shimmer animation', () => {
            expect(content).toContain('animate-shimmer');
        });
    });

    describe('Dark mode', () => {
        it('should have dark mode variant for glass bar background', () => {
            expect(content).toContain('[data-theme="dark"]');
        });

        it('should have glass bar skeleton class', () => {
            expect(content).toContain('skeleton-glass-bar');
        });
    });

    describe('Hero variant', () => {
        it('should have taller min-height for hero', () => {
            expect(content).toContain('min-h-[320px]');
            expect(content).toContain('sm:min-h-[400px]');
        });

        it('should have rounded-xl on hero wrapper', () => {
            expect(content).toContain('rounded-xl');
        });
    });

    describe('Default variant - torn-edge layout', () => {
        it('should use torn-edge-mask on image area', () => {
            expect(content).toContain('torn-edge-mask');
        });

        it('should have text-below area with title placeholder', () => {
            expect(content).toContain('px-1 pt-2.5 pb-1');
        });

        it('should have primary-colored badge placeholders below image', () => {
            expect(content).toContain('bg-primary/10');
        });
    });

    describe('Placeholders', () => {
        it('should have stat counter placeholders', () => {
            expect(content).toContain('h-3.5');
        });

        it('should have attraction badge placeholders', () => {
            expect(content).toContain('rounded-full');
        });
    });
});
