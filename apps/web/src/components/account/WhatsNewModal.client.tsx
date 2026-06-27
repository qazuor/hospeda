import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { renderMarkdownToHtml } from '@/lib/whats-new/render-markdown';
import { useCallback, useEffect, useMemo } from 'react';
import styles from './WhatsNewModal.module.css';

interface WhatsNewModalProps {
    readonly locale: SupportedLocale;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

export function WhatsNewModal({ locale, open, onOpenChange }: WhatsNewModalProps) {
    const { t } = createTranslations(locale);
    const { items, markSeen } = useWhatsNew();

    const displayedEntries = useMemo(
        () => items.filter((item) => item.highlight && !item.seen),
        [items]
    );

    const displayedIds = useMemo(() => displayedEntries.map((item) => item.id), [displayedEntries]);

    const handleClose = useCallback(() => {
        if (displayedIds.length > 0) {
            markSeen(displayedIds);
        }
        onOpenChange(false);
    }, [displayedIds, markSeen, onOpenChange]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape' && open) {
                handleClose();
            }
        }

        if (open) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, handleClose]);

    if (!open) return null;

    return (
        <dialog
            className={styles.overlay}
            aria-label={t('account.whatsNewModal.title', 'Novedades')}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    handleClose();
                }
            }}
            onKeyUp={(event) => {
                if (event.key === 'Escape') {
                    handleClose();
                }
            }}
        >
            <div className={styles.modalCard}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        {t('account.whatsNewModal.title', 'Novedades')}
                    </h2>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={handleClose}
                        aria-label={t('common.close', 'Cerrar')}
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {displayedEntries.length === 0 ? (
                        <p className={styles.emptyState}>
                            {t('account.whatsNewModal.noUnread', 'No hay novedades sin leer')}
                        </p>
                    ) : (
                        <ul className={styles.modalEntryList}>
                            {displayedEntries.map((entry) => {
                                const bodyHtml = renderMarkdownToHtml(entry.body);

                                return (
                                    <li
                                        key={entry.id}
                                        className={styles.modalEntryItem}
                                    >
                                        {entry.image && (
                                            <img
                                                src={entry.image}
                                                alt=""
                                                aria-hidden="true"
                                                className={styles.entryImage}
                                                loading="lazy"
                                            />
                                        )}

                                        <h3 className={styles.modalEntryTitle}>{entry.title}</h3>

                                        <div
                                            className={styles.entryBody}
                                            // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized in renderMarkdownToHtml before rendering
                                            dangerouslySetInnerHTML={{ __html: bodyHtml }}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleClose}
                    >
                        {t('account.whatsNewModal.close', 'Cerrar')}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
