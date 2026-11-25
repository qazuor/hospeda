/** Visible zone doors above the desktop sidebar, using the kit's text-link recipe. */
import { ArrowLeftIcon, ArrowRightIcon } from '@repo/icons';
import type { AccountZoneLink } from '@/lib/account-nav-shell';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './AccountZoneSwitch.module.css';
import { TextLink } from './ui/TextLink';

/** Renders every eligible vertical, or the single return to the personal zone. */
export function AccountZoneSwitch({
    links,
    locale
}: {
    readonly links: readonly AccountZoneLink[];
    readonly locale: SupportedLocale;
}) {
    const t = createT(locale);
    return (
        <div className={styles.links}>
            {links.map((link) => (
                <TextLink
                    key={link.id}
                    href={buildUrl({ locale, path: link.href })}
                    className={styles.link}
                >
                    {link.direction === 'back' ? (
                        <ArrowLeftIcon
                            size={16}
                            aria-hidden="true"
                        />
                    ) : null}
                    {t(link.i18nKey)}
                    {link.direction === 'forward' ? (
                        <ArrowRightIcon
                            size={16}
                            aria-hidden="true"
                        />
                    ) : null}
                </TextLink>
            ))}
        </div>
    );
}
