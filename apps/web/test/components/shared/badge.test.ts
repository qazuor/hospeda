import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/Badge.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Badge.astro', () => {
    describe('Props', () => {
        it('should accept variant prop with BadgeVariant type', () => {
            expect(content).toContain('readonly variant?: BadgeVariant');
        });

        it('should accept class prop', () => {
            expect(content).toContain('readonly class?: string');
        });

        it('should default variant to primary', () => {
            expect(content).toContain("variant = 'primary'");
        });
    });

    describe('Variants', () => {
        it('should have primary variant with primary token classes', () => {
            expect(content).toContain('bg-primary/10 text-primary');
        });

        it('should have secondary variant', () => {
            expect(content).toContain('bg-secondary/10 text-secondary-foreground');
        });

        it('should have outline variant with border', () => {
            expect(content).toContain('border border-border text-muted-foreground');
        });

        it('should have accent variant', () => {
            expect(content).toContain('bg-accent/15 text-accent');
        });

        it('should have featured variant with backdrop blur', () => {
            expect(content).toContain('bg-accent/90 text-accent-foreground backdrop-blur-sm');
        });
    });

    describe('Styling', () => {
        it('should have base classes for inline display', () => {
            expect(content).toContain('inline-flex items-center');
        });

        it('should use rounded-full pill shape', () => {
            expect(content).toContain('rounded-full');
        });

        it('should use text-xs font size', () => {
            expect(content).toContain('text-xs');
        });

        it('should use class:list for Astro class merging', () => {
            expect(content).toContain('class:list');
        });
    });

    describe('Slots', () => {
        it('should render content via slot', () => {
            expect(content).toContain('<slot />');
        });
    });
});
