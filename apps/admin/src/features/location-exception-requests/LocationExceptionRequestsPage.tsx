/**
 * @file LocationExceptionRequestsPage.tsx
 * Admin queue of owner requests for a location exception (HOS-2192).
 *
 * One vertical at a time (accommodations or venues), filtered by status
 * (PENDING by default). Each pending row can be approved (the owner's reason
 * preloaded and editable) or rejected (a reason is required). A 409 means the
 * request was resolved by someone else or went stale: the message says so and
 * the list is refreshed.
 */

import {
    LOCATION_EXCEPTION_REASONS,
    LOCATION_EXCEPTION_REQUEST_STATUSES,
    LocationExceptionApproveInputSchema,
    LocationExceptionRejectInputSchema,
    type LocationExceptionRequestRow,
    type LocationExceptionRequestStatus,
    PermissionEnum
} from '@repo/schemas';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { LocationExceptionReasonDialog } from './components/LocationExceptionReasonDialog';
import {
    type LocationExceptionVertical,
    readLocationExceptionError,
    useDecideLocationExceptionRequestMutation,
    useLocationExceptionRequestsQuery
} from './hooks';

const PAGE_SIZE = 20;
const CONFLICT_STATUS = 409;

const VERTICALS: readonly LocationExceptionVertical[] = ['accommodations', 'venues'];

/** The request a decision dialog is open for. */
interface Decision {
    readonly kind: 'approve' | 'reject';
    readonly row: LocationExceptionRequestRow;
}

/**
 * Maps a 409 `error.reason` of approve/reject to its message key.
 *
 * @param reason - The top-level `error.reason`.
 * @returns The i18n key; an unknown reason reads as "already resolved".
 */
function conflictMessageKey(reason: string | undefined) {
    if (reason === LOCATION_EXCEPTION_REASONS.REQUEST_STALE) {
        return 'admin-pages.locationExceptionRequests.conflict.stale' as const;
    }
    if (reason === LOCATION_EXCEPTION_REASONS.NOT_NEEDED) {
        return 'admin-pages.locationExceptionRequests.conflict.notNeeded' as const;
    }
    return 'admin-pages.locationExceptionRequests.conflict.notPending' as const;
}

/**
 * Page body: vertical selector, status filter, table, pagination and the two
 * decision dialogs.
 */
export function LocationExceptionRequestsPage() {
    const { t, locale } = useTranslations();
    const { addToast } = useToast();
    const [vertical, setVertical] = useState<LocationExceptionVertical>('accommodations');
    const [status, setStatus] = useState<LocationExceptionRequestStatus>('PENDING');
    const [page, setPage] = useState(1);
    const [decision, setDecision] = useState<Decision | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const decide = useDecideLocationExceptionRequestMutation();
    const { data, isLoading, isError } = useLocationExceptionRequestsQuery({
        vertical,
        status,
        page,
        pageSize: PAGE_SIZE
    });
    const rows = data?.items ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
    const listingPath = vertical === 'venues' ? '/venues' : '/accommodations';

    const openDecision = useCallback((next: Decision) => {
        setDialogError(null);
        setDecision(next);
    }, []);

    const columns = useMemo<ColumnDef<LocationExceptionRequestRow>[]>(
        () => [
            {
                id: 'listing',
                header: t('admin-pages.locationExceptionRequests.columns.listing'),
                cell: ({ row }) => (
                    <a
                        className="underline"
                        href={`${listingPath}/${row.original.listing.id}`}
                    >
                        {row.original.listing.name}
                    </a>
                )
            },
            {
                id: 'owner',
                header: t('admin-pages.locationExceptionRequests.columns.owner'),
                cell: ({ row }) => (
                    <div>
                        <div>{row.original.owner.name}</div>
                        <div className="text-muted-foreground text-xs">
                            {row.original.owner.email}
                        </div>
                    </div>
                )
            },
            {
                id: 'address',
                header: t('admin-pages.locationExceptionRequests.columns.address'),
                cell: ({ row }) => {
                    const { street, number, floor, apartment } = row.original.address;
                    const parts = [
                        street || number
                            ? t('admin-pages.locationExceptionRequests.address.street', {
                                  street: street ?? '',
                                  number: number ?? ''
                              }).trim()
                            : null,
                        floor
                            ? t('admin-pages.locationExceptionRequests.address.floor', { floor })
                            : null,
                        apartment
                            ? t('admin-pages.locationExceptionRequests.address.apartment', {
                                  apartment
                              })
                            : null
                    ].filter((part): part is string => part !== null);
                    return (
                        <div className="space-y-1">
                            <div>
                                {parts.length > 0
                                    ? parts.join(', ')
                                    : t('admin-pages.locationExceptionRequests.address.none')}
                            </div>
                            {row.original.targetsNewAddress && (
                                <span
                                    data-testid="targets-new-address"
                                    className="inline-block rounded bg-amber-100 px-2 py-0.5 text-amber-900 text-xs"
                                >
                                    {t('admin-pages.locationExceptionRequests.targetsNewAddress')}
                                </span>
                            )}
                        </div>
                    );
                }
            },
            {
                id: 'colliding',
                header: t('admin-pages.locationExceptionRequests.columns.colliding'),
                cell: ({ row }) => (
                    <ul className="space-y-1">
                        {row.original.collidingListings.map((listing) => (
                            <li key={listing.id}>
                                <a
                                    className="underline"
                                    href={`${listingPath}/${listing.id}`}
                                >
                                    {listing.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                )
            },
            {
                id: 'reason',
                header: t('admin-pages.locationExceptionRequests.columns.reason'),
                cell: ({ row }) => (
                    <span className="whitespace-pre-wrap">{row.original.reason}</span>
                )
            },
            {
                id: 'requestedAt',
                header: t('admin-pages.locationExceptionRequests.columns.requestedAt'),
                cell: ({ row }) => new Date(row.original.requestedAt).toLocaleString(locale)
            },
            {
                id: 'actions',
                header: t('admin-pages.locationExceptionRequests.columns.actions'),
                cell: ({ row }) =>
                    row.original.status === 'PENDING' ? (
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => openDecision({ kind: 'approve', row: row.original })}
                            >
                                {t('admin-pages.locationExceptionRequests.approve')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openDecision({ kind: 'reject', row: row.original })}
                            >
                                {t('admin-pages.locationExceptionRequests.reject')}
                            </Button>
                        </div>
                    ) : null
            }
        ],
        [t, locale, listingPath, openDecision]
    );
    const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

    const close = () => {
        setDecision(null);
        setDialogError(null);
    };

    const submit = async ({ reason }: { readonly reason: string | undefined }) => {
        if (!decision || reason === undefined) return;
        try {
            await decide.mutateAsync({
                vertical,
                requestId: decision.row.requestId,
                decision: decision.kind,
                reason
            });
            addToast({
                variant: 'success',
                message: t(
                    decision.kind === 'approve'
                        ? 'admin-pages.locationExceptionRequests.approved'
                        : 'admin-pages.locationExceptionRequests.rejected'
                )
            });
            setNotice(null);
            close();
        } catch (error) {
            const info = readLocationExceptionError(error);
            if (info.status === CONFLICT_STATUS) {
                setNotice(t(conflictMessageKey(info.reason)));
                close();
                return;
            }
            setDialogError(t('admin-pages.locationExceptionRequests.genericError'));
        }
    };

    const dialogKey = decision?.kind === 'reject' ? 'rejectDialog' : 'approveDialog';

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE]}>
            <SidebarPageLayout titleKey="admin-pages.locationExceptionRequests.title">
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        {t('admin-pages.locationExceptionRequests.description')}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        {VERTICALS.map((value) => (
                            <Button
                                key={value}
                                type="button"
                                size="sm"
                                variant={value === vertical ? 'default' : 'outline'}
                                aria-pressed={value === vertical}
                                onClick={() => {
                                    setVertical(value);
                                    setPage(1);
                                }}
                            >
                                {t(`admin-pages.locationExceptionRequests.verticals.${value}`)}
                            </Button>
                        ))}
                        <label className="flex items-center gap-2 text-sm">
                            {t('admin-pages.locationExceptionRequests.filters.status')}
                            <select
                                className="rounded-md border bg-background px-2 py-1"
                                value={status}
                                onChange={(event) => {
                                    setStatus(event.target.value as LocationExceptionRequestStatus);
                                    setPage(1);
                                }}
                            >
                                {LOCATION_EXCEPTION_REQUEST_STATUSES.map((value) => (
                                    <option
                                        key={value}
                                        value={value}
                                    >
                                        {t(
                                            `admin-pages.locationExceptionRequests.filters.${value}`
                                        )}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {notice && (
                        <p
                            role="alert"
                            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                        >
                            {notice}
                        </p>
                    )}
                    {isLoading && (
                        <p className="text-muted-foreground">
                            {t('admin-pages.locationExceptionRequests.loading')}
                        </p>
                    )}
                    {isError && (
                        <p
                            role="alert"
                            className="text-destructive"
                        >
                            {t('admin-pages.locationExceptionRequests.loadError')}
                        </p>
                    )}
                    {data && rows.length === 0 && (
                        <p className="text-muted-foreground">
                            {t('admin-pages.locationExceptionRequests.empty')}
                        </p>
                    )}
                    {rows.length > 0 && (
                        <table className="w-full text-left text-sm">
                            <thead>
                                {table.getHeaderGroups().map((group) => (
                                    <tr
                                        key={group.id}
                                        className="border-b"
                                    >
                                        {group.headers.map((header) => (
                                            <th
                                                key={header.id}
                                                className="py-2 pr-4"
                                            >
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="border-b align-top"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                className="py-2 pr-4"
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </td>
                                        ))}
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
                                {t('admin-pages.locationExceptionRequests.previous')}
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
                                {t('admin-pages.locationExceptionRequests.next')}
                            </Button>
                        </div>
                    )}
                </div>
                <LocationExceptionReasonDialog
                    open={decision !== null}
                    onOpenChange={(next) => {
                        if (!next) close();
                    }}
                    title={t(`admin-pages.locationExceptionRequests.${dialogKey}.title`)}
                    description={`${t(
                        `admin-pages.locationExceptionRequests.${dialogKey}.description`
                    )}${
                        decision?.kind === 'approve' && decision.row.targetsNewAddress
                            ? ` ${t('admin-pages.locationExceptionRequests.approveDialog.movesNotice')}`
                            : ''
                    }`}
                    reasonLabel={t(
                        `admin-pages.locationExceptionRequests.${dialogKey}.reasonLabel`
                    )}
                    confirmLabel={t(`admin-pages.locationExceptionRequests.${dialogKey}.confirm`)}
                    cancelLabel={t(`admin-pages.locationExceptionRequests.${dialogKey}.cancel`)}
                    invalidMessage={t('admin-pages.locationExceptionRequests.reasonInvalid')}
                    schema={
                        decision?.kind === 'reject'
                            ? LocationExceptionRejectInputSchema
                            : LocationExceptionApproveInputSchema
                    }
                    initialReason={decision?.kind === 'approve' ? decision.row.reason : ''}
                    isPending={decide.isPending}
                    error={dialogError}
                    onSubmit={submit}
                />
            </SidebarPageLayout>
        </RoutePermissionGuard>
    );
}
