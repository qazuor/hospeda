/**
 * @file ListingLocationExceptionCard.tsx
 * «Excepción de ubicación» block of the accommodation and venue pages (HOS-2192).
 *
 * Shows the exception in force (who, when, why), the audit history (newest
 * first) and the actions: «Quitar excepción» (optional reason, 10..500 when
 * typed) and, when none is in force, «Conceder excepción» (reason required).
 * Gated by `LISTING_LOCATION_EXCEPTION_MANAGE`. A `REVOKE_CONFLICT` 409 is
 * shown with a link to the colliding listing.
 */

import {
    LOCATION_EXCEPTION_REASONS,
    LocationExceptionInputSchema,
    LocationExceptionRevokeInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import {
    type LocationExceptionVertical,
    readLocationExceptionError,
    useChangeLocationExceptionMutation,
    useLocationExceptionStateQuery
} from '../hooks';
import { LocationExceptionReasonDialog } from './LocationExceptionReasonDialog';

/** Props for {@link ListingLocationExceptionCard}. */
export interface ListingLocationExceptionCardProps {
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
}

/**
 * Renders the block, hidden for admins without the permission.
 *
 * @param props - The listing's vertical and id.
 */
export function ListingLocationExceptionCard(props: ListingLocationExceptionCardProps) {
    return (
        <PermissionGate permissions={[PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE]}>
            <CardBody {...props} />
        </PermissionGate>
    );
}

function CardBody({ vertical, listingId }: ListingLocationExceptionCardProps) {
    const { t, locale } = useTranslations();
    const { addToast } = useToast();
    const { data, isLoading, isError } = useLocationExceptionStateQuery({ vertical, listingId });
    const change = useChangeLocationExceptionMutation();
    const [dialog, setDialog] = useState<'revoke' | 'grant' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [conflictListingId, setConflictListingId] = useState<string | null>(null);
    const listingPath = vertical === 'venues' ? '/venues' : '/accommodations';
    const grantorName = data?.events.find(
        (event) =>
            event.actorId === data.by && (event.action === 'APPROVED' || event.action === 'GRANTED')
    )?.actorName;
    const formatDate = (value: string) => new Date(value).toLocaleString(locale);

    const close = () => {
        setDialog(null);
        setError(null);
    };

    const submit = async ({ reason }: { readonly reason: string | undefined }) => {
        if (!dialog) return;
        setConflictListingId(null);
        try {
            await change.mutateAsync({ vertical, listingId, action: dialog, reason });
            addToast({
                variant: 'success',
                message: t(
                    dialog === 'revoke'
                        ? 'admin-entities.locationException.revoked'
                        : 'admin-entities.locationException.granted'
                )
            });
            close();
        } catch (caught) {
            const info = readLocationExceptionError(caught);
            if (info.reason === LOCATION_EXCEPTION_REASONS.REVOKE_CONFLICT) {
                setConflictListingId(info.existingListingId ?? '');
                close();
                return;
            }
            setError(t('admin-entities.locationException.genericError'));
        }
    };

    return (
        <Card data-testid="listing-location-exception">
            <CardHeader>
                <CardTitle className="text-base">
                    {t('admin-entities.locationException.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading && (
                    <p className="text-muted-foreground text-sm">
                        {t('admin-entities.locationException.loading')}
                    </p>
                )}
                {isError && (
                    <p
                        role="alert"
                        className="text-destructive text-sm"
                    >
                        {t('admin-entities.locationException.loadError')}
                    </p>
                )}
                {conflictListingId !== null && (
                    <p
                        role="alert"
                        className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                    >
                        {t('admin-entities.locationException.revokeConflict')}{' '}
                        {conflictListingId && (
                            <a
                                className="underline"
                                href={`${listingPath}/${conflictListingId}`}
                            >
                                {t('admin-entities.locationException.revokeConflictLink')}
                            </a>
                        )}
                    </p>
                )}
                {data && (
                    <>
                        {data.hasException ? (
                            <div
                                className="space-y-1 text-sm"
                                data-testid="location-exception-in-force"
                            >
                                <p className="font-medium">
                                    {t('admin-entities.locationException.inForce')}
                                </p>
                                <p>
                                    {grantorName
                                        ? t('admin-entities.locationException.by', {
                                              name: grantorName
                                          })
                                        : t('admin-entities.locationException.byUnknown')}{' '}
                                    {data.at
                                        ? t('admin-entities.locationException.at', {
                                              date: formatDate(data.at)
                                          })
                                        : null}
                                </p>
                                {data.reason && (
                                    <p>
                                        <span className="text-muted-foreground">
                                            {t('admin-entities.locationException.reasonLabel')}:
                                        </span>{' '}
                                        {data.reason}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t('admin-entities.locationException.none')}
                            </p>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant={data.hasException ? 'outline' : 'default'}
                            onClick={() => setDialog(data.hasException ? 'revoke' : 'grant')}
                        >
                            {t(
                                data.hasException
                                    ? 'admin-entities.locationException.revoke'
                                    : 'admin-entities.locationException.grant'
                            )}
                        </Button>
                        <div>
                            <h3 className="mb-2 font-medium text-sm">
                                {t('admin-entities.locationException.historyTitle')}
                            </h3>
                            {data.events.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-entities.locationException.historyEmpty')}
                                </p>
                            ) : (
                                <ul
                                    className="space-y-2 text-sm"
                                    data-testid="location-exception-history"
                                >
                                    {data.events.map((event) => (
                                        <li key={event.id}>
                                            <span className="font-medium">
                                                {t(
                                                    `admin-entities.locationException.actions.${event.action}`
                                                )}
                                            </span>{' '}
                                            <span className="text-muted-foreground">
                                                {event.actorName ??
                                                    t(
                                                        'admin-entities.locationException.system'
                                                    )}{' '}
                                                · {formatDate(event.createdAt)}
                                            </span>
                                            {event.reason && <p>{event.reason}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
            <LocationExceptionReasonDialog
                open={dialog !== null}
                onOpenChange={(next) => {
                    if (!next) close();
                }}
                title={t(`admin-entities.locationException.${dialog ?? 'revoke'}Dialog.title`)}
                description={t(
                    `admin-entities.locationException.${dialog ?? 'revoke'}Dialog.description`
                )}
                reasonLabel={t(
                    `admin-entities.locationException.${dialog ?? 'revoke'}Dialog.reasonLabel`
                )}
                confirmLabel={t(
                    `admin-entities.locationException.${dialog ?? 'revoke'}Dialog.confirm`
                )}
                cancelLabel={t(
                    `admin-entities.locationException.${dialog ?? 'revoke'}Dialog.cancel`
                )}
                invalidMessage={t('admin-entities.locationException.reasonInvalid')}
                schema={
                    dialog === 'grant'
                        ? LocationExceptionInputSchema
                        : LocationExceptionRevokeInputSchema
                }
                optional={dialog === 'revoke'}
                isPending={change.isPending}
                error={error}
                onSubmit={submit}
            />
        </Card>
    );
}
