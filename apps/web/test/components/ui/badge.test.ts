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

        it('should accept variant prop', () => {
            expect(content).toContain("variant?: 'primary' | 'secondary' | 'outline'");
        });

        it('should accept class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should default variant to primary', () => {
            expect(content).toContain("variant = 'primary'");
        });
    });

    describe('Variants', () => {
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

    describe('Base styles', () => {
        it('should use rounded-full for pill shape', () => {
            expect(content).toContain('rounded-full');
        });

        it('should use small text size', () => {
            expect(content).toContain('text-xs');
        });

        it('should use medium font weight', () => {
            expect(content).toContain('font-medium');
        });

        it('should use inline-flex display', () => {
            expect(content).toContain('inline-flex');
        });
    });

    describe('Structure', () => {
        it('should render as span', () => {
            expect(content).toContain('<span');
        });

        it('should render the label text', () => {
            expect(content).toContain('{label}');
        });
    });
});
