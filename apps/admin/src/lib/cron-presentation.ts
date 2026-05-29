/**
 * Shared presentation helpers for cron jobs (SPEC-161 UX).
 *
 * Single source of truth in the admin for category labels, category ordering,
 * and date formatting — consumed by both the dashboard card (admin.crons.list)
 * and the platform crons page so they stay consistent.
 *
 * @module lib/cron-presentation
 */

import type { CronCategory } from '@repo/schemas';

/** Spanish labels for each cron category. */
export const CRON_CATEGORY_LABELS: Readonly<Record<CronCategory, string>> = {
    billing: 'Facturación',
    notifications: 'Notificaciones',
    content: 'Contenido',
    media: 'Medios',
    'search-cache': 'Búsqueda y caché',
    system: 'Sistema'
};

/** Display order for categories (groups render in this order). */
export const CRON_CATEGORY_ORDER: ReadonlyArray<CronCategory> = [
    'billing',
    'notifications',
    'content',
    'media',
    'search-cache',
    'system'
];

/** Returns the display rank of a category (for sorting); unknown → end. */
export const cronCategoryRank = (category: CronCategory): number => {
    const idx = CRON_CATEGORY_ORDER.indexOf(category);
    return idx === -1 ? CRON_CATEGORY_ORDER.length : idx;
};

/**
 * Formats an ISO timestamp / Date as a short Spanish date-time
 * (e.g. "29 may, 14:30"). Returns null for empty/invalid input.
 */
export const formatCronDateTime = (value: string | Date | null | undefined): string | null => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('es-AR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};
