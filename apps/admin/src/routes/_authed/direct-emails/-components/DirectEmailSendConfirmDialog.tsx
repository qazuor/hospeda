/**
 * @file DirectEmailSendConfirmDialog.tsx
 * @description Confirmation before a direct email is sent (HOS-2685). Lists the
 * subject and every recipient, because the send is immediate and irreversible.
 */

import { LoaderIcon } from '@repo/icons';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';

/** Props for DirectEmailSendConfirmDialog. */
export interface DirectEmailSendConfirmDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly subject: string;
    readonly recipients: ReadonlyArray<string>;
    readonly isPending: boolean;
    readonly onConfirm: () => void | Promise<void>;
}

/**
 * Send confirmation dialog.
 *
 * @param props - DirectEmailSendConfirmDialogProps
 */
export function DirectEmailSendConfirmDialog({
    open,
    onOpenChange,
    subject,
    recipients,
    isPending,
    onConfirm
}: DirectEmailSendConfirmDialogProps) {
    const { t, tPlural } = useTranslations();

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!isPending) onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('admin-direct-email.sendConfirm.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-direct-email.sendConfirm.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <p>
                        <span className="font-medium">
                            {t('admin-direct-email.sendConfirm.subjectLabel')}:
                        </span>{' '}
                        {subject}
                    </p>
                    <p className="font-medium">
                        {tPlural('admin-direct-email.sendConfirm.summary', recipients.length)}
                    </p>
                    <ul
                        className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5"
                        data-testid="send-confirm-recipients"
                    >
                        {recipients.map((email) => (
                            <li key={email}>{email}</li>
                        ))}
                    </ul>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        {t('admin-direct-email.sendConfirm.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void onConfirm()}
                        disabled={isPending}
                    >
                        {isPending && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                        {isPending
                            ? t('admin-direct-email.sendConfirm.sending')
                            : t('admin-direct-email.sendConfirm.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
