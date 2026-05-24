/**
 * Admin IA — Tab Configurations per Entity (T-015)
 *
 * Defines tab sets for detail pages of each entity (Level 3 of the IA hierarchy).
 * Tabs are permission-aware: `permissions` controls visibility, and `onMissing`
 * controls whether the tab is disabled or fully hidden when permissions are absent.
 *
 * Design constraint: maximum **9 tabs** per entity (enforced by TabsConfigSchema).
 * Source of truth: `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §5.
 *
 * IMPORTANT: Tabs carry no `route` field — they represent logical sections of an
 * entity detail page, not navigable routes. The renderer maps tab IDs to the
 * corresponding sub-page URL (e.g. `$id_.gallery.tsx`).
 *
 * @see apps/admin/src/config/ia/schema.ts — TabsConfig / Tab type contracts
 */

import type { z } from 'zod';
import type { TabsConfigSchema } from './schema';

/** Input type for TabsConfig — `onMissing` on each Tab is optional (has `.default()`). */
type TabsConfigInput = z.input<typeof TabsConfigSchema>;

// ---------------------------------------------------------------------------
// Accommodation tabs
// ---------------------------------------------------------------------------

/**
 * Tabs for the accommodation detail page.
 *
 * Maps to routes: $id.tsx, $id_.gallery.tsx, $id_.amenities.tsx,
 * $id_.pricing.tsx, $id_.reviews.tsx, $id_.edit.tsx.
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const galleryTab = tabs.accommodation.tabs.find(t => t.id === 'gallery');
 * ```
 */
const accommodationTabs: TabsConfigInput = {
    entity: 'accommodation',
    tabs: [
        {
            id: 'overview',
            label: { es: 'General', en: 'Overview', pt: 'Geral' }
        },
        {
            id: 'gallery',
            label: { es: 'Galería', en: 'Gallery', pt: 'Galeria' },
            permissions: ['ACCOMMODATION_GALLERY_MANAGE', 'ACCOMMODATION_MEDIA_EDIT'],
            onMissing: 'disable'
        },
        {
            id: 'amenidades',
            label: { es: 'Amenidades', en: 'Amenities', pt: 'Amenidades' },
            permissions: ['ACCOMMODATION_AMENITIES_EDIT', 'ACCOMMODATION_SERVICES_EDIT'],
            onMissing: 'disable'
        },
        {
            id: 'pricing',
            label: { es: 'Precios', en: 'Pricing', pt: 'Preços' },
            permissions: ['ACCOMMODATION_PRICE_EDIT'],
            onMissing: 'disable'
        },
        {
            id: 'reviews',
            label: { es: 'Reseñas', en: 'Reviews', pt: 'Avaliações' },
            permissions: ['ACCOMMODATION_REVIEW_MODERATE', 'ACCOMMODATION_REVIEW_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'seo',
            label: { es: 'SEO', en: 'SEO', pt: 'SEO' },
            permissions: ['ACCOMMODATION_SEO_EDIT'],
            onMissing: 'disable'
        },
        {
            id: 'stats',
            label: { es: 'Estadísticas', en: 'Stats', pt: 'Estatísticas' },
            permissions: ['ANALYTICS_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'config',
            label: { es: 'Config', en: 'Config', pt: 'Config' },
            permissions: ['ACCOMMODATION_ADMIN_INFO_EDIT', 'ACCOMMODATION_STATES_EDIT'],
            onMissing: 'hide'
        }
    ]
};

// ---------------------------------------------------------------------------
// Post tabs
// ---------------------------------------------------------------------------

/**
 * Tabs for the post (blog article) detail page.
 *
 * Maps to routes: $id.tsx, $id_.seo.tsx, $id_.sponsorship.tsx, $id_.edit.tsx.
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const sponsorshipTab = tabs.post.tabs.find(t => t.id === 'sponsorship');
 * ```
 */
const postTabs: TabsConfigInput = {
    entity: 'post',
    tabs: [
        {
            id: 'contenido',
            label: { es: 'Contenido', en: 'Content', pt: 'Conteúdo' }
        },
        {
            id: 'seo',
            label: { es: 'SEO', en: 'SEO', pt: 'SEO' },
            permissions: ['SEO_MANAGE', 'POST_UPDATE'],
            onMissing: 'disable'
        },
        {
            id: 'sponsorship',
            label: { es: 'Sponsorship', en: 'Sponsorship', pt: 'Patrocínio' },
            permissions: ['POST_SPONSORSHIP_MANAGE', 'POST_SPONSOR_MANAGE'],
            onMissing: 'disable'
        },
        {
            id: 'stats',
            label: { es: 'Estadísticas', en: 'Stats', pt: 'Estatísticas' },
            permissions: ['ANALYTICS_VIEW'],
            onMissing: 'disable'
        }
    ]
};

// ---------------------------------------------------------------------------
// Event tabs
// ---------------------------------------------------------------------------

/**
 * Tabs for the event detail page.
 *
 * Maps to routes: $id.tsx, $id_.tickets.tsx, $id_.attendees.tsx, $id_.edit.tsx.
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const ticketsTab = tabs.event.tabs.find(t => t.id === 'tickets');
 * ```
 */
const eventTabs: TabsConfigInput = {
    entity: 'event',
    tabs: [
        {
            id: 'overview',
            label: { es: 'General', en: 'Overview', pt: 'Geral' }
        },
        {
            id: 'tickets',
            label: { es: 'Tickets', en: 'Tickets', pt: 'Ingressos' },
            permissions: ['EVENT_UPDATE'],
            onMissing: 'disable'
        },
        {
            id: 'asistentes',
            label: { es: 'Asistentes', en: 'Attendees', pt: 'Participantes' },
            permissions: ['EVENT_UPDATE'],
            onMissing: 'disable'
        },
        {
            id: 'seo',
            label: { es: 'SEO', en: 'SEO', pt: 'SEO' },
            permissions: ['SEO_MANAGE', 'EVENT_UPDATE'],
            onMissing: 'disable'
        },
        {
            id: 'stats',
            label: { es: 'Estadísticas', en: 'Stats', pt: 'Estatísticas' },
            permissions: ['ANALYTICS_VIEW'],
            onMissing: 'disable'
        }
    ]
};

// ---------------------------------------------------------------------------
// Destination tabs
// ---------------------------------------------------------------------------

/**
 * Tabs for the destination detail page.
 *
 * Maps to routes: $id.tsx, $id_.attractions.tsx, $id_.accommodations.tsx,
 * $id_.events.tsx, $id_.edit.tsx.
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const attractionsTab = tabs.destination.tabs.find(t => t.id === 'attractions');
 * ```
 */
const destinationTabs: TabsConfigInput = {
    entity: 'destination',
    tabs: [
        {
            id: 'overview',
            label: { es: 'General', en: 'Overview', pt: 'Geral' }
        },
        {
            id: 'attractions',
            label: { es: 'Atracciones', en: 'Attractions', pt: 'Atrações' },
            permissions: ['DESTINATION_ATTRACTION_MANAGE', 'ATTRACTION_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'accommodations',
            label: { es: 'Alojamientos', en: 'Accommodations', pt: 'Alojamentos' },
            permissions: ['ACCOMMODATION_VIEW_ALL'],
            onMissing: 'disable'
        },
        {
            id: 'events',
            label: { es: 'Eventos', en: 'Events', pt: 'Eventos' },
            permissions: ['EVENT_VIEW_ALL'],
            onMissing: 'disable'
        },
        {
            id: 'seo',
            label: { es: 'SEO', en: 'SEO', pt: 'SEO' },
            permissions: ['SEO_MANAGE', 'DESTINATION_UPDATE'],
            onMissing: 'disable'
        },
        {
            id: 'stats',
            label: { es: 'Estadísticas', en: 'Stats', pt: 'Estatísticas' },
            permissions: ['ANALYTICS_VIEW'],
            onMissing: 'disable'
        }
    ]
};

// ---------------------------------------------------------------------------
// User tabs (in Comunidad)
// ---------------------------------------------------------------------------

/**
 * Tabs for the user detail page (within the Comunidad section).
 *
 * Maps to routes: $id.tsx, $id_.activity.tsx, $id_.permissions.tsx, $id_.edit.tsx.
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const permissionsTab = tabs.user.tabs.find(t => t.id === 'permissions');
 * ```
 */
const userTabs: TabsConfigInput = {
    entity: 'user',
    tabs: [
        {
            id: 'perfil',
            label: { es: 'Perfil', en: 'Profile', pt: 'Perfil' }
        },
        {
            id: 'permissions',
            label: { es: 'Permisos', en: 'Permissions', pt: 'Permissões' },
            permissions: ['ACCESS_PERMISSIONS_MANAGE', 'PERMISSION_ASSIGN'],
            onMissing: 'disable'
        },
        {
            id: 'activity',
            label: { es: 'Actividad', en: 'Activity', pt: 'Atividade' },
            permissions: ['USER_ACTIVITY_LOG_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'conversations',
            label: { es: 'Conversaciones', en: 'Conversations', pt: 'Conversações' },
            permissions: ['CONVERSATION_VIEW_ANY'],
            onMissing: 'disable'
        }
    ]
};

// ---------------------------------------------------------------------------
// Subscription tabs
// ---------------------------------------------------------------------------

/**
 * Tabs for the subscription detail page (within Comercial).
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const billingTab = tabs.subscription.tabs.find(t => t.id === 'pagos');
 * ```
 */
const subscriptionTabs: TabsConfigInput = {
    entity: 'subscription',
    tabs: [
        {
            id: 'overview',
            label: { es: 'General', en: 'Overview', pt: 'Geral' }
        },
        {
            id: 'plan-addons',
            label: { es: 'Plan y Add-ons', en: 'Plan & Add-ons', pt: 'Plano e Add-ons' },
            permissions: ['SUBSCRIPTION_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'pagos',
            label: { es: 'Pagos', en: 'Payments', pt: 'Pagamentos' },
            permissions: ['PAYMENT_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'uso',
            label: { es: 'Uso', en: 'Usage', pt: 'Uso' },
            permissions: ['BILLING_METRICS_READ'],
            onMissing: 'disable'
        },
        {
            id: 'facturas',
            label: { es: 'Facturas', en: 'Invoices', pt: 'Faturas' },
            permissions: ['INVOICE_VIEW'],
            onMissing: 'disable'
        }
    ]
};

// ---------------------------------------------------------------------------
// Newsletter campaign tabs
// ---------------------------------------------------------------------------

/**
 * Tabs for the newsletter campaign detail page.
 *
 * Maps to routes: $campaignId.tsx (with internal tab navigation).
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const metricsTab = tabs.newsletterCampaign.tabs.find(t => t.id === 'metricas');
 * ```
 */
const newsletterCampaignTabs: TabsConfigInput = {
    entity: 'newsletterCampaign',
    tabs: [
        {
            id: 'editor',
            label: { es: 'Editor', en: 'Editor', pt: 'Editor' },
            permissions: ['NEWSLETTER_CAMPAIGN_WRITE'],
            onMissing: 'disable'
        },
        {
            id: 'audiencia',
            label: { es: 'Audiencia', en: 'Audience', pt: 'Audiência' },
            permissions: ['NEWSLETTER_SUBSCRIBER_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'programacion',
            label: { es: 'Programación', en: 'Schedule', pt: 'Programação' },
            permissions: ['NEWSLETTER_CAMPAIGN_WRITE'],
            onMissing: 'disable'
        },
        {
            id: 'metricas',
            label: { es: 'Métricas', en: 'Metrics', pt: 'Métricas' },
            permissions: ['NEWSLETTER_CAMPAIGN_VIEW'],
            onMissing: 'disable'
        },
        {
            id: 'preview',
            label: { es: 'Preview', en: 'Preview', pt: 'Pré-visualização' },
            permissions: ['NEWSLETTER_CAMPAIGN_VIEW']
        }
    ]
};

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

/**
 * Registry of tab configurations, keyed by entity name.
 *
 * The renderer looks up the active entity's tabs from this registry when
 * rendering a detail page tab bar.
 *
 * @example
 * ```ts
 * import { tabs } from '@/config/ia/tabs';
 * const config = tabs['accommodation'];
 * config.tabs.forEach(tab => renderTab(tab));
 * ```
 */
export const tabs: Record<string, TabsConfigInput> = {
    accommodation: accommodationTabs,
    post: postTabs,
    event: eventTabs,
    destination: destinationTabs,
    user: userTabs,
    subscription: subscriptionTabs,
    newsletterCampaign: newsletterCampaignTabs
};
