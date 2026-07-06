/**
 * @file MakeWebhookExportPanel.tsx
 * @description Panel 2 — Make.com webhook export (HOS-67 G-6, T-008).
 *
 * Read-only display of `GET /api/v1/admin/social/make-webhook-schema`: the
 * outbound webhook URL and API key (both vault secrets — masked with
 * reveal-on-click), the auth header name, and copy-to-clipboard blocks for the
 * payload/response JSON Schemas. Each credential renders one of three states
 * from its vault resolution status: the masked value (`ok`), a "not configured"
 * note (`missing`), or an error note (`error` — vault read/decrypt failure),
 * so a vault error is never shown as a misleading "not configured".
 */

import type { TranslationKey } from '@repo/i18n';
import { LoaderIcon } from '@repo/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { CredentialField, MakeWebhookSchemaResponse } from '../-hooks/use-integration-config';
import { CopyButton } from './CopyButton';
import { JsonCodeBlock } from './JsonCodeBlock';
import { MaskedSecretField } from './MaskedSecretField';

/** Props for {@link MakeWebhookExportPanel}. */
export interface MakeWebhookExportPanelProps {
    readonly data: MakeWebhookSchemaResponse | undefined;
    readonly isLoading: boolean;
    readonly error: unknown;
}

/** Props for {@link CredentialFieldDisplay}. */
interface CredentialFieldDisplayProps {
    readonly field: CredentialField;
    /** `data-testid` prefix for the masked value / not-configured / error nodes. */
    readonly testId: string;
}

/**
 * Renders a vault-backed credential in one of its three resolution states:
 * masked value (`ok`), "not configured" (`missing`), or an error note (`error`).
 */
function CredentialFieldDisplay({ field, testId }: CredentialFieldDisplayProps) {
    const { t } = useTranslations();

    if (field.status === 'ok' && field.value !== null) {
        return (
            <MaskedSecretField
                value={field.value}
                testId={testId}
            />
        );
    }

    if (field.status === 'error') {
        return (
            <p
                className="text-destructive text-sm"
                role="alert"
                data-testid={`${testId}-error`}
            >
                {t('social.integrationConfig.makeWebhook.credentialError' as TranslationKey)}
            </p>
        );
    }

    return (
        <p
            className="text-muted-foreground text-sm italic"
            data-testid={`${testId}-not-configured`}
        >
            {t('social.integrationConfig.makeWebhook.notConfigured' as TranslationKey)}
        </p>
    );
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
                        {/* Webhook URL (vault secret — masked) */}
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                {t(
                                    'social.integrationConfig.makeWebhook.webhookUrlLabel' as TranslationKey
                                )}
                            </p>
                            <CredentialFieldDisplay
                                field={data.webhookUrl}
                                testId="make-webhook-export-url"
                            />
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

                        {/* API key (vault secret — masked, reveal-on-click) */}
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                {t(
                                    'social.integrationConfig.makeWebhook.apiKeyLabel' as TranslationKey
                                )}
                            </p>
                            <CredentialFieldDisplay
                                field={data.makeApiKey}
                                testId="make-webhook-export-api-key"
                            />
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
