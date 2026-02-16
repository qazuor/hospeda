import type { JSX } from 'react';
import { useEffect, useRef } from 'react';

/**
 * Props for the Modal component
 */
export interface ModalProps {
    /**
     * Title displayed in the modal header
     */
    readonly title: string;

    /**
     * Content to display inside the modal
     */
    readonly children: React.ReactNode;

    /**
     * Controls whether the modal is open
     */
    readonly open: boolean;

    /**
     * Callback fired when the modal should close
     */
    readonly onClose: () => void;

    /**
     * Additional CSS classes to apply to the modal
     */
    readonly className?: string;
}

/**
 * Modal component
 *
 * An accessible modal dialog component using native `<dialog>` element.
 * Provides focus trapping, backdrop dismiss, and keyboard support.
 *
 * Features:
 * - Native focus trap (dialog element handles this automatically)
 * - Close on Escape key (native dialog behavior + onClose callback)
 * - Close on backdrop click
 * - Smooth open/close transitions
 * - Full ARIA compliance (aria-modal, role, aria-labelledby)
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <Modal
 *   title="Confirm Action"
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   className="custom-modal"
 * >
 *   <p>Are you sure you want to continue?</p>
 *   <button onClick={handleConfirm}>Confirm</button>
 * </Modal>
 * ```
 */
export function Modal({ title, children, open, onClose, className = '' }: ModalProps): JSX.Element {
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

        // Check if click is on the dialog backdrop (outside the dialog content)
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
            className={`rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-fade-in ${className}`.trim()}
        >
            <div className="flex max-h-[90vh] w-full min-w-[320px] max-w-2xl flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-gray-200 border-b px-6 py-4">
                    <h2
                        id="modal-title"
                        className="font-semibold text-gray-900 text-xl"
                    >
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                        className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                            aria-hidden="true"
                        >
                            <path d="M18 6L6 18" />
                            <path d="M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            </div>
        </dialog>
    );
}
