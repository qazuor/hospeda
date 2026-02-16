import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../src/layouts/Header.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Header.astro', () => {
    describe('Semantic HTML', () => {
        it('should use header element', () => {
            expect(content).toContain('<header');
        });

        it('should have navigation with role', () => {
            expect(content).toContain('role="navigation"');
        });

        it('should have aria-label for navigation', () => {
            expect(content).toContain('aria-label=');
        });
    });

    describe('Logo', () => {
        it('should render Hospeda text', () => {
            expect(content).toContain('Hospeda');
        });

        it('should link to locale root', () => {
            expect(content).toContain('${locale}/');
        });

        it('should use serif font', () => {
            expect(content).toContain('font-serif');
        });
    });

    describe('Navigation links', () => {
        it('should include Alojamientos link', () => {
            expect(content).toContain('Alojamientos');
            expect(content).toContain('/alojamientos/');
        });

        it('should include Destinos link', () => {
            expect(content).toContain('Destinos');
            expect(content).toContain('/destinos/');
        });

        it('should include Eventos link', () => {
            expect(content).toContain('Eventos');
            expect(content).toContain('/eventos/');
        });

        it('should include Blog link', () => {
            expect(content).toContain('Blog');
            expect(content).toContain('/publicaciones/');
        });
    });

    describe('Responsive', () => {
        it('should hide desktop nav on mobile', () => {
            expect(content).toContain('hidden');
            expect(content).toContain('md:flex');
        });

        it('should show mobile menu button only on mobile', () => {
            expect(content).toContain('md:hidden');
        });

        it('should have accessible mobile menu button', () => {
            expect(content).toContain('aria-label="Open menu"');
        });
    });

    describe('Sticky behavior', () => {
        it('should be sticky positioned', () => {
            expect(content).toContain('sticky');
            expect(content).toContain('top-0');
        });

        it('should have appropriate z-index', () => {
            expect(content).toContain('z-20');
        });
    });

    describe('Styling', () => {
        it('should have white background', () => {
            expect(content).toContain('bg-surface');
        });

        it('should have bottom border', () => {
            expect(content).toContain('border-b');
        });
    });
});
