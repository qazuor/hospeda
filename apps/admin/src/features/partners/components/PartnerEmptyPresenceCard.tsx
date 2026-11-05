import type { TranslationKey } from '@repo/i18n';
import { DeleteIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/ToastProvider';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { ApiError } from '@/lib/errors';
import { usePartnerEmptyPresenceMutation } from '../hooks/usePartnerEmptyPresenceMutation';

/** Props for the destructive Partner presence action. */
export interface PartnerEmptyPresenceCardProps {
    /** Partner UUID. */
    readonly partnerId: string;
    /** Partner name shown in the irreversible action confirmation. */
    readonly partnerName: string;
}

/** Renders action 25 behind its dedicated permission and confirms its irreversible effect. */
export function PartnerEmptyPresenceCard({
    partnerId,
    partnerName
}: PartnerEmptyPresenceCardProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = usePartnerEmptyPresenceMutation(partnerId);
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setReason('');
            setErrorKey(null);
        }
    };

    const handleConfirm = async () => {
        const trimmedReason = reason.trim();
        if (!trimmedReason || mutation.isPending) return;
        try {
            await mutation.mutateAsync({ reason: trimmedReason });
            handleOpenChange(false);
            addToast({
                title: t('admin-entities.partnerEmptyPresence.successTitle'),
                message: t('admin-entities.partnerEmptyPresence.successMessage', {
                    name: partnerName
                }),
                variant: 'success'
            });
        } catch (error) {
            setErrorKey(getEmptyPresenceErrorKey(error));
        }
    };

    return (
        <PermissionGate permissions={[PermissionEnum.PARTNER_EMPTY_PRESENCE]}>
            <Card data-testid="partner-empty-presence">
                <CardHeader>
                    <CardTitle className="font-medium text-sm">
                        {t('admin-entities.partnerEmptyPresence.title')}
                    </CardTitle>
                    <CardDescription>
                        {t('admin-entities.partnerEmptyPresence.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setOpen(true)}
                        data-testid="partner-empty-presence-open"
                    >
                        <DeleteIcon size={16} />
                        {t('admin-entities.partnerEmptyPresence.action')}
                    </Button>
                    <AlertDialog
                        open={open}
                        onOpenChange={handleOpenChange}
                    >
                        <AlertDialogContent data-testid="partner-empty-presence-dialog">
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {t('admin-entities.partnerEmptyPresence.dialog.title', {
                                        name: partnerName
                                    })}
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="space-y-2">
                                        <p>
                                            {t(
                                                'admin-entities.partnerEmptyPresence.dialog.deletes',
                                                { name: partnerName }
                                            )}
                                        </p>
                                        <p>
                                            {t(
                                                'admin-entities.partnerEmptyPresence.dialog.pending'
                                            )}
                                        </p>
                                        <p>
                                            {t(
                                                'admin-entities.partnerEmptyPresence.dialog.untouched'
                                            )}
                                        </p>
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2">
                                <Label htmlFor="partner-empty-presence-reason">
                                    {t('admin-entities.partnerEmptyPresence.dialog.reasonLabel')}
                                </Label>
                                <Textarea
                                    id="partner-empty-presence-reason"
                                    data-testid="partner-empty-presence-reason"
                                    value={reason}
                                    maxLength={500}
                                    aria-describedby="partner-empty-presence-reason-help"
                                    onChange={(event) => setReason(event.target.value)}
                                />
                                <p
                                    id="partner-empty-presence-reason-help"
                                    className="text-muted-foreground text-xs"
                                >
                                    {t('admin-entities.partnerEmptyPresence.dialog.reasonHelp')}
                                </p>
                            </div>
                            {errorKey ? (
                                <p
                                    role="alert"
                                    data-testid="partner-empty-presence-error"
                                >
                                    {t(errorKey)}
                                </p>
                            ) : null}
                            <AlertDialogFooter>
                                <AlertDialogCancel data-testid="partner-empty-presence-cancel">
                                    {t('admin-entities.partnerEmptyPresence.dialog.cancel')}
                                </AlertDialogCancel>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={!reason.trim() || mutation.isPending}
                                    onClick={() => void handleConfirm()}
                                    data-testid="partner-empty-presence-confirm"
                                >
                                    {t(
                                        mutation.isPending
                                            ? 'admin-entities.partnerEmptyPresence.dialog.confirming'
                                            : 'admin-entities.partnerEmptyPresence.dialog.confirm'
                                    )}
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </PermissionGate>
    );
}

/** Maps the API's action 25 rejection contract to its localized explanation. */
function getEmptyPresenceErrorKey(error: unknown): TranslationKey {
    if (!(error instanceof ApiError)) return 'admin-entities.partnerEmptyPresence.errors.title';
    if (error.status === 403) return 'admin-entities.partnerEmptyPresence.errors.forbidden';
    if (error.status === 503) return 'admin-entities.partnerEmptyPresence.errors.storage';
    if (error.status === 409) {
        const body = error.body as { error?: { reason?: string } } | undefined;
        if (body?.error?.reason === 'PRESENCE_ALREADY_EMPTY')
            return 'admin-entities.partnerEmptyPresence.errors.alreadyEmpty';
        if (body?.error?.reason === 'PRESENCE_STATE_CHANGED')
            return 'admin-entities.partnerEmptyPresence.errors.stateChanged';
    }
    return 'admin-entities.partnerEmptyPresence.errors.title';
}
