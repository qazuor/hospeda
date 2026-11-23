/**
 * @file PropertyCardMenu.client.tsx
 * @description The «Más acciones» menu of a property card (HOS-2483, spec
 * HOS-2414 §6.2): every action of the card except its ONE primary action.
 *
 * Links (Editar, Ver en el sitio) navigate. Despublicar and Eliminar open a kit
 * `Dialog` that mounts the SAME `UnpublishButton` / `DeleteButton` islands the
 * card used before, straight on their confirmation step: the confirmation copy
 * (trial and recurring add-on lines, the add-ons a delete loses), the endpoints
 * and the reload after success are theirs, untouched. The menu only decides
 * which question is on screen.
 */

import { type JSX, useState } from 'react';
import { Dialog, Menu, type MenuItem } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { DeleteButton, type DeleteButtonProps } from './DeleteButton.client';
import { UnpublishButton, type UnpublishButtonProps } from './UnpublishButton.client';

/** The confirmation the menu can open. */
type OpenConfirm = 'unpublish' | 'delete' | null;

/** Props of {@link PropertyCardMenu}. */
export interface PropertyCardMenuProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Translated trigger name, naming the property («Más acciones para X»). */
    readonly label: string;
    /** «Editar» link, when Editar is not the card's primary action. */
    readonly edit?: { readonly href: string; readonly label: string };
    /** «Ver en el sitio» link (published only); opens in a new tab. */
    readonly viewOnSite?: { readonly href: string; readonly label: string };
    /** Despublicar: the UnpublishButton props (published only). */
    readonly unpublish?: Omit<
        UnpublishButtonProps,
        'startConfirming' | 'onCancel' | 'onPendingChange'
    >;
    /** Eliminar: the DeleteButton props (every state but purged). */
    readonly remove?: Omit<DeleteButtonProps, 'startConfirming' | 'onCancel' | 'onPendingChange'>;
}

/**
 * Renders the card menu and, on demand, its confirmation dialog.
 *
 * @param props - See {@link PropertyCardMenuProps}.
 * @returns The menu (nothing when the card has no secondary action).
 */
export function PropertyCardMenu({
    locale,
    label,
    edit,
    viewOnSite,
    unpublish,
    remove
}: PropertyCardMenuProps): JSX.Element | null {
    const [open, setOpen] = useState<OpenConfirm>(null);
    // While a confirmed action is in flight the dialog refuses Escape, the
    // backdrop and its close button: closing it would hide the error.
    const [pending, setPending] = useState(false);
    const close = () => setOpen(null);
    const requestClose = (next: boolean) => {
        if (!next && !pending) close();
    };

    const items: MenuItem[] = [];
    if (edit) items.push({ id: 'edit', label: edit.label, href: edit.href });
    if (viewOnSite)
        items.push({ id: 'view', label: viewOnSite.label, href: viewOnSite.href, external: true });
    if (unpublish)
        items.push({
            id: 'unpublish',
            label: unpublish.label,
            onSelect: () => setOpen('unpublish')
        });
    if (remove)
        items.push({
            id: 'delete',
            label: remove.label,
            tone: 'danger',
            onSelect: () => setOpen('delete')
        });
    if (items.length === 0) return null;

    return (
        <>
            <Menu
                label={label}
                items={items}
                locale={locale}
            />
            {unpublish ? (
                <Dialog
                    open={open === 'unpublish'}
                    onOpenChange={requestClose}
                    title={unpublish.label}
                    locale={locale}
                    size="sm"
                    role="alertdialog"
                >
                    {open === 'unpublish' ? (
                        <UnpublishButton
                            {...unpublish}
                            startConfirming
                            onCancel={close}
                            onPendingChange={setPending}
                        />
                    ) : null}
                </Dialog>
            ) : null}
            {remove ? (
                <Dialog
                    open={open === 'delete'}
                    onOpenChange={requestClose}
                    title={remove.label}
                    locale={locale}
                    size="sm"
                    role="alertdialog"
                >
                    {open === 'delete' ? (
                        <DeleteButton
                            {...remove}
                            startConfirming
                            onCancel={close}
                            onPendingChange={setPending}
                        />
                    ) : null}
                </Dialog>
            ) : null}
        </>
    );
}
