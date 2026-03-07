import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/EmptyState.astro');
const content = readFileSync(componentPath, 'utf8');

describe('EmptyState.astro', () => {
    describe('Props', () => {
        it('should accept title prop', () => {
            expect(content).toContain('readonly title: string');
        });

        it('should accept message prop', () => {
            expect(content).toContain('readonly message: string');
        });

        it('should accept optional cta prop with label and href', () => {
            expect(content).toContain('readonly label: string');
            expect(content).toContain('readonly href: string');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('readonly class?: string');
        });
    });

    describe('Imports', () => {
        it('should import SearchIcon from @repo/icons', () => {
            expect(content).toContain("import { SearchIcon } from '@repo/icons'");
        });

        it('should import GradientButton', () => {
            expect(content).toContain("import GradientButton from './GradientButton.astro'");
        });
    });

    describe('Design tokens', () => {
        it('should use foreground token for title', () => {
            expect(content).toContain('text-foreground');
        });

        it('should use muted-foreground token for message and icon', () => {
            expect(content).toContain('text-muted-foreground');
        });
    });

    describe('Structure', () => {
        it('should render SearchIcon with aria-hidden', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should use class:list for Astro class merging', () => {
            expect(content).toContain('class:list');
        });

        it('should conditionally render CTA with GradientButton', () => {
            expect(content).toContain('{cta && (');
            expect(content).toContain('GradientButton');
        });
    });
});
