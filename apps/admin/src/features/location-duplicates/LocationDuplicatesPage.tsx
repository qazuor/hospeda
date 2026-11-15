/**
 * @file LocationDuplicatesPage.tsx
 * Admin report of repeated addresses (HOS-1810).
 *
 * Lists, per vertical, the groups of PUBLISHED listings that share a place key.
 * A group with several owners is the flag the rule leaves for the admin (it never
 * blocks the publisher); a group of one owner is a listing that predates the
 * rule or got in before it was enforced. Each listing can be granted an exception
 * with a mandatory reason (a cabin complex, a food court, a hotel restaurant).
 */

import { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import {
    type LocationDuplicatesVertical,
    useGrantLocationExceptionMutation,
    useLocationDuplicatesQuery
} from './hooks';

const PAGE_SIZE = 20;
const MIN_REASON_LENGTH = 10;

const VERTICALS: readonly {
    readonly vertical: LocationDuplicatesVertical;
    readonly permission: PermissionEnum;
    readonly editPath: string;
}[] = [
    {
        vertical: 'accommodations',
        permission: PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE,
        editPath: '/accommodations'
    },
    {
        vertical: 'venues',
        permission: PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE,
        editPath: '/venues'
    }
];

/** The listing an exception is being granted to. */
interface ExceptionTarget {
    readonly vertical: LocationDuplicatesVertical;
    readonly id: string;
}

/**
 * One vertical's table.
 *
 * @param props.vertical - Which report to read.
 * @param props.editPath - Admin path prefix of the listing detail page.
 * @param props.onGrant - Opens the exception dialog for a listing.
 */
function VerticalSection({
    vertical,
    editPath,
    onGrant
}: {
    readonly vertical: LocationDuplicatesVertical;
    readonly editPath: string;
    readonly onGrant: (target: ExceptionTarget) => void;
}) {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const { data, isLoading, isError } = useLocationDuplicatesQuery({
        vertical,
        page,
        pageSize: PAGE_SIZE
    });
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

    return (
        <section className="space-y-3">
            <h2 className="font-semibold text-lg">
                {t(
                    vertical === 'venues'
                        ? 'admin-pages.locationDuplicates.verticals.venues'
                        : 'admin-pages.locationDuplicates.verticals.accommodations'
                )}
            </h2>
            {isLoading && (
                <p className="text-muted-foreground">
                    {t('admin-pages.locationDuplicates.loading')}
                </p>
            )}
            {isError && (
                <p
                    role="alert"
                    className="text-destructive"
                >
                    {t('admin-pages.locationDuplicates.loadError')}
                </p>
            )}
            {data && data.items.length === 0 && (
                <p className="text-muted-foreground">{t('admin-pages.locationDuplicates.empty')}</p>
            )}
            {data && data.items.length > 0 && (
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="py-2 pr-4">
                                {t('admin-pages.locationDuplicates.columns.address')}
                            </th>
                            <th className="py-2 pr-4">
                                {t('admin-pages.locationDuplicates.columns.listings')}
                            </th>
                            <th className="py-2">
                                {t('admin-pages.locationDuplicates.columns.owners')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((group) => (
                            <tr
                                key={group.locationKey}
                                className="border-b align-top"
                            >
                                <td className="py-2 pr-4 font-mono text-xs">{group.locationKey}</td>
                                <td className="py-2 pr-4">
                                    <ul className="space-y-1">
                                        {group.listings.map((listing) => (
                                            <li
                                                key={listing.id}
                                                className="flex items-center gap-2"
                                            >
                                                <a
                                                    className="underline"
                                                    href={`${editPath}/${listing.id}`}
                                                >
                                                    {listing.id.slice(0, 8)}
                                                </a>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        onGrant({ vertical, id: listing.id })
                                                    }
                                                >
                                                    {t(
                                                        'admin-pages.locationDuplicates.grantException'
                                                    )}
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="py-2">
                                    {group.sameOwner
                                        ? t('admin-pages.locationDuplicates.sameOwner')
                                        : t('admin-pages.locationDuplicates.differentOwners')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                    >
                        {t('admin-pages.locationDuplicates.previous')}
                    </Button>
                    <span className="text-sm">
                        {page} / {totalPages}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        {t('admin-pages.locationDuplicates.next')}
                    </Button>
                </div>
            )}
        </section>
    );
}

/**
 * Page body: the two verticals plus the exception dialog.
 */
export function LocationDuplicatesPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const grant = useGrantLocationExceptionMutation();
    const [target, setTarget] = useState<ExceptionTarget | null>(null);
    const [reason, setReason] = useState('');
    const reasonTooShort = reason.trim().length < MIN_REASON_LENGTH;

    const close = () => {
        setTarget(null);
        setReason('');
    };

    const confirm = () => {
        if (!target || reasonTooShort) return;
        grant.mutate(
            { vertical: target.vertical, id: target.id, reason: reason.trim() },
            {
                onSuccess: () => {
                    addToast({
                        variant: 'success',
                        message: t('admin-pages.locationDuplicates.granted')
                    });
                    close();
                },
                onError: () => {
                    addToast({
                        variant: 'error',
                        message: t('admin-pages.locationDuplicates.grantError')
                    });
                }
            }
        );
    };

    return (
        <RoutePermissionGuard permissions={VERTICALS.map(({ permission }) => permission)}>
            <SidebarPageLayout titleKey="admin-pages.locationDuplicates.title">
                <div className="space-y-8">
                    <p className="text-muted-foreground">
                        {t('admin-pages.locationDuplicates.description')}
                    </p>
                    {VERTICALS.map(({ vertical, editPath }) => (
                        <VerticalSection
                            key={vertical}
                            vertical={vertical}
                            editPath={editPath}
                            onGrant={setTarget}
                        />
                    ))}
                </div>
                <Dialog
                    open={target !== null}
                    onOpenChange={(open) => {
                        if (!open) close();
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {t('admin-pages.locationDuplicates.dialog.title')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('admin-pages.locationDuplicates.dialog.description')}
                            </DialogDescription>
                        </DialogHeader>
                        <Textarea
                            aria-label={t('admin-pages.locationDuplicates.dialog.reasonLabel')}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={4}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={close}
                            >
                                {t('admin-pages.locationDuplicates.dialog.cancel')}
                            </Button>
                            <Button
                                type="button"
                                disabled={reasonTooShort || grant.isPending}
                                onClick={confirm}
                            >
                                {t('admin-pages.locationDuplicates.dialog.confirm')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </SidebarPageLayout>
        </RoutePermissionGuard>
    );
}
