import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import { createTranslations, DEFAULT_LOCALE, isValidLocale } from '@/lib/i18n';
import styles from './show-confirmation-dialog.module.css';

const TITLE_ID = 'confirmation-dialog-title';

type ConfirmationDialogOptions = {
    readonly message: string;
};

function resolveDocumentLocale(): 'es' | 'en' | 'pt' {
    if (typeof document === 'undefined') return DEFAULT_LOCALE;

    const [candidate] = document.documentElement.lang.trim().toLowerCase().split('-');
    return candidate && isValidLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

/**
 * Shows a product-styled confirmation dialog and resolves with the user's choice.
 */
export function showConfirmationDialog({ message }: ConfirmationDialogOptions): Promise<boolean> {
    if (typeof document === 'undefined') {
        return Promise.resolve(false);
    }

    const locale = resolveDocumentLocale();
    const { t } = createTranslations(locale);
    const title = t('admin-entities.confirmations.unsavedChanges.title', 'Cambios sin guardar');
    const confirmLabel = t('admin-entities.confirmations.unsavedChanges.confirm', 'Sí, descartar');
    const cancelLabel = t('admin-entities.confirmations.unsavedChanges.cancel', 'Seguir editando');

    return new Promise<boolean>((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let settled = false;

        async function mountDialog(): Promise<void> {
            const { createRoot } = await import('react-dom/client');
            const root = createRoot(container);

            function finish(result: boolean): void {
                if (settled) return;
                settled = true;
                root.unmount();
                container.remove();
                resolve(result);
            }

            root.render(
                <Dialog
                    isOpen={true}
                    onClose={() => finish(false)}
                    ariaLabelledBy={TITLE_ID}
                    size="sm"
                >
                    <DialogHeader titleId={TITLE_ID}>{title}</DialogHeader>
                    <DialogBody>
                        <p className={styles.body}>{message}</p>
                    </DialogBody>
                    <DialogFooter>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={() => finish(false)}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            className={styles.confirmButton}
                            onClick={() => finish(true)}
                        >
                            {confirmLabel}
                        </button>
                    </DialogFooter>
                </Dialog>
            );
        }

        void mountDialog();
    });
}
