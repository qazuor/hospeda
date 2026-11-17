/**
 * @file CatalogDeleteDialog.tsx
 * @description Confirmation dialog for deleting a catalog group or category
 * (HOS-919).
 *
 * Deleting is the destructive option and deactivating is the safe one (spec
 * D2), so the dialog states what delete does and the 409 explanation the page
 * shows afterwards points the operator at the active switch.
 */

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import { catalogKey } from '../lib/i18n-keys';

/** The row the operator is about to delete. */
export interface CatalogDeleteTarget {
    readonly id: string;
    /** Display name already resolved for the operator's locale. */
    readonly name: string;
}

/** Props for {@link CatalogDeleteDialog}. */
export interface CatalogDeleteDialogProps {
    readonly scope: 'groups' | 'categories';
    /** The pending deletion, or `null` when the dialog is closed. */
    readonly target: CatalogDeleteTarget | null;
    readonly isPending: boolean;
    readonly onConfirm: () => void;
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * Asks for confirmation before a catalog row is deleted.
 *
 * @param props - {@link CatalogDeleteDialogProps}
 */
export function CatalogDeleteDialog({
    scope,
    target,
    isPending,
    onConfirm,
    onOpenChange
}: CatalogDeleteDialogProps) {
    const { t } = useTranslations();
    const testPrefix = scope === 'groups' ? 'group' : 'category';

    if (!target) return null;

    return (
        <Dialog
            open
            onOpenChange={onOpenChange}
        >
            <DialogContent data-testid={`${testPrefix}-delete-dialog`}>
                <DialogHeader>
                    <DialogTitle>
                        {t(catalogKey({ path: `${scope}.deleteDialog.title` }))}
                    </DialogTitle>
                    <DialogDescription>
                        {t(catalogKey({ path: `${scope}.deleteDialog.message` }), {
                            name: target.name
                        })}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => onOpenChange(false)}
                    >
                        {t(catalogKey({ path: 'actions.cancel' }))}
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={isPending}
                        data-testid={`${testPrefix}-delete-confirm`}
                        onClick={onConfirm}
                    >
                        {t(catalogKey({ path: `${scope}.deleteDialog.confirm` }))}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
