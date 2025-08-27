import { useTranslations } from '@/hooks/use-translations';
import { menuTree } from '@/lib/menu';
import { BreadcrumbsIcon } from '@repo/icons';
import { Link, useRouterState } from '@tanstack/react-router';

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

const getLabelForPath = (path: string, entityContext?: EntityBreadcrumbContext): string => {
    // Check if this is an entity detail path (contains an ID-like segment)
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    // If we have entity context and this looks like an entity ID path
    if (entityContext && lastSegment && isEntityId(lastSegment)) {
        // Use entity name if available, otherwise use slug
        return entityContext.name || entityContext.slug || lastSegment;
    }

    // Check menu tree for predefined labels
    for (const item of menuTree) {
        if (item.to === path && item.title) return item.title;
        if (item.children) {
            for (const child of item.children) {
                if (child.to === path && child.title) return child.title;
            }
        }
    }

    // Default: capitalize the last segment
    const seg = path.split('/').filter(Boolean).pop() ?? '';
    return seg.charAt(0).toUpperCase() + seg.slice(1);
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

export const Breadcrumbs = ({ entityContext }: BreadcrumbsProps = {}) => {
    const { t } = useTranslations();
    const { location } = useRouterState();
    // Use pathname instead of href to exclude query parameters
    const segments = location.pathname.split('/').filter(Boolean);
    const paths: string[] = [];
    segments.forEach((_, idx) => {
        paths.push(`/${segments.slice(0, idx + 1).join('/')}`);
    });

    return (
        <nav
            aria-label={t('ui.accessibility.breadcrumb')}
            className="flex items-center text-muted-foreground text-sm"
        >
            <Link
                to="/dashboard"
                className="hover:underline"
            >
                {t('ui.navigation.home')}
            </Link>
            {paths.map((p) => (
                <span
                    key={p}
                    className="inline-flex items-center"
                >
                    <BreadcrumbsIcon className="mx-2 h-4 w-4" />
                    <Link
                        to={p}
                        className="hover:underline"
                    >
                        {getLabelForPath(p, entityContext)}
                    </Link>
                </span>
            ))}
        </nav>
    );
};
