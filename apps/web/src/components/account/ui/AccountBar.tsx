/** Minimal account breadcrumb. Account navigation belongs to the header avatar. */
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './AccountBar.module.css';
import type { SidebarView } from './account-sidebar-view';

/** Props for the non-interactive account trail. */
export interface AccountBarProps {
    readonly view: SidebarView;
    readonly locale: SupportedLocale;
    readonly pageTitle?: string;
}

/** Renders the account root once, followed by the current page as plain text. */
export function AccountBar({ view, locale, pageTitle }: AccountBarProps) {
    const t = createT(locale);
    const accountLabel = t('account.title');
    const current = view.activeLabel === t('account.menu') ? pageTitle : view.activeLabel;
    return (
        <div
            className={styles.bar}
            data-account-bar=""
        >
            <a
                href={buildUrl({ locale, path: 'mi-cuenta' })}
                className={styles.link}
            >
                {accountLabel}
            </a>
            {current && current !== accountLabel ? (
                <span className={styles.current}> / {current}</span>
            ) : null}
        </div>
    );
}
