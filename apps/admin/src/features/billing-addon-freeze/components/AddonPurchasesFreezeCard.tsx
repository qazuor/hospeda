import en from '@repo/i18n/locales/en/admin-billing.json';
import es from '@repo/i18n/locales/es/admin-billing.json';
import pt from '@repo/i18n/locales/pt/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
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
import { usePlatformSetting, useUpdatePlatformSetting } from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';

const COPY_BY_LOCALE = { es, en, pt };

/** Shows and controls the platform-wide addon purchase freeze. */
export function AddonPurchasesFreezeCard() {
    const { locale } = useTranslations();
    const permissions = useUserPermissions();
    const canWrite = permissions.includes(PermissionEnum.BILLING_SETTINGS_WRITE);
    const query = usePlatformSetting({ key: 'billing.addonPurchasesFreeze' });
    const mutation = useUpdatePlatformSetting({ key: 'billing.addonPurchasesFreeze' });
    const [dialogOpen, setDialogOpen] = useState(false);
    const frozen = query.data?.row?.value.frozen ?? false;
    const selectedLocale = locale === 'en' || locale === 'pt' ? locale : 'es';
    const translate = (key: keyof typeof es.settings.addonPurchasesFreeze) =>
        COPY_BY_LOCALE[selectedLocale].settings.addonPurchasesFreeze[key];

    return (
        <Card data-testid="addon-purchases-freeze-card">
            <CardHeader>
                <CardTitle>{translate('title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">{translate('description')}</p>
                <div className="flex items-center gap-2">
                    <Badge
                        variant={frozen ? 'destructive' : 'default'}
                        data-testid="addon-purchases-freeze-status"
                    >
                        {translate(frozen ? 'statusOn' : 'statusOff')}
                    </Badge>
                </div>
                <p className="text-muted-foreground text-sm">{translate('hint')}</p>
                {frozen && (
                    <p
                        className="rounded-md bg-muted p-3 text-sm"
                        role="status"
                    >
                        {translate('activeWarning')}
                    </p>
                )}
                {!canWrite && (
                    <p className="text-muted-foreground text-sm">
                        {translate('noWritePermission')}
                    </p>
                )}
                {mutation.isError && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {translate('saveError')}
                    </p>
                )}
                <Button
                    type="button"
                    variant="outline"
                    data-testid="addon-purchases-freeze-toggle"
                    disabled={!canWrite || query.isLoading || mutation.isPending}
                    onClick={() => setDialogOpen(true)}
                >
                    {translate(frozen ? 'disable' : 'enable')}
                </Button>
                <AlertDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                >
                    <AlertDialogContent data-testid="addon-purchases-freeze-confirm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{translate('title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {translate(frozen ? 'confirmDisable' : 'confirmEnable')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => mutation.mutate({ frozen: !frozen })}
                                disabled={mutation.isPending}
                            >
                                {translate(frozen ? 'disable' : 'enable')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
