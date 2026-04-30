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
import { LoaderIcon } from '@repo/icons';
import type { ReactNode } from 'react';

/** Tag type label for copy variation. */
type AdminTagType = 'SYSTEM' | 'INTERNAL';

interface AdminTagDeleteDialogProps {
    /** UUID of the tag to delete. */
    readonly tagId: string;
    /** Human-readable name of the tag (shown in dialog copy). */
    readonly tagName: string;
    /**
     * Type of the tag — drives the impact warning copy.
     * SYSTEM tags affect all entities; INTERNAL tags affect admin workflows.
     */
    readonly tagType: AdminTagType;
    /** Impact count: number of entities currently using this tag. */
    readonly impactCount: number;
    /** Whether the impact count is still being fetched. */
    readonly isLoadingImpact: boolean;
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

/** Impact copy per tag type. */
const IMPACT_COPY: Readonly<Record<AdminTagType, string>> = {
    SYSTEM: 'entidades',
    INTERNAL: 'entidades'
} as const;

/** Title copy per tag type. */
const TITLE_COPY: Readonly<Record<AdminTagType, string>> = {
    SYSTEM: 'Eliminar etiqueta de sistema',
    INTERNAL: 'Eliminar etiqueta interna'
} as const;

/**
 * Two-step hard-delete confirmation dialog for SYSTEM and INTERNAL tags.
 *
 * Unlike PostTagDeleteDialog, the impact count is fetched by the parent and
 * passed in as a prop — this keeps the dialog pure and testable without
 * needing to wire up a query internally.
 *
 * Per D-011: Tags use hard delete with cascade on `r_entity_tag`.
 * The dialog shows the impact count so the admin can make an informed decision.
 *
 * Flow:
 * 1. Parent opens dialog → passes impactCount + isLoadingImpact.
 * 2. Dialog shows name + count.
 * 3. User clicks "Eliminar" → `onConfirm()` is called.
 * 4. User clicks "Cancelar" → dialog closes, no mutation triggered.
 *
 * @see D-011 in SPEC-086 decisions.md
 * @see AC-004-01, AC-004-02, AC-004-03
 */
export function AdminTagDeleteDialog({
    tagName,
    tagType,
    impactCount,
    isLoadingImpact,
    trigger,
    onConfirm,
    isDeleting,
    open,
    onOpenChange
}: AdminTagDeleteDialogProps) {
    const entityLabel = IMPACT_COPY[tagType];
    const title = TITLE_COPY[tagType];

    return (
        <AlertDialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

            <AlertDialogContent aria-labelledby="admin-tag-delete-title">
                <AlertDialogHeader>
                    <AlertDialogTitle id="admin-tag-delete-title">{title}</AlertDialogTitle>
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
                                    Estás por eliminar permanentemente <strong>"{tagName}"</strong>.
                                    Esto la quitará de{' '}
                                    <strong>
                                        {impactCount}{' '}
                                        {impactCount === 1 ? entityLabel.slice(0, -2) : entityLabel}
                                    </strong>{' '}
                                    que la usan actualmente. Esta acción no se puede deshacer.
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
