/**
 * @file SocialPostActionBar.tsx
 * @description Sticky bottom action bar for the social post detail page (SPEC-254 T-040).
 *
 * Renders the 8 status-transition buttons (approve, reject, request changes, schedule,
 * mark ready, pause, unpause, archive) with permission and status gating.
 * Inline dialogs (reject / request-changes / schedule) are provided via
 * SocialPostActionDialogs. ARIA live regions surface mutation feedback.
 */

import { Button } from '@/components/ui/button';
import {
    useApproveSocialPost,
    useArchiveSocialPost,
    useMarkReadySocialPost,
    usePauseSocialPost,
    useRejectSocialPost,
    useRequestChangesSocialPost,
    useScheduleSocialPost,
    useUnpauseSocialPost
} from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, SocialPostStatusEnum } from '@repo/schemas';
import { useCallback, useState } from 'react';
import { RejectDialog, RequestChangesDialog, ScheduleDialog } from './SocialPostActionDialogs';
import { mapApiError } from './social-post-detail.utils';

// ---------------------------------------------------------------------------
// State-transition availability sets
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

/** Props for the SocialPostActionBar component. */
export interface SocialPostActionBarProps {
    readonly postId: string;
    readonly postTitle: string;
    readonly status: string;
    readonly paused: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sticky bottom action bar for the social post detail page.
 * Handles all status-transition mutations with permission gating and ARIA live feedback.
 */
export function SocialPostActionBar({
    postId,
    postTitle,
    status,
    paused
}: SocialPostActionBarProps) {
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
    const pause = usePauseSocialPost();
    const unpause = useUnpauseSocialPost();
    const archive = useArchiveSocialPost();

    const anyMutationPending =
        approve.isPending ||
        reject.isPending ||
        requestChanges.isPending ||
        schedule.isPending ||
        markReady.isPending ||
        pause.isPending ||
        unpause.isPending ||
        archive.isPending;

    // ARIA live region state
    const [actionMsg, setActionMsg] = useState('');
    const [actionError, setActionError] = useState('');

    // Reject dialog state
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Request-changes dialog state
    const [rcDialogOpen, setRcDialogOpen] = useState(false);
    const [rcFeedback, setRcFeedback] = useState('');

    // Schedule dialog state
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [scheduleAt, setScheduleAt] = useState('');
    const [scheduleTz, setScheduleTz] = useState('America/Argentina/Buenos_Aires');

    const withFeedback = useCallback(
        async (action: () => Promise<unknown>, successKey: string, errorKey: string) => {
            setActionMsg('');
            setActionError('');
            try {
                await action();
                setActionMsg(t(successKey as TranslationKey));
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? mapApiError(err.message, t)
                        : t(errorKey as TranslationKey);
                setActionError(msg);
            }
        },
        [t]
    );

    return (
        <>
            {/* ARIA live regions */}
            {actionMsg && (
                <output
                    aria-live="polite"
                    className="mx-6 rounded-md bg-green-50 px-3 py-2 text-green-700 text-sm"
                    data-testid="action-success-msg"
                >
                    {actionMsg}
                </output>
            )}
            {actionError && (
                <p
                    role="alert"
                    aria-live="assertive"
                    className="mx-6 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm"
                    data-testid="action-error-msg"
                >
                    {actionError}
                </p>
            )}

            {/* Sticky action bar */}
            <div
                className="fixed right-0 bottom-0 left-0 z-10 flex flex-wrap items-center gap-2 border-t bg-background px-6 py-3 shadow-lg"
                data-testid="action-bar"
            >
                {/* Approve */}
                {canApprove && APPROVE_FROM.has(status) && (
                    <Button
                        size="sm"
                        onClick={() =>
                            withFeedback(
                                () => approve.mutateAsync(postId),
                                'social.posts.detail.actions.approveSuccess',
                                'social.posts.detail.actions.approveError'
                            )
                        }
                        disabled={anyMutationPending}
                        aria-label={`${t('social.posts.detail.actions.approve' as TranslationKey)}: ${postTitle}`}
                        data-testid="action-approve"
                    >
                        {approve.isPending
                            ? t('social.posts.detail.actions.approving' as TranslationKey)
                            : t('social.posts.detail.actions.approve' as TranslationKey)}
                    </Button>
                )}

                {/* Reject */}
                {canApprove && REJECT_FROM.has(status) && (
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectDialogOpen(true)}
                        disabled={anyMutationPending}
                        data-testid="action-reject"
                    >
                        {t('social.posts.detail.actions.reject' as TranslationKey)}
                    </Button>
                )}

                {/* Request changes */}
                {canApprove && REQUEST_CHANGES_FROM.has(status) && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRcDialogOpen(true)}
                        disabled={anyMutationPending}
                        data-testid="action-request-changes"
                    >
                        {t('social.posts.detail.actions.requestChanges' as TranslationKey)}
                    </Button>
                )}

                {/* Schedule */}
                {canSchedule && SCHEDULE_FROM.has(status) && !paused && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setScheduleDialogOpen(true)}
                        disabled={anyMutationPending}
                        data-testid="action-schedule"
                    >
                        {t('social.posts.detail.actions.schedule' as TranslationKey)}
                    </Button>
                )}

                {/* Mark ready */}
                {canSchedule && MARK_READY_FROM.has(status) && !paused && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            withFeedback(
                                () => markReady.mutateAsync(postId),
                                'social.posts.detail.actions.markReadySuccess',
                                'social.posts.detail.actions.markReadyError'
                            )
                        }
                        disabled={anyMutationPending}
                        data-testid="action-mark-ready"
                    >
                        {markReady.isPending
                            ? t('social.posts.detail.actions.markingReady' as TranslationKey)
                            : t('social.posts.detail.actions.markReady' as TranslationKey)}
                    </Button>
                )}

                {/* Pause */}
                {canPause && !paused && PAUSE_FROM.has(status) && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            withFeedback(
                                () => pause.mutateAsync(postId),
                                'social.posts.detail.actions.pauseSuccess',
                                'social.posts.detail.actions.pauseError'
                            )
                        }
                        disabled={anyMutationPending}
                        data-testid="action-pause"
                    >
                        {pause.isPending
                            ? t('social.posts.detail.actions.pausing' as TranslationKey)
                            : t('social.posts.detail.actions.pause' as TranslationKey)}
                    </Button>
                )}

                {/* Unpause */}
                {canPause && paused && UNPAUSE_FROM.has(status) && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            withFeedback(
                                () => unpause.mutateAsync(postId),
                                'social.posts.detail.actions.unpauseSuccess',
                                'social.posts.detail.actions.unpauseError'
                            )
                        }
                        disabled={anyMutationPending}
                        data-testid="action-unpause"
                    >
                        {unpause.isPending
                            ? t('social.posts.detail.actions.unpausing' as TranslationKey)
                            : t('social.posts.detail.actions.unpause' as TranslationKey)}
                    </Button>
                )}

                {/* Archive */}
                {canArchive && !ARCHIVE_BLOCKED.has(status) && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            withFeedback(
                                () => archive.mutateAsync(postId),
                                'social.posts.detail.actions.archiveSuccess',
                                'social.posts.detail.actions.archiveError'
                            )
                        }
                        disabled={anyMutationPending}
                        data-testid="action-archive"
                    >
                        {archive.isPending
                            ? t('social.posts.detail.actions.archiving' as TranslationKey)
                            : t('social.posts.detail.actions.archive' as TranslationKey)}
                    </Button>
                )}
            </div>

            {/* Inline dialogs */}
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
                onConfirm={(scheduledAt, timezone) => {
                    withFeedback(
                        () => schedule.mutateAsync({ id: postId, scheduledAt, timezone }),
                        'social.posts.detail.actions.scheduleSuccess',
                        'social.posts.detail.actions.scheduleError'
                    );
                    setScheduleDialogOpen(false);
                    setScheduleAt('');
                }}
            />
        </>
    );
}
