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
 * - It hydrates only below 64rem: `client:media="(max-width: 63.99rem)"`.
 *
 * @module components/account/ui/AccountBar
 */

import { HamburgerIcon } from '@repo/icons';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BenefitUsagesCountPill } from '@/components/host/host-trades/BenefitUsagesCountPill.client';
import { WhatsNewCountPill } from '@/components/shared/whats-new/WhatsNewCountPill.client';
import { useAiAssistantsEntry } from '@/hooks/use-ai-assistants-entry';
import { ACCOUNT_NAV_ICONS } from '@/lib/account-nav-icons';
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
}

/**
 * The mobile account bar and its drawer.
 *
 * @param props - See {@link AccountBarProps}.
 * @returns The sentinel, the bar and the drawer.
 */
export function AccountBar({ view, locale }: AccountBarProps) {
    const t = createT(locale);
    const [open, setOpen] = useState(false);
    const [stuck, setStuck] = useState(false);
    const sentinel = useRef<HTMLDivElement>(null);
    const drawerId = useId();
    // The AI-assistants entry renders `hidden` when MCP is off; reveal the
    // drawer's own copy in React (the DOM-querying island only finds the first).
    const hasHiddenAi = view.groups.some((group) =>
        group.items.some((item) => item.id === 'aiAssistants' && item.hidden)
    );
    const aiVisible = useAiAssistantsEntry({ mcpEnabled: false, enabled: hasHiddenAi });
    const revealed = useMemo(() => new Set(aiVisible ? ['aiAssistants'] : []), [aiVisible]);
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

    const showCurrent = view.activeLabel !== menuLabel;

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
                    {showCurrent ? (
                        <span className={styles.current}>/ {view.activeLabel}</span>
                    ) : null}
                </button>
            </div>
            <Drawer
                open={open}
                onOpenChange={setOpen}
                title={menuLabel}
                locale={locale}
                side="bottom"
            >
                {/* The drawer id is what the toggle controls. */}
                <div
                    id={drawerId}
                    className={styles.drawerBody}
                    onClickCapture={(event) => {
                        if ((event.target as HTMLElement).closest('a')) setOpen(false);
                    }}
                >
                    <AccountSidebar
                        view={view}
                        locale={locale}
                        icons={ACCOUNT_NAV_ICONS}
                        revealedItemIds={revealed}
                        whatsNewCount={<WhatsNewCountPill locale={locale} />}
                        benefitUsagesCount={<BenefitUsagesCountPill locale={locale} />}
                    />
                </div>
            </Drawer>
        </>
    );
}
