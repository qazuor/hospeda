/**
 * @file plan-copy-veracity.test.ts
 * @description Regression guard for the FREE-FORM plan copy (HOS-331).
 *
 * The comparison table and the `/funcionalidades` brochure are structured data
 * and are already guarded by `features-content-veracity.test.ts`. The plan
 * *descriptions* are not: they are prose living in i18n JSON, rendered on the
 * public pricing cards (`billing.plan.<slug>.description`, via
 * `getPlanDescription`) and in the admin plan table
 * (`admin-billing.plans.descriptions.<slug>`). Prose drifts silently — HOS-16
 * deleted the `AD_FREE` entitlement and both surfaces kept selling "ad-free"
 * for months.
 *
 * The guard below pins each marketing claim to the entitlement that backs it:
 *
 *  - A claim whose key is not in `EntitlementKey` at all (`ad_free`,
 *    `concierge`, …) is a PHANTOM: no plan can ever legitimately make it, so
 *    any copy containing its phrase fails.
 *  - A claim whose key IS a real entitlement may only appear in the copy of a
 *    plan that actually grants it.
 *
 * ## What this guard is NOT
 *
 * Matching is `copy.includes(phrase)` against an enumerated phrase list, so it
 * catches a REGRESSION TO KNOWN WORDING, not every possible unbacked claim.
 * Rewording "sin publicidad" as "libre de anuncios" walks past it, and a
 * brand-new invented feature nobody listed is invisible to it. It is a ratchet
 * on the lies we have already told, not a proof of honesty. Two consequences:
 * add the phrase here whenever a claim is removed from copy, and do not treat
 * a green run as licence to skip reading new marketing text.
 *
 * It is also blind to "granted but not built": `PRIORITY_SUPPORT` and
 * `CUSTOM_BRANDING` are real entitlements on real plans, yet
 * `features-content-veracity.test.ts` pins both as `upcoming` because no gate
 * consumes them. Selling those in prose is an owner decision (2026-07-28), not
 * something this file can adjudicate.
 *
 * This lives in `apps/web` rather than `packages/i18n` because the assertion
 * needs `@repo/billing`, and `packages/i18n` is deliberately a leaf package
 * with no billing dependency. The locale JSON is read from disk so the single
 * guard covers both the web and the admin namespace.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_PLANS, EntitlementKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');

/** Every value the `EntitlementKey` enum actually defines. */
const REAL_ENTITLEMENTS = new Set<string>(Object.values(EntitlementKey));

/**
 * A marketing claim that plan copy can make, and the entitlement key that has
 * to back it. `entitlement` is intentionally a raw string, not an
 * `EntitlementKey`: phantom claims name keys that do NOT exist in the enum, and
 * that is exactly what makes them unusable in copy.
 */
interface PlanClaim {
    readonly id: string;
    readonly entitlement: string;
    /** Lowercased substrings, per locale, that assert this claim. */
    readonly phrases: Readonly<Record<Locale, readonly string[]>>;
}

/**
 * Claims that no plan can make, because the feature has no entitlement in the
 * catalog. `ad_free` was removed by HOS-16; the rest were never modeled at all
 * and were pure marketing invention (owner decision 2026-07-28, HOS-331).
 */
const PHANTOM_CLAIMS: readonly PlanClaim[] = [
    {
        id: 'ad-free',
        entitlement: 'ad_free',
        phrases: {
            es: ['sin publicidad', 'sin anuncios'],
            en: ['ad-free', 'ad free'],
            pt: ['sem anúncios', 'sem publicidade']
        }
    },
    {
        id: 'early-access-events',
        entitlement: 'early_access_events',
        phrases: {
            es: ['acceso anticipado'],
            en: ['early access'],
            pt: ['acesso antecipado']
        }
    },
    {
        id: 'concierge',
        entitlement: 'concierge',
        phrases: { es: ['conserjería'], en: ['concierge'], pt: ['concierge'] }
    },
    {
        id: 'airport-transfers',
        entitlement: 'airport_transfers',
        phrases: {
            es: ['traslados al aeropuerto'],
            en: ['airport transfer'],
            pt: ['traslados ao aeroporto']
        }
    },
    {
        id: 'api-access',
        entitlement: 'api_access',
        phrases: {
            es: ['acceso a api', 'acceso a la api'],
            en: ['api access'],
            pt: ['acesso à api', 'acesso a api']
        }
    },
    {
        id: 'dedicated-manager',
        entitlement: 'dedicated_manager',
        phrases: {
            es: ['gestor dedicado'],
            en: ['dedicated manager'],
            pt: ['gerente dedicado']
        }
    }
];

/**
 * Claims backed by a real entitlement. A plan may only make them when its own
 * entitlement list grants the key — this is what catches copy that survives a
 * repackaging (a claim moved to a higher tier but left in the lower tier's
 * description).
 */
const BACKED_CLAIMS: readonly PlanClaim[] = [
    {
        id: 'price-alerts',
        entitlement: EntitlementKey.PRICE_ALERTS,
        phrases: {
            es: ['alertas de precio'],
            en: ['price alert'],
            pt: ['alertas de preço']
        }
    },
    {
        id: 'exclusive-deals',
        entitlement: EntitlementKey.EXCLUSIVE_DEALS,
        phrases: {
            es: ['ofertas exclusivas'],
            en: ['exclusive deals'],
            pt: ['ofertas exclusivas']
        }
    },
    {
        id: 'vip-support',
        entitlement: EntitlementKey.VIP_SUPPORT,
        phrases: { es: ['soporte vip'], en: ['vip support'], pt: ['suporte vip'] }
    },
    {
        id: 'vip-promotions',
        entitlement: EntitlementKey.VIP_PROMOTIONS_ACCESS,
        phrases: {
            es: ['promociones exclusivas'],
            en: ['exclusive promotions'],
            pt: ['promoções exclusivas']
        }
    },
    {
        id: 'whatsapp-direct',
        entitlement: EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        phrases: {
            es: ['contacto directo por whatsapp'],
            en: ['direct whatsapp contact'],
            pt: ['contato direto por whatsapp']
        }
    },
    {
        id: 'custom-branding',
        entitlement: EntitlementKey.CUSTOM_BRANDING,
        phrases: {
            es: ['branding personalizado'],
            en: ['custom branding'],
            pt: ['identidade visual personalizada']
        }
    },
    {
        id: 'priority-support',
        entitlement: EntitlementKey.PRIORITY_SUPPORT,
        phrases: {
            es: ['soporte prioritario'],
            en: ['priority support'],
            pt: ['suporte prioritário']
        }
    },
    {
        id: 'verification-badge',
        entitlement: EntitlementKey.HAS_VERIFICATION_BADGE,
        phrases: {
            es: ['sello de verificación'],
            en: ['verification badge'],
            pt: ['selo de verificação']
        }
    },
    {
        id: 'advanced-stats',
        entitlement: EntitlementKey.VIEW_ADVANCED_STATS,
        phrases: {
            es: ['estadísticas avanzadas', 'analíticas avanzadas'],
            en: ['advanced statistics', 'advanced analytics'],
            pt: ['estatísticas avançadas', 'análises avançadas']
        }
    },
    {
        id: 'featured-listing',
        entitlement: EntitlementKey.FEATURED_LISTING,
        phrases: {
            es: ['listado destacado'],
            en: ['featured listing'],
            pt: ['anúncio em destaque']
        }
    }
];

function readLocaleJson(locale: Locale, file: string): Record<string, unknown> {
    return JSON.parse(readFileSync(resolve(LOCALES_DIR, locale, file), 'utf8'));
}

function lookup(source: Record<string, unknown>, path: string): string | undefined {
    let cursor: unknown = source;
    for (const segment of path.split('.')) {
        if (typeof cursor !== 'object' || cursor === null) return undefined;
        cursor = (cursor as Record<string, unknown>)[segment];
    }
    return typeof cursor === 'string' ? cursor : undefined;
}

/** Locales that must carry a description for every active plan. */
const ACTIVE_PLANS = ALL_PLANS.filter((plan) => plan.isActive);

/**
 * Every plan description rendered by a product surface, as
 * `{ slug, locale, surface, copy }`. Missing keys are skipped here and asserted
 * separately by the presence test below — skipping silently is what would let a
 * deleted key sail through, since a plan with no translation falls back to the
 * ENGLISH `PlanDefinition.description` on a Spanish page.
 */
function collectPlanCopy(): ReadonlyArray<{
    readonly slug: string;
    readonly locale: Locale;
    readonly surface: string;
    readonly copy: string;
}> {
    const rows: Array<{ slug: string; locale: Locale; surface: string; copy: string }> = [];
    for (const locale of LOCALES) {
        const billing = readLocaleJson(locale, 'billing.json');
        const adminBilling = readLocaleJson(locale, 'admin-billing.json');
        for (const plan of ALL_PLANS) {
            const web = lookup(billing, `plan.${plan.slug}.description`);
            if (web) {
                rows.push({ slug: plan.slug, locale, surface: 'billing.plan', copy: web });
            }
            const admin = lookup(adminBilling, `plans.descriptions.${plan.slug}`);
            if (admin) {
                rows.push({
                    slug: plan.slug,
                    locale,
                    surface: 'admin-billing.plans.descriptions',
                    copy: admin
                });
            }
        }
    }
    return rows;
}

/**
 * Free-form plan/billing prose that lives OUTSIDE the plan descriptions and is
 * still rendered to users: the public FAQ and the owners landing. These carried
 * their own unbacked claims ("soporte dedicado", collections on a free account)
 * and were invisible to the first version of this guard, which read only the two
 * description paths (HOS-331 round 2).
 *
 * Keyed by locale-relative file and dotted path so a failure names the exact
 * string to fix.
 */
const PROSE_SURFACES: ReadonlyArray<{ readonly file: string; readonly path: string }> = [
    { file: 'faq.json', path: 'categories.owners.items.cost.answer' },
    { file: 'faq.json', path: 'categories.owners.items.commission.answer' },
    { file: 'faq.json', path: 'categories.owners.items.featured.answer' },
    { file: 'faq.json', path: 'categories.owners.items.support.answer' },
    { file: 'faq.json', path: 'categories.tourists.items.favorites.answer' },
    { file: 'faq.json', path: 'categories.tourists.items.reviews.answer' },
    { file: 'owners.json', path: 'page.description' },
    { file: 'owners.json', path: 'faq.1.a' },
    { file: 'owners.json', path: 'faq.2.a' },
    { file: 'owners.json', path: 'faq.3.a' },
    { file: 'owners.json', path: 'host.landing.trialCallout' },
    { file: 'owners.json', path: 'host.pages.nueva.trialNote' },
    { file: 'features.json', path: 'anfitriones.banner.title' },
    { file: 'features.json', path: 'cta.description' }
];

function collectProseCopy(): ReadonlyArray<{
    readonly locale: Locale;
    readonly surface: string;
    readonly copy: string;
}> {
    const rows: Array<{ locale: Locale; surface: string; copy: string }> = [];
    for (const locale of LOCALES) {
        for (const { file, path } of PROSE_SURFACES) {
            const copy = lookup(readLocaleJson(locale, file), path);
            if (copy) rows.push({ locale, surface: `${file}:${path}`, copy });
        }
    }
    return rows;
}

const PLAN_COPY = collectPlanCopy();
const PROSE_COPY = collectProseCopy();
const PLAN_BY_SLUG = new Map(ALL_PLANS.map((plan) => [plan.slug, plan]));

function matchedPhrase(copy: string, claim: PlanClaim, locale: Locale): string | undefined {
    const haystack = copy.toLowerCase();
    return claim.phrases[locale].find((phrase) => haystack.includes(phrase));
}

describe('plan copy veracity — phantom claims (HOS-331)', () => {
    it('lists only claims that are genuinely absent from the entitlement catalog', () => {
        // Non-vacuity: if one of these ever becomes a real entitlement, the
        // claim must move to BACKED_CLAIMS instead of silently staying banned.
        for (const claim of PHANTOM_CLAIMS) {
            expect(REAL_ENTITLEMENTS.has(claim.entitlement)).toBe(false);
        }
    });

    it('has a description for every active plan on both surfaces, in every locale', () => {
        // Guards the guard, per (plan, locale, surface) rather than by total
        // count: a global `toBeGreaterThan` still passes after a key is deleted,
        // and a deleted key silently falls back to the English config string.
        const missing: string[] = [];
        for (const locale of LOCALES) {
            const billing = readLocaleJson(locale, 'billing.json');
            const adminBilling = readLocaleJson(locale, 'admin-billing.json');
            for (const plan of ACTIVE_PLANS) {
                if (!lookup(billing, `plan.${plan.slug}.description`)?.trim()) {
                    missing.push(`${locale}: billing.plan.${plan.slug}.description`);
                }
                if (!lookup(adminBilling, `plans.descriptions.${plan.slug}`)?.trim()) {
                    missing.push(`${locale}: admin-billing.plans.descriptions.${plan.slug}`);
                }
            }
        }
        expect(missing).toEqual([]);
        expect(ACTIVE_PLANS.length).toBeGreaterThan(0);
    });

    it('reads every prose surface it claims to cover', () => {
        // Same reasoning for the FAQ/landing paths: a renamed key would quietly
        // drop that string from the sweep instead of failing.
        const missing: string[] = [];
        for (const locale of LOCALES) {
            for (const { file, path } of PROSE_SURFACES) {
                if (!lookup(readLocaleJson(locale, file), path)?.trim()) {
                    missing.push(`${locale}: ${file}:${path}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it('never promises a feature that has no entitlement behind it', () => {
        const violations: string[] = [];
        for (const row of PLAN_COPY) {
            for (const claim of PHANTOM_CLAIMS) {
                const phrase = matchedPhrase(row.copy, claim, row.locale);
                if (phrase) {
                    violations.push(
                        `${row.locale}/${row.surface}.${row.slug} sells "${phrase}" (${claim.id}), which no entitlement backs`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });
});

describe('plan copy veracity — FAQ and landing prose (HOS-331)', () => {
    it('never promises a feature that has no entitlement behind it', () => {
        const violations: string[] = [];
        for (const row of PROSE_COPY) {
            for (const claim of PHANTOM_CLAIMS) {
                const phrase = matchedPhrase(row.copy, claim, row.locale);
                if (phrase) {
                    violations.push(
                        `${row.locale}/${row.surface} sells "${phrase}" (${claim.id}), which no entitlement backs`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('states the trial length by interpolation, never as a literal number', () => {
        // The trial moves (D1 takes it from 14 to 30). Prose that types the
        // number cannot be kept in step with `OWNER_TRIAL_DAYS`, and the halves
        // that drift apart contradict each other on adjacent screens.
        const literals: string[] = [];
        for (const row of PROSE_COPY) {
            if (/\b\d+[\s-](d[ií]as?|dias?|day)/i.test(row.copy)) {
                literals.push(`${row.locale}/${row.surface}: "${row.copy.slice(0, 80)}…"`);
            }
        }
        expect(literals).toEqual([]);
    });

    it('does not promise a trial without saying it is for the first subscription', () => {
        // `resolveCheckoutFreeTrialDays` zeroes the trial once the customer has
        // ANY prior subscription — "one trial per customer, for life". Copy that
        // says "every plan includes N free days" full stop is false for a
        // returning host, who is then charged on day 1.
        const FIRST_TIME_HINTS: Record<Locale, readonly string[]> = {
            es: ['primera suscripción', 'primera vez', 'primera propiedad'],
            en: ['first subscription', 'first time', 'first property'],
            pt: ['primeira assinatura', 'primeira vez', 'primeira propriedade']
        };
        const unqualified: string[] = [];
        for (const row of PROSE_COPY) {
            if (!row.copy.includes('{{trialDays}}')) continue;
            const hints = FIRST_TIME_HINTS[row.locale];
            const haystack = row.copy.toLowerCase();
            if (!hints.some((hint) => haystack.includes(hint))) {
                unqualified.push(`${row.locale}/${row.surface}`);
            }
        }
        expect(unqualified).toEqual([]);
    });
});

describe('plan copy veracity — backed claims (HOS-331)', () => {
    it('only claims a real feature on plans that actually grant it', () => {
        const violations: string[] = [];
        for (const row of PLAN_COPY) {
            const plan = PLAN_BY_SLUG.get(row.slug);
            if (!plan) continue;
            const granted = new Set<string>(plan.entitlements as readonly string[]);
            for (const claim of BACKED_CLAIMS) {
                const phrase = matchedPhrase(row.copy, claim, row.locale);
                if (phrase && !granted.has(claim.entitlement)) {
                    violations.push(
                        `${row.locale}/${row.surface}.${row.slug} sells "${phrase}" but the plan does not grant ${claim.entitlement}`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
