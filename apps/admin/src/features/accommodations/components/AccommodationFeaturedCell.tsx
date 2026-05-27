/**
 * AccommodationFeaturedCell — inline editable "Destacado" (isFeatured) cell.
 *
 * Renders a Radix `Switch` gated by `ACCOMMODATION_FEATURED_TOGGLE`. Toggling
 * PATCHes `{ isFeatured }` immediately via `useUpdateAccommodationMutation`
 * (optimistic update + cache rollback on error are handled inside the hook).
 * On success/failure a toast is shown. Users lacking the permission see the
 * read-only `BooleanCell` (same look as before this column became editable).
 *
 * The mutation hook is mounted once per cell instance with `row.id` — the same
 * rules-of-hooks pattern used by the other accommodation widget cells.
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { BooleanCell } from '@/components/table/cells/BooleanCell';
import { useToast } from '@/components/ui/ToastProvider';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import { PermissionEnum } from '@repo/schemas';
import { useUpdateAccommodationMutation } from '../hooks/useAccommodationQuery';
import type { AccommodationCore } from '../schemas/accommodation-client.schema';
import type { Accommodation } from '../schemas/accommodations.schemas';

/**
 * Props for {@link AccommodationFeaturedCell}. RO-RO pattern.
 */
export interface AccommodationFeaturedCellProps {
    /** The accommodation row being rendered. */
    readonly row: Accommodation;
}

/**
 * Inline editable featured toggle for the accommodations list.
 */
export const AccommodationFeaturedCell = ({ row }: AccommodationFeaturedCellProps) => {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useUpdateAccommodationMutation(row.id);
    const checked = Boolean(row.isFeatured);

    const handleChange = async (next: boolean) => {
        try {
            await mutation.mutateAsync({ isFeatured: next } as Partial<AccommodationCore>);
            addToast({
                message: t(
                    next
                        ? 'admin-entities.messages.featuredOn'
                        : 'admin-entities.messages.featuredOff',
                    { name: row.name }
                ),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[AccommodationFeaturedCell] Failed to toggle isFeatured', {
                id: row.id,
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

    return (
        <PermissionGate
            permissions={[PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE]}
            fallback={<BooleanCell value={checked} />}
        >
            <div className="flex items-center">
                <Switch
                    checked={checked}
                    disabled={mutation.isPending}
                    onCheckedChange={handleChange}
                    aria-label={t('admin-entities.columns.featured')}
                    className="scale-75"
                />
            </div>
        </PermissionGate>
    );
};
