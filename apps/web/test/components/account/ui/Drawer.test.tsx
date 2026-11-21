/**
 * Tests for Drawer (HOS-2413 T-012).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Drawer } from '../../../../src/components/account/ui';

describe('Drawer', () => {
    function DrawerHarness({ side }: { readonly side?: 'bottom' | 'right' }) {
        const [open, setOpen] = useState(false);
        return (
            <>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                >
                    trigger
                </button>
                <Drawer
                    open={open}
                    onOpenChange={setOpen}
                    title="Mi cuenta"
                    locale="es"
                    side={side}
                >
                    <a href="/x">item</a>
                </Drawer>
            </>
        );
    }

    it('has a translated close button, closes on Escape and returns focus', async () => {
        const user = userEvent.setup();
        render(<DrawerHarness />);
        const trigger = screen.getByText('trigger');
        trigger.focus();
        await user.click(trigger);
        await screen.findByRole('dialog', { name: 'Mi cuenta' });
        expect(screen.getByRole('button', { name: 'Cerrar panel' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(trigger).toHaveFocus();
    });

    it('closes from the close button', async () => {
        const user = userEvent.setup();
        render(<DrawerHarness />);
        await user.click(screen.getByText('trigger'));
        await user.click(await screen.findByRole('button', { name: 'Cerrar panel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('applies the side class and hides the handle from assistive tech', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<DrawerHarness />);
        await user.click(screen.getByText('trigger'));
        const bottom = await screen.findByRole('dialog');
        expect(bottom).toHaveClass('bottom');
        expect(bottom.querySelector('.handle')).toHaveAttribute('aria-hidden', 'true');
        unmount();
        render(<DrawerHarness side="right" />);
        await user.click(screen.getByText('trigger'));
        const right = await screen.findByRole('dialog');
        expect(right).toHaveClass('right');
        expect(right.querySelector('.handle')).toBeNull();
    });
});
