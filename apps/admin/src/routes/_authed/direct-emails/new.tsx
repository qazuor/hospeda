/**
 * @file _authed/direct-emails/new.tsx
 * @description Compose screen for a new direct email (HOS-2685).
 * Permission: DIRECT_EMAIL_SEND.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { ComposeForm } from './-components/ComposeForm';
import { requireDirectEmailPermission } from './-components/direct-email-route-guard';

export const Route = createFileRoute('/_authed/direct-emails/new')({
    beforeLoad: requireDirectEmailPermission({ permission: PermissionEnum.DIRECT_EMAIL_SEND }),
    component: NewDirectEmailPage
});

function NewDirectEmailPage() {
    const { t } = useTranslations();
    return (
        <SidebarPageLayout
            titleKey="admin-direct-email.compose.title"
            actions={
                <Button
                    asChild
                    variant="outline"
                >
                    <Link to="/direct-emails">{t('admin-direct-email.compose.backToList')}</Link>
                </Button>
            }
        >
            <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    {t('admin-direct-email.compose.subtitle')}
                </p>
                <ComposeForm />
            </div>
        </SidebarPageLayout>
    );
}
