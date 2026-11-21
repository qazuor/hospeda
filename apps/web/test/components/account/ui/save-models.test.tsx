/**
 * Tests for StickySaveBar, useSaveBar and AutoSaveChip (HOS-2413 T-026, T-027).
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AutoSaveChip,
    formatSavedTime,
    type SaveOutcome,
    StickySaveBar,
    useSaveBar
} from '../../../../src/components/account/ui';

const registerLeaveWarning = vi.hoisted(() => vi.fn(() => () => {}));
vi.mock('../../../../src/lib/forms/leave-warning-registry', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/lib/forms/leave-warning-registry')>()),
    registerLeaveWarning
}));

afterEach(() => {
    registerLeaveWarning.mockClear();
});

function Form({
    onSave,
    initialDirty = false
}: {
    readonly onSave: () => Promise<SaveOutcome>;
    readonly initialDirty?: boolean;
}) {
    const [dirty, setDirty] = useState(initialDirty);
    const bar = useSaveBar({
        locale: 'es',
        isDirty: dirty,
        idPrefix: 'acc',
        onSave: async () => {
            const outcome = await onSave();
            if (outcome.ok) setDirty(false);
            return outcome;
        },
        onDiscard: () => setDirty(false)
    });
    return (
        <>
            <input
                id="acc-name"
                aria-label="Nombre"
                onChange={() => setDirty(true)}
            />
            <StickySaveBar
                status={bar.status}
                locale="es"
                onSave={bar.save}
                onDiscard={bar.discard}
                onGoToFirstError={bar.goToFirstError}
            />
        </>
    );
}

describe('StickySaveBar + useSaveBar', () => {
    it('appears only when dirty, with its spacer', async () => {
        const user = userEvent.setup();
        render(<Form onSave={async () => ({ ok: true })} />);
        expect(screen.queryByRole('region', { name: 'Guardar cambios' })).toBeNull();
        expect(screen.queryByTestId('save-bar-spacer')).toBeNull();
        await user.type(screen.getByLabelText('Nombre'), 'a');
        expect(screen.getByRole('region', { name: 'Guardar cambios' })).toBeInTheDocument();
        expect(screen.getByTestId('save-bar-spacer')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Tenés cambios sin guardar');
    });

    it('discard clears the bar', async () => {
        const user = userEvent.setup();
        render(<Form onSave={async () => ({ ok: true })} />);
        await user.type(screen.getByLabelText('Nombre'), 'a');
        await user.click(screen.getByRole('button', { name: 'Descartar' }));
        expect(screen.queryByRole('region')).toBeNull();
    });

    it('goes saving then saved, and Save is busy meanwhile', async () => {
        const user = userEvent.setup();
        let finish: (outcome: SaveOutcome) => void = () => {};
        render(<Form onSave={() => new Promise<SaveOutcome>((resolve) => (finish = resolve))} />);
        await user.type(screen.getByLabelText('Nombre'), 'a');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(screen.getByRole('status')).toHaveTextContent('Guardando…');
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toHaveAttribute(
            'aria-busy',
            'true'
        );
        await act(async () => finish({ ok: true }));
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent('Cambios guardados')
        );
    });

    it('shows an alert on error and «Ir al primer error» focuses the field', async () => {
        const user = userEvent.setup();
        render(<Form onSave={async () => ({ ok: false, invalidFields: ['name'] })} />);
        await user.type(screen.getByLabelText('Nombre'), 'a');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar');
        await user.click(screen.getByRole('button', { name: 'Ir al primer error' }));
        expect(screen.getByLabelText('Nombre')).toHaveFocus();
    });

    it('Ctrl+S saves', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue({ ok: true });
        render(<Form onSave={onSave} />);
        await user.type(screen.getByLabelText('Nombre'), 'a');
        await user.keyboard('{Control>}s{/Control}');
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    });

    it('registers exactly one leave warning, through the shared guard', async () => {
        const user = userEvent.setup();
        render(<Form onSave={async () => ({ ok: true })} />);
        expect(registerLeaveWarning).not.toHaveBeenCalled();
        await user.type(screen.getByLabelText('Nombre'), 'a');
        expect(registerLeaveWarning).toHaveBeenCalledTimes(1);
    });
});

describe('AutoSaveChip', () => {
    it('formats the time as es-AR 24h from a fixed date', () => {
        // 17:32 UTC is 14:32 in Buenos Aires (UTC-3)
        expect(formatSavedTime({ date: new Date('2026-11-20T17:32:00Z') })).toBe('14:32');
        render(
            <AutoSaveChip
                status="saved"
                savedAt={new Date('2026-11-20T23:05:00Z')}
                locale="es"
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent('Guardado 20:05');
    });

    it('says saving with role=status', () => {
        render(
            <AutoSaveChip
                status="saving"
                locale="es"
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent('Guardando…');
    });

    it('switches to role=alert on error and runs the retry', async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        render(
            <AutoSaveChip
                status="error"
                locale="es"
                onRetry={onRetry}
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent('No se guardó');
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
