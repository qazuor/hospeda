/**
 * Admin IA — Sidebar Definitions (T-008, T-009, T-010, extended T-039)
 *
 * One Sidebar per section. The SUPER_ADMIN universe is the full item set —
 * per-role filtering happens at render time via permission gates, NOT here.
 *
 * Coverage rule (AC-22): every navigable page from the old 5-section configs
 * must be reachable as a `link` in some new sidebar. See the coverage mapping
 * in the implementation report (returned to the caller as text).
 *
 * Design source of truth: `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §13.
 *
 * IMPORTANT: All `link.route` values point to existing router files under
 * `apps/admin/src/routes/_authed/`. No new routes are created (SPEC-154 §11.2).
 *
 * HOST sidebars (T-039):
 *   - `miCuentaSidebar`        — /me/* personal account pages
 *   - `misAlojamientosSidebar` — HOST's accommodation portfolio + create
 *   - `consultasSidebar`       — HOST's conversation inbox
 *   - `miFacturacionSidebar`   — HOST's subscription view
 *
 * @see apps/admin/src/config/ia/schema.ts  — Sidebar / SidebarItem type contracts
 */

import type { z } from 'zod';
import type { SidebarSchema } from './schema';

/** Input type for a Sidebar — fields with `.default()` (onMissing, exact, defaultOpen) are optional. */
type SidebarInput = z.input<typeof SidebarSchema>;

// ---------------------------------------------------------------------------
// T-008 — inicioSidebar
// ---------------------------------------------------------------------------

/**
 * Inicio sidebar — Personal work hub.
 *
 * V1 is scoped to 2 items only (per doc 01 §19 V1-scope decision):
 * - Dashboard link (label overridden per role in role config)
 * - Mi inbox (beta) using the existing /notifications route
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const items = sidebars.inicioSidebar.items; // 2 items
 * ```
 */
const inicioSidebar: SidebarInput = {
    items: [
        {
            type: 'link',
            id: 'dashboard',
            label: { es: 'Dashboard', en: 'Dashboard', pt: 'Dashboard' },
            icon: 'DashboardIcon',
            route: '/dashboard',
            exact: true,
            permissions: ['ACCESS_PANEL_ADMIN']
        },
        {
            type: 'link',
            id: 'inbox',
            label: { es: 'Mi inbox (beta)', en: 'My inbox (beta)', pt: 'Minha caixa (beta)' },
            icon: 'NotificationIcon',
            route: '/notifications',
            exact: true,
            permissions: ['ACCESS_PANEL_ADMIN']
        }
    ]
};

// ---------------------------------------------------------------------------
// T-008 — catalogoSidebar
// ---------------------------------------------------------------------------

/**
 * Catálogo sidebar — Accommodations, destinations, attractions, amenities, features.
 *
 * Consolidates items from the old `content.section.tsx` (accommodations,
 * destinations, attractions, amenities, features) and the catalog items from
 * `administration.section.tsx`.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const group = sidebars.catalogoSidebar.items[0]; // alojamientos group
 * ```
 */
const catalogoSidebar: SidebarInput = {
    items: [
        // ── Alojamientos ──────────────────────────────────────────────────
        {
            type: 'group',
            id: 'alojamientos',
            label: { es: 'Alojamientos', en: 'Accommodations', pt: 'Alojamentos' },
            icon: 'AccommodationIcon',
            defaultOpen: true,
            permissions: ['ACCOMMODATION_VIEW_ALL', 'ACCOMMODATION_CREATE'],
            items: [
                {
                    type: 'link',
                    id: 'aloj-list',
                    label: { es: 'Listado', en: 'List', pt: 'Lista' },
                    icon: 'ListIcon',
                    route: '/accommodations',
                    permissions: ['ACCOMMODATION_VIEW_ALL']
                },
                {
                    type: 'link',
                    id: 'aloj-new',
                    label: {
                        es: 'Crear alojamiento',
                        en: 'Create accommodation',
                        pt: 'Criar alojamento'
                    },
                    icon: 'AddIcon',
                    route: '/accommodations/new',
                    permissions: ['ACCOMMODATION_CREATE']
                },
                { type: 'separator', id: 'sep-aloj-catalogs' },
                {
                    type: 'link',
                    id: 'amenidades',
                    label: { es: 'Amenidades', en: 'Amenities', pt: 'Amenidades' },
                    route: '/content/accommodation-amenities',
                    permissions: ['AMENITY_VIEW']
                },
                {
                    type: 'link',
                    id: 'caracteristicas',
                    label: { es: 'Características', en: 'Features', pt: 'Características' },
                    route: '/content/accommodation-features',
                    permissions: ['FEATURE_VIEW']
                }
            ]
        },
        { type: 'separator', id: 'sep-destinos' },
        // ── Destinos ──────────────────────────────────────────────────────
        {
            type: 'group',
            id: 'destinos',
            label: { es: 'Destinos', en: 'Destinations', pt: 'Destinos' },
            icon: 'DestinationIcon',
            defaultOpen: false,
            permissions: ['DESTINATION_VIEW_ALL', 'DESTINATION_CREATE'],
            items: [
                {
                    type: 'link',
                    id: 'destinos-list',
                    label: { es: 'Listado', en: 'List', pt: 'Lista' },
                    icon: 'ListIcon',
                    route: '/destinations',
                    permissions: ['DESTINATION_VIEW_ALL']
                },
                {
                    type: 'link',
                    id: 'destinos-new',
                    label: { es: 'Crear destino', en: 'Create destination', pt: 'Criar destino' },
                    icon: 'AddIcon',
                    route: '/destinations/new',
                    permissions: ['DESTINATION_CREATE']
                },
                {
                    type: 'link',
                    id: 'atracciones',
                    label: { es: 'Atracciones', en: 'Attractions', pt: 'Atrações' },
                    icon: 'MapIcon',
                    route: '/content/destination-attractions',
                    permissions: ['ATTRACTION_VIEW']
                }
            ]
        }
    ]
};

// ---------------------------------------------------------------------------
// T-009 — editorialSidebar
// ---------------------------------------------------------------------------

/**
 * Editorial sidebar — Posts, events, newsletter, tags.
 *
 * Consolidates items from the old `content.section.tsx` blog/events groups,
 * newsletter routes, and tag management from `administration.section.tsx`.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const blogGroup = sidebars.editorialSidebar.items[0]; // blog group
 * ```
 */
const editorialSidebar: SidebarInput = {
    items: [
        // ── Blog ──────────────────────────────────────────────────────────
        {
            type: 'group',
            id: 'blog',
            label: { es: 'Blog', en: 'Blog', pt: 'Blog' },
            icon: 'PostIcon',
            defaultOpen: true,
            permissions: ['POST_VIEW_ALL', 'POST_CREATE'],
            items: [
                {
                    type: 'link',
                    id: 'posts-list',
                    label: { es: 'Posts (todos)', en: 'All posts', pt: 'Posts (todos)' },
                    icon: 'ListIcon',
                    route: '/posts',
                    permissions: ['POST_VIEW_ALL']
                },
                {
                    type: 'link',
                    id: 'post-new',
                    label: { es: 'Crear post', en: 'Create post', pt: 'Criar post' },
                    icon: 'AddIcon',
                    route: '/posts/new',
                    permissions: ['POST_CREATE']
                },
                {
                    type: 'link',
                    id: 'post-tags',
                    label: { es: 'Tags de blog', en: 'Blog tags', pt: 'Tags do blog' },
                    icon: 'TagsIcon',
                    route: '/tags/post-tags',
                    permissions: ['POST_TAG_VIEW', 'POST_TAG_CREATE']
                }
            ]
        },
        { type: 'separator', id: 'sep-events' },
        // ── Eventos ───────────────────────────────────────────────────────
        {
            type: 'group',
            id: 'eventos',
            label: { es: 'Eventos', en: 'Events', pt: 'Eventos' },
            icon: 'EventIcon',
            defaultOpen: false,
            permissions: ['EVENT_VIEW_ALL', 'EVENT_CREATE'],
            items: [
                {
                    type: 'link',
                    id: 'eventos-list',
                    label: { es: 'Listado', en: 'List', pt: 'Lista' },
                    icon: 'ListIcon',
                    route: '/events',
                    permissions: ['EVENT_VIEW_ALL']
                },
                {
                    type: 'link',
                    id: 'evento-new',
                    label: { es: 'Crear evento', en: 'Create event', pt: 'Criar evento' },
                    icon: 'AddIcon',
                    route: '/events/new',
                    permissions: ['EVENT_CREATE']
                },
                {
                    type: 'link',
                    id: 'locaciones',
                    label: { es: 'Locaciones', en: 'Locations', pt: 'Locais' },
                    icon: 'EventLocationIcon',
                    route: '/events/locations',
                    permissions: ['EVENT_LOCATION_VIEW', 'EVENT_LOCATION_CREATE']
                },
                {
                    type: 'link',
                    id: 'organizadores',
                    label: { es: 'Organizadores', en: 'Organizers', pt: 'Organizadores' },
                    icon: 'EventOrganizerIcon',
                    route: '/events/organizers',
                    permissions: ['EVENT_ORGANIZER_VIEW', 'EVENT_ORGANIZER_CREATE']
                }
            ]
        },
        { type: 'separator', id: 'sep-newsletter' },
        // ── Newsletter ────────────────────────────────────────────────────
        {
            type: 'group',
            id: 'newsletter',
            label: { es: 'Newsletter', en: 'Newsletter', pt: 'Newsletter' },
            icon: 'NewsletterIcon',
            defaultOpen: false,
            permissions: ['NEWSLETTER_CAMPAIGN_VIEW', 'NEWSLETTER_SUBSCRIBER_VIEW'],
            items: [
                {
                    type: 'link',
                    id: 'campanas',
                    label: { es: 'Campañas', en: 'Campaigns', pt: 'Campanhas' },
                    icon: 'ListIcon',
                    route: '/newsletter/campaigns',
                    permissions: ['NEWSLETTER_CAMPAIGN_VIEW']
                },
                {
                    type: 'link',
                    id: 'campana-new',
                    label: { es: 'Crear campaña', en: 'Create campaign', pt: 'Criar campanha' },
                    icon: 'AddIcon',
                    route: '/newsletter/campaigns/new',
                    permissions: ['NEWSLETTER_CAMPAIGN_WRITE']
                },
                {
                    type: 'link',
                    id: 'suscriptores',
                    label: { es: 'Suscriptores', en: 'Subscribers', pt: 'Assinantes' },
                    icon: 'UsersIcon',
                    route: '/newsletter/subscribers',
                    permissions: ['NEWSLETTER_SUBSCRIBER_VIEW']
                }
            ]
        }
    ]
};

// ---------------------------------------------------------------------------
// T-009 — comunidadSidebar
// ---------------------------------------------------------------------------

/**
 * Comunidad sidebar — Users, conversations, roles & permissions.
 *
 * Consolidates items from the old `administration.section.tsx` (access control:
 * users, roles, permissions) and `content.section.tsx` (conversations inbox).
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const usersGroup = sidebars.comunidadSidebar.items[0]; // usuarios group
 * ```
 */
const comunidadSidebar: SidebarInput = {
    items: [
        // ── Usuarios ──────────────────────────────────────────────────────
        {
            type: 'group',
            id: 'usuarios',
            label: { es: 'Usuarios', en: 'Users', pt: 'Usuários' },
            icon: 'UsersManagementIcon',
            defaultOpen: true,
            permissions: ['USER_READ_ALL', 'USER_CREATE'],
            items: [
                {
                    type: 'link',
                    id: 'todos-usuarios',
                    label: { es: 'Todos los usuarios', en: 'All users', pt: 'Todos os usuários' },
                    icon: 'ListIcon',
                    route: '/access/users',
                    permissions: ['USER_READ_ALL']
                },
                {
                    type: 'link',
                    id: 'usuario-new',
                    label: { es: 'Invitar usuario', en: 'Invite user', pt: 'Convidar usuário' },
                    icon: 'AddIcon',
                    route: '/access/users/new',
                    permissions: ['USER_CREATE']
                }
            ]
        },
        { type: 'separator', id: 'sep-conversaciones' },
        // ── Conversaciones ────────────────────────────────────────────────
        {
            type: 'group',
            id: 'conversaciones',
            label: { es: 'Conversaciones', en: 'Conversations', pt: 'Conversações' },
            icon: 'ChatIcon',
            defaultOpen: false,
            permissions: ['CONVERSATION_VIEW_OWN', 'CONVERSATION_VIEW_ALL'],
            items: [
                {
                    type: 'link',
                    id: 'conversations-inbox',
                    label: { es: 'Inbox', en: 'Inbox', pt: 'Inbox' },
                    icon: 'MailIcon',
                    route: '/conversations',
                    permissions: ['CONVERSATION_VIEW_OWN', 'CONVERSATION_VIEW_ALL']
                }
            ]
        },
        { type: 'separator', id: 'sep-roles' },
        // ── Roles y permisos ──────────────────────────────────────────────
        {
            type: 'group',
            id: 'roles-permisos',
            label: { es: 'Roles y permisos', en: 'Roles & permissions', pt: 'Papéis e permissões' },
            icon: 'RolesIcon',
            defaultOpen: false,
            permissions: ['ACCESS_PERMISSIONS_MANAGE', 'PERMISSION_VIEW'],
            items: [
                {
                    type: 'link',
                    id: 'roles',
                    label: { es: 'Roles', en: 'Roles', pt: 'Papéis' },
                    icon: 'RolesIcon',
                    route: '/access/roles',
                    permissions: ['ACCESS_PERMISSIONS_MANAGE']
                },
                {
                    type: 'link',
                    id: 'permisos',
                    label: {
                        es: 'Permisos (catálogo)',
                        en: 'Permissions (catalog)',
                        pt: 'Permissões (catálogo)'
                    },
                    icon: 'PermissionsIcon',
                    route: '/access/permissions',
                    permissions: ['ACCESS_PERMISSIONS_MANAGE', 'PERMISSION_VIEW']
                }
            ]
        }
    ]
};

// ---------------------------------------------------------------------------
// T-010 — comercialSidebar
// ---------------------------------------------------------------------------

/**
 * Comercial sidebar — Billing, plans, subscriptions, invoices, promos, sponsorships.
 *
 * Mirrors the full SUPER_ADMIN commercial universe from doc 01 §13 (5.1–5.7).
 * Consolidates all items from the old `billing.section.tsx`.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const subs = sidebars.comercialSidebar.items[0]; // suscripciones group
 * ```
 */
const comercialSidebar: SidebarInput = {
    items: [
        // ── Suscripciones ─────────────────────────────────────────────────
        {
            type: 'group',
            id: 'suscripciones',
            label: { es: 'Suscripciones', en: 'Subscriptions', pt: 'Assinaturas' },
            icon: 'CreditCardIcon',
            defaultOpen: true,
            permissions: ['PRICING_PLAN_VIEW', 'SUBSCRIPTION_VIEW'],
            onMissing: 'hide',
            items: [
                {
                    type: 'link',
                    id: 'planes',
                    label: { es: 'Planes', en: 'Plans', pt: 'Planos' },
                    icon: 'ListIcon',
                    route: '/billing/plans',
                    permissions: ['PRICING_PLAN_VIEW'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'subscriptions',
                    label: {
                        es: 'Suscripciones activas',
                        en: 'Active subscriptions',
                        pt: 'Assinaturas ativas'
                    },
                    icon: 'ReceiptIcon',
                    route: '/billing/subscriptions',
                    permissions: ['SUBSCRIPTION_VIEW'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'addons',
                    label: { es: 'Add-ons', en: 'Add-ons', pt: 'Add-ons' },
                    icon: 'AddIcon',
                    route: '/billing/addons',
                    permissions: ['SUBSCRIPTION_ITEM_VIEW'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'metricas-uso',
                    label: { es: 'Métricas de uso', en: 'Usage metrics', pt: 'Métricas de uso' },
                    icon: 'MetricsIcon',
                    route: '/billing/metrics',
                    permissions: ['BILLING_METRICS_READ'],
                    onMissing: 'hide'
                }
            ]
        },
        { type: 'separator', id: 'sep-pagos' },
        // ── Pagos ─────────────────────────────────────────────────────────
        {
            type: 'group',
            id: 'pagos',
            label: { es: 'Pagos', en: 'Payments', pt: 'Pagamentos' },
            icon: 'ReceiptIcon',
            defaultOpen: false,
            permissions: ['PAYMENT_VIEW', 'INVOICE_VIEW'],
            onMissing: 'hide',
            items: [
                {
                    type: 'link',
                    id: 'payments',
                    label: { es: 'Transacciones', en: 'Transactions', pt: 'Transações' },
                    icon: 'PriceIcon',
                    route: '/billing/payments',
                    permissions: ['PAYMENT_VIEW'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'invoices',
                    label: { es: 'Facturas', en: 'Invoices', pt: 'Faturas' },
                    icon: 'FileTextIcon',
                    route: '/billing/invoices',
                    permissions: ['INVOICE_VIEW'],
                    onMissing: 'hide'
                }
            ]
        },
        { type: 'separator', id: 'sep-promociones' },
        // ── Promociones ───────────────────────────────────────────────────
        {
            type: 'group',
            id: 'promociones',
            label: { es: 'Promociones', en: 'Promotions', pt: 'Promoções' },
            icon: 'PromotionsIcon',
            defaultOpen: false,
            permissions: ['DISCOUNT_CODE_VIEW', 'OWNER_PROMOTION_VIEW'],
            onMissing: 'hide',
            items: [
                {
                    type: 'link',
                    id: 'promo-codes',
                    label: {
                        es: 'Códigos promocionales',
                        en: 'Promo codes',
                        pt: 'Códigos promocionais'
                    },
                    icon: 'CouponsIcon',
                    route: '/billing/promo-codes',
                    permissions: ['DISCOUNT_CODE_VIEW'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'owner-promotions',
                    label: {
                        es: 'Promos para hosts',
                        en: 'Host promotions',
                        pt: 'Promoções para hosts'
                    },
                    icon: 'OffersIcon',
                    route: '/billing/owner-promotions',
                    permissions: ['OWNER_PROMOTION_VIEW'],
                    onMissing: 'hide'
                }
            ]
        },
        { type: 'separator', id: 'sep-sponsorships' },
        // ── Sponsorships ──────────────────────────────────────────────────
        {
            type: 'group',
            id: 'sponsorships',
            label: { es: 'Sponsorships', en: 'Sponsorships', pt: 'Patrocínios' },
            icon: 'PostSponsorshipIcon',
            defaultOpen: false,
            permissions: ['SPONSORSHIP_VIEW', 'POST_SPONSOR_VIEW'],
            onMissing: 'hide',
            items: [
                {
                    type: 'link',
                    id: 'sponsorships-list',
                    label: {
                        es: 'Sponsorships activos',
                        en: 'Active sponsorships',
                        pt: 'Patrocínios ativos'
                    },
                    icon: 'ListIcon',
                    route: '/billing/sponsorships',
                    permissions: ['SPONSORSHIP_VIEW'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'sponsors',
                    label: {
                        es: 'Sponsors (entidad)',
                        en: 'Sponsors (entity)',
                        pt: 'Patrocinadores (entidade)'
                    },
                    icon: 'PostSponsorIcon',
                    route: '/sponsors',
                    permissions: ['POST_SPONSOR_VIEW'],
                    onMissing: 'hide'
                }
            ]
        },
        { type: 'separator', id: 'sep-ops-billing' },
        // ── Operaciones billing ────────────────────────────────────────────
        {
            type: 'group',
            id: 'ops-billing',
            label: { es: 'Operaciones billing', en: 'Billing ops', pt: 'Operações billing' },
            icon: 'WebhookIcon',
            defaultOpen: false,
            permissions: ['EXCHANGE_RATE_VIEW', 'BILLING_READ_ALL'],
            onMissing: 'hide',
            items: [
                {
                    type: 'link',
                    id: 'exchange-rates',
                    label: { es: 'Tipos de cambio', en: 'Exchange rates', pt: 'Taxas de câmbio' },
                    icon: 'DollarSignIcon',
                    route: '/billing/exchange-rates',
                    permissions: ['EXCHANGE_RATE_VIEW'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'webhook-events',
                    label: { es: 'Webhook events', en: 'Webhook events', pt: 'Webhook events' },
                    icon: 'WebhookIcon',
                    route: '/billing/webhook-events',
                    permissions: ['BILLING_READ_ALL'],
                    onMissing: 'hide'
                },
                {
                    type: 'link',
                    id: 'billing-cron',
                    label: { es: 'Cron de billing', en: 'Billing cron', pt: 'Cron de billing' },
                    icon: 'ClockIcon',
                    route: '/billing/cron',
                    permissions: ['BILLING_READ_ALL'],
                    onMissing: 'hide'
                }
            ]
        },
        { type: 'separator', id: 'sep-config-billing' },
        {
            type: 'link',
            id: 'billing-settings',
            label: {
                es: 'Configuración billing',
                en: 'Billing settings',
                pt: 'Configuração billing'
            },
            icon: 'SettingsIcon',
            route: '/billing/settings',
            permissions: ['BILLING_READ_ALL'],
            onMissing: 'hide'
        }
    ]
};

// ---------------------------------------------------------------------------
// T-010 — plataformaSidebar
// ---------------------------------------------------------------------------

/**
 * Plataforma sidebar — Settings, SEO, cache/ISR, cron, webhooks, logs, audit.
 *
 * Items 6.7 (Configuración crítica) and 6.8 (Auditoría) are SUPER_ADMIN-only
 * and use `onMissing: 'hide'` so they disappear entirely for ADMIN and below.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const crit = sidebars.plataformaSidebar.items; // includes critical-config (hidden for ADMIN)
 * ```
 */
const plataformaSidebar: SidebarInput = {
    items: [
        // ── Configuración general ─────────────────────────────────────────
        {
            type: 'group',
            id: 'config-general',
            label: {
                es: 'Configuración general',
                en: 'General settings',
                pt: 'Configuração geral'
            },
            icon: 'SettingsIcon',
            defaultOpen: true,
            permissions: ['SETTINGS_MANAGE', 'SEO_MANAGE'],
            items: [
                {
                    type: 'link',
                    id: 'seo',
                    label: { es: 'SEO defaults', en: 'SEO defaults', pt: 'SEO padrão' },
                    icon: 'SearchIcon',
                    route: '/settings/seo',
                    permissions: ['SEO_MANAGE']
                },
                {
                    type: 'link',
                    id: 'critical-settings',
                    label: {
                        es: 'Configuración crítica',
                        en: 'Critical settings',
                        pt: 'Configuração crítica'
                    },
                    icon: 'ShieldAlertIcon',
                    route: '/settings/critical',
                    // SUPER_ADMIN-only: gate on a permission ADMIN does NOT hold
                    // (ADMIN has ACCESS_PANEL_ADMIN, so that gate would never hide it).
                    // SYSTEM_MAINTENANCE_MODE is SUPER-exclusive in ROLE_PERMISSIONS.
                    permissions: ['SYSTEM_MAINTENANCE_MODE'],
                    onMissing: 'hide'
                }
            ]
        },
        { type: 'separator', id: 'sep-cache' },
        // ── Cache & deploy ────────────────────────────────────────────────
        {
            type: 'group',
            id: 'cache-deploy',
            label: { es: 'Cache y deploy', en: 'Cache & deploy', pt: 'Cache e deploy' },
            icon: 'RefreshIcon',
            defaultOpen: false,
            permissions: ['REVALIDATION_TRIGGER', 'REVALIDATION_CONFIG_VIEW'],
            items: [
                {
                    type: 'link',
                    id: 'revalidation',
                    label: {
                        es: 'Revalidación ISR',
                        en: 'ISR revalidation',
                        pt: 'Revalidação ISR'
                    },
                    icon: 'RefreshIcon',
                    route: '/revalidation',
                    permissions: [
                        'REVALIDATION_TRIGGER',
                        'REVALIDATION_CONFIG_VIEW',
                        'REVALIDATION_CONFIG_EDIT',
                        'REVALIDATION_LOG_VIEW'
                    ]
                }
            ]
        },
        { type: 'separator', id: 'sep-tags-sistema' },
        // ── Tags del sistema ──────────────────────────────────────────────
        {
            type: 'group',
            id: 'tags-sistema',
            label: { es: 'Tags del sistema', en: 'System tags', pt: 'Tags do sistema' },
            icon: 'TagsIcon',
            defaultOpen: false,
            permissions: ['TAG_SYSTEM_VIEW', 'TAG_INTERNAL_VIEW'],
            items: [
                {
                    type: 'link',
                    id: 'system-tags',
                    label: { es: 'Tags de sistema', en: 'System tags', pt: 'Tags do sistema' },
                    icon: 'TagIcon',
                    route: '/tags/system',
                    permissions: ['TAG_SYSTEM_VIEW']
                },
                {
                    type: 'link',
                    id: 'internal-tags',
                    label: {
                        es: 'Etiquetas internas',
                        en: 'Internal tags',
                        pt: 'Etiquetas internas'
                    },
                    icon: 'TagIcon',
                    route: '/tags/internal',
                    permissions: ['TAG_INTERNAL_VIEW']
                },
                {
                    type: 'link',
                    id: 'user-tag-moderation',
                    label: {
                        es: 'Moderación de tags',
                        en: 'Tag moderation',
                        pt: 'Moderação de tags'
                    },
                    icon: 'TagsIcon',
                    route: '/tags/user-moderation',
                    permissions: ['TAG_VIEW_ALL_USER_TAGS']
                }
            ]
        },
        { type: 'separator', id: 'sep-audit' },
        // ── Auditoría — SUPER_ADMIN only (onMissing: 'hide') ─────────────
        {
            type: 'link',
            id: 'audit-log',
            label: { es: 'Log de auditoría', en: 'Audit log', pt: 'Log de auditoria' },
            icon: 'LogsIcon',
            route: '/analytics/debug',
            permissions: ['AUDIT_LOG_VIEW'],
            onMissing: 'hide'
        }
    ]
};

// ---------------------------------------------------------------------------
// T-010 — analisisSidebar
// ---------------------------------------------------------------------------

/**
 * Análisis sidebar — Business analytics, system usage, content metrics, SEO, debug.
 *
 * The Debug item (7.6) is SUPER_ADMIN-only and uses `onMissing: 'hide'`.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const debug = sidebars.analisisSidebar.items[3]; // debug link (hidden for non-SUPER)
 * ```
 */
const analisisSidebar: SidebarInput = {
    items: [
        {
            type: 'link',
            id: 'analytics-usage',
            label: { es: 'Uso del sistema', en: 'System usage', pt: 'Uso do sistema' },
            icon: 'MetricsIcon',
            route: '/analytics/usage',
            permissions: ['ANALYTICS_VIEW']
        },
        {
            type: 'link',
            id: 'analytics-business',
            label: { es: 'Negocio', en: 'Business', pt: 'Negócio' },
            icon: 'StatisticsIcon',
            route: '/analytics/business',
            permissions: ['ANALYTICS_VIEW']
        },
        { type: 'separator', id: 'sep-debug' },
        // ── Debug — SUPER_ADMIN only (onMissing: 'hide') ─────────────────
        {
            type: 'link',
            id: 'debug',
            label: { es: 'Debug', en: 'Debug', pt: 'Debug' },
            icon: 'DebugIcon',
            route: '/analytics/debug',
            permissions: ['DEBUG_TOOLS_ACCESS'],
            onMissing: 'hide'
        }
    ]
};

// ---------------------------------------------------------------------------
// T-039 — HOST-role sidebars
// ---------------------------------------------------------------------------

/**
 * Mi cuenta sidebar — Personal profile, settings, security, and own tags.
 *
 * SHARED sidebar: accessible from any role via the avatar dropdown topbar menu,
 * but only HOST puts the parent section in their `mainMenu`.
 *
 * Routes verified against `apps/admin/src/routes/_authed/me/`:
 *   profile.tsx, settings.tsx, change-password.tsx, tags.tsx
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const items = sidebars.miCuentaSidebar.items; // 4 items
 * ```
 */
const miCuentaSidebar: SidebarInput = {
    items: [
        {
            type: 'link',
            id: 'mi-perfil',
            label: { es: 'Mi perfil', en: 'My profile', pt: 'Meu perfil' },
            icon: 'UserIcon',
            route: '/me/profile',
            exact: true,
            permissions: ['USER_VIEW_PROFILE']
        },
        {
            type: 'link',
            id: 'preferencias',
            label: { es: 'Preferencias', en: 'Preferences', pt: 'Preferências' },
            icon: 'SettingsIcon',
            route: '/me/settings',
            exact: true,
            permissions: ['USER_SETTINGS_UPDATE']
        },
        {
            type: 'link',
            id: 'seguridad',
            label: { es: 'Seguridad', en: 'Security', pt: 'Segurança' },
            icon: 'ShieldIcon',
            route: '/me/change-password',
            exact: true,
            permissions: ['ACCESS_PANEL_ADMIN']
        },
        {
            type: 'link',
            id: 'mis-tags',
            label: { es: 'Mis tags', en: 'My tags', pt: 'Minhas tags' },
            icon: 'TagsIcon',
            route: '/me/tags',
            exact: true,
            permissions: ['TAG_USER_VIEW_OWN']
        }
    ]
};

/**
 * Mis alojamientos sidebar — HOST accommodation portfolio and creation.
 *
 * Routes verified against `apps/admin/src/routes/_authed/`:
 *   me/accommodations/index.tsx, accommodations/new.tsx
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const items = sidebars.misAlojamientosSidebar.items; // 2 items
 * ```
 */
const misAlojamientosSidebar: SidebarInput = {
    items: [
        {
            type: 'link',
            id: 'mis-alojamientos-list',
            label: { es: 'Mis alojamientos', en: 'My accommodations', pt: 'Meus alojamentos' },
            icon: 'AccommodationIcon',
            route: '/me/accommodations',
            exact: true,
            permissions: ['ACCOMMODATION_UPDATE_OWN', 'ACCOMMODATION_VIEW_ALL']
        },
        {
            type: 'link',
            id: 'nuevo-alojamiento',
            label: {
                es: 'Nuevo alojamiento',
                en: 'New accommodation',
                pt: 'Novo alojamento'
            },
            icon: 'AddIcon',
            route: '/accommodations/new',
            exact: true,
            permissions: ['ACCOMMODATION_CREATE']
        }
    ]
};

/**
 * Consultas sidebar — HOST conversation inbox.
 *
 * Routes verified against `apps/admin/src/routes/_authed/conversations/index.tsx`.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const items = sidebars.consultasSidebar.items; // 1 item
 * ```
 */
const consultasSidebar: SidebarInput = {
    items: [
        {
            type: 'link',
            id: 'conversaciones',
            label: { es: 'Conversaciones', en: 'Conversations', pt: 'Conversações' },
            icon: 'ChatIcon',
            route: '/conversations',
            exact: false,
            permissions: ['CONVERSATION_VIEW_OWN']
        }
    ]
};

/**
 * Mi facturación sidebar — HOST's own subscription view.
 *
 * Points to /billing/subscriptions — the most actionable billing page for a HOST
 * (see section comment in sections.ts for the full rationale). Plans read-only
 * catalog is also accessible via PRICING_PLAN_VIEW.
 *
 * Routes verified against `apps/admin/src/routes/_authed/billing/`:
 *   subscriptions.tsx, plans.tsx
 *
 * Note: the HOST usage widget is deferred to SPEC-155. /billing/metrics requires
 * BILLING_METRICS_READ which HOSTs do not hold.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const items = sidebars.miFacturacionSidebar.items; // 2 items
 * ```
 */
const miFacturacionSidebar: SidebarInput = {
    items: [
        {
            type: 'link',
            id: 'mi-suscripcion',
            label: { es: 'Mi suscripción', en: 'My subscription', pt: 'Minha assinatura' },
            icon: 'CreditCardIcon',
            route: '/billing/subscriptions',
            exact: true,
            permissions: ['SUBSCRIPTION_VIEW']
        },
        {
            type: 'link',
            id: 'planes-disponibles',
            label: { es: 'Planes disponibles', en: 'Available plans', pt: 'Planos disponíveis' },
            icon: 'ListIcon',
            route: '/billing/plans',
            exact: true,
            permissions: ['PRICING_PLAN_VIEW']
        }
    ]
};

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

/**
 * Registry of all 11 admin sidebars (7 original + 4 HOST), keyed by canonical sidebar ID.
 *
 * Role configs reference these IDs in their `mainMenu` section references.
 * The renderer looks up the active sidebar from this registry.
 *
 * @example
 * ```ts
 * import { sidebars } from '@/config/ia/sidebars';
 * const sidebar = sidebars['inicioSidebar'];
 * ```
 */
export const sidebars: Record<string, SidebarInput> = {
    inicioSidebar,
    catalogoSidebar,
    editorialSidebar,
    comunidadSidebar,
    comercialSidebar,
    plataformaSidebar,
    analisisSidebar,
    miCuentaSidebar,
    misAlojamientosSidebar,
    consultasSidebar,
    miFacturacionSidebar
};
