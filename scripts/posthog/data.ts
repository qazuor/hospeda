import type { InsightDefinition, SetupResourceDefinition } from './definitions.js';
import { funnelInsight, trendInsight } from './definitions.js';

export const DASHBOARDS: readonly SetupResourceDefinition[] = [
    {
        name: '00 · Hospeda — Resumen',
        description:
            'Dashboard ejecutivo principal. Debe responder uso general, owners, contactos y suscripciones.'
    },
    {
        name: '01 · Hospeda — Adquisición',
        description: 'Fuentes, campañas, landings y atribución de registros/contactos.'
    },
    {
        name: '02 · Hospeda — Descubrimiento',
        description: 'Vistas de contenido, búsquedas, filtros y conversión a contacto.'
    },
    {
        name: '03 · Hospeda — Owners',
        description: 'Onboarding, drafts, publicaciones y actividad de owners.'
    },
    {
        name: '04 · Hospeda — Suscripciones',
        description: 'Checkout, creación, activación, cobros, fallos y trial conversion.'
    },
    {
        name: '05 · Hospeda — Calidad',
        description: 'Errores y acciones fallidas que afectan conversión o uso.'
    }
] as const;

export const COHORTS: readonly Omit<SetupResourceDefinition, 'tags'>[] = [
    { name: 'Owners registrados', description: 'Usuarios identificados con user_type=owner.' },
    {
        name: 'Owners con alojamiento publicado',
        description: 'Usuarios owner con la propiedad has_published_accommodation=true.'
    },
    {
        name: 'Owners sin alojamiento publicado',
        description: 'Usuarios owner sin publicación efectiva todavía.'
    },
    {
        name: 'Usuarios con suscripción activa',
        description: 'Usuarios con plan_status=active.'
    },
    { name: 'Plan básico', description: 'Usuarios cuyo plan actual es owner-basico.' },
    { name: 'Plan pro', description: 'Usuarios cuyo plan actual es owner-pro.' },
    { name: 'Plan premium', description: 'Usuarios cuyo plan actual es owner-premium.' },
    {
        name: 'Usuarios en trial',
        description: 'Usuarios con last_checkout_outcome=trial o trial_granted.'
    },
    {
        name: 'Usuarios que cancelaron',
        description: 'Pendiente de automatizar con evento o property canónica.'
    }
] as const;

const DASHBOARD_PREFIX_BY_NAME = {
    '00 · Hospeda — Resumen': 'Resumen',
    '01 · Hospeda — Adquisición': 'Adquisición',
    '02 · Hospeda — Descubrimiento': 'Descubrimiento',
    '03 · Hospeda — Owners': 'Owners',
    '04 · Hospeda — Suscripciones': 'Suscripciones',
    '05 · Hospeda — Calidad': 'Calidad'
} as const;

function prefixedInsight(input: {
    readonly baseName: string;
    readonly dashboardName: keyof typeof DASHBOARD_PREFIX_BY_NAME;
    readonly description: string;
    readonly query: InsightDefinition['query'];
}): InsightDefinition {
    return {
        dashboardName: input.dashboardName,
        name: `[${DASHBOARD_PREFIX_BY_NAME[input.dashboardName]}] ${input.baseName}`,
        legacyNames: [input.baseName],
        description: input.description,
        query: input.query
    };
}

export const INSIGHTS: readonly InsightDefinition[] = [
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Pageviews 30d',
        description: 'Cantidad de pageviews registradas en los últimos 30 días.',
        query: trendInsight({ event: '$pageview' })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Visitantes activos mensuales',
        description: 'Visitantes activos mensuales (MAU) sobre pageviews.',
        query: trendInsight({ event: '$pageview', math: 'monthly_active' as 'total' })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Evolución diaria de visitantes activos',
        description: 'Serie diaria de visitantes activos (DAU).',
        query: trendInsight({ event: '$pageview', math: 'dau' as 'total', interval: 'day' })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Registros completados 30d',
        description: 'Cantidad de cuentas creadas en los últimos 30 días.',
        query: trendInsight({ event: 'sign_up_completed' })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Alojamientos publicados 30d',
        description: 'Cantidad de publicaciones efectivas de alojamiento en los últimos 30 días.',
        query: trendInsight({ event: 'accommodation_published' })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Contactos completados 30d',
        description: 'Cantidad de contactos exitosos con owners en los últimos 30 días.',
        query: trendInsight({ event: 'contact_owner_completed' })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Suscripciones creadas 30d',
        description: 'Cantidad de suscripciones creadas en checkout en los últimos 30 días.',
        query: trendInsight({ event: 'subscription_created' })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Conversión visitante → registro',
        description: 'Funnel base desde pageview hasta registro completado.',
        query: funnelInsight({
            steps: [
                { event: '$pageview', name: '$pageview' },
                { event: 'sign_up_completed', name: 'sign_up_completed' }
            ]
        })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Conversión registro → alojamiento publicado',
        description: 'Funnel base desde registro hasta publicación efectiva.',
        query: funnelInsight({
            steps: [
                { event: 'sign_up_completed', name: 'sign_up_completed' },
                { event: 'accommodation_published', name: 'accommodation_published' }
            ]
        })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Conversión vista alojamiento → contacto',
        description: 'Funnel base desde vista de alojamiento hasta contacto completado.',
        query: funnelInsight({
            steps: [
                { event: 'accommodation_viewed', name: 'accommodation_viewed' },
                { event: 'contact_owner_completed', name: 'contact_owner_completed' }
            ]
        })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Top destinos por visitantes',
        description: 'Breakdown de vistas de destinos por slug.',
        query: trendInsight({
            event: 'destination_viewed',
            breakdown: { property: 'destination_slug', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '00 · Hospeda — Resumen',
        baseName: 'Top alojamientos por contactos',
        description: 'Breakdown de contactos completados por alojamiento.',
        query: trendInsight({
            event: 'contact_owner_completed',
            breakdown: { property: 'accommodation_id', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '01 · Hospeda — Adquisición',
        baseName: 'Pageviews adquisición 30d',
        description: 'Pageviews públicas como base de adquisición en los últimos 30 días.',
        query: trendInsight({ event: '$pageview' })
    }),
    prefixedInsight({
        dashboardName: '01 · Hospeda — Adquisición',
        baseName: 'Registros completados 30d',
        description: 'Registros completados usados como señal de adquisición.',
        query: trendInsight({ event: 'sign_up_completed' })
    }),
    prefixedInsight({
        dashboardName: '01 · Hospeda — Adquisición',
        baseName: 'Contactos completados 30d',
        description: 'Contactos completados usados como señal de adquisición.',
        query: trendInsight({ event: 'contact_owner_completed' })
    }),
    prefixedInsight({
        dashboardName: '01 · Hospeda — Adquisición',
        baseName: 'Visitantes por referrer',
        description: 'Breakdown de pageviews por dominio referer.',
        query: trendInsight({
            event: '$pageview',
            breakdown: { property: '$referring_domain', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '01 · Hospeda — Adquisición',
        baseName: 'Visitantes por UTM source',
        description: 'Breakdown de pageviews por UTM source.',
        query: trendInsight({
            event: '$pageview',
            breakdown: { property: '$utm_source', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '01 · Hospeda — Adquisición',
        baseName: 'Visitantes por UTM campaign',
        description: 'Breakdown de pageviews por UTM campaign.',
        query: trendInsight({
            event: '$pageview',
            breakdown: { property: '$utm_campaign', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '01 · Hospeda — Adquisición',
        baseName: 'Landing pages principales',
        description: 'Breakdown de pageviews por pathname de entrada.',
        query: trendInsight({
            event: '$pageview',
            breakdown: { property: '$pathname', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Búsquedas realizadas 30d',
        description: 'Cantidad de búsquedas iniciadas desde la UI pública.',
        query: trendInsight({ event: 'search_performed' })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Vistas de destinos 30d',
        description: 'Cantidad de vistas explícitas de destinos.',
        query: trendInsight({ event: 'destination_viewed' })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Vistas de alojamientos 30d',
        description: 'Cantidad de vistas explícitas de alojamientos.',
        query: trendInsight({ event: 'accommodation_viewed' })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Vistas de eventos 30d',
        description: 'Cantidad de vistas explícitas de eventos.',
        query: trendInsight({ event: 'event_viewed' })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Vistas de posts 30d',
        description: 'Cantidad de vistas explícitas de posts.',
        query: trendInsight({ event: 'post_viewed' })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Contactos iniciados 30d',
        description: 'Cantidad de inicios de contacto desde descubrimiento.',
        query: trendInsight({ event: 'contact_owner_started' })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Contactos completados 30d',
        description: 'Cantidad de contactos completados desde descubrimiento.',
        query: trendInsight({ event: 'contact_owner_completed' })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Contactos por destino',
        description: 'Breakdown de contactos completados por destino.',
        query: trendInsight({
            event: 'contact_owner_completed',
            breakdown: { property: 'destination_id', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Contactos por alojamiento',
        description: 'Breakdown de contactos completados por alojamiento.',
        query: trendInsight({
            event: 'contact_owner_completed',
            breakdown: { property: 'accommodation_id', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '02 · Hospeda — Descubrimiento',
        baseName: 'Conversión vista alojamiento → contacto',
        description: 'Funnel base entre vista de alojamiento y contacto completado.',
        query: funnelInsight({
            steps: [
                { event: 'accommodation_viewed', name: 'accommodation_viewed' },
                { event: 'contact_owner_completed', name: 'contact_owner_completed' }
            ]
        })
    }),
    prefixedInsight({
        dashboardName: '03 · Hospeda — Owners',
        baseName: 'Owners que iniciaron onboarding 30d',
        description: 'Cantidad de inicios de onboarding owner en los últimos 30 días.',
        query: trendInsight({ event: 'onboarding_started' })
    }),
    prefixedInsight({
        dashboardName: '03 · Hospeda — Owners',
        baseName: 'Drafts guardados 30d',
        description: 'Cantidad de drafts de alojamiento guardados/creados en el onboarding.',
        query: trendInsight({ event: 'accommodation_draft_saved' })
    }),
    prefixedInsight({
        dashboardName: '03 · Hospeda — Owners',
        baseName: 'Owners que publicaron 30d',
        description: 'Cantidad de owners con publicación efectiva en los últimos 30 días.',
        query: trendInsight({ event: 'accommodation_published' })
    }),
    prefixedInsight({
        dashboardName: '03 · Hospeda — Owners',
        baseName: 'Importaciones completadas 30d',
        description: 'Cantidad de importaciones de alojamiento completadas.',
        query: trendInsight({ event: 'accommodation_import_completed' })
    }),
    prefixedInsight({
        dashboardName: '03 · Hospeda — Owners',
        baseName: 'Importaciones fallidas 30d',
        description: 'Cantidad de importaciones fallidas.',
        query: trendInsight({ event: 'accommodation_import_failed' })
    }),
    prefixedInsight({
        dashboardName: '03 · Hospeda — Owners',
        baseName: 'Publicaciones por plan',
        description: 'Breakdown de publicaciones por plan actual del owner.',
        query: trendInsight({
            event: 'accommodation_published',
            breakdown: { property: 'plan', type: 'person' }
        })
    }),
    prefixedInsight({
        dashboardName: '03 · Hospeda — Owners',
        baseName: 'Funnel owner adquisición → publicación',
        description: 'Funnel base owner desde sign up hasta publish.',
        query: funnelInsight({
            steps: [
                { event: 'sign_up_started', name: 'sign_up_started' },
                { event: 'sign_up_completed', name: 'sign_up_completed' },
                { event: 'onboarding_started', name: 'onboarding_started' },
                { event: 'accommodation_published', name: 'accommodation_published' }
            ]
        })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Checkouts iniciados 30d',
        description: 'Cantidad de inicios de checkout de suscripciones.',
        query: trendInsight({ event: 'subscription_checkout_started' })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Suscripciones creadas 30d',
        description: 'Cantidad de suscripciones creadas en checkout.',
        query: trendInsight({ event: 'subscription_created' })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Pagos exitosos 30d',
        description: 'Pagos confirmados en el período.',
        query: trendInsight({ event: 'subscription_payment_succeeded' })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Pagos fallidos 30d',
        description: 'Pagos fallidos confirmados en el período.',
        query: trendInsight({ event: 'subscription_payment_failed' })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Trials convertidos a pago 30d',
        description: 'Cantidad de conversions trial → paid confirmadas.',
        query: trendInsight({ event: 'trial_converted_to_paid' })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Suscripciones por plan',
        description: 'Breakdown de suscripciones creadas por plan.',
        query: trendInsight({
            event: 'subscription_created',
            breakdown: { property: 'plan_slug', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Suscripciones por período',
        description: 'Breakdown de suscripciones creadas por período.',
        query: trendInsight({
            event: 'subscription_created',
            breakdown: { property: 'billing_period', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '04 · Hospeda — Suscripciones',
        baseName: 'Funnel suscripción',
        description: 'Funnel base desde checkout hasta pago exitoso.',
        query: funnelInsight({
            steps: [
                { event: 'subscription_checkout_started', name: 'subscription_checkout_started' },
                { event: 'subscription_created', name: 'subscription_created' },
                { event: 'subscription_payment_succeeded', name: 'subscription_payment_succeeded' }
            ]
        })
    }),
    prefixedInsight({
        dashboardName: '05 · Hospeda — Calidad',
        baseName: 'Contactos fallidos 30d',
        description: 'Fallos del flujo de contacto owner.',
        query: trendInsight({ event: 'contact_owner_failed' })
    }),
    prefixedInsight({
        dashboardName: '05 · Hospeda — Calidad',
        baseName: 'Importaciones fallidas 30d',
        description: 'Fallos del flujo de importación.',
        query: trendInsight({ event: 'accommodation_import_failed' })
    }),
    prefixedInsight({
        dashboardName: '05 · Hospeda — Calidad',
        baseName: 'Pagos fallidos 30d',
        description: 'Pagos fallidos confirmados en el período.',
        query: trendInsight({ event: 'subscription_payment_failed' })
    }),
    prefixedInsight({
        dashboardName: '05 · Hospeda — Calidad',
        baseName: 'Pagos fallidos por categoría',
        description: 'Breakdown de pagos fallidos por failure_category.',
        query: trendInsight({
            event: 'subscription_payment_failed',
            breakdown: { property: 'failure_category', type: 'event' }
        })
    }),
    prefixedInsight({
        dashboardName: '05 · Hospeda — Calidad',
        baseName: 'Funnel owner adquisición → publicación',
        description: 'Funnel base de owner desde sign up hasta publish.',
        query: funnelInsight({
            steps: [
                { event: 'sign_up_started', name: 'sign_up_started' },
                { event: 'sign_up_completed', name: 'sign_up_completed' },
                { event: 'onboarding_started', name: 'onboarding_started' },
                { event: 'accommodation_published', name: 'accommodation_published' }
            ]
        })
    }),
    prefixedInsight({
        dashboardName: '05 · Hospeda — Calidad',
        baseName: 'Funnel contacto alojamiento',
        description: 'Funnel base desde vista de alojamiento hasta contacto completado.',
        query: funnelInsight({
            steps: [
                { event: 'accommodation_viewed', name: 'accommodation_viewed' },
                { event: 'contact_owner_started', name: 'contact_owner_started' },
                { event: 'contact_owner_completed', name: 'contact_owner_completed' }
            ]
        })
    })
] as const;
