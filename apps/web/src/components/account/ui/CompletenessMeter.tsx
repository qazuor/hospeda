/**
 * CompletenessMeter — how close a listing is to publishable (HOS-2499, spec
 * HOS-2415 §6.1).
 *
 * A labelled, segmented progress bar of «n de N secciones completas» and, while anything
 * is missing, the list of incomplete sections, each a real link to its section
 * page. The number is always written: the bar is reinforcement, never the only
 * signal. It renders from Astro with NO `client:*`.
 *
 * The counts come from `lib/editor/editor-completeness` (the rules each editor
 * already applies); the caller resolves each missing section's label and href.
 *
 * @module components/account/ui/CompletenessMeter
 */

import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './CompletenessMeter.module.css';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** One incomplete section. */
export interface CompletenessItem {
    /** Stable id (the editor section id). */
    readonly id: string;
    /** Translated section name. */
    readonly label: string;
    /** Link to the section page; absent renders the name as text. */
    readonly href?: string;
}

/** Props of {@link CompletenessMeter}. */
export interface CompletenessMeterProps {
    /** Complete sections. */
    readonly done: number;
    /** Sections that hold a requirement. */
    readonly total: number;
    /** The incomplete sections, in order. */
    readonly missing: readonly CompletenessItem[];
    /** Locale for the copy. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit completeness meter.
 *
 * @param props - See {@link CompletenessMeterProps}.
 * @returns A `<section>` with the count, the bar and the missing list.
 */
export function CompletenessMeter({
    done,
    total,
    missing,
    locale,
    className,
    helpId
}: CompletenessMeterProps) {
    const t = createT(locale);
    // One segment per section: no inline width, so no `style=""` attribute is
    // needed (attributes are governed by `style-src-attr`).
    const filled = total <= 0 ? 1 : Math.min(Math.max(done, 0), total);
    const summary = t('account.ui.completeness.summary', undefined, { done, total });
    const complete = missing.length === 0;

    return (
        <section
            {...helpAttr({ helpId })}
            aria-label={t('account.ui.completeness.title')}
            className={cx(styles.root, className)}
            data-complete={complete ? 'true' : 'false'}
        >
            <div className={styles.head}>
                <p className={styles.title}>{t('account.ui.completeness.title')}</p>
                <p className={styles.summary}>{summary}</p>
            </div>
            <div
                className={styles.track}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={Math.min(Math.max(done, 0), total)}
                aria-valuetext={summary}
                aria-label={t('account.ui.completeness.title')}
            >
                {Array.from({ length: Math.max(total, 1) }, (_, index) => (
                    <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
                        key={index}
                        className={styles.segment}
                        data-filled={index < filled ? 'true' : 'false'}
                    />
                ))}
            </div>
            {complete ? (
                <p className={styles.note}>{t('account.ui.completeness.complete')}</p>
            ) : (
                <div className={styles.missing}>
                    <p className={styles.note}>{t('account.ui.completeness.missingTitle')}</p>
                    <ul className={styles.list}>
                        {missing.map((item) => (
                            <li key={item.id}>
                                {item.href ? (
                                    <a
                                        href={item.href}
                                        className={styles.link}
                                    >
                                        {item.label}
                                    </a>
                                ) : (
                                    <span className={styles.text}>{item.label}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
