import en from '@repo/i18n/locales/en/admin-pages.json';
import es from '@repo/i18n/locales/es/admin-pages.json';
import pt from '@repo/i18n/locales/pt/admin-pages.json';
import { LoaderIcon } from '@repo/icons';
import {
    DEFAULT_SESSION_RECORDING_RETENTION_DAYS,
    PermissionEnum,
    SESSION_RECORDING_RETENTION_DAYS_OPTIONS,
    SessionRecordingRetentionDaysSchema
} from '@repo/schemas';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { usePlatformSetting, useUpdatePlatformSetting } from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { usePurgeSessionRecordings } from '../hooks/use-purge-session-recordings';

const COPY_BY_LOCALE = { es, en, pt } as const;

type CopyKey = keyof typeof es.systemSettings.critical.sessionRecording;

/** Namespaced prefix of this card's keys, for the pluralized ones read through `tPlural`. */
const PLURAL_PREFIX = 'admin-pages.systemSettings.critical.sessionRecording';

/**
 * Master switch for the Umami session recorder on the web (HOS-2347 §6.9).
 *
 * Renders nothing unless the viewer holds
 * `ANALYTICS_SESSION_RECORDING_MANAGE`, so it is absent from the DOM for
 * everybody else (AC-A4). Turning it on or off always goes through a
 * confirmation dialog; the state line only ever shows the last value the api
 * confirmed, so a failed write never flips it (AC-A5).
 *
 * The same card holds the retention period (14, 30 or 60 days, default 30) and
 * the "Limpiar ahora" action that purges the expired recordings right away
 * behind a confirmation dialog. Both reuse the same permission. Every write of
 * the setting sends BOTH fields, because the api replaces the whole value.
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

/** Picks the inline message for a failed purge from the api error. */
function purgeErrorCopyKey(error: unknown): CopyKey {
    const failure = error as {
        status?: number;
        body?: { error?: { reason?: string } };
    } | null;
    if (failure?.status === 503) return 'purgeNotConfigured';
    if (failure?.status === 409) {
        return failure.body?.error?.reason === 'RECORDING_PURGE_ALREADY_RUNNING'
            ? 'purgeRunning'
            : 'purgeMismatch';
    }
    return 'purgeError';
}

function SessionRecordingCardBody() {
    const { locale, tPlural } = useTranslations();
    const query = usePlatformSetting({ key: 'analytics.sessionRecording' });
    const mutation = useUpdatePlatformSetting({ key: 'analytics.sessionRecording' });
    const purge = usePurgeSessionRecordings();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const selectedLocale = locale === 'en' || locale === 'pt' ? locale : 'es';
    const translate = (key: CopyKey): string =>
        COPY_BY_LOCALE[selectedLocale].systemSettings.critical.sessionRecording[key];

    const row = query.data?.row ?? null;
    const enabled = row?.value.enabled === true;
    const retentionDays = row?.value.retentionDays ?? DEFAULT_SESSION_RECORDING_RETENTION_DAYS;
    const plural = (
        key:
            | 'retentionOption'
            | 'purgeConfirm'
            | 'purgeDoneReplays'
            | 'purgeDoneHeatmaps'
            | 'purgeDoneSaved',
        count: number
    ): string => tPlural(`${PLURAL_PREFIX}.${key}`, count);
    const fill = (text: string, values: Record<string, string | number>): string =>
        Object.entries(values).reduce(
            (acc, [name, value]) => acc.replace(`{{${name}}}`, String(value)),
            text
        );
    const purgeErrorKey = purgeErrorCopyKey(purge.error);
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
                <div className="space-y-2 border-t pt-4">
                    <label
                        htmlFor="session-recording-retention"
                        className="font-medium text-sm"
                    >
                        {translate('retentionLabel')}
                    </label>
                    <Select
                        value={String(retentionDays)}
                        onValueChange={(value) => {
                            const parsed = SessionRecordingRetentionDaysSchema.safeParse(
                                Number(value)
                            );
                            if (parsed.success) {
                                mutation.mutate({ enabled, retentionDays: parsed.data });
                            }
                        }}
                        disabled={query.isLoading || query.isError || mutation.isPending}
                    >
                        <SelectTrigger
                            id="session-recording-retention"
                            className="w-40"
                            data-testid="session-recording-retention"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SESSION_RECORDING_RETENTION_DAYS_OPTIONS.map((days) => (
                                <SelectItem
                                    key={days}
                                    value={String(days)}
                                >
                                    {plural('retentionOption', days)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-sm">{translate('retentionHelp')}</p>
                    <Button
                        type="button"
                        variant="outline"
                        data-testid="session-recording-purge"
                        aria-label={translate('purgeAria')}
                        disabled={query.isLoading || query.isError || purge.isPending}
                        onClick={() => {
                            // The dialog must show the period the api holds NOW, not a stale one.
                            void query.refetch();
                            purge.reset();
                            setPurgeDialogOpen(true);
                        }}
                    >
                        {purge.isPending && (
                            <LoaderIcon
                                className="mr-2 h-4 w-4 animate-spin"
                                aria-hidden="true"
                            />
                        )}
                        {translate('purgeButton')}
                    </Button>
                    {purge.isSuccess && (
                        <p
                            className="text-sm"
                            role="status"
                            data-testid="session-recording-purge-result"
                        >
                            {fill(translate('purgeDone'), {
                                replays: plural('purgeDoneReplays', purge.data.replaysDeleted),
                                heatmaps: plural(
                                    'purgeDoneHeatmaps',
                                    purge.data.heatmapEventsDeleted
                                ),
                                saved: plural('purgeDoneSaved', purge.data.savedReplaysDeleted),
                                period: plural('retentionOption', purge.data.retentionDays)
                            })}
                            {purge.data.stoppedEarly && (
                                <span
                                    className="mt-1 block text-muted-foreground"
                                    data-testid="session-recording-purge-stopped-early"
                                >
                                    {translate('purgeStoppedEarly')}
                                </span>
                            )}
                        </p>
                    )}
                    {purge.isError && (
                        <p
                            className="text-destructive text-sm"
                            role="alert"
                            data-testid="session-recording-purge-error"
                        >
                            {translate(purgeErrorKey)}
                        </p>
                    )}
                </div>
                <AlertDialog
                    open={purgeDialogOpen}
                    onOpenChange={setPurgeDialogOpen}
                >
                    <AlertDialogContent data-testid="session-recording-purge-confirm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{translate('purgeButton')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {plural('purgeConfirm', retentionDays)}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={query.isFetching}
                                onClick={() => purge.mutate({ retentionDays })}
                            >
                                {translate('purgeConfirmAction')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
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
                                onClick={() =>
                                    mutation.mutate({ enabled: !enabled, retentionDays })
                                }
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
