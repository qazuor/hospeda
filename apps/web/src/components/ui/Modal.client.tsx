import { CloseIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

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

    /**
     * Locale for i18n translations
     * @default 'es'
     */
    readonly locale?: SupportedLocale;
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
export function Modal({
    title,
    children,
    open,
    onClose,
    className = '',
    locale = 'es'
}: ModalProps): JSX.Element {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const { t } = useTranslation({ locale, namespace: 'ui' });

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
            className={`rounded-lg border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-fade-in ${className}`.trim()}
        >
            <div className="flex max-h-[90vh] w-full min-w-[320px] max-w-2xl flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-border border-b px-6 py-4">
                    <h2
                        id="modal-title"
                        className="font-semibold text-text text-xl"
                    >
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('accessibility.closeModal')}
                        className="inline-flex items-center justify-center rounded-md p-2 text-text-secondary transition-colors hover:bg-surface-alt hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
