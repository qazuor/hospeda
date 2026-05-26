/**
 * @file nav-icon-map.ts
 * @description Local icon resolver for the admin navigation (config-driven IA).
 *
 * The admin IA config (`src/config/ia/`) references icons by name string
 * (e.g. `icon: 'HomeIcon'`) so the config stays declarative and Zod-validated.
 * Those names are resolved to components HERE, via direct imports — NOT through
 * the shared `@repo/icons` `resolveIcon`/`ICON_MAP`.
 *
 * Why local:
 * - `@repo/icons` `ICON_MAP` is reserved for DATA-DRIVEN icons whose names come
 *   from the database (amenities, attractions, accommodation features,
 *   accommodation categories). Navigation icons are static and known at build
 *   time, so importing them directly is type-safe and tree-shakeable, and keeps
 *   the shared map from having to carry every UI/nav icon.
 * - Mirrors `apps/web/src/lib/icon-map.ts` (`WEB_ICON_MAP`), which does the same
 *   for the web app.
 *
 * To add a nav icon: import it from `@repo/icons` and add it to `NAV_ICON_MAP`.
 * The set must cover every `icon` referenced in `src/config/ia/` (sections,
 * sidebars, create-actions).
 */

import {
    AccommodationIcon,
    AddIcon,
    AnalyticsIcon,
    ChatIcon,
    CheckCircleIcon,
    ClockIcon,
    CouponsIcon,
    CreditCardIcon,
    DashboardIcon,
    DebugIcon,
    DestinationIcon,
    DollarSignIcon,
    EventIcon,
    EventLocationIcon,
    EventOrganizerIcon,
    FileTextIcon,
    HomeIcon,
    type IconProps,
    ListIcon,
    LogsIcon,
    MailIcon,
    MapIcon,
    MetricsIcon,
    NewsletterIcon,
    NotificationIcon,
    OffersIcon,
    PermissionsIcon,
    PostIcon,
    PostSponsorIcon,
    PostSponsorshipIcon,
    PriceIcon,
    PromotionsIcon,
    ReceiptIcon,
    RefreshIcon,
    RolesIcon,
    SearchIcon,
    SettingsIcon,
    ShieldAlertIcon,
    ShieldIcon,
    StatisticsIcon,
    TagIcon,
    TagsIcon,
    UserIcon,
    UsersIcon,
    UsersManagementIcon,
    WebhookIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

/**
 * Maps the icon-name strings used across the admin IA config to their
 * components. Keep alphabetically sorted and in sync with `src/config/ia/`.
 */
const NAV_ICON_MAP: Record<string, ComponentType<IconProps>> = {
    AccommodationIcon,
    AddIcon,
    AnalyticsIcon,
    ChatIcon,
    CheckCircleIcon,
    ClockIcon,
    CouponsIcon,
    CreditCardIcon,
    DashboardIcon,
    DebugIcon,
    DestinationIcon,
    DollarSignIcon,
    EventIcon,
    EventLocationIcon,
    EventOrganizerIcon,
    FileTextIcon,
    HomeIcon,
    ListIcon,
    LogsIcon,
    MailIcon,
    MapIcon,
    MetricsIcon,
    NewsletterIcon,
    NotificationIcon,
    OffersIcon,
    PermissionsIcon,
    PostIcon,
    PostSponsorIcon,
    PostSponsorshipIcon,
    PriceIcon,
    PromotionsIcon,
    ReceiptIcon,
    RefreshIcon,
    RolesIcon,
    SearchIcon,
    SettingsIcon,
    ShieldAlertIcon,
    ShieldIcon,
    StatisticsIcon,
    TagIcon,
    TagsIcon,
    UserIcon,
    UsersIcon,
    UsersManagementIcon,
    WebhookIcon
};

/**
 * Resolves an admin-nav icon name to its component.
 *
 * @param iconName - The icon component name from the IA config (e.g. "HomeIcon").
 * @returns The icon component, or `undefined` if the name is not registered.
 *
 * @example
 * ```tsx
 * const Icon = resolveNavIcon({ iconName: section.icon });
 * if (Icon) return <Icon size="md" aria-hidden="true" />;
 * ```
 */
export function resolveNavIcon({
    iconName
}: { readonly iconName: string }): ComponentType<IconProps> | undefined {
    return NAV_ICON_MAP[iconName];
}
