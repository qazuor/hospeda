/**
 * @file HostTradesAccessDenied.test.ts
 * @description Source-level guards for the shared host-only gate (H-05,
 * extracted from the directory index page).
 *
 * Vitest cannot render `.astro`, so these assertions read the source and the
 * locale files it resolves against, mirroring the pattern used across
 * `apps/web/test/pages` and `apps/web/test/components`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../../src/components/host/host-trades/HostTradesAccessDenied.astro'),
    'utf8'
);

const LOCALES = ['es', 'en', 'pt'] as const;

type AccessDeniedCopy = {
    readonly title: string;
    readonly message: string;
    readonly cta: string;
};

const readAccessDeniedCopy = (locale: (typeof LOCALES)[number]): AccessDeniedCopy => {
    const raw = readFileSync(
        resolve(
            __dirname,
            `../../../../../../packages/i18n/src/locales/${locale}/host-trades.json`
        ),
        'utf8'
    );
    return (JSON.parse(raw) as { accessDenied: AccessDeniedCopy }).accessDenied;
};

/**
 * Words that would reintroduce the false promise this component's history
 * carries (HOS-376 NG-5): the directory is free for every host, so the copy
 * must never claim a paid plan is required.
 */
const PAID_PLAN_CLAIMS = [
    /plan de anfitri[óo]n activo/i,
    /plan de anfitri[ãa]o ativo/i,
    /active host plan/i,
    /planes de suscripci[óo]n/i,
    /planos de assinatura/i,
    /subscription plans?/i
] as const;

describe('HostTradesAccessDenied.astro', () => {
    it('accepts a locale prop and resolves copy through t()', () => {
        expect(SOURCE).toContain('locale: SupportedLocale');
        expect(SOURCE).toMatch(/t\(\s*'host-trades\.accessDenied\.title'/);
        expect(SOURCE).toMatch(/t\(\s*'host-trades\.accessDenied\.message'/);
        expect(SOURCE).toMatch(/t\(\s*'host-trades\.accessDenied\.cta'/);
    });

    it('builds the CTA href with buildUrl to the "publicá en Hospeda" hub, never to pricing', () => {
        expect(SOURCE).toContain("import { buildUrl } from '@/lib/urls'");
        expect(SOURCE).toContain("buildUrl({ locale, path: 'mi-cuenta/publica' })");
        expect(SOURCE).not.toContain('/suscripcion');
        expect(SOURCE).not.toMatch(/href=\{`\/\$\{locale\}/);
    });

    it('renders as an alert region with the lock icon', () => {
        expect(SOURCE).toContain('role="alert"');
        expect(SOURCE).toContain('LockIcon');
    });

    it('keeps the inline i18n fallbacks in sync with the es locale file', () => {
        const es = readAccessDeniedCopy('es');
        expect(SOURCE).toContain(es.title);
        expect(SOURCE).toContain(es.message);
        expect(SOURCE).toContain(es.cta);
    });

    describe.each(LOCALES)('locale: %s', (locale) => {
        const copy = readAccessDeniedCopy(locale);

        it('does not claim a paid plan is required', () => {
            for (const claim of PAID_PLAN_CLAIMS) {
                expect(copy.message).not.toMatch(claim);
                expect(copy.cta).not.toMatch(claim);
            }
        });

        it('states that the directory is free', () => {
            expect(copy.message).toMatch(/gratuito|gratis|free/i);
        });

        it('has a CTA pointing at listing an accommodation, not at pricing', () => {
            expect(copy.cta).toMatch(/publi|list/i);
            expect(copy.cta.trim().length).toBeGreaterThan(0);
        });
    });
});
