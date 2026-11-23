/**
 * @file ListingItemsSheet.client.tsx
 * @description Trigger + `sheet` Dialog that lists ALL the amenities or features of a
 * listing (HOS-2528). The summarized section renders only a few pills; this island
 * owns the «Ver las N …» button and the panel with the complete list. The list itself
 * arrives as server-rendered children, so icons and translations never ship to the client.
 */
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import styles from './ListingItemsSheet.module.css';

/** Props of {@link ListingItemsSheet}. */
export interface ListingItemsSheetProps {
    /** Label of the button that opens the panel (e.g. «Ver las 12 comodidades»). */
    readonly triggerLabel: string;
    /** Heading of the panel. */
    readonly title: string;
    /** Accessible label of the panel's close button. */
    readonly closeLabel: string;
    /** Stable id suffix used to label the panel. */
    readonly sheetId: string;
    /** The complete list, rendered by the server. */
    readonly children: ReactNode;
}

/** Button that opens a bottom sheet (centered dialog on desktop) with the full list. */
export function ListingItemsSheet({
    triggerLabel,
    title,
    closeLabel,
    sheetId,
    children
}: ListingItemsSheetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const titleId = `${sheetId}-title`;

    function close(): void {
        setIsOpen(false);
        triggerRef.current?.focus();
    }

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={styles.trigger}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(true)}
            >
                {triggerLabel}
            </button>
            <Dialog
                isOpen={isOpen}
                onClose={close}
                variant="sheet"
                ariaLabelledBy={titleId}
            >
                <DialogHeader
                    titleId={titleId}
                    onClose={close}
                    closeLabel={closeLabel}
                >
                    {title}
                </DialogHeader>
                <DialogBody>{children}</DialogBody>
            </Dialog>
        </>
    );
}
