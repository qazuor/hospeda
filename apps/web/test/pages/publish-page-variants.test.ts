import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

describe('D10 shared publish page presentation', () => {
    it.each([
        'publicar/index.astro',
        'publicar/comer-y-salir/index.astro',
        'publicar/experiencias/index.astro'
    ])('%s wires the shared journey before rendering', (path) => {
        const src = readSource(`pages/[lang]/${path}`);
        expect(src).toContain('export const prerender = false');
        expect(src).toContain('resolvePublishPageFlow({');
        expect(src).toContain('permissions: Astro.locals.user?.permissions ?? []');
        expect(src).toContain('searchParams: Astro.url.searchParams');
        expect(src).toContain('if (redirectUrl) return Astro.redirect(redirectUrl)');
        expect(src.indexOf('Astro.redirect(redirectUrl)')).toBeLessThan(
            src.indexOf('<MarketingLayout')
        );
        for (const component of ['PublishHero', 'PublishHowItWorks', 'PublishPlanLinks']) {
            expect(src).toMatch(new RegExp(`<${component}\\s+variant=\\{variant\\}`));
        }
        expect(src.indexOf('<PublishFormSlot')).toBeLessThan(src.indexOf('<PublishHowItWorks'));
    });

    it('renders a compact heading that keeps the trial callout slot for direct journeys', () => {
        const src = readSource('components/publish/PublishHero.astro');
        const compact = src.slice(src.indexOf("variant === 'direct' ? ("), src.indexOf(') : ('));
        expect(compact).toContain('<h1');
        expect(compact).toContain('{title}');
        expect(compact).not.toContain('{body}');
        // The accommodation trial callout (HOS-1183 F-6) must survive the compact heading.
        expect(compact).toContain('<slot');
        expect(compact).not.toContain('<Icon');
    });

    it('omits marketing sections for direct journeys and plan links for members', () => {
        expect(readSource('components/publish/PublishHowItWorks.astro')).toContain(
            "variant !== 'direct' &&"
        );
        expect(readSource('components/publish/PublishPlanLinks.astro')).toContain(
            "variant === 'guest' &&"
        );
    });

    it('removes only registration for members and renumbers the visible steps', () => {
        const src = readSource('components/publish/PublishHowItWorks.astro');
        expect(src).toContain(
            "variant === 'member' && hasRegistrationStep ? steps.slice(1) : steps"
        );
        expect(src).toContain('visibleSteps.map((step, index)');
        expect(src).toContain('index + 1');
        expect(readSource('pages/[lang]/publicar/index.astro')).toContain('hasRegistrationStep');
        expect(readSource('pages/[lang]/publicar/comer-y-salir/index.astro')).not.toContain(
            'hasRegistrationStep'
        );
        expect(readSource('pages/[lang]/publicar/experiencias/index.astro')).not.toContain(
            'hasRegistrationStep'
        );
    });
});
