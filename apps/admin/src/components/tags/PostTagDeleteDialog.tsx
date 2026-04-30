import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { usePostTagImpact } from '@/hooks/use-post-tags';
import { LoaderIcon } from '@repo/icons';
import type { ReactNode } from 'react';

interface PostTagDeleteDialogProps {
    /** UUID of the PostTag to delete. */
    readonly postTagId: string;
    /** Human-readable name of the PostTag (shown in dialog copy). */
    readonly postTagName: string;
    /** Element that triggers the dialog (e.g. a delete icon button). */
    readonly trigger: ReactNode;
    /** Called when the user confirms deletion. */
    readonly onConfirm: () => void;
    /** Whether the deletion mutation is in progress. */
    readonly isDeleting: boolean;
    /** Controlled open state. */
    readonly open: boolean;
    /** Called to change the open state. */
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * Two-step hard-delete confirmation dialog for PostTags.
 *
 * On open, lazily fetches the impact count from
 * `GET /api/v1/admin/posts/tags/:id/impact` and displays it in the
 * confirmation message so the editor can make an informed decision.
 *
 * Flow:
 * 1. User clicks trigger → dialog opens → impact count is fetched.
 * 2. Dialog shows name + count.
 * 3. User clicks "Eliminar" → `onConfirm()` is called.
 * 4. User clicks "Cancelar" → dialog closes, no mutation is triggered.
 *
 * @see D-011 in SPEC-086 decisions.md
 * @see AC-005-01, AC-005-02, AC-005-03
 */
export function PostTagDeleteDialog({
    postTagId,
    postTagName,
    trigger,
    onConfirm,
    isDeleting,
    open,
    onOpenChange
}: PostTagDeleteDialogProps) {
    // Lazily fetch impact count only while the dialog is open.
    const { data: impactData, isLoading: isLoadingImpact } = usePostTagImpact(postTagId, open);

    const impactCount = impactData?.count ?? 0;

    return (
        <AlertDialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

            <AlertDialogContent aria-labelledby="post-tag-delete-title">
                <AlertDialogHeader>
                    <AlertDialogTitle id="post-tag-delete-title">
                        Eliminar etiqueta de publicación
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            {isLoadingImpact ? (
                                <p className="flex items-center gap-2 text-sm">
                                    <LoaderIcon
                                        className="h-4 w-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                    Calculando impacto...
                                </p>
                            ) : (
                                <p
                                    data-testid="impact-message"
                                    className="text-sm"
                                >
                                    Estás por eliminar permanentemente{' '}
                                    <strong>"{postTagName}"</strong>. Esto la quitará de{' '}
                                    <strong>
                                        {impactCount}{' '}
                                        {impactCount === 1 ? 'publicación' : 'publicaciones'}
                                    </strong>{' '}
                                    y puede afectar el SEO. Esta acción no se puede deshacer.
                                </p>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel
                        disabled={isDeleting}
                        data-testid="cancel-button"
                    >
                        Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isDeleting || isLoadingImpact}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="confirm-button"
                        aria-busy={isDeleting}
                    >
                        {isDeleting ? 'Eliminando...' : 'Eliminar'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
