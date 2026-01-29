/**
 * PageTabs Component
 *
 * Horizontal tab navigation for entity detail pages (Level 3 navigation).
 * Uses URL-based navigation for state persistence.
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TabConfig } from '@/lib/sections/types';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { Link, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface PageTabsProps {
    /** Tab configurations */
    tabs: TabConfig[];
    /** Base path for resolving relative tab hrefs */
    basePath?: string;
    /** Additional CSS classes for the container */
    className?: string;
}

/**
 * PageTabs renders a horizontal tab bar for sub-navigation within pages.
 * Each tab is a link that updates the URL.
 */
export function PageTabs({ tabs, basePath, className }: PageTabsProps) {
    const { t } = useTranslations();
    const location = useLocation();
    const currentPath = location.pathname;

    return (
        <div
            className={cn(
                'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent mb-6 overflow-x-auto border-b',
                className
            )}
            role="tablist"
            aria-label="Page sections"
        >
            <nav className="flex min-w-max gap-4">
                {tabs.map((tab) => {
                    const displayLabel = tab.labelKey
                        ? t(tab.labelKey as TranslationKey)
                        : tab.label;
                    const href = basePath ? `${basePath}${tab.href}` : tab.href;
                    const isActive = currentPath === href;

                    return (
                        <PageTab
                            key={tab.id}
                            id={tab.id}
                            label={displayLabel}
                            href={href}
                            icon={tab.icon}
                            isActive={isActive}
                        />
                    );
                })}
            </nav>
        </div>
    );
}

interface PageTabProps {
    id: string;
    label: string;
    href: string;
    icon?: ReactNode;
    isActive: boolean;
}

function PageTab({ id, label, href, icon, isActive }: PageTabProps) {
    return (
        <Link
            to={href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            data-tab-id={id}
            className={cn(
                'relative flex items-center gap-2 whitespace-nowrap px-1 py-3 font-medium text-sm transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                // Active indicator line
                'after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:transition-colors',
                isActive ? 'after:bg-primary' : 'after:bg-transparent hover:after:bg-border'
            )}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span>{label}</span>
        </Link>
    );
}

/**
 * Pre-defined tab configurations for common entities
 */

export const accommodationTabs: TabConfig[] = [
    { id: 'overview', label: 'General', labelKey: 'admin-tabs.overview', href: '' },
    { id: 'gallery', label: 'Galería', labelKey: 'admin-tabs.gallery', href: '/gallery' },
    { id: 'amenities', label: 'Amenidades', labelKey: 'admin-tabs.amenities', href: '/amenities' },
    { id: 'reviews', label: 'Reseñas', labelKey: 'admin-tabs.reviews', href: '/reviews' },
    { id: 'pricing', label: 'Precios', labelKey: 'admin-tabs.pricing', href: '/pricing' }
];

export const destinationTabs: TabConfig[] = [
    { id: 'overview', label: 'General', labelKey: 'admin-tabs.overview', href: '' },
    {
        id: 'attractions',
        label: 'Atracciones',
        labelKey: 'admin-tabs.attractions',
        href: '/attractions'
    },
    {
        id: 'accommodations',
        label: 'Alojamientos',
        labelKey: 'admin-tabs.accommodations',
        href: '/accommodations'
    },
    { id: 'events', label: 'Eventos', labelKey: 'admin-tabs.events', href: '/events' }
];

export const userTabs: TabConfig[] = [
    { id: 'profile', label: 'Perfil', labelKey: 'admin-tabs.profile', href: '' },
    {
        id: 'permissions',
        label: 'Permisos',
        labelKey: 'admin-tabs.permissions',
        href: '/permissions'
    },
    { id: 'activity', label: 'Actividad', labelKey: 'admin-tabs.activity', href: '/activity' }
];

export const eventTabs: TabConfig[] = [
    { id: 'overview', label: 'General', labelKey: 'admin-tabs.overview', href: '' },
    { id: 'tickets', label: 'Entradas', labelKey: 'admin-tabs.tickets', href: '/tickets' },
    { id: 'attendees', label: 'Asistentes', labelKey: 'admin-tabs.attendees', href: '/attendees' }
];

export const postTabs: TabConfig[] = [
    { id: 'content', label: 'Contenido', labelKey: 'admin-tabs.content', href: '' },
    { id: 'seo', label: 'SEO', labelKey: 'admin-tabs.seo', href: '/seo' },
    {
        id: 'sponsorship',
        label: 'Patrocinio',
        labelKey: 'admin-tabs.sponsorship',
        href: '/sponsorship'
    }
];

export const eventLocationTabs: TabConfig[] = [
    { id: 'overview', label: 'General', labelKey: 'admin-tabs.overview', href: '' },
    { id: 'events', label: 'Eventos', labelKey: 'admin-tabs.events', href: '/events' }
];

export const eventOrganizerTabs: TabConfig[] = [
    { id: 'overview', label: 'General', labelKey: 'admin-tabs.overview', href: '' },
    { id: 'events', label: 'Eventos', labelKey: 'admin-tabs.events', href: '/events' },
    { id: 'contact', label: 'Contacto', labelKey: 'admin-tabs.contact', href: '/contact' }
];
