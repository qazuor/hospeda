import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { formatCentsToArs, formatDateWithTime } from '@/lib/format-helpers';
import { defaultIntlLocale } from '@repo/i18n';
import { EyeIcon, MoreHorizontalIcon, PowerIcon, PowerOffIcon } from '@repo/icons';
import type { PurchasedAddon } from './types';

/**
 * Row actions handler type
 */
export interface PurchasedAddonRowActions {
    onViewDetails: (addon: PurchasedAddon) => void;
    onForceExpire: (addon: PurchasedAddon) => void;
    onForceActivate: (addon: PurchasedAddon) => void;
}

interface PurchasedAddonColumnsOptions {
    actions?: PurchasedAddonRowActions;
    /** Translation function from useTranslations hook */
    t: (key: string) => string;
    /** BCP 47 locale string (e.g. 'es-AR', 'en-US') */
    locale?: string;
}

/**
 * Get DataTable columns for purchased add-ons list
 */
export function getPurchasedAddonColumns({
    actions,
    t,
    locale = defaultIntlLocale
}: PurchasedAddonColumnsOptions): ReadonlyArray<DataTableColumn<PurchasedAddon>> {
    const columns: DataTableColumn<PurchasedAddon>[] = [
        {
            id: 'customerEmail',
            header: t('admin-billing.addons.purchasedColumns.customer'),
            accessorKey: 'customerEmail',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.customerEmail}</div>
                    {row.customerName && (
                        <div className="text-muted-foreground text-xs">{row.customerName}</div>
                    )}
                </div>
            )
        },
        {
            id: 'addon',
            header: t('admin-billing.addons.purchasedColumns.addon'),
            accessorKey: 'addonSlug',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.addonName}</div>
                    <div className="font-mono text-muted-foreground text-xs">{row.addonSlug}</div>
                </div>
            )
        },
        {
            id: 'status',
            header: t('admin-billing.addons.purchasedColumns.status'),
            accessorKey: 'status',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'active',
                    label: t('admin-billing.addons.purchasedStatuses.active'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'expired',
                    label: t('admin-billing.addons.purchasedStatuses.expired'),
                    color: BadgeColor.SECONDARY
                },
                {
                    value: 'canceled',
                    label: t('admin-billing.addons.purchasedStatuses.canceled'),
                    color: BadgeColor.RED
                }
            ]
        },
        {
            id: 'purchasedAt',
            header: t('admin-billing.addons.purchasedColumns.purchasedAt'),
            accessorKey: 'purchasedAt',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="text-sm">
                    {formatDateWithTime({ date: row.purchasedAt, locale })}
                </span>
            )
        },
        {
            id: 'expiresAt',
            header: t('admin-billing.addons.purchasedColumns.expiresAt'),
            accessorKey: 'expiresAt',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.expiresAt
                        ? formatDateWithTime({ date: row.expiresAt, locale })
                        : t('admin-billing.addons.purchasedColumns.noExpiry')}
                </span>
            )
        },
        {
            id: 'price',
            header: t('admin-billing.addons.purchasedColumns.price'),
            enableSorting: true,
            cell: ({ row }) => (
                <span className="font-medium">
                    {formatCentsToArs({ cents: row.priceArs, locale })}
                </span>
            )
        },
        {
            id: 'paymentId',
            header: t('admin-billing.addons.purchasedColumns.paymentId'),
            accessorKey: 'paymentId',
            enableSorting: false,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="font-mono text-muted-foreground text-xs">
                    {row.paymentId || '—'}
                </span>
            )
        }
    ];

    // Add actions column if actions are provided
    if (actions) {
        columns.push({
            id: 'actions',
            header: t('admin-billing.addons.purchasedColumns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                        >
                            <span className="sr-only">
                                {t('admin-billing.addons.purchasedColumns.openMenu')}
                            </span>
                            <MoreHorizontalIcon className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => actions.onViewDetails(row)}>
                            <EyeIcon className="mr-2 h-4 w-4" />
                            {t('admin-billing.addons.purchasedColumns.viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {row.status === 'active' && (
                            <DropdownMenuItem
                                onClick={() => actions.onForceExpire(row)}
                                className="text-orange-600 focus:text-orange-600 dark:text-orange-400"
                            >
                                <PowerOffIcon className="mr-2 h-4 w-4" />
                                {t('admin-billing.addons.purchasedColumns.forceExpire')}
                            </DropdownMenuItem>
                        )}
                        {(row.status === 'expired' || row.status === 'canceled') && (
                            <DropdownMenuItem
                                onClick={() => actions.onForceActivate(row)}
                                className="text-green-600 focus:text-green-600 dark:text-green-400"
                            >
                                <PowerIcon className="mr-2 h-4 w-4" />
                                {t('admin-billing.addons.purchasedColumns.forceActivate')}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        });
    }

    return columns;
}
