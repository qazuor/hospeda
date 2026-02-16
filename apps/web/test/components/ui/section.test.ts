import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Section.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Section.astro', () => {
    describe('Props', () => {
        it('should accept optional title', () => {
            expect(content).toContain('title?: string');
        });

        it('should accept optional subtitle', () => {
            expect(content).toContain('subtitle?: string');
        });

        it('should accept optional class', () => {
            expect(content).toContain('class?: string');
        });

        it('should accept optional id', () => {
            expect(content).toContain('id?: string');
        });
    });

    describe('Structure', () => {
        it('should use semantic section element', () => {
            expect(content).toContain('<section');
        });

        it('should render title as h2', () => {
            expect(content).toContain('<h2');
        });

        it('should include vertical padding', () => {
            expect(content).toContain('py-12');
        });

        it('should include a slot', () => {
            expect(content).toContain('<slot />');
        });
    });
});
