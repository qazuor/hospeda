/**
 * @file ListingModerationActionDialog.tsx
 * The confirmation of ONE listing moderation action, with its reason (HOS-1684).
 *
 * The dialog says what is going to happen instead of asking whether the admin
 * is sure (H10): for `TAKE_DOWN`, that the listing leaves the public site,
 * that the owner gets the notice and can view, edit and delete it but not
 * publish it, and that recurring featured placements keep being charged.
 *
 * Fields by action, mirroring `ListingModerationActionSchema`:
 * - every action: `reason` (required, trimmed, at most 2000 characters);
 * - `REQUEST_FIX`: an optional `suggestedDate` (sent as `null` when empty);
 * - `LIFT`: `keepFixRequest` (off by default: lifting closes the request).
 *
 * The body is built per action and passed through
 * `ListingModerationActionSchema.safeParse` before `onConfirm` receives it, so
 * the route never gets a body its schema would refuse. TanStack Form, the
 * admin's form standard (molde: `BlockDialog`).
 */

import type { TranslationKey } from '@repo/i18n';
import { type ListingModerationAction, ListingModerationActionSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useEffect, useId, useState } from 'react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import type { ListingModerationActionKind } from '../config/listing-moderation-actions';

/** Max length of the reason, the same the API schema enforces. */
const REASON_MAX_LENGTH = 2000;

/** Copy of one action's dialog. */
interface ActionDialogCopy {
    readonly title: TranslationKey;
    /** Paragraphs of the description; the first receives `{name}`. */
    readonly description: readonly TranslationKey[];
    readonly confirm: TranslationKey;
    /** Variant of the confirm button: taking a listing down is destructive. */
    readonly confirmVariant: 'destructive' | 'default';
    /** Whether the action carries a suggested date (`REQUEST_FIX`). */
    readonly withSuggestedDate: boolean;
    /** Whether the action carries `keepFixRequest` (`LIFT`). */
    readonly withKeepFixRequest: boolean;
}

/** Dialog copy per action. */
const DIALOG_COPY: Readonly<Record<ListingModerationActionKind, ActionDialogCopy>> = {
    REQUEST_FIX: {
        title: 'admin-entities.listingModeration.dialog.requestFix.title',
        description: ['admin-entities.listingModeration.dialog.requestFix.description'],
        confirm: 'admin-entities.listingModeration.confirm.requestFix',
        confirmVariant: 'default',
        withSuggestedDate: true,
        withKeepFixRequest: false
    },
    TAKE_DOWN: {
        title: 'admin-entities.listingModeration.dialog.takeDown.title',
        description: [
            'admin-entities.listingModeration.dialog.takeDown.description',
            'admin-entities.listingModeration.dialog.takeDown.ownerNotice',
            'admin-entities.listingModeration.dialog.takeDown.featured'
        ],
        confirm: 'admin-entities.listingModeration.confirm.takeDown',
        confirmVariant: 'destructive',
        withSuggestedDate: false,
        withKeepFixRequest: false
    },
    LIFT: {
        title: 'admin-entities.listingModeration.dialog.lift.title',
        description: ['admin-entities.listingModeration.dialog.lift.description'],
        confirm: 'admin-entities.listingModeration.confirm.lift',
        confirmVariant: 'default',
        withSuggestedDate: false,
        withKeepFixRequest: true
    },
    CLOSE_FIX_REQUEST: {
        title: 'admin-entities.listingModeration.dialog.closeFixRequest.title',
        description: ['admin-entities.listingModeration.dialog.closeFixRequest.description'],
        confirm: 'admin-entities.listingModeration.confirm.closeFixRequest',
        confirmVariant: 'default',
        withSuggestedDate: false,
        withKeepFixRequest: false
    }
};

/** Values of the dialog's form. */
interface ModerationFormValues {
    readonly reason: string;
    readonly suggestedDate: string;
    readonly keepFixRequest: boolean;
}

const DEFAULT_VALUES: ModerationFormValues = {
    reason: '',
    suggestedDate: '',
    keepFixRequest: false
};

/**
 * Builds the request body of one action from the form values. Only the fields
 * of that action's schema variant are present.
 */
function buildBody({
    action,
    values
}: {
    readonly action: ListingModerationActionKind;
    readonly values: ModerationFormValues;
}): Record<string, unknown> {
    const reason = values.reason.trim();
    switch (action) {
        case 'REQUEST_FIX':
            return { action, reason, suggestedDate: values.suggestedDate || null };
        case 'LIFT':
            return { action, reason, keepFixRequest: values.keepFixRequest };
        case 'TAKE_DOWN':
        case 'CLOSE_FIX_REQUEST':
            return { action, reason };
    }
}

/** Props for {@link ListingModerationActionDialog}. RO-RO pattern. */
export interface ListingModerationActionDialogProps {
    /** The action being confirmed. */
    readonly action: ListingModerationActionKind;
    /** Listing name shown in the description; falls back to the id upstream. */
    readonly entityName: string;
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Called when the dialog asks to open or close. */
    readonly onOpenChange: (next: boolean) => void;
    /** Whether the moderation request is in flight. */
    readonly isPending: boolean;
    /** Receives the validated body of the action. */
    readonly onConfirm: (body: ListingModerationAction) => Promise<void>;
}

/**
 * Renders the confirmation of one moderation action with its reason and the
 * action's own fields.
 *
 * @param props - The action, the listing name, the open state and the confirm handler.
 */
export function ListingModerationActionDialog({
    action,
    entityName,
    open,
    onOpenChange,
    isPending,
    onConfirm
}: ListingModerationActionDialogProps) {
    const { t } = useTranslations();
    const [invalid, setInvalid] = useState(false);
    const reasonId = useId();
    const reasonHelpId = useId();
    const dateId = useId();
    const keepId = useId();
    const formId = useId();
    const copy = DIALOG_COPY[action];

    const form = useForm({
        defaultValues: DEFAULT_VALUES,
        onSubmit: async ({ value }) => {
            const parsed = ListingModerationActionSchema.safeParse(
                buildBody({ action, values: value })
            );
            if (!parsed.success) {
                setInvalid(true);
                return;
            }
            setInvalid(false);
            await onConfirm(parsed.data);
        }
    });

    useEffect(() => {
        if (!open) {
            form.reset();
            setInvalid(false);
        }
    }, [open, form]);

    return (
        <AlertDialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <AlertDialogContent data-testid="listing-moderation-dialog">
                <form
                    id={formId}
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t(copy.title)}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                {copy.description.map((key) => (
                                    <p key={key}>{t(key, { name: entityName })}</p>
                                ))}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <form.Field name="reason">
                        {(field) => (
                            <div className="space-y-2">
                                <Label htmlFor={reasonId}>
                                    {t('admin-entities.listingModeration.reasonLabel')}
                                </Label>
                                <Textarea
                                    id={reasonId}
                                    name={field.name}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    aria-describedby={reasonHelpId}
                                    required
                                    maxLength={REASON_MAX_LENGTH}
                                    data-testid="listing-moderation-reason"
                                />
                                <p
                                    id={reasonHelpId}
                                    className="text-muted-foreground text-xs"
                                >
                                    {t('admin-entities.listingModeration.reasonHelp')}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    {copy.withSuggestedDate ? (
                        <form.Field name="suggestedDate">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor={dateId}>
                                        {t(
                                            'admin-entities.listingModeration.dialog.requestFix.suggestedDateLabel'
                                        )}
                                    </Label>
                                    <Input
                                        id={dateId}
                                        type="date"
                                        name={field.name}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                        data-testid="listing-moderation-suggested-date"
                                    />
                                </div>
                            )}
                        </form.Field>
                    ) : null}

                    {copy.withKeepFixRequest ? (
                        <form.Field name="keepFixRequest">
                            {(field) => (
                                <div className="flex items-start gap-3">
                                    <Switch
                                        id={keepId}
                                        checked={field.state.value}
                                        onCheckedChange={(checked) => field.handleChange(checked)}
                                        data-testid="listing-moderation-keep-fix-request"
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor={keepId}>
                                            {t(
                                                'admin-entities.listingModeration.dialog.lift.keepFixRequestLabel'
                                            )}
                                        </Label>
                                        <p className="text-muted-foreground text-xs">
                                            {t(
                                                'admin-entities.listingModeration.dialog.lift.keepFixRequestHelp'
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </form.Field>
                    ) : null}

                    {invalid ? (
                        <p
                            className="text-destructive text-xs"
                            role="alert"
                        >
                            {t('admin-entities.listingModeration.errors.invalid')}
                        </p>
                    ) : null}

                    <AlertDialogFooter>
                        <AlertDialogCancel data-testid="listing-moderation-cancel">
                            {t('admin-entities.listingModeration.cancel')}
                        </AlertDialogCancel>
                        <form.Subscribe selector={(state) => state.values.reason}>
                            {(reason) => (
                                <Button
                                    type="button"
                                    onClick={() => form.handleSubmit()}
                                    variant={copy.confirmVariant}
                                    disabled={reason.trim().length === 0 || isPending}
                                    data-testid="listing-moderation-confirm"
                                >
                                    {t(copy.confirm)}
                                </Button>
                            )}
                        </form.Subscribe>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
