/**
 * Owner decision 7 (Mi cuenta UI epic): a failed save is told by the save bar
 * alone. The bar shows the failure's own reason (`SaveOutcome.message`, or the
 * `errorMessage` a form hands it) instead of the generic line.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type SaveOutcome, StickySaveBar, useSaveBar } from '../../../../src/components/account/ui';

vi.mock('../../../../src/lib/forms/leave-warning-registry', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/lib/forms/leave-warning-registry')>()),
    registerLeaveWarning: vi.fn(() => () => {})
}));

function Form({ onSave }: { readonly onSave: () => Promise<SaveOutcome> }) {
    const [dirty, setDirty] = useState(false);
    const bar = useSaveBar({
        locale: 'es',
        isDirty: dirty,
        onSave,
        onDiscard: () => setDirty(false)
    });
    return (
        <>
            <input
                aria-label="Nombre"
                onChange={() => setDirty(true)}
            />
            <StickySaveBar
                status={bar.status}
                locale="es"
                errorMessage={bar.errorMessage}
                onSave={bar.save}
                onDiscard={bar.discard}
            />
        </>
    );
}

describe('save bar failure message (owner decision 7)', () => {
    it('shows the outcome message instead of the generic error line', async () => {
        // Arrange
        const user = userEvent.setup();
        render(<Form onSave={async () => ({ ok: false, message: 'El nombre ya existe.' })} />);
        await user.type(screen.getByLabelText('Nombre'), 'a');

        // Act
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent('El nombre ya existe.');
        expect(screen.queryByText('No se pudieron guardar los cambios')).toBeNull();
    });

    it('keeps the generic line when the failure carries no message', async () => {
        const user = userEvent.setup();
        render(<Form onSave={async () => ({ ok: false })} />);
        await user.type(screen.getByLabelText('Nombre'), 'a');

        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No se pudieron guardar los cambios'
        );
    });

    it('drops a previous failure message once a save succeeds', async () => {
        const user = userEvent.setup();
        const onSave = vi
            .fn<() => Promise<SaveOutcome>>()
            .mockResolvedValueOnce({ ok: false, message: 'Falló.' })
            .mockResolvedValueOnce({ ok: true });
        render(<Form onSave={onSave} />);
        await user.type(screen.getByLabelText('Nombre'), 'a');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Falló.');

        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
        expect(screen.queryByText('Falló.')).toBeNull();
    });

    it('renders a form-supplied errorMessage only while in error', () => {
        const { rerender } = render(
            <StickySaveBar
                status="dirty"
                locale="es"
                errorMessage="Error de conexión"
                onSave={vi.fn()}
                onDiscard={vi.fn()}
            />
        );
        expect(screen.queryByText('Error de conexión')).toBeNull();

        rerender(
            <StickySaveBar
                status="error"
                locale="es"
                errorMessage="Error de conexión"
                onSave={vi.fn()}
                onDiscard={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent('Error de conexión');
    });
});
