/**
 * @file CatalogDeleteConfirm.tsx
 * @description Reusable delete-confirmation dialog for social catalog entities (SPEC-254 T-020).
 *
 * Wraps Shadcn Dialog with a yes/no confirmation pattern.
 * The parent page passes the entity name for contextual messaging.
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

/** Props for {@link CatalogDeleteConfirm}. */
export interface CatalogDeleteConfirmProps {
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Called when the dialog open state should change. */
    readonly onOpenChange: (open: boolean) => void;
    /** Human-readable name of the item being deleted (shown in body). */
    readonly itemName: string;
    /** Whether the delete mutation is in flight. */
    readonly isDeleting: boolean;
    /** Called when the user confirms deletion. */
    readonly onConfirm: () => void;
    /** i18n key prefix, e.g. 'social.hashtags' — the component appends '.delete.*'. */
    readonly i18nPrefix: string;
}

/**
 * Generic delete confirmation dialog for social catalog pages.
 *
 * @param props - {@link CatalogDeleteConfirmProps}
 */
export function CatalogDeleteConfirm({
    open,
    onOpenChange,
    itemName,
    isDeleting,
    onConfirm,
    i18nPrefix
}: CatalogDeleteConfirmProps) {
    const { t } = useTranslations();

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {t(`${i18nPrefix}.delete.title` as Parameters<typeof t>[0])}
                    </DialogTitle>
                    <DialogDescription>
                        {t(`${i18nPrefix}.delete.desc` as Parameters<typeof t>[0], {
                            name: itemName
                        })}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        {t(`${i18nPrefix}.delete.cancel` as Parameters<typeof t>[0])}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        data-testid="catalog-delete-confirm-btn"
                    >
                        {isDeleting
                            ? t(`${i18nPrefix}.delete.deleting` as Parameters<typeof t>[0])
                            : t(`${i18nPrefix}.delete.confirm` as Parameters<typeof t>[0])}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
