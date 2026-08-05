/**
 * @file PostCreateForm.test.tsx
 * @description RTL tests for the editor self-service post create form island
 * (HOS-374 §5.2.2).
 *
 * Covers: all required fields render, submitting an invalid payload (content
 * under the 100-char minimum) surfaces validation and never calls the create
 * endpoint, a valid submit calls `postEditApi.create` with the right payload
 * and redirects to the editor URL, and an API error surfaces via
 * `handleApiError` without redirecting.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostCreateForm } from '../../../../src/components/post/editor/PostCreateForm.client';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../../src/components/post/editor/PostCreateForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    postEditApi: { create: vi.fn() }
}));

import { postEditApi } from '../../../../src/lib/api/endpoints-protected';

const mockCreate = vi.mocked(postEditApi.create);

const VALID_CONTENT =
    'Un texto lo suficientemente largo como para superar el mínimo de cien caracteres que exige el esquema de creación de publicaciones del editor.';

function fillValidForm(): void {
    fireEvent.change(screen.getByLabelText('Título'), {
        target: { value: 'Un título de prueba' }
    });
    fireEvent.change(screen.getByLabelText('Categoría'), {
        target: { value: 'CULTURE' }
    });
    fireEvent.change(screen.getByLabelText('Resumen'), {
        target: { value: 'Un resumen suficientemente largo para pasar la validación.' }
    });
    fireEvent.change(screen.getByLabelText('Contenido'), {
        target: { value: VALID_CONTENT }
    });
}

beforeEach(() => {
    mockCreate.mockReset();
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

describe('PostCreateForm', () => {
    it('renders all required fields', () => {
        render(<PostCreateForm locale="es" />);

        expect(screen.getByLabelText('Título')).toBeInTheDocument();
        expect(screen.getByLabelText('Categoría')).toBeInTheDocument();
        expect(screen.getByLabelText('Resumen')).toBeInTheDocument();
        expect(screen.getByLabelText('Contenido')).toBeInTheDocument();
        expect(screen.getByTestId('post-create-submit')).toBeInTheDocument();
    });

    it('does not submit and shows validation when content is under the 100-char minimum', async () => {
        render(<PostCreateForm locale="es" />);

        fireEvent.change(screen.getByLabelText('Título'), {
            target: { value: 'Un título de prueba' }
        });
        fireEvent.change(screen.getByLabelText('Categoría'), {
            target: { value: 'CULTURE' }
        });
        fireEvent.change(screen.getByLabelText('Resumen'), {
            target: { value: 'Un resumen suficientemente largo para pasar la validación.' }
        });
        fireEvent.change(screen.getByLabelText('Contenido'), {
            target: { value: 'Demasiado corto.' }
        });

        fireEvent.click(screen.getByTestId('post-create-submit'));

        await waitFor(() => {
            expect(screen.getByText(/mínimo 100 caracteres/i)).toBeInTheDocument();
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('does not submit when required fields are empty', async () => {
        render(<PostCreateForm locale="es" />);

        fireEvent.click(screen.getByTestId('post-create-submit'));

        await waitFor(() => {
            expect(mockCreate).not.toHaveBeenCalled();
        });
    });

    it('submits the picked create payload and redirects to the editor on success', async () => {
        mockCreate.mockResolvedValue({ ok: true, data: { id: 'post-1' } });

        render(<PostCreateForm locale="es" />);
        fillValidForm();

        fireEvent.click(screen.getByTestId('post-create-submit'));

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        const call = mockCreate.mock.calls[0]?.[0];
        expect(call?.data).toMatchObject({
            title: 'Un título de prueba',
            category: 'CULTURE',
            summary: 'Un resumen suficientemente largo para pasar la validación.',
            content: VALID_CONTENT
        });
        // Never sent from the create form (HOS-374 D-2 / spec §5.2.2).
        expect(call?.data).not.toHaveProperty('authorId');
        expect(call?.data).not.toHaveProperty('isPublished');
        expect(call?.data).not.toHaveProperty('slug');

        await waitFor(() => {
            expect(window.location.href).toContain('/mi-cuenta/publicaciones/post-1/editar');
        });
    });

    it('surfaces an API error via handleApiError and does not redirect', async () => {
        mockCreate.mockResolvedValue({
            ok: false,
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        });

        render(<PostCreateForm locale="es" />);
        fillValidForm();

        fireEvent.click(screen.getByTestId('post-create-submit'));

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
        expect(window.location.href).toBe('');
    });
});
