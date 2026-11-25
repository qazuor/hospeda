/** Real Tiptap integration: empty mount, Markdown submission and field ARIA. */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostCreateForm } from '@/components/post/editor/PostCreateForm.client';
import { postEditApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/endpoints-protected', () => ({ postEditApi: { create: vi.fn() } }));
const create = vi.mocked(postEditApi.create);

beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ ok: true, data: { id: 'post-rich' } });
    Object.defineProperty(window, 'location', { value: { href: '' }, configurable: true });
});

describe('PostCreateForm with the real rich editor', () => {
    it('stays empty on mount, associates errors, and submits formatted Markdown after editing', async () => {
        render(<PostCreateForm locale="es" />);
        const editable = await screen.findByRole('textbox', { name: 'Contenido', exact: true });
        expect(editable).toHaveAttribute('contenteditable', 'true');
        expect(editable).toHaveAttribute('aria-required', 'true');
        expect(editable).toHaveTextContent('');
        expect(document.getElementById('pc-content-counter')).toHaveTextContent('0 de 10000');
        expect(create).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('post-create-submit'));
        await waitFor(() => expect(editable).toHaveAttribute('aria-invalid', 'true'));
        expect(editable).toHaveAttribute(
            'aria-describedby',
            'pc-content-hint pc-content-counter pc-content-error'
        );

        fireEvent.change(screen.getByLabelText(/^Título/), {
            target: { value: 'Una nota con formato' }
        });
        fireEvent.change(screen.getByLabelText(/^Categoría/), { target: { value: 'CULTURE' } });
        fireEvent.change(screen.getByLabelText(/^Resumen/), {
            target: { value: 'Un resumen para el listado del blog.' }
        });
        const editor = (editable as HTMLElement & { editor: Editor }).editor;
        act(() => {
            editor.commands.setContent({
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: { level: 2 },
                        content: [{ type: 'text', text: 'Una nota' }]
                    },
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'Este contenido tiene ' },
                            {
                                type: 'text',
                                text: 'formato enriquecido',
                                marks: [{ type: 'bold' }]
                            },
                            {
                                type: 'text',
                                text: ' y suficientes caracteres para superar el mínimo requerido por el contrato HTTP de publicaciones.'
                            }
                        ]
                    }
                ]
            });
        });
        fireEvent.click(screen.getByTestId('post-create-submit'));
        await waitFor(() => expect(create).toHaveBeenCalledOnce());
        expect(create.mock.calls[0]?.[0].data.content).toContain('## Una nota');
        expect(create.mock.calls[0]?.[0].data.content).toContain('**formato enriquecido**');
        expect(editable).toHaveAttribute('aria-invalid', 'false');
        expect(editable).toHaveAttribute('aria-describedby', 'pc-content-hint pc-content-counter');
        expect(window.location.href).toBe('/es/mi-cuenta/publicaciones/post-rich/editar/');
    });
});
