import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { ADMINISTRATION_LABEL_KEY, type getCuratedAccountNav } from '@/lib/nav-avatar';
import { buildUrl } from '@/lib/urls';
import styles from './UserMenu.module.css';
import type { useTouristMenuPlan } from './use-tourist-menu-plan';

/** Render subscription status and upgrade alongside the account quick links. */
export function UserMenuQuickLinks({
    items,
    locale,
    plan,
    t,
    onNavigate
}: {
    readonly items: ReturnType<typeof getCuratedAccountNav>['quickItems'];
    readonly locale: SupportedLocale;
    readonly plan: ReturnType<typeof useTouristMenuPlan>;
    readonly t: TranslationFn;
    readonly onNavigate: () => void;
}) {
    const subtitle = plan?.paid
        ? plan.until
            ? t('common.card.planUntil', undefined, {
                  plan: plan.name,
                  date: formatDate({
                      date: plan.until,
                      locale,
                      options: {
                          day: '2-digit',
                          month: '2-digit',
                          timeZone: 'America/Argentina/Buenos_Aires'
                      }
                  })
              })
            : plan.name
        : plan && t('common.card.currentPlan', undefined, { plan: plan.name });
    return (
        <ul className={styles.menuList}>
            {items.map((item) => (
                <li key={item.id}>
                    <a
                        href={buildUrl({ locale, path: item.href })}
                        role="menuitem"
                        onClick={onNavigate}
                        className={styles.menuLink}
                    >
                        <item.icon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                        <span>
                            {t(item.i18nKey)}
                            {item.id === 'subscription' && subtitle && (
                                <small className={styles.subscriptionSubtitle}>{subtitle}</small>
                            )}
                        </span>
                    </a>
                    {item.id === 'subscription' && plan?.upgrade && (
                        <a
                            href={buildUrl({ locale, path: '/planes/turistas/' })}
                            role="menuitem"
                            onClick={onNavigate}
                            className={styles.menuLink}
                        >
                            {t('common.card.upgradePlan', undefined, { plan: plan.upgrade })}
                        </a>
                    )}
                </li>
            ))}
        </ul>
    );
}

/** Render the contextual business shortcuts as one group in the desktop menu. */
export function UserMenuAdminLinks({
    items,
    headingId,
    locale,
    t,
    onNavigate
}: {
    readonly items: ReturnType<typeof getCuratedAccountNav>['adminItems'];
    readonly headingId: string;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    readonly onNavigate: () => void;
}) {
    if (!items.length) return null;
    return (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset is not allowed inside role=menu.
        <div
            role="group"
            className={styles.adminSection}
            aria-labelledby={headingId}
        >
            <p
                id={headingId}
                className={styles.sectionTitle}
            >
                {t(ADMINISTRATION_LABEL_KEY)}
            </p>
            <ul className={styles.menuList}>
                {items.map((item) => (
                    <li key={item.id}>
                        <a
                            href={buildUrl({ locale, path: item.href })}
                            role="menuitem"
                            onClick={onNavigate}
                            className={styles.menuLink}
                            data-admin-shortcut={item.id}
                        >
                            <item.icon
                                size={18}
                                weight="regular"
                                aria-hidden="true"
                            />
                            <span>{t(item.i18nKey)}</span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
