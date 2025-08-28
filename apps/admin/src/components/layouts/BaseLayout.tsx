/**
 * @file Base Layout Component
 *
 * This component provides the foundational layout structure for the admin application with:
 * - Consistent header and navigation
 * - Error boundary integration
 * - Accessibility features
 * - Responsive design
 */

import { RouteErrorBoundary } from '@/components/error-boundaries';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import type { ReactNode } from 'react';

/**
 * Base Layout Props
 */
type BaseLayoutProps = {
    readonly children: ReactNode;
    readonly title?: string;
    readonly description?: string;
    readonly showSidebar?: boolean;
    readonly sidebarCollapsed?: boolean;
    readonly breadcrumbs?: readonly {
        readonly label: string;
        readonly href?: string;
    }[];
    readonly actions?: ReactNode;
    readonly className?: string;
};

/**
 * Base Layout Component
 *
 * Provides the foundational layout structure with error boundaries and consistent styling.
 *
 * @example
 * ```tsx
 * <BaseLayout
 *   title="Accommodations"
 *   breadcrumbs={[
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Accommodations' }
 *   ]}
 *   actions={<Button>Add New</Button>}
 * >
 *   <AccommodationsList />
 * </BaseLayout>
 * ```
 */
export const BaseLayout = ({
    children,
    title,
    description,
    showSidebar = true,
    breadcrumbs,
    actions,
    className
}: BaseLayoutProps) => {
    const content = (
        <div className={className}>
            {/* Page Header */}
            {(title || breadcrumbs || actions) && (
                <div className="mb-6 border-gray-200 border-b pb-4">
                    {/* Breadcrumbs */}
                    {breadcrumbs && breadcrumbs.length > 0 && (
                        <nav
                            className="mb-2"
                            aria-label="Breadcrumb"
                        >
                            <ol className="flex items-center space-x-2 text-gray-500 text-sm">
                                {breadcrumbs.map((crumb, index) => (
                                    <li
                                        key={`${crumb.label}-${index}`}
                                        className="flex items-center"
                                    >
                                        {index > 0 && <span className="mx-2 text-gray-300">/</span>}
                                        {crumb.href ? (
                                            <a
                                                href={crumb.href}
                                                className="rounded hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                            >
                                                {crumb.label}
                                            </a>
                                        ) : (
                                            <span className="font-medium text-gray-900">
                                                {crumb.label}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    )}

                    {/* Title and Actions */}
                    <div className="flex items-center justify-between">
                        <div>
                            {title && <h1 className="font-bold text-2xl text-gray-900">{title}</h1>}
                            {description && (
                                <p className="mt-1 text-gray-600 text-sm">{description}</p>
                            )}
                        </div>

                        {actions && <div className="flex items-center space-x-3">{actions}</div>}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1">{children}</main>
        </div>
    );

    // Wrap with error boundary
    const wrappedContent = <RouteErrorBoundary>{content}</RouteErrorBoundary>;

    // Use existing SidebarPageLayout if sidebar is enabled
    if (showSidebar) {
        return <SidebarPageLayout title={title || 'Admin'}>{wrappedContent}</SidebarPageLayout>;
    }

    // Return content without sidebar
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{wrappedContent}</div>
        </div>
    );
};
