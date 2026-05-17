import type { ReactNode } from 'react';
import { Breadcrumbs, type EntityBreadcrumbContext } from './Breadcrumbs';

// Re-export the type for external use
export type { EntityBreadcrumbContext };

export type BasePageLayoutProps = {
    readonly title: string;
    readonly actions?: ReactNode;
    readonly children: ReactNode;
    readonly class?: string;
    /** Entity context for breadcrumb customization */
    readonly entityContext?: EntityBreadcrumbContext;
};

export const BasePageLayout = ({
    title,
    actions,
    children,
    class: className,
    entityContext
}: BasePageLayoutProps) => {
    return (
        <section className={`space-y-4 p-6${className ? ` ${className}` : ''}`}>
            <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                {title ? (
                    <h1 className="font-semibold text-2xl">{title}</h1>
                ) : (
                    <div
                        className="h-8"
                        aria-hidden="true"
                    />
                )}
                <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
            </header>
            <Breadcrumbs entityContext={entityContext} />
            <div className="pt-2">{children}</div>
        </section>
    );
};
