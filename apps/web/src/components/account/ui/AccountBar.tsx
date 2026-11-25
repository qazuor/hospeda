/**
 * AccountBar — the single mobile navigation of the account (HOS-2413 T-021,
 * D3 «nav mobile única»): a sticky 48px bar under the header that reads
 * «≡ Mi cuenta / <sección>» and opens a bottom Drawer holding the same groups
 * as the desktop sidebar (it renders `AccountSidebar` from the same view).
 *
 * - The button has `aria-expanded` and `aria-controls`.
 * - The Drawer traps focus, closes on Escape and returns focus to the button.
 * - `shadow-sticky` applies while the bar is stuck, detected by an
 *   `IntersectionObserver` on a sentinel inside this island (it replaces the
 *   legacy layout's script).
 * - The drawer holds real navigation links, so the bar OWNS the HOS-310
 *   history entry instead of letting the shared Dialog claim it (HOS-2541).
 *   A link click unwinds the entry first and navigates once the `popstate`
 *   settles; closing synchronously let the Dialog's `history.go(-1)` race the
 *   ClientRouter navigation and left the page loading forever. Same recipe as
 *   `MobileMenu.client.tsx`.
 * - It hydrates only below 64rem: `client:media="(max-width: 63.99rem)"`.
 *
 * @module components/account/ui/AccountBar
 */

import { HamburgerIcon } from '@repo/icons';
import { type MouseEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { BenefitUsagesCountPill } from '@/components/host/host-trades/BenefitUsagesCountPill.client';
import { ACCOUNT_NAV_ICONS } from '@/lib/account-nav-icons';
import { acquireDialogHistoryEntry } from '@/lib/dialog-history';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './AccountBar.module.css';
import { AccountSidebar } from './AccountSidebar';
import type { SidebarView } from './account-sidebar-view';
import { cx } from './cx';
import { Drawer } from './Drawer';

/** Props of {@link AccountBar}. */
export interface AccountBarProps {
    /** The sidebar view (the same one the desktop sidebar renders). */
    readonly view: SidebarView;
    /** Locale for the copy. */
    readonly locale: SupportedLocale;
    /**
     * Title of the current page. Names the page in the bar when no menu entry
     * does (a page with no sidebar item), so the trail never stops at
     * «Mi cuenta» (HOS-2610 F-36).
     */
    readonly pageTitle?: string;
}

/** Max wait for the history unwind's `popstate` before navigating anyway. */
const POPSTATE_TIMEOUT_MS = 160;

/**
 * Navigates through the Astro ClientRouter, falling back to a full load.
 *
 * @param href - Absolute URL to open.
 */
async function continueNavigation(href: string): Promise<void> {
    try {
        const { navigate } = await import('astro:transitions/client');
        await navigate(href);
    } catch {
        window.location.assign(href);
    }
}

/**
 * The mobile account bar and its drawer.
 *
 * @param props - See {@link AccountBarProps}.
 * @returns The sentinel, the bar and the drawer.
 */
export function AccountBar({ view, locale, pageTitle }: AccountBarProps) {
    const t = createT(locale);
    const [open, setOpen] = useState(false);
    const [stuck, setStuck] = useState(false);
    const sentinel = useRef<HTMLDivElement>(null);
    const historyReleaseRef = useRef<(() => void) | null>(null);
    const drawerId = useId();
    const menuLabel = t('account.menu');
    const accountLabel = t('account.title');

    useEffect(() => {
        const node = sentinel.current;
        if (!node || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            ([entry]) => setStuck(entry ? !entry.isIntersecting : false),
            { threshold: [1] }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    // The bar owns the drawer's history entry (see the module docblock).
    useEffect(() => {
        if (!open) return;
        const { release } = acquireDialogHistoryEntry({ onPopped: () => setOpen(false) });
        historyReleaseRef.current = release;
        return () => {
            if (historyReleaseRef.current === release) {
                historyReleaseRef.current = null;
                release();
            }
        };
    }, [open]);

    // A ClientRouter navigation started elsewhere also closes the drawer.
    useEffect(() => {
        const handleBeforeSwap = () => setOpen(false);
        document.addEventListener('astro:before-swap', handleBeforeSwap);
        return () => document.removeEventListener('astro:before-swap', handleBeforeSwap);
    }, []);

    const handleLinkClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        const anchor = (event.target as HTMLElement).closest('a');
        if (!anchor) return;
        const modified =
            event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
        if (
            modified ||
            event.defaultPrevented ||
            anchor.href.length === 0 ||
            anchor.target === '_blank' ||
            anchor.origin !== window.location.origin
        ) {
            // Let the browser (or whoever prevented it) handle the click.
            setOpen(false);
            return;
        }
        event.preventDefault();
        setOpen(false);
        const href = anchor.href;
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.removeEventListener('popstate', finish);
            window.clearTimeout(timeoutId);
            void continueNavigation(href);
        };
        window.addEventListener('popstate', finish, { once: true });
        const timeoutId = window.setTimeout(finish, POPSTATE_TIMEOUT_MS);
        const release = historyReleaseRef.current;
        historyReleaseRef.current = null;
        release?.();
    }, []);

    // The entry's label, else the page's own title. Never «Mi cuenta / Mi
    // cuenta»: a current label equal to the account label adds nothing.
    const currentLabel = view.activeLabel === menuLabel ? pageTitle : view.activeLabel;
    const showCurrent =
        currentLabel !== undefined && currentLabel !== '' && currentLabel !== accountLabel;

    return (
        <>
            <div
                ref={sentinel}
                className={styles.sentinel}
                aria-hidden="true"
            />
            <div
                className={cx(styles.bar, stuck && styles.stuck)}
                data-account-bar=""
                data-stuck={stuck ? 'true' : undefined}
            >
                <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={open}
                    aria-controls={open ? drawerId : undefined}
                    aria-haspopup="dialog"
                    onClick={() => setOpen(true)}
                >
                    <HamburgerIcon
                        size={20}
                        aria-hidden="true"
                    />
                    <span>{accountLabel}</span>
                    {showCurrent ? <span className={styles.current}>/ {currentLabel}</span> : null}
                </button>
            </div>
            <Drawer
                open={open}
                onOpenChange={setOpen}
                title={menuLabel}
                locale={locale}
                side="bottom"
                claimHistoryEntry={false}
            >
                {/* The drawer id is what the toggle controls. */}
                <div
                    id={drawerId}
                    className={styles.drawerBody}
                    onClickCapture={handleLinkClick}
                >
                    <AccountSidebar
                        view={view}
                        locale={locale}
                        icons={ACCOUNT_NAV_ICONS}
                        benefitUsagesCount={<BenefitUsagesCountPill locale={locale} />}
                    />
                </div>
            </Drawer>
        </>
    );
}
