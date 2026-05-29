/**
 * Mi facturación landing page (SPEC-156 PR-4 T-033).
 *
 * Per spec §3 IN.New admin pages, this is the HOST-facing entry point to
 * subscription + usage + payment-related actions. The page hosts three
 * sections delivered by sibling tasks:
 *
 *   - SubscriptionSummarySection (T-034)
 *   - PlanUsageSection (T-036)
 *   - BillingActionsSection (T-037)
 *
 * Permission gate (AC-23): the route is only accessible to actors who hold
 * BOTH `BILLING_VIEW_OWN` and `SUBSCRIPTION_VIEW_OWN` — the two new
 * permissions seeded in PR-1 (T-007) on every paying role + admin tiers.
 * `EDITOR` is intentionally excluded, since the editor role bundle does not
 * receive either permission.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/account/billing')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: TanStack Router's context type can't infer the
        // dynamically-loaded `permissions` field populated by the parent
        // `_authed` beforeLoad; the cast restores the AuthState shape.
        const authState = context as unknown as AuthState;

        const hasViewPermission =
            authState.permissions?.includes(PermissionEnum.BILLING_VIEW_OWN) &&
            authState.permissions?.includes(PermissionEnum.SUBSCRIPTION_VIEW_OWN);

        if (!hasViewPermission) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: BillingLandingPage
});

function BillingLandingPage() {
    const { t } = useTranslations();

    return (
        <MainPageLayout title={t('admin-pages.billing.title')}>
            <div className="mx-auto max-w-4xl space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">{t('admin-pages.billing.title')}</h2>
                    <p className="text-muted-foreground">{t('admin-pages.billing.subtitle')}</p>
                </div>

                {/*
                  Sections land in their own tasks:
                    Section 1 — T-034 SubscriptionSummarySection
                    Section 2 — T-036 PlanUsageSection (uses T-035 UsageProgressBar)
                    Section 3 — T-037 BillingActionsSection
                */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {t('admin-pages.billing.subscription.title')}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.billing.subscription.subtitle')}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-common.comingSoon.description')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {t('admin-pages.billing.usage.title')}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.billing.usage.subtitle')}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-common.comingSoon.description')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {t('admin-pages.billing.actions.title')}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.billing.actions.subtitle')}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-common.comingSoon.description')}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </MainPageLayout>
    );
}
