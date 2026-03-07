/**
 * @file Modal.client.tsx
 * @description Accessible modal dialog component using native `<dialog>` element.
 * Provides focus trapping, backdrop dismiss, and keyboard support.
 */

import { CloseIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';

/**
 * Props for the Modal component
 */
export interface ModalProps {
    /** Title displayed in the modal header */
    readonly title: string;
    /** Content to display inside the modal */
    readonly children: React.ReactNode;
    /** Controls whether the modal is open */
    readonly open: boolean;
    /** Callback fired when the modal should close */
    readonly onClose: () => void;
    /** Additional CSS classes */
    readonly className?: string;
    /** Accessible label for the close button (default: "Cerrar") */
    readonly closeLabel?: string;
}

/**
 * Modal component using native `<dialog>` element.
 *
 * Features:
 * - Native focus trap (dialog element handles this automatically)
 * - Close on Escape key (native dialog behavior + onClose callback)
 * - Close on backdrop click
 * - Smooth open/close transitions via tw-animate-css
 * - Full ARIA compliance (aria-modal, role, aria-labelledby)
 *
 * @param props - Component props
 * @returns React component
 */
export function Modal({
    title,
    children,
    open,
    onClose,
    className = '',
    closeLabel = 'Cerrar'
}: ModalProps): JSX.Element {
    const dialogRef = useRef<HTMLDialogElement>(null);

    // Sync open prop with dialog.showModal()/close()
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    // Handle native dialog close events (Escape key)
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const handleCancel = (event: Event) => {
            event.preventDefault();
            onClose();
        };

        dialog.addEventListener('cancel', handleCancel);
        return () => {
            dialog.removeEventListener('cancel', handleCancel);
        };
    }, [onClose]);

    // Handle backdrop click
    const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const rect = dialog.getBoundingClientRect();
        const isInDialog =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

        if (!isInDialog) {
            onClose();
        }
    };

    return (
        <dialog
            ref={dialogRef}
            onClick={handleDialogClick}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            }}
            aria-modal="true"
            aria-labelledby="modal-title"
            className={cn(
                'open:fade-in open:zoom-in-95 rounded-lg border border-border bg-card p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-in',
                className
            )}
        >
            <div className="flex max-h-[90vh] w-full min-w-[320px] max-w-2xl flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-border border-b px-6 py-4">
                    <h2
                        id="modal-title"
                        className="font-semibold text-foreground text-xl"
                    >
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        <CloseIcon
                            size="sm"
                            aria-hidden="true"
                        />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            </div>
        </dialog>
    );
}
