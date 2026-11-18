import en from '@repo/i18n/locales/en/admin-pages.json';
import es from '@repo/i18n/locales/es/admin-pages.json';
import pt from '@repo/i18n/locales/pt/admin-pages.json';
import { LoaderIcon } from '@repo/icons';
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

const COPY_BY_LOCALE = { es, en, pt } as const;

type CopyKey = keyof typeof es.systemSettings.critical.sessionRecording;

/**
 * Master switch for the Umami session recorder on the web (HOS-2347 §6.9).
 *
 * Renders nothing unless the viewer holds
 * `ANALYTICS_SESSION_RECORDING_MANAGE`, so it is absent from the DOM for
 * everybody else (AC-A4). Turning it on or off always goes through a
 * confirmation dialog; the state line only ever shows the last value the api
 * confirmed, so a failed write never flips it (AC-A5).
 *
 * Replay vs heatmap, sampling and masking are NOT managed here: they live in
 * Umami and are written by `pnpm umami:setup`.
 */
export function SessionRecordingCard() {
    const permissions = useUserPermissions();
    const canManage = permissions.includes(PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE);
    if (!canManage) return null;
    return <SessionRecordingCardBody />;
}

function SessionRecordingCardBody() {
    const { locale } = useTranslations();
    const query = usePlatformSetting({ key: 'analytics.sessionRecording' });
    const mutation = useUpdatePlatformSetting({ key: 'analytics.sessionRecording' });
    const [dialogOpen, setDialogOpen] = useState(false);
    const selectedLocale = locale === 'en' || locale === 'pt' ? locale : 'es';
    const translate = (key: CopyKey): string =>
        COPY_BY_LOCALE[selectedLocale].systemSettings.critical.sessionRecording[key];

    const row = query.data?.row ?? null;
    const enabled = row?.value.enabled === true;
    const lastChanged = row
        ? translate('lastChanged').replace(
              '{{date}}',
              new Intl.DateTimeFormat(selectedLocale, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
              }).format(new Date(row.updatedAt))
          )
        : translate('neverChanged');
    const actionLabel = translate(enabled ? 'disable' : 'enable');

    return (
        <Card data-testid="session-recording-card">
            <CardHeader>
                <CardTitle>{translate('title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">{translate('description')}</p>
                {query.isError ? (
                    <div
                        className="flex items-center gap-3"
                        role="alert"
                    >
                        <p className="text-destructive text-sm">{translate('readError')}</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid="session-recording-retry"
                            onClick={() => void query.refetch()}
                        >
                            {translate('retry')}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={enabled ? 'destructive' : 'default'}
                            data-testid="session-recording-status"
                        >
                            {translate(enabled ? 'statusOn' : 'statusOff')}
                        </Badge>
                        <span
                            className="text-muted-foreground text-sm"
                            data-testid="session-recording-last-changed"
                        >
                            {lastChanged}
                        </span>
                    </div>
                )}
                <p className="text-muted-foreground text-sm">{translate('help')}</p>
                {mutation.isError && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                        data-testid="session-recording-save-error"
                    >
                        {translate('saveError')}
                    </p>
                )}
                <Button
                    type="button"
                    variant="outline"
                    data-testid="session-recording-toggle"
                    aria-label={translate(enabled ? 'disableAria' : 'enableAria')}
                    disabled={query.isLoading || query.isError || mutation.isPending}
                    onClick={() => setDialogOpen(true)}
                >
                    {mutation.isPending && (
                        <LoaderIcon
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden="true"
                        />
                    )}
                    {actionLabel}
                </Button>
                <AlertDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                >
                    <AlertDialogContent data-testid="session-recording-confirm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{translate('title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {translate(enabled ? 'confirmDisable' : 'confirmEnable')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => mutation.mutate({ enabled: !enabled })}
                                disabled={mutation.isPending}
                            >
                                {actionLabel}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
