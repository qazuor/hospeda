/**
 * Tests for the editor save signals (HOS-2487): EditorSaveBar (bar model) and
 * the autosave signal + EditorAutoSaveChip (auto model).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorAutoSaveChip } from '../../../../src/components/account/editor-shell/EditorAutoSaveChip.client';
import { EditorSaveBar } from '../../../../src/components/account/editor-shell/EditorSaveBar';
import {
    __resetEditorAutoSave,
    getEditorAutoSave,
    reportEditorAutoSave,
    runEditorAutoSave,
    runRetryableEditorAutoSave
} from '../../../../src/components/account/editor-shell/editor-auto-save-signal';
import { __resetLeaveWarningRegistry } from '../../../../src/lib/forms/leave-warning-registry';

afterEach(() => {
    __resetEditorAutoSave();
    __resetLeaveWarningRegistry();
});

describe('EditorSaveBar', () => {
    it('renders the bar signal and stays empty while the form is clean', () => {
        // Act
        const { container } = render(
            <EditorSaveBar
                locale="es"
                isDirty={false}
                onSave={async () => ({ ok: true })}
                onDiscard={() => undefined}
            />
        );

        // Assert
        expect(container.querySelector('[data-editor-save-signal="bar"]')).not.toBeNull();
        expect(screen.queryByRole('region')).toBeNull();
    });

    it('shows save and discard once dirty, and runs the callbacks', async () => {
        // Arrange
        const onSave = vi.fn(async () => ({ ok: true }) as const);
        const onDiscard = vi.fn();
        render(
            <EditorSaveBar
                locale="es"
                isDirty
                onSave={onSave}
                onDiscard={onDiscard}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
        });

        // Assert
        expect(onDiscard).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('offers «Ir al primer error» after a failed save when it knows the field ids', async () => {
        render(
            <EditorSaveBar
                locale="es"
                isDirty
                onSave={async () => ({ ok: false, invalidFields: ['name'] })}
                onDiscard={() => undefined}
                idPrefix="listing"
            />
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
        });

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /primer error/i })).toBeInTheDocument();
    });
});

describe('editor autosave signal', () => {
    it('reports saving then saved around a successful action', async () => {
        // Arrange
        const seen: string[] = [];
        let finish: (value: boolean) => void = () => undefined;
        const pending = new Promise<boolean>((resolve) => {
            finish = resolve;
        });

        // Act
        const run = runEditorAutoSave({ save: () => pending });
        seen.push(getEditorAutoSave().status);
        finish(true);
        const ok = await run;
        seen.push(getEditorAutoSave().status);

        // Assert
        expect(ok).toBe(true);
        expect(seen).toEqual(['saving', 'saved']);
    });

    it('reports an error with the retry on a rejected or false save', async () => {
        const retry = vi.fn();

        const ok = await runEditorAutoSave({
            save: async () => {
                throw new Error('network');
            },
            retry
        });
        const state = getEditorAutoSave();

        expect(ok).toBe(false);
        expect(state.status).toBe('error');
        expect(state.status === 'error' ? state.retry : undefined).toBe(retry);
    });
});

describe('EditorAutoSaveChip', () => {
    it('renders the auto signal with no chip until a save is reported', () => {
        const { container } = render(<EditorAutoSaveChip locale="es" />);

        expect(container.querySelector('[data-editor-save-signal="auto"]')).not.toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows the kit chip for whatever an island reports', () => {
        render(<EditorAutoSaveChip locale="es" />);

        act(() => {
            reportEditorAutoSave({ status: 'saving' });
        });
        expect(screen.getByRole('status')).toHaveTextContent('Guardando');

        const retry = vi.fn();
        act(() => {
            reportEditorAutoSave({ status: 'error', retry });
        });
        fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
        expect(retry).toHaveBeenCalledTimes(1);
    });
});

describe('runRetryableEditorAutoSave (HOS-2489)', () => {
    it('returns ok and leaves the chip saved on success', async () => {
        // Arrange
        const save = vi.fn().mockResolvedValue(true);

        // Act
        const result = await runRetryableEditorAutoSave({ save });

        // Assert
        expect(result).toEqual({ ok: true });
        expect(getEditorAutoSave().status).toBe('saved');
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('offers a chip retry that runs the same save again', async () => {
        // Arrange
        const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        // Act
        const result = await runRetryableEditorAutoSave({ save });
        const failed = getEditorAutoSave();

        // Assert
        expect(result).toEqual({ ok: false });
        expect(failed.status).toBe('error');
        const retry = failed.status === 'error' ? failed.retry : undefined;
        expect(retry).toBeTypeOf('function');

        await act(async () => {
            retry?.();
            await Promise.resolve();
        });
        expect(save).toHaveBeenCalledTimes(2);
        expect(getEditorAutoSave().status).toBe('saved');
    });
});
