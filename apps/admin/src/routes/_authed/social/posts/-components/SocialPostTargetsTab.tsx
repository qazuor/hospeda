/**
 * @file SocialPostTargetsTab.tsx
 * @description Targets tab for the social post detail page (SPEC-254 T-040).
 * Lists each publishing target with platform, format, status, scheduling and
 * publication timestamps, external URL, and any last error message.
 */

import { useTranslations } from '@/hooks/use-translations';

import { SocialPostStatusBadge } from './SocialPostStatusBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the SocialPostTargetsTab component. */
export interface SocialPostTargetsTabProps {
    readonly targets: ReadonlyArray<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Targets tab for the social post detail view.
 * Renders each publish target as a card with status, timestamps, and error info.
 */
export function SocialPostTargetsTab({ targets }: SocialPostTargetsTabProps) {
    const { t } = useTranslations();

    if (targets.length === 0) {
        return (
            <p
                className="text-muted-foreground text-sm"
                data-testid="targets-empty"
            >
                {t('social.posts.detail.targets.empty')}
            </p>
        );
    }

    const STABLE_TARGET_KEYS = targets.map((tgt) => `target-${String(tgt.id)}`);

    return (
        <div className="space-y-2">
            {targets.map((tgt, idx) => {
                const externalUrl = tgt.externalPostUrl as string | null | undefined;
                const lastError = tgt.lastErrorMessage as string | null | undefined;
                const scheduledAt = tgt.scheduledAt as Date | string | null | undefined;
                const publishedAt = tgt.publishedAt as Date | string | null | undefined;

                return (
                    <div
                        key={STABLE_TARGET_KEYS[idx]}
                        className="rounded-md border p-3 text-sm"
                        data-testid={`target-row-${String(tgt.id)}`}
                    >
                        <div className="flex flex-wrap items-center gap-4">
                            <span>
                                <strong>{t('social.posts.detail.targets.platform')}:</strong>{' '}
                                {String(tgt.platform)}
                            </span>
                            <span>
                                <strong>{t('social.posts.detail.targets.format')}:</strong>{' '}
                                {String(tgt.publishFormat)}
                            </span>
                            <SocialPostStatusBadge status={String(tgt.status)} />
                            <span>
                                <strong>{t('social.posts.detail.targets.scheduledAt')}:</strong>{' '}
                                {scheduledAt
                                    ? new Date(scheduledAt as string).toLocaleString()
                                    : t('social.posts.detail.targets.noScheduled')}
                            </span>
                            <span>
                                <strong>{t('social.posts.detail.targets.publishedAt')}:</strong>{' '}
                                {publishedAt
                                    ? new Date(publishedAt as string).toLocaleString()
                                    : t('social.posts.detail.targets.noPublished')}
                            </span>
                            {externalUrl && (
                                <a
                                    href={externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline"
                                >
                                    {t('social.posts.detail.targets.externalUrl')}
                                </a>
                            )}
                        </div>
                        {lastError && (
                            <p className="mt-1 text-destructive text-xs">
                                <strong>{t('social.posts.detail.targets.lastError')}:</strong>{' '}
                                {lastError}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
