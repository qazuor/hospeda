/**
 * @file LinkUrlDialog.client.tsx
 * @description Product-styled prompt for the rich-text editor's link URL
 * (HOS-957).
 *
 * The toolbar's link button used to raise `window.prompt('URL del enlace', …)`.
 * That dialog shows the site's domain, cannot be styled, sits outside the app's
 * focus management, and — the half of HOS-957 that is a plain bug in `/en/` and
 * `/pt/` — pairs OK/Cancel buttons labelled in the BROWSER's language with a
 * message that was hard-coded Spanish.
 *
 * Neither existing primitive covers this. `showConfirmationDialog()` and
 * `ConfirmDeleteDialog` both answer a yes/no question; this one collects a
 * VALUE. So it is a third dialog — but assembled from the same `Dialog` parts,
 * which is what makes it inherit the shared height cap and scroll region
 * HOS-958 installed: `Dialog` composes `.dialog-panel` onto its panel and
 * `DialogBody` composes `.dialog-panel-scroll`, and
 * `scripts/check-dialog-panel.ts` (assertion 4) is what keeps that true.
 *
 * Two structural rules follow from that, and both are easy to undo:
 *
 * 1. **`DialogBody` stays a DIRECT child of `Dialog`.** `.dialog-panel-scroll`
 *    is `flex: 1 1 auto; min-height: 0`, which does nothing at all unless its
 *    parent is the flex column `Dialog`'s own panel provides. Wrapping the body
 *    in a `<form>` would insert a `display: block` parent between them: the
 *    region stops scrolling, the whole panel scrolls instead, and the header
 *    the arrangement exists to pin scrolls away with it. That is why Enter is
 *    handled on the field with a key handler rather than by a form's submit.
 * 2. **This module's stylesheet never declares `max-height` / `overflow` on the
 *    panel.** A CSS Module class and a global class have identical specificity,
 *    so such a declaration would RACE the shared cap rather than override it —
 *    with every other assertion still green. It styles only the field inside
 *    the body.
 *
 * ## The empty string is load-bearing
 *
 * `window.prompt` had three outcomes and the caller branched on all three:
 * `null` (cancelled — do nothing), `''` (submitted empty — REMOVE the link),
 * and any other string (set the link). This dialog keeps that contract:
 * `onCancel` is the `null` case, and `onSubmit('')` is the removal. Collapsing
 * the empty case into a cancel would leave an owner with no way to unlink a
 * selection.
 *
 * @module components/host/editor/LinkUrlDialog
 */

import { type JSX, type KeyboardEvent, useEffect, useId, useState } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import styles from './LinkUrlDialog.module.css';

/** Props for {@link LinkUrlDialog}. */
export interface LinkUrlDialogProps {
    /** Whether the dialog is visible. */
    readonly isOpen: boolean;
    /** URL the selection already carries, pre-filled into the field. */
    readonly initialUrl: string;
    /** Dialog title (already localized). */
    readonly title: string;
    /** Visible label of the URL field (already localized). */
    readonly label: string;
    /** Hint explaining that an empty value removes the link (already localized). */
    readonly hint: string;
    /** Placeholder shown in the empty field. */
    readonly placeholder: string;
    /** Label of the confirming CTA. */
    readonly submitLabel: string;
    /** Label of the dismissing CTA. */
    readonly cancelLabel: string;
    /** Accessible label of the header's close button. */
    readonly closeLabel: string;
    /** Receives the trimmed URL. An empty string means "remove the link". */
    readonly onSubmit: (url: string) => void;
    /** Dismisses the dialog without touching the link. */
    readonly onCancel: () => void;
}

/**
 * Asks for a link URL.
 *
 * @example
 * ```tsx
 * <LinkUrlDialog
 *     isOpen={isLinkDialogOpen}
 *     initialUrl={linkInitialUrl}
 *     title={t('common.richText.linkDialog.title', 'Enlace')}
 *     label={t('common.richText.linkDialog.label', 'URL del enlace')}
 *     hint={t('common.richText.linkDialog.hint', 'Dejalo vacío para quitar el enlace.')}
 *     placeholder={t('common.richText.linkDialog.placeholder', 'https://ejemplo.com')}
 *     submitLabel={t('common.richText.linkDialog.submit', 'Aplicar')}
 *     cancelLabel={t('common.cancel', 'Cancelar')}
 *     closeLabel={t('common.close', 'Cerrar')}
 *     onSubmit={applyLink}
 *     onCancel={closeLinkDialog}
 * />
 * ```
 */
export function LinkUrlDialog({
    isOpen,
    initialUrl,
    title,
    label,
    hint,
    placeholder,
    submitLabel,
    cancelLabel,
    closeLabel,
    onSubmit,
    onCancel
}: LinkUrlDialogProps): JSX.Element {
    const titleId = useId();
    const inputId = useId();
    const hintId = useId();
    const [url, setUrl] = useState(initialUrl);

    // The dialog stays mounted between openings, so the field is re-seeded from
    // the CURRENT selection every time it opens. Without this the second link
    // the owner edits arrives pre-filled with the first one's URL.
    useEffect(() => {
        if (isOpen) setUrl(initialUrl);
    }, [isOpen, initialUrl]);

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.key !== 'Enter') return;
        // There is no <form> here (see rule 1 in the file header), so Enter has
        // to be wired by hand — the one thing the native prompt got right for
        // free, and the gesture anyone typing a URL will reach for.
        event.preventDefault();
        onSubmit(url.trim());
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onCancel}
            size="sm"
            ariaLabelledBy={titleId}
        >
            <DialogHeader
                onClose={onCancel}
                closeLabel={closeLabel}
                titleId={titleId}
            >
                {title}
            </DialogHeader>
            <DialogBody>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor={inputId}
                    >
                        {label}
                    </label>
                    <input
                        id={inputId}
                        className={styles.input}
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        aria-describedby={hintId}
                        placeholder={placeholder}
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <p
                        id={hintId}
                        className={styles.hint}
                    >
                        {hint}
                    </p>
                </div>
            </DialogBody>
            <DialogFooter>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={styles.submitBtn}
                        onClick={() => onSubmit(url.trim())}
                    >
                        {submitLabel}
                    </button>
                </div>
            </DialogFooter>
        </Dialog>
    );
}
