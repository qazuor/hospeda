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

        it('should use i18n for short description', () => {
            expect(content).toContain("ft('shortDescription')");
        });

        it('should use i18n for mate tagline', () => {
            expect(content).toContain("ft('mateTagline')");
        });
    });

    describe('Skyline silhouette', () => {
        it('should have SVG skyline divider', () => {
            expect(content).toContain('<svg');
            expect(content).toContain('skyline');
        });
    });

    describe('Link groups', () => {
        it('should have explore section via i18n', () => {
            expect(content).toContain("ft('explore')");
        });

        it('should have legal section via i18n', () => {
            expect(content).toContain("ft('legal')");
        });

        it('should include key navigation links', () => {
            expect(content).toContain('/alojamientos/');
            expect(content).toContain('/destinos/');
            expect(content).toContain('/eventos/');
            expect(content).toContain('/publicaciones/');
        });

        it('should include legal links', () => {
            expect(content).toContain('/terminos-condiciones/');
            expect(content).toContain('/privacidad/');
        });
    });

    describe('Social media', () => {
        it('should have social media links', () => {
            expect(content).toContain('instagram');
            expect(content).toContain('facebook');
        });

        it('should have hover scale animation on social links', () => {
            expect(content).toContain('hover:scale-110');
        });
    });

    describe('Regional identity', () => {
        it('should use teal-to-night gradient background', () => {
            expect(content).toContain('from-primary-900');
            expect(content).toContain('footer-gradient-end');
        });

        it('should use Caveat font for mate tagline via i18n', () => {
            expect(content).toContain('font-accent');
            expect(content).toContain("ft('mateTagline')");
        });
    });

    describe('Copyright', () => {
        it('should include copyright text via i18n', () => {
            expect(content).toContain('Hospeda');
            expect(content).toContain("ft('rights')");
        });
    });

    describe('Responsive', () => {
        it('should use grid for columns', () => {
            expect(content).toContain('grid');
            expect(content).toContain('md:grid-cols');
        });
    });
});
