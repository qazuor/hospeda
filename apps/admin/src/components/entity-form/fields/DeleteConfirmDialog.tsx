/**
 * DeleteConfirmDialog — shared confirmation dialog for destructive media actions.
 *
 * Introduced by T-045 to satisfy SPEC-078-GAPS D3-C: the delete confirmation
 * for media fields (ImageField / GalleryField / AvatarUpload) lives here, NOT
 * inline in accommodation edit pages.
 *
 * A11y:
 * - Built on top of shadcn `AlertDialog` (Radix primitive) so Escape closes,
 *   focus is trapped in the dialog, and screen readers announce role="alertdialog".
 * - The Cancel button receives initial focus (safe default for destructive ops).
 * - Enter on the Delete button confirms (native button behavior).
 */

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for {@link DeleteConfirmDialog}. RO-RO pattern.
 */
export interface DeleteConfirmDialogProps {
    /** Whether the dialog is open. Controlled. */
    open: boolean;
    /** Called when the dialog requests to open/close (overlay click, Escape, Cancel). */
    onOpenChange: (open: boolean) => void;
    /** Dialog title — defaults to a localized "Delete image?" via the caller. */
    title: string;
    /** Dialog body — typically a localized "This action cannot be undone." */
    description: string;
    /** Cancel button label (localized). */
    cancelLabel: string;
    /** Destructive confirm button label (localized). */
    confirmLabel: string;
    /** Called when the user confirms. Dialog closes afterwards via onOpenChange. */
    onConfirm: () => void;
    /** Optional extra class name on the dialog content. */
    className?: string;
}

/**
 * DeleteConfirmDialog — controlled destructive confirmation dialog.
 *
 * Usage:
 * ```tsx
 * <DeleteConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title={t('admin-entities.fields.image.deleteDialogTitle')}
 *     description={t('admin-entities.fields.image.deleteDialogDescription')}
 *     cancelLabel={t('admin-entities.fields.image.deleteDialogCancel')}
 *     confirmLabel={t('admin-entities.fields.image.deleteDialogConfirm')}
 *     onConfirm={() => {
 *         setOpen(false);
 *         runDelete();
 *     }}
 * />
 * ```
 */
export const DeleteConfirmDialog = ({
    open,
    onOpenChange,
    title,
    description,
    cancelLabel,
    confirmLabel,
    onConfirm,
    className
}: DeleteConfirmDialogProps): React.ReactElement => {
    const cancelRef = React.useRef<HTMLButtonElement>(null);

    // Focus Cancel first when dialog opens (safe default for destructive ops).
    // Radix manages focus trap + Escape; we only need to override initial target.
    React.useEffect(() => {
        if (!open) return;
        // Defer until Radix mounts the dialog content.
        const raf = requestAnimationFrame(() => {
            cancelRef.current?.focus();
        });
        return () => cancelAnimationFrame(raf);
    }, [open]);

    return (
        <AlertDialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <AlertDialogContent
                className={cn(
                    // Respect prefers-reduced-motion: disable Radix fade/zoom transitions.
                    'motion-reduce:animate-none motion-reduce:transition-none',
                    className
                )}
                data-testid="delete-confirm-dialog"
            >
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        ref={cancelRef}
                        data-testid="delete-confirm-cancel"
                    >
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        data-testid="delete-confirm-confirm"
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
