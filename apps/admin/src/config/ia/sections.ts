/**
 * Admin IA — Section Definitions (T-007, extended T-039)
 *
 * The 7 top-level sections of the admin Information Architecture (Level 1),
 * plus 4 HOST-role sections added in T-039.
 *
 * Each section maps to a route, an icon, tri-locale labels, and the ID of the
 * sidebar that renders when that section is active.
 *
 * Design source of truth: `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §2.
 *
 * IMPORTANT: All routes use the existing router tree. No new routes are created.
 * Per SPEC-154 §11.2 this is a regroup-only redesign.
 *
 * HOST sections (T-039):
 *   - `miCuenta`        — SHARED section. HOST puts it in mainMenu; other roles reach
 *                         it via the topbar avatar dropdown. Routes: /me/*
 *   - `misAlojamientos` — HOST-specific. Routes: /me/accommodations, /accommodations/new
 *   - `consultas`       — HOST-specific. Routes: /conversations
 *
 * (HOS-1416: the `miFacturacion` HOST billing section was removed with the
 * legacy billing surface.)
 *
 * @see apps/admin/src/config/ia/sidebars.ts  — sidebar definitions referenced here
 * @see apps/admin/src/config/ia/schema.ts    — Section type contract
 */

import type { Section } from './schema';

/**
 * Registry of all 7 top-level admin sections.
 *
 * Keys are the canonical section IDs. Role configs reference these IDs in
 * their `mainMenu` arrays. The renderer reads `sidebar` to look up the active
 * sidebar from the {@link sidebars} registry.
 *
 * @example
 * ```ts
 * import { sections } from '@/config/ia/sections';
 * const dashboardRoute = sections.inicio.defaultRoute; // '/dashboard'
 * ```
 */
export const sections: Record<string, Section> = {
    /**
     * Inicio — Personal work hub. Dashboard scoped to the user's permissions,
     * notification inbox (beta). Always the first section in every role's main menu.
     */
    inicio: {
        id: 'inicio',
        label: { es: 'Inicio', en: 'Home', pt: 'Início' },
        icon: 'HomeIcon',
        route: '/dashboard',
        defaultRoute: '/dashboard',
        sidebar: 'inicioSidebar'
    },

    /**
     * Catálogo — Accommodations, destinations, attractions, amenities, features.
     * Contains all catalog-management entity pages.
     */
    catalogo: {
        id: 'catalogo',
        label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
        icon: 'AccommodationIcon',
        route: '/accommodations',
        defaultRoute: '/accommodations',
        sidebar: 'catalogoSidebar'
    },

    /**
     * Editorial — Posts, events, newsletter, tags. Content creation and publishing.
     */
    editorial: {
        id: 'editorial',
        label: { es: 'Editorial', en: 'Editorial', pt: 'Editorial' },
        icon: 'PostIcon',
        route: '/posts',
        defaultRoute: '/posts',
        sidebar: 'editorialSidebar'
    },

    /**
     * Comunidad — Users, conversations, roles & permissions, moderation.
     * Community management and access control.
     */
    comunidad: {
        id: 'comunidad',
        label: { es: 'Comunidad', en: 'Community', pt: 'Comunidade' },
        icon: 'UsersManagementIcon',
        route: '/access/users',
        defaultRoute: '/access/users',
        sidebar: 'comunidadSidebar'
    },

    /**
     * Comercial — Promotions, sponsorships, sponsors, exchange rates.
     * (HOS-1416: the billing plans/subscriptions/invoices surface was removed;
     * the section now lands on the surviving owner-promotions page.)
     */
    comercial: {
        id: 'comercial',
        label: { es: 'Comercial', en: 'Commercial', pt: 'Comercial' },
        icon: 'CreditCardIcon',
        route: '/billing/owner-promotions',
        defaultRoute: '/billing/owner-promotions',
        sidebar: 'comercialSidebar'
    },

    /**
     * Plataforma — Settings, SEO, cache/ISR, cron jobs, webhooks, logs, audit.
     * Infrastructure and platform configuration. SUPER_ADMIN-only sections
     * (Configuración crítica, Auditoría) use onMissing:'hide'.
     */
    plataforma: {
        id: 'plataforma',
        label: { es: 'Plataforma', en: 'Platform', pt: 'Plataforma' },
        icon: 'SettingsIcon',
        route: '/platform/configuration/seo',
        defaultRoute: '/platform/configuration/seo',
        sidebar: 'plataformaSidebar'
    },

    /**
     * Análisis — Business analytics, system usage, content metrics, SEO, debug.
     * The debug subsection is SUPER_ADMIN-only (onMissing:'hide').
     */
    analisis: {
        id: 'analisis',
        label: { es: 'Análisis', en: 'Analytics', pt: 'Análise' },
        icon: 'AnalyticsIcon',
        route: '/analytics/usage',
        defaultRoute: '/analytics/usage',
        sidebar: 'analisisSidebar'
    },

    // =========================================================================
    // HOST-ROLE sections (T-039)
    // =========================================================================

    /**
     * Mi cuenta — Personal profile, settings, security, own tags.
     *
     * SHARED section: HOST puts this in their `mainMenu`; ADMIN and higher roles
     * access it via the avatar dropdown in the topbar (so it does NOT appear in
     * their mainMenu). Routes live under `/me/*`.
     */
    miCuenta: {
        id: 'miCuenta',
        label: { es: 'Mi cuenta', en: 'My account', pt: 'Minha conta' },
        icon: 'UserIcon',
        route: '/account/profile',
        defaultRoute: '/account/profile',
        sidebar: 'miCuentaSidebar'
    },

    /**
     * Mis alojamientos — The HOST's own accommodation portfolio.
     *
     * Shows the host's accommodation list (filtered server-side to ACCOMMODATION_UPDATE_OWN
     * scope) and a quick-create link. Routes: /me/accommodations and /accommodations/new.
     */
    misAlojamientos: {
        id: 'misAlojamientos',
        label: { es: 'Mis alojamientos', en: 'My accommodations', pt: 'Meus alojamentos' },
        icon: 'AccommodationIcon',
        route: '/me/accommodations',
        defaultRoute: '/me/accommodations',
        sidebar: 'misAlojamientosSidebar'
    },

    /**
     * Consultas — HOST inbox for guest-owner conversations.
     *
     * Displays conversations the host participates in, powered by the existing
     * /conversations route (filtered server-side by CONVERSATION_VIEW_OWN scope).
     */
    consultas: {
        id: 'consultas',
        label: { es: 'Consultas', en: 'Inquiries', pt: 'Consultas' },
        icon: 'ChatIcon',
        route: '/conversations',
        defaultRoute: '/conversations',
        sidebar: 'consultasSidebar'
    },

    /**
     * Marketing — Social media publishing, social post batches, campaigns,
     * audiences, hashtags, platform formats, footers, settings, and newsletter.
     * All social marketing operations under one section.
     */
    marketing: {
        id: 'marketing',
        label: { es: 'Marketing', en: 'Marketing', pt: 'Marketing' },
        icon: 'PromotionsIcon',
        route: '/social',
        defaultRoute: '/social',
        sidebar: 'marketingSidebar'
    }
} as const;
