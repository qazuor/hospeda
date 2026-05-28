/**
 * InlineStateSelectCell — generic, entity-agnostic inline editable badge-dropdown cell.
 *
 * Renders the current value as a colored badge that doubles as a dropdown
 * trigger; selecting a different option PATCHes `{ [field]: value }` via the
 * mutation returned by `useUpdateMutation(entityId)`. Success/error surface a
 * toast. When the user lacks `permission`, the value renders via the read-only
 * `BadgeCell` (identical to a plain BADGE column).
 *
 * Destructive transitions (values in `confirmValues`, e.g. ARCHIVED / REJECTED)
 * show a confirmation dialog before applying.
 *
 * The hook-factory pattern mirrors {@link DeleteRowButton}: each consumer passes
 * its own `useUpdate*Mutation` (a stable top-level import); the component invokes
 * it once per render, so rules of hooks stay satisfied.
 */

import { DeleteConfirmDialog } from '@/components/entity-form/fields/DeleteConfirmDialog';
import type { BadgeColor } from '@/components/table/DataTable';
import { BadgeCell, getBadgeColorClasses } from '@/components/table/cells/BadgeCell';
import { useToast } from '@/components/ui/ToastProvider';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';
import type { TranslationKey } from '@repo/i18n';
import { ChevronDownIcon, type IconProps } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import { type ComponentType, useState } from 'react';

/** Minimal mutation shape required by the cell. */
export interface InlineUpdateMutationLike<TPatch> {
    readonly mutateAsync: (patch: TPatch) => Promise<unknown>;
    readonly isPending: boolean;
}

/** A selectable option, mirroring the `badgeOptions` shape from the columns config. */
export interface InlineStateOption {
    readonly value: string;
    readonly label: string;
    readonly color: BadgeColor;
    /**
     * Optional per-value icon. When provided, it renders next to the label in
     * both the dropdown trigger and the menu items (e.g. role badges).
     */
    readonly icon?: ComponentType<IconProps>;
}

/**
 * Props for {@link InlineStateSelectCell}. RO-RO pattern. Generic over the
 * entity's PATCH shape so the mutation hook stays fully typed.
 */
export interface InlineStateSelectCellProps<TPatch extends Record<string, unknown>> {
    /** Entity ID being edited (passed to the mutation hook). */
    readonly entityId: string;
    /** Human-readable entity name, interpolated into the success toast. */
    readonly entityName: string;
    /** i18n key for the singular entity label, used in error/confirm copy. */
    readonly entityLabelKey: TranslationKey;
    /** PATCH key this cell edits (e.g. 'visibility', 'lifecycleState'). */
    readonly field: keyof TPatch & string;
    /** Current field value. */
    readonly currentValue: unknown;
    /** Available options (value + localized label + badge color). */
    readonly options: ReadonlyArray<InlineStateOption>;
    /** Permission required to edit. Without it the cell is read-only. */
    readonly permission: PermissionEnum;
    /**
     * i18n key for the success toast. Receives `{ name, value }` (entity name +
     * the new value's localized label), e.g. "Estado de «X» cambiado a Y".
     */
    readonly successMessageKey: TranslationKey;
    /**
     * Update mutation hook factory. Must be a stable top-level import; the
     * component invokes it once per render with `entityId`.
     */
    readonly useUpdateMutation: (id: string) => InlineUpdateMutationLike<TPatch>;
    /**
     * Option values that require a confirmation dialog before applying
     * (destructive transitions). Defaults to none.
     */
    readonly confirmValues?: ReadonlyArray<string>;
    /**
     * Which `confirmations.*` i18n block drives the confirm dialog copy.
     * `archive` for lifecycle ARCHIVED, `reject` for moderation REJECTED,
     * `roleChange` for sensitive role transitions (e.g. promoting to
     * ADMIN/SUPER_ADMIN). Defaults to `reject`.
     */
    readonly confirmCopyKey?: 'archive' | 'reject' | 'roleChange';
}

/**
 * Renders a colored badge that, when permitted, opens a dropdown of options to
 * change `field` in place.
 */
export function InlineStateSelectCell<TPatch extends Record<string, unknown>>({
    entityId,
    entityName,
    entityLabelKey,
    field,
    currentValue,
    options,
    permission,
    successMessageKey,
    useUpdateMutation,
    confirmValues = [],
    confirmCopyKey = 'reject'
}: InlineStateSelectCellProps<TPatch>) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useUpdateMutation(entityId);
    const [pendingValue, setPendingValue] = useState<string | null>(null);

    const userPermissions = useUserPermissions();
    const canEdit = userPermissions.includes(permission);

    const applyChange = async (value: string) => {
        try {
            await mutation.mutateAsync({ [field]: value } as TPatch);
            const valueLabel = options.find((option) => option.value === value)?.label ?? value;
            addToast({
                message: t(successMessageKey, { name: entityName, value: valueLabel }),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[InlineStateSelectCell] Failed to update state', {
                id: entityId,
                field,
                value,
                error
            });
            addToast({
                message: t('admin-entities.messages.error.update', {
                    entity: t(entityLabelKey)
                }),
                variant: 'error'
            });
        }
    };

    const handleSelect = (value: string) => {
        if (value === String(currentValue ?? '')) return;
        if (confirmValues.includes(value)) {
            setPendingValue(value);
            return;
        }
        void applyChange(value);
    };

    // Read-only fallback: identical look to a plain BADGE column.
    if (!canEdit) {
        return (
            <BadgeCell
                value={currentValue}
                options={options}
            />
        );
    }

    // Resolve confirm-dialog i18n keys statically per copy variant so the
    // generated `TranslationKey` union stays satisfied (no dynamic key building).
    const confirmKeys: Record<
        'archive' | 'reject' | 'roleChange',
        Readonly<{
            title: TranslationKey;
            message: TranslationKey;
            cancel: TranslationKey;
            confirm: TranslationKey;
        }>
    > = {
        archive: {
            title: 'admin-entities.confirmations.archive.title',
            message: 'admin-entities.confirmations.archive.message',
            cancel: 'admin-entities.confirmations.archive.cancel',
            confirm: 'admin-entities.confirmations.archive.confirm'
        },
        reject: {
            title: 'admin-entities.confirmations.reject.title',
            message: 'admin-entities.confirmations.reject.message',
            cancel: 'admin-entities.confirmations.reject.cancel',
            confirm: 'admin-entities.confirmations.reject.confirm'
        },
        roleChange: {
            title: 'admin-entities.confirmations.roleChange.title',
            message: 'admin-entities.confirmations.roleChange.message',
            cancel: 'admin-entities.confirmations.roleChange.cancel',
            confirm: 'admin-entities.confirmations.roleChange.confirm'
        }
    };
    const dialogCopy = confirmKeys[confirmCopyKey];
    const entityLabel = t(entityLabelKey);

    const currentOption = options.find((option) => option.value === String(currentValue ?? ''));
    const triggerClasses = currentOption
        ? getBadgeColorClasses(currentOption.color)
        : 'bg-muted text-muted-foreground ring-border';
    const triggerLabel = currentOption?.label ?? String(currentValue ?? '—');
    const TriggerIcon = currentOption?.icon;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    type="button"
                    disabled={mutation.isPending}
                    aria-label={triggerLabel}
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-xs ring-1 ring-inset transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
                        triggerClasses
                    )}
                >
                    {TriggerIcon ? (
                        <TriggerIcon
                            size={12}
                            aria-hidden="true"
                        />
                    ) : null}
                    {triggerLabel}
                    <ChevronDownIcon
                        size={12}
                        aria-hidden="true"
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {options.map((option) => {
                        const OptionIcon = option.icon;
                        return (
                            <DropdownMenuItem
                                key={option.value}
                                onSelect={() => handleSelect(option.value)}
                            >
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-xs ring-1 ring-inset',
                                        getBadgeColorClasses(option.color)
                                    )}
                                >
                                    {OptionIcon ? (
                                        <OptionIcon
                                            size={12}
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {option.label}
                                </span>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
            <DeleteConfirmDialog
                open={pendingValue !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingValue(null);
                }}
                title={t(dialogCopy.title, { entity: entityLabel })}
                description={t(dialogCopy.message, { entity: entityLabel })}
                cancelLabel={t(dialogCopy.cancel)}
                confirmLabel={t(dialogCopy.confirm)}
                onConfirm={() => {
                    const value = pendingValue;
                    setPendingValue(null);
                    if (value) void applyChange(value);
                }}
            />
        </>
    );
}
