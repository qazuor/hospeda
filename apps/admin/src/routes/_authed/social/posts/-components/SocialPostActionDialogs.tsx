/**
 * @file SocialPostActionDialogs.tsx
 * @description Inline confirmation dialogs for the social post action bar (SPEC-254 T-040).
 *
 * Provides three controlled dialogs:
 * - Reject: requires a non-empty reason before confirming.
 * - Request changes: requires non-empty feedback text before confirming.
 * - Schedule: requires a datetime and timezone before confirming.
 */

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { SocialRecurrenceTypeEnum } from '@repo/schemas';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Reject dialog
// ---------------------------------------------------------------------------

/** Props for the RejectDialog component. */
export interface RejectDialogProps {
    readonly open: boolean;
    readonly isPending: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (reason: string) => void;
    readonly reason: string;
    readonly onReasonChange: (v: string) => void;
}

/**
 * Dialog for rejecting a social post.
 * Requires a non-empty reason before enabling the confirm button.
 */
export function RejectDialog({
    open,
    isPending,
    onClose,
    onConfirm,
    reason,
    onReasonChange
}: RejectDialogProps) {
    const { t } = useTranslations();

    return (
        <Dialog
            open={open}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('social.posts.detail.actions.reject')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="reject-reason">
                        {t('social.posts.detail.actions.rejectReason')}
                    </Label>
                    <Textarea
                        id="reject-reason"
                        value={reason}
                        onChange={(e) => onReasonChange(e.target.value)}
                        placeholder={t('social.posts.detail.actions.rejectReasonPlaceholder')}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t('social.posts.detail.actions.confirmCancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={!reason.trim() || isPending}
                        onClick={() => onConfirm(reason.trim())}
                    >
                        {isPending
                            ? t('social.posts.detail.actions.rejecting')
                            : t('social.posts.detail.actions.reject')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Request-changes dialog
// ---------------------------------------------------------------------------

/** Props for the RequestChangesDialog component. */
export interface RequestChangesDialogProps {
    readonly open: boolean;
    readonly isPending: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (feedback: string) => void;
    readonly feedback: string;
    readonly onFeedbackChange: (v: string) => void;
}

/**
 * Dialog for requesting changes to a social post.
 * Requires non-empty feedback text before enabling the confirm button.
 */
export function RequestChangesDialog({
    open,
    isPending,
    onClose,
    onConfirm,
    feedback,
    onFeedbackChange
}: RequestChangesDialogProps) {
    const { t } = useTranslations();

    return (
        <Dialog
            open={open}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('social.posts.detail.actions.requestChanges')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="rc-feedback">
                        {t('social.posts.detail.actions.requestChangesFeedback')}
                    </Label>
                    <Textarea
                        id="rc-feedback"
                        value={feedback}
                        onChange={(e) => onFeedbackChange(e.target.value)}
                        placeholder={t(
                            'social.posts.detail.actions.requestChangesFeedbackPlaceholder'
                        )}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t('social.posts.detail.actions.confirmCancel')}
                    </Button>
                    <Button
                        disabled={!feedback.trim() || isPending}
                        onClick={() => onConfirm(feedback.trim())}
                    >
                        {isPending
                            ? t('social.posts.detail.actions.requestingChanges')
                            : t('social.posts.detail.actions.requestChanges')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Schedule dialog
// ---------------------------------------------------------------------------

/** Props for the ScheduleDialog component. */
export interface ScheduleDialogProps {
    readonly open: boolean;
    readonly isPending: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (
        scheduledAt: string,
        timezone: string,
        recurrenceType: string,
        recurrenceParamsJson: Record<string, unknown> | undefined
    ) => void;
    readonly scheduleAt: string;
    readonly scheduleTz: string;
    readonly onScheduleAtChange: (v: string) => void;
    readonly onScheduleTzChange: (v: string) => void;
}

/** Weekday options accepted by the WEEKLY recurrence type. */
const WEEKDAY_VALUES = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
] as const;

type Weekday = (typeof WEEKDAY_VALUES)[number];

/**
 * Dialog for scheduling a social post.
 * Requires a datetime-local value and timezone before enabling the confirm button.
 * When recurrenceType is WEEKLY, also requires a weekday selection.
 */
export function ScheduleDialog({
    open,
    isPending,
    onClose,
    onConfirm,
    scheduleAt,
    scheduleTz,
    onScheduleAtChange,
    onScheduleTzChange
}: ScheduleDialogProps) {
    const { t } = useTranslations();
    const [recurrenceType, setRecurrenceType] = useState<string>(SocialRecurrenceTypeEnum.ONCE);
    const [weekday, setWeekday] = useState<Weekday>('MONDAY');

    const isWeekly = recurrenceType === SocialRecurrenceTypeEnum.WEEKLY;

    const handleConfirm = () => {
        const paramsJson: Record<string, unknown> | undefined = isWeekly ? { weekday } : undefined;
        onConfirm(new Date(scheduleAt).toISOString(), scheduleTz, recurrenceType, paramsJson);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('social.posts.detail.actions.schedule')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="sched-at">
                            {t('social.posts.detail.actions.scheduleAt')}
                        </Label>
                        <Input
                            id="sched-at"
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={(e) => onScheduleAtChange(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sched-tz">
                            {t('social.posts.detail.actions.scheduleTimezone')}
                        </Label>
                        <Input
                            id="sched-tz"
                            value={scheduleTz}
                            onChange={(e) => onScheduleTzChange(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sched-recurrence">
                            {t('social.posts.detail.actions.recurrenceLabel')}
                        </Label>
                        <select
                            id="sched-recurrence"
                            value={recurrenceType}
                            onChange={(e) => setRecurrenceType(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value={SocialRecurrenceTypeEnum.ONCE}>
                                {t('social.posts.detail.actions.recurrenceOnce')}
                            </option>
                            <option value={SocialRecurrenceTypeEnum.WEEKLY}>
                                {t('social.posts.detail.actions.recurrenceWeekly')}
                            </option>
                            <option value={SocialRecurrenceTypeEnum.BIWEEKLY}>
                                {t('social.posts.detail.actions.recurrenceBiweekly')}
                            </option>
                            <option value={SocialRecurrenceTypeEnum.MONTHLY}>
                                {t('social.posts.detail.actions.recurrenceMonthly')}
                            </option>
                        </select>
                    </div>
                    {isWeekly && (
                        <div className="space-y-1">
                            <Label htmlFor="sched-weekday">
                                {t('social.posts.detail.actions.weekdayLabel')}
                            </Label>
                            <select
                                id="sched-weekday"
                                value={weekday}
                                onChange={(e) => setWeekday(e.target.value as Weekday)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {WEEKDAY_VALUES.map((day) => (
                                    <option
                                        key={day}
                                        value={day}
                                    >
                                        {t(
                                            `social.posts.detail.actions.weekday${day[0]}${day.slice(1).toLowerCase()}` as Parameters<
                                                typeof t
                                            >[0]
                                        )}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t('social.posts.detail.actions.confirmCancel')}
                    </Button>
                    <Button
                        disabled={!scheduleAt || !scheduleTz || isPending}
                        onClick={handleConfirm}
                    >
                        {isPending
                            ? t('social.posts.detail.actions.scheduling')
                            : t('social.posts.detail.actions.schedule')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Publish now dialog
// ---------------------------------------------------------------------------

/** Props for the {@link PublishNowDialog} component. */
export interface PublishNowDialogProps {
    readonly open: boolean;
    readonly isPending: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
}

/**
 * Confirmation dialog for publishing a post immediately.
 * Marks the post ready and hands it to the dispatch cron (publishes within minutes).
 */
export function PublishNowDialog({ open, isPending, onClose, onConfirm }: PublishNowDialogProps) {
    const { t } = useTranslations();

    return (
        <Dialog
            open={open}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('social.posts.detail.sidePanel.publishNowConfirmTitle')}
                    </DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground text-sm">
                    {t('social.posts.detail.sidePanel.publishNowConfirmBody')}
                </p>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t('social.posts.detail.actions.confirmCancel')}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending
                            ? t('social.posts.detail.sidePanel.publishingNow')
                            : t('social.posts.detail.sidePanel.publishNowConfirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
