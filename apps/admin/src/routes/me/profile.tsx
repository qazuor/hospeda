import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

const MyProfilePage = () => {
    const { t } = useTranslations();

    return (
        <MainPageLayout title={t('ui.pages.myProfile')}>
            <div>{t('ui.pages.todoAddContent')}</div>
        </MainPageLayout>
    );
};

export const Route = createFileRoute('/me/profile')({
    component: MyProfilePage
});
