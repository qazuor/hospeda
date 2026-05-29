/**
 * BillingActionsSection — Section 3 of Mi facturación (SPEC-156 T-037).
 *
 * Renders the operator-facing CTAs:
 *
 *   - Manage subscription — deep link to the web app's billing area at
 *     `${VITE_SITE_URL}/{locale}/mi-cuenta/suscripcion`. The web URL is
 *     intentionally kept Spanish-slug since `apps/web` is the user-facing
 *     locale-aware app (admin URL convention is English).
 *   - Download latest invoice — renders only when `useMyLatestInvoice`
 *     returns a row whose `pdfUrl` is present. Otherwise an info note tells
 *     the user there is nothing to download yet.
 *
 * No write actions live in V1 (see spec §3 OUT — cancel/plan-change/etc.
 * are deferred to a future PR + the web app handles them today).
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/env';
import { useMyLatestInvoice } from '@/hooks/use-my-billing';
import { useTranslations } from '@/hooks/use-translations';
import { ExternalLinkIcon, FileTextIcon } from '@repo/icons';

const WEB_BILLING_PATH_BY_LOCALE: Record<string, string> = {
    es: '/es/mi-cuenta/suscripcion',
    en: '/en/mi-cuenta/suscripcion',
    pt: '/pt/mi-cuenta/suscripcion'
};

/**
 * Build the deep-link URL to the web app's billing area for the current
 * locale. Falls back to the Spanish path when the locale is unrecognized so
 * the link always lands somewhere useful.
 */
export function buildWebBillingUrl(siteUrl: string, locale: string): string {
    const path = WEB_BILLING_PATH_BY_LOCALE[locale] ?? WEB_BILLING_PATH_BY_LOCALE.es;
    const trimmed = siteUrl.replace(/\/$/, '');
    return `${trimmed}${path}`;
}

export function BillingActionsSection() {
    const { t, locale } = useTranslations();
    const invoiceQuery = useMyLatestInvoice();
    const latestInvoicePdf = invoiceQuery.data?.pdfUrl ?? null;
    const manageUrl = buildWebBillingUrl(env.VITE_SITE_URL, locale);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('admin-pages.billing.actions.title')}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.billing.actions.subtitle')}
                </p>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium text-sm">
                                {t('admin-pages.billing.actions.manageSubscription')}
                            </p>
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.billing.actions.manageSubscriptionHint')}
                            </p>
                        </div>
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            data-testid="manage-subscription-link"
                        >
                            <a
                                href={manageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                                {t('admin-pages.billing.actions.manageSubscription')}
                            </a>
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <FileTextIcon className="h-5 w-5 text-muted-foreground" />
                            <p className="font-medium text-sm">
                                {t('admin-pages.billing.actions.downloadLatestInvoice')}
                            </p>
                        </div>
                        {latestInvoicePdf ? (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                data-testid="download-invoice-link"
                            >
                                <a
                                    href={latestInvoicePdf}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t('admin-pages.billing.actions.downloadLatestInvoice')}
                                </a>
                            </Button>
                        ) : (
                            <p
                                className="text-muted-foreground text-xs italic"
                                data-testid="no-latest-invoice"
                            >
                                {t('admin-pages.billing.actions.noLatestInvoice')}
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
