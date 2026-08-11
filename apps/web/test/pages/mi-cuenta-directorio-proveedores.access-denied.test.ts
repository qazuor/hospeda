/**
 * @file mi-cuenta-directorio-proveedores.access-denied.test.ts
 * @description Regression guard for the access-denied state of the host-trades
 * directory (HOS-376 §4 NG-5 / §5 hallazgo 3).
 *
 * The directory is a CAPTATION HOOK: it is free for every host and deliberately
 * NOT gated by a paid plan (owner decision, 2026-08-08). The backend has no
 * billing gate — `GET /protected/host-trades` only requires
 * `PermissionEnum.HOST_TRADE_VIEW`, and the `HOST` role is granted
 * unconditionally when a user creates their onboarding draft accommodation.
 *
 * The copy used to promise "necesitás un plan de anfitrión activo" and sent the
 * user to the subscription page. That promised a requirement the code never
 * enforced, and it aimed the pitch at the one person we most want to convert —
 * the access-denied state is reached ONLY by users who are not hosts yet, since
 * a host without a plan is never denied.
 *
 * These assertions lock both halves: the copy must not promise a plan, and the
 * CTA must not lead to pricing.
 *
 * Astro pages cannot be rendered in Vitest, so the page itself is asserted at
 * source level (same pattern as `mi-cuenta-addons.astro.test.ts`). The locale
 * files ARE the rendered content, so those are asserted on real parsed values.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = '../../src/pages/[lang]/mi-cuenta/directorio-proveedores/index.astro';
const source = readFileSync(resolve(__dirname, PAGE_PATH), 'utf8');

const LOCALES = ['es', 'en', 'pt'] as const;

type AccessDeniedCopy = {
    readonly title: string;
    readonly message: string;
    readonly cta: string;
};

const readAccessDeniedCopy = (locale: (typeof LOCALES)[number]): AccessDeniedCopy => {
    const raw = readFileSync(
        resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/host-trades.json`),
        'utf8'
    );
    return (JSON.parse(raw) as { accessDenied: AccessDeniedCopy }).accessDenied;
};

/**
 * Words that would reintroduce the false promise. Kept per-locale because the
 * check is about the CLAIM, not about a single string: "plan"/"subscription"
 * in any of the three languages means the copy is telling the user they must
 * pay for something that is free.
 */
const PAID_PLAN_CLAIMS = [
    /plan de anfitri[óo]n activo/i,
    /plan de anfitri[ãa]o ativo/i,
    /active host plan/i,
    /planes de suscripci[óo]n/i,
    /planos de assinatura/i,
    /subscription plans?/i
] as const;

describe('directorio-proveedores access-denied state (HOS-376 NG-5)', () => {
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

        it('keeps the title stating the section is host-only', () => {
            expect(copy.title.trim().length).toBeGreaterThan(0);
        });
    });

    it('routes the CTA to the "publicá en Hospeda" hub, never to the subscription page', () => {
        expect(source).toContain("buildUrl({ locale, path: 'mi-cuenta/publica' })");
        expect(source).toContain('href={accessDeniedCtaHref}');
        // The old hardcoded pricing link must not come back.
        expect(source).not.toContain('/suscripcion');
    });

    it('builds the CTA href with buildUrl instead of a hand-made template literal', () => {
        expect(source).toContain("import { buildUrl } from '@/lib/urls'");
        expect(source).not.toMatch(/href=\{`\/\$\{locale\}/);
    });

    it('keeps the inline i18n fallbacks in sync with the es locale file', () => {
        const es = readAccessDeniedCopy('es');
        expect(source).toContain(es.message);
        expect(source).toContain(es.cta);
    });
});
