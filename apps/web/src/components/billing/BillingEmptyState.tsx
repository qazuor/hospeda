/**
 * BillingEmptyState Component
 *
 * Reusable empty state component for billing sections when no data is available.
 * Displays a centered message with an optional icon and call-to-action.
 *
 * @module components/billing/BillingEmptyState
 */

import type { ReactNode } from 'react';

/**
 * Props for the BillingEmptyState component
 */
export interface BillingEmptyStateProps {
    /**
     * Main title for the empty state
     * @example "No hay facturas"
     */
    title: string;

    /**
     * Secondary description text
     * @example "Tus facturas aparecerán aquí"
     */
    description: string;

    /**
     * Optional custom icon to display
     * If not provided, a default inbox icon will be shown
     */
    icon?: ReactNode;

    /**
     * Optional call-to-action button configuration
     * @example { label: "Ver planes", href: "/precios" }
     */
    action?: {
        label: string;
        href: string;
    };
}

/**
 * Default inbox icon SVG
 * Inline SVG to avoid external dependencies
 */
function InboxIcon(): ReactNode {
    return (
        <svg
            className="h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <title>Inbox</title>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
        </svg>
    );
}

/**
 * BillingEmptyState Component
 *
 * Renders a centered empty state message for billing sections.
 * Used when there is no data to display (e.g., no invoices, no transactions).
 *
 * Visual design:
 * - Centered layout with icon at top
 * - Title and description text
 * - Optional call-to-action button
 * - Subtle gray color scheme
 *
 * Accessibility:
 * - Uses semantic HTML
 * - Proper heading hierarchy
 * - Keyboard navigable action button
 * - Descriptive role for screen readers
 *
 * @param props - Component props
 * @returns React element displaying empty state UI
 *
 * @example
 * ```tsx
 * import { BillingEmptyState } from '@/components/billing';
 *
 * <BillingEmptyState
 *   title="No hay facturas"
 *   description="Tus facturas aparecerán aquí cuando realices un pago"
 *   action={{
 *     label: "Ver planes",
 *     href: "/precios/propietarios"
 *   }}
 * />
 * ```
 */
export function BillingEmptyState({ title, description, icon, action }: BillingEmptyStateProps) {
    return (
        <output
            className="flex flex-col items-center justify-center px-6 py-12 text-center"
            aria-label={title}
        >
            {/* Icon */}
            <div className="mb-4">{icon || <InboxIcon />}</div>

            {/* Title */}
            <h3 className="mb-2 font-semibold text-gray-900 text-xl">{title}</h3>

            {/* Description */}
            <p className="mb-6 max-w-md text-gray-600">{description}</p>

            {/* Optional action button */}
            {action && (
                <a
                    href={action.href}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={action.label}
                >
                    {action.label}
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                    </svg>
                </a>
            )}
        </output>
    );
}
