import type { TranslationKey } from '@repo/i18n';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { ApiError } from '@/lib/errors';
import { usePartnerPresenceModerationMutation } from '../hooks/usePartnerPresenceModerationMutation';

/** Props for {@link PartnerPresenceModerationCard}. AC:V7:14; ACC:12 (sources: action 13). */
export interface PartnerPresenceModerationCardProps {
    /** Partner UUID. AC:V7:14; ACC:12 (sources: action 13). */
    readonly partnerId: string;
    /** Current public presence moderation bit. AC:V7:14; ACC:12 (sources: action 13). */
    readonly presenceModerated: boolean;
}

/** Shows a Partner presence state and its single ACC:12 control. AC:V7:14; ACC:12 (sources: action 13). */
export function PartnerPresenceModerationCard({
    partnerId,
    presenceModerated
}: PartnerPresenceModerationCardProps) {
    const { t } = useTranslations();
    const mutation = usePartnerPresenceModerationMutation(partnerId);
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const action = presenceModerated ? 'LIFT' : 'MODERATE';

    const confirm = async () => {
        try {
            await mutation.mutateAsync({ action, reason });
            setErrorKey(null);
            setReason('');
            setOpen(false);
        } catch (error) {
            setErrorKey(
                error instanceof ApiError && error.status === 409
                    ? 'admin-entities.partnerPresenceModeration.errors.alreadyApplied'
                    : 'admin-entities.partnerPresenceModeration.errors.title'
            );
        }
    };

    return (
        <Card data-testid="partner-presence-moderation">
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.partnerPresenceModeration.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <Badge variant={presenceModerated ? 'destructive' : 'success'}>
                    {t(
                        presenceModerated
                            ? 'admin-entities.partnerPresenceModeration.state.moderated'
                            : 'admin-entities.partnerPresenceModeration.state.visible'
                    )}
                </Badge>
                <PermissionGate permissions={[PermissionEnum.LISTING_MODERATE]}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(true)}
                    >
                        {t(
                            presenceModerated
                                ? 'admin-entities.partnerPresenceModeration.actions.lift'
                                : 'admin-entities.partnerPresenceModeration.actions.moderate'
                        )}
                    </Button>
                    <AlertDialog
                        open={open}
                        onOpenChange={setOpen}
                    >
                        <AlertDialogContent data-testid="partner-presence-moderation-dialog">
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {t(
                                        presenceModerated
                                            ? 'admin-entities.partnerPresenceModeration.actions.lift'
                                            : 'admin-entities.partnerPresenceModeration.actions.moderate'
                                    )}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t(
                                        'admin-entities.partnerPresenceModeration.dialog.reasonHelp'
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2">
                                <Label htmlFor="partner-presence-moderation-reason">
                                    {t(
                                        'admin-entities.partnerPresenceModeration.dialog.reasonLabel'
                                    )}
                                </Label>
                                <Textarea
                                    id="partner-presence-moderation-reason"
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                />
                            </div>
                            {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
                            <AlertDialogFooter>
                                <AlertDialogCancel>
                                    {t('admin-entities.partnerPresenceModeration.dialog.cancel')}
                                </AlertDialogCancel>
                                <Button
                                    type="button"
                                    disabled={!reason.trim() || mutation.isPending}
                                    onClick={() => void confirm()}
                                >
                                    {t('admin-entities.partnerPresenceModeration.dialog.confirm')}
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </PermissionGate>
            </CardContent>
        </Card>
    );
}
