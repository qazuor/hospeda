/**
 * AccountFooter — the account chrome's footer (HOS-2413 T-018, resized by
 * HOS-2550): the owner's «punto intermedio» between the one-line footer and
 * the 662px marketing footer.
 *
 * Two rows: the small logo with three link groups (Explorar, Para vos, Ayuda),
 * then the legal links and the copyright. Below 48rem the groups stack.
 * Rendered on the server by `BaseLayout chrome="account"`; no hydration.
 *
 * @module components/account/ui/AccountFooter
 */

import { BrandWordmark } from '@/components/shared/brand/BrandWordmark';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './AccountFooter.module.css';
import { buildAccountFooterModel } from './account-chrome';

/** Props of {@link AccountFooter}. */
export interface AccountFooterProps {
    /** Locale for the copy and the link paths. */
    readonly locale: SupportedLocale;
    /** Year shown in the copyright (passed in so the layout owns the clock). */
    readonly year: number;
    /** Resolved URL of the small logo (from `astro:assets`); omitted, only the name shows. */
    readonly logoSrc?: string;
}

/**
 * The account footer.
 *
 * @param props - See {@link AccountFooterProps}.
 * @returns A `<footer>` with the link groups, the legal links and the copyright.
 */
export function AccountFooter({ locale, year, logoSrc }: AccountFooterProps) {
    const t = createT(locale);
    const { groups, legal } = buildAccountFooterModel({ locale, t });

    return (
        <footer
            className={styles.footer}
            data-account-footer=""
        >
            <div className={styles.inner}>
                <div className={styles.top}>
                    <a
                        className={styles.logo}
                        href={buildUrl({ locale, path: '/' })}
                        aria-label={t('nav.goHome')}
                    >
                        <BrandWordmark
                            logoSrc={logoSrc ?? ''}
                            size="sm"
                        />
                    </a>
                    <nav
                        className={styles.groups}
                        aria-label={t('account.ui.chrome.footerNav')}
                    >
                        {groups.map((group) => (
                            <div
                                key={group.id}
                                className={styles.group}
                                data-footer-group={group.id}
                            >
                                <h2 className={styles.groupTitle}>{group.title}</h2>
                                <ul className={styles.list}>
                                    {group.links.map((link) => (
                                        <li key={link.id}>
                                            <a
                                                className={styles.link}
                                                href={link.href}
                                            >
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </div>
                <div className={styles.bottom}>
                    <ul
                        className={styles.legal}
                        aria-label={t('account.ui.chrome.legalNav')}
                    >
                        {legal.map((link) => (
                            <li key={link.id}>
                                <a
                                    className={styles.legalLink}
                                    href={link.href}
                                >
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <p className={styles.copyright}>
                        &copy; {year} Hospeda. {t('footer.bottom.rights')}.
                    </p>
                </div>
            </div>
        </footer>
    );
}
