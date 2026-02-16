import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../src/layouts/Footer.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Footer.astro', () => {
    describe('Semantic HTML', () => {
        it('should use footer element', () => {
            expect(content).toContain('<footer');
        });

        it('should have contentinfo role', () => {
            expect(content).toContain('role="contentinfo"');
        });
    });

    describe('Brand section', () => {
        it('should render Hospeda logo text', () => {
            expect(content).toContain('Hospeda');
        });

        it('should have tagline', () => {
            expect(content).toContain('Litoral argentino');
        });
    });

    describe('Link groups', () => {
        it('should have Explorar section', () => {
            expect(content).toContain('Explorar');
        });

        it('should have Informacion section', () => {
            expect(content).toContain('Informacion');
        });

        it('should have Legal section', () => {
            expect(content).toContain('Legal');
        });

        it('should include key navigation links', () => {
            expect(content).toContain('/alojamientos/');
            expect(content).toContain('/destinos/');
            expect(content).toContain('/eventos/');
            expect(content).toContain('/publicaciones/');
        });

        it('should include info links', () => {
            expect(content).toContain('/quienes-somos/');
            expect(content).toContain('/beneficios/');
            expect(content).toContain('/contacto/');
        });

        it('should include legal links', () => {
            expect(content).toContain('/terminos-condiciones/');
            expect(content).toContain('/privacidad/');
            expect(content).toContain('/sitemap/');
        });
    });

    describe('Copyright', () => {
        it('should include copyright text', () => {
            expect(content).toContain('Hospeda');
            expect(content).toContain('Todos los derechos reservados');
        });
    });

    describe('Responsive', () => {
        it('should use grid for columns', () => {
            expect(content).toContain('grid');
            expect(content).toContain('md:grid-cols');
        });
    });
});
