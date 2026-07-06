/**
 * @file GptActionExportPanel.tsx
 * @description Panel 1 — GPT Action export (HOS-67 G-6, T-008).
 *
 * Read-only display of the OpenAPI 3.1 document returned by
 * `GET /api/v1/admin/social/gpt-action-schema`, wrapped in a copy-to-clipboard
 * block plus a download-as-`.json` affordance. The operator pastes this
 * directly into the Custom GPT's "Actions" configuration.
 */

import type { TranslationKey } from '@repo/i18n';
import { DownloadIcon, LoaderIcon } from '@repo/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { GptActionSchemaResponse } from '../-hooks/use-integration-config';
import { CopyButton } from './CopyButton';
import { JsonCodeBlock } from './JsonCodeBlock';

const GPT_ACTION_SCHEMA_FILENAME = 'hospeda-gpt-action-schema.json';

/** Triggers a browser download of `data` as a pretty-printed `.json` file. */
function downloadJson(data: GptActionSchemaResponse, filename: string): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

/** Props for {@link GptActionExportPanel}. */
export interface GptActionExportPanelProps {
    readonly data: GptActionSchemaResponse | undefined;
    readonly isLoading: boolean;
    readonly error: unknown;
}

/** Panel showing the Custom GPT Action OpenAPI 3.1 export. */
export function GptActionExportPanel({ data, isLoading, error }: GptActionExportPanelProps) {
    const { t } = useTranslations();
    const json = data ? JSON.stringify(data, null, 2) : '';

    return (
        <Card data-testid="gpt-action-export-panel">
            <CardHeader>
                <CardTitle>
                    {t('social.integrationConfig.gptAction.title' as TranslationKey)}
                </CardTitle>
                <CardDescription>
                    {t('social.integrationConfig.gptAction.description' as TranslationKey)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading && (
                    <div
                        className="flex items-center justify-center py-8"
                        data-testid="gpt-action-export-loading"
                    >
                        <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!isLoading && Boolean(error) && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                        data-testid="gpt-action-export-error"
                    >
                        {t('social.integrationConfig.gptAction.error' as TranslationKey)}
                    </p>
                )}

                {!isLoading && !error && data && (
                    <>
                        <div className="flex flex-wrap gap-2">
                            <CopyButton
                                value={json}
                                label={t(
                                    'social.integrationConfig.gptAction.copyButton' as TranslationKey
                                )}
                                testId="gpt-action-export-copy"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => downloadJson(data, GPT_ACTION_SCHEMA_FILENAME)}
                                data-testid="gpt-action-export-download"
                            >
                                <DownloadIcon
                                    className="mr-2 h-4 w-4"
                                    aria-hidden="true"
                                />
                                {t(
                                    'social.integrationConfig.gptAction.downloadButton' as TranslationKey
                                )}
                            </Button>
                        </div>
                        <JsonCodeBlock
                            data={data}
                            testId="gpt-action-export-json"
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
}
