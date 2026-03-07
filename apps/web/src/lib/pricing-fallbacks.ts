import type { SupportedLocale } from './i18n';
/**
 * Hardcoded fallback pricing plans for tourist and owner pages.
 * Used when the billing API is unavailable or returns empty data.
 */
import type { PricingPlan } from './pricing-plans';

// --- Tourist Fallback Plans ---

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

// --- Owner Fallback Plans ---

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

// --- CTA Config ---

/** CTA label templates per locale for tourist plans */
export const TOURIST_CTA_LABELS: Record<SupportedLocale, Record<string, string>> = {
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
export const OWNER_CTA_LABELS: Record<SupportedLocale, Record<string, string>> = {
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
export const OWNER_CTA_SUFFIX: Record<string, string> = {
    'owner-basico': 'basico',
    'owner-pro': 'profesional',
    'owner-premium': 'premium'
};
