/**
 * RevalidateEntityButton
 *
 * A button that triggers manual ISR revalidation for a specific entity instance.
 * Calls the admin revalidation API and shows toast feedback on success or error.
 *
 * @module components/RevalidateEntityButton
 */

import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui-wrapped/Button';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { revalidateEntity } from '@/lib/revalidation-http-adapter';
import { cn } from '@/lib/utils';
import { PermissionEnum } from '@repo/schemas';

/**
 * Props for the RevalidateEntityButton component.
 */
export type RevalidateEntityButtonProps = {
    /** The entity type to revalidate (e.g., `'accommodation'`, `'destination'`) */
    readonly entityType: string;
    /** The ID of the specific entity instance */
    readonly entityId: string;
    /** Optional label override */
    readonly label?: string;
    /** Optional additional CSS classes for the button */
    readonly className?: string;
};

/**
 * RevalidateEntityButton component
 *
 * Renders a small outline button that, when clicked, triggers on-demand ISR
 * revalidation for the given entity. While the request is in flight the button
 * is disabled and shows a loading spinner via the wrapped Button component.
 *
 * Requires the `REVALIDATION_TRIGGER` permission. Returns `null` if the
 * current user lacks that permission.
 *
 * @example
 * ```tsx
 * <RevalidateEntityButton entityType="accommodation" entityId={accommodation.id} />
 * ```
 */
export function RevalidateEntityButton({
    entityType,
    entityId,
    label,
    className
}: RevalidateEntityButtonProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const canTriggerRevalidation = useHasPermission(PermissionEnum.REVALIDATION_TRIGGER);

    if (!canTriggerRevalidation) {
        return null;
    }

    const buttonLabel = label ?? t('revalidation.actions.revalidateEntity');

    const mutation = useMutation({
        mutationFn: () => revalidateEntity(entityType, entityId),
        onSuccess: () => {
            addToast({
                message: t('revalidation.messages.revalidateSuccess'),
                variant: 'success'
            });
        },
        onError: () => {
            addToast({
                message: t('revalidation.messages.revalidateError'),
                variant: 'error'
            });
        }
    });

    return (
        <Button
            variant="outline"
            size="sm"
            className={cn(className)}
            loading={mutation.isPending}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
        >
            {mutation.isPending ? `${t('revalidation.actions.revalidate')}...` : buttonLabel}
        </Button>
    );
}
