import { BasePageLayout, type EntityBreadcrumbContext } from '@/components/layout/BasePageLayout';
import type { ReactNode } from 'react';

export type SidebarPageLayoutProps = {
    readonly title: string;
    readonly actions?: ReactNode;
    readonly children: ReactNode;
    /** Entity context for breadcrumb customization */
    readonly entityContext?: EntityBreadcrumbContext;
};

export const SidebarPageLayout = ({
    title,
    actions,
    children,
    entityContext
}: SidebarPageLayoutProps) => {
    return (
        <BasePageLayout
            title={title}
            actions={actions}
            entityContext={entityContext}
        >
            {children}
        </BasePageLayout>
    );
};
