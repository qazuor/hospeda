import { BasePageLayout, type EntityBreadcrumbContext } from '@/components/layout/BasePageLayout';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { ReactNode } from 'react';

export type SidebarPageLayoutProps = {
    /** Direct title string */
    readonly title?: string;
    /** i18n key for the title (will be translated) */
    readonly titleKey?: TranslationKey;
    readonly actions?: ReactNode;
    readonly children: ReactNode;
    /** Entity context for breadcrumb customization */
    readonly entityContext?: EntityBreadcrumbContext;
};

export const SidebarPageLayout = ({
    title,
    titleKey,
    actions,
    children,
    entityContext
}: SidebarPageLayoutProps) => {
    const { t } = useTranslations();
    const displayTitle = titleKey ? t(titleKey) : (title ?? '');

    return (
        <BasePageLayout
            title={displayTitle}
            actions={actions}
            entityContext={entityContext}
        >
            {children}
        </BasePageLayout>
    );
};
