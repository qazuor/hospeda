/**
 * @file MakeWebhookExportPanel.tsx
 * @description Panel 2 — Make.com webhook export (HOS-67 G-6, T-008).
 *
 * Read-only display of `GET /api/v1/admin/social/make-webhook-schema`: the
 * outbound webhook URL, the auth header name + masked API key
 * (reveal-on-click), and copy-to-clipboard blocks for the payload/response
 * JSON Schemas. Shows a "not configured" state for `webhookUrl` / `makeApiKey`
 * when the vault has no value for those keys (`null`).
 */

import type { TranslationKey } from '@repo/i18n';
import { LoaderIcon } from '@repo/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { MakeWebhookSchemaResponse } from '../-hooks/use-integration-config';
import { CopyButton } from './CopyButton';
import { JsonCodeBlock } from './JsonCodeBlock';
import { MaskedSecretField } from './MaskedSecretField';

/** Props for {@link MakeWebhookExportPanel}. */
export interface MakeWebhookExportPanelProps {
    readonly data: MakeWebhookSchemaResponse | undefined;
    readonly isLoading: boolean;
    readonly error: unknown;
}

/** Panel showing the Make.com webhook config export. */
export function MakeWebhookExportPanel({ data, isLoading, error }: MakeWebhookExportPanelProps) {
    const { t } = useTranslations();

    return (
        <Card data-testid="make-webhook-export-panel">
            <CardHeader>
                <CardTitle>
                    {t('social.integrationConfig.makeWebhook.title' as TranslationKey)}
                </CardTitle>
                <CardDescription>
                    {t('social.integrationConfig.makeWebhook.description' as TranslationKey)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading && (
                    <div
                        className="flex items-center justify-center py-8"
                        data-testid="make-webhook-export-loading"
                    >
                        <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!isLoading && Boolean(error) && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                        data-testid="make-webhook-export-error"
                    >
                        {t('social.integrationConfig.makeWebhook.error' as TranslationKey)}
                    </p>
                )}

                {!isLoading && !error && data && (
                    <>
                        {/* Webhook URL */}
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                {t(
                                    'social.integrationConfig.makeWebhook.webhookUrlLabel' as TranslationKey
                                )}
                            </p>
                            {data.webhookUrl ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <code
                                        className="rounded bg-muted px-2 py-1 font-mono text-xs"
                                        data-testid="make-webhook-export-url-value"
                                    >
                                        {data.webhookUrl}
                                    </code>
                                    <CopyButton
                                        value={data.webhookUrl}
                                        testId="make-webhook-export-url-copy"
                                    />
                                </div>
                            ) : (
                                <p
                                    className="text-muted-foreground text-sm italic"
                                    data-testid="make-webhook-export-url-not-configured"
                                >
                                    {t(
                                        'social.integrationConfig.makeWebhook.notConfigured' as TranslationKey
                                    )}
                                </p>
                            )}
                        </div>

                        {/* Header name */}
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                {t(
                                    'social.integrationConfig.makeWebhook.headerNameLabel' as TranslationKey
                                )}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <code
                                    className="rounded bg-muted px-2 py-1 font-mono text-xs"
                                    data-testid="make-webhook-export-header-name-value"
                                >
                                    {data.headerName}
                                </code>
                                <CopyButton
                                    value={data.headerName}
                                    testId="make-webhook-export-header-name-copy"
                                />
                            </div>
                        </div>

                        {/* API key (masked, reveal-on-click) */}
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                {t(
                                    'social.integrationConfig.makeWebhook.apiKeyLabel' as TranslationKey
                                )}
                            </p>
                            {data.makeApiKey ? (
                                <MaskedSecretField
                                    value={data.makeApiKey}
                                    testId="make-webhook-export-api-key"
                                />
                            ) : (
                                <p
                                    className="text-muted-foreground text-sm italic"
                                    data-testid="make-webhook-export-api-key-not-configured"
                                >
                                    {t(
                                        'social.integrationConfig.makeWebhook.notConfigured' as TranslationKey
                                    )}
                                </p>
                            )}
                        </div>

                        {/* Payload schema */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">
                                    {t(
                                        'social.integrationConfig.makeWebhook.payloadSchemaLabel' as TranslationKey
                                    )}
                                </p>
                                <CopyButton
                                    value={JSON.stringify(data.payloadSchema, null, 2)}
                                    testId="make-webhook-export-payload-schema-copy"
                                />
                            </div>
                            <JsonCodeBlock
                                data={data.payloadSchema}
                                testId="make-webhook-export-payload-schema-json"
                            />
                        </div>

                        {/* Response schema */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">
                                    {t(
                                        'social.integrationConfig.makeWebhook.responseSchemaLabel' as TranslationKey
                                    )}
                                </p>
                                <CopyButton
                                    value={JSON.stringify(data.responseSchema, null, 2)}
                                    testId="make-webhook-export-response-schema-copy"
                                />
                            </div>
                            <JsonCodeBlock
                                data={data.responseSchema}
                                testId="make-webhook-export-response-schema-json"
                            />
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
