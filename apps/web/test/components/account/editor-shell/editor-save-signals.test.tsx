/**
 * Tests for the editor save signals (HOS-2487): EditorSaveBar (bar model) and
 * the autosave signal + EditorAutoSaveChip (auto model).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
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
    it('reports clean and dirty, and resets the signal on unmount', () => {
        const props = {
            locale: 'es',
            onSave: async () => ({ ok: true }),
            onDiscard: vi.fn()
        } as const;
        const { rerender, unmount } = render(
            <EditorSaveBar
                {...props}
                isDirty={false}
            />
        );
        expect(getEditorAutoSave().status).toBe('clean');
        rerender(
            <EditorSaveBar
                {...props}
                isDirty
            />
        );
        expect(getEditorAutoSave().status).toBe('dirty');
        rerender(
            <EditorSaveBar
                {...props}
                isDirty={false}
            />
        );
        expect(getEditorAutoSave().status).toBe('clean');
        rerender(
            <EditorSaveBar
                {...props}
                isDirty
            />
        );
        unmount();
        expect(getEditorAutoSave().status).toBe('idle');
    });

    it('reports saving, error with working retry, saved time and clean after the saved interval', async () => {
        vi.useFakeTimers();
        try {
            let finish: (result: { ok: boolean }) => void = () => undefined;
            const onSave = vi.fn(
                () =>
                    new Promise<{ ok: boolean }>((resolve) => {
                        finish = resolve;
                    })
            );
            function Form() {
                const [dirty, setDirty] = useState(true);
                return (
                    <>
                        <EditorAutoSaveChip
                            locale="es"
                            saveModel="bar"
                        />
                        <EditorSaveBar
                            locale="es"
                            isDirty={dirty}
                            onDiscard={() => setDirty(false)}
                            onSave={async () => {
                                const result = await onSave();
                                if (result.ok) setDirty(false);
                                return result.ok ? { ok: true } : { ok: false };
                            }}
                        />
                    </>
                );
            }
            render(<Form />);
            expect(screen.getByText('Cambios sin guardar')).toHaveAttribute('data-status', 'dirty');
            fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
            expect(getEditorAutoSave().status).toBe('saving');
            await act(async () => finish({ ok: false }));
            expect(getEditorAutoSave()).toMatchObject({
                status: 'error',
                retry: expect.any(Function)
            });
            fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
            expect(onSave).toHaveBeenCalledTimes(2);
            expect(getEditorAutoSave().status).toBe('saving');
            await act(async () => finish({ ok: true }));
            expect(getEditorAutoSave()).toMatchObject({
                status: 'saved',
                savedAt: expect.any(Date)
            });
            expect(screen.getByRole('region')).toHaveAttribute('data-status', 'saved');
            act(() => vi.advanceTimersByTime(3000));
            expect(getEditorAutoSave().status).toBe('clean');
            expect(screen.queryByRole('region')).toBeNull();
            expect(screen.getByText('Todo guardado')).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
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
    it.each([
        'auto',
        'bar'
    ] as const)('renders a clean %s chip during SSR without mutating the shared server state', (saveModel) => {
        const html = renderToString(
            <EditorAutoSaveChip
                locale="es"
                saveModel={saveModel}
            />
        );
        expect(html).toContain('Todo guardado');
        expect(html).toContain(`data-editor-save-signal="${saveModel}"`);
        expect(getEditorAutoSave().status).toBe('idle');
    });

    it('keeps the SSR clean bar chip on initial client render', () => {
        render(
            <EditorAutoSaveChip
                locale="es"
                saveModel="bar"
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent('Todo guardado');
    });
    it('renders the auto signal with a clean chip before a save is reported', () => {
        const { container } = render(<EditorAutoSaveChip locale="es" />);

        expect(container.querySelector('[data-editor-save-signal="auto"]')).not.toBeNull();
        expect(screen.getByRole('status')).toHaveTextContent('Todo guardado');
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
