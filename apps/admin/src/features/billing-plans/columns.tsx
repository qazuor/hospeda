import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCentsToArs } from '@/lib/format-helpers';
import { defaultIntlLocale } from '@repo/i18n';
import { DeleteIcon, EditIcon, PowerIcon, RotateCcwIcon } from '@repo/icons';
import type { ParsedPlanRecord } from './types';

interface PlanColumnsOptions {
    onEdit?: (plan: ParsedPlanRecord) => void;
    onToggleActive?: (id: string, isActive: boolean) => void;
    /** Soft-delete a non-deleted plan. Receives the full row so the caller can show subscriber impact. */
    onDelete?: (plan: ParsedPlanRecord) => void;
    /** Restore a soft-deleted plan. */
    onRestore?: (plan: ParsedPlanRecord) => void;
    /** Permanently delete a soft-deleted plan. */
    onHardDelete?: (plan: ParsedPlanRecord) => void;
    isTogglingActive?: boolean;
    isDeleting?: boolean;
    isRestoring?: boolean;
    isHardDeleting?: boolean;
    /** Translation function from useTranslations hook */
    t: (key: string) => string;
    /** BCP 47 locale string (e.g. 'es-AR', 'en-US') */
    locale?: string;
}

/**
 * Get DataTable columns for plans list.
 *
 * All action callbacks (onEdit, onToggleActive, onDelete) use the plan `id`
 * (UUID) as the mutation identifier per SPEC-168 decision D1.
 */
export function getPlanColumns(
    options: PlanColumnsOptions
): ReadonlyArray<DataTableColumn<ParsedPlanRecord>> {
    const {
        onEdit,
        onToggleActive,
        onDelete,
        onRestore,
        onHardDelete,
        isTogglingActive,
        isDeleting,
        isRestoring,
        isHardDeleting,
        t,
        locale = defaultIntlLocale
    } = options;

    return [
        {
            id: 'name',
            header: t('admin-billing.plans.columns.name'),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => {
                // Description is sourced from packages/billing/src/config/plans.config.ts
                // in English. Translate via i18n keyed by plan slug, fall back to the
                // DB-stored description when no translation is registered. The `t()`
                // helper returns `[MISSING: <key>]` (not the bare key) for unknown
                // keys, so admin-created plans — which have no static i18n entry —
                // must fall back to `row.description` to avoid showing the raw marker.
                const i18nKey = `admin-billing.plans.descriptions.${row.slug}`;
                const translated = t(i18nKey);
                const description = translated.startsWith('[MISSING:')
                    ? row.description
                    : translated;
                return (
                    <div>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-muted-foreground text-xs">{description}</div>
                    </div>
                );
            }
        },
        {
            id: 'category',
            header: t('admin-billing.plans.columns.category'),
            accessorKey: 'category',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'owner',
                    label: t('admin-billing.plans.categoryLabels.owner'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'complex',
                    label: t('admin-billing.plans.categoryLabels.complex'),
                    color: BadgeColor.PURPLE
                },
                {
                    value: 'tourist',
                    label: t('admin-billing.plans.categoryLabels.tourist'),
                    color: BadgeColor.GREEN
                }
            ]
        },
        {
            id: 'monthlyPrice',
            header: t('admin-billing.plans.columns.monthlyPrice'),
            enableSorting: true,
            cell: ({ row }) => (
                <div>
                    <span className="font-medium">
                        {formatCentsToArs({ cents: row.monthlyPriceArs, locale })}
                    </span>
                    <span className="text-muted-foreground text-xs">
                        {' '}
                        {t('admin-billing.plans.columns.perMonth')}
                    </span>
                </div>
            )
        },
        {
            id: 'annualPrice',
            header: t('admin-billing.plans.columns.annualPrice'),
            enableSorting: true,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.annualPriceArs
                        ? formatCentsToArs({ cents: row.annualPriceArs, locale })
                        : '-'}
                </span>
            )
        },
        {
            id: 'entitlements',
            header: t('admin-billing.plans.columns.entitlements'),
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-xs">
                    {row.entitlements.length} {t('admin-billing.plans.columns.permissionsCount')}
                </span>
            )
        },
        {
            id: 'limits',
            header: t('admin-billing.plans.columns.limits'),
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-xs">
                    {row.limits.length} {t('admin-billing.plans.columns.limitsCount')}
                </span>
            )
        },
        {
            id: 'status',
            header: t('admin-billing.plans.columns.status'),
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Badge variant={row.isActive ? 'success' : 'secondary'}>
                        {row.isActive
                            ? t('admin-billing.plans.statusActive')
                            : t('admin-billing.plans.statusInactive')}
                    </Badge>
                    {row.isDefault && (
                        <Badge
                            variant="outline"
                            className="border-primary/20 bg-primary/5 text-primary"
                        >
                            {t('admin-billing.plans.statusDefault')}
                        </Badge>
                    )}
                </div>
            )
        },
        {
            id: 'actions',
            header: t('admin-billing.plans.columns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) =>
                // Soft-deleted rows expose only restore + permanent-delete; the
                // toggle/edit/soft-delete actions do not apply to them.
                row.isDeleted ? (
                    <div className="flex gap-2">
                        {onRestore && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRestore(row)}
                                disabled={isRestoring}
                                title={t('admin-billing.plans.actionRestore')}
                            >
                                <RotateCcwIcon className="mr-1 h-3 w-3" />
                                {t('admin-billing.plans.actionRestore')}
                            </Button>
                        )}
                        {onHardDelete && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onHardDelete(row)}
                                disabled={isHardDeleting}
                                title={t('admin-billing.plans.actionHardDelete')}
                            >
                                <DeleteIcon className="mr-1 h-3 w-3" />
                                {t('admin-billing.plans.actionHardDelete')}
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex gap-2">
                        {onToggleActive && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onToggleActive(row.id, !row.isActive)}
                                disabled={isTogglingActive}
                                title={
                                    row.isActive
                                        ? t('admin-billing.plans.actionDeactivate')
                                        : t('admin-billing.plans.actionActivate')
                                }
                            >
                                <PowerIcon className="mr-1 h-3 w-3" />
                                {row.isActive
                                    ? t('admin-billing.plans.actionDeactivate')
                                    : t('admin-billing.plans.actionActivate')}
                            </Button>
                        )}
                        {onEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(row)}
                                title={t('admin-billing.plans.actionEdit')}
                            >
                                <EditIcon className="mr-1 h-3 w-3" />
                                {t('admin-billing.plans.actionEdit')}
                            </Button>
                        )}
                        {onDelete && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onDelete(row)}
                                disabled={isDeleting}
                                title={t('admin-billing.plans.actionDelete')}
                            >
                                <DeleteIcon className="mr-1 h-3 w-3" />
                                {t('admin-billing.plans.actionDelete')}
                            </Button>
                        )}
                    </div>
                )
        }
    ];
}
