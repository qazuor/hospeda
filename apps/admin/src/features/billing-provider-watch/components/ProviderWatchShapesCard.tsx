import en from '@repo/i18n/locales/en/admin-billing.json';
import es from '@repo/i18n/locales/es/admin-billing.json';
import pt from '@repo/i18n/locales/pt/admin-billing.json';
import { PermissionEnum, type ProviderWatchShapeReview } from '@repo/schemas';
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
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { useAcceptProviderWatchShape, useProviderWatchShapes } from '../hooks';

const COPY_BY_LOCALE = { es, en, pt };

/**
 * Lets the owner review what changed in the shape of the provider's responses and accept it
 * (HOS-1512). The baseline advances ONLY here: until a shape is accepted, its change keeps
 * alerting on every run. Needs `PROVIDER_WATCH_MANAGE`, held only by SUPER_ADMIN.
 */
export function ProviderWatchShapesCard() {
    const { locale } = useTranslations();
    const permissions = useUserPermissions();
    const canManage = permissions.includes(PermissionEnum.PROVIDER_WATCH_MANAGE);
    const shapes = useProviderWatchShapes({ enabled: canManage });
    const accept = useAcceptProviderWatchShape();
    const [target, setTarget] = useState<ProviderWatchShapeReview | null>(null);
    const selectedLocale = locale === 'en' || locale === 'pt' ? locale : 'es';
    const copy = COPY_BY_LOCALE[selectedLocale].settings.providerWatchShapes;
    const translate = (
        key: keyof typeof es.settings.providerWatchShapes,
        values: Readonly<Record<string, string>> = {}
    ): string =>
        Object.entries(values).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, value),
            copy[key]
        );
    const date = (iso: string) => new Date(iso).toLocaleString(locale);

    return (
        <Card data-testid="provider-watch-shapes-card">
            <CardHeader>
                <CardTitle>{translate('title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">{translate('description')}</p>
                {!canManage && (
                    <p className="text-muted-foreground text-sm">
                        {translate('noWritePermission')}
                    </p>
                )}
                {shapes.isError && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {translate('loadError')}
                    </p>
                )}
                {accept.isError && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {translate('saveError')}
                    </p>
                )}
                {canManage && shapes.data?.length === 0 && (
                    <p className="text-sm">{translate('empty')}</p>
                )}
                <ul className="space-y-3">
                    {(shapes.data ?? []).map((review) => (
                        <li
                            key={review.measurementId}
                            className="space-y-1 rounded-md border p-3 text-sm"
                            data-testid={`provider-watch-shape-${review.measurementId}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{review.measurementId}</span>
                                <Badge variant={review.inSync ? 'default' : 'destructive'}>
                                    {review.inSync
                                        ? translate('inSync')
                                        : review.accepted === null
                                          ? translate('noBaseline')
                                          : translate('pending')}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {translate('observedAt', {
                                    date: date(review.observedAt),
                                    runId: review.runId
                                })}
                            </p>
                            {review.acceptedAt && (
                                <p className="text-muted-foreground text-xs">
                                    {translate('acceptedAt', { date: date(review.acceptedAt) })}
                                </p>
                            )}
                            {!review.inSync && (
                                <ul className="list-disc pl-5 font-mono text-xs">
                                    {review.differences.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                            )}
                            {!review.inSync && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    data-testid={`provider-watch-accept-${review.measurementId}`}
                                    disabled={!canManage || accept.isPending}
                                    onClick={() => setTarget(review)}
                                >
                                    {translate('accept')}
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
                <AlertDialog
                    open={target !== null}
                    onOpenChange={(open) => {
                        if (!open) setTarget(null);
                    }}
                >
                    <AlertDialogContent data-testid="provider-watch-accept-confirm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{translate('confirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {target
                                    ? translate('confirmAccept', {
                                          measurementId: target.measurementId
                                      })
                                    : ''}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={accept.isPending}
                                onClick={() => {
                                    if (target) {
                                        accept.mutate({
                                            measurementId: target.measurementId,
                                            account: target.account,
                                            runId: target.runId
                                        });
                                    }
                                }}
                            >
                                {translate('accept')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
