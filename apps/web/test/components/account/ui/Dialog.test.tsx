/**
 * Tests for the kit Dialog (HOS-2413 T-011).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../../../../src/components/account/ui';

function Harness({
    onChange,
    initialFocus
}: {
    readonly onChange?: (open: boolean) => void;
    readonly initialFocus?: React.RefObject<HTMLElement | null>;
}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
            >
                trigger
            </button>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    onChange?.(next);
                    setOpen(next);
                }}
                title="Editar datos"
                locale="es"
                footer={<button type="button">guardar</button>}
                initialFocus={initialFocus}
            >
                <button type="button">uno</button>
                <input aria-label="campo" />
            </Dialog>
        </>
    );
}

describe('Dialog (kit)', () => {
    it('renders a modal dialog named by its title with the kit skin', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByText('trigger'));
        const dialog = await screen.findByRole('dialog', { name: 'Editar datos' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveClass('panel', 'dialog-panel');
        expect(dialog).toHaveAttribute('data-size', 'md');
    });

    it('wraps long content in the inner scroll region', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByText('trigger'));
        const dialog = await screen.findByRole('dialog');
        expect(dialog.querySelector('.dialog-panel-scroll')).not.toBeNull();
    });

    it('calls onOpenChange(false) on Escape and returns focus to the trigger', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const trigger = screen.getByText('trigger');
        trigger.focus();
        await user.click(trigger);
        await screen.findByRole('dialog');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onChange).toHaveBeenCalledWith(false);
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(trigger).toHaveFocus();
    });

    it('closes from the translated close button', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        await user.click(screen.getByText('trigger'));
        await user.click(await screen.findByRole('button', { name: 'Cerrar diálogo' }));
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('keeps Tab inside the panel', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByText('trigger'));
        await screen.findByRole('dialog');
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true
        });
        (document.activeElement as HTMLElement | null)?.blur();
        document.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it('honours initialFocus', async () => {
        const ref = createRef<HTMLElement>();
        function WithTarget() {
            return (
                <Dialog
                    open
                    onOpenChange={() => {}}
                    title="T"
                    locale="es"
                    initialFocus={ref}
                >
                    <input
                        ref={ref as React.RefObject<HTMLInputElement>}
                        aria-label="objetivo"
                    />
                </Dialog>
            );
        }
        render(<WithTarget />);
        await waitFor(() => expect(screen.getByLabelText('objetivo')).toHaveFocus());
    });
});
