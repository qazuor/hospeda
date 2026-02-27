import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/SectionHeader.astro');
const content = readFileSync(componentPath, 'utf8');

describe('SectionHeader.astro', () => {
    describe('Props', () => {
        it('should require title prop', () => {
            expect(content).toContain('title: string');
        });

        it('should accept optional accentSubtitle', () => {
            expect(content).toContain('accentSubtitle?: string');
        });

        it('should accept optional icon prop', () => {
            expect(content).toContain('icon?:');
        });

        it('should accept optional description prop', () => {
            expect(content).toContain('description?: string');
        });

        it('should accept optional viewAllHref', () => {
            expect(content).toContain('viewAllHref?: string');
        });

        it('should accept optional viewAllLabel', () => {
            expect(content).toContain('viewAllLabel?: string');
        });

        it('should accept optional align prop', () => {
            expect(content).toContain('align?:');
            expect(content).toContain("'left'");
            expect(content).toContain("'center'");
        });

        it('should accept optional underline prop', () => {
            expect(content).toContain('underline?: boolean');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });
    });

    describe('Typography', () => {
        it('should use SectionTitle for the heading', () => {
            expect(content).toContain('SectionTitle');
            expect(content).toContain("import SectionTitle from './SectionTitle.astro'");
        });

        it('should use SectionSubtitle for the accent subtitle', () => {
            expect(content).toContain('SectionSubtitle');
            expect(content).toContain("import SectionSubtitle from './SectionSubtitle.astro'");
        });
    });

    describe('Icon', () => {
        it('should have aria-hidden on icon container', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have rounded-xl on icon container', () => {
            expect(content).toContain('rounded-xl');
        });
    });

    describe('Description', () => {
        it('should constrain description to max-w-[600px]', () => {
            expect(content).toContain('max-w-[600px]');
        });
    });

    describe('View All link', () => {
        it('should render anchor element for viewAllHref', () => {
            expect(content).toContain('<a');
            expect(content).toContain('viewAllHref');
        });
    });

    describe('Structure', () => {
        it('should export SectionHeaderProps', () => {
            expect(content).toContain('SectionHeaderProps');
        });
    });
});
