/**
 * @file GastronomyReviewForm.test.tsx
 * @description Unit tests for GastronomyReviewForm.client.tsx (HOS-190 slice 3,
 * form 11). Focused on the client-side title/content min-length gate added to
 * mirror DestinationReviewSidebarCard.client.tsx's pattern — the API does not
 * return per-field errors in production, so this validation is the only gate.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GastronomyReviewForm } from '@/components/gastronomy/GastronomyReviewForm.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { error: unknown; locale: string; fallback: string }) =>
        fallback
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/gastronomy/GastronomyReviewForm.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
    gastronomyId: 'gastro-123',
    gastronomyName: 'La Parrilla de Juan',
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001',
    isAuthenticated: true,
    signInHref: '/es/auth/signin'
};

type FormProps = Parameters<typeof GastronomyReviewForm>[0];

function renderForm(overrides: Partial<FormProps> = {}) {
    return render(
        <GastronomyReviewForm
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

function setupDialogMocks() {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
    });
}

function openDialog() {
    fireEvent.click(screen.getByRole('button', { name: /dejar reseña/i }));
}

function rateFiveStars() {
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GastronomyReviewForm — title/content min-length gate (HOS-190)', () => {
    beforeEach(() => {
        setupDialogMocks();
    });

    it('disables submit and shows a field error when title is 1-2 chars', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        fireEvent.change(screen.getByPlaceholderText(/resumen de tu experiencia/i), {
            target: { value: 'ab' }
        });

        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();
        expect(screen.getByText('El título debe tener al menos 3 caracteres')).toBeInTheDocument();
    });

    it('disables submit and shows a field error when content is 1-9 chars', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        fireEvent.change(screen.getByPlaceholderText(/comparte tu experiencia en detalle/i), {
            target: { value: 'too short' }
        });

        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();
        expect(
            screen.getByText('El comentario debe tener al menos 10 caracteres')
        ).toBeInTheDocument();
    });

    it('does NOT call fetch when title is under the minimum and the form is submitted', () => {
        vi.stubGlobal('fetch', vi.fn());
        renderForm();
        openDialog();
        rateFiveStars();

        fireEvent.change(screen.getByPlaceholderText(/resumen de tu experiencia/i), {
            target: { value: 'ab' }
        });

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(global.fetch).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('allows submit with empty (optional) title and content once rated', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        expect(screen.getByRole('button', { name: /enviar reseña/i })).not.toBeDisabled();
    });

    it('re-enables submit once title/content reach their minimums', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        const titleInput = screen.getByPlaceholderText(/resumen de tu experiencia/i);
        const contentTextarea = screen.getByPlaceholderText(/comparte tu experiencia en detalle/i);

        fireEvent.change(titleInput, { target: { value: 'ab' } });
        fireEvent.change(contentTextarea, { target: { value: 'short' } });
        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();

        fireEvent.change(titleInput, { target: { value: 'Buena experiencia' } });
        fireEvent.change(contentTextarea, {
            target: { value: 'Volvería sin dudas, todo excelente.' }
        });
        expect(screen.getByRole('button', { name: /enviar reseña/i })).not.toBeDisabled();
    });
});
