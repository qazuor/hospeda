import { BasePageLayout } from '@/components/layout/BasePageLayout';
import type { ReactNode } from 'react';

export type SidebarPageLayoutProps = {
    readonly title: string;
    readonly actions?: ReactNode;
    readonly children: ReactNode;
};

export const SidebarPageLayout = ({ title, actions, children }: SidebarPageLayoutProps) => {
    return (
        <BasePageLayout
            title={title}
            actions={actions}
        >
            {children}
        </BasePageLayout>
    );
};
