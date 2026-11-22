/**
 * Drawer — a bottom sheet for mobile and a side panel for desktop
 * (HOS-2413 T-012).
 *
 * Built on the shared Dialog, so it has the same focus trap, scroll lock,
 * Escape, focus return and HOS-310 back-button behaviour as the kit Dialog.
 * `side: 'bottom'` shows a grab handle and caps at 82% of the viewport;
 * `side: 'right'` is 360px wide. There is ALWAYS a close button with a
 * translated label: the handle is decoration, never the only way out.
 *
 * @module components/account/ui/Drawer
 */

import { CloseIcon } from '@repo/icons';
import { type ReactNode, useId } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Dialog as SharedDialog } from '../../shared/ui/Dialog.client';
import { Button } from './Button';
import { cx } from './cx';
import styles from './Drawer.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Edge the drawer is anchored to. */
export type DrawerSide = 'bottom' | 'right';

/** Props of {@link Drawer}. */
export interface DrawerProps {
    /** Controlled open state. */
    readonly open: boolean;
    /** Called with `false` on Escape, scrim click, close button or the back button. */
    readonly onOpenChange: (open: boolean) => void;
    /** Visible title: the drawer's accessible name. */
    readonly title: ReactNode;
    /** Locale for the close button label. */
    readonly locale: SupportedLocale;
    /** Anchored edge. @default 'bottom' */
    readonly side?: DrawerSide;
    /** Footer actions, aligned right. */
    readonly footer?: ReactNode;
    /** Optional help anchor rendered as `data-help` on the header. */
    readonly helpId?: HelpAnchor;
    /**
     * Whether the shared Dialog claims a history entry (HOS-310) so the back
     * button closes the drawer. Pass `false` when the caller owns the entry
     * itself, e.g. because the drawer holds navigation links and must unwind
     * the entry BEFORE navigating (HOS-2541). @default true
     */
    readonly claimHistoryEntry?: boolean;
    /** Drawer body. */
    readonly children?: ReactNode;
}

/**
 * The kit drawer.
 *
 * @param props - See {@link DrawerProps}.
 * @returns The shared Dialog anchored to an edge.
 */
export function Drawer({
    open,
    onOpenChange,
    title,
    locale,
    side = 'bottom',
    footer,
    helpId,
    claimHistoryEntry = true,
    children
}: DrawerProps) {
    const titleId = useId();
    const t = createT(locale);
    return (
        <SharedDialog
            isOpen={open}
            onClose={() => onOpenChange(false)}
            ariaLabelledBy={titleId}
            claimHistoryEntry={claimHistoryEntry}
            size="md"
            className={cx(styles.panel, side === 'bottom' ? styles.bottom : styles.right)}
            overlayClassName={cx(
                styles.overlay,
                side === 'bottom' ? styles.overlayBottom : styles.overlayRight
            )}
        >
            {side === 'bottom' ? (
                <span
                    className={styles.handle}
                    aria-hidden="true"
                />
            ) : null}
            <header
                className={styles.header}
                {...helpAttr({ helpId })}
            >
                <h2
                    id={titleId}
                    className={styles.title}
                >
                    {title}
                </h2>
                <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    aria-label={t('account.ui.drawerClose')}
                    onClick={() => onOpenChange(false)}
                >
                    <CloseIcon
                        size="sm"
                        aria-hidden="true"
                    />
                </Button>
            </header>
            <div className={`${styles.body} dialog-panel-scroll`}>{children}</div>
            {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </SharedDialog>
    );
}
