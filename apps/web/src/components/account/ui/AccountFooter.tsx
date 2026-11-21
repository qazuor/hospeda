/**
 * AccountFooter — the one-line footer of the account chrome (HOS-2413 T-018,
 * D1 «marco compacto»): the legal links and the copyright. Rendered on the
 * server by `BaseLayout chrome="account"`; no hydration.
 *
 * @module components/account/ui/AccountFooter
 */

import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './AccountFooter.module.css';

/** Props of {@link AccountFooter}. */
export interface AccountFooterProps {
    /** Locale for the copy and the link paths. */
    readonly locale: SupportedLocale;
    /** Year shown in the copyright (passed in so the layout owns the clock). */
    readonly year: number;
}

/**
 * The compact account footer.
 *
 * @param props - See {@link AccountFooterProps}.
 * @returns A `<footer>` with the legal links and the copyright.
 */
export function AccountFooter({ locale, year }: AccountFooterProps) {
    const t = createT(locale);
    const links = [
        { label: t('footer.terms'), path: '/legal/terminos/' },
        { label: t('footer.privacy'), path: '/legal/privacidad/' },
        { label: t('footer.cookies'), path: '/legal/cookies/' }
    ] as const;

    return (
        <footer
            className={styles.footer}
            data-account-footer=""
        >
            <ul className={styles.links}>
                {links.map((link) => (
                    <li key={link.path}>
                        <a
                            className={styles.link}
                            href={buildUrl({ locale, path: link.path })}
                        >
                            {link.label}
                        </a>
                    </li>
                ))}
            </ul>
            <p className={styles.copyright}>
                &copy; {year} Hospeda. {t('footer.bottom.rights')}.
            </p>
        </footer>
    );
}
