/**
 * Shape of an entry-point row on the account dashboards (HOS-2473..2476).
 *
 * Plain data so pure builders can produce rows without importing React; the
 * `DashboardLinksSection` component maps `icon` to an `@repo/icons` element.
 *
 * @module lib/account/dashboard-rows
 */

/** Icons a dashboard row may show. */
export type DashboardRowIcon =
    | 'dashboard'
    | 'building'
    | 'briefcase'
    | 'chat'
    | 'settings'
    | 'newsletter'
    | 'megaphone'
    | 'card';

/** One entry-point row. */
export interface DashboardRow {
    /** Stable id, rendered as `data-row`. */
    readonly id: string;
    /** i18n key of the title. */
    readonly labelKey: string;
    /** i18n key of the supporting line. */
    readonly descriptionKey?: string;
    /** Path under the locale, for `buildUrl`. */
    readonly path: string;
    /** Decorative icon. */
    readonly icon: DashboardRowIcon;
}
