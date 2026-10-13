/**
 * @file AccountCloseOnRequestCard.tsx
 * The panel control for administrative action 24 (HOS-1494): close an account
 * at its owner's request, with a mandatory reason.
 *
 * The dialog reads the action 24 preview first and shows one of three things:
 *  - the preview could not be read: 404 (the account is gone or already closed)
 *    and 403 (the actor's own account or a system account) say so, with no
 *    action;
 *  - `ready = false`: WHAT is missing, one line per precondition that blocks,
 *    each naming the step of the manual closure that clears it, and no confirm
 *    button at all;
 *  - `ready = true`: the confirmation says WHAT is going to happen (audit §3
 *    rule 1) instead of asking whether the admin is sure: whose account it is
 *    (current name and mailbox), that nothing is left to charge and no listing
 *    or partner presence remains, that the account is pseudonymised and loses
 *    access for good, and that receipts and the log are not touched.
 *
 * The preview informs and decides nothing: the closure re-reads everything under
 * its own locks. A 409 therefore means the account changed since the dialog
 * opened; the dialog says so and reads the preview again, without retrying.
 *
 * Gated by `USER_CLOSE_ON_REQUEST` (a permission, never a role).
 */

import { AlertCircleIcon, DeleteIcon, LoaderIcon } from '@repo/icons';
import { type AccountClosurePreview, PermissionEnum } from '@repo/schemas';
import { useId, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/ToastProvider';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { adminLogger } from '@/utils/logger';
import {
    useAccountClosurePreview,
    useCloseAccountOnRequestMutation
} from '../hooks/useAccountClosure';

/** HTTP status the closure answers when the account changed meanwhile. */
const STATE_CHANGED_STATUS = 409;
/** HTTP status for the actor's own account or a system account. */
const FORBIDDEN_STATUS = 403;
/** HTTP status for an account that is gone or already closed. */
const NOT_FOUND_STATUS = 404;

/** Message the dialog shows after a refused closure, if any. */
type ClosureNotice = 'stateChanged' | 'forbidden' | null;

/** Props for {@link AccountCloseOnRequestCard}. RO-RO pattern. */
export interface AccountCloseOnRequestCardProps {
    /** UUID of the account. */
    readonly userId: string;
    /** Called after a successful closure. The detail page navigates to the list. */
    readonly onClosed?: () => void;
}

/**
 * Renders the "close the account at its owner's request" button and its
 * dialog: the preview, what blocks the closure or what it does, and the
 * mandatory reason.
 *
 * @param props - The account id and the success callback.
 */
export function AccountCloseOnRequestCard({ userId, onClosed }: AccountCloseOnRequestCardProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [notice, setNotice] = useState<ClosureNotice>(null);
    const preview = useAccountClosurePreview({ userId, enabled: open });
    const mutation = useCloseAccountOnRequestMutation();
    const reasonId = useId();
    const reasonHelpId = useId();

    const trimmedReason = reason.trim();
    const ready = preview.data?.ready === true && notice !== 'forbidden';
    const canConfirm = ready && trimmedReason.length > 0 && !mutation.isPending;

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setReason('');
            setNotice(null);
        }
    };

    const handleConfirm = async () => {
        if (trimmedReason.length === 0) return;
        try {
            await mutation.mutateAsync({ userId, reason: trimmedReason });
            handleOpenChange(false);
            addToast({
                title: t('admin-entities.accountCloseOnRequest.successTitle'),
                message: t('admin-entities.accountCloseOnRequest.successMessage'),
                variant: 'success'
            });
            onClosed?.();
        } catch (error) {
            adminLogger.error('[AccountCloseOnRequestCard] Failed to close the account', {
                userId,
                error
            });
            if (isApiError(error) && error.status === STATE_CHANGED_STATUS) {
                // Something changed between the preview and the locks: the
                // account was NOT closed. Read the preview again; never retry.
                setNotice('stateChanged');
                await preview.refetch();
                return;
            }
            if (isApiError(error) && error.status === FORBIDDEN_STATUS) {
                setNotice('forbidden');
                return;
            }
            addToast({
                title: t('admin-entities.accountCloseOnRequest.errorTitle'),
                message:
                    error instanceof Error
                        ? error.message
                        : t('admin-entities.accountCloseOnRequest.errorTitle'),
                variant: 'error'
            });
        }
    };

    return (
        <PermissionGate permissions={[PermissionEnum.USER_CLOSE_ON_REQUEST]}>
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    disabled={mutation.isPending}
                    className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10 disabled:opacity-50 sm:px-3"
                    data-testid="account-close-on-request"
                >
                    <DeleteIcon size={16} />
                    <span>{t('admin-entities.accountCloseOnRequest.action')}</span>
                </button>
            </div>
            <AlertDialog
                open={open}
                onOpenChange={handleOpenChange}
            >
                <AlertDialogContent data-testid="account-close-on-request-dialog">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('admin-entities.accountCloseOnRequest.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <ClosureNoticeLine notice={notice} />
                                <PreviewBody
                                    isLoading={preview.isLoading}
                                    error={preview.error}
                                    data={preview.data}
                                />
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {ready ? (
                        <div className="space-y-2">
                            <Label htmlFor={reasonId}>
                                {t('admin-entities.accountCloseOnRequest.reasonLabel')}
                            </Label>
                            <Textarea
                                id={reasonId}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                aria-describedby={reasonHelpId}
                                required
                                maxLength={2000}
                                data-testid="account-close-on-request-reason"
                            />
                            <p
                                id={reasonHelpId}
                                className="text-muted-foreground text-xs"
                            >
                                {t('admin-entities.accountCloseOnRequest.reasonHelp')}
                            </p>
                        </div>
                    ) : null}
                    <AlertDialogFooter>
                        <AlertDialogCancel data-testid="account-close-on-request-cancel">
                            {ready
                                ? t('admin-entities.accountCloseOnRequest.cancel')
                                : t('admin-entities.accountCloseOnRequest.close')}
                        </AlertDialogCancel>
                        {ready ? (
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={!canConfirm}
                                onClick={handleConfirm}
                                data-testid="account-close-on-request-confirm"
                            >
                                {t('admin-entities.accountCloseOnRequest.confirm')}
                            </Button>
                        ) : null}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGate>
    );
}

/** The line a refused closure leaves in the dialog. */
function ClosureNoticeLine({ notice }: { readonly notice: ClosureNotice }) {
    const { t } = useTranslations();
    if (notice === null) return null;
    return (
        <p
            role="alert"
            className="flex items-start gap-2 font-medium text-destructive"
            data-testid="account-close-on-request-notice"
        >
            <AlertCircleIcon
                size={16}
                className="mt-0.5 shrink-0"
            />
            <span>
                {notice === 'stateChanged'
                    ? t('admin-entities.accountCloseOnRequest.stateChanged')
                    : t('admin-entities.accountCloseOnRequest.forbidden')}
            </span>
        </p>
    );
}

/** Props of {@link PreviewBody}. */
interface PreviewBodyProps {
    readonly isLoading: boolean;
    readonly error: unknown;
    readonly data: AccountClosurePreview | undefined;
}

/** What the preview says: loading, refused, blocked or ready. */
function PreviewBody({ isLoading, error, data }: PreviewBodyProps) {
    const { t } = useTranslations();

    if (isLoading) {
        return (
            <p
                className="flex items-center gap-2"
                data-testid="account-close-on-request-loading"
            >
                <LoaderIcon className="size-4 animate-spin" />
                <span>{t('admin-entities.accountCloseOnRequest.loading')}</span>
            </p>
        );
    }

    if (error) {
        const status = isApiError(error) ? error.status : undefined;
        const key =
            status === NOT_FOUND_STATUS
                ? 'admin-entities.accountCloseOnRequest.notFound'
                : status === FORBIDDEN_STATUS
                  ? 'admin-entities.accountCloseOnRequest.forbidden'
                  : 'admin-entities.accountCloseOnRequest.loadError';
        return <p data-testid="account-close-on-request-unavailable">{t(key)}</p>;
    }

    if (!data) return null;

    if (!data.ready) {
        return (
            <div data-testid="account-close-on-request-blocked">
                <p>{t('admin-entities.accountCloseOnRequest.blocked.intro')}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                    {data.canCharge ? (
                        <li data-testid="account-close-on-request-blocked-charge">
                            {t('admin-entities.accountCloseOnRequest.blocked.canCharge')}
                        </li>
                    ) : null}
                    {data.listingsNotPurged > 0 ? (
                        <li data-testid="account-close-on-request-blocked-listings">
                            {t('admin-entities.accountCloseOnRequest.blocked.listings', {
                                count: String(data.listingsNotPurged)
                            })}
                        </li>
                    ) : null}
                    {data.partnerPresenceWithContent ? (
                        <li data-testid="account-close-on-request-blocked-partner">
                            {t('admin-entities.accountCloseOnRequest.blocked.partnerPresence')}
                        </li>
                    ) : null}
                </ul>
            </div>
        );
    }

    return (
        <div
            className="space-y-2"
            data-testid="account-close-on-request-ready"
        >
            <p>
                {t('admin-entities.accountCloseOnRequest.whatHappens.account', {
                    name: data.displayName ?? data.email,
                    email: data.email
                })}
            </p>
            <p>{t('admin-entities.accountCloseOnRequest.whatHappens.nothingLeft')}</p>
            <p>{t('admin-entities.accountCloseOnRequest.whatHappens.pseudonymised')}</p>
            <p>{t('admin-entities.accountCloseOnRequest.whatHappens.untouched')}</p>
        </div>
    );
}
