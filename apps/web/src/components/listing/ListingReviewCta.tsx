import { StarIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import { useId } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ListingReviewCta.module.css';

/** Shared review invitation; eligibility and form submission belong to the caller. */
export function ListingReviewCta({
    locale,
    signInHref,
    onOpen,
    empty,
    children
}: {
    readonly locale: SupportedLocale;
    readonly signInHref: string;
    readonly onOpen?: () => void;
    readonly empty: boolean;
    readonly children?: ReactNode;
}) {
    const { t } = createTranslations(locale);
    const titleId = useId();
    const label = empty ? t('review.list.firstReview') : t('review.venueSidebar.cta');
    return (
        <aside
            className={styles.card}
            aria-labelledby={titleId}
        >
            <h3 id={titleId}>
                <StarIcon aria-hidden="true" /> {t('review.venueSidebar.title')}
            </h3>
            {children ??
                (onOpen ? (
                    <button
                        className={styles.action}
                        type="button"
                        onClick={onOpen}
                    >
                        {label}
                    </button>
                ) : (
                    <a
                        className={styles.action}
                        href={signInHref}
                    >
                        {empty ? label : t('review.venueSidebar.signInCta')}
                    </a>
                ))}
        </aside>
    );
}
