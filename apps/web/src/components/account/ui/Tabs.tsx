/**
 * Tabs and NavTabs — same-page tabs and URL tabs (HOS-2413 T-015).
 *
 * `Tabs` follows the WAI-ARIA tabs pattern: `tablist`/`tab`/`tabpanel`,
 * `aria-selected`, `aria-controls`, a roving `tabIndex` and Left/Right/Home/End
 * (selection follows focus). `NavTabs` are plain links with
 * `aria-current="page"`, for tabs that are pages.
 *
 * Variants `underline` and `segmented`. A CountPill is optional per item. The
 * bar scrolls horizontally inside its own container, so the page never
 * overflows; each tab is 44px tall.
 *
 * @module components/account/ui/Tabs
 */

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { CountPill } from './StatusPill';
import styles from './Tabs.module.css';

/** Visual variant of the tab bar. */
export type TabsVariant = 'underline' | 'segmented';

/** Optional count shown in a tab. */
interface TabCount {
    /** The count. */
    readonly count: number;
    /** REQUIRED translated accessible name of the count (with the full number). */
    readonly countLabel: string;
}

/** One item of {@link Tabs}. */
export interface TabItem extends Partial<TabCount> {
    /** Unique id of the tab. */
    readonly id: string;
    /** Visible label. */
    readonly label: ReactNode;
    /** The panel shown while the tab is selected. */
    readonly panel: ReactNode;
}

/** Props of {@link Tabs}. */
export interface TabsProps {
    /** The tabs. */
    readonly items: readonly TabItem[];
    /** Translated accessible name of the tab list. */
    readonly ariaLabel: string;
    /** Controlled selected id. */
    readonly value?: string;
    /** Initial selected id when uncontrolled. Defaults to the first tab. */
    readonly defaultValue?: string;
    /** Called when the selection changes. */
    readonly onValueChange?: (id: string) => void;
    /** @default 'underline' */
    readonly variant?: TabsVariant;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Same-page tabs.
 *
 * @param props - See {@link TabsProps}.
 * @returns A tab list and the selected panel.
 */
export function Tabs({
    items,
    ariaLabel,
    value,
    defaultValue,
    onValueChange,
    variant = 'underline',
    className,
    helpId
}: TabsProps) {
    const base = useId();
    const [inner, setInner] = useState(defaultValue ?? items[0]?.id);
    const selected = value ?? inner;
    const refs = useRef(new Map<string, HTMLButtonElement>());

    const select = (id: string, focus: boolean) => {
        setInner(id);
        onValueChange?.(id);
        if (focus) refs.current.get(id)?.focus();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = items.length - 1;
        const target =
            event.key === 'ArrowRight'
                ? index === last
                    ? 0
                    : index + 1
                : event.key === 'ArrowLeft'
                  ? index === 0
                      ? last
                      : index - 1
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? last
                      : undefined;
        if (target === undefined) return;
        event.preventDefault();
        const next = items[target];
        if (next) select(next.id, true);
    };

    return (
        <div
            {...helpAttr({ helpId })}
            className={className}
        >
            <div
                role="tablist"
                aria-label={ariaLabel}
                className={cx(styles.bar, variant === 'segmented' && styles.segmented)}
            >
                {items.map((item, index) => (
                    <button
                        key={item.id}
                        ref={(node) => {
                            if (node) refs.current.set(item.id, node);
                            else refs.current.delete(item.id);
                        }}
                        type="button"
                        role="tab"
                        id={`${base}-tab-${item.id}`}
                        aria-selected={item.id === selected}
                        aria-controls={`${base}-panel-${item.id}`}
                        tabIndex={item.id === selected ? 0 : -1}
                        className={styles.tab}
                        onClick={() => select(item.id, false)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                    >
                        {item.label}
                        {item.count !== undefined && item.countLabel !== undefined ? (
                            <CountPill
                                count={item.count}
                                label={item.countLabel}
                            />
                        ) : null}
                    </button>
                ))}
            </div>
            {items.map((item) => (
                <div
                    key={item.id}
                    role="tabpanel"
                    id={`${base}-panel-${item.id}`}
                    aria-labelledby={`${base}-tab-${item.id}`}
                    hidden={item.id !== selected}
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabs pattern: a tabpanel is focusable so keyboard users reach panels with no focusable content
                    tabIndex={0}
                    className={styles.panel}
                >
                    {item.id === selected ? item.panel : null}
                </div>
            ))}
        </div>
    );
}

/** One item of {@link NavTabs}. */
export interface NavTabItem extends Partial<TabCount> {
    /** Destination. */
    readonly href: string;
    /** Visible label. */
    readonly label: ReactNode;
    /** True for the tab of the current page. */
    readonly current?: boolean;
}

/** Props of {@link NavTabs}. */
export interface NavTabsProps {
    /** The tab links. */
    readonly items: readonly NavTabItem[];
    /** Translated accessible name of the navigation. */
    readonly ariaLabel: string;
    /** @default 'underline' */
    readonly variant?: TabsVariant;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Tabs that are links to other pages.
 *
 * @param props - See {@link NavTabsProps}.
 * @returns A `<nav>` of links.
 */
export function NavTabs({
    items,
    ariaLabel,
    variant = 'underline',
    className,
    helpId
}: NavTabsProps) {
    return (
        <nav
            aria-label={ariaLabel}
            {...helpAttr({ helpId })}
            className={cx(styles.bar, variant === 'segmented' && styles.segmented, className)}
        >
            {items.map((item) => (
                <a
                    key={item.href}
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className={styles.tab}
                >
                    {item.label}
                    {item.count !== undefined && item.countLabel !== undefined ? (
                        <CountPill
                            count={item.count}
                            label={item.countLabel}
                        />
                    ) : null}
                </a>
            ))}
        </nav>
    );
}
