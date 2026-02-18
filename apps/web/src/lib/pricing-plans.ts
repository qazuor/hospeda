import { plansApi } from './api/endpoints';
/**
 * Pricing plan utilities for the pricing pages.
 * Provides fallback hardcoded plans and API data mapping helpers.
 */
import type { SupportedLocale } from './i18n';

/** Shape used by PricingCard component */
export interface PricingPlan {
    readonly name: string;
    readonly price: number;
    readonly currency: string;
    readonly period: string;
    readonly features: readonly string[];
    readonly cta: { readonly label: string; readonly href: string };
    readonly highlighted?: boolean;
}

/** Locale-specific display config for currency and period labels */
const LOCALE_CONFIG: Record<
    SupportedLocale,
    { readonly currency: string; readonly period: string }
> = {
    es: { currency: 'ARS', period: '/mes' },
    en: { currency: 'USD', period: '/month' },
    pt: { currency: 'ARS', period: '/mês' }
};

// ─── Tourist Fallback Plans ────────────────────────────────────────────────────

/** Hardcoded fallback pricing plans for tourists (locale-specific) */
export const TOURIST_FALLBACK_PLANS: Record<SupportedLocale, PricingPlan[]> = {
    es: [
        {
            name: 'Gratis',
            price: 0,
            currency: 'ARS',
            period: '/mes',
            features: [
                'Navegar alojamientos',
                'Leer reseñas',
                'Guardar favoritos',
                'Búsqueda básica'
            ],
            cta: { label: 'Comenzar Gratis', href: '/es/registro/' }
        },
        {
            name: 'Plus',
            price: 5000,
            currency: 'ARS',
            period: '/mes',
            features: [
                'Todo lo del plan Gratis',
                'Reservas prioritarias',
                'Ofertas exclusivas',
                'Filtros avanzados',
                'Planificador de viajes'
            ],
            cta: { label: 'Comenzar Plus', href: '/es/registro/?plan=plus' }
        },
        {
            name: 'VIP',
            price: 15000,
            currency: 'ARS',
            period: '/mes',
            features: [
                'Todo lo del plan Plus',
                'Servicio de conserjería',
                'Garantía de mejor precio',
                'Cancelación gratuita',
                'Soporte 24/7'
            ],
            cta: { label: 'Comenzar VIP', href: '/es/registro/?plan=vip' },
            highlighted: true
        }
    ],
    en: [
        {
            name: 'Free',
            price: 0,
            currency: 'USD',
            period: '/month',
            features: ['Browse accommodations', 'Read reviews', 'Save favorites', 'Basic search'],
            cta: { label: 'Start Free', href: '/en/registro/' }
        },
        {
            name: 'Plus',
            price: 5,
            currency: 'USD',
            period: '/month',
            features: [
                'All Free features',
                'Priority booking',
                'Exclusive deals',
                'Advanced filters',
                'Trip planner'
            ],
            cta: { label: 'Start Plus', href: '/en/registro/?plan=plus' }
        },
        {
            name: 'VIP',
            price: 15,
            currency: 'USD',
            period: '/month',
            features: [
                'All Plus features',
                'Concierge service',
                'Best price guarantee',
                'Free cancellation',
                '24/7 support'
            ],
            cta: { label: 'Start VIP', href: '/en/registro/?plan=vip' },
            highlighted: true
        }
    ],
    pt: [
        {
            name: 'Grátis',
            price: 0,
            currency: 'ARS',
            period: '/mês',
            features: [
                'Navegar acomodações',
                'Ler resenhas',
                'Salvar favoritos',
                'Pesquisa básica'
            ],
            cta: { label: 'Começar Grátis', href: '/pt/registro/' }
        },
        {
            name: 'Plus',
            price: 5000,
            currency: 'ARS',
            period: '/mês',
            features: [
                'Tudo do plano Grátis',
                'Reservas prioritárias',
                'Ofertas exclusivas',
                'Filtros avançados',
                'Planejador de viagens'
            ],
            cta: { label: 'Começar Plus', href: '/pt/registro/?plan=plus' }
        },
        {
            name: 'VIP',
            price: 15000,
            currency: 'ARS',
            period: '/mês',
            features: [
                'Tudo do plano Plus',
                'Serviço de concierge',
                'Garantia de melhor preço',
                'Cancelamento gratuito',
                'Suporte 24/7'
            ],
            cta: { label: 'Começar VIP', href: '/pt/registro/?plan=vip' },
            highlighted: true
        }
    ]
};

// ─── Owner Fallback Plans ──────────────────────────────────────────────────────

/** Hardcoded fallback pricing plans for accommodation owners (locale-specific) */
export const OWNER_FALLBACK_PLANS: Record<SupportedLocale, PricingPlan[]> = {
    es: [
        {
            name: 'Basico',
            price: 15000,
            currency: 'ARS',
            period: '/mes',
            features: [
                '1 propiedad en listado',
                'Análisis básicos',
                'Soporte por email',
                'Galería de fotos (hasta 10)'
            ],
            cta: { label: 'Comenzar Basico', href: '/es/registro/propietario/?plan=basico' }
        },
        {
            name: 'Profesional',
            price: 35000,
            currency: 'ARS',
            period: '/mes',
            features: [
                'Hasta 5 propiedades',
                'Análisis avanzados',
                'Soporte prioritario',
                'Fotos ilimitadas',
                'Listado destacado'
            ],
            cta: {
                label: 'Comenzar Profesional',
                href: '/es/registro/propietario/?plan=profesional'
            },
            highlighted: true
        },
        {
            name: 'Premium',
            price: 75000,
            currency: 'ARS',
            period: '/mes',
            features: [
                'Propiedades ilimitadas',
                'Análisis completos',
                'Soporte 24/7',
                'Acceso a API',
                'Marca personalizada',
                'Gestor de cuenta'
            ],
            cta: { label: 'Comenzar Premium', href: '/es/registro/propietario/?plan=premium' }
        }
    ],
    en: [
        {
            name: 'Basic',
            price: 15,
            currency: 'USD',
            period: '/month',
            features: [
                '1 property listing',
                'Basic analytics',
                'Email support',
                'Photo gallery (up to 10)'
            ],
            cta: { label: 'Start Basic', href: '/en/registro/propietario/?plan=basico' }
        },
        {
            name: 'Professional',
            price: 35,
            currency: 'USD',
            period: '/month',
            features: [
                'Up to 5 properties',
                'Advanced analytics',
                'Priority support',
                'Unlimited photos',
                'Featured listing'
            ],
            cta: {
                label: 'Start Professional',
                href: '/en/registro/propietario/?plan=profesional'
            },
            highlighted: true
        },
        {
            name: 'Premium',
            price: 75,
            currency: 'USD',
            period: '/month',
            features: [
                'Unlimited properties',
                'Full analytics',
                '24/7 support',
                'API access',
                'Custom branding',
                'Account manager'
            ],
            cta: { label: 'Start Premium', href: '/en/registro/propietario/?plan=premium' }
        }
    ],
    pt: [
        {
            name: 'Básico',
            price: 15000,
            currency: 'ARS',
            period: '/mês',
            features: [
                '1 propriedade em listagem',
                'Análise básicas',
                'Suporte por email',
                'Galeria de fotos (até 10)'
            ],
            cta: { label: 'Começar Básico', href: '/pt/registro/propietario/?plan=basico' }
        },
        {
            name: 'Profissional',
            price: 35000,
            currency: 'ARS',
            period: '/mês',
            features: [
                'Até 5 propriedades',
                'Análise avançadas',
                'Suporte prioritário',
                'Fotos ilimitadas',
                'Listagem destacada'
            ],
            cta: {
                label: 'Começar Profissional',
                href: '/pt/registro/propietario/?plan=profesional'
            },
            highlighted: true
        },
        {
            name: 'Premium',
            price: 75000,
            currency: 'ARS',
            period: '/mês',
            features: [
                'Propriedades ilimitadas',
                'Análise completas',
                'Suporte 24/7',
                'Acesso à API',
                'Marca personalizada',
                'Gerente de conta'
            ],
            cta: { label: 'Começar Premium', href: '/pt/registro/propietario/?plan=premium' }
        }
    ]
};

// ─── CTA Config ────────────────────────────────────────────────────────────────

/** CTA label templates per locale for tourist plans */
const TOURIST_CTA_LABELS: Record<SupportedLocale, Record<string, string>> = {
    es: {
        'tourist-free': 'Comenzar Gratis',
        'tourist-plus': 'Comenzar Plus',
        'tourist-vip': 'Comenzar VIP'
    },
    en: { 'tourist-free': 'Start Free', 'tourist-plus': 'Start Plus', 'tourist-vip': 'Start VIP' },
    pt: {
        'tourist-free': 'Começar Grátis',
        'tourist-plus': 'Começar Plus',
        'tourist-vip': 'Começar VIP'
    }
};

/** CTA label templates per locale for owner plans */
const OWNER_CTA_LABELS: Record<SupportedLocale, Record<string, string>> = {
    es: {
        'owner-basico': 'Comenzar Basico',
        'owner-pro': 'Comenzar Profesional',
        'owner-premium': 'Comenzar Premium'
    },
    en: {
        'owner-basico': 'Start Basic',
        'owner-pro': 'Start Professional',
        'owner-premium': 'Start Premium'
    },
    pt: {
        'owner-basico': 'Começar Básico',
        'owner-pro': 'Começar Profissional',
        'owner-premium': 'Começar Premium'
    }
};

/** CTA href suffix per owner plan slug */
const OWNER_CTA_SUFFIX: Record<string, string> = {
    'owner-basico': 'basico',
    'owner-pro': 'profesional',
    'owner-premium': 'premium'
};

// ─── Shared Mapping Helper ─────────────────────────────────────────────────────

/** Parameters for mapping an API plan record to a PricingPlan */
interface MapPlanParams {
    readonly plan: Record<string, unknown>;
    readonly locale: SupportedLocale;
    readonly index: number;
    readonly total: number;
    readonly fallback: PricingPlan[];
    readonly ctaLabels: Record<string, string>;
    readonly buildCtaHref: (slug: string, locale: SupportedLocale) => string;
}

/**
 * Maps a raw API plan record to a PricingPlan for card rendering.
 * Uses ARS price for es/pt locales and USD reference for en.
 * Falls back to hardcoded features when the API plan name matches a fallback entry.
 */
function mapApiPlanToCard({
    plan,
    locale,
    index,
    total,
    fallback,
    ctaLabels,
    buildCtaHref
}: MapPlanParams): PricingPlan {
    const slug = typeof plan.slug === 'string' ? plan.slug : '';
    const name = typeof plan.name === 'string' ? plan.name : '';
    const monthlyPriceArs = typeof plan.monthlyPriceArs === 'number' ? plan.monthlyPriceArs : 0;
    const monthlyPriceUsdRef =
        typeof plan.monthlyPriceUsdRef === 'number' ? plan.monthlyPriceUsdRef : 0;
    const description = typeof plan.description === 'string' ? plan.description : '';
    const { currency, period } = LOCALE_CONFIG[locale];

    // ARS prices are stored in cents; divide by 100 for display
    const price = locale === 'en' ? monthlyPriceUsdRef : Math.round(monthlyPriceArs / 100);

    // Prefer hardcoded localized features when name matches; else use API description
    const matched = fallback.find((fp) => fp.name.toLowerCase() === name.toLowerCase());
    const features = matched ? matched.features : [description];

    const ctaLabel = ctaLabels[slug] ?? name;
    const ctaHref = buildCtaHref(slug, locale);

    // Highlight the middle plan (index 1 of 3)
    const highlighted = total > 1 && index === Math.floor(total / 2);

    return {
        name,
        price,
        currency,
        period,
        features: features as string[],
        cta: { label: ctaLabel, href: ctaHref },
        highlighted
    };
}

// ─── Fetch Helpers ─────────────────────────────────────────────────────────────

/**
 * Extracts a flat item array from the API response.
 * Handles both direct array responses and paginated `{ items }` shapes.
 */
function extractItems(rawData: unknown): unknown[] {
    if (Array.isArray(rawData)) return rawData;
    const asRecord = rawData as Record<string, unknown>;
    if (Array.isArray(asRecord?.items)) return asRecord.items as unknown[];
    return [];
}

/**
 * Filters and narrows raw API items to typed plan records with the given category.
 */
function filterByCategory(items: unknown[], category: string): Record<string, unknown>[] {
    return items.filter(
        (item): item is Record<string, unknown> =>
            typeof item === 'object' &&
            item !== null &&
            (item as Record<string, unknown>).category === category
    );
}

/**
 * Sorts plan records by their `sortOrder` field ascending.
 */
function sortByOrder(plans: Record<string, unknown>[]): Record<string, unknown>[] {
    return [...plans].sort((a, b) => {
        const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
        const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
        return aOrder - bOrder;
    });
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches tourist plans from the billing API and maps them to PricingPlan records.
 * Returns locale-specific hardcoded fallback data on any failure.
 *
 * @param locale - The active locale for pricing display
 * @returns Sorted tourist PricingPlan array ready for rendering
 */
export async function fetchTouristPlans(locale: SupportedLocale): Promise<PricingPlan[]> {
    try {
        const result = await plansApi.list();
        if (!result.ok) return TOURIST_FALLBACK_PLANS[locale];

        const plans = filterByCategory(extractItems(result.data), 'tourist');
        if (plans.length === 0) return TOURIST_FALLBACK_PLANS[locale];

        const sorted = sortByOrder(plans);
        return sorted.map((plan, idx) =>
            mapApiPlanToCard({
                plan,
                locale,
                index: idx,
                total: sorted.length,
                fallback: TOURIST_FALLBACK_PLANS[locale],
                ctaLabels: TOURIST_CTA_LABELS[locale],
                buildCtaHref: (slug, loc) =>
                    slug === 'tourist-free'
                        ? `/${loc}/registro/`
                        : `/${loc}/registro/?plan=${slug.replace('tourist-', '')}`
            })
        );
    } catch {
        return TOURIST_FALLBACK_PLANS[locale];
    }
}

/**
 * Fetches owner plans from the billing API and maps them to PricingPlan records.
 * Returns locale-specific hardcoded fallback data on any failure.
 *
 * @param locale - The active locale for pricing display
 * @returns Sorted owner PricingPlan array ready for rendering
 */
export async function fetchOwnerPlans(locale: SupportedLocale): Promise<PricingPlan[]> {
    try {
        const result = await plansApi.list();
        if (!result.ok) return OWNER_FALLBACK_PLANS[locale];

        const plans = filterByCategory(extractItems(result.data), 'owner');
        if (plans.length === 0) return OWNER_FALLBACK_PLANS[locale];

        const sorted = sortByOrder(plans);
        return sorted.map((plan, idx) =>
            mapApiPlanToCard({
                plan,
                locale,
                index: idx,
                total: sorted.length,
                fallback: OWNER_FALLBACK_PLANS[locale],
                ctaLabels: OWNER_CTA_LABELS[locale],
                buildCtaHref: (slug, loc) => {
                    const suffix = OWNER_CTA_SUFFIX[slug] ?? slug.replace('owner-', '');
                    return `/${loc}/registro/propietario/?plan=${suffix}`;
                }
            })
        );
    } catch {
        return OWNER_FALLBACK_PLANS[locale];
    }
}
