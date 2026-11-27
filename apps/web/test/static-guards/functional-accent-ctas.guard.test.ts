/** D7: functional CTAs stay flat while marketing hero gradients remain available. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

describe('functional accent CTAs', () => {
    it.each([
        'AboutUsSection',
        'CtaOwnersSection'
    ])('keeps the non-hero %s CTA flat accent', (name) => {
        const button = source(`components/sections/${name}.astro`).match(
            /<GradientButton\b[^>]*\/>/
        )?.[0];
        expect(button).toContain('variant="accent"');
        expect(button).toMatch(/\sflat\s/);
    });

    it('keeps the header publish trigger flat on every page', () => {
        expect(source('components/shared/navigation/PublishMenu.client.tsx')).toContain(
            'btn-gradient btn-gradient--accent btn-gradient--flat btn-gradient--sm'
        );
    });

    it('keeps the header guest «Iniciar sesión» a secondary outline action (HOS-2666)', () => {
        const menu = source('components/shared/navigation/UserMenu.client.tsx');
        expect(menu).not.toContain('btn-gradient');
        expect(source('components/shared/navigation/UserMenu.module.css')).toMatch(
            /\.signInLink\s*\{[^}]*border: 1\.5px solid var\(--brand-primary\);[^}]*background-color: transparent/
        );
    });

    it('keeps the /publicar create-draft submit the flat accent kit button (HOS-2664)', () => {
        const form = source('components/host/CreatePropertyMiniForm.client.tsx');
        expect(form).toMatch(/<Button\s+type="submit"\s+variant="accent"/);
    });

    it('uses the accent kit link for primary precheck actions', () => {
        expect(source('components/host/PublishPrecheckPanel.astro')).toMatch(
            /<LinkButton\s+variant="accent"\s+href=\{action.href\}/
        );
    });

    it('preserves hero gradients and removes shadows from functional accent controls', () => {
        const css = source('styles/components.css');
        expect(css).toMatch(/\.btn-gradient--accent\s*\{[^}]*linear-gradient/);
        expect(css).toMatch(
            /\.btn-gradient--flat\.btn-gradient--accent\s*\{[^}]*background-image: none;[^}]*box-shadow: none/
        );
        const heroButton = source('components/sections/HeroSection.astro').match(
            /<GradientButton\b[^>]*\/>/
        )?.[0];
        expect(heroButton).toBeDefined();
        expect(heroButton).not.toMatch(/\sflat(?:\s|[=>])/);
    });
});
