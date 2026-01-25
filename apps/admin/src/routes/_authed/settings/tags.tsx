import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/settings/tags')({
    component: TagsSettingsPage
});

function TagsSettingsPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.settingsTags">
            <div>{t('ui.pages.todoAddContent')}</div>
        </SidebarPageLayout>
    );
}
