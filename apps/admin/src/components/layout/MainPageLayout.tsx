import { BasePageLayout } from '@/components/layout/BasePageLayout';
import type { ReactNode } from 'react';

export type MainPageLayoutProps = {
    readonly title: string;
    readonly actions?: ReactNode;
    readonly children: ReactNode;
};

export const MainPageLayout = ({ title, actions, children }: MainPageLayoutProps) => {
    return (
        <BasePageLayout
            title={title}
            actions={actions}
            class="pl-20"
        >
            {children}
        </BasePageLayout>
    );
};
