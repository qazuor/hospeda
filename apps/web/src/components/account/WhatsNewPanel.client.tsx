import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { renderMarkdownToHtml } from '@/lib/whats-new/render-markdown';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './WhatsNewModal.module.css';

interface WhatsNewPanelProps {
    readonly locale: SupportedLocale;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

type PanelView = 'list' | 'detail';

export function WhatsNewPanel({ locale, open, onOpenChange }: WhatsNewPanelProps) {
    const { t } = createTranslations(locale);
    const { items, unseenCount, markAllSeen } = useWhatsNew();
    const [view, setView] = useState<PanelView>('list');
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (open) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            panelRef.current?.focus();
        } else {
            setView('list');
            setSelectedEntryId(null);
            previousFocusRef.current?.focus();
        }
    }, [open]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && open) {
                onOpenChange(false);
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
    }, [open, onOpenChange]);

    const handleMarkAllRead = useCallback(() => {
        markAllSeen();
    }, [markAllSeen]);

    const handleRowClick = useCallback((entryId: string) => {
        setSelectedEntryId(entryId);
        setView('detail');
    }, []);

    const handleBack = useCallback(() => {
        setView('list');
        setSelectedEntryId(null);
    }, []);

    const handleClose = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    const selectedEntry = useMemo(() => {
        if (!selectedEntryId) return null;
        return items.find((item) => item.id === selectedEntryId) ?? null;
    }, [items, selectedEntryId]);

    if (!open) return null;

    return (
        <dialog
            className={styles.overlay}
            onClick={(e) => {
                if (e.target === e.currentTarget) onOpenChange(false);
            }}
            aria-label={
                view === 'detail'
                    ? (selectedEntry?.title ?? t('account.whatsNewPanel.title', 'Novedades'))
                    : t('account.whatsNewPanel.title', 'Novedades')
            }
            onKeyUp={(event) => {
                if (event.key === 'Escape') {
                    onOpenChange(false);
                }
            }}
        >
            <div
                className={styles.panel}
                ref={panelRef}
                tabIndex={-1}
            >
                {view === 'detail' && selectedEntry ? (
                    <DetailView
                        entry={selectedEntry}
                        locale={locale}
                        onBack={handleBack}
                        onClose={handleClose}
                    />
                ) : (
                    <ListView
                        locale={locale}
                        items={items}
                        unseenCount={unseenCount}
                        onRowClick={handleRowClick}
                        onMarkAllRead={handleMarkAllRead}
                        onClose={handleClose}
                    />
                )}
            </div>
        </dialog>
    );
}

interface ListViewProps {
    readonly locale: SupportedLocale;
    readonly items: readonly import('@/hooks/use-whats-new').WhatsNewItem[];
    readonly unseenCount: number;
    readonly onRowClick: (entryId: string) => void;
    readonly onMarkAllRead: () => void;
    readonly onClose: () => void;
}

function ListView({
    locale,
    items,
    unseenCount,
    onRowClick,
    onMarkAllRead,
    onClose
}: ListViewProps) {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>
                    {t('account.whatsNewPanel.title', 'Novedades')}
                </h2>
                <div className={styles.panelHeaderActions}>
                    <button
                        type="button"
                        className={styles.textButton}
                        disabled={unseenCount === 0}
                        onClick={onMarkAllRead}
                    >
                        {t('account.whatsNewPanel.markAllRead', 'Marcar todo como leido')}
                    </button>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label={t('common.close', 'Cerrar')}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className={styles.panelBody}>
                {items.length === 0 ? (
                    <p className={styles.emptyState}>
                        {t('account.whatsNewPanel.empty', 'No hay novedades aun')}
                    </p>
                ) : (
                    <ul className={styles.entryList}>
                        {items.map((item) => (
                            <PanelRow
                                key={item.id}
                                item={item}
                                locale={locale}
                                onRowClick={onRowClick}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

interface PanelRowProps {
    readonly item: import('@/hooks/use-whats-new').WhatsNewItem;
    readonly locale: SupportedLocale;
    readonly onRowClick: (entryId: string) => void;
}

function PanelRow({ item, locale, onRowClick }: PanelRowProps) {
    const { t } = createTranslations(locale);

    const publishedDate = useMemo(() => {
        try {
            return new Date(item.publishedAt).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return '';
        }
    }, [item.publishedAt, locale]);

    return (
        <li>
            <button
                type="button"
                className={`${styles.panelRow} ${item.seen ? styles.panelRowSeen : ''}`}
                onClick={() => onRowClick(item.id)}
            >
                <span
                    className={item.seen ? styles.dotSeen : styles.dotUnseen}
                    aria-hidden="true"
                />
                <div className={styles.panelRowContent}>
                    <p
                        className={
                            item.seen ? styles.panelRowTitleSeen : styles.panelRowTitleUnseen
                        }
                    >
                        {item.title}
                    </p>
                    <p className={styles.panelRowDate}>{publishedDate}</p>
                </div>
                {!item.seen && (
                    <span className={styles.newBadge}>{t('account.status.new', 'Nuevo')}</span>
                )}
            </button>
        </li>
    );
}

interface DetailViewProps {
    readonly entry: import('@/hooks/use-whats-new').WhatsNewItem;
    readonly locale: SupportedLocale;
    readonly onBack: () => void;
    readonly onClose: () => void;
}

function DetailView({ entry, locale, onBack, onClose }: DetailViewProps) {
    const { t } = createTranslations(locale);
    const { markSeen } = useWhatsNew();

    const bodyHtml = useMemo(() => renderMarkdownToHtml(entry.body), [entry.body]);

    useEffect(() => {
        if (!entry.seen) {
            markSeen([entry.id]);
        }
    }, [entry.id, entry.seen, markSeen]);

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <button
                    type="button"
                    className={styles.backButton}
                    onClick={onBack}
                    aria-label={t('common.back', 'Volver')}
                >
                    ←
                </button>
                <h2 className={styles.panelTitle}>{entry.title}</h2>
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label={t('common.close', 'Cerrar')}
                >
                    ✕
                </button>
            </div>

            <div className={styles.panelBody}>
                {entry.image && (
                    <img
                        src={entry.image}
                        alt=""
                        aria-hidden="true"
                        className={styles.entryImage}
                        loading="lazy"
                    />
                )}

                <div
                    className={styles.entryBody}
                    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized in renderMarkdownToHtml before rendering
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
            </div>
        </div>
    );
}
