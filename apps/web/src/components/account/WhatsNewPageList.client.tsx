/**
 * @file WhatsNewPageList.client.tsx
 * @description The «Novedades de Hospeda» page body (HOS-2501, HOS-2416 §5.1):
 * a reading-width list of entries, one flat row each (image, date, «Nuevo»
 * pill, title, markdown body), with kit `Skeleton` while loading, kit
 * `ErrorState` with a retry, kit `EmptyState` and a kit `Pagination` (load
 * more) so the ~50 entries of the catalog do not render at once (HOS-2449).
 */

import { SparkleIcon } from '@repo/icons';
import { formatCalendarDate } from '@repo/utils';
import { useEffect, useMemo, useState } from 'react';
import type { WhatsNewItem } from '@/hooks/use-whats-new';
import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { renderMarkdownToHtml } from '@/lib/whats-new/render-markdown';
import { EmptyState, ErrorState, Pagination, Skeleton, StatusPill } from './ui';
import styles from './WhatsNewPageList.module.css';

/**
 * Entries shown before the reader asks for more (HOS-2449). The catalog grows
 * without bound, and rendering every entry made the page ~20.000px tall on
 * mobile.
 */
export const WHATS_NEW_PAGE_SIZE = 10;

interface WhatsNewPageListProps {
    readonly locale: SupportedLocale;
}

/**
 * The page body. A failed load can be retried: the retry remounts the body, which
 * makes the hook fetch again (a failure is never cached).
 *
 * @param props - See {@link WhatsNewPageListProps}.
 */
export function WhatsNewPageList({ locale }: WhatsNewPageListProps) {
    const [attempt, setAttempt] = useState(0);
    return (
        <WhatsNewPageBody
            key={attempt}
            locale={locale}
            onRetry={() => setAttempt((value) => value + 1)}
        />
    );
}

function WhatsNewPageBody({
    locale,
    onRetry
}: WhatsNewPageListProps & { readonly onRetry: () => void }) {
    const { t } = createTranslations(locale);
    const { items, isLoading, error, markSeen } = useWhatsNew();
    const [visibleCount, setVisibleCount] = useState(WHATS_NEW_PAGE_SIZE);
    const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

    // Only entries the reader can actually see are marked as seen: an entry
    // hidden behind "show more" keeps its "new" badge until it is revealed.
    useEffect(() => {
        const unseenIds = visibleItems.filter((item) => !item.seen).map((item) => item.id);
        if (unseenIds.length > 0) {
            markSeen(unseenIds);
        }
    }, [visibleItems, markSeen]);

    if (isLoading) {
        return (
            <div className={styles.skeletons}>
                <Skeleton.Row locale={locale} />
                <Skeleton.Row locale={locale} />
                <Skeleton.Row locale={locale} />
            </div>
        );
    }

    if (error) {
        return (
            <ErrorState
                locale={locale}
                onRetry={onRetry}
            />
        );
    }

    if (items.length === 0) {
        return (
            <EmptyState
                title={t('account.whatsNewPanel.empty')}
                description={t('account.whatsNewPanel.emptyDesc')}
                icon={<SparkleIcon size={28} />}
            />
        );
    }

    return (
        <div className={styles.page}>
            <ol className={styles.list}>
                {visibleItems.map((item) => (
                    <li
                        key={item.id}
                        className={styles.item}
                    >
                        <WhatsNewEntry
                            item={item}
                            locale={locale}
                        />
                    </li>
                ))}
            </ol>
            {items.length > visibleItems.length && (
                <div className={styles.more}>
                    <p className={styles.count}>
                        {t('account.whatsNewPanel.showingCount', undefined, {
                            shown: visibleItems.length,
                            total: items.length
                        })}
                    </p>
                    <Pagination
                        variant="loadMore"
                        locale={locale}
                        onLoadMore={async () => {
                            const added = Math.min(
                                WHATS_NEW_PAGE_SIZE,
                                items.length - visibleCount
                            );
                            setVisibleCount((count) => count + WHATS_NEW_PAGE_SIZE);
                            return { addedCount: added };
                        }}
                    />
                </div>
            )}
        </div>
    );
}

interface WhatsNewEntryProps {
    readonly item: WhatsNewItem;
    readonly locale: SupportedLocale;
}

function WhatsNewEntry({ item, locale }: WhatsNewEntryProps) {
    const { t } = createTranslations(locale);
    const bodyHtml = useMemo(() => renderMarkdownToHtml(item.body), [item.body]);

    // `publishedAt` names a DAY. The catalog's own authoring convention writes
    // entries as `'2026-05-29T00:00:00Z'`, so reading it in the viewer's own
    // timezone dates every entry one day early for anyone west of UTC — the
    // same defect the August 2026 smoke found on four other screens (H-09,
    // H-63, H-73, H-84). The catalog being empty today is the only reason
    // nobody has hit it yet; the first entry written to convention would.
    const publishedDate = useMemo(
        () =>
            formatCalendarDate({
                value: item.publishedAt,
                locale,
                options: { year: 'numeric', month: 'long', day: 'numeric' }
            }) ?? item.publishedAt,
        [item.publishedAt, locale]
    );

    return (
        <article
            className={styles.entry}
            data-seen={item.seen ? 'true' : undefined}
        >
            {item.image && (
                <img
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    className={styles.image}
                    loading="lazy"
                />
            )}

            <div className={styles.meta}>
                {!item.seen && <StatusPill tone="info">{t('account.status.new')}</StatusPill>}
                <time
                    className={styles.date}
                    dateTime={item.publishedAt}
                >
                    {publishedDate}
                </time>
            </div>

            <h2 className={styles.title}>{item.title}</h2>

            <div
                className={styles.content}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized in renderMarkdownToHtml before rendering
                dangerouslySetInnerHTML={{ __html: bodyHtml }} // nosemgrep:typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
            />
        </article>
    );
}
