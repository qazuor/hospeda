/**
 * @file SocialPostLogsTab.tsx
 * @description Publish logs tab for the social post detail page (SPEC-254 T-040).
 * Lists each publish-log entry with status, platform, format, timestamp, and message.
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the SocialPostLogsTab component. */
export interface SocialPostLogsTabProps {
    readonly logs: ReadonlyArray<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Logs tab for the social post detail view.
 * Renders each publish-log entry as a card with status, timestamps, and message.
 */
export function SocialPostLogsTab({ logs }: SocialPostLogsTabProps) {
    const { t } = useTranslations();

    if (logs.length === 0) {
        return (
            <p
                className="text-muted-foreground text-sm"
                data-testid="logs-empty"
            >
                {t('social.posts.detail.logs.empty' as TranslationKey)}
            </p>
        );
    }

    const STABLE_LOG_KEYS = logs.map((log) => `log-${String(log.id)}`);

    return (
        <div className="space-y-2">
            {logs.map((log, idx) => (
                <div
                    key={STABLE_LOG_KEYS[idx]}
                    className="rounded-md border p-3 text-sm"
                    data-testid={`log-row-${String(log.id)}`}
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-medium">{String(log.status)}</span>
                        {log.platform != null && <span>{String(log.platform)}</span>}
                        {log.publishFormat != null && <span>{String(log.publishFormat)}</span>}
                        <span className="text-muted-foreground">
                            {new Date(log.createdAt as string).toLocaleString()}
                        </span>
                    </div>
                    {log.message != null && (
                        <p className="mt-1 text-muted-foreground text-xs">{String(log.message)}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
