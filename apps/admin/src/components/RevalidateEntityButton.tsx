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
import { revalidateEntity } from '@/lib/revalidation-http-adapter';

/**
 * Props for the RevalidateEntityButton component.
 */
export type RevalidateEntityButtonProps = {
    /** The entity type to revalidate (e.g., `'accommodation'`, `'destination'`) */
    readonly entityType: string;
    /** The ID of the specific entity instance */
    readonly entityId: string;
    /** Optional label override (defaults to `'Revalidar'`) */
    readonly label?: string;
};

/**
 * RevalidateEntityButton component
 *
 * Renders a small outline button that, when clicked, triggers on-demand ISR
 * revalidation for the given entity. While the request is in flight the button
 * is disabled and shows a loading spinner via the wrapped Button component.
 *
 * @example
 * ```tsx
 * <RevalidateEntityButton entityType="accommodation" entityId={accommodation.id} />
 * ```
 */
export function RevalidateEntityButton({
    entityType,
    entityId,
    label = 'Revalidar',
}: RevalidateEntityButtonProps) {
    const { addToast } = useToast();

    const mutation = useMutation({
        mutationFn: () => revalidateEntity(entityType, entityId),
        onSuccess: () => {
            addToast({
                message: 'Páginas revalidadas correctamente',
                variant: 'success',
            });
        },
        onError: () => {
            addToast({
                message: 'Error al revalidar las páginas',
                variant: 'error',
            });
        },
    });

    return (
        <Button
            variant="outline"
            size="sm"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
        >
            {mutation.isPending ? 'Revalidando...' : label}
        </Button>
    );
}
