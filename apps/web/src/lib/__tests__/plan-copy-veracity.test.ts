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

/**
 * Every plan description rendered by a product surface, as
 * `{ slug, locale, surface, copy }`. Missing keys are skipped: a plan without a
 * translation falls back to the English `PlanDefinition.description`, which is
 * covered by the config-level tests in `packages/billing`.
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

const PLAN_COPY = collectPlanCopy();
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

    it('renders plan descriptions on at least one surface per locale', () => {
        // Guards the guard: a path typo would make every assertion below vacuous.
        expect(PLAN_COPY.length).toBeGreaterThan(LOCALES.length * 2);
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
