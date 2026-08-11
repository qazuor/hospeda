/**
 * @file SuspendDeclarationDialog.tsx
 * @description Confirms a declaration-suspension decision (HOS-376 T-056).
 *
 * ONE dialog for both directions, because the API is one endpoint carrying a
 * boolean. Split in two, the screen could grow a "suspend" path that posts a
 * lift — this way the mode that renders the copy is the same value that
 * travels.
 *
 * The typed reason is reset by REMOUNTING — the page keys this component on the
 * decision, so opening a second dialog builds fresh state. An effect watching
 * the target would do the same thing later, after a render in which the
 * previous provider's reason is still in the box and the confirm button is
 * already live.
 *
 * The reason is asked for when SUSPENDING and not when lifting, matching what
 * the endpoint accepts. A suspension takes away a provider's ability to record
 * work at all and he is owed an answer; lifting restores the normal state and
 * explains itself. Asking for a reason the API discards would put words in a
 * field nobody will ever read back.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isSuspensionReasonAcceptable } from '@/features/host-trades/lib/usage-suspension-rules';
import { useTranslations } from '@/hooks/use-translations';

/** The decision the dialog is confirming. */
export interface SuspensionTarget {
    readonly hostTradeId: string;
    readonly providerName: string;
    /** `true` suspends, `false` lifts. */
    readonly suspended: boolean;
}

/** Props for {@link SuspendDeclarationDialog}. */
export interface SuspendDeclarationDialogProps {
    /** The pending decision, or `null` when the dialog is closed. */
    readonly target: SuspensionTarget | null;
    readonly onOpenChange: (open: boolean) => void;
    readonly onConfirm: (input: { reason?: string }) => void;
    readonly isPending: boolean;
}

/**
 * Confirmation dialog for suspending or lifting a provider's declaring.
 *
 * @param props - {@link SuspendDeclarationDialogProps}
 */
export function SuspendDeclarationDialog({
    target,
    onOpenChange,
    onConfirm,
    isPending
}: SuspendDeclarationDialogProps) {
    const { t } = useTranslations();
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);

    if (!target) {
        return null;
    }

    const isSuspending = target.suspended;
    const reasonAcceptable = isSuspensionReasonAcceptable(reason);
    const showReasonError = isSuspending && touched && !reasonAcceptable;

    return (
        <Dialog
            open={true}
            onOpenChange={onOpenChange}
        >
            <DialogContent data-testid="declaration-suspension-dialog">
                <DialogHeader>
                    <DialogTitle>
                        {isSuspending
                            ? t('admin-pages.hostTradeUsages.usages.suspendDialog.title')
                            : t('admin-pages.hostTradeUsages.suspensions.liftDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {isSuspending
                            ? t('admin-pages.hostTradeUsages.usages.suspendDialog.message', {
                                  name: target.providerName
                              })
                            : t('admin-pages.hostTradeUsages.suspensions.liftDialog.message', {
                                  name: target.providerName
                              })}
                    </DialogDescription>
                </DialogHeader>

                {isSuspending ? (
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="suspension-reason">
                            {t('admin-pages.hostTradeUsages.usages.suspendDialog.reasonLabel')}
                        </Label>
                        <Textarea
                            id="suspension-reason"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            onBlur={() => setTouched(true)}
                            placeholder={t(
                                'admin-pages.hostTradeUsages.usages.suspendDialog.reasonPlaceholder'
                            )}
                            aria-invalid={showReasonError}
                        />
                        {showReasonError && (
                            <p
                                className="text-destructive text-sm"
                                role="alert"
                            >
                                {t(
                                    'admin-pages.hostTradeUsages.usages.suspendDialog.reasonRequired'
                                )}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.hostTradeUsages.suspensions.liftDialog.note')}
                    </p>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => onOpenChange(false)}
                    >
                        {isSuspending
                            ? t('admin-pages.hostTradeUsages.usages.suspendDialog.cancel')
                            : t('admin-pages.hostTradeUsages.suspensions.liftDialog.cancel')}
                    </Button>
                    <Button
                        variant={isSuspending ? 'destructive' : 'default'}
                        disabled={isPending || (isSuspending && !reasonAcceptable)}
                        data-testid="declaration-suspension-confirm"
                        onClick={() => {
                            setTouched(true);
                            // The trimmed value is what gets stored and shown to
                            // the provider; sending the raw text would persist
                            // whatever padding the textarea collected.
                            onConfirm(isSuspending ? { reason: reason.trim() } : {});
                        }}
                    >
                        {isSuspending
                            ? t('admin-pages.hostTradeUsages.usages.suspendDialog.confirm')
                            : t('admin-pages.hostTradeUsages.suspensions.liftDialog.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
