/**
 * @file EmailPreviewPane.tsx
 * @description Right column of the email previewer (HOS-2519 §6.4, §8): the
 * subject with its environment prefix, the scenario selector (2+ scenarios
 * only), the desktop/mobile width toggle, the sandboxed iframe and the
 * plain-text panel.
 *
 * Security (R-12, AC-7.5): the HTML goes in through `srcDoc` into an iframe
 * with `sandbox=""` — no `allow-scripts`, no `allow-same-origin` — so the
 * document cannot run code, read the admin's origin or navigate it. That is
 * also why the height is fixed: auto-height would need `allow-same-origin`.
 */

import type { EmailPreviewEntrySummary } from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEmailPreviewRender } from '@/hooks/use-email-previews';
import { useTranslations } from '@/hooks/use-translations';
import { EmailPlainTextPanel } from './EmailPlainTextPanel';

/** Iframe widths of the toggle, in CSS pixels. */
export const EMAIL_PREVIEW_WIDTHS = { desktop: 600, mobile: 375 } as const;

/** Fixed iframe height, in CSS pixels (§8). */
export const EMAIL_PREVIEW_HEIGHT = 900;

/** A width of the toggle. */
export type EmailPreviewWidth = keyof typeof EMAIL_PREVIEW_WIDTHS;

/** Props of {@link EmailPreviewPane}. */
export interface EmailPreviewPaneProps {
    /** The selected entry. The parent remounts the pane (`key`) when it changes. */
    readonly entry: EmailPreviewEntrySummary;
}

/**
 * Renders the selected entry's scenario through the admin endpoint.
 *
 * @param props - See {@link EmailPreviewPaneProps}.
 */
export function EmailPreviewPane({ entry }: EmailPreviewPaneProps) {
    const { t } = useTranslations();
    const [scenarioId, setScenarioId] = useState<string>(entry.scenarios[0]?.id ?? '');
    const [width, setWidth] = useState<EmailPreviewWidth>('desktop');
    const { data, isError, refetch, isFetching } = useEmailPreviewRender({
        key: entry.key,
        scenarioId
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-lg">{entry.name}</h2>
                <code className="text-muted-foreground text-xs">{entry.key}</code>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                {entry.scenarios.length > 1 && (
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-muted-foreground text-xs">
                            {t('admin-pages.emailPreviews.scenarioLabel')}
                        </span>
                        <select
                            value={scenarioId}
                            onChange={(event) => setScenarioId(event.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {entry.scenarios.map((scenario) => (
                                <option
                                    key={scenario.id}
                                    value={scenario.id}
                                >
                                    {scenario.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <fieldset className="flex flex-col gap-1">
                    <legend className="mb-1 text-muted-foreground text-xs">
                        {t('admin-pages.emailPreviews.widthLabel')}
                    </legend>
                    <div className="flex gap-1">
                        {(['desktop', 'mobile'] as const).map((option) => (
                            <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant={width === option ? 'default' : 'outline'}
                                aria-pressed={width === option}
                                onClick={() => setWidth(option)}
                            >
                                {t(`admin-pages.emailPreviews.${option}`)}
                            </Button>
                        ))}
                    </div>
                </fieldset>
            </div>

            {isFetching && !data && (
                <div
                    data-testid="email-preview-skeleton"
                    role="status"
                    aria-busy="true"
                    aria-label={t('admin-pages.emailPreviews.previewLoading')}
                    className="flex flex-col gap-3"
                >
                    <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
                    <div
                        className="animate-pulse rounded bg-muted"
                        style={{ width: EMAIL_PREVIEW_WIDTHS[width], height: 320 }}
                    />
                </div>
            )}

            {isError && !isFetching && (
                <div
                    role="alert"
                    className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 p-4"
                >
                    <p className="text-destructive text-sm">
                        {t('admin-pages.emailPreviews.previewError')}
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            void refetch();
                        }}
                    >
                        {t('admin-pages.emailPreviews.retry')}
                    </Button>
                </div>
            )}

            {data && !isError && (
                <>
                    <p className="text-sm">
                        <span className="text-muted-foreground">
                            {t('admin-pages.emailPreviews.subjectLabel')}:{' '}
                        </span>
                        <span
                            data-testid="email-preview-subject"
                            className="font-medium"
                        >
                            {`${data.subjectPrefix ?? ''}${data.subject}`}
                        </span>
                    </p>
                    <div className="overflow-x-auto rounded-md border bg-muted/30 p-4">
                        <iframe
                            title={t('admin-pages.emailPreviews.iframeTitle', {
                                name: entry.name
                            })}
                            sandbox=""
                            srcDoc={data.html}
                            width={EMAIL_PREVIEW_WIDTHS[width]}
                            height={EMAIL_PREVIEW_HEIGHT}
                            className="mx-auto block border-0 bg-white"
                            style={{
                                width: EMAIL_PREVIEW_WIDTHS[width],
                                height: EMAIL_PREVIEW_HEIGHT
                            }}
                        />
                    </div>
                    <EmailPlainTextPanel text={data.text} />
                </>
            )}
        </div>
    );
}
