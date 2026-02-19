import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Button.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Button.astro', () => {
    describe('Props', () => {
        it('should accept variant prop with all variants including new ones', () => {
            expect(content).toContain("'primary'");
            expect(content).toContain("'secondary'");
            expect(content).toContain("'outline'");
            expect(content).toContain("'ghost'");
            expect(content).toContain("'primary-warm'");
            expect(content).toContain("'cta-hero'");
        });

        it('should accept size prop', () => {
            expect(content).toContain("size?: 'sm' | 'md' | 'lg'");
        });

        it('should accept disabled prop', () => {
            expect(content).toContain('disabled?: boolean');
        });

        it('should accept loading prop', () => {
            expect(content).toContain('loading?: boolean');
        });

        it('should accept type prop', () => {
            expect(content).toContain("type?: 'button' | 'submit' | 'reset'");
        });

        it('should accept href prop for link rendering', () => {
            expect(content).toContain('href?: string');
        });

        it('should default variant to primary', () => {
            expect(content).toContain("variant = 'primary'");
        });

        it('should default size to md', () => {
            expect(content).toContain("size = 'md'");
        });
    });

    describe('Existing Variants', () => {
        it('should have primary variant styles', () => {
            expect(content).toContain('bg-primary');
            expect(content).toContain('text-white');
            expect(content).toContain('hover:bg-primary-dark');
        });

        it('should have secondary variant styles', () => {
            expect(content).toContain('bg-secondary');
            expect(content).toContain('hover:bg-secondary-dark');
        });

        it('should have outline variant styles', () => {
            expect(content).toContain('border-primary');
            expect(content).toContain('text-primary');
        });

        it('should have ghost variant styles', () => {
            expect(content).toContain('text-text');
            expect(content).toContain('hover:bg-bg');
        });
    });

    describe('Primary Warm Variant', () => {
        it('should use orange-500 background', () => {
            expect(content).toContain('bg-orange-500');
        });

        it('should use white text', () => {
            expect(content).toContain('text-white');
        });

        it('should darken to orange-600 on hover', () => {
            expect(content).toContain('hover:bg-orange-600');
        });

        it('should use rounded-lg border-radius', () => {
            expect(content).toContain('rounded-lg');
        });
    });

    describe('CTA Hero Variant', () => {
        it('should use accent-primary (bg-primary) background', () => {
            expect(content).toContain('bg-primary');
        });

        it('should use white text', () => {
            expect(content).toContain('text-white');
        });

        it('should apply rounded-r-lg only (right side radius)', () => {
            expect(content).toContain('rounded-r-lg');
            expect(content).toContain('rounded-l-none');
        });

        it('should use larger padding for search bar height', () => {
            expect(content).toContain('py-4');
            expect(content).toContain('px-10');
        });
    });

    describe('Uniform Border Radius', () => {
        it('should use rounded-lg for sm size', () => {
            // All standard sizes should have rounded-lg
            expect(content).toContain('rounded-lg');
        });

        it('should not use rounded-md for standard sizes', () => {
            // rounded-md should be removed from sizeClasses
            expect(content).not.toContain('rounded-md');
        });
    });

    describe('Sizes', () => {
        it('should have sm size', () => {
            expect(content).toContain('text-sm');
        });

        it('should have md size', () => {
            expect(content).toContain('text-base');
        });

        it('should have lg size', () => {
            expect(content).toContain('text-lg');
            expect(content).toContain('rounded-lg');
        });
    });

    describe('Accessibility', () => {
        it('should have focus-visible styles', () => {
            expect(content).toContain('focus-visible:outline');
        });

        it('should support aria-disabled for links', () => {
            expect(content).toContain('aria-disabled');
        });

        it('should support aria-busy for loading state', () => {
            expect(content).toContain('aria-busy');
        });

        it('should disable pointer events when disabled', () => {
            expect(content).toContain('disabled:pointer-events-none');
            expect(content).toContain('disabled:opacity-50');
        });
    });

    describe('Loading state', () => {
        it('should show spinner when loading', () => {
            expect(content).toContain('animate-spin');
            expect(content).toContain('border-t-transparent');
        });

        it('should hide spinner from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Link rendering', () => {
        it('should render as anchor when href provided', () => {
            expect(content).toContain('<a');
            expect(content).toContain('href');
        });

        it('should render as button when no href', () => {
            expect(content).toContain('<button');
        });
    });
});
