/**
 * @file WebhookAlert.tsx
 * @description Prominent warning banner shown when the Make webhook URL is not
 * configured (SPEC-254 T-041).
 *
 * Rendered only when `makeWebhookConfigured` is false.
 * Links to the social settings page where the admin can configure the webhook.
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';

/**
 * Warning banner indicating the Make webhook URL is missing.
 * Renders nothing when the webhook is already configured.
 */
export function WebhookAlert() {
    const { t } = useTranslations();

    return (
        <div
            className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4"
            role="alert"
            data-testid="webhook-alert"
        >
            <div className="flex-1 space-y-1">
                <p className="font-semibold text-destructive text-sm">
                    {t('social.dashboard.webhookAlert.title' as TranslationKey)}
                </p>
                <p className="text-muted-foreground text-sm">
                    {t('social.dashboard.webhookAlert.description' as TranslationKey)}
                </p>
            </div>
            <span
                className="shrink-0 rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground text-xs"
                data-testid="webhook-alert-configure-link"
            >
                {t('social.dashboard.webhookAlert.configure' as TranslationKey)}
            </span>
        </div>
    );
}
