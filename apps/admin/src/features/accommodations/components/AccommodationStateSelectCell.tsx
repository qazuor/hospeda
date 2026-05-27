/**
 * AccommodationStateSelectCell — generic inline editable badge-dropdown cell.
 *
 * Used by the accommodations list for the Visibilidad / Estado / Moderación
 * columns. The current value renders as a colored badge that doubles as a
 * dropdown trigger; opening it lists every option as a colored pill, and
 * selecting a different value PATCHes `{ [field]: value }` via
 * `useUpdateAccommodationMutation` (optimistic update + cache rollback live
 * inside the hook). Success/error surface a toast.
 *
 * Permission gating: when the user lacks `permission`, the value renders via
 * the read-only `BadgeCell` (identical to the pre-inline-edit look) with no
 * interactive control.
 *
 * Destructive transitions: when the selected value is in `confirmValues`
 * (e.g. ARCHIVED for lifecycle, REJECTED for moderation), a confirmation
 * dialog (`DeleteConfirmDialog`, the shared Radix AlertDialog wrapper) is shown
 * before the mutation runs. All other transitions apply directly.
 *
 * The mutation hook is mounted once per cell instance with `row.id` — the same
 * rules-of-hooks pattern used by the other accommodation widget cells.
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
import { ChevronDownIcon } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { useUpdateAccommodationMutation } from '../hooks/useAccommodationQuery';
import type { AccommodationCore } from '../schemas/accommodation-client.schema';
import type { Accommodation } from '../schemas/accommodations.schemas';

/** Editable state field handled by this cell. */
export type AccommodationStateField = 'visibility' | 'lifecycleState' | 'moderationState';

/** A selectable option, mirroring the `badgeOptions` shape from the columns config. */
export interface AccommodationStateOption {
    readonly value: string;
    readonly label: string;
    readonly color: BadgeColor;
}

/**
 * Props for {@link AccommodationStateSelectCell}. RO-RO pattern.
 */
export interface AccommodationStateSelectCellProps {
    /** The accommodation row being rendered. */
    readonly row: Accommodation;
    /** Which accommodation field this cell edits. */
    readonly field: AccommodationStateField;
    /**
     * i18n key for the success toast. Receives `{ name, value }` (accommodation
     * name + the new value's localized label), e.g. "Estado de «X» cambiado a Y".
     */
    readonly successMessageKey: TranslationKey;
    /** Available options (value + localized label + badge color). */
    readonly options: ReadonlyArray<AccommodationStateOption>;
    /** Permission required to edit. Without it the cell is read-only. */
    readonly permission: PermissionEnum;
    /**
     * Option values that require a confirmation dialog before applying
     * (destructive transitions, e.g. ARCHIVED / REJECTED). Defaults to none.
     */
    readonly confirmValues?: ReadonlyArray<string>;
    /**
     * Which `confirmations.*` i18n block drives the confirm dialog copy for a
     * destructive transition. `archive` for lifecycle ARCHIVED, `reject` for
     * moderation REJECTED. Ignored when `confirmValues` is empty.
     * Defaults to `reject`.
     */
    readonly confirmCopyKey?: 'archive' | 'reject';
}

/**
 * Renders a colored badge that, when permitted, opens a dropdown of options to
 * change `field` in place.
 */
export const AccommodationStateSelectCell = ({
    row,
    field,
    successMessageKey,
    options,
    permission,
    confirmValues = [],
    confirmCopyKey = 'reject'
}: AccommodationStateSelectCellProps) => {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useUpdateAccommodationMutation(row.id);
    const [pendingValue, setPendingValue] = useState<string | null>(null);

    const currentValue = row[field];
    const userPermissions = useUserPermissions();
    const canEdit = userPermissions.includes(permission);

    const applyChange = async (value: string) => {
        try {
            await mutation.mutateAsync({ [field]: value } as Partial<AccommodationCore>);
            const valueLabel = options.find((option) => option.value === value)?.label ?? value;
            addToast({
                message: t(successMessageKey, { name: row.name, value: valueLabel }),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[AccommodationStateSelectCell] Failed to update state', {
                id: row.id,
                field,
                value,
                error
            });
            addToast({
                message: t('admin-entities.messages.error.update', {
                    entity: t('admin-entities.entities.accommodation.singular')
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

    // Read-only fallback: identical look to the previous BADGE column.
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
        'archive' | 'reject',
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
        }
    };
    const dialogCopy = confirmKeys[confirmCopyKey];
    const accommodationLabel = t('admin-entities.entities.accommodation.singular');

    const currentOption = options.find((option) => option.value === String(currentValue ?? ''));
    const triggerClasses = currentOption
        ? getBadgeColorClasses(currentOption.color)
        : 'bg-muted text-muted-foreground ring-border';
    const triggerLabel = currentOption?.label ?? String(currentValue ?? '—');

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
                    {triggerLabel}
                    <ChevronDownIcon
                        size={12}
                        aria-hidden="true"
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {options.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onSelect={() => handleSelect(option.value)}
                        >
                            <span
                                className={cn(
                                    'inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs ring-1 ring-inset',
                                    getBadgeColorClasses(option.color)
                                )}
                            >
                                {option.label}
                            </span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DeleteConfirmDialog
                open={pendingValue !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingValue(null);
                }}
                title={t(dialogCopy.title, { entity: accommodationLabel })}
                description={t(dialogCopy.message, { entity: accommodationLabel })}
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
};
