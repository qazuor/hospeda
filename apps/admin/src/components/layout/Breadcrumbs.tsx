import type { TranslationKey } from '@repo/i18n';
import { BreadcrumbsIcon } from '@repo/icons';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { useTranslations } from '@/hooks/use-translations';
import {
    breadcrumbLabels,
    breadcrumbRoutePatternLabels,
    breadcrumbSegmentLabels
} from '@/lib/breadcrumb-labels';
import { getRoutePaths, isRegisteredPath, matchesRoutePattern } from '@/lib/breadcrumb-routes';
import { menuTree } from '@/lib/menu';
import { adminLogger } from '@/utils/logger';

/**
 * Entity context for breadcrumb customization
 */
export type EntityBreadcrumbContext = {
    /** Entity slug to display instead of ID */
    slug?: string;
    /** Entity name to display */
    name?: string;
    /** Entity type (e.g., 'accommodation', 'destination') */
    type?: string;
};

type LabelResult = { type: 'i18n'; key: string } | { type: 'text'; value: string };

const warnedSegments = new Set<string>();

const getLabelForPath = (path: string, entityContext?: EntityBreadcrumbContext): LabelResult => {
    // Check if this is an entity detail path (contains an ID-like segment)
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    // If we have entity context and this looks like an entity ID path
    if (entityContext && lastSegment && isEntityId(lastSegment)) {
        // Use entity name if available, otherwise use slug
        const name = entityContext.name?.trim() || entityContext.slug?.trim();
        if (name) return { type: 'text', value: name };
    }

    // Check menu tree for predefined labels (returns titleKey for translation)
    for (const item of menuTree) {
        if (item.to === path && item.titleKey) return { type: 'i18n', key: item.titleKey };
        if (item.children) {
            for (const child of item.children) {
                if (child.to === path && child.titleKey)
                    return { type: 'i18n', key: child.titleKey };
            }
        }
    }

    // Fallback to the path-keyed breadcrumb label map for routes that are
    // sub-pages of a section and not surfaced in the main nav.
    if (breadcrumbLabels[path]) {
        return { type: 'i18n', key: breadcrumbLabels[path] };
    }

    // Fallback to route patterns whose last segment is a dynamic id (e.g.
    // `/billing/subscriptions/<uuid>` shows «Suscripción», not the uuid).
    for (const [pattern, key] of Object.entries(breadcrumbRoutePatternLabels)) {
        if (matchesRoutePattern({ path, pattern })) {
            return { type: 'i18n', key };
        }
    }

    if (lastSegment && isEntityId(lastSegment)) {
        return { type: 'i18n', key: 'ui.navigation.detail' };
    }

    // Fallback to the trailing-segment dictionary (e.g. nested routes like
    // `/accommodations/<id>/amenities` where only the suffix is translatable).
    const seg = path.split('/').filter(Boolean).pop() ?? '';
    if (breadcrumbSegmentLabels[seg]) {
        return { type: 'i18n', key: breadcrumbSegmentLabels[seg] };
    }

    if (import.meta.env.DEV && !warnedSegments.has(seg)) {
        warnedSegments.add(seg);
        adminLogger.warn('Missing breadcrumb label for segment', { segment: seg });
    }

    // Preserve the existing fallback while making missing labels visible in development.
    return { type: 'text', value: seg.charAt(0).toUpperCase() + seg.slice(1) };
};

/**
 * Check if a segment looks like an entity ID (UUID-like or numeric)
 */
const isEntityId = (segment: string): boolean => {
    // Check for UUID pattern (8-4-4-4-12 characters)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Check for numeric ID
    const numericPattern = /^\d+$/;
    // Check for MongoDB ObjectId pattern (24 hex characters)
    const objectIdPattern = /^[0-9a-f]{24}$/i;

    return (
        uuidPattern.test(segment) || numericPattern.test(segment) || objectIdPattern.test(segment)
    );
};

type BreadcrumbsProps = {
    /** Entity context for customizing breadcrumb labels */
    entityContext?: EntityBreadcrumbContext;
};

/** Render the route hierarchy with a non-linked current page. */
export const Breadcrumbs = ({ entityContext }: BreadcrumbsProps = {}) => {
    const { t } = useTranslations();
    const { location } = useRouterState();
    const router = useRouter();
    const routePaths = getRoutePaths({ router });
    // Use pathname instead of href to exclude query parameters
    const segments = location.pathname.split('/').filter(Boolean);
    const paths: string[] = [];
    segments.forEach((_, idx) => {
        paths.push(`/${segments.slice(0, idx + 1).join('/')}`);
    });

    return (
        <nav
            aria-label={t('ui.accessibility.breadcrumb')}
            className="min-w-0 truncate text-muted-foreground text-sm"
        >
            <ol className="flex min-w-0 flex-nowrap items-center truncate">
                <li className="min-w-0 truncate">
                    {paths.length === 0 ? (
                        <span
                            aria-current="page"
                            className="block max-w-[24ch] truncate"
                            title={t('ui.navigation.home')}
                        >
                            {t('ui.navigation.home')}
                        </span>
                    ) : (
                        <Link
                            to="/dashboard"
                            className="block max-w-[24ch] truncate hover:underline"
                            title={t('ui.navigation.home')}
                        >
                            {t('ui.navigation.home')}
                        </Link>
                    )}
                </li>
                {paths.map((p, index) => {
                    const label = getLabelForPath(p, entityContext);
                    const displayText =
                        label.type === 'i18n' ? t(label.key as TranslationKey) : label.value;
                    const registered = isRegisteredPath({ path: p, routePaths });
                    const isLast = index === paths.length - 1;
                    return (
                        <li
                            key={p}
                            className="flex min-w-0 items-center truncate"
                        >
                            <BreadcrumbsIcon
                                aria-hidden="true"
                                className="mx-2 h-4 w-4 shrink-0"
                            />
                            {registered && !isLast ? (
                                <Link
                                    to={p}
                                    className="max-w-[24ch] truncate hover:underline"
                                    title={displayText}
                                >
                                    {displayText}
                                </Link>
                            ) : (
                                <span
                                    aria-current={isLast ? 'page' : undefined}
                                    className="max-w-[24ch] truncate text-muted-foreground"
                                    title={displayText}
                                >
                                    {displayText}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};
