import { cn } from '@/lib/utils';
import { useTranslations } from '@repo/i18n';
import { ChevronDownIcon } from '@repo/icons';
import type * as React from 'react';

/**
 * Props for FormSidebarLayout component.
 */
export interface FormSidebarLayoutProps {
    /**
     * Navigation node rendered as the sidebar (desktop) or inside the
     * collapsible accordion (mobile). Typically a `<SmartNavigation>` element.
     */
    readonly sidebar: React.ReactNode;
    /**
     * Main form content area.
     */
    readonly children: React.ReactNode;
    /**
     * Whether the mobile accordion should start expanded.
     * Set this to true when the form has validation errors so the user
     * can immediately see which sections need attention.
     */
    readonly defaultMobileOpen?: boolean;
    /**
     * Optional className for the outer wrapper.
     */
    readonly className?: string;
}

/**
 * Responsive layout shell for multi-section entity forms.
 *
 * - Below the `lg` breakpoint (1024px), the sidebar collapses into a top
 *   `<details>` accordion so the form fields take the full viewport width.
 *   This makes CREATE and EDIT pages usable on mobile (F-020).
 * - At `lg` and above the sidebar renders as the previous fixed-width column
 *   so desktop UX is preserved.
 *
 * Uses native `<details>` instead of the Radix Accordion so the accordion is
 * accessible without JavaScript and zero-cost to render on the server.
 */
export const FormSidebarLayout: React.FC<FormSidebarLayoutProps> = ({
    sidebar,
    children,
    defaultMobileOpen = false,
    className
}) => {
    const { t } = useTranslations();

    return (
        <div className={cn('flex flex-col gap-6 lg:flex-row', className)}>
            {/* Mobile accordion — visible only below lg */}
            <details
                className="group rounded-lg border border-border bg-card shadow-sm lg:hidden"
                open={defaultMobileOpen}
                data-testid="form-sidebar-mobile-accordion"
            >
                <summary
                    className={cn(
                        'flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium text-foreground text-sm',
                        'marker:hidden [&::-webkit-details-marker]:hidden'
                    )}
                >
                    <span>{t('ui.navigation.formProgress')}</span>
                    <ChevronDownIcon
                        className="h-4 w-4 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                    />
                </summary>
                <div className="border-border border-t p-2">{sidebar}</div>
            </details>

            {/* Desktop sidebar — visible at lg and above */}
            <div
                className="hidden w-80 flex-shrink-0 lg:block"
                data-testid="form-sidebar-desktop"
            >
                {sidebar}
            </div>

            {/* Content area */}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
};

FormSidebarLayout.displayName = 'FormSidebarLayout';
