import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Container.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Container.astro', () => {
    describe('Props', () => {
        it('should accept size prop with union type including site', () => {
            expect(content).toContain("size?: 'sm' | 'md' | 'lg' | 'xl' | 'site'");
        });

        it('should accept class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should default size to lg', () => {
            expect(content).toContain("size = 'lg'");
        });
    });

    describe('Size classes', () => {
        it('should map sm to max-w-3xl', () => {
            expect(content).toContain('max-w-3xl');
        });

        it('should map md to max-w-5xl', () => {
            expect(content).toContain('max-w-5xl');
        });

        it('should map lg to max-w-6xl', () => {
            expect(content).toContain('max-w-6xl');
        });

        it('should map xl to max-w-7xl', () => {
            expect(content).toContain('max-w-7xl');
        });

        it('should map site to max-w-site', () => {
            expect(content).toContain('max-w-site');
        });
    });

    describe('Structure', () => {
        it('should center with mx-auto', () => {
            expect(content).toContain('mx-auto');
        });

        it('should have responsive padding', () => {
            expect(content).toContain('px-4');
            expect(content).toContain('sm:px-6');
            expect(content).toContain('lg:px-8');
        });

        it('should include a slot', () => {
            expect(content).toContain('<slot />');
        });
    });
});
