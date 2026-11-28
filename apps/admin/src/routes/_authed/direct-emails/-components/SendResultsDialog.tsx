/**
 * @file SendResultsDialog.tsx
 * @description Per-recipient result of a direct email send (HOS-2685). A failure
 * on one recipient never stops the others, so the admin needs to see each
 * outcome before moving to the history detail page.
 */

import type { DirectEmailRecipientStatusEnum, DirectEmailSendResult } from '@repo/schemas';
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
import { RecipientStatusBadge } from './RecipientStatusBadge';

/** Props for SendResultsDialog. */
export interface SendResultsDialogProps {
    readonly open: boolean;
    readonly results: ReadonlyArray<DirectEmailSendResult>;
    /** Called when the admin continues to the detail page (button or dismiss). */
    readonly onContinue: () => void;
}

/**
 * Tallies results by status.
 *
 * @param input.results - Send results.
 * @returns Counts for the three possible send outcomes.
 */
export function summarizeResults({
    results
}: {
    readonly results: ReadonlyArray<DirectEmailSendResult>;
}): { readonly sent: number; readonly failed: number; readonly suppressed: number } {
    return {
        sent: results.filter((item) => item.status === 'sent').length,
        failed: results.filter((item) => item.status === 'failed').length,
        suppressed: results.filter((item) => item.status === 'suppressed').length
    };
}

/**
 * Dialog listing the outcome of each recipient.
 *
 * @param props - SendResultsDialogProps
 */
export function SendResultsDialog({ open, results, onContinue }: SendResultsDialogProps) {
    const { t } = useTranslations();
    const summary = summarizeResults({ results });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onContinue();
            }}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('admin-direct-email.results.title')}</DialogTitle>
                    <DialogDescription data-testid="send-results-summary">
                        {t('admin-direct-email.results.summary', summary)}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-80 overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                            <tr>
                                <th className="px-3 py-2 font-medium">
                                    {t('admin-direct-email.results.colEmail')}
                                </th>
                                <th className="px-3 py-2 font-medium">
                                    {t('admin-direct-email.results.colStatus')}
                                </th>
                                <th className="px-3 py-2 font-medium">
                                    {t('admin-direct-email.results.colError')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result) => (
                                <tr
                                    key={result.email}
                                    className="border-t"
                                >
                                    <td className="px-3 py-2">{result.email}</td>
                                    <td className="px-3 py-2">
                                        <RecipientStatusBadge
                                            status={result.status as DirectEmailRecipientStatusEnum}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                        {result.error ?? ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        onClick={onContinue}
                    >
                        {t('admin-direct-email.results.viewMessage')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
