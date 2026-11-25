import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** A full-trail level, excluding home; the current page must be last. */
export interface BreadcrumbInputItem {
    /** Translated short label, or the current entity's name. */
    readonly label: string;
    /** Path after the locale prefix. Pathless ancestors are omitted. */
    readonly path?: string;
}

/** A linked ancestor ready to render. */
export interface BreadcrumbTrailEntry {
    readonly label: string;
    readonly href: string;
}

interface BreadcrumbTrailInput {
    readonly items: readonly BreadcrumbInputItem[];
    readonly locale: SupportedLocale;
    readonly homeLabel: string;
    readonly includeHome?: boolean;
}

/** Build linked ancestors only; home alone does not constitute a visible trail. */
export function buildBreadcrumbTrail({
    items,
    locale,
    homeLabel,
    includeHome = true
}: BreadcrumbTrailInput): { readonly entries: readonly BreadcrumbTrailEntry[] } {
    const ancestors = items
        .slice(0, -1)
        .flatMap((item) =>
            item.path === undefined
                ? []
                : [{ label: item.label, href: buildUrl({ locale, path: item.path }) }]
        );
    return {
        entries:
            ancestors.length === 0
                ? []
                : [
                      ...(includeHome ? [{ label: homeLabel, href: buildUrl({ locale }) }] : []),
                      ...ancestors
                  ]
    };
}

/** Build structured data from the same ancestors, followed by the canonical current page. */
export function buildBreadcrumbListJsonLd({
    items,
    locale,
    homeLabel,
    siteOrigin,
    currentPath,
    includeHome = true
}: BreadcrumbTrailInput & { readonly siteOrigin: string; readonly currentPath: string }) {
    const origin = siteOrigin.replace(/\/$/, '');
    const ancestors = items
        .slice(0, -1)
        .flatMap((item) =>
            item.path === undefined
                ? []
                : [{ label: item.label, href: buildUrl({ locale, path: item.path }) }]
        );
    const current = items.at(-1);
    const entries = [
        ...(includeHome ? [{ label: homeLabel, href: buildUrl({ locale }) }] : []),
        ...ancestors,
        ...(current ? [{ label: current.label, href: currentPath }] : [])
    ];
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: entries.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.label,
            item: `${origin}${entry.href}`
        }))
    };
}

/** Serialize JSON-LD with the HTML-unsafe character escaping used by JsonLd.astro. */
export function serializeJsonLd(data: Record<string, unknown>): string {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}
