/**
 * InlineFeaturedCell — generic, entity-agnostic inline editable "Destacado"
 * (isFeatured) cell.
 *
 * Renders a Radix `Switch` gated by `permission`. Toggling PATCHes
 * `{ isFeatured }` via the mutation returned by `useUpdateMutation(entityId)`,
 * then surfaces a success/error toast. Users lacking the permission see the
 * read-only `BooleanCell`.
 *
 * Hook-factory pattern mirrors {@link DeleteRowButton} / {@link InlineStateSelectCell}.
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { BooleanCell } from '@/components/table/cells/BooleanCell';
import { useToast } from '@/components/ui/ToastProvider';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import type { TranslationKey } from '@repo/i18n';
import type { PermissionEnum } from '@repo/schemas';
import type { InlineUpdateMutationLike } from './InlineStateSelectCell';

/**
 * Props for {@link InlineFeaturedCell}. RO-RO pattern. Generic over the entity's
 * PATCH shape so the mutation hook stays fully typed.
 */
export interface InlineFeaturedCellProps<TPatch extends Record<string, unknown>> {
    /** Entity ID being edited (passed to the mutation hook). */
    readonly entityId: string;
    /** Human-readable entity name, interpolated into the success toast. */
    readonly entityName: string;
    /** i18n key for the singular entity label, used in the error toast. */
    readonly entityLabelKey: TranslationKey;
    /** Current featured state. */
    readonly checked: boolean;
    /** Permission required to edit. Without it the cell is read-only. */
    readonly permission: PermissionEnum;
    /**
     * Update mutation hook factory. Must be a stable top-level import; the
     * component invokes it once per render with `entityId`.
     */
    readonly useUpdateMutation: (id: string) => InlineUpdateMutationLike<TPatch>;
}

/**
 * Inline editable featured toggle, reusable across entity lists.
 */
export function InlineFeaturedCell<TPatch extends Record<string, unknown>>({
    entityId,
    entityName,
    entityLabelKey,
    checked,
    permission,
    useUpdateMutation
}: InlineFeaturedCellProps<TPatch>) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useUpdateMutation(entityId);

    const handleChange = async (next: boolean) => {
        try {
            // TYPE-WORKAROUND: `TPatch` is the entity-specific PATCH shape; `{ isFeatured }`
            // is always a valid subset of it but TypeScript can't verify that without a
            // `extends` constraint on the generic — the cast keeps the helper entity-agnostic.
            await mutation.mutateAsync({ isFeatured: next } as unknown as TPatch);
            addToast({
                message: t(
                    next
                        ? 'admin-entities.messages.featuredOn'
                        : 'admin-entities.messages.featuredOff',
                    { name: entityName }
                ),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[InlineFeaturedCell] Failed to toggle isFeatured', {
                id: entityId,
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

    return (
        <PermissionGate
            permissions={[permission]}
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
}
