/**
 * Dialog — the Mi Cuenta kit modal (HOS-2413 T-011, OD-3).
 *
 * The kit skin over the existing shared Dialog (`shared/ui/Dialog.client`), not
 * a new primitive and never a native `<dialog>`. The shared one keeps the
 * mechanics: focus trap, scroll lock, Escape, focus restored to the trigger,
 * the HOS-310 back button that closes the dialog, and the `dialog-panel`
 * height cap. The kit adds sizes `sm` 480 and `md` 640, a title in the
 * `app-section` style, the `popover` surface with `shadow-overlay` on the
 * `overlay` scrim, and an inner scroll region for long content.
 *
 * @module components/account/ui/Dialog
 */

import { CloseIcon } from '@repo/icons';
import { type ReactNode, type RefObject, useEffect, useId } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Dialog as SharedDialog } from '../../shared/ui/Dialog.client';
import { Button } from './Button';
import styles from './Dialog.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Sizes: `sm` 480px, `md` 640px. Below 30rem both take the full width minus the gutter. */
export type DialogSize = 'sm' | 'md';

/** Props of {@link Dialog}. */
export interface DialogProps {
    /** Controlled open state. */
    readonly open: boolean;
    /** Called with `false` on Escape, scrim click, close button or the back button. */
    readonly onOpenChange: (open: boolean) => void;
    /** Visible title: the dialog's accessible name. */
    readonly title: ReactNode;
    /** Locale for the close button label. */
    readonly locale: SupportedLocale;
    /** Optional supporting line under the title. */
    readonly description?: ReactNode;
    /** Footer actions, aligned right. */
    readonly footer?: ReactNode;
    /** Width preset. @default 'md' */
    readonly size?: DialogSize;
    /** Element to focus on open instead of the panel. */
    readonly initialFocus?: RefObject<HTMLElement | null>;
    /**
     * Claim a history entry so the back button closes the dialog (HOS-310).
     * Turn off only for a dialog that resolves into a navigation.
     * @default true
     */
    readonly claimHistoryEntry?: boolean;
    /** Optional help anchor rendered as `data-help` on the panel content. */
    readonly helpId?: HelpAnchor;
    /** Dialog body. */
    readonly children?: ReactNode;
}

/**
 * Moves focus to `target` once the shared Dialog has focused its own panel.
 * Rendered inside the panel, so it only mounts when the portal is real.
 */
function FocusOnMount({ target }: { readonly target: RefObject<HTMLElement | null> }) {
    useEffect(() => {
        // The shared Dialog focuses the panel on the next frame: wait one more.
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => target.current?.focus());
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [target]);
    return null;
}

/**
 * The kit modal dialog.
 *
 * @param props - See {@link DialogProps}.
 * @returns The shared Dialog wearing the kit skin.
 */
export function Dialog({
    open,
    onOpenChange,
    title,
    locale,
    description,
    footer,
    size = 'md',
    initialFocus,
    claimHistoryEntry = true,
    helpId,
    children
}: DialogProps) {
    const titleId = useId();
    const t = createT(locale);
    return (
        <SharedDialog
            isOpen={open}
            onClose={() => onOpenChange(false)}
            ariaLabelledBy={titleId}
            size={size}
            className={styles.panel}
            overlayClassName={styles.overlay}
            claimHistoryEntry={claimHistoryEntry}
        >
            {initialFocus ? <FocusOnMount target={initialFocus} /> : null}
            <header
                className={styles.header}
                {...helpAttr({ helpId })}
            >
                <div>
                    <h2
                        id={titleId}
                        className={styles.title}
                    >
                        {title}
                    </h2>
                    {description ? <p className={styles.description}>{description}</p> : null}
                </div>
                <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    aria-label={t('account.ui.dialogClose')}
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
