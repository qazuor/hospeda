import { SparkleIcon } from '@repo/icons';
import { formatCalendarDate } from '@repo/utils';
import { useEffect, useMemo } from 'react';
import { AccountEmptyState } from '@/components/account/AccountEmptyState';
import type { WhatsNewItem } from '@/hooks/use-whats-new';
import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { renderMarkdownToHtml } from '@/lib/whats-new/render-markdown';

interface WhatsNewPageListProps {
    readonly locale: SupportedLocale;
}

export function WhatsNewPageList({ locale }: WhatsNewPageListProps) {
    const { t } = createTranslations(locale);
    const { items, isLoading, markSeen } = useWhatsNew();

    useEffect(() => {
        const unseenIds = items.filter((item) => !item.seen).map((item) => item.id);
        if (unseenIds.length > 0) {
            markSeen(unseenIds);
        }
    }, [items, markSeen]);

    if (isLoading) {
        return <p className="whats-new-page__empty">{t('common.loading', 'Cargando...')}</p>;
    }

    if (items.length === 0) {
        return (
            <AccountEmptyState
                title={t('account.whatsNewPanel.empty', 'No hay novedades aún')}
                description={t(
                    'account.whatsNewPanel.emptyDesc',
                    'Cuando publiquemos mejoras o nuevas funciones de la plataforma, vas a verlas acá.'
                )}
                icon={<SparkleIcon size={28} />}
            />
        );
    }

    return (
        <div>
            {items.map((item) => (
                <WhatsNewCard
                    key={item.id}
                    item={item}
                    locale={locale}
                />
            ))}
        </div>
    );
}

interface WhatsNewCardProps {
    readonly item: WhatsNewItem;
    readonly locale: SupportedLocale;
}

function WhatsNewCard({ item, locale }: WhatsNewCardProps) {
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
        <article className={`whats-new-card${item.seen ? 'whats-new-card--seen' : ''}`}>
            {item.image && (
                <img
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    className="whats-new-card__img"
                    loading="lazy"
                />
            )}

            <div className="whats-new-card__body">
                <div className="whats-new-card__meta">
                    {!item.seen && (
                        <span className="whats-new-card__badge">
                            {t('account.status.new', 'Nuevo')}
                        </span>
                    )}
                    <time
                        className="whats-new-card__date"
                        dateTime={item.publishedAt}
                    >
                        {publishedDate}
                    </time>
                </div>

                <h2 className="whats-new-card__title">{item.title}</h2>

                <div
                    className="whats-new-card__content"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized in renderMarkdownToHtml before rendering
                    dangerouslySetInnerHTML={{ __html: bodyHtml }} // nosemgrep:typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                />
            </div>
        </article>
    );
}
