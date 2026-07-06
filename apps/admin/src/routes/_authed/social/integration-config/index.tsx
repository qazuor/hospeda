/**
 * @file _authed/social/integration-config/index.tsx
 * @description Admin "Integration Config Export" page (HOS-67 G-6, T-008).
 *
 * Two read-only panels the operator uses to copy config into external tools:
 * - GPT Action: OpenAPI 3.1 document for the Custom GPT Actions config.
 * - Make.com webhook: dispatch payload/response JSON Schemas + webhook URL +
 *   masked API key + outbound header name.
 *
 * Permission guard: SOCIAL_SETTINGS_MANAGE (same gate as sibling
 * `_authed/social/settings` and `_authed/social/credentials` pages — both
 * underlying endpoints are admin-session + SOCIAL_SETTINGS_MANAGE gated).
 */

import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { GptActionExportPanel } from './-components/GptActionExportPanel';
import { MakeWebhookExportPanel } from './-components/MakeWebhookExportPanel';
import {
    useGptActionSchemaQuery,
    useMakeWebhookSchemaQuery
} from './-hooks/use-integration-config';

export const Route = createFileRoute('/_authed/social/integration-config/')({
    component: IntegrationConfigExportPage,
    errorComponent: createErrorComponent('IntegrationConfigExport'),
    pendingComponent: createPendingComponent()
});

/** Admin "Integration Config Export" page. */
function IntegrationConfigExportPage() {
    const { t } = useTranslations();
    const gptActionQuery = useGptActionSchemaQuery();
    const makeWebhookQuery = useMakeWebhookSchemaQuery();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_SETTINGS_MANAGE]}>
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="mb-2 font-bold text-2xl">
                        {t('social.integrationConfig.title' as TranslationKey)}
                    </h1>
                    <p className="text-muted-foreground">
                        {t('social.integrationConfig.description' as TranslationKey)}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <GptActionExportPanel
                        data={gptActionQuery.data}
                        isLoading={gptActionQuery.isLoading}
                        error={gptActionQuery.error}
                    />
                    <MakeWebhookExportPanel
                        data={makeWebhookQuery.data}
                        isLoading={makeWebhookQuery.isLoading}
                        error={makeWebhookQuery.error}
                    />
                </div>
            </div>
        </RoutePermissionGuard>
    );
}
