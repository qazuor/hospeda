/**
 * @file SocialPostSidePanel.tsx
 * @description Lateral metadata + actions panel for the social post detail page (SPEC-254 T-040).
 *
 * Shows: pipeline status badge, approval status badge, batch placeholder,
 * scheduled date (or "Not scheduled"), target platforms derived from targets array,
 * and all status-transition action buttons (re-using SocialPostActionBar logic inline
 * to avoid the sticky-bottom positioning conflict).
 *
 * A "Publish now" button is shown but always disabled with a "Coming soon" tooltip —
 * the backend endpoint does not exist yet.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    useApproveSocialPost,
    useArchiveSocialPost,
    useMarkReadySocialPost,
    usePauseSocialPost,
    usePublishNowSocialPost,
    useRejectSocialPost,
    useRequestChangesSocialPost,
    useScheduleSocialPost,
    useUnpauseSocialPost
} from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import type { TranslationKey } from '@repo/i18n';
import {
    PermissionEnum,
    SocialApprovalStatusEnum,
    SocialPostStatusEnum,
    SocialRecurrenceTypeEnum
} from '@repo/schemas';
import { useCallback, useState } from 'react';
import {
    PublishNowDialog,
    RejectDialog,
    RequestChangesDialog,
    ScheduleDialog
} from './SocialPostActionDialogs';
import { SocialPostApprovalBadge } from './SocialPostApprovalBadge';
import { SocialPostStatusBadge } from './SocialPostStatusBadge';
import { mapApiError } from './social-post-detail.utils';

// ---------------------------------------------------------------------------
// State-transition availability sets (mirrored from SocialPostActionBar)
// ---------------------------------------------------------------------------

const APPROVE_FROM: ReadonlySet<string> = new Set([SocialPostStatusEnum.NEEDS_REVIEW]);

const REJECT_FROM: ReadonlySet<string> = new Set([
    SocialPostStatusEnum.NEEDS_REVIEW,
    SocialPostStatusEnum.APPROVED
]);

const REQUEST_CHANGES_FROM: ReadonlySet<string> = new Set([
    SocialPostStatusEnum.NEEDS_REVIEW,
    SocialPostStatusEnum.APPROVED
]);

const SCHEDULE_FROM: ReadonlySet<string> = new Set([
    SocialPostStatusEnum.APPROVED,
    SocialPostStatusEnum.SCHEDULED
]);

const MARK_READY_FROM: ReadonlySet<string> = new Set([
    SocialPostStatusEnum.APPROVED,
    SocialPostStatusEnum.SCHEDULED
]);

// "Publish now" dispatches every target to Make.com immediately, re-publishing even
// already-published posts. The only gate is approval: any approved post can be published
// regardless of pipeline status (scheduled, recurring, already published, paused).

const PAUSE_FROM: ReadonlySet<string> = new Set([
    SocialPostStatusEnum.APPROVED,
    SocialPostStatusEnum.SCHEDULED,
    SocialPostStatusEnum.READY_TO_PUBLISH,
    SocialPostStatusEnum.PUBLISHING
]);

const UNPAUSE_FROM: ReadonlySet<string> = new Set([SocialPostStatusEnum.PAUSED]);

const ARCHIVE_BLOCKED: ReadonlySet<string> = new Set([
    SocialPostStatusEnum.PUBLISHING,
    SocialPostStatusEnum.PUBLISHED,
    SocialPostStatusEnum.ARCHIVED
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the {@link SocialPostSidePanel} component. */
export interface SocialPostSidePanelProps {
    /** Post UUID. */
    readonly postId: string;
    /** Display title of the post (used for aria-labels). */
    readonly postTitle: string;
    /** Pipeline status string. */
    readonly status: string;
    /** Approval status string. */
    readonly approvalStatus: string;
    /** Whether the post is paused. */
    readonly paused: boolean;
    /** Scheduled timestamp or null. */
    readonly scheduledAt: Date | string | null;
    /** Array of publish targets (platform/status rows). */
    readonly targets: ReadonlyArray<Record<string, unknown>>;
    /** Batch summary or null when no batch is assigned. */
    readonly batch: { readonly id: string; readonly name: string } | null;
    /** Campaign summary or null when no campaign is assigned. */
    readonly campaign: { readonly id: string; readonly name: string } | null;
    /** Recurrence cadence (ONCE | WEEKLY | BIWEEKLY | MONTHLY). */
    readonly recurrenceType: string;
    /** Next scheduled execution time. Null for ONCE posts or when not yet scheduled. */
    readonly nextRunAt: Date | null;
    /** Additional cadence params (e.g. `{ weekday: "TUESDAY" }` for WEEKLY). */
    readonly recurrenceParamsJson: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extracts unique platform names from targets. */
function extractPlatforms(targets: ReadonlyArray<Record<string, unknown>>): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const t of targets) {
        const platform = t.platform as string | undefined;
        if (platform && !seen.has(platform)) {
            seen.add(platform);
            result.push(platform);
        }
    }
    return result;
}

/** Renders a small platform chip. */
function PlatformChip({ platform }: { readonly platform: string }) {
    const shortLabel: Record<string, string> = {
        INSTAGRAM: 'IG',
        FACEBOOK: 'FB',
        X: 'X'
    };
    return (
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
            {shortLabel[platform] ?? platform}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Right-side metadata and actions panel for the social post detail page.
 * Renders status badges, scheduling info, platform chips, and all
 * status-transition buttons with permission/status gating.
 *
 * @param props - {@link SocialPostSidePanelProps}
 */
export function SocialPostSidePanel({
    postId,
    postTitle,
    status,
    approvalStatus,
    paused,
    scheduledAt,
    targets,
    batch,
    campaign,
    recurrenceType,
    nextRunAt,
    recurrenceParamsJson
}: SocialPostSidePanelProps) {
    const { t } = useTranslations();

    const canApprove = useHasPermission(PermissionEnum.SOCIAL_POST_APPROVE);
    const canSchedule = useHasPermission(PermissionEnum.SOCIAL_POST_SCHEDULE);
    const canPause = useHasPermission(PermissionEnum.SOCIAL_POST_PAUSE);
    const canArchive = useHasPermission(PermissionEnum.SOCIAL_POST_ARCHIVE);

    const approve = useApproveSocialPost();
    const reject = useRejectSocialPost();
    const requestChanges = useRequestChangesSocialPost();
    const schedule = useScheduleSocialPost();
    const markReady = useMarkReadySocialPost();
    const publishNow = usePublishNowSocialPost();
    const pause = usePauseSocialPost();
    const unpause = useUnpauseSocialPost();
    const archive = useArchiveSocialPost();

    const anyMutationPending =
        approve.isPending ||
        reject.isPending ||
        requestChanges.isPending ||
        schedule.isPending ||
        markReady.isPending ||
        publishNow.isPending ||
        pause.isPending ||
        unpause.isPending ||
        archive.isPending;

    // ARIA live region state
    const [actionMsg, setActionMsg] = useState('');
    const [actionError, setActionError] = useState('');

    // Dialog state
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rcDialogOpen, setRcDialogOpen] = useState(false);
    const [rcFeedback, setRcFeedback] = useState('');
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [scheduleAt, setScheduleAt] = useState('');
    const [scheduleTz, setScheduleTz] = useState('America/Argentina/Buenos_Aires');
    const [publishNowDialogOpen, setPublishNowDialogOpen] = useState(false);

    const withFeedback = useCallback(
        async (
            action: () => Promise<unknown>,
            successKey: TranslationKey,
            errorKey: TranslationKey
        ) => {
            setActionMsg('');
            setActionError('');
            try {
                await action();
                setActionMsg(t(successKey));
            } catch (err) {
                const msg = err instanceof Error ? mapApiError(err.message, t) : t(errorKey);
                setActionError(msg);
            }
        },
        [t]
    );

    const platforms = extractPlatforms(targets);

    const formattedScheduled = scheduledAt
        ? new Date(scheduledAt as string).toLocaleString()
        : null;

    const formattedNextRunAt = nextRunAt ? new Date(nextRunAt).toLocaleString() : null;

    /** True when the cadence is something other than one-shot. */
    const isRecurring = recurrenceType !== SocialRecurrenceTypeEnum.ONCE;

    /**
     * Human-readable recurrence label.
     * For WEEKLY, appends the configured weekday.
     */
    const recurrenceLabel = (() => {
        switch (recurrenceType) {
            case SocialRecurrenceTypeEnum.WEEKLY: {
                const weekday = recurrenceParamsJson?.weekday as string | undefined;
                const dayLabel = weekday
                    ? t(
                          `social.posts.detail.actions.weekday${weekday[0]}${weekday.slice(1).toLowerCase()}` as Parameters<
                              typeof t
                          >[0]
                      )
                    : '';
                const weekly = t('social.posts.detail.actions.recurrenceWeekly');
                return dayLabel ? `${weekly} (${dayLabel})` : weekly;
            }
            case SocialRecurrenceTypeEnum.BIWEEKLY:
                return t('social.posts.detail.actions.recurrenceBiweekly');
            case SocialRecurrenceTypeEnum.MONTHLY:
                return t('social.posts.detail.actions.recurrenceMonthly');
            default:
                return t('social.posts.detail.actions.recurrenceOnce');
        }
    })();

    return (
        <>
            <div className="flex flex-col gap-4">
                {/* Metadata card */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="font-semibold text-sm">
                            {t('social.posts.detail.sidePanel.statusLabel')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Status row */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                {t('social.posts.detail.sidePanel.statusLabel')}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <SocialPostStatusBadge status={status} />
                                {paused && (
                                    <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600 text-xs">
                                        {t('social.posts.detail.paused')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Approval row */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                {t('social.posts.detail.sidePanel.approvalLabel')}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <SocialPostApprovalBadge approvalStatus={approvalStatus} />
                            </div>
                        </div>

                        <hr className="border-border" />

                        {/* Batch */}
                        <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                {t('social.posts.detail.sidePanel.batchLabel')}
                            </span>
                            <span className="text-sm">
                                {batch?.name ?? (
                                    <span className="text-muted-foreground">
                                        {t('social.posts.detail.sidePanel.batchEmpty')}
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Campaign */}
                        <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                {t('social.posts.detail.sidePanel.campaignLabel')}
                            </span>
                            <span className="text-sm">
                                {campaign?.name ?? (
                                    <span className="text-muted-foreground">
                                        {t('social.posts.detail.sidePanel.campaignEmpty')}
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Scheduled at */}
                        <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                {t('social.posts.detail.sidePanel.scheduledLabel')}
                            </span>
                            <span className="text-sm">
                                {formattedScheduled ?? (
                                    <span className="text-muted-foreground">
                                        {t('social.posts.detail.sidePanel.scheduledEmpty')}
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Recurrence */}
                        {isRecurring && (
                            <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                    {t('social.posts.detail.sidePanel.recurrenceLabel')}
                                </span>
                                <span className="text-sm">{recurrenceLabel}</span>
                            </div>
                        )}

                        {/* Next run at — only for recurring posts */}
                        {isRecurring && (
                            <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                    {t('social.posts.detail.sidePanel.nextRunAtLabel')}
                                </span>
                                <span className="text-sm">
                                    {formattedNextRunAt ?? (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </span>
                            </div>
                        )}

                        {/* Platforms */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-muted-foreground text-xs uppercase tracking-wide">
                                {t('social.posts.detail.sidePanel.platformsLabel')}
                            </span>
                            {platforms.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {platforms.map((p) => (
                                        <PlatformChip
                                            key={p}
                                            platform={p}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <span className="text-muted-foreground text-sm">
                                    {t('social.posts.detail.sidePanel.platformsEmpty')}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Actions card */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="font-semibold text-sm">
                            {t('social.posts.detail.sidePanel.actionsLabel')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {/* ARIA live feedback */}
                        {actionMsg && (
                            <output
                                aria-live="polite"
                                className="rounded-md bg-green-50 px-3 py-2 text-green-700 text-xs"
                                data-testid="side-action-success-msg"
                            >
                                {actionMsg}
                            </output>
                        )}
                        {actionError && (
                            <p
                                role="alert"
                                aria-live="assertive"
                                className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-xs"
                                data-testid="side-action-error-msg"
                            >
                                {actionError}
                            </p>
                        )}

                        {/* Approve */}
                        {canApprove && APPROVE_FROM.has(status) && (
                            <Button
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                    withFeedback(
                                        () => approve.mutateAsync(postId),
                                        'social.posts.detail.actions.approveSuccess',
                                        'social.posts.detail.actions.approveError'
                                    )
                                }
                                disabled={anyMutationPending}
                                aria-label={t('social.posts.detail.actions.approveAriaLabel', {
                                    title: postTitle
                                })}
                                data-testid="side-action-approve"
                            >
                                {approve.isPending
                                    ? t('social.posts.detail.actions.approving')
                                    : t('social.posts.detail.actions.approve')}
                            </Button>
                        )}

                        {/* Reject */}
                        {canApprove && REJECT_FROM.has(status) && (
                            <Button
                                size="sm"
                                variant="destructive"
                                className="w-full"
                                onClick={() => setRejectDialogOpen(true)}
                                disabled={anyMutationPending}
                                data-testid="side-action-reject"
                            >
                                {t('social.posts.detail.actions.reject')}
                            </Button>
                        )}

                        {/* Request changes */}
                        {canApprove && REQUEST_CHANGES_FROM.has(status) && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => setRcDialogOpen(true)}
                                disabled={anyMutationPending}
                                data-testid="side-action-request-changes"
                            >
                                {t('social.posts.detail.actions.requestChanges')}
                            </Button>
                        )}

                        {/* Schedule */}
                        {canSchedule && SCHEDULE_FROM.has(status) && !paused && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => setScheduleDialogOpen(true)}
                                disabled={anyMutationPending}
                                data-testid="side-action-schedule"
                            >
                                {t('social.posts.detail.actions.schedule')}
                            </Button>
                        )}

                        {/* Mark ready */}
                        {canSchedule && MARK_READY_FROM.has(status) && !paused && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() =>
                                    withFeedback(
                                        () => markReady.mutateAsync(postId),
                                        'social.posts.detail.actions.markReadySuccess',
                                        'social.posts.detail.actions.markReadyError'
                                    )
                                }
                                disabled={anyMutationPending}
                                data-testid="side-action-mark-ready"
                            >
                                {markReady.isPending
                                    ? t('social.posts.detail.actions.markingReady')
                                    : t('social.posts.detail.actions.markReady')}
                            </Button>
                        )}

                        {/* Pause */}
                        {canPause && !paused && PAUSE_FROM.has(status) && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() =>
                                    withFeedback(
                                        () => pause.mutateAsync(postId),
                                        'social.posts.detail.actions.pauseSuccess',
                                        'social.posts.detail.actions.pauseError'
                                    )
                                }
                                disabled={anyMutationPending}
                                data-testid="side-action-pause"
                            >
                                {pause.isPending
                                    ? t('social.posts.detail.actions.pausing')
                                    : t('social.posts.detail.actions.pause')}
                            </Button>
                        )}

                        {/* Unpause */}
                        {canPause && paused && UNPAUSE_FROM.has(status) && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() =>
                                    withFeedback(
                                        () => unpause.mutateAsync(postId),
                                        'social.posts.detail.actions.unpauseSuccess',
                                        'social.posts.detail.actions.unpauseError'
                                    )
                                }
                                disabled={anyMutationPending}
                                data-testid="side-action-unpause"
                            >
                                {unpause.isPending
                                    ? t('social.posts.detail.actions.unpausing')
                                    : t('social.posts.detail.actions.unpause')}
                            </Button>
                        )}

                        {/* Archive */}
                        {canArchive && !ARCHIVE_BLOCKED.has(status) && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="w-full"
                                onClick={() =>
                                    withFeedback(
                                        () => archive.mutateAsync(postId),
                                        'social.posts.detail.actions.archiveSuccess',
                                        'social.posts.detail.actions.archiveError'
                                    )
                                }
                                disabled={anyMutationPending}
                                data-testid="side-action-archive"
                            >
                                {archive.isPending
                                    ? t('social.posts.detail.actions.archiving')
                                    : t('social.posts.detail.actions.archive')}
                            </Button>
                        )}

                        {/* Publish now — dispatch every target to Make.com immediately */}
                        {canSchedule && approvalStatus === SocialApprovalStatusEnum.APPROVED && (
                            <Button
                                size="sm"
                                variant="default"
                                className="w-full"
                                onClick={() => setPublishNowDialogOpen(true)}
                                disabled={anyMutationPending}
                                data-testid="side-action-publish-now"
                            >
                                {publishNow.isPending
                                    ? t('social.posts.detail.sidePanel.publishingNow')
                                    : t('social.posts.detail.sidePanel.publishNow')}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Dialogs (same as before, co-located here) */}
            <RejectDialog
                open={rejectDialogOpen}
                isPending={reject.isPending}
                reason={rejectReason}
                onReasonChange={setRejectReason}
                onClose={() => setRejectDialogOpen(false)}
                onConfirm={(reason) => {
                    withFeedback(
                        () => reject.mutateAsync({ id: postId, reason }),
                        'social.posts.detail.actions.rejectSuccess',
                        'social.posts.detail.actions.rejectError'
                    );
                    setRejectDialogOpen(false);
                    setRejectReason('');
                }}
            />

            <RequestChangesDialog
                open={rcDialogOpen}
                isPending={requestChanges.isPending}
                feedback={rcFeedback}
                onFeedbackChange={setRcFeedback}
                onClose={() => setRcDialogOpen(false)}
                onConfirm={(feedback) => {
                    withFeedback(
                        () => requestChanges.mutateAsync({ id: postId, feedback }),
                        'social.posts.detail.actions.requestChangesSuccess',
                        'social.posts.detail.actions.requestChangesError'
                    );
                    setRcDialogOpen(false);
                    setRcFeedback('');
                }}
            />

            <ScheduleDialog
                open={scheduleDialogOpen}
                isPending={schedule.isPending}
                scheduleAt={scheduleAt}
                scheduleTz={scheduleTz}
                onScheduleAtChange={setScheduleAt}
                onScheduleTzChange={setScheduleTz}
                onClose={() => setScheduleDialogOpen(false)}
                onConfirm={(scheduledAt, timezone, recType, paramsJson) => {
                    withFeedback(
                        () =>
                            schedule.mutateAsync({
                                id: postId,
                                scheduledAt,
                                timezone,
                                recurrenceType: recType,
                                recurrenceParamsJson: paramsJson
                            }),
                        'social.posts.detail.actions.scheduleSuccess',
                        'social.posts.detail.actions.scheduleError'
                    );
                    setScheduleDialogOpen(false);
                    setScheduleAt('');
                }}
            />

            <PublishNowDialog
                open={publishNowDialogOpen}
                isPending={publishNow.isPending}
                onClose={() => setPublishNowDialogOpen(false)}
                onConfirm={() => {
                    withFeedback(
                        () => publishNow.mutateAsync(postId),
                        'social.posts.detail.sidePanel.publishNowSuccess',
                        'social.posts.detail.sidePanel.publishNowError'
                    );
                    setPublishNowDialogOpen(false);
                }}
            />
        </>
    );
}
