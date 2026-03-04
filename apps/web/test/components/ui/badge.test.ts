import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Badge.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Badge.astro', () => {
    describe('Props', () => {
        it('should require label prop', () => {
            expect(content).toContain('label: string');
        });

        it('should accept variant prop with all variants', () => {
            expect(content).toContain("'primary'");
            expect(content).toContain("'secondary'");
            expect(content).toContain("'outline'");
            expect(content).toContain("'type'");
            expect(content).toContain("'price'");
            expect(content).toContain("'rating'");
            expect(content).toContain("'month'");
            expect(content).toContain("'tag'");
            expect(content).toContain("'category'");
        });

        it('should accept class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should default variant to primary', () => {
            expect(content).toContain("variant = 'primary'");
        });

        it('should accept optional color prop for month variant', () => {
            expect(content).toContain('color?: string');
        });

        it('should accept optional colorClass prop for category variant', () => {
            expect(content).toContain('colorClass?: string');
        });
    });

    describe('Existing Variants', () => {
        it('should have primary variant', () => {
            expect(content).toContain('bg-primary/10');
            expect(content).toContain('text-primary');
        });

        it('should have secondary variant', () => {
            expect(content).toContain('bg-secondary/10');
            expect(content).toContain('text-secondary-dark');
        });

        it('should have outline variant', () => {
            expect(content).toContain('border-border');
            expect(content).toContain('text-text-secondary');
        });
    });

    describe('Type Variant', () => {
        it('should have surface/90% background', () => {
            expect(content).toContain('bg-surface/90');
        });

        it('should use text token', () => {
            expect(content).toContain('text-text');
        });

        it('should use rounded-full', () => {
            expect(content).toContain('rounded-full');
        });
    });

    describe('Price Variant', () => {
        it('should use accent-primary background', () => {
            expect(content).toContain('bg-primary');
        });

        it('should use white text', () => {
            expect(content).toContain('text-white');
        });

        it('should use bold font weight', () => {
            expect(content).toContain('font-bold');
        });
    });

    describe('Rating Variant', () => {
        it('should use amber-400 background', () => {
            expect(content).toContain('bg-amber-400');
        });

        it('should use white text and bold', () => {
            expect(content).toContain('text-white');
            expect(content).toContain('font-bold');
        });

        it('should use rounded (6px radius)', () => {
            expect(content).toContain('rounded');
        });
    });

    describe('Month Variant', () => {
        it('should use white text', () => {
            expect(content).toContain('text-white');
        });

        it('should use rounded-sm', () => {
            expect(content).toContain('rounded-sm');
        });

        it('should use large text size and bold', () => {
            expect(content).toContain('text-lg');
            expect(content).toContain('font-bold');
        });

        it('should apply dynamic color via color prop', () => {
            expect(content).toContain('color');
        });
    });

    describe('Tag Variant', () => {
        it('should use surface-alt background', () => {
            expect(content).toContain('bg-surface-alt');
        });

        it('should use text-secondary token', () => {
            expect(content).toContain('text-text-secondary');
        });

        it('should use caption size (text-xs)', () => {
            expect(content).toContain('text-xs');
        });

        it('should use medium font weight', () => {
            expect(content).toContain('font-medium');
        });

        it('should use rounded-full', () => {
            expect(content).toContain('rounded-full');
        });
    });

    describe('Category Variant', () => {
        it('should use white text', () => {
            expect(content).toContain('text-white');
        });

        it('should apply dynamic colorClass prop', () => {
            expect(content).toContain('colorClass');
        });
    });

    describe('Base styles', () => {
        it('should use inline-flex display', () => {
            expect(content).toContain('inline-flex');
        });

        it('should use items-center alignment', () => {
            expect(content).toContain('items-center');
        });
    });

    describe('Structure', () => {
        it('should render as span', () => {
            expect(content).toContain('<span');
        });

        it('should render the label text', () => {
            expect(content).toContain('{label}');
        });

        it('should support class:list for dynamic classes', () => {
            expect(content).toContain('class:list');
        });
    });
});
