/**
 * Menu — the overflow «more actions» menu button of the Mi Cuenta kit
 * (HOS-2483, spec HOS-2414 §6.2).
 *
 * WAI-ARIA menu button pattern: a labelled trigger (`aria-haspopup="menu"`,
 * `aria-expanded`, `aria-controls`) opens a `role="menu"` container of
 * `role="menuitem"` entries.
 *
 * - Trigger: click toggles; `Enter`, `Space` or `ArrowDown` open on the first
 *   item, `ArrowUp` on the last.
 * - Inside: `ArrowDown`/`ArrowUp` move (wrapping), `Home`/`End` jump, `Escape`
 *   closes and returns focus to the trigger, `Tab` closes. A click outside
 *   closes. Disabled items are skipped and cannot be activated.
 * - A `href` item is a real link (`external` opens a new tab, with the hidden
 *   translated «opens in a new tab» text). An `onSelect` item is a button: the
 *   menu closes, focus goes back to the trigger, then `onSelect` runs — so a
 *   confirmation dialog it opens returns focus to a live element.
 *
 * Put the actions that are NOT the primary one here (a ListingCard shows one
 * primary action and the rest in a Menu). Interactive: render it inside an
 * island.
 *
 * @module components/account/ui/Menu
 */

import { MoreHorizontalIcon } from '@repo/icons';
import {
    type KeyboardEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useId,
    useRef,
    useState
} from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buttonClassName } from './button-class';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Menu.module.css';
import linkStyles from './TextLink.module.css';

type MenuItemBase = {
    /** Stable id of the entry (React key, test hook). */
    readonly id: string;
    /** Visible, translated label. */
    readonly label: ReactNode;
    /** `danger` paints a destructive entry (delete, unpublish). @default 'default' */
    readonly tone?: 'default' | 'danger';
    /** Shown but not activatable, skipped by the arrow keys. */
    readonly disabled?: boolean;
};

/** A menu entry: a link (`href`) or an action (`onSelect`). */
export type MenuItem = MenuItemBase &
    (
        | {
              /** Destination of a link entry. */
              readonly href: string;
              /** Opens in a new tab (`rel="noopener noreferrer"`). */
              readonly external?: boolean;
              readonly onSelect?: undefined;
          }
        | {
              /** Runs after the menu closed and focus returned to the trigger. */
              readonly onSelect: () => void;
              readonly href?: undefined;
              readonly external?: undefined;
          }
    );

/** Props of {@link Menu}. */
export interface MenuProps {
    /**
     * REQUIRED translated accessible name of the trigger. Name the object, e.g.
     * «Más acciones para Casa del Río», so several menus on a page differ.
     */
    readonly label: string;
    /** The entries, in reading order. An empty list renders nothing. */
    readonly items: readonly MenuItem[];
    /** Locale for the fixed copy («opens in a new tab»). */
    readonly locale: SupportedLocale;
    /** Visible trigger text. Without it the trigger is the «⋯» icon button. */
    readonly triggerText?: ReactNode;
    /** Which edge of the trigger the list aligns to. @default 'end' */
    readonly align?: 'start' | 'end';
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/** Indexes of the entries the keyboard can land on. */
function enabledIndexes(items: readonly MenuItem[]): number[] {
    return items.flatMap((item, index) => (item.disabled ? [] : [index]));
}

/**
 * The kit overflow menu.
 *
 * @param props - See {@link MenuProps}.
 * @returns A trigger button plus its menu, or `null` with no items.
 */
export function Menu({
    label,
    items,
    locale,
    triggerText,
    align = 'end',
    className,
    helpId
}: MenuProps) {
    const t = createT(locale);
    const baseId = useId();
    const triggerId = `${baseId}-trigger`;
    const menuId = `${baseId}-menu`;
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<(HTMLElement | null)[]>([]);

    const close = useCallback(({ restoreFocus }: { readonly restoreFocus: boolean }) => {
        setOpen(false);
        setActive(-1);
        if (restoreFocus) triggerRef.current?.focus();
    }, []);

    const openAt = (position: 'first' | 'last') => {
        const enabled = enabledIndexes(items);
        setOpen(true);
        setActive((position === 'first' ? enabled[0] : enabled[enabled.length - 1]) ?? -1);
    };

    // Move DOM focus to the active entry once it is rendered.
    useEffect(() => {
        if (open && active >= 0) itemRefs.current[active]?.focus();
    }, [open, active]);

    // A click outside closes without stealing focus from where it went.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) close({ restoreFocus: false });
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open, close]);

    if (items.length === 0) return null;

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openAt('first');
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openAt('last');
        }
    };

    const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const enabled = enabledIndexes(items);
        const at = enabled.indexOf(active);
        const move = (next: number | undefined) => {
            event.preventDefault();
            if (next !== undefined) setActive(next);
        };
        switch (event.key) {
            case 'ArrowDown':
                return move(enabled[(at + 1) % enabled.length]);
            case 'ArrowUp':
                return move(enabled[(at - 1 + enabled.length) % enabled.length]);
            case 'Home':
                return move(enabled[0]);
            case 'End':
                return move(enabled[enabled.length - 1]);
            case 'Escape':
                event.preventDefault();
                return close({ restoreFocus: true });
            case 'Tab':
                return close({ restoreFocus: false });
            default:
                return undefined;
        }
    };

    const select = (item: MenuItem) => {
        if (item.disabled) return;
        close({ restoreFocus: true });
        item.onSelect?.();
    };

    return (
        <div
            {...helpAttr({ helpId })}
            ref={rootRef}
            className={cx(styles.root, className)}
        >
            <button
                ref={triggerRef}
                id={triggerId}
                type="button"
                className={buttonClassName({
                    variant: 'secondary',
                    size: 'md',
                    iconOnly: triggerText === undefined
                })}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={label}
                onClick={() => (open ? close({ restoreFocus: false }) : openAt('first'))}
                onKeyDown={onTriggerKeyDown}
            >
                {triggerText ?? (
                    <MoreHorizontalIcon
                        size="sm"
                        aria-hidden="true"
                    />
                )}
            </button>
            {open ? (
                <div
                    id={menuId}
                    role="menu"
                    tabIndex={-1}
                    aria-labelledby={triggerId}
                    className={cx(
                        styles.menu,
                        align === 'start' ? styles.alignStart : styles.alignEnd
                    )}
                    onKeyDown={onMenuKeyDown}
                >
                    {items.map((item, index) => {
                        const itemClass = cx(styles.item, item.tone === 'danger' && styles.danger);
                        const setRef = (element: HTMLElement | null) => {
                            itemRefs.current[index] = element;
                        };
                        return item.href !== undefined && !item.disabled ? (
                            <a
                                key={item.id}
                                ref={setRef}
                                role="menuitem"
                                tabIndex={-1}
                                href={item.href}
                                className={itemClass}
                                data-menu-item={item.id}
                                target={item.external ? '_blank' : undefined}
                                rel={item.external ? 'noopener noreferrer' : undefined}
                                onClick={() => close({ restoreFocus: false })}
                            >
                                {item.label}
                                {item.external ? (
                                    <span className={linkStyles.visuallyHidden}>
                                        {` ${t('account.ui.opensInNewTab')}`}
                                    </span>
                                ) : null}
                            </a>
                        ) : (
                            <button
                                key={item.id}
                                ref={setRef}
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                className={itemClass}
                                data-menu-item={item.id}
                                aria-disabled={item.disabled || undefined}
                                onClick={() => select(item)}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
