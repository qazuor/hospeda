/** Draft post creation retains HTTP validation and the shared rich editor. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostCreateForm } from '@/components/post/editor/PostCreateForm.client';
import { postEditApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/endpoints-protected', () => ({ postEditApi: { create: vi.fn() } }));
vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({
        id,
        ariaLabel,
        value,
        onChange
    }: {
        id: string;
        ariaLabel: string;
        value: string;
        onChange: (value: string) => void;
    }) => (
        <textarea
            id={id}
            aria-label={ariaLabel}
            data-testid="rich-editor"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
    )
}));
const create = vi.mocked(postEditApi.create);
const content = `## Una nota con formato\n\n${'Texto de prueba con contenido suficiente. '.repeat(4)}`;
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
const change = (label: string, value: string) =>
    fireEvent.change(field(label), { target: { value } });
function fill() {
    change('Título', 'Una nota de prueba');
    change('Categoría', 'CULTURE');
    change('Resumen', 'Un resumen para el listado del blog.');
    change('Contenido', content);
}

beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ ok: true, data: { id: 'post-1' } });
    Object.defineProperty(window, 'location', { value: { href: '' }, configurable: true });
});

describe('PostCreateForm', () => {
    it('renders a distinct Section, kit controls, HTTP limits, hints and the rich editor', () => {
        const { container } = render(<PostCreateForm locale="es" />);
        expect(screen.getByRole('region', { name: 'Datos de la nota' })).toHaveAttribute(
            'data-kit-section'
        );
        expect(container.querySelector('form')).toHaveAttribute('data-hydrated', 'true');
        expect(field('Título')).toHaveAttribute('aria-required', 'true');
        expect(field('Título')).toHaveAttribute('minlength', '5');
        expect(field('Título')).toHaveAttribute('maxlength', '200');
        expect(field('Resumen')).toHaveAttribute(
            'aria-describedby',
            'pc-summary-hint pc-summary-counter'
        );
        expect(screen.getByRole('option', { name: 'Elegí una categoría' })).toHaveValue('');
        expect(screen.getByTestId('rich-editor')).toHaveAttribute('id', 'pc-content');
        expect(screen.getByTestId('post-create-submit')).toHaveClass('primary');
    });

    it.each([0, 15, 10001])('rejects content outside the HTTP bounds (length %s)', (length) => {
        render(<PostCreateForm locale="es" />);
        fill();
        change('Contenido', 'x'.repeat(length));
        fireEvent.click(screen.getByTestId('post-create-submit'));
        expect(create).not.toHaveBeenCalled();
        expect(document.getElementById('pc-content-error')).toBeInTheDocument();
    });

    it('rejects missing required values', () => {
        render(<PostCreateForm locale="es" />);
        fireEvent.click(screen.getByTestId('post-create-submit'));
        expect(create).not.toHaveBeenCalled();
        expect(field('Título')).toHaveAttribute('aria-invalid', 'true');
    });

    it('submits Markdown unchanged with only required fields, then opens the editor', async () => {
        render(<PostCreateForm locale="es" />);
        fill();
        fireEvent.click(screen.getByTestId('post-create-submit'));
        await waitFor(() => expect(create).toHaveBeenCalledOnce());
        expect(create.mock.calls[0]?.[0]).toEqual({
            data: {
                title: 'Una nota de prueba',
                summary: 'Un resumen para el listado del blog.',
                content,
                category: 'CULTURE'
            }
        });
        expect(window.location.href).toBe('/es/mi-cuenta/publicaciones/post-1/editar/');
    });

    it('shows an API failure without redirecting and clears it before retry validation', async () => {
        create.mockResolvedValue({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'boom' } });
        render(<PostCreateForm locale="es" />);
        fill();
        fireEvent.click(screen.getByTestId('post-create-submit'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
        expect(window.location.href).toBe('');
        change('Título', '');
        fireEvent.click(screen.getByTestId('post-create-submit'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(create).toHaveBeenCalledOnce();
    });
});
