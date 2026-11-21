/**
 * AccountSidebar — the account navigation as a kit piece (HOS-2413 T-019).
 *
 * Rendered on the server from a {@link SidebarView}; it needs no hydration.
 * `<nav aria-label>`, each group a `<details>/<summary>` (the group holding
 * the current page renders open), the current item `aria-current="page"` with
 * the `nav-active-*` tokens. A LOCKED item shows a lock with alternative text
 * and stays a link (D9 «sin acceso único»): the page it opens explains the lock.
 * Labels come from the nav config, so «Mis locales» and «Mis experiencias» stay
 * separate (D20) and «Complementos» appears as its own item (D15) whenever the
 * config declares it.
 *
 * Count pills are the EXISTING islands, passed as named slots from the Astro
 * shell (`whatsNewCount`, `benefitUsagesCount`, `aiAssistantsReveal`).
 *
 * @module components/account/ui/AccountSidebar
 */

import type { IconProps } from '@repo/icons';
import { LockIcon } from '@repo/icons';
import type { ComponentType, ReactNode } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './AccountSidebar.module.css';
import type { SidebarItemView, SidebarView } from './account-sidebar-view';
import { cx } from './cx';

/** Props of {@link AccountSidebar}. */
export interface AccountSidebarProps {
    /** The view to render. */
    readonly view: SidebarView;
    /** Locale for the fixed copy. */
    readonly locale: SupportedLocale;
    /** Item ids that are locked for this account (still rendered as links). */
    readonly lockedItemIds?: ReadonlySet<string>;
    /** Icon per item id (the server passes component references; optional). */
    readonly icons?: Readonly<Record<string, ComponentType<IconProps>>>;
    /** Slot after the «Novedades» label (an existing count-pill island). */
    readonly whatsNewCount?: ReactNode;
    /** Slot after the «Usos de beneficio» label. */
    readonly benefitUsagesCount?: ReactNode;
    /** Slot after the AI-assistants label (the reveal island). */
    readonly aiAssistantsReveal?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
}

/** One link row. */
function SidebarLink({
    item,
    locked,
    Icon,
    after,
    lockedLabel,
    door
}: {
    readonly item: SidebarItemView;
    readonly locked: boolean;
    readonly Icon?: ComponentType<IconProps>;
    readonly after?: ReactNode;
    readonly lockedLabel: string;
    readonly door?: boolean;
}) {
    return (
        <li
            hidden={item.hidden || undefined}
            data-ai-assistants-entry={item.hidden ? '' : undefined}
            data-door={door ? '' : undefined}
        >
            <a
                href={item.href}
                className={styles.link}
                aria-current={item.active ? 'page' : undefined}
                data-tour={item.tourTarget}
            >
                {Icon ? (
                    <span
                        className={styles.icon}
                        aria-hidden="true"
                    >
                        <Icon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                    </span>
                ) : null}
                <span className={styles.label}>
                    {item.label}
                    {after}
                </span>
                {locked ? (
                    <>
                        <LockIcon
                            size={16}
                            className={styles.lock}
                            aria-hidden="true"
                        />
                        <span className={styles.visuallyHidden}>{lockedLabel}</span>
                    </>
                ) : null}
            </a>
        </li>
    );
}

/**
 * The kit account sidebar.
 *
 * @param props - See {@link AccountSidebarProps}.
 * @returns A `<nav>` with the groups and the discovery doors.
 */
export function AccountSidebar({
    view,
    locale,
    lockedItemIds,
    icons,
    whatsNewCount,
    benefitUsagesCount,
    aiAssistantsReveal,
    className
}: AccountSidebarProps) {
    const t = createT(locale);
    const lockedLabel = t('account.ui.sidebar.lockedLabel');
    const afterFor = (id: string): ReactNode =>
        id === 'whatsNew'
            ? whatsNewCount
            : id === 'benefitUsages'
              ? benefitUsagesCount
              : id === 'aiAssistants'
                ? aiAssistantsReveal
                : undefined;

    return (
        <nav
            aria-label={t('account.ui.sidebar.label')}
            className={cx(styles.nav, className)}
            data-account-sidebar=""
        >
            {view.groups.map((group) => {
                const list = (
                    <ul className={styles.list}>
                        {group.items.map((item) => (
                            <SidebarLink
                                key={item.id}
                                item={item}
                                locked={lockedItemIds?.has(item.id) ?? false}
                                Icon={icons?.[item.id]}
                                after={afterFor(item.id)}
                                lockedLabel={lockedLabel}
                            />
                        ))}
                    </ul>
                );
                if (group.suppressHeader) {
                    return (
                        <div
                            key={group.id}
                            className={styles.group}
                        >
                            {list}
                        </div>
                    );
                }
                return (
                    <details
                        key={group.id}
                        className={styles.group}
                        open={group.open}
                        data-nav-group={group.id}
                        data-contains-active={group.containsActive ? 'true' : undefined}
                    >
                        <summary className={styles.summary}>
                            <span>{group.label}</span>
                            <span
                                className={styles.chevron}
                                aria-hidden="true"
                            >
                                ▾
                            </span>
                        </summary>
                        {list}
                    </details>
                );
            })}
            {view.doors.length > 0 ? (
                <div className={styles.doors}>
                    <p className={styles.doorsLabel}>{view.doorsLabel}</p>
                    <ul className={styles.list}>
                        {view.doors.map((door) => (
                            <SidebarLink
                                key={door.id}
                                item={door}
                                locked={false}
                                Icon={icons?.[door.id]}
                                lockedLabel={lockedLabel}
                                door
                            />
                        ))}
                    </ul>
                </div>
            ) : null}
        </nav>
    );
}
